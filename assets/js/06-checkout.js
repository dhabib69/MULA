// Manual cashier checkout modal, offline queue writes, menu search/manage events
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
  const items=orderItems.flatMap(i=>buildOrderLines(i,orders[i.id]).map(line=>{total+=line.total;return{id:i.id,name:line.name,qty:line.qty,price:rp(line.total),rawPrice:line.total,note:line.note||''};}));

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
    orderItems.forEach(i=>{const entry=normalizeOrderEntry(orders[i.id]);dbItems[i.id]={qty:entry.qty,note:entry.note,tanpaNasiQty:entry.tanpaNasiQty,tanpaNasi:entry.tanpaNasi};});
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
document.getElementById('manageToggleBtn').addEventListener('click',function(){
  isManageMode=!isManageMode;
  renderOrders();
});
function filterMenu(q){
  if(!q){
    document.querySelectorAll('.menu-item').forEach(el=>el.classList.remove('hidden'));
    document.querySelectorAll('.section-div').forEach(el=>el.classList.remove('hidden'));
    document.querySelectorAll('.menu-grid').forEach(el=>el.classList.remove('hidden'));
    return;
  }
  document.querySelectorAll('.section-div').forEach(sec=>{
    let hasVisible=false;
    const grid=sec.nextElementSibling;
    if(!grid||!grid.classList.contains('menu-grid'))return;
    grid.querySelectorAll('.menu-item').forEach(el=>{
      const name=el.querySelector('.item-name')?.textContent.toLowerCase()||'';
      if(name.includes(q)){el.classList.remove('hidden');hasVisible=true;}
      else el.classList.add('hidden');
    });
    sec.classList.toggle('hidden',!hasVisible);
    grid.classList.toggle('hidden',!hasVisible);
  });
}
