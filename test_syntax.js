
firebase.initializeApp({
  databaseURL: "https://mula-eatery-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const fbDb = firebase.database();

const fbAuth = firebase.auth();
fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let currentUser = null;
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

const DEMO_MODE = false;
const db = fbDb;

// ── Theme System ──────────────────────────────────────────────

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
    btn.textContent=document.documentElement.classList.contains('light-mode')?'🌙':'☀️';
    btn.addEventListener('click',()=>{
      const isLight=document.documentElement.classList.toggle('light-mode');
      localStorage.setItem(KEY,isLight?'light':'dark');
      btn.textContent=isLight?'🌙':'☀️';
    });
    right.insertBefore(btn,right.firstChild);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',addBtn):addBtn();
})();
// ─────────────────────────────────────────────────────────────
const demoWatchers=new Map();
let demoPollT=null,demoPollBusy=false;
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
const PASS="mula2024";
const TABLE_IDS=['1','2','3','4','5','6','7'];
const APP_URL=location.origin+location.pathname;
const NASI_PRICE=5000;
const NASI_IDS=["beef_yakiniku","tongseng_sapi","ayam_kremes_lmg","ayam_kremes_ijo","ayam_geprek","ayam_bakar","lele_kremes_lmg","lele_kremes_ijo","nila_kremes_lmg","nila_kremes_ijo","soto_padang","udang_saus"];
const DEF_FAVORITES=[
{id:"es_durian_mula",name:"Es Durian Mula",price:18000},
{id:"es_teler_mula",name:"Es Teler Mula",price:18000},
{id:"es_teler_durian_mula",name:"Es Teler Durian Mula",price:23000},
{id:"es_teler_durian_premium",name:"Es Teler Durian Premium",price:30000},
];
const DEF_DRINKS=[
{id:"kopi_susu_mula",name:"Kopi Susu Mula",price:22000},
{id:"kopi_milo_cream",name:"Kopi Milo Cream",price:25000},
{id:"americano",name:"Americano",price:18000},
{id:"sanger",name:"Sanger",price:18000},
{id:"matcha_latte",name:"Matcha Latte",price:22000},
{id:"matcha_strawberry",name:"Matcha Strawberry",price:25000},
{id:"mula_choco_dream",name:"Mula Choco Dream",price:20000},
{id:"yakult_lychee",name:"Yakult Lychee",price:18000},
{id:"melon_squash",name:"Melon Squash",price:15000},
{id:"lemon_squash",name:"Lemon Squash",price:15000},
{id:"es_jeruk_peras",name:"Es Jeruk Peras",price:15000},
{id:"iced_lemon_tea",name:"Iced Lemon Tea",price:10000},
{id:"iced_tea",name:"Iced Tea",price:8000},
{id:"air_mineral",name:"Air Mineral",price:5000},
];
const DEF_MAIN=[
{id:"beef_yakiniku",name:"Beef Yakiniku",price:30000},{id:"tongseng_sapi",name:"Tongseng Daging Sapi",price:35000},
{id:"ayam_kremes_lmg",name:"Ayam Kremes Lamongan",price:25000},{id:"ayam_kremes_ijo",name:"Ayam Kremes Ijo",price:25000},
{id:"ayam_geprek",name:"Ayam Geprek",price:25000},{id:"ayam_bakar",name:"Ayam Bakar Pedas Manis",price:28000},
{id:"lele_kremes_lmg",name:"Lele Kremes Lamongan",price:25000},{id:"lele_kremes_ijo",name:"Lele Kremes Ijo",price:25000},
{id:"nila_kremes_lmg",name:"Nila Kremes Lamongan",price:28000},{id:"nila_kremes_ijo",name:"Nila Kremes Ijo",price:28000},
{id:"soto_padang",name:"Soto Padang",price:30000},{id:"udang_daun_jeruk",name:"Udang Krispi Nasi Daun Jeruk",price:30000},
{id:"udang_saus",name:"Udang Krispi Saus Pedas Manis",price:30000},{id:"seblak_seafood",name:"Seblak Seafood",price:25000},
{id:"tumis_toge",name:"Tumis Toge",price:10000},{id:"nasi_goreng_telur",name:"Nasi Goreng Telur",price:22000},
{id:"nasi_goreng_ayam",name:"Nasi Goreng Ayam",price:25000},{id:"nasi_goreng_seafood",name:"Nasi Goreng Seafood",price:27000},
{id:"nasi_hijau_telur",name:"Nasi Goreng Hijau Telur",price:22000},{id:"nasi_hijau_ayam",name:"Nasi Goreng Hijau Ayam",price:25000},
{id:"nasi_hijau_seafood",name:"Nasi Goreng Hijau Seafood",price:27000},{id:"kwetiau_telur",name:"Kwetiau Goreng Telur",price:20000},
{id:"kwetiau_ayam",name:"Kwetiau Goreng Ayam",price:25000},{id:"kwetiau_seafood",name:"Kwetiau Goreng Seafood",price:27000},
{id:"bihun_telur",name:"Bihun Goreng Telur",price:20000},{id:"bihun_ayam",name:"Bihun Goreng Ayam",price:25000},
{id:"bihun_seafood",name:"Bihun Goreng Seafood",price:27000},{id:"mie_telur",name:"Mie Goreng Telur",price:20000},
{id:"mie_ayam",name:"Mie Goreng Ayam",price:25000},{id:"mie_seafood",name:"Mie Goreng Seafood",price:27000},
];
const DEF_DESSERT=[
{id:"risol",name:"Risol",price:15000},{id:"pergedel",name:"Pergedel Jagung",price:15000},
{id:"kentang",name:"Kentang Goreng",price:15000},{id:"bakwan",name:"Bakwan",price:15000},
{id:"sosis",name:"Sosis",price:15000},{id:"roti_nutella",name:"Roti Bakar Nutella Milo",price:20000},
{id:"roti_keju_eskrim",name:"Roti Bakar Keju Eskrim",price:22000},{id:"pisang_keju",name:"Pisang Bakar Keju",price:20000},
{id:"pisang_coklat",name:"Pisang Bakar Coklat",price:18000},{id:"pisang_coklat_keju",name:"Pisang Bakar Coklat Keju",price:23000},
{id:"pisang_gula",name:"Pisang Gula Aren",price:20000},{id:"tahu_sutra",name:"Tahu Sutra",price:15000},
];
const DEF_TAMBAHAN=[
{id:"sambal_lmg_extra",name:"Sambal Lamongan",price:5000},
{id:"sambal_ijo_extra",name:"Sambal Ijo",price:5000},
{id:"sambal_gpk_extra",name:"Sambal Geprek",price:5000},
];
const COMPS=[
{id:"beef_c",name:"Beef Yakiniku",s:[{id:"beef_yakiniku",q:1}]},
{id:"nasi_putih",name:"Nasi Putih",s:[{id:"beef_yakiniku",q:1},{id:"tongseng_sapi",q:1},{id:"ayam_kremes_lmg",q:1},{id:"ayam_kremes_ijo",q:1},{id:"ayam_geprek",q:1},{id:"ayam_bakar",q:1},{id:"lele_kremes_lmg",q:1},{id:"lele_kremes_ijo",q:1},{id:"nila_kremes_lmg",q:1},{id:"nila_kremes_ijo",q:1},{id:"soto_padang",q:1},{id:"udang_saus",q:1}]},
{id:"piring",name:"Piring",s:[{id:"beef_yakiniku",q:1},{id:"tongseng_sapi",q:1},{id:"ayam_kremes_lmg",q:1},{id:"ayam_kremes_ijo",q:1},{id:"ayam_geprek",q:1},{id:"ayam_bakar",q:1},{id:"lele_kremes_lmg",q:1},{id:"lele_kremes_ijo",q:1},{id:"nila_kremes_lmg",q:1},{id:"nila_kremes_ijo",q:1},{id:"soto_padang",q:1},{id:"udang_daun_jeruk",q:1},{id:"udang_saus",q:1},{id:"nasi_goreng_telur",q:1},{id:"nasi_goreng_ayam",q:1},{id:"nasi_goreng_seafood",q:1},{id:"nasi_hijau_telur",q:1},{id:"nasi_hijau_ayam",q:1},{id:"nasi_hijau_seafood",q:1},{id:"kwetiau_telur",q:1},{id:"kwetiau_ayam",q:1},{id:"kwetiau_seafood",q:1},{id:"bihun_telur",q:1},{id:"bihun_ayam",q:1},{id:"bihun_seafood",q:1},{id:"mie_telur",q:1},{id:"mie_ayam",q:1},{id:"mie_seafood",q:1}]},
{id:"tongseng_c",name:"Tongseng Daging Sapi",s:[{id:"tongseng_sapi",q:1}]},
{id:"ayam",name:"Ayam",s:[{id:"ayam_kremes_lmg",q:1},{id:"ayam_kremes_ijo",q:1},{id:"nasi_goreng_ayam",q:1},{id:"nasi_hijau_ayam",q:1},{id:"kwetiau_ayam",q:1},{id:"bihun_ayam",q:1},{id:"mie_ayam",q:1}]},
{id:"smbl_lmg",name:"Sambal Lamongan",s:[{id:"ayam_kremes_lmg",q:1},{id:"ayam_bakar",q:1},{id:"lele_kremes_lmg",q:1},{id:"nila_kremes_lmg",q:1},{id:"sambal_lmg_extra",q:1}]},
{id:"smbl_ijo",name:"Sambal Ijo",s:[{id:"ayam_kremes_ijo",q:1},{id:"lele_kremes_ijo",q:1},{id:"nila_kremes_ijo",q:1},{id:"sambal_ijo_extra",q:1}]},
{id:"ayam_gpk",name:"Ayam Geprek",s:[{id:"ayam_geprek",q:1}]},
{id:"smbl_gpk",name:"Sambal Geprek",s:[{id:"ayam_geprek",q:1},{id:"udang_daun_jeruk",q:1},{id:"sambal_gpk_extra",q:1}]},
{id:"ayam_bkr",name:"Ayam Bakar Pedas Manis",s:[{id:"ayam_bakar",q:1}]},
{id:"lele_c",name:"Lele Kremes",s:[{id:"lele_kremes_lmg",q:1},{id:"lele_kremes_ijo",q:1}]},
{id:"nila_c",name:"Nila Kremes",s:[{id:"nila_kremes_lmg",q:1},{id:"nila_kremes_ijo",q:1}]},
{id:"soto_c",name:"Soto Padang",s:[{id:"soto_padang",q:1}]},
{id:"udang_c",name:"Udang Krispi",s:[{id:"udang_daun_jeruk",q:1},{id:"udang_saus",q:1}]},
{id:"nasi_dj",name:"Nasi Daun Jeruk",s:[{id:"udang_daun_jeruk",q:1}]},
{id:"saus_pm",name:"Saus Pedas Manis",s:[{id:"udang_saus",q:1}]},
{id:"seblak_c",name:"Seblak Seafood",s:[{id:"seblak_seafood",q:1}]},
{id:"toge_c",name:"Tumis Toge",s:[{id:"tumis_toge",q:1}]},
{id:"nasi_grg",name:"Nasi Goreng",s:[{id:"nasi_goreng_telur",q:1},{id:"nasi_goreng_ayam",q:1},{id:"nasi_goreng_seafood",q:1}]},
{id:"telur",name:"Telur",s:[{id:"nasi_goreng_telur",q:1},{id:"nasi_hijau_telur",q:1}]},
{id:"seafood",name:"Seafood",s:[{id:"nasi_goreng_seafood",q:1},{id:"kwetiau_seafood",q:1},{id:"bihun_seafood",q:1},{id:"mie_seafood",q:1}]},
{id:"nasi_hij",name:"Nasi Goreng Hijau",s:[{id:"nasi_hijau_telur",q:1},{id:"nasi_hijau_ayam",q:1},{id:"nasi_hijau_seafood",q:1}]},
{id:"kwt_tlr",name:"Kwetiau Goreng Telur",s:[{id:"kwetiau_telur",q:1}]},
{id:"kwt_c",name:"Kwetiau Goreng",s:[{id:"kwetiau_ayam",q:1},{id:"kwetiau_seafood",q:1}]},
{id:"bhn_tlr",name:"Bihun Goreng Telur",s:[{id:"bihun_telur",q:1}]},
{id:"bhn_c",name:"Bihun Goreng",s:[{id:"bihun_ayam",q:1},{id:"bihun_seafood",q:1}]},
{id:"mie_tlr",name:"Mie Goreng Telur",s:[{id:"mie_telur",q:1}]},
{id:"mie_c",name:"Mie Goreng",s:[{id:"mie_ayam",q:1},{id:"mie_seafood",q:1}]},
{id:"terong",name:"Terong",s:[{id:"ayam_kremes_lmg",q:2},{id:"ayam_kremes_ijo",q:2},{id:"ayam_geprek",q:2},{id:"ayam_bakar",q:2},{id:"lele_kremes_lmg",q:2},{id:"lele_kremes_ijo",q:2},{id:"nila_kremes_lmg",q:2},{id:"nila_kremes_ijo",q:2}]},
{id:"tahu",name:"Tahu",s:[{id:"ayam_kremes_lmg",q:1},{id:"ayam_kremes_ijo",q:1},{id:"ayam_geprek",q:1},{id:"ayam_bakar",q:1},{id:"lele_kremes_lmg",q:1},{id:"lele_kremes_ijo",q:1},{id:"nila_kremes_lmg",q:1},{id:"nila_kremes_ijo",q:1}]},
{id:"tempe",name:"Tempe",s:[{id:"ayam_kremes_lmg",q:1},{id:"ayam_kremes_ijo",q:1},{id:"ayam_geprek",q:1},{id:"ayam_bakar",q:1},{id:"lele_kremes_lmg",q:1},{id:"lele_kremes_ijo",q:1},{id:"nila_kremes_lmg",q:1},{id:"nila_kremes_ijo",q:1}]},
];
let role=null,curDate=today(),orders={},stock={},receipts={},customMenu={},prices={},customMenuComps={},menuAvailability={},pendingNewRows=[],selFile=null,syncT=null,editPriceId=null;
let unsubOrders=null,unsubStock=null,unsubReceipts=null,unsubCustom=null,unsubPrices=null,unsubCustomComps=null,unsubMenuAvailability=null;
let curTable=null,tableOrders={},dailyOrders={},unsubTableOrder=null,unsubAllTables=null;
let customReady=false,pricesReady=false,renderScheduled=false;
const paymentAlertSeen=new Set();
function today(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function showToast(msg,dur=2400){let t=document.getElementById('cashierToast');if(!t){t=document.createElement('div');t.id='cashierToast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none';document.body.appendChild(t);}t.textContent=msg;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',dur);}
function fmtDate(d){const[y,m,day]=d.split('-');return`${day}/${m}`;}
function fmtDateFull(d){const[y,m,day]=d.split('-');const M=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${parseInt(day)} ${M[m-1]} ${y}`;}
function rp(n){return'Rp '+Math.round(n||0).toLocaleString('id');}
function setSync(s){document.getElementById('syncDot').className='sync-dot'+(s?' '+s:'');}
let isSyncingQueue=false;
async function syncOfflineQueue(){
  if(isSyncingQueue)return;
  const raw=localStorage.getItem('mula_offline_queue');
  if(!raw)return;
  let q=[];try{q=JSON.parse(raw);}catch(e){}
  if(!q.length)return;
  isSyncingQueue=true;
  setSync('orange');
  const remaining=[];
  for(const job of q){
    try{
      const s=await get(ref(db,`orders/${job.dateKey}/${job.finKey}`));
      if(!s.val()){
         await set(ref(db,`orders/${job.dateKey}/${job.finKey}`),job.fPayload);
         if(job.type==='kasir'){
           await set(ref(db,`tableOrders/${job.tid}`),job.tPayload);
         }else if(job.type==='guest_paid'){
           await update(ref(db,`tableOrders/${job.tid}`),{status:'paid',manualConfirmedAt:Date.now()});
         }
      }
    }catch(e){remaining.push(job);}
  }
  if(remaining.length===0){localStorage.removeItem('mula_offline_queue');setSync('green');}
  else{localStorage.setItem('mula_offline_queue',JSON.stringify(remaining));setSync('red');}
  isSyncingQueue=false;
}
setInterval(syncOfflineQueue, 10000);
function getSection(cat,def){return[...def,...Object.values(customMenu).filter(i=>i.cat===cat)].map(i=>({...i,price:prices[i.id]||i.price,outOfStock:!!menuAvailability[i.id]}));}
function getFav(){return getSection('favorites',DEF_FAVORITES);}
function getTambahan(){return getSection('tambahan',DEF_TAMBAHAN);}
function getDrinks(){return getSection('drinks',DEF_DRINKS);}
function getMain(){return getSection('main',DEF_MAIN);}
function getDessert(){return getSection('dessert',DEF_DESSERT);}
function getAll(){return[...getFav(),...getDrinks(),...getMain(),...getDessert(),...getTambahan()];}
function calcMenuPrice(item,data){return NASI_IDS.includes(item.id)&&data?.tanpaNasi?item.price-NASI_PRICE:item.price;}
function normalizeGuestItems(cart){const out=[];Object.entries(cart||{}).forEach(([id,data])=>{const qty=Math.max(0,parseInt(data?.qty||0));if(!qty)return;out.push({id,qty,note:String(data?.note||'').trim().slice(0,160),tanpaNasi:!!data?.tanpaNasi});});return out;}
document.getElementById('adminBtn').addEventListener('click',()=>{document.getElementById('pwModal').classList.add('show');setTimeout(()=>document.getElementById('pwInput').focus(),100);});
document.getElementById('karyawanBtn').addEventListener('click',()=>enterApp('karyawan'));
document.getElementById('pwSubmit').addEventListener('click',tryLogin);
document.getElementById('pwCancel').addEventListener('click',()=>{document.getElementById('pwModal').classList.remove('show');document.getElementById('pwErr').style.display='none';document.getElementById('pwInput').value='';});
document.getElementById('pwInput').addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin();});
document.getElementById('logoutBtn').addEventListener('click',()=>location.reload());
document.getElementById('dateInput').addEventListener('change',e=>{if(!e.target.value)return;curDate=e.target.value;document.getElementById('dateLabel').textContent=fmtDate(curDate);subOrders();if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();});
document.getElementById('closeRMBtn').addEventListener('click',()=>document.getElementById('receiptModal').classList.remove('show'));
document.getElementById('uploadArea').addEventListener('click',()=>document.getElementById('receiptInput').click());
document.getElementById('receiptInput').addEventListener('change',e=>previewReceipt(e.target));
document.getElementById('uploadBtn').addEventListener('click',submitReceipt);
document.getElementById('addItemBtn').addEventListener('click',addItemRow);
document.getElementById('piList').addEventListener('click',e=>{if(e.target.classList.contains('rm-btn')){const rows=document.querySelectorAll('.pi-row');if(rows.length>1)e.target.closest('.pi-row').remove();}});
document.getElementById('addStockBtn').addEventListener('click',addStock);
document.getElementById('stockList').addEventListener('click',e=>{
const id=e.target.dataset.id,a=e.target.dataset.action;if(!id||!a)return;
if(a==='plus')update(ref(db,`stock/${id}`),{jumlah:Math.max(0,(stock[id]?.jumlah||0)+1)});
if(a==='minus')update(ref(db,`stock/${id}`),{jumlah:Math.max(0,(stock[id]?.jumlah||0)-1)});
if(a==='del'&&confirm('Hapus bahan ini?'))remove(ref(db,`stock/${id}`));
});
document.getElementById('receiptsList').addEventListener('click',e=>{
if(e.target.classList.contains('r-del')||e.target.closest('.r-del')){const id=e.target.closest('[data-id]')?.dataset.id;if(id&&confirm('Hapus nota ini?'))remove(ref(db,`receipts/${id}`));return;}
const item=e.target.closest('.receipt-item');if(!item)return;
const id=item.dataset.id;
// Fetch full image on demand only when tapped
get(ref(db,`receipts/${id}`)).then(s=>{
const r=s.val();if(!r)return;
document.getElementById('modalImg').src=r.img||r.thumb||'';
document.getElementById('modalNote').textContent=r.note||'';
document.getElementById('modalDate').textContent=r.date?new Date(r.date).toLocaleString('id'):'';
document.getElementById('receiptModal').classList.add('show');
});
});
document.querySelectorAll('.tab-btn').forEach(btn=>{btn.addEventListener('click',()=>{
document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
btn.classList.add('active');
document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
if(btn.dataset.tab==='stock'&&!unsubStock){subStock();subReceipts();}
if(btn.dataset.tab==='keuangan'){if(!unsubReceipts)subReceipts();renderKeuangan();}
});});
document.getElementById('addMenuCancel').addEventListener('click',()=>document.getElementById('addMenuModal').classList.remove('show'));
document.getElementById('addRowBtn').addEventListener('click',()=>{const val=document.getElementById('newRowInput').value.trim();if(!val)return;if(!pendingNewRows.includes(val))pendingNewRows.push(val);document.getElementById('newRowInput').value='';const el=document.getElementById('newRowsList');el.innerHTML=pendingNewRows.map((r,i)=>`<div class="new-row-tag">${r}<button data-i="${i}">×</button></div>`).join('');el.querySelectorAll('button').forEach(btn=>{btn.addEventListener('click',()=>{pendingNewRows.splice(parseInt(btn.dataset.i),1);btn.closest('.new-row-tag').remove();});});});
document.getElementById('addMenuSave').addEventListener('click',saveMenu);
document.getElementById('editPriceCancel').addEventListener('click',()=>document.getElementById('editPriceModal').classList.remove('show'));
document.getElementById('editPriceSave').addEventListener('click',savePrice);


async function tryLogin() {
  const emailInp = document.getElementById('emailInput');
  const pwInp = document.getElementById('pwInput');
  const btn = document.getElementById('pwSubmit');
  const err = document.getElementById('pwErr');
  
  const email = emailInp.value.trim();
  const pw = pwInp.value;
  
  if(!pw) return;
  
  // If already logged in as Admin, just check local PIN
  if (currentUser && !currentUser.isAnonymous) {
    if (pw === '8888' || pw === 'MULA' || pw === 'mula') {
      document.getElementById('pwModal').classList.remove('show');
      pwInp.value = '';
      enterApp('admin');
    } else {
      err.textContent = 'PIN Salah!';
      err.style.display = 'block';
    }
    return;
  }
  
  // Otherwise, require Firebase Auth
  if(!email) return;
  
  btn.textContent = 'Memeriksa...';
  btn.disabled = true;
  err.style.display = 'none';
  
  try {
    await fbAuth.signInWithEmailAndPassword(email, pw);
    document.getElementById('pwModal').classList.remove('show');
    pwInp.value = '';
    enterApp('admin');
  } catch(e) {
    err.textContent = 'Gagal: ' + e.message;
    err.style.display = 'block';
  } finally {
    btn.textContent = 'Lanjut';
    btn.disabled = false;
  }
}


function enterApp(r){
role=r;
document.getElementById('lockScreen').style.display='none';
document.getElementById('app').style.display='block';
document.getElementById('roleBadge').textContent=r==='admin'?'Admin':'Karyawan';
document.getElementById('roleBadge').className='role-badge '+r;
document.getElementById('logoutBtn').style.display='block';
document.getElementById('printBtn').style.display='block';if(r==='admin'){document.getElementById('stockPanel').style.display='block';document.querySelectorAll('.admin-tab').forEach(el=>el.style.display='block');document.querySelectorAll('.admin-only').forEach(el=>el.style.display='flex');}
document.getElementById('dateInput').value=curDate;
document.getElementById('dateLabel').textContent=fmtDate(curDate);
subAll();
}
function scheduleRender(){if(renderScheduled)return;renderScheduled=true;requestAnimationFrame(()=>{renderScheduled=false;renderOrders();});}
function subAll(){
customReady=false;pricesReady=false;
if(unsubCustom)unsubCustom();if(unsubPrices)unsubPrices();
subOrders();
unsubCustom=onValue(ref(db,'customMenu'),s=>{customMenu=s.val()||{};customReady=true;if(pricesReady)scheduleRender();});
unsubPrices=onValue(ref(db,'priceOverrides'),s=>{prices=s.val()||{};pricesReady=true;if(customReady)scheduleRender();});
if(unsubCustomComps)unsubCustomComps();
unsubCustomComps=onValue(ref(db,'customMenuComps'),s=>{customMenuComps=s.val()||{};if(customReady&&pricesReady)scheduleRender();});
if(unsubMenuAvailability)unsubMenuAvailability();
unsubMenuAvailability=onValue(ref(db,'menuAvailability'),s=>{menuAvailability=s.val()||{};if(customReady&&pricesReady)scheduleRender();});
if(unsubAllTables)unsubAllTables();
unsubAllTables=onValue(ref(db,'tableOrders'),s=>{tableOrders=s.val()||{};renderPendingOrders();renderActiveTables();renderPendingPayments();notifyWaitingVerification();if(customReady&&pricesReady)scheduleRender();});
onValue(ref(db, '.info/connected'), (snap) => {
  if (snap.val() === true) { setSync('green'); syncOfflineQueue(); } else { setSync('red'); }
});
}
function subOrders(){if(unsubOrders)unsubOrders();unsubOrders=onValue(ref(db,`orders/${curDate}`),s=>{dailyOrders=s.val()||{};if(customReady&&pricesReady)scheduleRender();if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();});}
function subStock(){if(unsubStock)unsubStock();unsubStock=onValue(ref(db,'stock'),s=>{stock=s.val()||{};renderStock();});}
function subReceipts(){
if(unsubReceipts)unsubReceipts();
// Only fetch metadata + thumbnail — not full image
unsubReceipts=onValue(ref(db,'receipts'),s=>{
const raw=s.val()||{};
// Strip full img from memory — only keep thumb + metadata
receipts={};
Object.entries(raw).forEach(([id,r])=>{
receipts[id]={note:r.note,items:r.items,total:r.total,date:r.date,by:r.by,thumb:r.thumb||null,hasImg:!!r.img||!!r.thumb};
});
renderReceipts();
if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();
});
}
function calcTotal(){let tp=0;getAll().forEach(i=>{const q=orders[i.id]?.qty||0;const tn=!!(orders[i.id]?.tanpaNasi);const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;tp+=q*effP;});return tp;}
function saveOrders(){ /* Local cart now, pushed on Proses */ }
async function setItemOutOfStock(id,isOut){try{await set(ref(db,`menuAvailability/${id}`),!!isOut);}catch(e){alert('Gagal update status menu: '+e.message);}}
function renderOrders(){
const isAdmin=role==='admin';
document.getElementById('orderPanel').className='panel';
const sections=[
{label:'Mula Favorites',items:getFav(),cat:'favorites'},
{label:'Minuman',items:getDrinks(),cat:'drinks'},
{label:'Main Course',items:getMain(),cat:'main'},
{label:'Cemilan & Dessert',items:getDessert(),cat:'dessert'},
{label:'Tambahan',items:getTambahan(),cat:'tambahan'},
];
let h='';
sections.forEach(sec=>{
h+=`<div class="section-div"><span>— ${sec.label}</span>${isAdmin?`<button class="add-menu-btn" data-cat="${sec.cat}">+ Tambah</button>`:''}</div>`;
sec.items.forEach((i,idx)=>{h+=itemHTML(i,isAdmin,idx);});
});
document.getElementById('menuList').innerHTML=h;
if(isAdmin){
document.getElementById('menuList').querySelectorAll('.add-menu-btn').forEach(btn=>{
btn.addEventListener('click',()=>{document.getElementById('menuCat').value=btn.dataset.cat;openAddMenu();});
});
document.getElementById('menuList').querySelectorAll('.item-price.editable').forEach(el=>{
el.addEventListener('click',()=>{
editPriceId=el.dataset.id;
document.getElementById('editPriceName').textContent=el.dataset.name;
document.getElementById('editPriceVal').value=el.dataset.price;
document.getElementById('editPriceModal').classList.add('show');
setTimeout(()=>document.getElementById('editPriceVal').focus(),100);
});
});
document.getElementById('menuList').querySelectorAll('.del-menu-btn').forEach(btn=>{
btn.addEventListener('click',()=>{
if(!confirm('Hapus menu ini?'))return;
const key=Object.keys(customMenu).find(k=>customMenu[k].id===btn.dataset.id);
if(key){remove(ref(db,`customMenu/${key}`));remove(ref(db,`customMenuComps/${btn.dataset.id}`));}else alert('Menu default tidak bisa dihapus');
});
});
}
document.getElementById('menuList').querySelectorAll('.availability-btn').forEach(btn=>{
btn.addEventListener('click',async()=>{
if(!role)return;
btn.disabled=true;
await setItemOutOfStock(btn.dataset.id,btn.dataset.next==='1');
btn.disabled=false;
});
});
document.getElementById('menuList').querySelectorAll('.qty-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
if(!role)return;
const id=btn.dataset.id,d=parseInt(btn.dataset.d);
if(getAll().find(x=>x.id===id)?.outOfStock)return;
if(!orders[id])orders[id]={qty:0,note:''};
orders[id].qty=Math.max(0,(orders[id].qty||0)+d);
const el=document.getElementById('q_'+id);
if(el){
el.textContent=orders[id].qty;
el.className='qty-display'+(orders[id].qty>0?' active':'');
el.classList.add('bump');
setTimeout(()=>el.classList.remove('bump'),200);
}
renderOrderSummary();
updTotals();saveOrders();
});
});
document.getElementById('menuList').querySelectorAll('.tanpa-nasi-btn').forEach(btn=>{
btn.addEventListener('click',()=>{
if(!role)return;
const id=btn.dataset.id;
if(!orders[id])orders[id]={qty:0,note:'',tanpaNasi:false};
orders[id].tanpaNasi=!orders[id].tanpaNasi;
saveOrders();
renderOrders();
});
});
document.getElementById('menuList').querySelectorAll('.note-input').forEach(inp=>{
inp.addEventListener('change',()=>{
if(!role)return;
if(!orders[inp.dataset.id])orders[inp.dataset.id]={qty:0,note:''};
orders[inp.dataset.id].note=inp.value;saveOrders();
});
});
renderOrderSummary();
updTotals();
}
function itemHTML(item,isAdmin,idx){
const o=orders[item.id]||{qty:0,note:'',tanpaNasi:false};
const isNasi=NASI_IDS.includes(item.id);
const tn=!!(o.tanpaNasi);
const out=!!item.outOfStock;
const effPrice=isNasi&&tn?item.price-NASI_PRICE:item.price;
const isCustom=!!Object.values(customMenu).find(cm=>cm.id===item.id);
const delay=`animation-delay:${idx*0.03}s`;
const nasiBtn=role&&isNasi?`<button class="tanpa-nasi-btn${tn?' active':''}" data-id="${item.id}" data-action="tanpanasi">${tn?'✓ Tanpa Nasi':'− Nasi'}</button>`:'';
const priceStr=isNasi&&tn?`<span style="text-decoration:line-through;opacity:0.4;font-size:11px">${rp(item.price)}</span> ${rp(effPrice)}${isAdmin?' ✏':''}`:rp(effPrice)+(isAdmin?' ✏':'');
const stockBtn=role?`<button class="availability-btn${out?' active':''}" data-id="${item.id}" data-next="${out?0:1}" style="border:none;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;background:${out?'#8f2f2f':'rgba(241,212,138,0.12)'};color:${out?'#fff':'var(--gold)'}">${out?'Tersedia':'Tandai Habis'}</button>`:'';
const controls=role
? `<div class="item-controls"><button class="qty-btn minus" data-id="${item.id}" data-d="-1">−</button><div class="qty-display ${o.qty>0?'active':''}" id="q_${item.id}">${o.qty}</div><button class="qty-btn plus" data-id="${item.id}" data-d="1">+</button>
${isAdmin&&isCustom?`<button class="del-menu-btn" data-id="${item.id}">×</button>`:''}
</div>`
: o.qty>0?`<div class="qty-display active" style="border-radius:8px">${o.qty}</div>`:'';
return`<div class="menu-item${out?' readonly':''}" style="${delay}${out?';opacity:0.72':''}"><div class="item-price-wrap"><div><div class="item-name">${esc(item.name)}${out?` <span style="font-size:10px;color:#ff8e8e;font-family:Outfit,sans-serif;letter-spacing:1px">HABIS</span>`:''}</div><div class="item-price${isAdmin?' editable':''}" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">${priceStr}
</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">${stockBtn}${nasiBtn}</div></div>
${controls}
${role?`<div class="item-note"><input class="note-input" type="text" data-id="${item.id}" placeholder="Catatan..." value="${(o.note||'').replace(/"/g,'&quot;')}"></div>`:''}
</div>`;
}
function getCookOrders(){const agg={};Object.entries(tableOrders).forEach(([tid,t])=>{if(t.status!=='active')return;Object.entries(t.items||{}).forEach(([id,data])=>{if(!agg[id])agg[id]={qty:0,tanpaNasi:false};agg[id].qty+=(data.qty||0);if(data.tanpaNasi)agg[id].tanpaNasi=true;});});Object.entries(orders).forEach(([id,data])=>{if(!agg[id])agg[id]={qty:0,tanpaNasi:false};agg[id].qty+=(data.qty||0);if(data.tanpaNasi)agg[id].tanpaNasi=true;});return agg;}
function getDailyOrderSummary(){const all=getAll(),agg={};function add(id,data){const qty=Math.max(0,parseInt(data?.qty||0));if(!qty)return;const m=all.find(x=>x.id===id),price=m?calcMenuPrice(m,data):0;if(!agg[id])agg[id]={id,name:m?.name||id,qty:0,total:0};agg[id].qty+=qty;agg[id].total+=qty*price;}Object.entries(dailyOrders||{}).forEach(([txId,tx])=>{if(!tx)return;if(tx.qty!==undefined){add(txId,tx);return;}Object.entries(tx.items||{}).forEach(([id,data])=>add(id,data));});return Object.values(agg).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name));}
function renderOrderSummary(){const el=document.getElementById('cookList');if(!el)return;const rows=getDailyOrderSummary();if(!rows.length){el.innerHTML='<div class="empty-msg">Belum ada order hari ini</div>';return;}el.innerHTML=rows.map(r=>`<div class="cook-item"><span class="cook-name">${esc(r.name)}<span style="display:block;font-family:Outfit,sans-serif;font-size:11px;color:var(--muted2);font-weight:500;margin-top:3px">${rp(r.total)}</span></span><span class="cook-qty active">${r.qty}</span></div>`).join('');}
function calcC(c){const co=getCookOrders();let t=c.s.reduce((s,x)=>{const qty=co[x.id]?.qty||0;const skip=c.id==='nasi_putih'&&!!(co[x.id]?.tanpaNasi);return s+(skip?0:qty)*x.q;},0);Object.entries(customMenuComps).forEach(([mid,mc])=>{if(mc.contribs&&mc.contribs.includes(c.id))t+=co[mid]?.qty||0;});return t;}
function getCustomRows(){const rows={};Object.entries(customMenuComps).forEach(([mid,mc])=>{(mc.newRows||[]).forEach(n=>{if(!rows[n])rows[n]={name:n,menuIds:[]};rows[n].menuIds.push(mid);});});return Object.values(rows);}
function safeId(n){return n.replace(/[^a-zA-Z0-9]/g,'_');}
function updTotals(){
let tq=0,tp=0;
getAll().forEach(i=>{const q=orders[i.id]?.qty||0;const tn=!!(orders[i.id]?.tanpaNasi);const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;tq+=q;tp+=q*effP;});
document.getElementById('totalQty').textContent=tq;
document.getElementById('totalPrice').textContent=rp(tp);
const btn=document.getElementById('prosesManualBtn');if(btn)btn.disabled=tq<=0;
}
function openAddMenu(){document.getElementById('menuName').value='';document.getElementById('menuPrice').value='';document.getElementById('menuErr').style.display='none';pendingNewRows=[];document.getElementById('newRowsList').innerHTML='';document.getElementById('newRowInput').value='';document.getElementById('compChecklist').innerHTML=COMPS.map(comp=>`<label><input type="checkbox" value="${comp.id}"> ${comp.name}</label>`).join('');document.getElementById('addMenuModal').classList.add('show');setTimeout(()=>document.getElementById('menuName').focus(),100);}
function saveMenu(){const name=document.getElementById('menuName').value.trim(),price=parseInt(document.getElementById('menuPrice').value),cat=document.getElementById('menuCat').value;if(!name||!price){document.getElementById('menuErr').style.display='block';return;}const mid='cust_'+Date.now();const contribs=[...document.getElementById('compChecklist').querySelectorAll('input:checked')].map(el=>el.value);if(contribs.length||pendingNewRows.length){set(ref(db,'customMenuComps/'+mid),{contribs,newRows:[...pendingNewRows]});}push(ref(db,'customMenu'),{id:mid,name,price,cat});document.getElementById('addMenuModal').classList.remove('show');}
function savePrice(){const p=parseInt(document.getElementById('editPriceVal').value);if(!p||!editPriceId)return;update(ref(db,'priceOverrides'),{[editPriceId]:p});document.getElementById('editPriceModal').classList.remove('show');}
function renderStock(){
const el=document.getElementById('stockList');if(!el)return;
const entries=Object.entries(stock);
if(!entries.length){el.innerHTML='<div class="empty-msg">Belum ada bahan</div>';return;}
el.innerHTML=entries.map(([id,it])=>`
<div class="stock-item"><div><div class="stock-name">${esc(it.name)}</div><div class="stock-meta">${it.jumlah||0} ${esc(it.satuan||'')}</div></div><div class="stock-num ${(it.jumlah||0)<=2?'low':'ok'}">${it.jumlah||0}<span style="font-size:11px;font-family:'Outfit';margin-left:4px;opacity:0.7">${it.satuan||''}</span></div><div class="s-controls"><button class="s-btn" data-id="${id}" data-action="minus">−</button><button class="s-btn" data-id="${id}" data-action="plus">+</button></div><button class="s-btn s-del" data-id="${id}" data-action="del">🗑</button></div>`).join('');
}
function addStock(){const n=document.getElementById('newName').value.trim(),q=parseInt(document.getElementById('newJumlah').value)||0,s=document.getElementById('newSatuan').value.trim();if(!n)return;push(ref(db,'stock'),{name:n,jumlah:q,satuan:s});['newName','newJumlah','newSatuan'].forEach(id=>document.getElementById(id).value='');}
function previewReceipt(inp){selFile=inp.files[0];if(!selFile)return;const r=new FileReader();r.onload=e=>{document.getElementById('previewImg').src=e.target.result;document.getElementById('previewWrap').style.display='block';document.getElementById('uploadArea').style.display='none';document.getElementById('uploadBtn').disabled=false;};r.readAsDataURL(selFile);}
function addItemRow(){const row=document.createElement('div');row.className='pi-row';row.innerHTML=`<input type="text" class="pi-name" placeholder="Nama barang..."><input type="text" class="pi-price" placeholder="Harga (Rp)"><button class="rm-btn">×</button>`;document.getElementById('piList').appendChild(row);}
function compress(file,maxW,q){return new Promise(res=>{const img=new Image(),r=new FileReader();r.onload=e=>{img.onload=()=>{const sc=Math.min(1,maxW/img.width),w=img.width*sc,h=img.height*sc,c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);res(c.toDataURL('image/jpeg',q));};img.src=e.target.result;};r.readAsDataURL(file);});}
async function submitReceipt(){if(!selFile)return;const btn=document.getElementById('uploadBtn');btn.disabled=true;btn.textContent='Menyimpan...';try{const note=document.getElementById('receiptNote').value||'Nota';const items=[];document.querySelectorAll('.pi-row').forEach(row=>{const n=row.querySelector('.pi-name').value.trim(),p=row.querySelector('.pi-price').value.trim();if(n)items.push({name:n,price:p});});const total=items.reduce((s,i)=>s+parseInt((i.price||'').replace(/\D/g,'')||0),0);const thumb=await compress(selFile,150,0.4);const img=await compress(selFile,600,0.5);await push(ref(db,'receipts'),{img,thumb,note,items,total,date:new Date().toISOString(),by:role});document.getElementById('receiptNote').value='';document.getElementById('previewImg').src='';document.getElementById('previewWrap').style.display='none';document.getElementById('uploadArea').style.display='block';document.getElementById('receiptInput').value='';document.querySelectorAll('.pi-row').forEach((r,i)=>{if(i>0)r.remove();else{r.querySelector('.pi-name').value='';r.querySelector('.pi-price').value='';}});selFile=null;btn.textContent='Simpan Nota';btn.disabled=false;}catch(e){alert('Gagal: '+e.message);btn.textContent='Simpan Nota';btn.disabled=false;}}
function renderReceipts(){const el=document.getElementById('receiptsList');const entries=Object.entries(receipts).sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||''));if(!entries.length){el.innerHTML='<div class="empty-msg">Belum ada nota</div>';return;}el.innerHTML=entries.map(([id,r])=>{const chips=r.items?.length?`<div class="r-chips">${r.items.map(i=>`<span class="r-chip">${esc(i.name)}${i.price?' · Rp'+esc(i.price):''}</span>`).join('')}</div>`:'';const del=role==='admin'?`<button class="r-del" data-id="${id}">🗑</button>`:'';const thumbSrc=r.thumb||r.img||'';return`<div class="receipt-item" data-id="${id}"><img class="r-thumb" src="${thumbSrc}" alt="" loading="lazy"><div style="flex:1;min-width:0"><div class="r-note">${esc(r.note||'')}</div>${chips}<div class="r-date">${r.date?new Date(r.date).toLocaleString('id'):''} · ${esc(r.by||'')}</div></div>${del}</div>`;}).join('');}
function renderKeuangan(){
const all=getAll();let pemasukan=0;const orderRows=[];
Object.entries(dailyOrders).forEach(([txId,tx])=>{
  if(tx.qty!==undefined){
    const m=all.find(x=>x.id===txId);if(!m)return;
    const tn=!!(tx.tanpaNasi);const effP=NASI_IDS.includes(m.id)&&tn?m.price-NASI_PRICE:m.price;
    const sub=tx.qty*effP;pemasukan+=sub;
    orderRows.push({id:txId,time:0,tableLabel:'Migrated Item',total:sub,itemStr:`${m.name}${tn?' (tnp nasi)':''} x${tx.qty}`,isLegacy:true});
    return;
  }
  pemasukan+=(tx.total||0);
  const itemStrs=[];
  Object.entries(tx.items||{}).forEach(([iid,idata])=>{
    const m=all.find(x=>x.id===iid);
    if(m)itemStrs.push(`${m.name}${idata.tanpaNasi?' (tnp nasi)':''} x${idata.qty}`);
  });
  orderRows.push({id:txId,time:tx.time||0,tableLabel:tx.tableLabel||'Transaksi',total:tx.total||0,itemStr:itemStrs.join(', ')});
});
orderRows.sort((a,b)=>b.time-a.time);

let pengeluaran=0;const notaRows=[];
Object.entries(receipts).forEach(([rid,r])=>{
  if(r.date?.slice(0,10)===curDate){
    const itemsArr = Array.isArray(r.items) ? r.items : (r.items ? Object.values(r.items) : []);
    const t=r.total||itemsArr.reduce((s,i)=>s+parseInt((i.price||'').replace(/\D/g,'')||0),0)||0;
    pengeluaran+=t;
    notaRows.push({note:r.note||'Nota',t});
  }
});

const profit=pemasukan-pengeluaran;
document.getElementById('keuIn').textContent=rp(pemasukan);
document.getElementById('keuOut').textContent=rp(pengeluaran);
const pe=document.getElementById('keuProfit');pe.textContent=rp(profit);pe.className='keu-val '+(profit>=0?'gold':'red');
document.getElementById('keuCount').textContent=orderRows.length+' transaksi';

const od=document.getElementById('keuOrders');
if(orderRows.length){
  od.innerHTML=orderRows.map(o=>{
    const isTakeaway=o.tableLabel&&(o.tableLabel.toLowerCase().includes('takeaway')||o.tableLabel.toLowerCase().includes('kasir'));
    const typeBadge=isTakeaway
      ?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--surface3);color:var(--muted2);border:1px solid var(--border2);letter-spacing:0.5px">Takeaway</span>`
      :`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(212,168,83,0.12);color:var(--gold);border:1px solid var(--gold-dim);letter-spacing:0.5px">Dine-in</span>`;
    const PM_COLORS={Tunai:'#5fa97c',QRIS:'#6ab0f5',Dana:'#2b6cb0',GoPay:'#276749',Transfer:'#9f7aea'};
    const pm=o.paymentMethod||'';
    const pmBadge=pm?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${PM_COLORS[pm]||'#555'}22;color:${PM_COLORS[pm]||'#aaa'};border:1px solid ${PM_COLORS[pm]||'#555'}55;letter-spacing:0.5px">${pm}</span>`:'';
    return`<div class="keu-row" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          ${typeBadge}
          ${pmBadge}
          <span style="font-weight:700;color:var(--text);font-size:13px">${esc(o.tableLabel)}</span>
          ${o.time?`<span style="font-size:10px;color:var(--muted)">${new Date(o.time).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'})}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${role==='admin'?`<button class="edit-pm-btn" data-id="${o.id}" data-pm="${pm}" title="Ubah metode bayar" style="background:none;border:1px solid var(--border2);color:var(--muted2);cursor:pointer;font-size:11px;padding:2px 8px;border-radius:12px;font-family:Outfit,sans-serif">✎ ${pm||'?'}</button>`:''}
          <span class="keu-row-val" style="font-size:14px;color:var(--green)">${rp(o.total)}</span>
          
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted2);line-height:1.4">${esc(o.itemStr)}</div>
    </div>`;
  }).join('')+`<div class="keu-row keu-footer" style="padding:16px 12px;margin-top:8px"><span>Total Pemasukan</span><span class="keu-row-val" style="color:var(--green)">${rp(pemasukan)}</span></div>`;
  
  if(role==='admin'){
    const METHODS=['Tunai','QRIS','Dana','GoPay','Transfer',''];
    od.querySelectorAll('.edit-pm-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const cur=btn.dataset.pm||'';
        const idx=METHODS.indexOf(cur);
        const next=METHODS[(idx+1)%METHODS.length];
        update(ref(db,`orders/${curDate}/${btn.dataset.id}`),{paymentMethod:next||null}).catch(()=>{});
      });
    });
    od.querySelectorAll('.del-tx-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(confirm('Hapus transaksi order ini secara permanen? Total keuangan akan berkurang secara otomatis.')){
          remove(ref(db,`orders/${curDate}/${btn.dataset.id}`));
        }
      });
    });
  }
} else {
  od.innerHTML='<div class="empty-msg">Belum ada order hari ini</div>';
}

const nd=document.getElementById('keuNotas');
nd.innerHTML=notaRows.length?notaRows.map(n=>`<div class="keu-row"><span>${esc(n.note)}</span><span class="keu-row-val" style="color:var(--red)">${rp(n.t)}</span></div>`).join('')+`<div class="keu-row keu-footer"><span>Total</span><span class="keu-row-val" style="color:var(--red)">${rp(pengeluaran)}</span></div>`:'<div class="empty-msg">Belum ada nota hari ini</div>';
}
function renderPendingOrders(){
  const panel=document.getElementById('pendingOrdersPanel');if(!panel)return;
  if(role!=='admin'){panel.innerHTML='';return;}
  const pending=Object.entries(tableOrders).filter(([,t])=>t.status==='waiting_confirmation');
  if(!pending.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#001a1a,#000c0c);border-color:#206a6a"><div class="pending-ph" style="border-bottom-color:#003a3a"><span class="pending-ph-title" style="color:#20c8c8">🔔 Pesanan Baru Masuk</span><span class="pending-badge" style="background:rgba(32,200,200,0.2);color:#20c8c8;border-color:#10a0a0">${pending.length}</span></div>${pending.map(([tid,t])=>{
    const itemSummary=Object.entries(t.items||{}).map(([id,data])=>{
      const menu=getAll().find(m=>m.id===id);
      return `${esc(menu?.name||id)} x${data.qty}`;
    }).join(', ');
    return `<div class="pending-row" style="border-bottom-color:rgba(0,50,50,0.8)"><div style="flex:1"><div class="pending-tname">${esc(t.tableLabel||'Meja '+tid)}</div><div style="font-size:11px;color:#20a0a0;margin-top:2px">${itemSummary}</div></div><button class="konfirm-order-btn" data-tid="${tid}" style="background:linear-gradient(135deg,#20a0a0,#106060);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:Outfit,sans-serif">Terima Pesanan</button></div>`;
  }).join('')}</div></div>`;
  panel.querySelectorAll('.konfirm-order-btn').forEach(btn=>{btn.addEventListener('click',()=>konfirmasiPesanan(btn.dataset.tid));});
}
async function konfirmasiPesanan(tableId){
  try{await update(ref(db,`tableOrders/${tableId}`),{status:'active'});showToast('Pesanan meja '+tableId+' diterima');}catch(e){alert('Gagal: '+e.message);}
}
function renderActiveTables(){
  const panel=document.getElementById('activeTablesPanel');if(!panel)return;
  if(!role){panel.innerHTML='';return;}
  const active=Object.entries(tableOrders).filter(([,t])=>t.status==='active');
  if(!active.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#1a1a1a,#111);border-color:#333"><div class="pending-ph" style="border-bottom-color:#222"><span class="pending-ph-title" style="color:var(--gold)">🍽 Meja Aktif</span><span class="pending-badge" style="background:rgba(212,168,83,0.1);color:var(--gold);border-color:var(--gold-dim)">${active.length}</span></div>${active.map(([tid,t])=>{
    const itemSummary=Object.entries(t.items||{}).map(([id,data])=>{
      const menu=getAll().find(m=>m.id===id);
      return `${esc(menu?.name||id)} x${data.qty}`;
    }).join(', ');
    return `<div class="pending-row" style="border-bottom-color:rgba(42,42,42,0.6)"><div style="flex:1"><div class="pending-tname">${esc(t.tableLabel||'Meja '+tid)}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">${itemSummary}</div></div><div class="pending-ttotal" style="font-size:15px">${rp(t.total||0)}</div><div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0;flex-wrap:wrap">${role==='admin'?`<button class="cancel-order-btn" data-tid="${tid}" style="background:none;color:var(--red);border:1px solid #4a2020;padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">✕ Batal</button>`:''}<button class="print-lagi-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">🖨 Print Lagi</button><button class="force-selesai-btn" data-tid="${tid}" style="background:var(--gold);color:#000;border:none;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">✓ Selesai</button></div></div>`;
  }).join('')}</div></div>`;
  panel.querySelectorAll('.cancel-order-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('Batalkan pesanan ini? Pesanan akan dihapus dan tidak masuk ke keuangan.'))return;
      const t=tableOrders[btn.dataset.tid];
      if(t?.financeKey)remove(ref(db,`orders/${t.dateKey||today()}/${t.financeKey}`));
      remove(ref(db,`tableOrders/${btn.dataset.tid}`));
    });
  });
  panel.querySelectorAll('.print-lagi-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const t=tableOrders[btn.dataset.tid];if(!t)return;
      btn.textContent='🖨 Printing...';
      try{await autoPrint(t.items||{},t.total||0,t.tableLabel||'Kasir',t.cashGiven||0,t.change||0, t.paymentMethod||'');}catch(e){alert('Print gagal: '+e.message);}
      btn.textContent='🖨 Print Lagi';
    });
  });
  panel.querySelectorAll('.force-selesai-btn').forEach(btn=>{btn.addEventListener('click',()=>{if(confirm('Selesaikan pesanan ini?'))remove(ref(db,`tableOrders/${btn.dataset.tid}`));});});
}

// ========== QRIS PAYMENT FLOW ==========
function renderPendingPayments(){
  const panel=document.getElementById('pendingPaymentsPanel');if(!panel)return;
  if(!role){panel.innerHTML='';return;}
  const entries=Object.entries(tableOrders).filter(([,t])=>['waiting_verification','paid'].includes(t.status)).sort((a,b)=>(b[1]?.claimedPaidAt||b[1]?.createdAt||0)-(a[1]?.claimedPaidAt||a[1]?.createdAt||0));
  if(!entries.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap"><div class="pending-card"><div class="pending-ph"><span class="pending-ph-title">💳 Verifikasi Pembayaran</span><span class="pending-badge">${entries.filter(([,t])=>t.status==='waiting_verification').length}</span></div>${entries.map(([tid,t])=>{const state=t.status==='paid'?'Sudah dikonfirmasi':'Tamu mengaku sudah bayar';const stateColor=t.status==='paid'?'#5fa97c':'var(--gold)';const action=t.status==='waiting_verification'?`<button class="konfirm-btn" data-tid="${tid}">✅ Konfirmasi Bayar</button>`:`<button class="clear-btn" data-tid="${tid}" style="background:none;border:1px solid #5fa97c;color:#5fa97c;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:'Outfit',sans-serif;transition:all 0.2s;flex-shrink:0">Selesai</button>`;const claimed=t.claimedPaidAt?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${new Date(t.claimedPaidAt).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'})}</div>`:'';return`<div class="pending-row"><div style="flex:1"><div class="pending-tname">${esc(t.tableLabel||'Meja '+tid)}</div>${claimed}<div style="font-size:11px;color:${stateColor};margin-top:3px">${state}</div></div><span class="pending-ttotal">${rp(t.total||0)}</span>${action}</div>`;}).join('')}</div></div>`;
  panel.querySelectorAll('.konfirm-btn').forEach(btn=>{btn.addEventListener('click',()=>{if(confirm('Konfirmasi pembayaran meja ini sudah benar-benar masuk?'))konfirmasiBayar(btn.dataset.tid);});});
  panel.querySelectorAll('.clear-btn').forEach(btn=>{btn.addEventListener('click',()=>remove(ref(db,`tableOrders/${btn.dataset.tid}`)));});
}
async function konfirmasiBayar(tableId){
  const tOrder=tableOrders[tableId];if(!tOrder)return;
  const items=tOrder.items||{};const total=tOrder.total||0;const tableLabel=tOrder.tableLabel||`Meja ${tableId}`;
  const paidAt=Date.now();
  const dateKey=tOrder.dateKey||today();
  
  const finRef=push(ref(db,`orders/${dateKey}`));
  const finKey=finRef.key||finRef.path?.split('/').pop();
  const fPayload={time:Date.now(),tableLabel:tableLabel||'Kasir',total:total||0,items:items||{},paymentMethod:'QRIS'};
  
  update(ref(db,`tableOrders/${tableId}`),{status:'paid',paidAt,mergedAt:paidAt,manualConfirmedAt:paidAt}).catch(()=>{});
  set(finRef, fPayload).catch(()=>{});
  
  const q=JSON.parse(localStorage.getItem('mula_offline_queue')||'[]');
  q.push({type:'guest_paid',finKey,dateKey,tid:tableId,fPayload});
  localStorage.setItem('mula_offline_queue',JSON.stringify(q));
  
  try{await autoPrint(items,total,tableLabel);}catch(e){console.error('Print failed:',e);}
  update(ref(db,`tableOrders/${tableId}`),{printedAt:Date.now()}).catch(()=>{});
  setTimeout(()=>{remove(ref(db,`tableOrders/${tableId}`));},6000);
}
async function mergeItemsIntoDaily(dateKey,items,total,tableLabel){
  // Legacy function kept for compatibility if needed elsewhere
  const payload={time:Date.now(),tableLabel:tableLabel||'Kasir',total:total||0,items:items||{}};
  await push(ref(db,`orders/${dateKey}`),payload);
}
function notifyWaitingVerification(){const waiting=Object.entries(tableOrders).filter(([,t])=>t.status==='waiting_verification');document.title=waiting.length?`MULA (${waiting.length} bayar)`:('MULA Eatery');waiting.forEach(([tid,t])=>{const key=`${tid}:${t.claimedPaidAt||t.createdAt||0}`;if(paymentAlertSeen.has(key))return;paymentAlertSeen.add(key);try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=880;gain.gain.setValueAtTime(0.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.12,ctx.currentTime+0.01);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.28);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.3);}catch(e){};});}
function nativePrinterOnly(){try{return !!window.MulaPrinter?.nativeOnlyMode?.();}catch(e){return false;}}
function nativePrinterError(){try{return window.MulaPrinter?.lastError?.()||'Printer native gagal';}catch(e){return 'Printer native gagal';}}
async function autoPrint(items,total,tableLabel,cashGiven,change){
  const all=getAll();
  const orderItems=all.filter(i=>(items[i.id]?.qty||0)>0);
  if(!orderItems.length)return;
  const printItems=orderItems.map(i=>{const q=items[i.id].qty;const tn=!!(items[i.id]?.tanpaNasi);const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;return{name:i.name+(tn?' (tnp nasi)':''),qty:q,price:rp(q*effP),note:items[i.id]?.note||''};});
  const now=new Date();
  const tStr=now.toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'});
  const dStr=fmtDateFull(today());
  // Try native Android bridge first (MulaPrinter in WebView app)
  if(window.MulaPrinter?.printBase64){
    try{
      const data=await buildReceipt(printItems,total,dStr,tStr,tableLabel,cashGiven,change);
      const ok=await window.MulaPrinter.printBase64(bytesToBase64(data));
      if(ok!==false)return;
    }catch(e){console.warn('MulaPrinter failed',e);}
  }
  // Fallback: window.print() (works in browser, not in WebView)
  fallbackPrint(printItems,total,dStr,tStr,tableLabel,cashGiven,change);
}
function fallbackPrint(items,total,dStr,tStr,tableLabel,cashGiven,change){
  let rows='';
  items.forEach((i,idx)=>{
    const isLast=idx===items.length-1;
    rows+=`<div style="padding:2mm 0;${isLast?'':'border-bottom:1px dashed #ccc;'}">`;
    rows+=`<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px"><span style="flex:1;font-size:9pt;font-weight:bold">${i.name}</span><span style="font-size:9pt;white-space:nowrap">x${i.qty}</span><span style="font-size:9pt;white-space:nowrap;margin-left:8px">${i.price}</span></div>`;
    if(i.note)rows+=`<div style="font-size:8pt;color:#555;padding-left:4px">* ${i.note}</div>`;
    rows+='</div>';
  });
  let cashStr='';
  if(cashGiven){
    cashStr=`<hr class="rp-divider"><div class="rp-total" style="font-size:10pt"><span>Uang Tunai</span><span>${rp(cashGiven)}</span></div><div class="rp-total" style="font-size:10pt"><span>Kembali</span><span>${rp(change)}</span></div>`;
  }
  document.getElementById('printArea').innerHTML=`<div class="receipt-print"><div class="rp-center"><div class="rp-logo">MULA</div><div class="rp-sub">Eatery</div>${tableLabel?`<div class="rp-sub">${tableLabel}</div>`:''}<div class="rp-sub">${dStr} · ${tStr}</div></div><hr class="rp-divider">${rows}<hr class="rp-divider"><div class="rp-total"><span>TOTAL</span><span>${rp(total)}</span></div>${cashStr}<hr class="rp-divider"><div class="rp-center rp-sub" style="margin-top:2mm">Terima kasih!</div></div>`;
  setTimeout(()=>window.print(),100);
}
function openQrModal(){
  if(typeof QRCode==='undefined'){alert('QR library belum siap, coba lagi');return;}
  document.getElementById('qrModal').classList.add('show');
  const grid=document.getElementById('qrGrid');grid.innerHTML='';
  TABLE_IDS.forEach(id=>{
    const div=document.createElement('div');div.className='qr-item';
    const qrHolder=document.createElement('div');qrHolder.style.display='flex';qrHolder.style.justifyContent='center';
    const label=document.createElement('div');label.className='qr-label';label.textContent=`Meja ${id}`;
    div.appendChild(qrHolder);div.appendChild(label);grid.appendChild(div);
    const url=`${APP_URL}?table=${id}`;
    try{new QRCode(qrHolder,{text:url,width:90,height:90,correctLevel:QRCode.CorrectLevel.M});}catch(e){qrHolder.textContent='Error';}
    div.addEventListener('click',()=>{
      const img=qrHolder.querySelector('img')||qrHolder.querySelector('canvas');
      const src=img?.src||(img?.toDataURL?img.toDataURL():'');
      if(!src){alert('QR belum siap');return;}
      document.getElementById('printArea').innerHTML=`<div style="text-align:center;padding:10mm;font-family:'Outfit',sans-serif;color:#000"><div style="font-size:22pt;font-weight:bold;letter-spacing:6px">MULA</div><div style="font-size:9pt;letter-spacing:3px;margin-bottom:4mm;color:#555">EATERY</div><div style="font-size:14pt;font-weight:bold;margin-bottom:4mm">Meja ${id}</div><img src="${src}" style="width:60mm;height:60mm"><div style="font-size:9pt;margin-top:4mm">Scan untuk lihat pesanan &amp; bayar</div><div style="font-size:7pt;color:#888;margin-top:2mm;word-break:break-all">${url}</div></div>`;
      setTimeout(()=>window.print(),100);
    });
  });
}
// ESC/POS helpers
function escCmd(...bytes){return new Uint8Array(bytes);}
function escText(str){return new TextEncoder().encode(str);}
function bytesToBase64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s);}
function concatBytes(...arrays){
  const total=arrays.reduce((s,a)=>s+a.length,0);
  const out=new Uint8Array(total);
  let off=0;arrays.forEach(a=>{out.set(a,off);off+=a.length;});
  return out;
}
async function loadLogoBytes() {
  return new Uint8Array(0);
}
async function buildReceipt(items,total,dStr,tStr,tableLabel,cashGiven,change){
  const ESC=0x1B,GS=0x1D;
  const INIT=escCmd(ESC,0x40);
  const CENTER=escCmd(ESC,0x61,0x01);
  const LEFT=escCmd(ESC,0x61,0x00);
  const BOLD_ON=escCmd(ESC,0x45,0x01);
  const BOLD_OFF=escCmd(ESC,0x45,0x00);
  const NORMAL=escCmd(GS,0x21,0x00);
  const DASH=escText('--------------------------------\n');
  const CUT=escCmd(GS,0x56,0x41,0x10);
  function line(left,right,width=32){
    const space=width-left.length-right.length;
    return escText(left+(space>0?' '.repeat(space):' ')+right+'\n');
  }
  const logoBytes = await loadLogoBytes();
  let parts=[INIT,CENTER];
  if(logoBytes.length > 0) {
    parts.push(logoBytes, escText('\n'));
  } else {
    const BIG=escCmd(GS,0x21,0x11);
    parts.push(BOLD_ON,BIG,escText('MULA\n'),BOLD_OFF,NORMAL,escText('Eatery\n'));
  }
  if(tableLabel)parts.push(escText(tableLabel+'\n'));
  parts.push(escText(dStr+' '+tStr+'\n'),LEFT,DASH);
  items.forEach((i,idx)=>{
    parts.push(line(i.name.substring(0,26),'x'+i.qty));
    if(i.note)parts.push(escText('  *'+i.note+'\n'));
    parts.push(escText('  '+i.price+'\n'));
    if(idx<items.length-1)parts.push(escText('--------------------------------\n'));
  });
  parts.push(DASH,BOLD_ON,line('TOTAL',rp(total)),BOLD_OFF);
  if(cashGiven){
    parts.push(line('Uang Tunai',rp(cashGiven)));
    parts.push(line('Kembali',rp(change)));
  }
  parts.push(DASH,CENTER,escText('Terima kasih!\n\n\n'),CUT);
  return concatBytes(...parts);
}

