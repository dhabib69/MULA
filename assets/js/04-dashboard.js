// Cashier ordering, admin finance analytics, active table/payment panels
function renderOrders(){
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
h+=`<div class="section-div menu-section-head" id="sec-${sec.cat}"><span>â€” ${sec.label}</span><span class="menu-section-count">${sec.items.length} menu</span>${isAdmin&&isManageMode?`<button class="add-menu-btn" data-cat="${sec.cat}">+ Tambah</button>`:``}</div><div class="menu-grid" data-section="${sec.cat}">`;
sec.items.forEach((i,idx)=>{h+=itemHTML(i,isAdmin,idx);});
h+=`</div>`;
});
document.getElementById('menuList').innerHTML=h;
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
btn.addEventListener('click',()=>{
if(!confirm('Hapus menu ini?'))return;
var key=Object.keys(customMenu).find(k=>customMenu[k].id===btn.dataset.id);
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
var isCustom=!!Object.values(customMenu).find(cm=>cm.id===item.id);
var delay=`animation-delay:${idx*0.03}s`;
var avgPrice=o.qty?Math.round(calcOrderItemTotal(item,o)/o.qty):item.price;
var nasiBtn=role&&isNasi&&o.qty?`<div class="tanpa-nasi-split"><span class="tanpa-nasi-label">Tanpa Nasi</span><button class="tanpa-nasi-step" data-id="${item.id}" data-d="-1" ${tnQty<=0?'disabled':''}>-</button><span class="tanpa-nasi-count">${tnQty}/${o.qty}</span><button class="tanpa-nasi-step${tnQty?' active':''}" data-id="${item.id}" data-d="1" ${tnQty>=o.qty?'disabled':''}>+</button></div>`:'';
var priceStr=isNasi&&tnQty?`${denganNasiQty?`<span style="display:block;font-size:11px;color:var(--muted2)">${denganNasiQty} nasi · ${rp(item.price)}</span>`:''}<span style="display:block">${rp(avgPrice)}${isAdmin&&isManageMode?' Edit':''}</span>`:rp(item.price)+(isAdmin&&isManageMode?' Edit':'');
var stockBtn=role&&isManageMode?`<button class="availability-btn ${out?' active':''}" data-id="${item.id}" data-next="${out?0:1}" style="background:${out?'#8f2f2f':'rgba(241,212,138,0.12)'};color:${out?'#fff':'var(--gold)'}">${out?'Tersedia':'Tandai Habis'}</button>`:'';
var controls=role
? `<div class="item-controls"><button class="qty-btn minus" data-id="${item.id}" data-d="-1">-</button><div class="qty-display ${o.qty>0?'active':''}" id="q_${item.id}">${o.qty}</div><button class="qty-btn plus" data-id="${item.id}" data-d="1">+</button>
${isAdmin&&isCustom&&isManageMode?`<button class="del-menu-btn" data-id="${item.id}" title="Hapus menu">×</button>`:''}
</div>`
: o.qty>0?`<div class="qty-display active" style="border-radius:8px">${o.qty}</div>`:'';
return`<div class="menu-item${out?' readonly':''}${o.qty>0?' selected':''}" data-id="${item.id}" data-name="${esc(item.name).toLowerCase()}" style="${delay}${out?';opacity:0.72':''}"><div class="item-price-wrap"><div class="item-title-row"><div><div class="item-name">${esc(item.name)}${out?` <span style="font-size:10px;color:#ff8e8e;font-family:Outfit,sans-serif;letter-spacing:1px">HABIS</span>`:''}</div><div class="item-price${isAdmin&&isManageMode?' editable':''}" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">${priceStr}
</div>${nasiBtn}</div><div class="item-admin-actions">${stockBtn}</div></div></div>
${controls}
${role?`<div class="item-note" id="note-wrap-${item.id}" style="display:${o.qty>0?'block':'none'}"><input class="note-input" type="text" data-id="${item.id}" placeholder="Catatan..." value="${(o.note||'').replace(/"/g,'&quot;')}"></div>`:''}
</div>`;
}
function getCookOrders(){const agg={};Object.entries(tableOrders).forEach(([tid,t])=>{if(t.status!=='active')return;Object.entries(t.items||{}).forEach(([id,data])=>{const entry=normalizeOrderEntry(data);if(!agg[id])agg[id]={qty:0,tanpaNasiQty:0};agg[id].qty+=entry.qty;agg[id].tanpaNasiQty+=entry.tanpaNasiQty;});});Object.entries(orders).forEach(([id,data])=>{const entry=normalizeOrderEntry(data);if(!agg[id])agg[id]={qty:0,tanpaNasiQty:0};agg[id].qty+=entry.qty;agg[id].tanpaNasiQty+=entry.tanpaNasiQty;});return agg;}
function getDailyOrderSummary(){const all=getAll(),agg={};function add(id,data){const qty=Math.max(0,parseInt(data?.qty||0));if(!qty)return;const m=all.find(x=>x.id===id),price=m?calcMenuPrice(m,data):0;if(!agg[id])agg[id]={id,name:m?.name||id,qty:0,total:0};agg[id].qty+=qty;agg[id].total+=qty*price;}Object.entries(dailyOrders||{}).forEach(([txId,tx])=>{if(!tx)return;if(tx.qty!==undefined){add(txId,tx);return;}Object.entries(tx.items||{}).forEach(([id,data])=>add(id,data));});return Object.values(agg).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name));}
function renderOrderSummary(){const el=document.getElementById('cookList');if(!el)return;const rows=getDailyOrderSummary();if(!rows.length){el.innerHTML='<div class="empty-msg">Belum ada order hari ini</div>';return;}el.innerHTML=`<div class="cook-summary-grid">${rows.map(r=>`<div class="cook-item"><span class="cook-name">${esc(r.name)}<span style="display:block;font-family:Outfit,sans-serif;font-size:11px;color:var(--muted2);font-weight:500;margin-top:3px">${rp(r.total)}</span></span><span class="cook-qty active">${r.qty}</span></div>`).join('')}</div>`;}
function calcC(c){const co=getCookOrders();let t=c.s.reduce((s,x)=>{const qty=co[x.id]?.qty||0;const skipQty=c.id==='nasi_putih'?(co[x.id]?.tanpaNasiQty||0):0;return s+Math.max(0,qty-skipQty)*x.q;},0);Object.entries(customMenuComps).forEach(([mid,mc])=>{if(mc.contribs&&mc.contribs.includes(c.id))t+=co[mid]?.qty||0;});return t;}
function getCustomRows(){const rows={};Object.entries(customMenuComps).forEach(([mid,mc])=>{(mc.newRows||[]).forEach(n=>{if(!rows[n])rows[n]={name:n,menuIds:[]};rows[n].menuIds.push(mid);});});return Object.values(rows);}
function safeId(n){return n.replace(/[^a-zA-Z0-9]/g,'_');}
function updTotals(){
var tq=0,tp=0;
getAll().forEach(i=>{tq+=orders[i.id]?.qty||0;tp+=calcOrderItemTotal(i,orders[i.id]);});
document.getElementById('totalQty').textContent=tq;
document.getElementById('totalPrice').textContent=rp(tp);
var btn=document.getElementById('prosesManualBtn');if(btn)btn.disabled=tq<=0;
}
function openAddMenu(){document.getElementById('menuName').value='';document.getElementById('menuPrice').value='';document.getElementById('menuErr').style.display='none';pendingNewRows=[];document.getElementById('newRowsList').innerHTML='';document.getElementById('newRowInput').value='';document.getElementById('compChecklist').innerHTML=COMPS.map(comp=>`<label><input type="checkbox" value="${comp.id}"> ${comp.name}</label>`).join('');document.getElementById('addMenuModal').classList.add('show');setTimeout(()=>document.getElementById('menuName').focus(),100);}
function saveMenu(){const name=document.getElementById('menuName').value.trim(),price=parseInt(document.getElementById('menuPrice').value),cat=document.getElementById('menuCat').value;if(!name||!price){document.getElementById('menuErr').style.display='block';return;}const mid='cust_'+Date.now();const contribs=[...document.getElementById('compChecklist').querySelectorAll('input:checked')].map(el=>el.value);if(contribs.length||pendingNewRows.length){set(ref(db,'customMenuComps/'+mid),{contribs,newRows:[...pendingNewRows]});}push(ref(db,'customMenu'),{id:mid,name,price,cat});document.getElementById('addMenuModal').classList.remove('show');}
function savePrice(){const p=parseInt(document.getElementById('editPriceVal').value);if(!p||!editPriceId)return;update(ref(db,'priceOverrides'),{[editPriceId]:p});document.getElementById('editPriceModal').classList.remove('show');}
function renderStock(){
var el=document.getElementById('stockList');if(!el)return;
var entries=Object.entries(stock);
if(!entries.length){el.innerHTML='<div class="empty-msg">Belum ada bahan</div>';return;}
el.innerHTML=entries.map(([id,it])=>`
<div class="stock-item"><div><div class="stock-name">${esc(it.name)}</div><div class="stock-meta">${it.jumlah||0} ${esc(it.satuan||'')}</div></div><div class="stock-num ${(it.jumlah||0)<=2?'low':'ok'}">${it.jumlah||0}<span style="font-size:11px;font-family:'Outfit';margin-left:4px;opacity:0.7">${it.satuan||''}</span></div><div class="s-controls"><button class="s-btn" data-id="${id}" data-action="minus">âˆ’</button><button class="s-btn" data-id="${id}" data-action="plus">+</button></div><button class="s-btn s-del" data-id="${id}" data-action="del">ðŸ—‘</button></div>`).join('');
}
function addStock(){const n=document.getElementById('newName').value.trim(),q=parseInt(document.getElementById('newJumlah').value)||0,s=document.getElementById('newSatuan').value.trim();if(!n)return;push(ref(db,'stock'),{name:n,jumlah:q,satuan:s});['newName','newJumlah','newSatuan'].forEach(id=>document.getElementById(id).value='');}
function previewReceipt(inp){selFile=inp.files[0];if(!selFile)return;const r=new FileReader();r.onload=e=>{document.getElementById('previewImg').src=e.target.result;document.getElementById('previewWrap').style.display='block';document.getElementById('uploadArea').style.display='none';document.getElementById('uploadBtn').disabled=false;};r.readAsDataURL(selFile);}
function addItemRow(){const row=document.createElement('div');row.className='pi-row';row.innerHTML=`<input type="text" class="pi-name" placeholder="Nama barang..."><input type="text" class="pi-price" placeholder="Harga (Rp)"><button class="rm-btn">Ã—</button>`;document.getElementById('piList').appendChild(row);}
function compress(file,maxW,q){return new Promise(res=>{const img=new Image(),r=new FileReader();r.onload=e=>{img.onload=()=>{const sc=Math.min(1,maxW/img.width),w=img.width*sc,h=img.height*sc,c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);res(c.toDataURL('image/jpeg',q));};img.src=e.target.result;};r.readAsDataURL(file);});}
async function submitReceipt(){if(!selFile)return;const btn=document.getElementById('uploadBtn');btn.disabled=true;btn.textContent='Menyimpan...';try{const note=document.getElementById('receiptNote').value||'Nota';const items=[];document.querySelectorAll('.pi-row').forEach(row=>{const n=row.querySelector('.pi-name').value.trim(),p=row.querySelector('.pi-price').value.trim();if(n)items.push({name:n,price:p});});const total=items.reduce((s,i)=>s+parseInt((i.price||'').replace(/\D/g,'')||0),0);const thumb=await compress(selFile,150,0.4);const img=await compress(selFile,600,0.5);await push(ref(db,'receipts'),{img,thumb,note,items,total,date:new Date().toISOString(),by:role});document.getElementById('receiptNote').value='';document.getElementById('previewImg').src='';document.getElementById('previewWrap').style.display='none';document.getElementById('uploadArea').style.display='block';document.getElementById('receiptInput').value='';document.querySelectorAll('.pi-row').forEach((r,i)=>{if(i>0)r.remove();else{r.querySelector('.pi-name').value='';r.querySelector('.pi-price').value='';}});selFile=null;btn.textContent='Simpan Nota';btn.disabled=false;}catch(e){alert('Gagal: '+e.message);btn.textContent='Simpan Nota';btn.disabled=false;}}
function renderReceipts(){const el=document.getElementById('receiptsList');const entries=Object.entries(receipts).sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||''));if(!entries.length){el.innerHTML='<div class="empty-msg">Belum ada nota</div>';return;}el.innerHTML=entries.map(([id,r])=>{const chips=r.items?.length?`<div class="r-chips">${r.items.map(i=>`<span class="r-chip">${esc(i.name)}${i.price?' Â· Rp'+esc(i.price):''}</span>`).join('')}</div>`:'';const del=role==='admin'?`<button class="r-del" data-id="${id}">ðŸ—‘</button>`:'';const thumbSrc=r.thumb||r.img||'';return`<div class="receipt-item" data-id="${id}"><img class="r-thumb" src="${thumbSrc}" alt="" loading="lazy"><div style="flex:1;min-width:0"><div class="r-note">${esc(r.note||'')}</div>${chips}<div class="r-date">${r.date?new Date(r.date).toLocaleString('id'):''} Â· ${esc(r.by||'')}</div></div>${del}</div>`;}).join('');}
function ensureAnalysisPanel(){const wrap=document.querySelector('#tab-keuangan .page-wrap');if(!wrap||document.getElementById('analysisPanel'))return;const keuGrid=wrap.querySelector('.keu-grid');const div=document.createElement('div');div.id='analysisPanel';div.className='analysis-panel';div.innerHTML=`<div class="analysis-head"><div><div class="analysis-title">Analisis Operasional</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">Ringkasan dari transaksi dan nota hari ini</div></div></div><div class="analysis-body" id="analysisBody"><div class="empty-msg">Belum ada data analisis</div></div>`;keuGrid?keuGrid.insertAdjacentElement('afterend',div):wrap.prepend(div);}
function buildLocalAnalysis(orderRows,pemasukan,pengeluaran,profit){const all=getAll(),itemMap={};let itemQty=0,dine=0,take=0,cash=0,qris=0,other=0,lastOrder=0;Object.entries(dailyOrders||{}).forEach(([txId,tx])=>{if(tx.qty!==undefined){const m=all.find(x=>x.id===txId);if(!m)return;const q=tx.qty||0;const sub=orderRows.find(r=>r.id===txId)?.total||0;itemMap[txId]={name:m.name,qty:q,total:sub};itemQty+=q;return;}const lbl=(tx.tableLabel||'').toLowerCase();if(lbl.includes('takeaway')||lbl.includes('kasir'))take++;else dine++;const pm=tx.paymentMethod||'';if(pm==='Tunai')cash+=tx.total||0;else if(pm==='QRIS')qris+=tx.total||0;else other+=tx.total||0;lastOrder=Math.max(lastOrder,tx.time||0);Object.entries(tx.items||{}).forEach(([id,data])=>{const m=all.find(x=>x.id===id);const entry=normalizeOrderEntry(data);if(!entry.qty||!m)return;if(!itemMap[id])itemMap[id]={name:m.name,qty:0,total:0};itemMap[id].qty+=entry.qty;itemMap[id].total+=calcOrderItemTotal(m,entry);itemQty+=entry.qty;});});const avg=orderRows.length?pemasukan/orderRows.length:0,margin=pemasukan?profit/pemasukan:0;const topItems=Object.values(itemMap).sort((a,b)=>b.qty-a.qty||b.total-a.total).slice(0,5);const notes=[];if(!orderRows.length)notes.push('Belum ada transaksi untuk dianalisis.');else{notes.push(`Ada <b>${orderRows.length}</b> transaksi dengan rata-rata basket <b>${rp(avg)}</b>.`);if(profit<0)notes.push('Profit negatif hari ini karena pengeluaran lebih besar dari pemasukan.');else if(margin<0.25)notes.push(`Margin masih tipis (${Math.round(margin*100)}%). Cek nota belanja atau harga item populer.`);else notes.push(`Margin sementara sehat di sekitar ${Math.round(margin*100)}%.`);if(topItems[0])notes.push(`Menu terkuat saat ini: <b>${esc(topItems[0].name)}</b> (${topItems[0].qty} porsi).`);if(lastOrder&&Date.now()-lastOrder>90*60*1000)notes.push('Belum ada order baru lebih dari 90 menit; cocok untuk dorong menu minuman/cemilan.');if(qris>cash)notes.push('QRIS lebih dominan dari tunai hari ini; pastikan rekonsiliasi pembayaran cocok dengan kas.');}return{topItems,metrics:{avg,itemQty,dine,take,cash,qris,other,margin},notes};}
function renderAdminAnalysis(orderRows,pemasukan,pengeluaran,profit){ensureAnalysisPanel();const body=document.getElementById('analysisBody');if(!body)return;const a=buildLocalAnalysis(orderRows,pemasukan,pengeluaran,profit);body.innerHTML=`<div class="analysis-card"><div class="analysis-kicker">Menu Terlaris</div><div class="analysis-list">${a.topItems.length?a.topItems.map(i=>`<div class="analysis-row"><strong>${esc(i.name)}</strong><span>${i.qty} porsi Â· ${rp(i.total)}</span></div>`).join(''):'<div class="analysis-note">Belum ada item terjual.</div>'}</div></div><div class="analysis-card"><div class="analysis-kicker">Statistik</div><div class="analysis-list"><div class="analysis-row"><strong>Rata-rata transaksi</strong><span>${rp(a.metrics.avg)}</span></div><div class="analysis-row"><strong>Total item</strong><span>${a.metrics.itemQty} porsi</span></div><div class="analysis-row"><strong>Dine-in / Kasir</strong><span>${a.metrics.dine} / ${a.metrics.take}</span></div><div class="analysis-row"><strong>Tunai / QRIS</strong><span>${rp(a.metrics.cash)} / ${rp(a.metrics.qris)}</span></div></div></div><div class="analysis-ai" id="analysisAiText">${a.notes.map(n=>`â€¢ ${n}`).join('<br>')}</div>`;}
function renderKeuangan(){
var all=getAll();let pemasukan=0;const orderRows=[];
Object.entries(dailyOrders).forEach(([txId,tx])=>{
  if(tx.qty!==undefined){
    const m=all.find(x=>x.id===txId);if(!m)return;
    const entry=normalizeOrderEntry(tx);
    const sub=calcOrderItemTotal(m,entry);pemasukan+=sub;
    orderRows.push({id:txId,time:0,tableLabel:'Migrated Item',total:sub,itemStr:buildOrderLines(m,entry).map(line=>`${line.name} x${line.qty}`).join(', '),isLegacy:true});
    return;
  }
  pemasukan+=(tx.total||0);
  const itemStrs=[];
  Object.entries(tx.items||{}).forEach(([iid,idata])=>{
    const m=all.find(x=>x.id===iid);
    if(m)buildOrderLines(m,idata).forEach(line=>itemStrs.push(`${line.name} x${line.qty}`));
  });
  orderRows.push({id:txId,time:tx.time||0,tableLabel:tx.tableLabel||'Transaksi',total:tx.total||0,itemStr:itemStrs.join(', ')});
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
renderAdminAnalysis(orderRows,pemasukan,pengeluaran,profit);

var od=document.getElementById('keuOrders');
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
          <button class="keu-print-btn" data-id="${o.id}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:4px 8px;border-radius:12px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:11px">ðŸ–¨ Print</button>
          ${role==='admin'?`<button class="edit-pm-btn" data-id="${o.id}" data-pm="${pm}" title="Ubah metode bayar" style="background:none;border:1px solid var(--border2);color:var(--muted2);cursor:pointer;font-size:11px;padding:2px 8px;border-radius:12px;font-family:Outfit,sans-serif">âœŽ ${pm||'?'}</button>`:''}
          <span class="keu-row-val" style="font-size:14px;color:var(--green)">${rp(o.total)}</span>
          
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted2);line-height:1.4">${esc(o.itemStr)}</div>
    </div>`;
  }).join('')+`<div class="keu-row keu-footer" style="padding:16px 12px;margin-top:8px"><span>Total Pemasukan</span><span class="keu-row-val" style="color:var(--green)">${rp(pemasukan)}</span></div>`;
  
  od.querySelectorAll('.keu-print-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const id=btn.dataset.id;
        const t=dailyOrders[id];if(!t)return;
        btn.textContent='Printing...';
        try{await autoPrint(t.items||{},t.total||0,t.tableLabel||'Kasir',t.cashGiven||0,t.change||0, t.paymentMethod||'');}catch(e){alert('Print gagal: '+e.message);}
        btn.textContent='ðŸ–¨ Print';
      });
    });
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

var nd=document.getElementById('keuNotas');
nd.innerHTML=notaRows.length?notaRows.map(n=>`<div class="keu-row"><span>${esc(n.note)}</span><span class="keu-row-val" style="color:var(--red)">${rp(n.t)}</span></div>`).join('')+`<div class="keu-row keu-footer"><span>Total</span><span class="keu-row-val" style="color:var(--red)">${rp(pengeluaran)}</span></div>`:'<div class="empty-msg">Belum ada nota hari ini</div>';
}
function renderPendingOrders(){
  const panel=document.getElementById('pendingOrdersPanel');if(!panel)return;
  if(role!=='admin'){panel.innerHTML='';return;}
  const pending=Object.entries(tableOrders).filter(([,t])=>t.status==='waiting_confirmation');
  if(!pending.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#001a1a,#000c0c);border-color:#206a6a"><div class="pending-ph" style="border-bottom-color:#003a3a"><span class="pending-ph-title" style="color:#20c8c8">Pesanan Baru Masuk</span><span class="pending-badge" style="background:rgba(32,200,200,0.2);color:#20c8c8;border-color:#10a0a0">${pending.length}</span></div>${pending.map(([tid,t])=>{
    const itemSummary=Object.entries(t.items||{}).map(([id,data])=>{
      const menu=getAll().find(m=>m.id===id);
      if(!menu)return `${esc(id)} x${data.qty||0}`;
      return buildOrderLines(menu,data).map(line=>`${esc(line.name)} x${line.qty}`).join(', ');
    }).join(', ');
    return `<div class="pending-row" style="border-bottom-color:rgba(0,50,50,0.8)"><div style="flex:1"><div class="pending-tname">${esc(t.tableLabel||'Meja '+tid)}</div><div style="font-size:11px;color:#20a0a0;margin-top:2px">${itemSummary}</div></div><button class="print-lagi-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px;margin-right:8px">Print</button><button class="konfirm-order-btn" data-tid="${tid}" style="background:linear-gradient(135deg,#20a0a0,#106060);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:Outfit,sans-serif">Terima Pesanan</button></div>`;
  }).join('')}</div></div>`;
  panel.querySelectorAll('.konfirm-order-btn').forEach(btn=>{btn.addEventListener('click',()=>konfirmasiPesanan(btn.dataset.tid));});
  panel.querySelectorAll('.print-lagi-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const t=tableOrders[btn.dataset.tid];if(!t)return;
      btn.textContent='Printing...';
      try{await autoPrint(t.items||{},t.total||0,t.tableLabel||'Kasir',t.cashGiven||0,t.change||0, t.paymentMethod||'');}catch(e){alert('Print gagal: '+e.message);}
      btn.textContent='Print Lagi';
    });
  });
}
async function konfirmasiPesanan(tableId){
  try{await update(ref(db,`tableOrders/${tableId}`),{status:'active'});showToast('Pesanan meja '+tableId+' diterima');}catch(e){alert('Gagal: '+e.message);}
}
function renderActiveTables(){
  const panel=document.getElementById('activeTablesPanel');if(!panel)return;
  if(!role){panel.innerHTML='';return;}
  const active=Object.entries(tableOrders).filter(([,t])=>t.status==='active');
  if(!active.length){panel.innerHTML='';return;}
  panel.innerHTML=`<div class="pending-panel-wrap" style="margin-bottom:12px"><div class="pending-card" style="background:linear-gradient(145deg,#1a1a1a,#111);border-color:#333"><div class="pending-ph" style="border-bottom-color:#222"><span class="pending-ph-title" style="color:var(--gold)">Meja Aktif</span><span class="pending-badge" style="background:rgba(212,168,83,0.1);color:var(--gold);border-color:var(--gold-dim)">${active.length}</span></div>${active.map(([tid,t])=>{
    const itemSummary=Object.entries(t.items||{}).map(([id,data])=>{
      const menu=getAll().find(m=>m.id===id);
      if(!menu)return `${esc(id)} x${data.qty||0}`;
      return buildOrderLines(menu,data).map(line=>`${esc(line.name)} x${line.qty}`).join(', ');
    }).join(', ');
    return `<div class="pending-row" style="border-bottom-color:rgba(42,42,42,0.6)"><div style="flex:1"><div class="pending-tname">${esc(t.tableLabel||'Meja '+tid)}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">${itemSummary}</div></div><div class="pending-ttotal" style="font-size:15px">${rp(t.total||0)}</div><div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0;flex-wrap:wrap">${role==='admin'?`<button class="cancel-order-btn" data-tid="${tid}" style="background:none;color:var(--red);border:1px solid #4a2020;padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">Batal</button>`:''}<button class="print-lagi-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">Print Lagi</button><button class="force-selesai-btn" data-tid="${tid}" style="background:var(--gold);color:#000;border:none;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px">Selesai</button></div></div>`;
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
      btn.textContent='Printing...';
      try{await autoPrint(t.items||{},t.total||0,t.tableLabel||'Kasir',t.cashGiven||0,t.change||0, t.paymentMethod||'');}catch(e){alert('Print gagal: '+e.message);}
      btn.textContent='Print Lagi';
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
  panel.innerHTML=`<div class="pending-panel-wrap"><div class="pending-card"><div class="pending-ph"><span class="pending-ph-title">ðŸ’³ Verifikasi Pembayaran</span><span class="pending-badge">${entries.filter(([,t])=>t.status==='waiting_verification').length}</span></div>${entries.map(([tid,t])=>{const state=t.status==='paid'?'Sudah dikonfirmasi':'Tamu mengaku sudah bayar';const stateColor=t.status==='paid'?'#5fa97c':'var(--gold)';const action=t.status==='waiting_verification'?`<button class="konfirm-btn" data-tid="${tid}">âœ… Konfirmasi Bayar</button>`:`<button class="clear-btn" data-tid="${tid}" style="background:none;border:1px solid #5fa97c;color:#5fa97c;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:'Outfit',sans-serif;transition:all 0.2s;flex-shrink:0">Selesai</button>`;
   const printBtn = `<button class="print-lagi-btn" data-tid="${tid}" style="background:var(--surface3);color:var(--text);border:1px solid var(--border2);padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;font-size:12px;margin-right:8px">ðŸ–¨ Print Lagi</button>`;const claimed=t.claimedPaidAt?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${new Date(t.claimedPaidAt).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'})}</div>`:'';return`<div class="pending-row"><div style="flex:1"><div class="pending-tname">${esc(t.tableLabel||'Meja '+tid)}</div>${claimed}<div style="font-size:11px;color:${stateColor};margin-top:3px">${state}</div></div><span class="pending-ttotal">${rp(t.total||0)}</span><div style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-shrink:0">${printBtn}${action}</div></div>`;}).join('')}</div></div>`;
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


