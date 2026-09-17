// Cashier ordering, admin finance analytics, active table/payment panels
function claimedTableIdsForOrder(orderId){
  return Object.entries(guestTableReservations||{}).filter(([,claim])=>claim&&claim.orderId===orderId&&Number(claim.expiresAt||0)>Date.now()).map(([id])=>String(id));
}
function guestOrderTableIds(orderId,order){
  const claimed=claimedTableIdsForOrder(orderId);
  if(order?.guestUid&&claimed.length)return claimed;
  const ids=[];
  const add=value=>{const id=String(value||'');if(TABLE_IDS.includes(id)&&!ids.includes(id))ids.push(id);};
  (Array.isArray(order?.tableIds)?order.tableIds:[]).forEach(add);
  add(order?.tableId);add(order?.primaryTableId);
  (String(order?.tableLabel||'').match(/\bmeja\s*([1-7]|2[1-8])\b/gi)||[]).forEach(token=>add(token.replace(/^meja\s*/i,'')));
  return ids;
}
function displayOrderLabel(label){return String(label||'').replace(/takeaway\s*\/\s*kasir/ig,'Bungkus').replace(/takeaway|kasir/ig,'Bungkus');}function guestOrderTableLabel(orderId,order){
  const ids=guestOrderTableIds(orderId,order);
  return ids.length===1?`Meja ${ids[0]}`:ids.length?ids.map(id=>`Meja ${id}`).join(' + '):displayOrderLabel(order?.tableLabel||'Pesanan Tamu');
}
function activeReservation(id){return null;}
function manageTableForPhysicalId(id){
  const wanted=String(id),statuses=new Set(['active','pending_payment','waiting_confirmation','waiting_verification','paid','served']);
  return Object.entries(tableOrders||{}).find(([tid,order])=>order&&statuses.has(String(order.status))&&guestOrderTableIds(tid,order).includes(wanted))||null;
}
function manageTableState(id){
  const key=String(id),blocked=tableBlocks?.[key]?.blocked===true;
  const entry=manageTableForPhysicalId(id);
  if(blocked)return{status:'blocked',orderTid:entry?.[0]||null,order:entry?.[1]||null,label:'Buka meja'};
  if(entry){
    const order=entry[1];
    return order.status==='served'?{status:'served',orderTid:entry[0],order,label:'Blokir meja'}:{status:'occupied',orderTid:entry[0],order,label:'Blokir meja'};
  }
  return{status:'free',orderTid:null,order:null,label:'Blokir meja'};
}
function manageFloorMapHTML(floor){
  const first=floor===1;
  const placed=first?[[1,15,24],[2,30,24],[3,45,24],[4,60,24],[5,75,24],[6,60,60],[7,75,60]]:[[22,12,23],[23,25,23],[24,38,23],[25,51,23],[26,64,23],[27,77,23],[21,12,56],[28,77,56]];
  const landmarks=first?'<span class="gv-landmark gv-landmark-wide gv-landmark-kasir" style="left:26%;top:60%;width:34%">Kasir</span><span class="gv-landmark gv-landmark-kaca" style="left:91%;top:28%">Kaca</span><span class="gv-landmark gv-landmark-pintu" style="left:91%;top:61%">Pintu</span><span class="gv-landmark gv-landmark-small gv-landmark-ac" style="left:49%;top:88%">AC</span>':'<span class="gv-landmark gv-landmark-kaca" style="left:91%;top:37%;height:27%">Kaca</span><span class="gv-landmark gv-landmark-wide gv-landmark-tangga" style="left:45%;top:82%;width:40%">Tangga</span><span class="gv-landmark gv-landmark-pintu" style="left:91%;top:78%">Pintu</span><span class="gv-landmark gv-landmark-small gv-landmark-ac" style="left:9%;top:78%">AC</span>';
  const tables=placed.map(([id,left,top])=>{
    const state=manageTableState(id),clickable=true;
    const action=' data-toggle-block-id="'+id+'"';
    const cls=state.status==='blocked'?'is-occupied':state.status==='served'?'is-served':state.status==='reserved'||state.status==='occupied'?'is-occupied':'is-free';
    return '<button type="button" class="gv-map-table manage-map-table '+cls+'" data-table-id="'+id+'"'+action+(clickable?'':' disabled')+' style="left:'+left+'%;top:'+top+'%" aria-label="Meja '+id+': '+state.label+'"><span>Meja</span><strong>'+id+'</strong><em>'+state.label+'</em></button>';
  }).join('');
  return '<div class="gv-floor-map manage-floor-map" data-floor="'+floor+'">'+landmarks+tables+'</div>';
}
function renderManageTableMapHTML(){
  return '<section class="manage-table-map" id="manageTableMap"><div class="manage-table-map-head"><div><div class="manage-table-map-kicker">Mode Kelola</div><div class="manage-table-map-title">Peta Meja</div><div class="manage-table-map-sub">Meja merah sedang diblokir atau masih dipakai. Tekan meja untuk membuka atau memblokir penerimaan pesanan baru.</div></div><div class="manage-table-map-legend"><span><i class="map-dot is-free"></i>Tersedia</span><span><i class="map-dot is-occupied"></i>Dipakai</span><span><i class="map-dot is-served"></i>Disajikan</span></div></div><div class="manage-floor-tabs"><button type="button" class="is-active" data-manage-floor-tab="1">Lantai 1 <small>Meja 1–7</small></button><button type="button" data-manage-floor-tab="2">Lantai 2 <small>Meja 21–28</small></button></div><div class="manage-floor-panel is-active" data-manage-floor-panel="1">'+manageFloorMapHTML(1)+'</div><div class="manage-floor-panel" data-manage-floor-panel="2">'+manageFloorMapHTML(2)+'</div></section>';
}
async function removeTableOrderAndReservations(orderId,order){
  const updates={[`tableOrders/${orderId}`]:null};
  guestOrderTableIds(orderId,order).forEach(id=>{updates[`guestTableReservations/${id}`]=null;});
  return update(ref(db),updates);
}
function clearServedTable(tid){
  const order=tableOrders?.[tid];
  if(!order||order.status!=='served')return;
  if(!confirm('Kosongkan '+guestOrderTableLabel(tid,order)+'? Pastikan pelanggan sudah pergi.'))return;
  removeTableOrderAndReservations(tid,order).then(()=>showToast(guestOrderTableLabel(tid,order)+' sekarang tersedia.')).catch(error=>alert('Gagal mengosongkan meja: '+error.message));
}
async function toggleTableBlock(id){
  const key=String(id),blocked=tableBlocks?.[key]?.blocked===true;
  try{
    await set(ref(db,'tableBlocks/'+key),blocked?null:{blocked:true,updatedAt:Date.now(),updatedBy:currentUser?.uid||''});
    showToast(blocked?'Meja '+key+' dibuka untuk pesanan baru.':'Meja '+key+' diblokir untuk pesanan baru.');
  }catch(error){alert('Gagal mengubah status meja: '+error.message);}
}function clearUnverifiedReservation(id){
  if(!confirm('Kosongkan meja ini?'))return;
  remove(ref(db,`guestTableReservations/${id}`)).then(()=>showToast(`Meja ${id} sekarang tersedia.`)).catch(error=>alert('Gagal mengosongkan meja: '+error.message));
}
function bindManageTableMap(){
  const map=document.getElementById('manageTableMap');if(!map)return;
  map.querySelectorAll('[data-manage-floor-tab]').forEach(tab=>tab.addEventListener('click',()=>{map.querySelectorAll('[data-manage-floor-tab]').forEach(x=>x.classList.remove('is-active'));map.querySelectorAll('[data-manage-floor-panel]').forEach(x=>x.classList.remove('is-active'));tab.classList.add('is-active');map.querySelector('[data-manage-floor-panel="'+tab.dataset.manageFloorTab+'"]').classList.add('is-active');}));
  map.querySelectorAll('[data-toggle-block-id]').forEach(btn=>{const toggle=()=>{const now=Date.now(),previous=Number(btn.dataset.lastTap||0);if(now-previous<450)return;btn.dataset.lastTap=String(now);toggleTableBlock(btn.dataset.toggleBlockId);};btn.addEventListener('click',toggle);btn.addEventListener('pointerup',event=>{if((event.pointerType==='touch'||event.pointerType==='pen')&&!btn.disabled){event.preventDefault();toggle();}},{passive:false});});
  map.querySelectorAll('[data-clear-reservation-id]').forEach(btn=>btn.addEventListener('click',()=>clearUnverifiedReservation(btn.dataset.clearReservationId)));
}function getDashboardMenuMap(){
  const map=Object.create(null);
  getAll().forEach(item=>{if(item?.id)map[item.id]=item;});
  return map;
}function renderOrders(){
var isAdmin=role==='admin';
document.getElementById('orderPanel').className='panel';
var sections=[
{label:'Mula Favorites',items:getFav(),cat:'favorites'},
{label:'Minuman',items:getDrinks(),cat:'drinks'},
{label:'Main Course',items:getMain(),cat:'main'},
{label:'Cemilan & Dessert',items:getDessert(),cat:'dessert'},
{label:'Tambahan',items:getTambahan(),cat:'tambahan'},
];
var allItems=sections.flatMap(sec=>sec.items.map(i=>({...i,cat:sec.cat,catLabel:sec.label})));
var activeItems=allItems.filter(i=>(orders[i.id]?.qty||0)>0);
var sectionQty={};sections.forEach(sec=>{sectionQty[sec.cat]=sec.items.reduce((sum,i)=>sum+(orders[i.id]?.qty||0),0);});

var manageBtn=document.getElementById('manageToggleBtn');if(manageBtn){manageBtn.classList.toggle('active',isManageMode);manageBtn.textContent=isManageMode?'Selesai Kelola':'Mode Kelola';}
var h='';
if(role&&isManageMode)h+=renderManageTableMapHTML();
if(!isOrderDateToday())h+='<div style="margin:12px 20px;padding:10px 12px;border:1px solid rgba(212,168,83,.35);border-radius:10px;background:rgba(212,168,83,.08);color:var(--gold);font-size:12px">Mode riwayat: pesanan baru hanya dapat dibuat untuk tanggal hari ini.</div>';
if(activeItems.length){
var activeTotal=activeItems.reduce((sum,i)=>sum+calcOrderItemTotal(i,orders[i.id]),0);
h+=`<div class="order-focus-strip"><div class="order-focus-main"><span class="order-focus-label">Order Aktif</span><span class="order-focus-total">${rp(activeTotal)}</span></div><div class="order-focus-chips">${activeItems.slice(0,8).map(i=>`<button class="order-chip" data-id="${i.id}"><strong>x${orders[i.id].qty}</strong>${esc(i.name)}</button>`).join('')}${activeItems.length>8?`<span class="order-chip">+${activeItems.length-8} lain</span>`:''}</div><button class="order-clear-btn" id="clearOrderBtn">Kosongkan</button></div>`;
}
h+='<div class="category-slider">';
sections.forEach(sec=>{
  h+=`<button class="cat-chip" onclick="document.getElementById('sec-${sec.cat}').scrollIntoView({behavior:'smooth',block:'start'})">${sec.label}${sectionQty[sec.cat]?`<span class="cat-chip-count">${sectionQty[sec.cat]}</span>`:''}</button>`;
});
h+='</div>';
sections.forEach(sec=>{
h+=`<div class="section-div menu-section-head" id="sec-${sec.cat}"><span>${sec.label}</span><span class="menu-section-count">${sec.items.length} menu</span>${isAdmin&&isManageMode?`<button class="add-menu-btn" data-cat="${sec.cat}">+ Tambah</button>`:``}</div><div class="menu-grid" data-section="${sec.cat}">`;
sec.items.forEach((i,idx)=>{h+=itemHTML(i,isAdmin,idx);});
h+=`</div>`;
});
document.getElementById('menuList').innerHTML=h;
if(role&&isManageMode)bindManageTableMap();
document.getElementById('clearOrderBtn')?.addEventListener('click',()=>{if(confirm('Kosongkan order aktif?')){orders={};renderOrders();saveOrders();}});
document.getElementById('menuList').querySelectorAll('.order-chip').forEach(btn=>btn.addEventListener('click',()=>document.querySelector(`.menu-item[data-id="${btn.dataset.id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'})));
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
btn.addEventListener('click',async()=>{
if(!confirm('Hapus menu ini? Menu tidak akan tampil lagi untuk kasir maupun pelanggan.'))return;
const id=String(btn.dataset.id||'');if(!id)return;
btn.disabled=true;
try{
  const key=Object.keys(customMenu||{}).find(k=>customMenu[k]?.id===id);
  if(key){await Promise.all([remove(ref(db,'customMenu/'+key)),remove(ref(db,'customMenuComps/'+id))]);}
  else{await set(ref(db,'menuDeletions/'+id),true);}
  showToast('Menu berhasil dihapus.');
}catch(error){alert('Gagal menghapus menu: '+error.message);}finally{btn.disabled=false;}
});
});
}document.getElementById('menuList').querySelectorAll('.availability-btn').forEach(btn=>{
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
if(!requireTodayForOrder())return;
var id=btn.dataset.id,d=parseInt(btn.dataset.d);
if(getAll().find(x=>x.id===id)?.outOfStock)return;
if(!orders[id])orders[id]={qty:0,note:'',tanpaNasiQty:0};
orders[id]=normalizeOrderEntry({...orders[id],qty:Math.max(0,(orders[id].qty||0)+d)});
if(orders[id].qty===0)orders[id]={qty:0,note:'',tanpaNasiQty:0,tanpaNasi:false};
var el=document.getElementById('q_'+id);
if(el){
el.textContent=orders[id].qty;
el.className='qty-display'+(orders[id].qty>0?' active':'');
el.classList.add('bump');
setTimeout(()=>el.classList.remove('bump'),200);
}
var noteWrap=document.getElementById('note-wrap-'+id);
if(noteWrap) noteWrap.style.display=orders[id].qty>0?'block':'none';
renderOrders();saveOrders();
});
});
document.getElementById('menuList').querySelectorAll('.tanpa-nasi-step').forEach(btn=>{
btn.addEventListener('click',()=>{
if(!role)return;
if(!requireTodayForOrder())return;
var id=btn.dataset.id,delta=parseInt(btn.dataset.d||'0');
var cur=normalizeOrderEntry(orders[id]||{qty:0,note:'',tanpaNasiQty:0});
if(!cur.qty)return;
cur.tanpaNasiQty=Math.max(0,Math.min(cur.qty,cur.tanpaNasiQty+delta));
orders[id]=normalizeOrderEntry(cur);
saveOrders();
renderOrders();
});
});
document.getElementById('menuList').querySelectorAll('.note-input').forEach(inp=>{
inp.addEventListener('change',()=>{
if(!role)return;
if(!requireTodayForOrder())return;
orders[inp.dataset.id]=normalizeOrderEntry({...orders[inp.dataset.id],note:inp.value});
saveOrders();
});
});
var activeSearch=document.getElementById('menuSearch')?.value.trim().toLowerCase()||'';if(activeSearch)filterMenu(activeSearch);
renderOrderSummary();
updTotals();
}
function itemHTML(item,isAdmin,idx){
var o=normalizeOrderEntry(orders[item.id]||{qty:0,note:'',tanpaNasiQty:0});
var isNasi=NASI_IDS.includes(item.id);
var tnQty=getTanpaNasiQty(o);
var denganNasiQty=getDenganNasiQty(o);
var out=!!item.outOfStock;
var orderLocked=!isOrderDateToday();
var isCustom=!!Object.values(customMenu).find(cm=>cm.id===item.id);
var delay=`animation-delay:${idx*0.03}s`;
var avgPrice=o.qty?Math.round(calcOrderItemTotal(item,o)/o.qty):item.price;
var nasiBtn=role&&isNasi&&o.qty?`<div class="tanpa-nasi-split"><span class="tanpa-nasi-label">Tanpa Nasi</span><button class="tanpa-nasi-step" data-id="${item.id}" data-d="-1" ${tnQty<=0||orderLocked?'disabled':''}>-</button><span class="tanpa-nasi-count">${tnQty}/${o.qty}</span><button class="tanpa-nasi-step${tnQty?' active':''}" data-id="${item.id}" data-d="1" ${tnQty>=o.qty||orderLocked?'disabled':''}>+</button></div>`:'';
var priceStr=isNasi&&tnQty?`${denganNasiQty?`<span style="display:block;font-size:11px;color:var(--muted2)">${denganNasiQty} nasi · ${rp(item.price)}</span>`:''}<span style="display:block">${rp(avgPrice)}${isAdmin&&isManageMode?' Edit':''}</span>`:rp(item.price)+(isAdmin&&isManageMode?' Edit':'');
var stockBtn=role&&isManageMode?`<button class="availability-btn ${out?' active':''}" data-id="${item.id}" data-next="${out?0:1}" style="background:${out?'#8f2f2f':'rgba(241,212,138,0.12)'};color:${out?'#fff':'var(--gold)'}">${out?'Tersedia':'Tandai Habis'}</button>`:'';
var controls=role
? `<div class="item-controls"><button class="qty-btn minus" data-id="${item.id}" data-d="-1" ${orderLocked?'disabled':''}>-</button><div class="qty-display ${o.qty>0?'active':''}" id="q_${item.id}">${o.qty}</div><button class="qty-btn plus" data-id="${item.id}" data-d="1" ${orderLocked?'disabled':''}>+</button>
${isAdmin&&isManageMode?`<button class="del-menu-btn" data-id="${item.id}" title="Hapus menu">×</button>`:''}
</div>`
: o.qty>0?`<div class="qty-display active" style="border-radius:8px">${o.qty}</div>`:'';
return`<div class="menu-item${out?' readonly':''}${o.qty>0?' selected':''}" data-id="${item.id}" data-name="${esc(item.name).toLowerCase()}" style="${delay}${out?';opacity:0.72':''}"><div class="item-price-wrap"><div class="item-title-row"><div><div class="item-name">${esc(item.name)}${out?` <span style="font-size:10px;color:#ff8e8e;font-family:Outfit,sans-serif;letter-spacing:1px">HABIS</span>`:''}</div><div class="item-price${isAdmin&&isManageMode?' editable':''}" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">${priceStr}
</div>${nasiBtn}</div><div class="item-admin-actions">${stockBtn}</div></div></div>
${controls}
${role?`<div class="item-note" id="note-wrap-${item.id}" style="display:${o.qty>0?'block':'none'}"><input class="note-input" type="text" data-id="${item.id}" placeholder="Catatan..." value="${(o.note||'').replace(/"/g,'&quot;')}" ${orderLocked?'disabled':''}></div>`:''}
</div>`;
}
function getCookOrders(){const menuById=getDashboardMenuMap(),agg={};Object.entries(tableOrders).forEach(([tid,t])=>{if(t.status!=='active')return;const comp=t.completedItems||{};Object.entries(t.items||{}).forEach(([id,data])=>{const menu=menuById[id];if(!menu)return;buildOrderLines(menu,data).forEach((l,idx)=>{const key=`${id}_${idx}`;if(comp[key])return;if(!agg[id])agg[id]={qty:0,tanpaNasiQty:0};if(l.name.includes('(tnp nasi)'))agg[id].tanpaNasiQty+=l.qty;else agg[id].qty+=l.qty;});});});Object.entries(orders).forEach(([id,data])=>{const entry=normalizeOrderEntry(data);if(!agg[id])agg[id]={qty:0,tanpaNasiQty:0};agg[id].qty+=entry.qty;agg[id].tanpaNasiQty+=entry.tanpaNasiQty;});return agg;}
function getDailyOrderSummary(){const menuById=getDashboardMenuMap(),agg={};function add(id,data){const qty=Math.max(0,parseInt(data?.qty||0));if(!qty)return;const m=menuById[id],price=m?calcMenuPrice(m,data):0;if(!agg[id])agg[id]={id,name:m?.name||id,qty:0,total:0};agg[id].qty+=qty;agg[id].total+=qty*price;}Object.entries(dailyOrders||{}).forEach(([txId,tx])=>{if(!tx||txId==='receipts')return;if(tx.qty!==undefined){add(txId,tx);return;}Object.entries(tx.items||{}).forEach(([id,data])=>add(id,data));});return Object.values(agg).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name));}
function renderOrderSummary(){const el=document.getElementById('cookList');if(!el)return;const menuById=getDashboardMenuMap(),active=getCookOrders();const rows=Object.entries(active).map(([id,data])=>{const menu=menuById[id];return{id,name:menu?.name||id,qty:data.qty||0,tanpaNasiQty:data.tanpaNasiQty||0};}).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name));if(!rows.length){el.innerHTML='<div class="empty-msg">Belum ada order aktif</div>';return;}el.innerHTML=`<div class="cook-summary-grid">${rows.map(r=>`<div class="cook-item"><span class="cook-name">${esc(r.name)}${r.tanpaNasiQty?`<span style="display:block;font-family:Outfit,sans-serif;font-size:11px;color:var(--muted2);font-weight:500;margin-top:3px">${r.tanpaNasiQty} tanpa nasi</span>`:''}</span><span class="cook-qty active">${r.qty}</span></div>`).join('')}</div>`;}
function filterMenu(q){
  const str=(q||'').trim().toLowerCase();
  const menuList=document.getElementById('menuList');if(!menuList)return;
  menuList.querySelectorAll('.menu-grid').forEach(grid=>{
    const cat=grid.dataset.section;
    const secHead=document.getElementById('sec-'+cat);
    let count=0;
    grid.querySelectorAll('.menu-item').forEach(item=>{
      const name=(item.dataset.name||'').toLowerCase();
      const match=!str||name.includes(str);
      item.style.display=match?'':'none';
      if(match)count++;
    });
    if(secHead)secHead.style.display=(!str||count>0)?'':'none';
    grid.style.display=(!str||count>0)?'':'none';
  });
}
function calcC(c){const co=getCookOrders();let t=c.s.reduce((s,x)=>{const qty=co[x.id]?.qty||0;const skipQty=c.id==='nasi_putih'?(co[x.id]?.tanpaNasiQty||0):0;return s+Math.max(0,qty-skipQty)*x.q;},0);Object.entries(customMenuComps).forEach(([mid,mc])=>{if(mc.contribs&&mc.contribs.includes(c.id))t+=co[mid]?.qty||0;});return t;}
function getCustomRows(){const rows={};Object.entries(customMenuComps).forEach(([mid,mc])=>{(mc.newRows||[]).forEach(n=>{if(!rows[n])rows[n]={name:n,menuIds:[]};rows[n].menuIds.push(mid);});});return Object.values(rows);}
function safeId(n){return n.replace(/[^a-zA-Z0-9]/g,'_');}
function updTotals(){
var tq=0,tp=0;
getAll().forEach(i=>{tq+=orders[i.id]?.qty||0;tp+=calcOrderItemTotal(i,orders[i.id]);});
document.getElementById('totalQty').textContent=tq;
document.getElementById('totalPrice').textContent=rp(tp);
var btn=document.getElementById('prosesManualBtn');if(btn)btn.disabled=tq<=0||!isOrderDateToday();
var bar=document.querySelector('.total-bar');if(bar)bar.style.display=tq>0?'flex':'none';
}
function openAddMenu(){document.getElementById('menuName').value='';document.getElementById('menuPrice').value='';document.getElementById('menuErr').style.display='none';pendingNewRows=[];document.getElementById('newRowsList').innerHTML='';document.getElementById('newRowInput').value='';document.getElementById('compChecklist').innerHTML=COMPS.map(comp=>`<label><input type="checkbox" value="${comp.id}"> ${comp.name}</label>`).join('');document.getElementById('addMenuModal').classList.add('show');setTimeout(()=>document.getElementById('menuName').focus(),100);}
function saveMenu(){const name=document.getElementById('menuName').value.trim(),price=parseInt(document.getElementById('menuPrice').value),cat=document.getElementById('menuCat').value;if(!name||!price){document.getElementById('menuErr').style.display='block';return;}const mid='cust_'+Date.now();const contribs=[...document.getElementById('compChecklist').querySelectorAll('input:checked')].map(el=>el.value);if(contribs.length||pendingNewRows.length){set(ref(db,'customMenuComps/'+mid),{contribs,newRows:[...pendingNewRows]});}push(ref(db,'customMenu'),{id:mid,name,price,cat});document.getElementById('addMenuModal').classList.remove('show');}
function savePrice(){const p=parseInt(document.getElementById('editPriceVal').value);if(!p||!editPriceId)return;update(ref(db,'priceOverrides'),{[editPriceId]:p});document.getElementById('editPriceModal').classList.remove('show');}
function renderStock(){
var el=document.getElementById('stockList');if(!el)return;
var entries=Object.entries(stock);
if(!entries.length){el.innerHTML='<div class="empty-msg">Belum ada bahan</div>';return;}
el.innerHTML=entries.map(([id,it])=>`
<div class="stock-item"><div><div class="stock-name">${esc(it.name)}</div><div class="stock-meta">${it.jumlah||0} ${esc(it.satuan||'')}</div></div><div class="stock-num ${(it.jumlah||0)<=2?'low':'ok'}">${it.jumlah||0}<span style="font-size:11px;font-family:'Outfit';margin-left:4px;opacity:0.7">${it.satuan||''}</span></div><div class="s-controls"><button class="s-btn" data-id="${id}" data-action="minus">-</button><button class="s-btn" data-id="${id}" data-action="plus">+</button></div><button class="s-btn s-del" data-id="${id}" data-action="del">Hapus</button></div>`).join('');
}
function addStock(){const n=document.getElementById('newName').value.trim(),q=parseInt(document.getElementById('newJumlah').value)||0,s=document.getElementById('newSatuan').value.trim();if(!n)return;push(ref(db,'stock'),{name:n,jumlah:q,satuan:s});['newName','newJumlah','newSatuan'].forEach(id=>document.getElementById(id).value='');}
function previewReceipt(inp){selFile=inp.files[0];if(!selFile)return;const r=new FileReader();r.onload=e=>{document.getElementById('previewImg').src=e.target.result;document.getElementById('previewWrap').style.display='block';document.getElementById('uploadArea').style.display='none';document.getElementById('uploadBtn').disabled=false;};r.readAsDataURL(selFile);}
function addItemRow(){const row=document.createElement('div');row.className='pi-row';row.innerHTML=`<input type="text" class="pi-name" placeholder="Nama barang..."><input type="text" class="pi-price" placeholder="Harga (Rp)"><button class="rm-btn">x</button>`;document.getElementById('piList').appendChild(row);}
function compress(file,maxW,q){return new Promise(res=>{const img=new Image(),r=new FileReader();r.onload=e=>{img.onload=()=>{const sc=Math.min(1,maxW/img.width),w=img.width*sc,h=img.height*sc,c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);res(c.toDataURL('image/jpeg',q));};img.src=e.target.result;};r.readAsDataURL(file);});}
async function submitReceipt(){
  if(!selFile)return;
  const btn=document.getElementById('uploadBtn');btn.disabled=true;btn.textContent='Menyimpan...';
  try{
    const note=document.getElementById('receiptNote').value||'Nota';
    const items=[];
    document.querySelectorAll('.pi-row').forEach(row=>{const n=row.querySelector('.pi-name').value.trim(),p=row.querySelector('.pi-price').value.trim();if(n)items.push({name:n,price:p});});
    const total=items.reduce((s,i)=>s+parseInt((i.price||'').replace(/\D/g,'')||0),0);
    const thumb=await compress(selFile,150,0.4);
    const img=await compress(selFile,600,0.5);
    const receiptRef=push(ref(db,'receipts'));const receiptId=receiptRef.key;
    if(!receiptId)throw new Error('ID nota tidak tersedia');
    const date=new Date().toISOString();
    const updates={};
    updates[`receipts/${receiptId}`]={thumb,note,items,total,date,by:role,hasImage:true};
    updates[`receiptsImages/${receiptId}`]={img};
    await update(ref(db,''),updates);
    document.getElementById('receiptNote').value='';document.getElementById('previewImg').src='';document.getElementById('previewWrap').style.display='none';document.getElementById('uploadArea').style.display='block';document.getElementById('receiptInput').value='';
    document.querySelectorAll('.pi-row').forEach((r,i)=>{if(i>0)r.remove();else{r.querySelector('.pi-name').value='';r.querySelector('.pi-price').value='';}});
    selFile=null;btn.textContent='Simpan Nota';btn.disabled=false;
  }catch(e){alert('Gagal: '+e.message);btn.textContent='Simpan Nota';btn.disabled=false;}
}function renderReceipts(){const el=document.getElementById('receiptsList');const entries=Object.entries(receipts).sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||''));if(!entries.length){el.innerHTML='<div class="empty-msg">Belum ada nota</div>';return;}el.innerHTML=entries.map(([id,r])=>{const chips=r.items?.length?`<div class="r-chips">${r.items.map(i=>`<span class="r-chip">${esc(i.name)}${i.price?'  -  Rp'+esc(i.price):''}</span>`).join('')}</div>`:'';const del=role==='admin' && isManageMode ?`<button class="r-del" data-id="${id}">Hapus</button>`:'';const thumbSrc=r.thumb||'';return`<div class="receipt-item" data-id="${id}"><img class="r-thumb" src="${thumbSrc}" alt="" loading="lazy"><div style="flex:1;min-width:0"><div class="r-note">${esc(r.note||'')}</div>${chips}<div class="r-date">${r.date?new Date(r.date).toLocaleString('id'):''}  -  ${esc(r.by||'')}</div></div>${del}</div>`;}).join('');}
function ensureAnalysisPanel(){const wrap=document.querySelector('#tab-keuangan .page-wrap');if(!wrap||document.getElementById('analysisPanel'))return;const keuGrid=wrap.querySelector('.keu-grid');const div=document.createElement('div');div.id='analysisPanel';div.className='analysis-panel';div.innerHTML=`<div class="analysis-head"><div><div class="analysis-title">Analisis Operasional</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">Ringkasan dari transaksi dan nota hari ini</div></div></div><div class="analysis-body" id="analysisBody"><div class="empty-msg">Belum ada data analisis</div></div>`;keuGrid?keuGrid.insertAdjacentElement('afterend',div):wrap.prepend(div);}
function buildLocalAnalysis(orderRows,pemasukan,pengeluaran,profit,menuById){const lookup=menuById||getDashboardMenuMap(),itemMap={};let itemQty=0,dine=0,take=0,cash=0,qris=0,other=0,lastOrder=0;Object.entries(dailyOrders||{}).forEach(([txId,tx])=>{if(tx.qty!==undefined){const m=lookup[txId];if(!m)return;const q=tx.qty||0;const sub=orderRows.find(r=>r.id===txId)?.total||0;itemMap[txId]={name:m.name,qty:q,total:sub};itemQty+=q;return;}const lbl=(tx.tableLabel||'').toLowerCase();if(lbl.includes('takeaway')||lbl.includes('kasir'))take++;else dine++;const pm=tx.paymentMethod||'';if(pm==='Tunai')cash+=tx.total||0;else if(pm==='QRIS')qris+=tx.total||0;else other+=tx.total||0;lastOrder=Math.max(lastOrder,tx.time||0);Object.entries(tx.items||{}).forEach(([id,data])=>{const m=lookup[id];const entry=normalizeOrderEntry(data);if(!entry.qty||!m)return;if(!itemMap[id])itemMap[id]={name:m.name,qty:0,total:0};itemMap[id].qty+=entry.qty;itemMap[id].total+=calcOrderItemTotal(m,entry);itemQty+=entry.qty;});});const avg=orderRows.length?pemasukan/orderRows.length:0,margin=pemasukan?profit/pemasukan:0;const topItems=Object.values(itemMap).sort((a,b)=>b.qty-a.qty||b.total-a.total).slice(0,5);const notes=[];if(!orderRows.length)notes.push('Belum ada transaksi untuk dianalisis.');else{notes.push(`Ada <b>${orderRows.length}</b> transaksi dengan rata-rata basket <b>${rp(avg)}</b>.`);if(profit<0)notes.push('Profit negatif hari ini karena pengeluaran lebih besar dari pemasukan.');else if(margin<0.25)notes.push(`Margin masih tipis (${Math.round(margin*100)}%). Cek nota belanja atau harga item populer.`);else notes.push(`Margin sementara sehat di sekitar ${Math.round(margin*100)}%.`);if(topItems[0])notes.push(`Menu terkuat saat ini: <b>${esc(topItems[0].name)}</b> (${topItems[0].qty} porsi).`);if(lastOrder&&Date.now()-lastOrder>90*60*1000)notes.push('Belum ada order baru lebih dari 90 menit; cocok untuk dorong menu minuman/cemilan.');if(qris>cash)notes.push('QRIS lebih dominan dari tunai hari ini; pastikan rekonsiliasi pembayaran cocok dengan kas.');}return{topItems,metrics:{avg,itemQty,dine,take,cash,qris,other,margin},notes};}
function renderAdminAnalysis(orderRows,pemasukan,pengeluaran,profit,menuById){ensureAnalysisPanel();const body=document.getElementById('analysisBody');if(!body)return;const a=buildLocalAnalysis(orderRows,pemasukan,pengeluaran,profit,menuById);const groqEl=document.getElementById('groqResult');const html=`<div class="analysis-card"><div class="analysis-kicker">Menu Terlaris</div><div class="analysis-list">${a.topItems.length?a.topItems.map(i=>`<div class="analysis-row"><strong>${esc(i.name)}</strong><span>${i.qty} porsi  -  ${rp(i.total)}</span></div>`).join(''):'<div class="analysis-note">Belum ada item terjual.</div>'}</div></div><div class="analysis-card"><div class="analysis-kicker">Statistik</div><div class="analysis-list"><div class="analysis-row"><strong>Rata-rata transaksi</strong><span>${rp(a.metrics.avg)}</span></div><div class="analysis-row"><strong>Total item</strong><span>${a.metrics.itemQty} porsi</span></div><div class="analysis-row"><strong>Dine-in / Bungkus</strong><span>${a.metrics.dine} / ${a.metrics.take}</span></div><div class="analysis-row"><strong>Tunai / QRIS</strong><span>${rp(a.metrics.cash)} / ${rp(a.metrics.qris)}</span></div></div></div><div class="analysis-ai" id="analysisAiText">${a.notes.map(n=>`- ${n}`).join('<br>')}</div>`;body.innerHTML=html;if(groqEl)body.appendChild(groqEl);if(typeof ensureGroqBtn==='function')ensureGroqBtn();}
function renderKeuangan(){
var menuById=getDashboardMenuMap();if(typeof syncAnalyticsTodayCache==='function')syncAnalyticsTodayCache();let pemasukan=0;const orderRows=[];
Object.entries(dailyOrders).forEach(([txId,tx])=>{
  if(tx.qty!==undefined){
    const m=menuById[txId];if(!m)return;
    const entry=normalizeOrderEntry(tx);
    const sub=calcOrderItemTotal(m,entry);pemasukan+=sub;
    orderRows.push({id:txId,time:0,tableLabel:'Migrated Item',total:sub,itemStr:buildOrderLines(m,entry).map(line=>`${line.name} x${line.qty}`).join(', '),isLegacy:true});
    return;
  }
  pemasukan+=(tx.total||0);
  const itemStrs=[];
  Object.entries(tx.items||{}).forEach(([iid,idata])=>{
    const m=menuById[iid];
    if(m)buildOrderLines(m,idata).forEach(line=>itemStrs.push(`${line.name} x${line.qty}`));
  });
  orderRows.push({id:txId,time:tx.time||0,tableLabel:tx.tableLabel||'Transaksi',customerName:tx.customerName||'',total:tx.total||0,itemStr:itemStrs.join(', '),paymentMethod:tx.paymentMethod||''});
});
orderRows.sort((a,b)=>b.time-a.time);

var pengeluaran=0;const notaRows=[];
Object.entries(receipts).forEach(([rid,r])=>{
  if(r.date?.slice(0,10)===curDate){
    const itemsArr = Array.isArray(r.items) ? r.items : (r.items ? Object.values(r.items) : []);
    const t=r.total||itemsArr.reduce((s,i)=>s+parseInt((i.price||'').replace(/\D/g,'')||0),0)||0;
    pengeluaran+=t;
    notaRows.push({note:r.note||'Nota',t});
  }
});

var profit=pemasukan-pengeluaran;
document.getElementById('keuIn').textContent=rp(pemasukan);
document.getElementById('keuOut').textContent=rp(pengeluaran);
var pe=document.getElementById('keuProfit');pe.textContent=rp(profit);pe.className='keu-val '+(profit>=0?'gold':'red');
document.getElementById('keuCount').textContent=orderRows.length+' transaksi';
renderAdminAnalysis(orderRows,pemasukan,pengeluaran,profit,menuById);

var od=document.getElementById('keuOrders');
if(orderRows.length){
  od.innerHTML=orderRows.map(o=>{
    const isTakeaway=o.tableLabel&&(o.tableLabel.toLowerCase().includes('takeaway')||o.tableLabel.toLowerCase().includes('kasir'));
    const typeBadge=isTakeaway
      ?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--surface3);color:var(--muted2);border:1px solid var(--border2);letter-spacing:0.5px">Bungkus</span>`
      :`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(212,168,83,0.12);color:var(--gold);border:1px solid var(--gold-dim);letter-spacing:0.5px">Dine-in</span>`;
    const PM_COLORS={Tunai:'#5fa97c',QRIS:'#6ab0f5',Dana:'#2b6cb0',GoPay:'#276749',Transfer:'#9f7aea'};
    const pm=o.paymentMethod||'';
    const pmBadge=pm?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${PM_COLORS[pm]||'#555'}22;color:${PM_COLORS[pm]||'#aaa'};border:1px solid ${PM_COLORS[pm]||'#555'}55;letter-spacing:0.5px">${pm}</span>`:'';
    return`<div class="keu-row" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          ${typeBadge}
          ${pmBadge}
          <span style="font-weight:700;color:var(--text);font-size:13px">${esc(displayOrderLabel(o.tableLabel))}</span>${o.customerName?`<span style="font-size:11px;color:var(--muted2)">${esc(o.customerName)}</span>`:''}
          ${o.time?`<span style="font-size:10px;color:var(--muted)">${new Date(o.time).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'})}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <button class="keu-print-btn" data-id="${o.id}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:4px 8px;border-radius:12px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:11px">Print</button>
          ${role==='admin' && isManageMode ?`<button class="edit-pm-btn" data-id="${o.id}" data-pm="${pm}" title="Ubah metode bayar" style="background:none;border:1px solid var(--border2);color:var(--muted2);cursor:pointer;font-size:11px;padding:2px 8px;border-radius:12px;font-family:Outfit,sans-serif">Edit ${pm||'?'}</button>`:''}
          <span class="keu-row-val" style="font-size:14px;color:var(--green)">${rp(o.total)}</span>
          
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted2);line-height:1.4">${esc(o.itemStr)}</div>
      ${role==='admin' && isManageMode ?`<button class="del-tx-btn keu-delete-wide" data-id="${o.id}" style="width:100%;min-height:38px;background:rgba(201,64,64,.12);border:1px solid #5a2424;color:#ff8e8e;cursor:pointer;font-size:12px;padding:8px 10px;border-radius:10px;font-family:Outfit,sans-serif;font-weight:800;text-align:center">Hapus Transaksi Ini</button>`:''}
    </div>`;
  }).join('')+`<div class="keu-row keu-footer" style="padding:16px 12px;margin-top:8px"><span>Total Pemasukan</span><span class="keu-row-val" style="color:var(--green)">${rp(pemasukan)}</span></div>`;
  
  od.querySelectorAll('.keu-print-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const id=btn.dataset.id;
        const t=dailyOrders[id];if(!t)return;
        btn.textContent='Printing...';
        try{await autoPrint(t.items||{},t.total||0,displayOrderLabel(t.tableLabel||'Kasir'),t.cashGiven||0,t.change||0, t.customerName||'');}catch(e){alert('Print gagal: '+e.message);}
        btn.textContent='Print';
      });
    });
  if(role==='admin'){
    const METHODS=['Tunai','QRIS','Dana','GoPay','Transfer',''];
    od.querySelectorAll('.edit-pm-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const txId=btn.dataset.id;
        const cur=btn.dataset.pm||'';
        const idx=METHODS.indexOf(cur);
        const next=METHODS[(idx+1)%METHODS.length];
        if(dailyOrders[txId]){
          dailyOrders[txId].paymentMethod=next||null;
          if(getLocalDailyOrders(curDate)[txId])setLocalDailyOrder(curDate,txId,dailyOrders[txId]);
          renderKeuangan();
        }
        update(ref(db,`orders/${curDate}/${txId}`),{paymentMethod:next||null}).catch(()=>{});
      });
    });
    od.querySelectorAll('.del-tx-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(confirm('Hapus transaksi order ini secara permanen? Total keuangan akan berkurang secara otomatis.')){
          removeLocalDailyOrder(curDate,btn.dataset.id);
          if(dailyOrders[btn.dataset.id])delete dailyOrders[btn.dataset.id];
          removeQueuedOrder(null,btn.dataset.id);
          remove(ref(db,`orders/${curDate}/${btn.dataset.id}`));
          renderKeuangan();
        }
      });
    });
  }
} else {
  od.innerHTML='<div class="empty-msg">Belum ada order hari ini</div>';
}

var nd=document.getElementById('keuNotas');
nd.innerHTML=notaRows.length?notaRows.map(n=>`<div class="keu-row"><span>${esc(n.note)}</span><span class="keu-row-val" style="color:var(--red)">${rp(n.t)}</span></div>`).join('')+`<div class="keu-row keu-footer"><span>Total</span><span class="keu-row-val" style="color:var(--red)">${rp(pengeluaran)}</span></div>`:'<div class="empty-msg">Belum ada nota hari ini</div>';
}
function renderPendingOrders(){
  const panel=document.getElementById('pendingOrdersPanel');if(!panel)return;
  if(role!=='admin'){panel.innerHTML='';return;}
  const menuById=getDashboardMenuMap();
  const pending=Object.entries(tableOrders).filter(([,t])=>t.status==='waiting_confirmation');
  if(!pending.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#001a1a,#000c0c);border-color:#206a6a"><div class="pending-ph" style="border-bottom-color:#003a3a"><span class="pending-ph-title" style="color:#20c8c8">Pesanan Baru Masuk</span><span class="pending-badge" style="background:rgba(32,200,200,0.2);color:#20c8c8;border-color:#10a0a0">${pending.length}</span></div>${pending.map(([tid,t])=>{
    const itemSummary=Object.entries(t.items||{}).map(([id,data])=>{
      const menu=menuById[id];
      if(!menu)return `${esc(id)} x${data.qty||0}`;
      return buildOrderLines(menu,data).map(line=>`${esc(line.name)} x${line.qty}`).join(', ');
    }).join(', ');
    return `<div class="pending-row" style="border-bottom-color:rgba(0,50,50,0.8)"><div style="flex:1"><div class="pending-tname">${esc(displayOrderLabel(t.tableLabel||'Meja '+tid))}</div><div style="font-size:11px;color:#20a0a0;margin-top:2px">${itemSummary}</div></div><button class="print-lagi-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px;margin-right:8px">Print</button><button class="konfirm-order-btn" data-tid="${tid}" style="background:linear-gradient(135deg,#20a0a0,#106060);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:Outfit,sans-serif">Terima Pesanan</button></div>`;
  }).join('')}</div></div>`;
  panel.querySelectorAll('.konfirm-order-btn').forEach(btn=>{btn.addEventListener('click',()=>konfirmasiPesanan(btn.dataset.tid));});
  panel.querySelectorAll('.print-lagi-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const t=tableOrders[btn.dataset.tid];if(!t)return;
      btn.textContent='Printing...';
      try{await autoPrint(t.items||{},t.total||0,displayOrderLabel(t.tableLabel||'Kasir'),t.cashGiven||0,t.change||0, t.customerName||'');}catch(e){alert('Print gagal: '+e.message);}
      btn.textContent='Print Lagi';
    });
  });
}
async function konfirmasiPesanan(tableId){
  try{await update(ref(db,`tableOrders/${tableId}`),{status:'active'});showToast('Pesanan meja '+tableId+' diterima');}catch(e){alert('Gagal: '+e.message);}
}
function formatKitchenElapsed(ms){ms=Math.max(0,ms||0);const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000);return `${m}:${String(s).padStart(2,'0')}`;}
function getKitchenStart(t){return t.kitchenQueuedAt||t.paidAt||t.createdAt||Date.now();}
function updateKitchenTimers(){document.querySelectorAll('.kitchen-timer[data-start]').forEach(el=>{el.textContent=formatKitchenElapsed(Date.now()-parseInt(el.dataset.start||Date.now()));});}
function ensureKitchenTimerTicker(){if(kitchenTimerInterval)return;kitchenTimerInterval=setInterval(updateKitchenTimers,1000);}
function playKitchenAlert(){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[660,880,1100].forEach((freq,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='triangle';osc.frequency.value=freq;const t=ctx.currentTime+i*0.16;gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,0.24*(typeof kitchenAlertVolume==='number'?kitchenAlertVolume:0.85)),t+0.02);gain.gain.exponentialRampToValueAtTime(0.0001,t+0.14);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+0.16);});if(navigator.vibrate)navigator.vibrate([180,80,180]);}catch(e){}}
function notifyActiveKitchenOrders(){const active=Object.entries(tableOrders).filter(([,t])=>t.status==='active');const payCount=Object.values(tableOrders).filter(t=>t.status==='waiting_verification').length;document.title=active.length?`MULA (${active.length} dapur${payCount?`, ${payCount} bayar`:''})`:(payCount?`MULA (${payCount} bayar)`:'MULA Eatery');active.forEach(([tid,t])=>{const key=`${tid}:${getKitchenStart(t)}`;if(kitchenAlertSeen.has(key))return;kitchenAlertSeen.add(key);if(kitchenSoundEnabled)playKitchenAlert();});}
async function completeKitchenOrder(tid){
  const order=tableOrders[tid];if(!order)return;
  const completedAt=Date.now(),dateKey=order.dateKey||today(),startedAt=getKitchenStart(order),durationMs=Math.max(0,completedAt-startedAt);
  const donePayload={...order,status:'cooked_done',orderId:tid,completedAt,servedAt:completedAt,kitchenCompletedAt:completedAt,kitchenStartedAt:startedAt,durationMs,durationMinutes:Math.round(durationMs/60000)};
  const servedPayload={...order,status:'served',orderId:tid,servedAt:completedAt,kitchenCompletedAt:completedAt,kitchenStartedAt:startedAt,durationMs,durationMinutes:Math.round(durationMs/60000)};
  removeLocalActiveOrder(tid);
  await removeQueuedOrder(tid,null);
  tableOrders[tid]=servedPayload;
  renderActiveTables();
  let synced=false;
  try{
    await update(ref(db),{[`kitchenHistory/${dateKey}/${tid}`]:donePayload,[`tableOrders/${tid}`]:servedPayload});
    synced=true;
  }catch(error){console.error('Kitchen completion sync failed',error);}
  if(!synced)await queueOfflineJob({type:'kitchen_done',dateKey,tid,donePayload,servedPayload});
  showToast(`Order selesai - ${formatKitchenElapsed(durationMs)}. Meja tetap terisi sampai pelanggan pergi.`);
}function renderActiveTables(){
  const panel=document.getElementById('activeTablesPanel');if(!panel)return;
  if(!role){panel.innerHTML='';return;}
  const menuById=getDashboardMenuMap();
  const active=Object.entries(tableOrders).filter(([,t])=>t.status==='active').sort((a,b)=>getKitchenStart(a[1])-getKitchenStart(b[1]));
  if(!active.length){panel.innerHTML=kitchenSoundEnabled?'':`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#151515,#0f0f0f);border-color:#2b2b2b"><div class="pending-row" style="border-bottom:0"><div style="flex:1"><div class="pending-tname">Dapur Standby</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Aktifkan suara sebelum service supaya order baru terdengar di HP dapur.</div></div><button class="enable-kitchen-sound-btn" style="background:var(--gold);color:#000;border:none;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">Aktifkan Suara Dapur</button></div></div></div>`;panel.querySelector('.enable-kitchen-sound-btn')?.addEventListener('click',enableKitchenSound);return;}
  ensureKitchenTimerTicker();
  panel.innerHTML=`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#1a1a1a,#111);border-color:#333"><div class="pending-ph" style="border-bottom-color:#222"><span class="pending-ph-title" style="color:var(--gold)">Meja Aktif</span><span class="pending-badge" style="background:rgba(212,168,83,0.1);color:var(--gold);border-color:var(--gold-dim)">${active.length}</span></div>${active.map(([tid,t])=>{
    const start=getKitchenStart(t);
    const comp=t.completedItems||{};
    const lines=[];
    Object.entries(t.items||{}).forEach(([id,data])=>{
      const menu=menuById[id];
      if(!menu){lines.push({key:`${id}_0`,id,name:id,qty:data.qty||0,note:'',done:!!comp[`${id}_0`]});return;}
      buildOrderLines(menu,data).forEach((l,idx)=>{
        const key=`${id}_${idx}`;
        lines.push({key,id,name:l.name,qty:l.qty,note:l.note||'',done:!!comp[key]});
      });
    });
    const allDone=lines.length>0&&lines.every(l=>l.done);
    const linesHTML=lines.map(l=>`<label class="kitchen-line-item" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;${l.done?'opacity:0.45;text-decoration:line-through;color:var(--muted);':''}"><input type="checkbox" class="kitchen-item-check" data-tid="${tid}" data-key="${l.key}" ${l.done?'checked':''} style="accent-color:var(--gold);width:16px;height:16px;cursor:pointer;"><span style="font-size:13px;font-weight:600;color:var(--text);flex:1;">${esc(l.name)} <strong style="color:var(--gold)">x${l.qty}</strong>${l.note?`<span style="display:block;font-size:11px;color:var(--muted2);font-weight:400">Catatan: ${esc(l.note)}</span>`:''}</span></label>`).join('');
    
    return `<div class="pending-row" style="border-bottom-color:rgba(42,42,42,0.6);flex-direction:column;align-items:stretch;gap:8px;padding:12px 16px"><div style="display:flex;justify-content:space-between;align-items:center"><div class="pending-tname" style="font-size:15px;font-weight:700;color:var(--gold)">${esc(displayOrderLabel(t.tableLabel||'Meja '+tid))}${t.customerName?` <span style="font-size:12px;color:var(--muted2);font-weight:500">· Atas nama: ${esc(t.customerName)}</span>`:''}</div><div style="display:flex;align-items:center;gap:12px"><div class="pending-ttotal" style="font-size:14px">${rp(t.total||0)}</div><div class="kitchen-timer" data-start="${start}" style="font-family:Outfit,sans-serif;font-size:16px;font-weight:800;color:#5fa97c">${formatKitchenElapsed(Date.now()-start)}</div></div></div><div class="kitchen-items-list" style="display:flex;flex-direction:column;gap:2px;background:rgba(0,0,0,0.2);padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05)">${linesHTML}</div><div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:4px">${!kitchenSoundEnabled?`<button class="enable-kitchen-sound-btn" style="background:rgba(95,169,124,.12);color:#8ee0ad;border:1px solid rgba(95,169,124,.35);padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;font-size:11px">Suara</button>`:''}${role==='admin' && isManageMode ?`<button class="cancel-order-btn" data-tid="${tid}" style="background:none;color:var(--red);border:1px solid #4a2020;padding:6px 10px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:11px">Batal</button>`:''}<button class="print-lagi-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:6px 10px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:11px">Print Lagi</button><button class="kitchen-selesai-btn" data-tid="${tid}" style="background:var(--gold);color:#000;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">${allDone?'Selesai Semua':'Simpan / Selesai'}</button></div></div>`;
  }).join('')}</div></div>`;

  panel.querySelectorAll('.enable-kitchen-sound-btn').forEach(btn=>btn.addEventListener('click',enableKitchenSound));
  
  panel.querySelectorAll('.kitchen-item-check').forEach(chk=>{
    chk.addEventListener('change',()=>{
      const tid=chk.dataset.tid;
      const key=chk.dataset.key;
      if(!tableOrders[tid])return;
      if(!tableOrders[tid].completedItems)tableOrders[tid].completedItems={};
      if(chk.checked)tableOrders[tid].completedItems[key]=true;
      else delete tableOrders[tid].completedItems[key];
      update(ref(db,`tableOrders/${tid}/completedItems`),tableOrders[tid].completedItems).catch(()=>{});
      renderActiveTables();
      renderOrderSummary();
    });
  });

  panel.querySelectorAll('.kitchen-selesai-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const tid=btn.dataset.tid;
      const t=tableOrders[tid];
      if(!t)return;
      const comp=t.completedItems||{};
      const lines=[];
      Object.entries(t.items||{}).forEach(([id,data])=>{
        const menu=menuById[id];
        if(!menu){lines.push(`${id}_0`);return;}
        buildOrderLines(menu,data).forEach((l,idx)=>lines.push(`${id}_${idx}`));
      });
      const checkedCount=lines.filter(k=>comp[k]).length;
      if(checkedCount===0 || checkedCount===lines.length){
        if(confirm('Selesaikan seluruh pesanan ini?'))completeKitchenOrder(tid);
      }else{
        showToast(`Pesanan parsial disimpan (${checkedCount}/${lines.length} menu selesai)`);
        renderActiveTables();
        renderOrderSummary();
      }
    });
  });
  
  panel.querySelectorAll('.cancel-order-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('Batalkan pesanan ini? Pesanan akan dihapus dan tidak masuk ke keuangan.'))return;
      const t=tableOrders[btn.dataset.tid];
      if(t?.financeKey)removeLocalDailyOrder(t.dateKey||today(),t.financeKey);
      removeLocalActiveOrder(btn.dataset.tid);
      removeQueuedOrder(btn.dataset.tid,null);
      if(t?.financeKey&&dailyOrders[t.financeKey])delete dailyOrders[t.financeKey];
      if(tableOrders[btn.dataset.tid])delete tableOrders[btn.dataset.tid];
      renderActiveTables();
      renderOrderSummary();
      if(document.getElementById('tab-keuangan').classList.contains('active'))renderKeuangan();
      if(t?.financeKey)remove(ref(db,`orders/${t.dateKey||today()}/${t.financeKey}`));
      removeTableOrderAndReservations(btn.dataset.tid,t).catch(error=>console.error('Cancel table order failed',error));
    });
  });
  
  panel.querySelectorAll('.print-lagi-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const t=tableOrders[btn.dataset.tid];if(!t)return;
      btn.textContent='Printing...';
      try{await autoPrint(t.items||{},t.total||0,displayOrderLabel(t.tableLabel||'Kasir'),t.cashGiven||0,t.change||0, t.customerName||'');}catch(e){alert('Print gagal: '+e.message);}
      btn.textContent='Print Lagi';
    });
  });
}
// ========== CASHIER PAYMENT FLOW ==========
function pendingPaymentKnownTotal(items,map){
  return Object.entries(items||{}).reduce((sum,[id,data])=>{
    const menu=map[id];
    return menu?sum+calcOrderItemTotal(menu,data):sum;
  },0);
}
async function savePendingPaymentItems(tid,nextItems){
  const order=tableOrders[tid];if(!order)return;
  const map=getDashboardMenuMap();
  const oldItems=order.items||{};
  const oldKnown=pendingPaymentKnownTotal(oldItems,map);
  const nextKnown=pendingPaymentKnownTotal(nextItems,map);
  const total=Math.max(0,Number(order.total||0)-oldKnown+nextKnown);
  tableOrders[tid]={...order,items:nextItems,total};
  renderPendingPayments();
  try{
    await update(ref(db,'tableOrders/'+tid),{items:nextItems,total});
    showToast('Pesanan diperbarui.');
  }catch(error){
    tableOrders[tid]={...order,items:oldItems,total:order.total||0};
    renderPendingPayments();
    alert('Gagal memperbarui pesanan: '+error.message);
  }
}
async function adjustPendingPaymentItem(tid,id,delta){
  const order=tableOrders[tid];
  if(!order||!['pending_payment','waiting_verification'].includes(order.status))return;
  const current=normalizeOrderEntry(order.items?.[id]);
  const nextQty=current.qty+Number(delta||0);
  const nextItems={...(order.items||{})};
  if(nextQty<=0)delete nextItems[id];
  else{
    const tanpaNasiQty=current.tanpaNasiQty===current.qty?nextQty:Math.min(current.tanpaNasiQty,nextQty);
    nextItems[id]={qty:nextQty,note:current.note,tanpaNasiQty,tanpaNasi:tanpaNasiQty===nextQty};
  }
  await savePendingPaymentItems(tid,nextItems);
}
async function addPendingPaymentItem(tid,select){
  const id=String(select?.value||'');
  if(!id)return;
  await adjustPendingPaymentItem(tid,id,1);
  if(select)select.value='';
}
function renderPendingPayments(){
  const panel=document.getElementById('pendingPaymentsPanel');if(!panel)return;
  if(!role){panel.innerHTML='';return;}
  const entries=Object.entries(tableOrders).filter(([,order])=>['pending_payment','waiting_verification','paid'].includes(order.status)).sort((a,b)=>(b[1]?.claimedPaidAt||b[1]?.createdAt||0)-(a[1]?.claimedPaidAt||a[1]?.createdAt||0));
  if(!entries.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap"><div class="pending-card"><div class="pending-ph"><span class="pending-ph-title">Pesanan &amp; Pembayaran</span><span class="pending-badge">${entries.filter(([,order])=>['pending_payment','waiting_verification'].includes(order.status)).length}</span></div>${entries.map(([tid,order])=>{
    const isAwaiting=['pending_payment','waiting_verification'].includes(order.status);
    const state=order.status==='paid'?'Sudah dikonfirmasi':order.status==='pending_payment'?'Menunggu pembayaran':order.paymentAtCashier?'Menunggu pembayaran di kasir':'Menunggu bukti transfer via DM';
    const stateColor=order.status==='paid'?'#5fa97c':order.status==='pending_payment'?'#20c8c8':'var(--gold)';
    const confirmAction=isAwaiting?`<button class="konfirm-btn" data-tid="${tid}">Konfirmasi Bayar</button>`:'';
    const cancelAction=isAwaiting?`<button class="cancel-pending-btn" data-tid="${tid}" style="background:none;border:1px solid #6b3935;color:#e59a92;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:'Outfit',sans-serif">Batal</button>`:'';
    const printBtn=`<button class="print-pending-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">Print Lagi</button>`;
    const customer=order.customerName?`<div style="font-size:11px;color:var(--muted2);margin-top:2px">${esc(order.customerName)}</div>`:'';
    const menuMap=getDashboardMenuMap();
    const orderItems=Object.entries(order.items||{}).flatMap(([id,data])=>{
      const menu=menuMap[id];
      const entry=normalizeOrderEntry(data);
      if(!entry.qty)return[];
      const lines=menu?buildOrderLines(menu,data):[{name:id,qty:entry.qty,note:entry.note}];
      return[{id,qty:entry.qty,lines}];
    });
    const itemsHtml=orderItems.length?'<div class="pending-payment-items">'+orderItems.map(item=>{
      const lineHtml=item.lines.map(line=>'<div class="pending-payment-line"><span>x'+line.qty+' '+esc(line.name)+'</span>'+(line.note?'<small>'+esc(line.note)+'</small>':'')+'</div>').join('');
      const controls=isAwaiting?'<div class="pending-payment-controls"><button type="button" class="pending-payment-adjust" data-tid="'+esc(tid)+'" data-item-id="'+esc(item.id)+'" data-delta="-1" aria-label="Kurangi">−</button><b>'+item.qty+'</b><button type="button" class="pending-payment-adjust" data-tid="'+esc(tid)+'" data-item-id="'+esc(item.id)+'" data-delta="1" aria-label="Tambah">+</button></div>':'';
      return'<div class="pending-payment-item"><div class="pending-payment-item-lines">'+lineHtml+'</div>'+controls+'</div>';
    }).join('')+(isAwaiting?'<div class="pending-payment-add"><select class="pending-payment-select" aria-label="Tambah menu"><option value="">Tambah menu...</option>'+Object.values(menuMap).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).map(menu=>'<option value="'+esc(menu.id)+'">'+esc(menu.name)+'</option>').join('')+'</select><button type="button" class="pending-payment-add-btn" data-tid="'+esc(tid)+'">Tambah</button></div>':'')+'</div>':'<div class="pending-payment-items pending-payment-empty">Belum ada menu</div>';
    const claimed=order.claimedPaidAt?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${new Date(order.claimedPaidAt).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'})}</div>`:'';
    return `<div class="pending-row"><div style="flex:1"><div class="pending-tname">${esc(guestOrderTableLabel(tid,order))}</div>${customer}${itemsHtml}${claimed}<div style="font-size:11px;color:${stateColor};margin-top:3px">${state}</div></div><span class="pending-ttotal">${rp(order.total||0)}</span><div style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-shrink:0">${printBtn}${cancelAction}${confirmAction}</div></div>`;
  }).join('')}</div></div>`;
  panel.querySelectorAll('.pending-payment-adjust').forEach(btn=>btn.addEventListener('click',()=>adjustPendingPaymentItem(btn.dataset.tid,btn.dataset.itemId,Number(btn.dataset.delta))));
  panel.querySelectorAll('.pending-payment-add-btn').forEach(btn=>btn.addEventListener('click',()=>{const select=btn.closest('.pending-payment-add')?.querySelector('.pending-payment-select');addPendingPaymentItem(btn.dataset.tid,select);}));
  panel.querySelectorAll('.konfirm-btn').forEach(btn=>btn.addEventListener('click',()=>{const order=tableOrders[btn.dataset.tid];const customer=order?.customerName?` atas nama ${order.customerName}`:'';if(confirm(`Konfirmasi pembayaran ${guestOrderTableLabel(btn.dataset.tid,order)}${customer} sudah benar-benar masuk?`))konfirmasiBayar(btn.dataset.tid);}));
  panel.querySelectorAll('.cancel-pending-btn').forEach(btn=>btn.addEventListener('click',()=>{const order=tableOrders[btn.dataset.tid];if(order&&confirm('Batalkan pesanan ini? Pesanan tidak masuk dapur atau keuangan.'))removeTableOrderAndReservations(btn.dataset.tid,order).catch(error=>alert('Gagal membatalkan pesanan: '+error.message));}));
  panel.querySelectorAll('.print-pending-btn').forEach(btn=>btn.addEventListener('click',async()=>{const order=tableOrders[btn.dataset.tid];if(!order)return;try{await autoPrint(order.items||{},order.total||0,guestOrderTableLabel(btn.dataset.tid,order),0,0,order.customerName||'');}catch(error){alert('Print gagal: '+error.message);}}));
}async function konfirmasiBayar(tableId){
  const tOrder=tableOrders[tableId];if(!tOrder)return;
  const items=tOrder.items||{};const total=tOrder.total||0;const tableLabel=guestOrderTableLabel(tableId,tOrder);const customerName=String(tOrder.customerName||'').trim().slice(0,60);
  const paidAt=Date.now();
  const dateKey=tOrder.dateKey||today();
  
  const finRef=push(ref(db,`orders/${dateKey}`));
  const finKey=finRef.key||finRef.path?.split('/').pop();
  const fPayload={time:Date.now(),createdAt:paidAt,createdBy:currentUser?.uid||'',tableLabel:tableLabel||'Kasir',customerName,total:total||0,items:items||{},paymentMethod:'QRIS'};
  const activePayload={...tOrder,status:'active',paidAt,mergedAt:paidAt,manualConfirmedAt:paidAt,kitchenQueuedAt:paidAt,financeKey:finKey,dateKey,total,items,tableLabel,customerName};
  setLocalDailyOrder(dateKey,finKey,fPayload);
  if(dateKey===curDate)dailyOrders[finKey]=fPayload;
  
  setLocalActiveOrder(tableId,activePayload);
  tableOrders=mergedActiveOrders(tableOrders);
  await queueOfflineJob({type:'guest_paid',finKey,dateKey,tid:tableId,fPayload,tPayload:activePayload});
  const paymentUpdates={};
  paymentUpdates[`orders/${dateKey}/${finKey}`]=fPayload;
  paymentUpdates[`tableOrders/${tableId}`]=activePayload;
  update(ref(db),paymentUpdates).then(()=>removeQueuedOrder(tableId,finKey)).catch(()=>{});
  syncOfflineQueue();
  
  try{await autoPrint(items,total,displayOrderLabel(tableLabel),0,0,customerName);}catch(e){console.error('Print failed:',e);}
  update(ref(db,`tableOrders/${tableId}`),{printedAt:Date.now()}).catch(()=>{});
  renderActiveTables();
}
async function mergeItemsIntoDaily(dateKey,items,total,tableLabel){
  // Legacy function kept for compatibility if needed elsewhere
  const payload={time:Date.now(),tableLabel:tableLabel||'Kasir',total:total||0,items:items||{}};
  await push(ref(db,`orders/${dateKey}`),payload);
}
function notifyWaitingVerification(){const waiting=Object.entries(tableOrders).filter(([,t])=>t.status==='waiting_verification');if(waiting.length)document.title=`MULA (${waiting.length} bayar)`;waiting.forEach(([tid,t])=>{const key=`${tid}:${t.claimedPaidAt||t.createdAt||0}`;if(paymentAlertSeen.has(key))return;paymentAlertSeen.add(key);try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=880;gain.gain.setValueAtTime(0.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,0.22*(typeof kitchenAlertVolume==='number'?kitchenAlertVolume:0.85)),ctx.currentTime+0.01);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.28);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.3);}catch(e){};});}
function nativePrinterOnly(){try{return !!window.MulaPrinter?.nativeOnlyMode?.();}catch(e){return false;}}
function nativePrinterError(){try{return window.MulaPrinter?.lastError?.()||'Printer native gagal';}catch(e){return 'Printer native gagal';}}

function renderRangkuman(){
  const all=getAll();
  // Aggregate qty and revenue per menu item across all transactions today
  const itemMap={};
  Object.values(dailyOrders).forEach(tx=>{
    if(tx.qty!==undefined){
      // Legacy flat format
      const m=all.find(x=>x.id===Object.keys(dailyOrders).find(k=>dailyOrders[k]===tx));
      return;
    }
    Object.entries(tx.items||{}).forEach(([iid,idata])=>{
      const m=all.find(x=>x.id===iid);if(!m)return;
      const lines=buildOrderLines(m,idata);
      lines.forEach(line=>{
        const key=iid+'|'+line.name;
        if(!itemMap[key])itemMap[key]={id:iid,name:line.name,qty:0,revenue:0,price:line.price||m.price||0};
        itemMap[key].qty+=line.qty||0;
        itemMap[key].revenue+=(line.price||m.price||0)*(line.qty||0);
      });
    });
  });

  const items=Object.values(itemMap).sort((a,b)=>b.qty-a.qty);
  const totalQty=items.reduce((s,i)=>s+i.qty,0);
  const totalJenis=items.length;
  const top=items[0];

  const rkTotalQty=document.getElementById('rkTotalQty');
  const rkTotalJenis=document.getElementById('rkTotalJenis');
  const rkTopMenu=document.getElementById('rkTopMenu');
  const rkMenuList=document.getElementById('rkMenuList');
  if(!rkMenuList)return;

  if(rkTotalQty)rkTotalQty.textContent=totalQty+' pcs';
  if(rkTotalJenis)rkTotalJenis.textContent=totalJenis+' menu';
  if(rkTopMenu)rkTopMenu.textContent=top?`${top.name} (${top.qty})`:'-';

  if(!items.length){
    rkMenuList.innerHTML='<div class="empty-msg">Belum ada order hari ini</div>';
    return;
  }

  const maxQty=top?top.qty:1;
  rkMenuList.innerHTML=items.map((item,idx)=>{
    const pct=Math.round((item.qty/maxQty)*100);
    const rankColor=idx===0?'var(--gold)':idx===1?'#aaa':idx===2?'#cd7f32':'var(--muted2)';
    const rankEmoji=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':'';
    return `<div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="font-size:16px;width:24px;text-align:center;flex-shrink:0">${rankEmoji||'<span style="font-size:11px;color:var(--muted2);font-weight:700">#'+(idx+1)+'</span>'}</span>
          <span style="font-weight:600;color:var(--text);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <span style="font-size:18px;font-weight:800;color:${rankColor};font-family:'Playfair Display',serif">${item.qty}</span>
          <span style="font-size:11px;color:var(--muted2)">pcs</span>
          <span style="font-size:13px;font-weight:700;color:var(--green)">${rp(item.revenue)}</span>
        </div>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${rankColor},${rankColor}88);border-radius:99px;transition:width 0.4s ease"></div>
      </div>
    </div>`;
  }).join('');
}