let btDevice=null,btChar=null;
const BLE_SERVICES=[
  {s:'e7810a71-73ae-499d-8c15-faa9aef0c3f2',c:'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'},
  {s:'49535343-fe7d-4ae5-8fa9-9fafd205e455',c:'49535343-8841-43f4-a8d4-ecbe34729bb3'},
  {s:'000018f0-0000-1000-8000-00805f9b34fb',c:'00002af1-0000-1000-8000-00805f9b34fb'},
];

async function connectPrinter(){
  if(!navigator.bluetooth){alert('Web Bluetooth tidak didukung. Gunakan Chrome Android.');return false;}
  try{
    const opts={acceptAllDevices:true,optionalServices:BLE_SERVICES.map(x=>x.s)};
    btDevice=await navigator.bluetooth.requestDevice(opts);
    const server=await btDevice.gatt.connect();
    for(const svc of BLE_SERVICES){
      try{
        const service=await server.getPrimaryService(svc.s);
        btChar=await service.getCharacteristic(svc.c);
        return true;
      }catch(e){}
    }
    alert('Printer terhubung tapi karakteristik tidak ditemukan. Coba printer lain.');
    return false;
  }catch(e){
    if(e.name!=='NotFoundError')alert('Gagal connect: '+e.message);
    return false;
  }
}

