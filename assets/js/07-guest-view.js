// Guest table ordering flow and QR modal handlers
// ========== EVENT LISTENERS + GUEST VIEW INIT ==========
registerCoreEventListeners();
document.getElementById('openQrBtn')?.addEventListener('click',openQrModal);
document.getElementById('closeQrBtn')?.addEventListener('click',()=>document.getElementById('qrModal').classList.remove('show'));

function openQrModal(){
  if(typeof QRCode==='undefined'){alert('QR library belum siap, coba lagi');return;}
  const grid=document.getElementById('qrGrid');
  if(!grid)return;
  grid.innerHTML='';
  TABLE_IDS.forEach(tid=>{
    const url=tableUrl(tid);
    const div=document.createElement('div');
    div.className='qr-item';
    div.innerHTML=`<div id="qr_${tid}" style="display:flex;justify-content:center"></div><div class="qr-label">MEJA ${tid}</div>`;
    grid.appendChild(div);
    const holder=div.querySelector(`#qr_${tid}`);
    new QRCode(holder,{text:url,width:128,height:128,colorDark:"#000",colorLight:"#fff",correctLevel:QRCode.CorrectLevel.M});
    div.addEventListener('click',()=>{
      const img=holder.querySelector('img')||holder.querySelector('canvas');
      const src=img?.src||(img?.toDataURL?img.toDataURL():'');
      if(!src){alert('QR belum siap');return;}
      document.getElementById('printArea').innerHTML=`<div style="text-align:center;padding:10mm;font-family:'Outfit',sans-serif;color:#000"><div style="font-size:22pt;font-weight:bold;letter-spacing:6px">MULA</div><div style="font-size:9pt;letter-spacing:3px;margin-bottom:4mm;color:#555">EATERY</div><div style="font-size:14pt;font-weight:bold;margin-bottom:4mm">Meja ${tid}</div><img src="${src}" style="width:60mm;height:60mm"><div style="font-size:9pt;margin-top:4mm">Scan untuk lihat pesanan &amp; bayar</div><div style="font-size:7pt;color:#888;margin-top:2mm;word-break:break-all">${url}</div></div>`;
      setTimeout(()=>window.print(),100);
    });
  });
  document.getElementById('qrModal').classList.add('show');
}

