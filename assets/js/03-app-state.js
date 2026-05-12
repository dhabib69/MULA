// Shared state, auth, tabs, Firebase subscriptions, stock/receipt helpers
var role=null,curDate=today(),orders={},stock={},receipts={},customMenu={},prices={},customMenuComps={},menuAvailability={},pendingNewRows=[],selFile=null,syncT=null,editPriceId=null,isManageMode=false;
var unsubOrders=null,unsubStock=null,unsubReceipts=null,unsubCustom=null,unsubPrices=null,unsubCustomComps=null,unsubMenuAvailability=null;
var curTable=null,tableOrders={},dailyOrders={},unsubTableOrder=null,unsubAllTables=null;
var customReady=false,pricesReady=false,renderScheduled=false;
var paymentAlertSeen=new Set();
var kitchenAlertSeen=new Set(),kitchenTimerInterval=null,kitchenSoundEnabled=localStorage.getItem('mula_kitchen_sound')==='1';
var LOCAL_DAILY_KEY='mula_local_daily_orders';
var LOCAL_ACTIVE_KEY='mula_local_active_orders';
var LOCAL_CACHE_KEYS={customMenu:'mula_cache_customMenu',prices:'mula_cache_prices',customMenuComps:'mula_cache_customMenuComps',menuAvailability:'mula_cache_menuAvailability',stock:'mula_cache_stock'};
function today(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function showToast(msg,dur=2400){let t=document.getElementById('cashierToast');if(!t){t=document.createElement('div');t.id='cashierToast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none';document.body.appendChild(t);}t.textContent=msg;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',dur);}
function enableKitchenSound(){kitchenSoundEnabled=true;localStorage.setItem('mula_kitchen_sound','1');playKitchenAlert();showToast('Suara dapur aktif');renderActiveTables();}
function readJsonStore(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(e){return{};}}
function writeJsonStore(key,val){localStorage.setItem(key,JSON.stringify(val||{}));}
function getLocalDailyOrders(dateKey){return readJsonStore(LOCAL_DAILY_KEY)[dateKey]||{};}
function setLocalDailyOrder(dateKey,finKey,payload){const store=readJsonStore(LOCAL_DAILY_KEY);if(!store[dateKey])store[dateKey]={};store[dateKey][finKey]=payload;writeJsonStore(LOCAL_DAILY_KEY,store);}
function removeLocalDailyOrder(dateKey,finKey){const store=readJsonStore(LOCAL_DAILY_KEY);if(store[dateKey]){delete store[dateKey][finKey];if(!Object.keys(store[dateKey]).length)delete store[dateKey];writeJsonStore(LOCAL_DAILY_KEY,store);}}
function getLocalActiveOrders(){return readJsonStore(LOCAL_ACTIVE_KEY);}
function setLocalActiveOrder(tid,payload){const store=getLocalActiveOrders();store[tid]=payload;writeJsonStore(LOCAL_ACTIVE_KEY,store);}
function removeLocalActiveOrder(tid){const store=getLocalActiveOrders();delete store[tid];writeJsonStore(LOCAL_ACTIVE_KEY,store);}
function mergedDailyOrders(dateKey,remote){return Object.assign({},remote||{},getLocalDailyOrders(dateKey));}
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
function setSync(s){document.getElementById('syncDot').className='sync-dot'+(s?' '+s:'');}
var isSyncingQueue=false;
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
      if(job.type==='kitchen_done'){
        await set(ref(db,`kitchenHistory/${job.dateKey}/${job.tid}`),job.donePayload);
        await remove(ref(db,`tableOrders/${job.tid}`));
        removeLocalActiveOrder(job.tid);
        continue;
      }
      const s=await get(ref(db,`orders/${job.dateKey}/${job.finKey}`));
      if(!s.val()){
         await set(ref(db,`orders/${job.dateKey}/${job.finKey}`),job.fPayload);
      }
      if(job.type==='kasir'){
        await set(ref(db,`tableOrders/${job.tid}`),job.tPayload);
      }else if(job.type==='guest_paid'){
        await set(ref(db,`tableOrders/${job.tid}`),job.tPayload||{status:'active',manualConfirmedAt:Date.now(),kitchenQueuedAt:Date.now()});
      }
      if(job.type==='kasir'){
        removeLocalDailyOrder(job.dateKey,job.finKey);
        removeLocalActiveOrder(job.tid);
      }else if(job.type==='guest_paid'){
        removeLocalDailyOrder(job.dateKey,job.finKey);
        removeLocalActiveOrder(job.tid);
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
document.getElementById('adminBtn').addEventListener('click',()=>{
  if(currentUser && !currentUser.isAnonymous){
    // Already logged in via Firebase — go straight in
    enterApp('admin');
    return;
  }
  document.getElementById('pwModal').classList.add('show');
  setTimeout(()=>document.getElementById('pwInput').focus(),100);
});
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
var id=e.target.dataset.id,a=e.target.dataset.action;if(!id||!a)return;
if(a==='plus')update(ref(db,`stock/${id}`),{jumlah:Math.max(0,(stock[id]?.jumlah||0)+1)});
if(a==='minus')update(ref(db,`stock/${id}`),{jumlah:Math.max(0,(stock[id]?.jumlah||0)-1)});
if(a==='del'&&confirm('Hapus bahan ini?'))remove(ref(db,`stock/${id}`));
});
document.getElementById('receiptsList').addEventListener('click',e=>{
if(e.target.classList.contains('r-del')||e.target.closest('.r-del')){const id=e.target.closest('[data-id]')?.dataset.id;if(id&&confirm('Hapus nota ini?'))remove(ref(db,`receipts/${id}`));return;}
var item=e.target.closest('.receipt-item');if(!item)return;
var id=item.dataset.id;
// Fetch full image on demand only when tapped
get(ref(db,`receipts/${id}`)).then(s=>{
var r=s.val();if(!r)return;
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
}


async function tryLogin(){
  const emailInp=document.getElementById('emailInput');
  const pwInp=document.getElementById('pwInput');
  const btn=document.getElementById('pwSubmit');
  const err=document.getElementById('pwErr');
  const pw=pwInp?pwInp.value:'';
  if(!pw)return;

  // Already logged in via Firebase → just accept password as-is (they already authenticated once)
  if(currentUser&&!currentUser.isAnonymous){
    document.getElementById('pwModal').classList.remove('show');
    if(pwInp)pwInp.value='';
    enterApp('admin');
    return;
  }

  // First time: need Firebase email+password login
  const email=emailInp?emailInp.value.trim():'';
  if(!email){if(err){err.textContent='Masukkan email admin';err.style.display='block';}return;}

  if(btn){btn.textContent='Memeriksa...';btn.disabled=true;}
  if(err)err.style.display='none';

  try{
    await fbAuth.signInWithEmailAndPassword(email,pw);
    document.getElementById('pwModal').classList.remove('show');
    if(pwInp)pwInp.value='';
    enterApp('admin');
  }catch(e){
    if(err){err.textContent='Gagal: '+e.message;err.style.display='block';}
  }finally{
    if(btn){btn.textContent='Masuk';btn.disabled=false;}
  }
}


function enterApp(r){
role=r;
document.getElementById('lockScreen').style.display='none';
document.getElementById('app').style.display='block';
document.getElementById('roleBadge').textContent=r==='admin'?'Admin':'Karyawan';
document.getElementById('roleBadge').className='role-badge '+r;
document.getElementById('logoutBtn').style.display='block';
document.getElementById('printBtn').style.display='block';document.getElementById('manageToggleBtn').style.display='flex';if(r==='admin'){document.getElementById('stockPanel').style.display='block';document.querySelectorAll('.admin-tab').forEach(el=>el.style.display='block');document.querySelectorAll('.admin-only').forEach(el=>el.style.display='flex');}
document.getElementById('dateInput').value=curDate;
document.getElementById('dateLabel').textContent=fmtDate(curDate);
subAll();
}
function scheduleRender(){if(renderScheduled)return;renderScheduled=true;requestAnimationFrame(()=>{renderScheduled=false;renderOrders();});}
function subAll(){
customReady=false;pricesReady=false;
if(unsubCustom)unsubCustom();if(unsubPrices)unsubPrices();
subOrders();
unsubCustom=onValue(ref(db,'customMenu'),s=>{customMenu=s.val()||{};writeLocalCache('customMenu',customMenu);customReady=true;if(pricesReady)scheduleRender();});
unsubPrices=onValue(ref(db,'priceOverrides'),s=>{prices=s.val()||{};writeLocalCache('prices',prices);pricesReady=true;if(customReady)scheduleRender();});
if(unsubCustomComps)unsubCustomComps();
unsubCustomComps=onValue(ref(db,'customMenuComps'),s=>{customMenuComps=s.val()||{};writeLocalCache('customMenuComps',customMenuComps);if(customReady&&pricesReady)scheduleRender();});
if(unsubMenuAvailability)unsubMenuAvailability();
unsubMenuAvailability=onValue(ref(db,'menuAvailability'),s=>{menuAvailability=s.val()||{};writeLocalCache('menuAvailability',menuAvailability);if(customReady&&pricesReady)scheduleRender();});
if(unsubAllTables)unsubAllTables();
unsubAllTables=onValue(ref(db,'tableOrders'),s=>{tableOrders=mergedActiveOrders(s.val()||{});renderPendingOrders();renderActiveTables();renderPendingPayments();notifyWaitingVerification();notifyActiveKitchenOrders();if(customReady&&pricesReady)scheduleRender();});
onValue(ref(db, '.info/connected'), (snap) => {
  if (snap.val() === true) { setSync('green'); syncOfflineQueue(); } else { setSync('red'); }
});
}
function subOrders(){if(unsubOrders)unsubOrders();unsubOrders=onValue(ref(db,`orders/${curDate}`),s=>{dailyOrders=mergedDailyOrders(curDate,s.val()||{});if(customReady&&pricesReady)scheduleRender();if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();});}
function subStock(){if(unsubStock)unsubStock();unsubStock=onValue(ref(db,'stock'),s=>{stock=s.val()||{};writeLocalCache('stock',stock);renderStock();});}
function subReceipts(){
if(unsubReceipts)unsubReceipts();
// Only fetch metadata + thumbnail — not full image
unsubReceipts=onValue(ref(db,'receipts'),s=>{
var raw=s.val()||{};
// Strip full img from memory — only keep thumb + metadata
receipts={};
Object.entries(raw).forEach(([id,r])=>{
receipts[id]={note:r.note,items:r.items,total:r.total,date:r.date,by:r.by,thumb:r.thumb||null,hasImg:!!r.img||!!r.thumb};
});
renderReceipts();
if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();
});
}
function calcTotal(){let tp=0;getAll().forEach(i=>{tp+=calcOrderItemTotal(i,orders[i.id]);});return tp;}
function saveOrders(){ /* Local cart now, pushed on Proses */ }
async function setItemOutOfStock(id,isOut){try{await set(ref(db,`menuAvailability/${id}`),!!isOut);}catch(e){alert('Gagal update status menu: '+e.message);}}