async function sendToPrinter(data){
  const CHUNK=512;
  for(let i=0;i<data.length;i+=CHUNK){
    await btChar.writeValueWithoutResponse(data.slice(i,i+CHUNK));
    await new Promise(r=>setTimeout(r,50));
  }
}

document.getElementById('printBtn').addEventListener('click',async()=>{
  const all=getAll();
  const orderItems=all.filter(i=>(orders[i.id]?.qty||0)>0);
  if(!orderItems.length){alert('Belum ada order');return;}
  
  // Also show print preview as fallback
  let total=0;
  const items=orderItems.map(i=>{
    const q=orders[i.id].qty;
    const tn=!!(orders[i.id]?.tanpaNasi);
    const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;
    const sub=q*effP;
    total+=sub;
    return{name:i.name+(tn?' (tnp nasi)':''),qty:q,price:rp(sub),note:orders[i.id]?.note||''};
  });
  
  const now=new Date();
  const tStr=now.toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'});
  const dStr=fmtDateFull(curDate);
  const data=await buildReceipt(items,total,dStr,tStr);

  if(window.MulaPrinter?.printBase64){
    const btn=document.getElementById('printBtn');
    const origText=btn.textContent;
    btn.textContent='Native...';
    try{
      const ok=await window.MulaPrinter.printBase64(bytesToBase64(data));
      btn.textContent=origText;
      if(ok!==false)return;
      if(nativePrinterOnly()){alert(nativePrinterError());return;}
    }catch(e){
      btn.textContent=origText;
      if(nativePrinterOnly()){alert(e?.message||nativePrinterError());return;}
      console.warn('Native print bridge failed, trying browser path',e);
    }
  }

  // Try Web Bluetooth first
  if(navigator.bluetooth){
    const btn=document.getElementById('printBtn');
    const origText=btn.textContent;
    btn.textContent='Connecting...';
    try{
      if(!btChar||!btDevice?.gatt?.connected){
        const ok=await connectPrinter();
        if(!ok){btn.textContent=origText;return;}
      }
      btn.textContent='Printing...';
      await sendToPrinter(data);
      btn.textContent=origText;
      return;
    }catch(e){
      btChar=null;btDevice=null;
      btn.textContent=origText;
      console.warn('BT print failed, fallback to window.print',e);
    }
  }
  
  // Fallback: window.print()
  let rows='';
  items.forEach(i=>{
    rows+=`<div class="rp-row"><span>${i.name}</span><span>x${i.qty}</span></div>`;
    if(i.note)rows+=`<div class="rp-note">* ${i.note}</div>`;
    rows+=`<div class="rp-price" style="display:flex;justify-content:space-between"><span></span><span>${i.price}</span></div>`;
  });
  document.getElementById('printArea').innerHTML=`<div class="receipt-print"><div class="rp-center"><div class="rp-logo">MULA</div><div class="rp-sub">Eatery</div><div class="rp-sub">${dStr} · ${tStr}</div></div><hr class="rp-divider">${rows}<hr class="rp-divider"><div class="rp-total"><span>TOTAL</span><span>${rp(total)}</span></div><hr class="rp-divider"><div class="rp-center rp-sub" style="margin-top:2mm">Terima kasih!</div></div>`;
  setTimeout(()=>window.print(),100);
});