// Guest view init: check URL for /tableX or legacy ?table=X
(function initGuestView(){
  const tableParam=getTableParamFromUrl();
  if(!tableParam)return;
  if(!TABLE_IDS.includes(tableParam))return;
  document.getElementById('lockScreen').style.display='none';
  document.getElementById('guestView').style.display='block';
  document.getElementById('gvTableLabel').textContent=`Meja ${tableParam}`;
  const welcomeEl=document.querySelector('.gv-welcome');
  const copyEl=document.querySelector('.gv-hero-copy');
  if(welcomeEl)welcomeEl.textContent='Self checkout';
  if(copyEl)copyEl.textContent='Pilih menu, lanjut bayar di kasir, lalu pesanan masuk ke dapur.';
  document.title=`MULA | Meja ${tableParam}`;
  let gvCustomMenu={},gvPrices={},gvAvailability={},gvTableOrder=null;
  let guestCart={}; // local pending cart: {itemId: {qty, note, tanpaNasiQty}}
  let menuRendered=false;
  onValue(ref(db,'customMenu'),s=>{gvCustomMenu=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'priceOverrides'),s=>{gvPrices=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'menuAvailability'),s=>{gvAvailability=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,`tableOrders/${tableParam}`),s=>{gvTableOrder=s.val();renderGuest();});
  renderGuest();
  function mkSec(cat,def){return[...def,...Object.values(gvCustomMenu).filter(i=>i.cat===cat)].map(i=>({...i,price:gvPrices[i.id]||i.price,outOfStock:!!gvAvailability[i.id]}));}
  function getAllGuest(){return[...mkSec('favorites',DEF_FAVORITES),...mkSec('drinks',DEF_DRINKS),...mkSec('main',DEF_MAIN),...mkSec('dessert',DEF_DESSERT),...mkSec('tambahan',DEF_TAMBAHAN)];}
  function calcCartTotal(){let t=0;getAllGuest().forEach(i=>{if(i.outOfStock&&guestCart[i.id]?.qty)guestCart[i.id]={qty:0,note:'',tanpaNasiQty:0};const c=guestCart[i.id];if(!c||!c.qty||i.outOfStock)return;t+=calcOrderItemTotal(i,c);});return t;}
  function showToast(msg){const t=document.getElementById('gvToast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}
  function renderMenu(){
    const sections=[
      {cat:'favorites',label:'Favorit',items:mkSec('favorites',DEF_FAVORITES)},
      {cat:'main',label:'Makanan',items:mkSec('main',DEF_MAIN)},
      {cat:'dessert',label:'Cemilan',items:mkSec('dessert',DEF_DESSERT)},
      {cat:'drinks',label:'Minuman',items:mkSec('drinks',DEF_DRINKS)},
      {cat:'tambahan',label:'Tambahan',items:mkSec('tambahan',DEF_TAMBAHAN)},
    ];
    
var h='<div class="gv-app-top"><div><div class="gv-app-kicker">Selamat datang</div><div class="gv-app-title">MULA Menu</div></div><div class="gv-app-bell" aria-hidden="true"></div></div>';
h+='<div class="category-slider gv-cat-rail">';
sections.forEach(sec=>{
  h+=`<button class="cat-chip" data-target="gv-sec-${sec.cat}">${sec.label}</button>`;
});
h+='</div>';
sections.forEach(sec=>{
      h+=`<div class="gv-section" id="gv-sec-${sec.cat}">${esc(sec.label)}</div>`;
      sec.items.forEach(i=>{
        const c=normalizeOrderEntry(guestCart[i.id]||{qty:0,note:'',tanpaNasiQty:0});
        const out=!!i.outOfStock;
        if(out&&guestCart[i.id]?.qty)guestCart[i.id]={qty:0,note:'',tanpaNasiQty:0};
        const isNasi=NASI_IDS.includes(i.id);
        const tnQty=getTanpaNasiQty(c);
        const dnQty=getDenganNasiQty(c);
        const avgPrice=c.qty?Math.round(calcOrderItemTotal(i,c)/c.qty):i.price;
        const priceStr=isNasi&&tnQty?`${dnQty?`<span style="display:block;font-size:11px;color:var(--muted2)">${dnQty} nasi</span>`:''}${rp(avgPrice)}`:rp(i.price);
        const tnBtn=isNasi&&c.qty?`<div class="gv-mi-opts" style="gap:8px;align-items:center"><button class="gv-tn-btn" data-id="${i.id}" data-d="-1">- Tanpa Nasi</button><span style="font-size:11px;color:var(--muted2)">${tnQty}/${c.qty} tanpa nasi</span><button class="gv-tn-btn${tnQty?' active':''}" data-id="${i.id}" data-d="1">+ Tanpa Nasi</button></div>`:'';
        const noteField=c.qty>0?`<input class="gv-note" type="text" data-id="${i.id}" placeholder="Catatan..." value="${esc(c.note)}">`:'';
        const optsRow=(tnBtn||noteField)?`<div class="gv-mi-opts">${tnBtn}${noteField}</div>`:'';
        const initial=esc((i.name||'?').trim().charAt(0).toUpperCase());
        h+=`<div class="gv-menu-item${out?' is-out':''}${c.qty>0?' is-selected':''}"><div class="gv-mi-top"><div class="gv-mi-thumb" aria-hidden="true">${initial}</div><div class="gv-mi-left"><div class="gv-mi-name">${esc(i.name)}${out?` <span class="gv-out-badge">Habis</span>`:''}</div><div class="gv-mi-price">${priceStr}</div></div><div class="gv-mi-ctrl"><button class="gv-qbtn minus" data-id="${i.id}" data-d="-1" ${out?'disabled':''} aria-label="Kurangi ${esc(i.name)}">-</button><div class="gv-qdisp ${c.qty>0?'active':''}" id="gvq_${i.id}">${c.qty}</div><button class="gv-qbtn plus" data-id="${i.id}" data-d="1" ${out?'disabled':''} aria-label="Tambah ${esc(i.name)}">+</button></div></div>${optsRow}</div>`;
      });
    });
    const ml=document.getElementById('gvMenuList');
    ml.innerHTML=h;
    ml.querySelectorAll('.cat-chip').forEach(btn=>btn.addEventListener('click',()=>{
      document.getElementById(btn.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
    ml.querySelectorAll('.gv-qbtn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id,d=parseInt(btn.dataset.d);
        if(getAllGuest().find(x=>x.id===id)?.outOfStock){showToast('Menu sedang habis');return;}
        if(!guestCart[id])guestCart[id]={qty:0,note:'',tanpaNasiQty:0};
        guestCart[id]=normalizeOrderEntry({...guestCart[id],qty:Math.max(0,(guestCart[id].qty||0)+d)});
        if(guestCart[id].qty===0)guestCart[id]={qty:0,note:'',tanpaNasiQty:0,tanpaNasi:false};
        renderMenu();
        updateFooter();
      });
    });
    ml.querySelectorAll('.gv-tn-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id,d=parseInt(btn.dataset.d||'0');
        if(getAllGuest().find(x=>x.id===id)?.outOfStock){showToast('Menu sedang habis');return;}
        const cur=normalizeOrderEntry(guestCart[id]||{qty:0,note:'',tanpaNasiQty:0});
        if(!cur.qty)return;
        cur.tanpaNasiQty=Math.max(0,Math.min(cur.qty,cur.tanpaNasiQty+d));
        guestCart[id]=normalizeOrderEntry(cur);
        renderMenu();updateFooter();
      });
    });
    ml.querySelectorAll('.gv-note').forEach(inp=>{
      inp.addEventListener('input',()=>{const id=inp.dataset.id;if(getAllGuest().find(x=>x.id===id)?.outOfStock)return;guestCart[id]=normalizeOrderEntry({...guestCart[id],note:inp.value});});
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
    const rows=activeItems.flatMap(i=>buildOrderLines(i,items[i.id]).map(line=>{
      total+=line.total;
      const noteHtml=line.note?`<div class="gv-inote">* ${esc(line.note)}</div>`:"";
      return `<div class="gv-item"><div><div class="gv-iname">${esc(line.name)}</div>${noteHtml}</div><div class="gv-iright"><div class="gv-iqty">x${line.qty}</div><div class="gv-iprice">${rp(line.total)}</div></div></div>`;
    })).join('');
    document.getElementById('gvMyItems').innerHTML=rows;
  }
  function renderGuest(){
    const status=gvTableOrder?.status||'active';
    const menuBlock=document.getElementById('gvMenuBlock');
    const payBlock=document.getElementById('gvPayBlock');
    if(status==='pending_payment'||status==='waiting_verification'){
      menuBlock.style.display='none';
      payBlock.style.display='block';
      document.getElementById('gvFooter').style.display='none';
      const total=gvTableOrder?.total||0;
      const items=gvTableOrder?.items||{};
      const all=getAllGuest();
      const orderItems=all.filter(i=>(items[i.id]?.qty||0)>0);
      const itemsHtml=orderItems.flatMap(i=>buildOrderLines(i,items[i.id]).map(line=>{
        const noteHtml=line.note?`<div class="gv-inote">* ${esc(line.note)}</div>`:"";
        return `<div class="gv-item"><div><div class="gv-iname">${esc(line.name)}</div>${noteHtml}</div><div class="gv-iright"><div class="gv-iqty">x${line.qty}</div><div class="gv-iprice">${rp(line.total)}</div></div></div>`;
      })).join('');
      const actionBtn=status==='pending_payment'?`<button class="gv-pesan-btn" id="gvPayConfirmBtn" style="width:100%;margin-top:12px">Konfirmasi Pesanan</button>`:'';
      payBlock.innerHTML=`<div class="gv-pay-card checkout-shader"><div class="gv-pay-kicker">Pembayaran di Kasir</div><div class="gv-pay-title">Silakan Bayar di Kasir</div><div class="gv-pay-total">${rp(total)}</div><div class="gv-shell" style="margin-bottom:14px"><div class="gv-shell-head"><span class="gv-shell-title" style="font-size:18px">Pesanan Anda</span></div>${itemsHtml}</div><div class="gv-pay-steps"><div class="gv-pay-step" style="text-align:center"><span>Silakan menuju meja kasir untuk melakukan pembayaran agar pesanan bisa diteruskan ke dapur.</span></div></div><div class="gv-pay-wait">${status==='waiting_verification'?'Menunggu konfirmasi kasir':'Tekan tombol di bawah untuk memberitahu kasir'}</div>${actionBtn}</div>`;
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
      payBlock.innerHTML=`<div class="gv-done-card checkout-shader is-done"><div class="gv-done-kicker">Selesai</div><div class="gv-done-icon" aria-hidden="true"></div><div class="gv-done-title">Pembayaran Dikonfirmasi</div><div class="gv-done-sub">Terima kasih. Pembayaran sudah dicek staf dan pesanan masuk ke dapur.</div></div>`;
      return;
    }
    if(status==='active'&&Object.keys(gvTableOrder?.items||{}).length){
      menuBlock.style.display='none';
      document.getElementById('gvFooter').style.display='none';
      document.getElementById('gvMintaBayarBtn').style.display='none';
      payBlock.style.display='block';
      const start=gvTableOrder?.kitchenQueuedAt||gvTableOrder?.paidAt||gvTableOrder?.createdAt||Date.now();
      payBlock.innerHTML=`<div class="gv-done-card checkout-shader is-cooking"><div class="gv-done-kicker">Dapur</div><div class="gv-done-icon" aria-hidden="true"></div><div class="gv-done-title">Pesanan Masuk Dapur</div><div class="gv-done-sub">Pesanan sedang dimasak. Timer dapur berjalan sejak ${new Date(start).toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'})}.</div></div>`;
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
      Object.entries(guestCart).forEach(([id,c])=>{const entry=normalizeOrderEntry(c);if(entry.qty>0)items[id]={qty:entry.qty,note:entry.note,tanpaNasiQty:entry.tanpaNasiQty,tanpaNasi:entry.tanpaNasi};});
      let total=0;
      getAllGuest().forEach(i=>{const m=items[i.id];if(!m||!m.qty)return;total+=calcOrderItemTotal(i,m);});
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
