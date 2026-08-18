// Firebase setup, demo adapter, theme, shared browser helpers
// Keep a deployment/configuration fault from turning the role screen into inert buttons.
var firebaseBootError = null;
var fbDb = null;
var fbAuth = null;
try {
  if (typeof firebase === 'undefined') throw new Error('Firebase library tidak tersedia');
  if (typeof firebaseConfig === 'undefined' || !firebaseConfig?.projectId) throw new Error('Konfigurasi Firebase tidak tersedia');
  firebase.initializeApp(firebaseConfig);
  fbDb = firebase.database();
  fbAuth = firebase.auth();
  var authPersistenceReady = fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => {
    console.warn('Auth persistence gagal', e);
    return false;
  });
} catch (e) {
  firebaseBootError = e;
  console.error('MULA startup failed:', e);
}

var currentUser = null;
var authStateReadyResolve = null;
var authStateReady = new Promise(resolve => { authStateReadyResolve = resolve; });
if (fbAuth) fbAuth.onAuthStateChanged(user => {
  currentUser = user;
  if (authStateReadyResolve) {
    authStateReadyResolve(user);
    authStateReadyResolve = null;
  }
  if (user && !user.isAnonymous) {
    console.log('Admin session restored.');
    // Hide email input, only require PIN
    const emailInp = document.getElementById('emailInput');
    if(emailInp) emailInp.style.display = 'none';
    const pwInp = document.getElementById('pwInput');
    if(pwInp) pwInp.placeholder = 'Masukkan PIN Admin';
    // Firebase LOCAL persistence restores the admin session after a reload.
    // Enter automatically so mobile users are not left on the role screen.
    if(typeof enterApp==='function' && role!=='admin') enterApp('admin');
  } else if (!user) {
    Promise.resolve(typeof authPersistenceReady==='undefined'?true:authPersistenceReady)
      .then(()=>fbAuth.signInAnonymously())
      .catch(e => console.error("Anonymous auth failed", e));
  }
});

function fbRef(_db, path) { return _db.ref(path); }
function fbOnValue(r, cb) { const f = r.on('value', cb); return () => r.off('value', f); }
function fbGet(r) { return r.get(); }
function fbSet(r, v) { return r.set(v); }
function fbUpdate(r, v) { return r.update(v); }
function fbRemove(r) { return r.remove(); }
function fbPush(r, v) { return v !== undefined ? r.push(v) : r.push(); }

var DEMO_MODE = false;
var db = fbDb;

// Theme System

