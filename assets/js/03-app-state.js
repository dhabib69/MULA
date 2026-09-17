// Shared state, auth, tabs, Firebase subscriptions, stock/receipt helpers
var role=null,curDate=today(),orders={},stock={},receipts={},customMenu={},prices={},customMenuComps={},menuAvailability={},menuDeletions={},pendingNewRows=[],selFile=null,syncT=null,editPriceId=null,isManageMode=false;
var guestTableReservations={},tableBlocks={},unsubGuestTableReservations=null,unsubTableBlocks=null,staffLoginRole=null,staffLoginInProgress=false;
var unsubOrders=null,unsubStock=null,unsubReceipts=null,unsubCustom=null,unsubPrices=null,unsubCustomComps=null,unsubMenuAvailability=null,unsubMenuDeletions=null;
var menuAvailabilityResetInFlight=null,lastMenuAvailabilityResetDate='';
var curTable=null,tableOrders={},dailyOrders={},unsubTableOrder=null,unsubAllTables=null;
var liveTableSlices={active:{},waiting:{},paid:{},pending:{},served:{}};
var outboxFinKeys=new Set(),outboxDbPromise=null;
var customReady=false,pricesReady=false,renderScheduled=false,tableRenderScheduled=false;
var paymentAlertSeen=new Set();
var kitchenAlertSeen=new Set(),kitchenTimerInterval=null,kitchenSoundEnabled=localStorage.getItem('mula_kitchen_sound')==='1';
var kitchenAlertVolume=Math.max(0,Math.min(1,Number(localStorage.getItem('mula_notification_volume')||'0.85')));
var LOCAL_DAILY_KEY='mula_local_daily_orders';
var LOCAL_ACTIVE_KEY='mula_local_active_orders';
var LOCAL_CACHE_KEYS={customMenu:'mula_cache_customMenu',prices:'mula_cache_prices',customMenuComps:'mula_cache_customMenuComps',menuAvailability:'mula_cache_menuAvailability',stock:'mula_cache_stock'};
function today(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function isOrderDateToday(){return curDate===today();}
function requireTodayForOrder(){if(isOrderDateToday())return true;showToast('Pesanan hanya dapat dibuat untuk tanggal hari ini.');return false;}
function showToast(msg,dur=2400){let t=document.getElementById('cashierToast');if(!t){t=document.createElement('div');t.id='cashierToast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none';document.body.appendChild(t);}t.textContent=msg;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',dur);}
function enableKitchenSound(){kitchenSoundEnabled=true;localStorage.setItem('mula_kitchen_sound','1');playKitchenAlert();showToast('Suara dapur aktif');renderActiveTables();}
function ensureSettingsModal(){
  if(document.getElementById('settingsModal'))return;
  const modal=document.createElement('div');
  modal.id='settingsModal';modal.className='modal-bg';
  modal.innerHTML=`<div class="modal-box" style="max-width:390px"><h3>Pengaturan</h3><div style="margin:14px 0 18px;text-align:left"><label for="notificationVolume" style="display:block;font-size:12px;color:var(--muted2);margin-bottom:8px">Volume notifikasi <strong id="notificationVolumeValue" style="color:var(--gold)"></strong></label><input id="notificationVolume" type="range" min="0" max="100" step="5" style="width:100%"><p style="margin:7px 0 0;font-size:11px;color:var(--muted)">Berlaku untuk notifikasi pesanan baru dan pembayaran.</p></div><div class="modal-actions"><button class="btn-secondary" id="settingsClose">Tutup</button><button class="btn-secondary" id="settingsTestSound">Tes Suara</button><button class="btn-primary" id="settingsRefresh">↻ Refresh Terbaru</button></div></div>`;
  document.body.appendChild(modal);
  const range=document.getElementById('notificationVolume'),label=document.getElementById('notificationVolumeValue');
  const updateVolume=()=>{kitchenAlertVolume=Math.max(0,Math.min(1,Number(range.value)/100));localStorage.setItem('mula_notification_volume',String(kitchenAlertVolume));label.textContent=Math.round(kitchenAlertVolume*100)+'%';};
  range.value=String(Math.round(kitchenAlertVolume*100));updateVolume();
  range.addEventListener('input',updateVolume);
  document.getElementById('settingsClose').addEventListener('click',()=>modal.classList.remove('show'));
  document.getElementById('settingsTestSound').addEventListener('click',()=>playKitchenAlert());
  document.getElementById('settingsRefresh').addEventListener('click',forceLatestRefresh);
}
function openSettings(){ensureSettingsModal();document.getElementById('settingsModal').classList.add('show');}
async function forceLatestRefresh(){
  const btn=document.getElementById('settingsRefresh');if(btn){btn.disabled=true;btn.textContent='Memuat...';}
  try{
    if(fbDb&&typeof fbDb.goOnline==='function')fbDb.goOnline();
    if(currentUser&&!currentUser.isAnonymous)await currentUser.getIdToken(true);
    if('serviceWorker' in navigator){const registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(registration=>registration.update().catch(()=>{})));await Promise.all(registrations.map(registration=>registration.unregister().catch(()=>false)));}
    if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>key.indexOf('mula-')===0).map(key=>caches.delete(key)));}
  }catch(error){console.warn('Refresh terbaru gagal membersihkan cache',error);}
  location.replace(location.pathname+'?mula_refresh='+Date.now()+location.hash);
}
function readJsonStore(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(e){return{};}}
function writeJsonStore(key,val){localStorage.setItem(key,JSON.stringify(val||{}));}
function getLocalDailyOrders(dateKey){return readJsonStore(LOCAL_DAILY_KEY)[dateKey]||{};}
function setLocalDailyOrder(dateKey,finKey,payload){const store=readJsonStore(LOCAL_DAILY_KEY);if(!store[dateKey])store[dateKey]={};store[dateKey][finKey]=payload;writeJsonStore(LOCAL_DAILY_KEY,store);}
function removeLocalDailyOrder(dateKey,finKey){const store=readJsonStore(LOCAL_DAILY_KEY);if(store[dateKey]){delete store[dateKey][finKey];if(!Object.keys(store[dateKey]).length)delete store[dateKey];writeJsonStore(LOCAL_DAILY_KEY,store);}}
function getLocalActiveOrders(){return readJsonStore(LOCAL_ACTIVE_KEY);}
function setLocalActiveOrder(tid,payload){const store=getLocalActiveOrders();store[tid]=payload;writeJsonStore(LOCAL_ACTIVE_KEY,store);}
function removeLocalActiveOrder(tid){const store=getLocalActiveOrders();delete store[tid];writeJsonStore(LOCAL_ACTIVE_KEY,store);}
function pruneStaleLocalOrders(dateKey,remote){
  if(!remote)return;
  const localDaily=getLocalDailyOrders(dateKey);
  const localKeys=Object.keys(localDaily);
  if(!localKeys.length)return;
  let q=[];try{q=JSON.parse(localStorage.getItem('mula_offline_queue')||'[]');}catch(e){}
  outboxFinKeys.forEach(k=>q.push({finKey:k}));
  const queuedFinKeys=new Set(q.map(j=>j.finKey).filter(Boolean));
  let changed=false;
  for(const finKey of localKeys){
    if(remote[finKey]||!queuedFinKeys.has(finKey)){
      delete localDaily[finKey];
      changed=true;
    }
  }
  if(changed){
    const store=readJsonStore(LOCAL_DAILY_KEY);
    if(Object.keys(localDaily).length===0)delete store[dateKey];
    else store[dateKey]=localDaily;
    writeJsonStore(LOCAL_DAILY_KEY,store);
  }
}
function mergedDailyOrders(dateKey,remote){pruneStaleLocalOrders(dateKey,remote);return Object.assign({},remote||{},getLocalDailyOrders(dateKey));}
function mergedActiveOrders(remote){return Object.assign({},remote||{},getLocalActiveOrders());}
function readLocalCache(key){return readJsonStore(LOCAL_CACHE_KEYS[key]||key);}
function writeLocalCache(key,val){writeJsonStore(LOCAL_CACHE_KEYS[key]||key,val);}
function hydrateLocalCaches(){
customMenu=readLocalCache('customMenu');
prices=readLocalCache('prices');
customMenuComps=readLocalCache('customMenuComps');
menuAvailability=readLocalCache('menuAvailability');
stock=readLocalCache('stock');
}
hydrateLocalCaches();
function injectCashierUxStyles(){if(document.getElementById('cashierUxStyles'))return;const s=document.createElement('style');s.id='cashierUxStyles';s.textContent=`
  .search-wrap{display:flex;align-items:center;gap:10px}
  .search-wrap-inner{flex:1;min-width:0}
  .manage-toggle-btn{display:flex!important;align-items:center;justify-content:center;min-height:36px}
  .manage-toggle-btn.active{background:rgba(212,168,83,0.16)!important;border-color:var(--gold-dim)!important;color:var(--gold)!important;box-shadow:0 0 0 3px rgba(212,168,83,0.08)}
  .category-slider{display:flex;gap:8px;padding:12px 20px;overflow-x:auto;position:sticky;top:0;z-index:80;background:linear-gradient(180deg,var(--bg2),var(--bg));border-bottom:1px solid var(--border);scrollbar-width:none}
  .cat-chip{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:7px 13px;border-radius:20px;font-size:12px;white-space:nowrap;cursor:pointer;font-family:Outfit,sans-serif;transition:all .18s;display:inline-flex;align-items:center;gap:6px}
  .cat-chip-count{min-width:18px;height:18px;border-radius:50%;background:rgba(212,168,83,.18);border:1px solid var(--gold-dim);color:var(--gold);display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}
  .cat-chip:hover,.cat-chip:focus{border-color:var(--gold-dim);color:var(--gold);outline:none;transform:translateY(-1px)}
  .order-focus-strip{display:flex;align-items:center;gap:10px;padding:12px 20px;background:linear-gradient(135deg,rgba(212,168,83,.11),rgba(255,255,255,.025));border-bottom:1px solid rgba(212,168,83,.22)}
  .order-focus-main{display:flex;flex-direction:column;gap:2px;min-width:110px;flex-shrink:0}
  .order-focus-label{font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:1.4px}
  .order-focus-total{font-family:'Playfair Display',serif;font-size:20px;color:var(--gold);line-height:1}
  .order-focus-chips{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
  .order-chip{border:1px solid rgba(212,168,83,.28);background:rgba(0,0,0,.18);color:var(--text);padding:7px 10px;border-radius:999px;font-size:12px;white-space:nowrap;cursor:pointer;font-family:Outfit,sans-serif}
  .order-chip strong{color:var(--gold);margin-right:5px}
  .order-clear-btn{background:none;border:1px solid #4a2020;color:var(--red);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;white-space:nowrap}
  .menu-grid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;padding:14px 20px 18px}
  .menu-grid.hidden{display:none}
  .menu-section-head{position:sticky;top:0;z-index:40}
  .menu-section-count{font-size:10px;color:var(--muted2);letter-spacing:1px;text-transform:none}
  .menu-item{min-height:96px;align-items:start}
  .menu-item.selected{border-color:rgba(212,168,83,.55);background:linear-gradient(145deg,rgba(212,168,83,.11),var(--surface2));box-shadow:0 8px 22px rgba(0,0,0,.22),inset 0 1px 0 rgba(212,168,83,.18)}
  .menu-item.selected::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--gold)}
  .menu-item .item-price-wrap{min-width:0}
  .item-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .item-admin-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
  .tanpa-nasi-split{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
  .tanpa-nasi-label{font-size:10px;color:var(--muted2);min-width:72px;letter-spacing:.2px}
  .tanpa-nasi-count{font-size:10px;color:var(--gold);min-width:46px;text-align:center}
  .tanpa-nasi-step{width:24px;height:24px;border-radius:7px;border:1px solid var(--border2);background:var(--surface3);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;font-family:Outfit,sans-serif}
  .tanpa-nasi-step.active{border-color:var(--gold-dim);color:var(--gold)}
  .tanpa-nasi-step:disabled{opacity:.35;cursor:not-allowed}
  .availability-btn{border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;transition:transform .15s,opacity .15s}
  .availability-btn:active{transform:scale(.96)}
  .del-menu-btn{width:28px;height:28px;border-radius:8px;border:1px solid #4a2020;color:var(--red);background:rgba(201,64,64,0.08);font-size:16px;line-height:1}
  .item-price.editable{display:inline-flex;align-items:center;gap:4px;color:var(--gold)}
  .cook-summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;padding:14px 16px}
  .cook-summary-grid .cook-item{min-height:76px}
  .analysis-panel{background:linear-gradient(145deg,var(--surface2),var(--surface));border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.28)}
  .analysis-head{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;background:linear-gradient(135deg,rgba(95,169,124,.08),rgba(212,168,83,.05))}
  .analysis-title{font-family:'Playfair Display',serif;font-size:20px;color:var(--gold)}
  .analysis-action{background:rgba(95,169,124,.12);border:1px solid rgba(95,169,124,.35);color:#8ee0ad;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif}
  .analysis-body{padding:14px 18px;display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
  .analysis-card{background:rgba(255,255,255,.025);border:1px solid var(--border);border-radius:12px;padding:13px}
  .analysis-kicker{font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:1.3px;margin-bottom:7px}
  .analysis-list{display:flex;flex-direction:column;gap:8px}
  .analysis-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted2)}
  .analysis-row strong{color:var(--text);font-weight:600}
  .analysis-row span:last-child{color:var(--gold);white-space:nowrap}
  .analysis-note{font-size:12px;color:var(--muted2);line-height:1.45}
  .analysis-note b{color:var(--text)}
  .analysis-ai{grid-column:1/-1;border-top:1px solid var(--border);padding-top:12px;font-size:12px;color:var(--muted2);line-height:1.5;white-space:pre-wrap}
  @media(max-width:800px){.search-wrap{top:104px}.order-focus-strip{padding:10px 12px;align-items:flex-start;flex-direction:column}.order-focus-chips{width:100%}.menu-grid{grid-template-columns:1fr;padding:12px}.category-slider{padding:10px 12px}.section-div{padding-left:12px;padding-right:12px}.cook-summary-grid{grid-template-columns:1fr;padding:12px}.analysis-body{grid-template-columns:1fr}.analysis-head{align-items:flex-start;flex-direction:column}}
`;document.head.appendChild(s);}
injectCashierUxStyles();
function fmtDate(d){const[y,m,day]=d.split('-');return`${day}/${m}`;}
function fmtDateFull(d){const[y,m,day]=d.split('-');const M=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${parseInt(day)} ${M[m-1]} ${y}`;}
function rp(n){return'Rp '+Math.round(n||0).toLocaleString('id');}
function setSync(s){const dot=document.getElementById('syncDot');if(!dot)return;dot.className='sync-dot'+(s?' '+s:'');const labels={green:'Tersinkron',orange:'Mengirim pesanan',red:'Menunggu koneksi'};dot.title=labels[s]||'Status koneksi';dot.setAttribute('aria-label',labels[s]||'Status koneksi');}
var isSyncingQueue=false;
async function syncOfflineQueue(){
  if(isSyncingQueue)return;
  const q=await readOutbox();
  if(!q.length)return;
  isSyncingQueue=true;
  setSync('orange');
  const updates={};
  const syncedJobs=[];
  const remaining=[];
  const now=Date.now();
  for(const job of q){
    if(job.nextRetryAt&&job.nextRetryAt>now){remaining.push(job);continue;}
    try{
      if(job.type==='kitchen_done'){
        updates[`kitchenHistory/${job.dateKey}/${job.tid}`]=job.donePayload;
        updates[`tableOrders/${job.tid}`]=job.servedPayload||null;
        syncedJobs.push(job);
      }else{
        updates[`orders/${job.dateKey}/${job.finKey}`]=job.fPayload;
        if(job.type==='kasir'){
          updates[`tableOrders/${job.tid}`]=job.tPayload;
        }else if(job.type==='guest_paid'){
          updates[`tableOrders/${job.tid}`]=job.tPayload||{status:'active',manualConfirmedAt:Date.now(),kitchenQueuedAt:Date.now()};
        }
        syncedJobs.push(job);
      }
    }catch(e){remaining.push({...job,attempts:(job.attempts||0)+1,lastError:String(e?.message||e),nextRetryAt:now+Math.min(60000,1000*Math.pow(2,Math.min(6,job.attempts||0)))});}
  }
  if(Object.keys(updates).length>0){
    try{
      await update(ref(db),updates);
      for(const job of syncedJobs){
        if(job.type==='kitchen_done'){
          removeLocalActiveOrder(job.tid);
        }else{
          removeLocalDailyOrder(job.dateKey,job.finKey);
          removeLocalActiveOrder(job.tid);
        }
      }
    }catch(e){
      console.error('Batch sync failed, fallback retry:',e);
      syncedJobs.forEach(j=>remaining.push({...j,attempts:(j.attempts||0)+1,lastError:String(e?.message||e),nextRetryAt:Date.now()+Math.min(60000,1000*Math.pow(2,Math.min(6,j.attempts||0)))}));
    }
  }
  await writeOutbox(remaining);
  if(remaining.length===0)setSync('green');
  else setSync('red');
  isSyncingQueue=false;
}
setInterval(syncOfflineQueue, 10000);
setInterval(()=>{if(role)resetMenuAvailabilityForNewDay();}, 60000);
function getSection(cat,def){return[...def.filter(i=>!menuDeletions?.[i.id]),...Object.values(customMenu).filter(i=>i.cat===cat&&!menuDeletions?.[i.id])].map(i=>({...i,price:prices[i.id]||i.price,outOfStock:!!menuAvailability[i.id]}));}
function getFav(){return getSection('favorites',DEF_FAVORITES);}
function getTambahan(){return getSection('tambahan',DEF_TAMBAHAN);}
function getDrinks(){return getSection('drinks',DEF_DRINKS);}
function getMain(){return getSection('main',DEF_MAIN);}
function getDessert(){return getSection('dessert',DEF_DESSERT);}
function getAll(){return[...getFav(),...getDrinks(),...getMain(),...getDessert(),...getTambahan()];}
function getTanpaNasiQty(data){
const qty=Math.max(0,parseInt(data?.qty||0));
const rawQty=data?.tanpaNasiQty;
const parsed=rawQty===undefined?(data?.tanpaNasi?qty:0):Math.max(0,parseInt(rawQty||0));
return Math.min(qty,parsed);
}
function getDenganNasiQty(data){const qty=Math.max(0,parseInt(data?.qty||0));return Math.max(0,qty-getTanpaNasiQty(data));}
function normalizeOrderEntry(data){
const qty=Math.max(0,parseInt(data?.qty||0));
const note=String(data?.note||'').trim().slice(0,160);
const tanpaNasiQty=getTanpaNasiQty({qty,tanpaNasi:data?.tanpaNasi,tanpaNasiQty:data?.tanpaNasiQty});
return{qty,note,tanpaNasiQty,tanpaNasi:qty>0&&tanpaNasiQty===qty};
}
function calcMenuPrice(item,data){
const entry=normalizeOrderEntry(data);
if(!NASI_IDS.includes(item.id))return item.price;
if(entry.tanpaNasiQty>=entry.qty&&entry.qty>0)return item.price-NASI_PRICE;
return item.price;
}
function calcOrderItemTotal(item,data){
const entry=normalizeOrderEntry(data);
if(!entry.qty)return 0;
if(!NASI_IDS.includes(item.id))return entry.qty*item.price;
return (getDenganNasiQty(entry)*item.price)+(entry.tanpaNasiQty*(item.price-NASI_PRICE));
}
function buildOrderLines(item,data){
const entry=normalizeOrderEntry(data);
if(!entry.qty)return[];
if(!NASI_IDS.includes(item.id)||!entry.tanpaNasiQty||entry.tanpaNasiQty===entry.qty){
const label=NASI_IDS.includes(item.id)&&entry.tanpaNasiQty===entry.qty?`${item.name} (tnp nasi)`:item.name;
return[{name:label,qty:entry.qty,note:entry.note,total:calcOrderItemTotal(item,entry)}];
}
const lines=[];
const denganNasiQty=getDenganNasiQty(entry);
if(denganNasiQty)lines.push({name:item.name,qty:denganNasiQty,note:entry.note,total:denganNasiQty*item.price});
if(entry.tanpaNasiQty)lines.push({name:`${item.name} (tnp nasi)`,qty:entry.tanpaNasiQty,note:entry.note,total:entry.tanpaNasiQty*(item.price-NASI_PRICE)});
return lines;
}
function normalizeGuestItems(cart){const out=[];Object.entries(cart||{}).forEach(([id,data])=>{const entry=normalizeOrderEntry(data);if(!entry.qty)return;out.push({id,qty:entry.qty,note:entry.note,tanpaNasiQty:entry.tanpaNasiQty,tanpaNasi:entry.tanpaNasi});});return out;}
function registerCoreEventListeners(){
  if(window.mulaCoreEventsBound)return false;
  window.mulaCoreEventsBound=true;
async function resolveAuthenticatedRole(user=currentUser){
  if(!user||user.isAnonymous)throw new Error('Sesi staf tidak ditemukan.');
  const token=await user.getIdTokenResult(true);
  const isConfiguredAdmin=String(user.email||'').trim().toLowerCase()==='admin@mula.com';
  return (isConfiguredAdmin||(token.claims&&token.claims.mula_role==='admin'))?'admin':'karyawan';
}
function showLoginError(message){const err=document.getElementById('pwErr');if(err){err.textContent=message;err.style.display='block';}}
function showLoginModal(requestedRole){
  const isAdmin=requestedRole==='admin';staffLoginRole=requestedRole;
  document.querySelector('#pwModal h3').textContent=isAdmin?'Admin Login':'Karyawan Login';
  document.getElementById('emailInput').style.display='block';
  document.getElementById('emailInput').placeholder=isAdmin?'Email admin':'Email karyawan';
  document.getElementById('pwInput').placeholder='Password';
  document.getElementById('pwErr').style.display='none';
  document.getElementById('pwModal').classList.add('show');
  setTimeout(()=>document.getElementById('emailInput').focus(),100);
}
async function enterAuthenticatedStaff(requestedRole){
  const actualRole=await resolveAuthenticatedRole();
  if(requestedRole==='admin'&&actualRole!=='admin'){
    showLoginError('Akun ini karyawan. Silakan masuk melalui tombol Karyawan.');
    return false;
  }
  document.getElementById('pwModal').classList.remove('show');
  enterApp(actualRole);return true;
}
async function handleRestoredStaffSession(user){
  if(staffLoginInProgress||!user||user.isAnonymous)return;
  try{await enterAuthenticatedStaff(null);}catch(error){console.error('Gagal memulihkan peran staf',error);}
}
async function requestStaffLogin(requestedRole){
  staffLoginRole=requestedRole;
  if(typeof authStateReady!=='undefined'&&!currentUser)await Promise.race([authStateReady,new Promise(resolve=>setTimeout(resolve,1200))]);
  if(currentUser&&!currentUser.isAnonymous){try{await enterAuthenticatedStaff(requestedRole);}catch(error){showLoginError('Gagal memeriksa akses akun.');}return;}
  showLoginModal(requestedRole);
}
document.getElementById('adminBtn').addEventListener('click',()=>requestStaffLogin('admin'));
document.getElementById('karyawanBtn').addEventListener('click',()=>requestStaffLogin('karyawan'));document.getElementById('pwSubmit').addEventListener('click',tryLogin);
document.getElementById('pwCancel').addEventListener('click',()=>{document.getElementById('pwModal').classList.remove('show');document.getElementById('pwErr').style.display='none';document.getElementById('pwInput').value='';});
document.getElementById('pwInput').addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin();});
document.getElementById('settingsBtn').addEventListener('click',openSettings);
document.getElementById('logoutBtn').addEventListener('click',async()=>{
  try{if(fbAuth&&currentUser&&!currentUser.isAnonymous)await fbAuth.signOut();}catch(e){console.warn('Logout gagal',e);}
  role=null;
  location.reload();
});
document.getElementById('dateInput').addEventListener('change',e=>{if(!e.target.value)return;curDate=e.target.value;orders={};document.getElementById('dateLabel').textContent=fmtDate(curDate);subOrders();if(typeof renderOrders==='function')renderOrders();if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();});
document.getElementById('closeRMBtn').addEventListener('click',()=>document.getElementById('receiptModal').classList.remove('show'));
document.getElementById('uploadArea').addEventListener('click',()=>document.getElementById('receiptInput').click());
document.getElementById('receiptInput').addEventListener('change',e=>previewReceipt(e.target));
document.getElementById('uploadBtn').addEventListener('click',submitReceipt);
document.getElementById('addItemBtn').addEventListener('click',addItemRow);
document.getElementById('piList').addEventListener('click',e=>{if(e.target.classList.contains('rm-btn')){const rows=document.querySelectorAll('.pi-row');if(rows.length>1)e.target.closest('.pi-row').remove();}});
document.getElementById('addStockBtn').addEventListener('click',addStock);
document.getElementById('stockList').addEventListener('click',e=>{
var id=e.target.dataset.id,a=e.target.dataset.action;if(!id||!a)return;
if(a==='plus')update(ref(db,`stock/${id}`),{jumlah:Math.max(0,(stock[id]?.jumlah||0)+1)});
if(a==='minus')update(ref(db,`stock/${id}`),{jumlah:Math.max(0,(stock[id]?.jumlah||0)-1)});
if(a==='del'&&confirm('Hapus bahan ini?'))remove(ref(db,`stock/${id}`));
});
document.getElementById('receiptsList').addEventListener('click',async e=>{
if(e.target.classList.contains('r-del')||e.target.closest('.r-del')){
  const id=e.target.closest('[data-id]')?.dataset.id;
  if(id&&confirm('Hapus nota ini?')){
    remove(ref(db,`receipts/${id}`)).catch(()=>{});
    remove(ref(db,`receiptsImages/${id}`)).catch(()=>{});
  }
  return;
}
var item=e.target.closest('.receipt-item');if(!item)return;
var id=item.dataset.id;
var meta=receipts[id]||{};
document.getElementById('modalNote').textContent=meta.note||'';
document.getElementById('modalDate').textContent=meta.date?new Date(meta.date).toLocaleString('id'):'';
document.getElementById('modalImg').src=meta.thumb||'';
document.getElementById('receiptModal').classList.add('show');
if(!meta.hasImg)return;
try{
  const imageSnap=await get(ref(db,`receiptsImages/${id}`));
  const imageData=imageSnap?.val();
  let full=typeof imageData==='string'?imageData:(imageData?.img||'');
  if(!full){
    const legacySnap=await get(ref(db,`receipts/${id}`));
    full=legacySnap?.val()?.img||'';
  }
  if(full)document.getElementById('modalImg').src=full;
}catch(e){console.warn('Gagal memuat gambar nota',e);}
});document.querySelectorAll('.tab-btn').forEach(btn=>{btn.addEventListener('click',()=>{
document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
btn.classList.add('active');
document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
if(btn.dataset.tab==='stock'&&!unsubStock){subStock();subReceipts();}
if(btn.dataset.tab==='keuangan'){if(!unsubReceipts)subReceipts();subKitchenHistory();renderKeuangan();}
if(btn.dataset.tab==='rangkuman'){renderRangkuman();}
});});
document.getElementById('addMenuCancel').addEventListener('click',()=>document.getElementById('addMenuModal').classList.remove('show'));
document.getElementById('addRowBtn').addEventListener('click',()=>{const val=document.getElementById('newRowInput').value.trim();if(!val)return;if(!pendingNewRows.includes(val))pendingNewRows.push(val);document.getElementById('newRowInput').value='';const el=document.getElementById('newRowsList');el.innerHTML=pendingNewRows.map((r,i)=>`<div class="new-row-tag">${r}<button data-i="${i}">×</button></div>`).join('');el.querySelectorAll('button').forEach(btn=>{btn.addEventListener('click',()=>{pendingNewRows.splice(parseInt(btn.dataset.i),1);btn.closest('.new-row-tag').remove();});});});
document.getElementById('addMenuSave').addEventListener('click',saveMenu);
document.getElementById('editPriceCancel').addEventListener('click',()=>document.getElementById('editPriceModal').classList.remove('show'));
document.getElementById('editPriceSave').addEventListener('click',savePrice);
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',registerCoreEventListeners);}else{registerCoreEventListeners();}


async function tryLogin(){
  const emailInp=document.getElementById('emailInput');
  const pwInp=document.getElementById('pwInput');
  const btn=document.getElementById('pwSubmit');
  const pw=pwInp?pwInp.value:'';
  if(!pw)return;
  if(btn){btn.textContent='Memeriksa...';btn.disabled=true;}
  document.getElementById('pwErr').style.display='none';
  try{
    if(typeof authPersistenceReady!=='undefined')await authPersistenceReady;
    if(!currentUser||currentUser.isAnonymous){
      const email=emailInp?emailInp.value.trim():'';
      if(!email)throw new Error('Masukkan email.');
      staffLoginInProgress=true;
      await fbAuth.signInWithEmailAndPassword(email,pw);
    }
    if(pwInp)pwInp.value='';
    await enterAuthenticatedStaff(staffLoginRole);
  }catch(error){showLoginError(error.message||'Gagal masuk.');}
  finally{staffLoginInProgress=false;if(btn){btn.textContent='Masuk';btn.disabled=false;}}
}

function enterApp(r){
if(role===r&&document.getElementById('app')?.style.display==='block')return;
role=r;
document.getElementById('lockScreen').style.display='none';
document.getElementById('app').style.display='block';
document.getElementById('roleBadge').textContent=r==='admin'?'Admin':'Karyawan';
document.getElementById('roleBadge').className='role-badge '+r;
document.getElementById('logoutBtn').style.display='block';
document.getElementById('printBtn').style.display='block';document.getElementById('settingsBtn').style.display='block';document.getElementById('manageToggleBtn').style.display='flex';if(r==='admin'){document.getElementById('stockPanel').style.display='block';document.querySelectorAll('.admin-tab').forEach(el=>el.style.display='block');document.querySelectorAll('.admin-only').forEach(el=>el.style.display='flex');}
document.getElementById('dateInput').value=curDate;
document.getElementById('dateLabel').textContent=fmtDate(curDate);
subAll();
}
function scheduleRender(){if(renderScheduled)return;renderScheduled=true;requestAnimationFrame(()=>{renderScheduled=false;renderOrders();});}
async function resetMenuAvailabilityForNewDay(){
  const dateKey=today();
  if(lastMenuAvailabilityResetDate===dateKey)return;
  if(menuAvailabilityResetInFlight)return menuAvailabilityResetInFlight;
  menuAvailabilityResetInFlight=(async()=>{
    try{
      const meta=await get(ref(db,'menuAvailabilityMeta/resetDate'));
      if(String(meta.val()||'')===dateKey){lastMenuAvailabilityResetDate=dateKey;return;}
      const availabilitySnap=await get(ref(db,'menuAvailability'));
      const remoteAvailability=availabilitySnap.val()||{};
      const updates={'menuAvailabilityMeta/resetDate':dateKey};
      Object.keys(remoteAvailability).forEach(id=>{updates['menuAvailability/'+id]=null;});
      await update(ref(db),updates);
      menuAvailability={};
      writeLocalCache('menuAvailability',menuAvailability);
      lastMenuAvailabilityResetDate=dateKey;
      if(typeof scheduleRender==='function')scheduleRender();
    }catch(error){console.warn('Gagal reset menu habis harian',error);}
    finally{menuAvailabilityResetInFlight=null;}
  })();
  return menuAvailabilityResetInFlight;
}
function subAll(){
customReady=false;pricesReady=false;
if(unsubCustom)unsubCustom();if(unsubPrices)unsubPrices();
if(role==='admin'){subOrders();}else{if(unsubOrders){unsubOrders();unsubOrders=null;}dailyOrders={};}
unsubCustom=onValue(ref(db,'customMenu'),s=>{customMenu=s.val()||{};writeLocalCache('customMenu',customMenu);customReady=true;if(pricesReady)scheduleRender();});
unsubPrices=onValue(ref(db,'priceOverrides'),s=>{prices=s.val()||{};writeLocalCache('prices',prices);pricesReady=true;if(customReady)scheduleRender();});
if(unsubCustomComps)unsubCustomComps();
unsubCustomComps=onValue(ref(db,'customMenuComps'),s=>{customMenuComps=s.val()||{};writeLocalCache('customMenuComps',customMenuComps);if(customReady&&pricesReady)scheduleRender();});
if(unsubMenuAvailability)unsubMenuAvailability();
unsubMenuAvailability=onValue(ref(db,'menuAvailability'),s=>{menuAvailability=s.val()||{};writeLocalCache('menuAvailability',menuAvailability);if(customReady&&pricesReady)scheduleRender();});
resetMenuAvailabilityForNewDay();
if(unsubMenuDeletions)unsubMenuDeletions();
unsubMenuDeletions=onValue(ref(db,'menuDeletions'),s=>{menuDeletions=s.val()||{};if(customReady&&pricesReady)scheduleRender();});
if(unsubAllTables)unsubAllTables();
liveTableSlices={active:{},waiting:{},paid:{},pending:{},served:{}};
const tableStatusRef=(status)=>{const r=ref(db,'tableOrders');return typeof DEMO_MODE!=='undefined'&&DEMO_MODE?r:r.orderByChild('status').equalTo(status);};
const refreshTableSlices=()=>{tableOrders=mergedActiveOrders(Object.assign({},liveTableSlices.active,liveTableSlices.waiting,liveTableSlices.paid,liveTableSlices.pending,liveTableSlices.served));notifyWaitingVerification();notifyActiveKitchenOrders();if(tableRenderScheduled)return;tableRenderScheduled=true;requestAnimationFrame(()=>{tableRenderScheduled=false;renderPendingOrders();renderActiveTables();renderPendingPayments();});};
const unsubs=[['active',tableStatusRef('active')],['waiting',tableStatusRef('waiting_verification')],['paid',tableStatusRef('paid')],['pending',tableStatusRef('pending_payment')],['served',tableStatusRef('served')]].map(([name,queryRef])=>onValue(queryRef,s=>{liveTableSlices[name]=s.val()||{};refreshTableSlices();}));
unsubAllTables=()=>unsubs.forEach(unsub=>{try{unsub&&unsub();}catch(e){}});
  if(unsubGuestTableReservations)unsubGuestTableReservations();
  unsubGuestTableReservations=onValue(ref(db,'guestTableReservations'),s=>{
    guestTableReservations=s.val()||{};
    if(typeof renderOrders==='function')scheduleRender();
  });
  if(unsubTableBlocks)unsubTableBlocks();
  unsubTableBlocks=onValue(ref(db,'tableBlocks'),s=>{tableBlocks=s.val()||{};if(typeof renderOrders==='function')scheduleRender();});
onValue(ref(db, '.info/connected'), (snap) => {
  if (snap.val() === true) { setSync('green'); syncOfflineQueue(); } else { setSync('red'); }
});
}
function subOrders(){if(unsubOrders)unsubOrders();unsubOrders=onValue(ref(db,`orders/${curDate}`),s=>{dailyOrders=mergedDailyOrders(curDate,s.val()||{});if(customReady&&pricesReady)scheduleRender();if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();});}
function subStock(){if(unsubStock)unsubStock();unsubStock=onValue(ref(db,'stock'),s=>{stock=s.val()||{};writeLocalCache('stock',stock);renderStock();});}
var receiptRenderScheduled=false;
function scheduleReceiptRefresh(){
  if(receiptRenderScheduled)return;
  receiptRenderScheduled=true;
  const flush=()=>{receiptRenderScheduled=false;renderReceipts();if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(flush);else setTimeout(flush,0);
}
function receiptListEntry(raw){
  const r=raw||{};
  return {note:r.note,items:r.items,total:r.total,date:r.date,by:r.by,thumb:r.thumb||null,hasImg:r.hasImage===true||!!r.img};
}
function subReceipts(){
  if(unsubReceipts)unsubReceipts();
  receipts={};
  scheduleReceiptRefresh();
  const receiptRef=ref(db,'receipts');
  if((typeof DEMO_MODE!=='undefined'&&DEMO_MODE)||typeof receiptRef.on!=='function'){
    unsubReceipts=onValue(receiptRef,s=>{
      receipts={};
      Object.entries(s.val()||{}).forEach(([id,r])=>{receipts[id]=receiptListEntry(r);});
      scheduleReceiptRefresh();
    });
    return;
  }
  const onAdded=s=>{receipts[s.key]=receiptListEntry(s.val());scheduleReceiptRefresh();};
  const onChanged=s=>{receipts[s.key]=receiptListEntry(s.val());scheduleReceiptRefresh();};
  const onRemoved=s=>{delete receipts[s.key];scheduleReceiptRefresh();};
  receiptRef.on('child_added',onAdded);
  receiptRef.on('child_changed',onChanged);
  receiptRef.on('child_removed',onRemoved);
  unsubReceipts=()=>{
    receiptRef.off('child_added',onAdded);
    receiptRef.off('child_changed',onChanged);
    receiptRef.off('child_removed',onRemoved);
  };
}function calcTotal(){let tp=0;getAll().forEach(i=>{tp+=calcOrderItemTotal(i,orders[i.id]);});return tp;}
function subKitchenHistory(){if(unsubKitchenHistory)unsubKitchenHistory();unsubKitchenHistory=onValue(ref(db,`kitchenHistory/${curDate}`),s=>{kitchenHistory=s.val()||{};if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();});}
function openOutboxDb(){
  if(outboxDbPromise)return outboxDbPromise;
  outboxDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(new Error('IndexedDB unavailable'));
    const req=indexedDB.open('mula-outbox',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('jobs',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
  });
  return outboxDbPromise;
}
function outboxRequest(mode,action){return openOutboxDb().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction('jobs',mode),store=tx.objectStore('jobs'),req=action(store);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);}));}
async function readOutbox(){
  try{
    let jobs=await outboxRequest('readonly',store=>store.getAll());
    if(!jobs.length){try{const legacy=JSON.parse(localStorage.getItem('mula_offline_queue')||'[]');if(legacy.length){jobs=legacy.map((j,i)=>({...j,id:j.id||`legacy-${j.finKey||j.tid||i}-${Date.now()}`}));await outboxRequest('readwrite',store=>{jobs.forEach(j=>store.put(j));return store.put({id:'__noop__',legacy:true});});await outboxRequest('readwrite',store=>store.delete('__noop__'));localStorage.removeItem('mula_offline_queue');}}catch(e){}}
    outboxFinKeys=new Set(jobs.map(j=>j.finKey).filter(Boolean));
    return jobs;
  }catch(e){try{return JSON.parse(localStorage.getItem('mula_offline_queue')||'[]');}catch(err){return[];}}
}
async function writeOutbox(jobs){
  outboxFinKeys=new Set(jobs.map(j=>j.finKey).filter(Boolean));
  try{const db=await openOutboxDb();await new Promise((resolve,reject)=>{const tx=db.transaction('jobs','readwrite'),store=tx.objectStore('jobs');store.clear();jobs.forEach(j=>store.put(j));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});localStorage.removeItem('mula_offline_queue');}
  catch(e){if(jobs.length)localStorage.setItem('mula_offline_queue',JSON.stringify(jobs));else localStorage.removeItem('mula_offline_queue');}
}
async function queueOfflineJob(job){
  const full={...job,id:job.id||`${job.type||'order'}-${job.finKey||job.tid||Date.now()}-${Math.random().toString(36).slice(2,7)}`,queuedAt:Date.now(),attempts:0};
  outboxFinKeys.add(full.finKey);
  try{await outboxRequest('readwrite',store=>store.put(full));}
  catch(e){const q=await readOutbox();q.push(full);localStorage.setItem('mula_offline_queue',JSON.stringify(q));}
}
async function removeQueuedOrder(tid,finKey){
  const q=await readOutbox();
  const remaining=q.filter(job=>(!tid||job.tid!==tid)&&(!finKey||job.finKey!==finKey));
  await writeOutbox(remaining);
}
function saveOrders(){ /* Local cart now, pushed on Proses */ }
async function setItemOutOfStock(id,isOut){try{await set(ref(db,`menuAvailability/${id}`),!!isOut);}catch(e){alert('Gagal update status menu: '+e.message);}}
