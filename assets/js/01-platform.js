// Firebase setup, demo adapter, theme, shared browser helpers
firebase.initializeApp(firebaseConfig);
var fbDb = firebase.database();

var fbAuth = firebase.auth();
fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

var currentUser = null;
fbAuth.onAuthStateChanged(user => {
  currentUser = user;
  if (user && !user.isAnonymous) {
    console.log('Admin session restored.');
    // Hide email input, only require PIN
    const emailInp = document.getElementById('emailInput');
    if(emailInp) emailInp.style.display = 'none';
    const pwInp = document.getElementById('pwInput');
    if(pwInp) pwInp.placeholder = 'Masukkan PIN Admin';
  } else if (!user) {
    fbAuth.signInAnonymously().catch(e => console.error("Anonymous auth failed", e));
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
  #themeToggle{background:none;border:1px solid var(--border);color:var(--muted2);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;padding:0;line-height:1;}
  #themeToggle:hover{border-color:var(--gold-dim);background:rgba(212,168,83,0.1);}
  `;
  document.head.appendChild(s);
  function addBtn(){
    const right=document.querySelector('.header-right');
    if(!right||document.getElementById('themeToggle'))return;
    const btn=document.createElement('button');
    btn.id='themeToggle';
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
var PASS=ADMIN_PASS;
var TABLE_IDS=['1','2','3','4','5','6','7','8','9'];
var APP_URL=location.origin;
function tableUrl(id){return `${location.origin}/table${id}`;}
function getTableParamFromUrl(){
  const params=new URLSearchParams(location.search);
  const queryTable=params.get('table');
  if(queryTable)return queryTable;
  const match=location.pathname.match(/^\/table([1-9])\/?$/i);
  return match?match[1]:null;
}
var NASI_PRICE=5000;
var NASI_IDS=["beef_yakiniku","tongseng_sapi","ayam_kremes_lmg","ayam_kremes_ijo","ayam_geprek","ayam_bakar","lele_kremes_lmg","lele_kremes_ijo","nila_kremes_lmg","nila_kremes_ijo","soto_padang","udang_saus"];