// Order summary modal
(function(){
  const style=document.createElement('style');
  style.textContent=`
  #orderSummaryModal{display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;}
  #orderSummaryModal.show{display:flex;}
  .osm-box{background:var(--surface2,#1a1a1a);border:1px solid var(--border,#333);border-radius:16px;padding:0;width:min(480px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
  .osm-head{padding:18px 20px 14px;border-bottom:1px solid var(--border,#333);display:flex;align-items:center;justify-content:space-between;}
  .osm-title{font-family:'Playfair Display',serif;font-size:20px;color:var(--gold,#c9a84c);margin:0;}
  .osm-subtitle{font-size:12px;color:var(--muted2,#888);letter-spacing:1px;text-transform:uppercase;}
  .osm-body{overflow-y:auto;padding:16px 20px;flex:1;}
  .osm-row{display:flex;align-items:flex-start;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);gap:8px;}
  .osm-row:last-child{border-bottom:none;}
  .osm-name{font-size:14px;color:var(--text,#eee);flex:1;}
  .osm-qty{font-size:13px;color:var(--muted2,#888);margin-right:12px;white-space:nowrap;}
  .osm-price{font-size:14px;color:var(--text,#eee);white-space:nowrap;}
  .osm-note{font-size:11px;color:var(--muted2,#888);font-style:italic;margin-top:2px;}
  .osm-foot{padding:14px 20px;border-top:1px solid var(--border,#333);background:var(--surface3,#111);}
  .osm-total{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
  .osm-total-lbl{font-size:14px;color:var(--muted2,#888);letter-spacing:1px;text-transform:uppercase;}
  .osm-total-val{font-size:22px;font-weight:700;color:var(--gold,#c9a84c);}
  .osm-pay-box{background:rgba(255,255,255,0.03);border:1px solid var(--border2);border-radius:12px;padding:12px;margin-bottom:14px;}
  .osm-pay-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
  .osm-pay-lbl{font-size:13px;color:var(--text);}
  .osm-pay-inp{background:none;border:none;border-bottom:1px solid var(--gold-dim);color:var(--text);font-family:'Playfair Display',serif;font-size:18px;text-align:right;width:120px;outline:none;}
  .osm-pay-inp::placeholder{color:var(--muted2);}
  .osm-kembali-lbl{font-size:13px;color:var(--text);}
  .osm-kembali-val{font-size:16px;font-weight:700;color:#5fa97c;}
  .osm-fast-cash{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px;scrollbar-width:none;}
  .osm-fc-btn{background:var(--surface1);border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;white-space:nowrap;}
  .osm-fc-btn:hover{border-color:var(--gold);color:var(--gold);}
  .osm-method-row{display:flex;gap:6px;flex-wrap:wrap;}
  .osm-method-btn{background:var(--surface1);border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:20px;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif;transition:all 0.18s;}
  .osm-method-btn.active{background:rgba(212,168,83,0.15);border-color:var(--gold);color:var(--gold);font-weight:700;}
  .osm-actions{display:flex;gap:10px;}
  .osm-actions .btn-primary{flex:2;padding:12px;font-size:15px;font-weight:700;}
  .osm-actions .btn-secondary{flex:1;padding:12px;font-size:15px;}
  `;
  document.head.appendChild(style);

  const modal=document.createElement('div');
  modal.id='orderSummaryModal';
  modal.innerHTML=`<div class="osm-box">
    <div class="osm-head"><div><div class="osm-title">Ringkasan Order</div><div class="osm-subtitle">Konfirmasi sebelum kirim ke dapur</div></div></div>
    <div class="osm-body" id="osmItems"></div>
    <div class="osm-foot">
      <div class="osm-total"><span class="osm-total-lbl">Total</span><span class="osm-total-val" id="osmTotal"></span></div>
      <div class="osm-pay-box">
        <div style="margin-bottom:10px">
          <div style="font-size:11px;color:var(--muted2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Metode Bayar</div>
          <div class="osm-method-row" id="osmMethodRow">
            <button class="osm-method-btn active" data-method="Tunai">💵 Tunai</button>
            <button class="osm-method-btn" data-method="QRIS">📱 QRIS</button>
            <button class="osm-method-btn" data-method="Dana">Dana</button>
            <button class="osm-method-btn" data-method="GoPay">GoPay</button>
            <button class="osm-method-btn" data-method="Transfer">Transfer</button>
          </div>
        </div>
        <div class="osm-fast-cash" id="osmFastCash">
           <button class="osm-fc-btn" data-val="pas">Uang Pas</button>
           <button class="osm-fc-btn" data-val="50000">50k</button>
           <button class="osm-fc-btn" data-val="100000">100k</button>
           <button class="osm-fc-btn" data-val="150000">150k</button>
           <button class="osm-fc-btn" data-val="200000">200k</button>
        </div>
        <div class="osm-pay-row" id="osmTunaiRow">
          <span class="osm-pay-lbl">Uang Tunai</span>
          <input type="number" id="osmUangTunai" class="osm-pay-inp" placeholder="0">
        </div>
        <div class="osm-pay-row" style="margin-bottom:0" id="osmKembaliRow">
          <span class="osm-kembali-lbl">Kembalian</span>
          <span class="osm-kembali-val" id="osmKembalian">Rp 0</span>
        </div>
      </div>
      <div class="osm-actions">
        <button class="btn-secondary" id="osmCancel">Batal</button>
        <button class="btn-primary" id="osmConfirm">✓ Kirim ke Dapur</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);

  document.getElementById('osmCancel').addEventListener('click',()=>modal.classList.remove('show'));
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show');});
})();

document.getElementById('prosesManualBtn').addEventListener('click',()=>{
  const all=getAll();
  const orderItems=all.filter(i=>(orders[i.id]?.qty||0)>0);
  if(!orderItems.length){alert('Belum ada pesanan yang dipilih');return;}
  let total=0;
  const items=orderItems.map(i=>{
    const q=orders[i.id].qty;
    const tn=!!(orders[i.id]?.tanpaNasi);
    const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;
    const sub=q*effP;
    total+=sub;
    return{id:i.id,name:i.name+(tn?' (tnp nasi)':''),qty:q,price:rp(sub),rawPrice:sub,note:orders[i.id]?.note||'',tanpaNasi:tn};
  });

  // Render summary modal
  document.getElementById('osmItems').innerHTML=items.map(i=>`
    <div class="osm-row">
      <div style="flex:1"><div class="osm-name">${esc(i.name)}</div>${i.note?`<div class="osm-note">* ${esc(i.note)}</div>`:''}</div>
      <span class="osm-qty">x${i.qty}</span>
      <span class="osm-price">${i.price}</span>
    </div>`).join('');
  document.getElementById('osmTotal').textContent=rp(total);
  
  const tunaiInp=document.getElementById('osmUangTunai');
  const kembalianEl=document.getElementById('osmKembalian');
  const tunaiRow=document.getElementById('osmTunaiRow');
  const kembaliRow=document.getElementById('osmKembaliRow');
  const fastCash=document.getElementById('osmFastCash');
  tunaiInp.value=''; kembalianEl.textContent='Rp 0';
  
  // Reset method to Tunai on each open
  document.querySelectorAll('.osm-method-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.osm-method-btn[data-method="Tunai"]').classList.add('active');
  tunaiRow.style.display=''; kembaliRow.style.display=''; fastCash.style.display='';
  
  function getMethod(){return document.querySelector('.osm-method-btn.active')?.dataset.method||'Tunai';}
  
  function calcKembali(){
    const t=parseInt(tunaiInp.value)||0;
    const k=Math.max(0,t-total);
    kembalianEl.textContent=t>=total?rp(k):'Rp 0';
    kembalianEl.style.color=t>=total?'#5fa97c':'var(--gold)';
  }
  tunaiInp.addEventListener('input',calcKembali);
  
  document.querySelectorAll('.osm-method-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.osm-method-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const isTunai=btn.dataset.method==='Tunai';
      tunaiRow.style.display=isTunai?'':'none';
      kembaliRow.style.display=isTunai?'':'none';
      fastCash.style.display=isTunai?'':'none';
      if(!isTunai){tunaiInp.value='';kembalianEl.textContent='Rp 0';}
    });
  });
  
  document.querySelectorAll('.osm-fc-btn').forEach(btn=>{
    const newFcBtn=btn.cloneNode(true);
    btn.parentNode.replaceChild(newFcBtn,btn);
    newFcBtn.addEventListener('click',()=>{
      const v=newFcBtn.dataset.val;
      if(v==='pas') tunaiInp.value=total;
      else tunaiInp.value=v;
      calcKembali();
    });
  });

  // Replace confirm handler
  const confirmBtn=document.getElementById('osmConfirm');
  const newBtn=confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn,confirmBtn);
  newBtn.addEventListener('click',async()=>{
    const paymentMethod=getMethod();
    const cashGiven=paymentMethod==='Tunai'?(parseInt(tunaiInp.value)||0):0;
    const change=Math.max(0,cashGiven-total);
    
    newBtn.disabled=true;
    newBtn.textContent='Memproses...';
    document.getElementById('orderSummaryModal').classList.remove('show');
    const tid='KASIR-'+Date.now().toString().slice(-4);
    const dbItems={};
    items.forEach(i=>{dbItems[i.id]={qty:i.qty,note:i.note,tanpaNasi:i.tanpaNasi};});
    try{
      const finRef=push(ref(db,`orders/${curDate}`));
      const finKey=finRef.key||finRef.path?.split('/').pop();
      const fPayload={time:Date.now(),tableLabel:'Takeaway / Kasir',total,cashGiven,change,paymentMethod,items:dbItems};
      const tPayload={status:'active',items:dbItems,total,cashGiven,change,paymentMethod,tableLabel:'Takeaway / Kasir',createdAt:Date.now(),dateKey:curDate,financeKey:finKey};
      
      set(finRef,fPayload).catch(()=>{});
      set(ref(db,`tableOrders/${tid}`),tPayload).catch(()=>{});
      
      const q=JSON.parse(localStorage.getItem('mula_offline_queue')||'[]');
      q.push({type:'kasir',finKey,dateKey:curDate,tid,fPayload,tPayload});
      localStorage.setItem('mula_offline_queue',JSON.stringify(q));
      
      try{await autoPrint(dbItems,total,'Takeaway / Kasir',cashGiven,change);}catch(e){}
      orders={};renderOrders();
      showToast('Pesanan berhasil masuk ke dapur!');
    }catch(e){alert('Gagal: '+e.message);}
    newBtn.disabled=false;
    newBtn.textContent='✓ Kirim ke Dapur';
  });

  document.getElementById('orderSummaryModal').classList.add('show');
});

document.getElementById('menuSearch').addEventListener('input',function(){
  const q=this.value.trim().toLowerCase();
  document.getElementById('searchClear').style.display=q?'block':'none';
  filterMenu(q);
});
document.getElementById('searchClear').addEventListener('click',function(){
  document.getElementById('menuSearch').value='';
  this.style.display='none';
  filterMenu('');
});
function filterMenu(q){
  if(!q){
    document.querySelectorAll('.menu-item').forEach(el=>el.classList.remove('hidden'));
    document.querySelectorAll('.section-div').forEach(el=>el.classList.remove('hidden'));
    return;
  }
  document.querySelectorAll('.section-div').forEach(sec=>{
    let hasVisible=false;
    let el=sec.nextElementSibling;
    while(el&&el.classList.contains('menu-item')){
      const name=el.querySelector('.item-name')?.textContent.toLowerCase()||'';
      if(name.includes(q)){el.classList.remove('hidden');hasVisible=true;}
      else el.classList.add('hidden');
      el=el.nextElementSibling;
    }
    sec.classList.toggle('hidden',!hasVisible);
  });
}

// ========== EVENT LISTENERS + GUEST VIEW INIT ==========
document.getElementById('openQrBtn')?.addEventListener('click',openQrModal);
document.getElementById('closeQrBtn')?.addEventListener('click',()=>document.getElementById('qrModal').classList.remove('show'));

function openQrModal(){
  const grid=document.getElementById('qrGrid');
  grid.innerHTML='';
  TABLE_IDS.forEach(tid=>{
    const url=APP_URL+'?table='+tid;
    const div=document.createElement('div');
    div.className='qr-item';
    div.innerHTML=`<div id="qr_${tid}"></div><div class="qr-label">MEJA ${tid}</div>`;
    grid.appendChild(div);
    new QRCode(div.querySelector(`#qr_${tid}`),{text:url,width:128,height:128,colorDark:"#000",colorLight:"#fff",correctLevel:QRCode.CorrectLevel.M});
  });
  document.getElementById('qrModal').classList.add('show');
}