(function(){
  const KEY='mula_theme';
  const saved=localStorage.getItem(KEY);
  if(saved==='light')document.documentElement.classList.add('light-mode');
  const s=document.createElement('style');
  s.textContent=`
  html{transition:background 0.3s,color 0.3s;}
  html.light-mode{
    --bg:#f7f3ec;--bg2:#ede8df;--surface:#ffffff;--surface2:#f5f1ea;
    --surface3:#ebe5d8;--border:#ddd5c0;--border2:#cfc6b0;
    --text:#1c1710;--muted:#8a8070;--muted2:#6a5f50;--gold-dim:#9a7a2a;
  }
  html.light-mode body{background:var(--bg);color:var(--text);}
  html.light-mode header{background:linear-gradient(180deg,rgba(247,243,236,0.98),rgba(237,232,223,0.96))!important;border-bottom-color:var(--border)!important;}
  html.light-mode .tabs{background:var(--surface2)!important;}
  html.light-mode #lockScreen{background:var(--bg)!important;}
  html.light-mode .btn-admin{background:linear-gradient(135deg,#f5edd8,#ede0c0)!important;color:#7a5c1a!important;}
  html.light-mode .btn-karyawan{background:linear-gradient(135deg,#ebe5d8,#e2dbd0)!important;color:var(--muted2)!important;}
  html.light-mode .modal-box{background:var(--surface)!important;}
  html.light-mode .panel,html.light-mode .card{background:linear-gradient(145deg,var(--surface),var(--surface2))!important;box-shadow:0 4px 20px rgba(0,0,0,0.07)!important;}
  html.light-mode .panel-header{background:linear-gradient(135deg,rgba(212,168,83,0.06),transparent)!important;}
  html.light-mode .qty-display{background:var(--bg2)!important;}
  html.light-mode .note-input{background:rgba(0,0,0,0.03)!important;color:var(--muted2)!important;}
  html.light-mode .note-input::placeholder{color:var(--border2)!important;}
  html.light-mode .del-menu-btn{color:var(--border2)!important;}
  html.light-mode .search-wrap{background:var(--bg2)!important;}
  html.light-mode .keu-table,html.light-mode .keu-card{background:linear-gradient(145deg,var(--surface),var(--surface2))!important;box-shadow:0 2px 12px rgba(0,0,0,0.06)!important;}
  html.light-mode .cook-qty{color:var(--border2)!important;}
  html.light-mode .cook-qty.active{color:var(--gold)!important;}
  html.light-mode .rm-inner{background:var(--surface)!important;}
  html.light-mode .osm-box{background:var(--surface)!important;}
  html.light-mode .osm-foot{background:var(--surface2)!important;}
  #themeToggle{background:none;border:1px solid var(--border);color:var(--muted2);min-width:48px;height:30px;border-radius:20px;cursor:pointer;font-size:11px;display:flex!important;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;padding:0 8px;line-height:1;white-space:nowrap;}
  #themeToggle:hover{border-color:var(--gold-dim);background:rgba(212,168,83,0.1);}
  `;
  document.head.appendChild(s);
  function addBtn(){
    const right=document.querySelector('.header-right');
    if(!right||document.getElementById('themeToggle'))return;
    const btn=document.createElement('button');
    btn.id='themeToggle';
    btn.type='button';
    btn.setAttribute('aria-label','Toggle dark/light mode');
    btn.title='Toggle dark/light';
    btn.textContent=document.documentElement.classList.contains('light-mode')?'Dark':'Light';
    btn.addEventListener('click',()=>{
      const isLight=document.documentElement.classList.toggle('light-mode');
      localStorage.setItem(KEY,isLight?'light':'dark');
      btn.textContent=isLight?'Dark':'Light';
    });
    right.insertBefore(btn,right.firstChild);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',addBtn):addBtn();
})();
// Demo adapter and shared constants
var demoWatchers=new Map();
var demoPollT=null,demoPollBusy=false;
function dClone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function dSnap(v){return{val:()=>v};}
function dPath(path=''){return String(path||'').replace(/^\/+|\/+$/g,'');}
function dRead(obj,path){const parts=dPath(path).split('/').filter(Boolean);let cur=obj;for(const p of parts){if(cur==null)return null;cur=cur[p];}return cur??null;}
async function dFetch(path=''){const res=await fetch(`/__demo/state?path=${encodeURIComponent(dPath(path))}`,{cache:'no-store'});if(!res.ok)throw new Error(`Demo fetch gagal: ${res.status}`);return res.json();}
async function dWrite(mode,path,value){const res=await fetch('/__demo/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,path:dPath(path),value})});if(!res.ok){const t=await res.text();throw new Error(t||`Demo write gagal: ${res.status}`);}return res.json();}
async function dPoll(){if(!DEMO_MODE||demoPollBusy||!demoWatchers.size)return;demoPollBusy=true;try{const state=await dFetch('');for(const [path,w] of demoWatchers){const next=dRead(state,path);const s=JSON.stringify(next);if(s!==w.last){w.last=s;w.cb(dSnap(dClone(next)));}}}catch(e){console.error(e);}finally{demoPollBusy=false;}}
function dEnsurePoll(){if(demoPollT||!DEMO_MODE)return;demoPollT=setInterval(dPoll,700);dPoll();}
function ref(_db,path){return DEMO_MODE?{path:dPath(path)}:fbRef(_db,path);}
function onValue(r,cb){if(!DEMO_MODE)return fbOnValue(r,cb);const path=dPath(r.path);demoWatchers.set(path,{cb,last:'__init__'});dEnsurePoll();dPoll();return()=>demoWatchers.delete(path);}
async function get(r){if(!DEMO_MODE)return fbGet(r);return dSnap(dClone(await dFetch(r.path)));}
async function set(r,v){if(!DEMO_MODE)return fbSet(r,v);return dWrite('set',r.path,v);}
async function update(r,v){if(!DEMO_MODE)return fbUpdate(r,v);return dWrite('update',r.path,v);}
async function remove(r){if(!DEMO_MODE)return fbRemove(r);return dWrite('remove',r.path,null);}
function push(r,v){if(!DEMO_MODE)return fbPush(r,v);const key=`p_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;const child={path:`${dPath(r.path)}/${key}`,key};if(arguments.length>1)dWrite('set',child.path,v);return child;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var PASS=typeof ADMIN_PASS==='string'?ADMIN_PASS:'';
var TABLE_IDS=['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20'];
var APP_URL=location.origin;
function tableUrl(id){return `${location.origin}/table${id}`;}
function getTableParamFromUrl(){
  const params=new URLSearchParams(location.search);
  const parseTableValue=(v)=>{
    const raw=String(v||'').trim();
    const m=raw.match(/^(?:table|meja)?\s*([1-9]|1[0-9]|20)$/i);
    return m?m[1]:null;
  };
  const queryTable=parseTableValue(params.get('table'))||parseTableValue(params.get('meja'));
  if(queryTable)return queryTable;
  if(!params.has('app_v')){
    const legacyT=parseTableValue(params.get('t'));
    if(legacyT)return legacyT;
  }
  const path=location.pathname.replace(/\/+$/,'');
  const match=path.match(/(?:^|\/)(?:table|meja|selfcheckout|guest)[-/]?([1-9]|1[0-9]|20)$/i);
  if(match)return match[1];
  const hashMatch=location.hash.match(/(?:table|meja|selfcheckout|guest)[-/]?([1-9]|1[0-9]|20)/i);
  if(hashMatch)return hashMatch[1];
  return null;
}
var NASI_PRICE=5000;
var NASI_IDS=["beef_yakiniku","tongseng_sapi","ayam_kremes_lmg","ayam_kremes_ijo","ayam_geprek","ayam_bakar","lele_kremes_lmg","lele_kremes_ijo","nila_kremes_lmg","nila_kremes_ijo","soto_padang","udang_saus"];

// === MULA Custom Modal System ===
(function(){
const style=document.createElement('style');
style.id='mulaModalStyles';
style.textContent=`
#mulaModalOverlay{display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:16px;animation:mulaFadeIn 0.18s ease}
#mulaModalOverlay.show{display:flex}
@keyframes mulaFadeIn{from{opacity:0}to{opacity:1}}
@keyframes mulaSlideUp{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.mula-modal{background:linear-gradient(145deg,#1a1814,#12100d);border:1px solid rgba(212,168,83,0.2);border-radius:18px;padding:0;width:min(400px,92vw);box-shadow:0 24px 64px rgba(0,0,0,0.6),0 0 0 1px rgba(212,168,83,0.08);animation:mulaSlideUp 0.22s ease both;overflow:hidden}
.mula-modal-head{padding:20px 22px 12px;display:flex;align-items:center;gap:12px}
.mula-modal-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.mula-modal-icon.confirm{background:rgba(212,168,83,0.12);border:1px solid rgba(212,168,83,0.25)}
.mula-modal-icon.alert{background:rgba(95,169,124,0.12);border:1px solid rgba(95,169,124,0.25)}
.mula-modal-icon.error{background:rgba(201,64,64,0.12);border:1px solid rgba(201,64,64,0.25)}
.mula-modal-icon.warning{background:rgba(242,161,52,0.12);border:1px solid rgba(242,161,52,0.25)}
.mula-modal-title{font-family:'Playfair Display',serif;font-size:17px;color:var(--gold,#c9a84c);line-height:1.2}
.mula-modal-body{padding:0 22px 18px;font-size:14px;color:var(--text,#f4eee0);line-height:1.6;opacity:0.9}
.mula-modal-actions{padding:14px 22px 18px;display:flex;gap:10px;justify-content:flex-end}
.mula-modal-btn{border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;transition:all 0.18s;min-width:80px}
.mula-modal-btn:active{transform:scale(0.97)}
.mula-modal-btn.primary{background:linear-gradient(135deg,var(--gold,#c9a84c),#a07028);color:#000;box-shadow:0 4px 12px rgba(212,168,83,0.25)}
.mula-modal-btn.primary:hover{box-shadow:0 6px 20px rgba(212,168,83,0.35)}
.mula-modal-btn.secondary{background:var(--surface3,#1a1a1a);border:1px solid var(--border2,#333);color:var(--muted2,#888)}
.mula-modal-btn.secondary:hover{border-color:var(--gold-dim,#8a6a1a);color:var(--text)}
.mula-modal-btn.danger{background:rgba(201,64,64,0.15);border:1px solid rgba(201,64,64,0.3);color:#ff8e8e}
.mula-modal-btn.danger:hover{background:rgba(201,64,64,0.25)}
#mulaLoadingOverlay{display:none;position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);align-items:center;justify-content:center;flex-direction:column;gap:16px}
#mulaLoadingOverlay.show{display:flex}
.mula-spinner{width:42px;height:42px;border:3px solid rgba(212,168,83,0.15);border-top-color:var(--gold,#c9a84c);border-radius:50%;animation:mulaSpin 0.7s linear infinite}
@keyframes mulaSpin{to{transform:rotate(360deg)}}
.mula-loading-text{font-family:Outfit,sans-serif;font-size:13px;color:var(--muted2,#888);letter-spacing:0.5px}
html.light-mode .mula-modal{background:linear-gradient(145deg,#fff,#f7f3ec);border-color:var(--border)}
html.light-mode .mula-modal-btn.secondary{background:var(--surface2);border-color:var(--border)}
`;
document.head.appendChild(style);

const overlay=document.createElement('div');
overlay.id='mulaModalOverlay';
document.body.appendChild(overlay);

const loadingOverlay=document.createElement('div');
loadingOverlay.id='mulaLoadingOverlay';
loadingOverlay.innerHTML='<div class="mula-spinner"></div><div class="mula-loading-text" id="mulaLoadingText">Memuat...</div>';
document.body.appendChild(loadingOverlay);

window.mulaConfirm=function(msg,opts){
  opts=opts||{};
  return new Promise(resolve=>{
    const isDestructive=opts.destructive||false;
    const icon=isDestructive?'⚠️':'❓';
    const iconClass=isDestructive?'warning':'confirm';
    const title=opts.title||(isDestructive?'Konfirmasi':'Konfirmasi');
    const confirmText=opts.confirmText||(isDestructive?'Ya, Hapus':'Ya');
    const cancelText=opts.cancelText||'Batal';
    overlay.innerHTML=`<div class="mula-modal">
      <div class="mula-modal-head"><div class="mula-modal-icon ${iconClass}">${icon}</div><div class="mula-modal-title">${title}</div></div>
      <div class="mula-modal-body">${esc(msg)}</div>
      <div class="mula-modal-actions">
        <button class="mula-modal-btn secondary" id="mulaModalNo">${cancelText}</button>
        <button class="mula-modal-btn ${isDestructive?'danger':'primary'}" id="mulaModalYes">${confirmText}</button>
      </div>
    </div>`;
    overlay.classList.add('show');
    const cleanup=(val)=>{overlay.classList.remove('show');resolve(val);};
    document.getElementById('mulaModalYes').addEventListener('click',()=>cleanup(true));
    document.getElementById('mulaModalNo').addEventListener('click',()=>cleanup(false));
    overlay.addEventListener('click',e=>{if(e.target===overlay)cleanup(false);},{once:true});
  });
};

window.mulaAlert=function(msg,opts){
  opts=opts||{};
  return new Promise(resolve=>{
    const isError=(msg||'').toLowerCase().includes('gagal')||(msg||'').toLowerCase().includes('error')||(opts.type==='error');
    const icon=opts.icon||(isError?'❌':'ℹ️');
    const iconClass=isError?'error':'alert';
    const title=opts.title||(isError?'Terjadi Kesalahan':'Informasi');
    overlay.innerHTML=`<div class="mula-modal">
      <div class="mula-modal-head"><div class="mula-modal-icon ${iconClass}">${icon}</div><div class="mula-modal-title">${title}</div></div>
      <div class="mula-modal-body">${esc(msg)}</div>
      <div class="mula-modal-actions">
        <button class="mula-modal-btn primary" id="mulaModalOk">OK</button>
      </div>
    </div>`;
    overlay.classList.add('show');
    const cleanup=()=>{overlay.classList.remove('show');resolve();};
    document.getElementById('mulaModalOk').addEventListener('click',cleanup);
    overlay.addEventListener('click',e=>{if(e.target===overlay)cleanup();},{once:true});
  });
};

let loadingTimer=null;
window.mulaLoading=function(show,text){
  clearTimeout(loadingTimer);
  if(show){
    document.getElementById('mulaLoadingText').textContent=text||'Memuat...';
    loadingOverlay.classList.add('show');
    loadingTimer=setTimeout(()=>loadingOverlay.classList.remove('show'),8000);
  }else{
    loadingOverlay.classList.remove('show');
  }
};
})();