// Guest view init: check URL for ?table=X
(function initGuestView(){
  const params=new URLSearchParams(location.search);
  const tableParam=params.get('table');
  if(!tableParam)return;
  if(!TABLE_IDS.includes(tableParam))return;
  document.getElementById('lockScreen').style.display='none';
  document.getElementById('guestView').style.display='block';
  document.getElementById('gvTableLabel').textContent=`Meja ${tableParam}`;
  document.title=`MULA | Meja ${tableParam}`;
  let gvCustomMenu={},gvPrices={},gvAvailability={},gvTableOrder=null;
  let guestCart={}; // local pending cart: {itemId: {qty, note, tanpaNasi}}
  let menuRendered=false;
  onValue(ref(db,'customMenu'),s=>{gvCustomMenu=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'priceOverrides'),s=>{gvPrices=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'menuAvailability'),s=>{gvAvailability=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,`tableOrders/${tableParam}`),s=>{gvTableOrder=s.val();renderGuest();});
  renderGuest();
  function mkSec(cat,def){return[...def,...Object.values(gvCustomMenu).filter(i=>i.cat===cat)].map(i=>({...i,price:gvPrices[i.id]||i.price,outOfStock:!!gvAvailability[i.id]}));}
  function getAllGuest(){return[...mkSec('favorites',DEF_FAVORITES),...mkSec('drinks',DEF_DRINKS),...mkSec('main',DEF_MAIN),...mkSec('dessert',DEF_DESSERT),...mkSec('tambahan',DEF_TAMBAHAN)];}
  function calcCartTotal(){let t=0;getAllGuest().forEach(i=>{if(i.outOfStock&&guestCart[i.id]?.qty)guestCart[i.id]={qty:0,note:'',tanpaNasi:false};const c=guestCart[i.id];if(!c||!c.qty||i.outOfStock)return;const effP=NASI_IDS.includes(i.id)&&c.tanpaNasi?i.price-NASI_PRICE:i.price;t+=c.qty*effP;});return t;}
  function showToast(msg){const t=document.getElementById('gvToast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}
  function renderMenu(){
    const sections=[
      {label:'Mula Favorites',items:mkSec('favorites',DEF_FAVORITES)},
      {label:'Main Course',items:mkSec('main',DEF_MAIN)},
      {label:'Cemilan & Dessert',items:mkSec('dessert',DEF_DESSERT)},
      {label:'Minuman',items:mkSec('drinks',DEF_DRINKS)},
      {label:'Tambahan',items:mkSec('tambahan',DEF_TAMBAHAN)},
    ];
    let h='';
    sections.forEach(sec=>{
      h+=`<div class="gv-section">${esc(sec.label)}</div>`;
      sec.items.forEach(i=>{
        const c=guestCart[i.id]||{qty:0,note:'',tanpaNasi:false};
        const out=!!i.outOfStock;
        if(out&&guestCart[i.id]?.qty)guestCart[i.id]={qty:0,note:'',tanpaNasi:false};
        const isNasi=NASI_IDS.includes(i.id);
        const effP=isNasi&&c.tanpaNasi?i.price-NASI_PRICE:i.price;
        const priceStr=isNasi&&c.tanpaNasi?`<span style="text-decoration:line-through;opacity:0.4;margin-right:4px">${rp(i.price)}</span>${rp(effP)}`:rp(effP);
        const tnBtn=isNasi?`<button class="gv-tn-btn${c.tanpaNasi?' active':''}" data-id="${i.id}" data-action="tn">${c.tanpaNasi?'✓ Tanpa Nasi':'− Nasi (-Rp 5.000)'}</button>`:'';
        const noteField=c.qty>0?`<input class="gv-note" type="text" data-id="${i.id}" placeholder="Catatan..." value="${esc(c.note)}">`:'';
        const optsRow=(tnBtn||noteField)?`<div class="gv-mi-opts">${tnBtn}${noteField}</div>`:'';
        h+=`<div class="gv-menu-item"><div class="gv-mi-top"><div class="gv-mi-left"><div class="gv-mi-name">${esc(i.name)}</div><div class="gv-mi-price">${priceStr}</div></div><div class="gv-mi-ctrl"><button class="gv-qbtn minus" data-id="${i.id}" data-d="-1">−</button><div class="gv-qdisp ${c.qty>0?'active':''}" id="gvq_${i.id}">${c.qty}</div><button class="gv-qbtn plus" data-id="${i.id}" data-d="1">+</button></div></div>${optsRow}</div>`;
      });
    });
    const ml=document.getElementById('gvMenuList');
    ml.innerHTML=h;
    ml.querySelectorAll('.gv-qbtn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id,d=parseInt(btn.dataset.d);
        if(getAllGuest().find(x=>x.id===id)?.outOfStock){showToast('Menu sedang habis');return;}
        if(!guestCart[id])guestCart[id]={qty:0,note:'',tanpaNasi:false};
        guestCart[id].qty=Math.max(0,(guestCart[id].qty||0)+d);
        if(guestCart[id].qty===0){guestCart[id].note='';guestCart[id].tanpaNasi=false;}
        renderMenu();
        updateFooter();
      });
    });
    ml.querySelectorAll('.gv-tn-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id;
        if(getAllGuest().find(x=>x.id===id)?.outOfStock){showToast('Menu sedang habis');return;}
        if(!guestCart[id])guestCart[id]={qty:0,note:'',tanpaNasi:false};
        guestCart[id].tanpaNasi=!guestCart[id].tanpaNasi;
        renderMenu();updateFooter();
      });
    });
    ml.querySelectorAll('.gv-note').forEach(inp=>{
      inp.addEventListener('input',()=>{const id=inp.dataset.id;if(getAllGuest().find(x=>x.id===id)?.outOfStock)return;if(!guestCart[id])guestCart[id]={qty:0,note:'',tanpaNasi:false};guestCart[id].note=inp.value;});
    });
  }
  function updateFooter(){
    const total=calcCartTotal();
    const hasItems=Object.values(guestCart).some(c=>(c.qty||0)>0);
    document.getElementById('gvCartTotal').textContent=rp(total);
    document.getElementById('gvPesanBtn').disabled=!hasItems;
    document.getElementById('gvFooter').style.display=hasItems?'flex':'none';
  }
  function renderMyOrder(){
    const panel=document.getElementById('gvMyOrderPanel');
    const mintaBtn=document.getElementById('gvMintaBayarBtn');
    const items=gvTableOrder?.items||{};
    const all=getAllGuest();
    const activeItems=all.filter(i=>(items[i.id]?.qty||0)>0);
    if(!activeItems.length){panel.style.display='none';mintaBtn.style.display='none';return;}
    panel.style.display='block';
    let total=0;
    const rows=activeItems.map(i=>{
      const q=items[i.id].qty;const tn=!!(items[i.id]?.tanpaNasi);
      const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;
      const sub=q*effP;total+=sub;
      const note=items[i.id]?.note||'';
      return `<div class="gv-item"><div><div class="gv-iname">${esc(i.name)}${tn?' <span style="font-size:10px;color:var(--red)">(tanpa nasi)</span>':''}</div>${note?`<div class="gv-inote">* ${esc(note)}</div>`:''}</div><div class="gv-iright"><div class="gv-iqty">×${q}</div><div class="gv-iprice">${rp(sub)}</div></div></div>`;
    }).join('');
    document.getElementById('gvMyItems').innerHTML=rows;
  }
  function renderGuest(){
    const status=gvTableOrder?.status||'active';
    const menuBlock=document.getElementById('gvMenuBlock');
    const payBlock=document.getElementById('gvPayBlock');
    if(status==='pending_payment'||status==='waiting_verification'){
      menuBlock.style.display='none';
      document.getElementById('gvFooter').style.display='none';
      const total=gvTableOrder?.total||0;
      const items=gvTableOrder?.items||{};
      const all=getAllGuest();
      const orderItems=all.filter(i=>(items[i.id]?.qty||0)>0);
      const itemsHtml=orderItems.map(i=>{
        const q=items[i.id].qty;const tn=!!(items[i.id]?.tanpaNasi);
        const effP=NASI_IDS.includes(i.id)&&tn?i.price-NASI_PRICE:i.price;
        const sub=q*effP;const note=items[i.id]?.note||'';
        return `<div class="gv-item"><div><div class="gv-iname">${esc(i.name)}${tn?' <span style="font-size:10px;color:#a33">(tanpa nasi)</span>':''}</div>${note?`<div class="gv-inote">* ${esc(note)}</div>`:''}</div><div class="gv-iright"><div class="gv-iqty">×${q}</div><div class="gv-iprice">${rp(sub)}</div></div></div>`;
      }).join('');
      payBlock.style.display='block';
      const actionBtn=status==='pending_payment'?`<button class="gv-minta-btn" id="gvPayConfirmBtn" style="margin-top:16px">Konfirmasi Pesanan</button>`:'';
      payBlock.innerHTML=`<div class="gv-pay-card"><div class="gv-pay-kicker">Pembayaran di Kasir</div><div class="gv-pay-title">Silakan Bayar di Kasir</div><div class="gv-pay-total">${rp(total)}</div><div class="gv-shell" style="margin-bottom:14px"><div class="gv-shell-head"><span class="gv-shell-title" style="font-size:18px">Pesanan Anda</span></div>${itemsHtml}</div><div class="gv-pay-steps"><div class="gv-pay-step" style="text-align:center"><span>Silakan menuju meja kasir untuk melakukan pembayaran agar pesanan bisa diteruskan ke dapur.</span></div></div><div class="gv-pay-wait">${status==='waiting_verification'?'Menunggu konfirmasi kasir':'Tekan tombol di bawah untuk memberitahu kasir'}</div>${actionBtn}</div>`;
      document.getElementById('gvPayConfirmBtn')?.addEventListener('click',async()=>{
        if(!gvTableOrder||gvTableOrder.status!=='pending_payment')return;
        try{
          await update(ref(db,`tableOrders/${tableParam}`),{status:'waiting_verification',claimedPaidAt:Date.now()});
          showToast('Pesanan dikirim ke kasir untuk diverifikasi.');
        }catch(e){
          alert('Gagal mengirim konfirmasi bayar: '+e.message);
        }
      });
      return;
    }
    if(status==='paid'){
      menuBlock.style.display='none';
      document.getElementById('gvFooter').style.display='none';
      document.getElementById('gvMintaBayarBtn').style.display='none';
      payBlock.style.display='block';
      payBlock.innerHTML=`<div class="gv-done-card"><div class="gv-done-kicker">Selesai</div><div class="gv-done-icon">✓</div><div class="gv-done-title">Pembayaran Dikonfirmasi</div><div class="gv-done-sub">Terima kasih. Pembayaran sudah dicek staf dan pesanan masuk ke dapur.</div></div>`;
      return;
    }
    // active / default
    payBlock.style.display='none';
    menuBlock.style.display='block';
    document.getElementById('gvMintaBayarBtn').style.display='none';
    if(!menuRendered){renderMenu();menuRendered=true;}
    updateFooter();
  }
  document.getElementById('gvPesanBtn').addEventListener('click',async()=>{
    const curStatus=gvTableOrder?.status||'active';
    if(curStatus==='pending_payment'||curStatus==='waiting_verification'){alert('Selesaikan pembayaran yang sedang berjalan dulu.');return;}
    if(curStatus==='paid'){alert('Pembayaran baru saja selesai. Tunggu sebentar sampai sesi meja dibersihkan.');return;}
    if(!Object.values(guestCart).some(c=>(c.qty||0)>0))return;
    const btn=document.getElementById('gvPesanBtn');
    btn.disabled=true;btn.textContent='Menyimpan...';
    try{
      const items={};
      Object.entries(guestCart).forEach(([id,c])=>{if((c.qty||0)>0)items[id]={qty:c.qty,note:c.note||'',tanpaNasi:!!c.tanpaNasi};});
      let total=0;
      getAllGuest().forEach(i=>{const m=items[i.id];if(!m||!m.qty)return;const effP=NASI_IDS.includes(i.id)&&m.tanpaNasi?i.price-NASI_PRICE:i.price;total+=m.qty*effP;});
      const payload={tableLabel:`Meja ${tableParam}`,status:'pending_payment',createdAt:Date.now(),dateKey:today(),total,items};
      await set(ref(db,`tableOrders/${tableParam}`),payload);
      gvTableOrder=payload;
      guestCart={};
      menuRendered=false;
      renderGuest();
      showToast('Pesanan disimpan. Silakan lanjut ke kasir.');
    }catch(e){
      console.error(e);
      alert('Gagal menyimpan pesanan: '+e.message);
    }
    btn.disabled=false;btn.textContent='Pesan Sekarang';
  });
  document.getElementById('gvMintaBayarBtn').style.display='none';
})();


if('serviceWorker' in navigator){
  const swCode = `const CACHE = 'mula-v15';
const ASSETS = ['/', '/index.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('firebasedatabase.app') || e.request.url.includes('firebaseio.com') || e.request.url.includes('gstatic.com')) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const network = fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});`;
  const blob = new Blob([swCode], {type:'text/javascript'});
  const url = URL.createObjectURL(blob);
  navigator.serviceWorker.register(url).catch(()=>{});
}
