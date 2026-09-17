// Guest table ordering flow and QR modal handlers
// ========== EVENT LISTENERS + GUEST VIEW INIT ==========
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
  const orderMode=/^\/order\/?$/i.test(location.pathname);
  const tableParam=orderMode?null:getTableParamFromUrl();
  let selectedTables=tableParam?[tableParam]:[];
  let selectedTable=tableParam||null;
  if(!orderMode&&!tableParam)return;
  if(tableParam&&!TABLE_IDS.includes(tableParam))return;
  document.getElementById('lockScreen').style.display='none';
  document.getElementById('guestView').style.display='block';
  document.getElementById('gvTableLabel').textContent=selectedTable?`Meja ${selectedTable}`:'Pilih meja';
  const welcomeEl=document.querySelector('.gv-welcome');
  const copyEl=document.querySelector('.gv-hero-copy');
  const currentHour=new Date().getHours();
  const greeting=currentHour<11?'Selamat pagi':currentHour<15?'Selamat siang':currentHour<18?'Selamat sore':'Selamat malam';
  if(welcomeEl)welcomeEl.textContent=greeting;
  if(copyEl)copyEl.textContent='Selamat datang';
  document.title=orderMode?'MULA | Pesan Online':`MULA | Meja ${selectedTable}`;
  let gvCustomMenu={},gvPrices={},gvAvailability={},gvTableOrder=null,gvReservations={},gvTableBlocks={},gvMenuDeletions={};
  let guestCart={},guestCustomerName='',guestSearchQuery='',guestCheckoutOpen=false;
  let menuRendered=false,guestActiveCategory='',guestCategoryScrollHandler=null,guestCategoryResizeHandler=null,guestCategoryRaf=0;
  const busyStatuses=new Set(['waiting_verification','active','paid','served']);
  function formatSelectedTables(ids){
    const list=[...new Set((ids||[]).map(String).filter(id=>TABLE_IDS.includes(id)))];
    return list.length===1?`Meja ${list[0]}`:list.map(id=>`Meja ${id}`).join(' + ');
  }
  function reservationIsBusy(value){return !!(value&&Number(value.expiresAt||0)>Date.now()&&busyStatuses.has(String(value.status||'waiting_verification')));}
  function tableIsBlocked(id){return gvTableBlocks[String(id)]?.blocked===true;}
  function tableIsBusy(id){return tableIsBlocked(id);}
  function floorMapHTML(floor){
    const first=floor===1;
    const placed=first?[[1,15,24],[2,30,24],[3,45,24],[4,60,24],[5,75,24],[6,60,60],[7,75,60]]:[[22,12,23],[23,25,23],[24,38,23],[25,51,23],[26,64,23],[27,77,23],[21,12,56],[28,77,56]];
    const landmarks=first?'<span class="gv-landmark gv-landmark-wide gv-landmark-kasir" style="left:26%;top:60%;width:34%">Kasir</span><span class="gv-landmark gv-landmark-kaca" style="left:91%;top:28%">Kaca</span><span class="gv-landmark gv-landmark-pintu" style="left:91%;top:61%">Pintu</span><span class="gv-landmark gv-landmark-small gv-landmark-ac" style="left:49%;top:88%">AC</span>':'<span class="gv-landmark gv-landmark-kaca" style="left:91%;top:37%;height:27%">Kaca</span><span class="gv-landmark gv-landmark-wide gv-landmark-tangga" style="left:45%;top:82%;width:40%">Tangga</span><span class="gv-landmark gv-landmark-pintu" style="left:91%;top:78%">Pintu</span><span class="gv-landmark gv-landmark-small gv-landmark-ac" style="left:9%;top:78%">AC</span>';
    const tables=placed.map(([id,left,top])=>`<button type="button" class="gv-map-table" data-table-id="${id}" style="left:${left}%;top:${top}%"><span>Meja</span><strong>${id}</strong><em></em></button>`).join('');
    return `<div class="gv-floor-map" data-floor="${floor}">${landmarks}${tables}</div>`;
  }
  function pickTableFromTap(btn){
    if(btn.disabled)return;
    const now=Date.now(),previous=Number(btn.dataset.lastTap||0);
    if(now-previous<450)return;
    btn.dataset.lastTap=String(now);chooseTable(btn.dataset.tableId);
  }
  function bindTablePickerButtons(picker){
    picker.querySelectorAll('[data-table-id]').forEach(btn=>{
      if(btn.dataset.tapBound==='1')return;
      btn.dataset.tapBound='1';
      btn.addEventListener('click',()=>pickTableFromTap(btn));
      btn.addEventListener('pointerup',e=>{if((e.pointerType==='touch'||e.pointerType==='pen')&&!btn.disabled){e.preventDefault();pickTableFromTap(btn);}},{passive:false});
    });
  }
  function renderTablePicker(){
    const picker=document.getElementById('gvTablePicker');if(!picker)return;
    const chosen=new Set(selectedTables.map(String));
    picker.querySelectorAll('.gv-map-table').forEach(btn=>{
      const id=String(btn.dataset.tableId),busy=tableIsBusy(id),selected=chosen.has(id);
      btn.disabled=busy&&!selected;
      btn.classList.toggle('is-busy',busy);btn.classList.toggle('is-free',!busy);btn.classList.toggle('is-selected',selected);
      const state=btn.querySelector('em');if(state)state.textContent=selected?'Dipilih':busy?'Diblokir':'Tersedia';
      btn.setAttribute('aria-label',`Meja ${id}: ${selected?'dipilih':busy?'diblokir':'tersedia'}`);
      btn.setAttribute('aria-pressed',selected?'true':'false');
    });
    const selection=picker.querySelector('[data-picker-selection]');
    if(selection)selection.textContent=selectedTables.length?`${selectedTables.length} meja dipilih · ${formatSelectedTables(selectedTables)}`:'Pilih satu atau beberapa meja';
    const next=picker.querySelector('[data-picker-continue]');
    if(next){next.disabled=!selectedTables.length;next.textContent=selectedTables.length?`Lanjut dengan ${selectedTables.length} meja`:'Pilih meja';}
  }
  function showTablePicker(){
    const picker=document.getElementById('gvTablePicker'),bar=document.getElementById('gvSelectedTableBar');
    if(picker)picker.style.display='block';if(bar)bar.style.display='none';
    document.getElementById('gvMenuBlock').style.display='none';document.getElementById('gvPayBlock').style.display='none';document.getElementById('gvFooter').style.display='none';renderTablePicker();
  }
  function chooseTable(id){
    const normalized=String(id);if(!TABLE_IDS.includes(normalized))return;
    const index=selectedTables.indexOf(normalized);
    if(index>=0)selectedTables.splice(index,1);
    else{if(tableIsBusy(normalized)){showToast(`Meja ${normalized} sedang diblokir kasir. Silakan pilih meja lain.`);return;}selectedTables.push(normalized);}
    selectedTable=selectedTables[0]||null;gvTableOrder=null;renderTablePicker();
  }
  function continueWithSelectedTables(){
    const ids=[...new Set(selectedTables.map(String).filter(id=>TABLE_IDS.includes(id)))];
    if(!ids.length){showToast('Pilih minimal satu meja untuk melanjutkan.');return;}
    const busy=ids.find(id=>tableIsBusy(id));
    if(busy){showToast(`Meja ${busy} sedang diblokir kasir. Pilih meja lain.`);renderTablePicker();return;}
    selectedTables=ids;selectedTable=ids[0];gvTableOrder=null;
    document.getElementById('gvTableLabel').textContent=formatSelectedTables(selectedTables);
    document.getElementById('gvTablePicker').style.display='none';
    const bar=document.getElementById('gvSelectedTableBar');
    if(bar){bar.style.display='flex';bar.querySelector('[data-selected-label]').textContent=formatSelectedTables(selectedTables);}
    renderGuest();
  }
  function ensureTablePicker(){
    if(!orderMode)return;
    const payBlock=document.getElementById('gvPayBlock'),menuBlock=document.getElementById('gvMenuBlock');
    if(!document.getElementById('gvTablePicker')){
      const picker=document.createElement('section');
      picker.id='gvTablePicker';picker.className='gv-table-picker gv-shell';
      picker.innerHTML=`<div class="gv-picker-head"><div><div class="gv-picker-kicker">Pilih tempat duduk</div><div class="gv-picker-title">Di lantai mana Anda duduk?</div><div class="gv-picker-sub">Pilih satu atau beberapa meja. Meja yang diblokir kasir tidak dapat dipilih.</div></div><div class="gv-picker-legend"><span><i class="is-free"></i>Kosong</span><span><i class="is-busy"></i>Diblokir</span></div></div><div class="gv-floor-tabs"><button type="button" class="is-active" data-floor-tab="1">Lantai 1 <small>Meja 1–7</small></button><button type="button" data-floor-tab="2">Lantai 2 <small>Meja 21–28</small></button></div><div class="gv-floor-panel is-active" data-floor-panel="1">${floorMapHTML(1)}</div><div class="gv-floor-panel" data-floor-panel="2">${floorMapHTML(2)}</div><div class="gv-picker-actions"><div class="gv-picker-selection" data-picker-selection aria-live="polite">Pilih satu atau beberapa meja</div><button type="button" class="gv-picker-continue" data-picker-continue disabled>Pilih meja</button></div>`;
      payBlock.parentNode.insertBefore(picker,payBlock);
      picker.querySelectorAll('[data-floor-tab]').forEach(tab=>tab.addEventListener('click',()=>{picker.querySelectorAll('[data-floor-tab]').forEach(x=>x.classList.remove('is-active'));picker.querySelectorAll('[data-floor-panel]').forEach(x=>x.classList.remove('is-active'));tab.classList.add('is-active');picker.querySelector(`[data-floor-panel="${tab.dataset.floorTab}"]`)?.classList.add('is-active');}));
      picker.querySelector('[data-picker-continue]')?.addEventListener('click',continueWithSelectedTables);bindTablePickerButtons(picker);
    }
    if(!document.getElementById('gvSelectedTableBar')){
      const bar=document.createElement('div');bar.id='gvSelectedTableBar';bar.className='gv-selected-table-bar';bar.style.display='none';
      bar.innerHTML='<span>Pesanan untuk <strong data-selected-label></strong></span><button type="button" class="gv-change-table">Ganti meja</button>';
      menuBlock.insertBefore(bar,menuBlock.firstChild);
      bar.querySelector('.gv-change-table').addEventListener('click',()=>{selectedTables=[];selectedTable=null;gvTableOrder=null;document.getElementById('gvTableLabel').textContent='Pilih meja';showTablePicker();});
    }
    renderTablePicker();if(!selectedTable)showTablePicker();
  }
  onValue(ref(db,'customMenu'),s=>{gvCustomMenu=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'priceOverrides'),s=>{gvPrices=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'menuAvailability'),s=>{gvAvailability=s.val()||{};menuRendered=false;renderGuest();});
  onValue(ref(db,'guestTableReservations'),s=>{gvReservations=s.val()||{};renderTablePicker();});
  onValue(ref(db,'tableBlocks'),s=>{gvTableBlocks=s.val()||{};renderTablePicker();renderGuest();});
  onValue(ref(db,'menuDeletions'),s=>{gvMenuDeletions=s.val()||{};menuRendered=false;renderGuest();});
  ensureTablePicker();renderGuest();  function mkSec(cat,def){return[...def.filter(i=>!gvMenuDeletions?.[i.id]),...Object.values(gvCustomMenu).filter(i=>i.cat===cat&&!gvMenuDeletions?.[i.id])].map(i=>({...i,price:gvPrices[i.id]||i.price,outOfStock:!!gvAvailability[i.id]}));}
  function getAllGuest(){return[...mkSec('favorites',DEF_FAVORITES),...mkSec('drinks',DEF_DRINKS),...mkSec('main',DEF_MAIN),...mkSec('dessert',DEF_DESSERT),...mkSec('tambahan',DEF_TAMBAHAN)];}
  function calcCartTotal(){let t=0;getAllGuest().forEach(i=>{if(i.outOfStock&&guestCart[i.id]?.qty)guestCart[i.id]={qty:0,note:'',tanpaNasiQty:0};const c=guestCart[i.id];if(!c||!c.qty||i.outOfStock)return;t+=calcOrderItemTotal(i,c);});return t;}
  function showToast(msg){const t=document.getElementById('gvToast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}
  function setGuestActiveCategory(category){
    const menuList=document.getElementById('gvMenuList');
    if(!menuList)return;
    const target='gv-sec-'+(category||'');
    menuList.querySelectorAll('.cat-chip').forEach(button=>{
      const active=button.dataset.target===target;
      button.classList.toggle('is-active',active);
      if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
    });
  }
  function updateGuestActiveCategory(){
    const sections=[...document.querySelectorAll('#gvMenuList .gv-section')];
    if(!sections.length){guestActiveCategory='';return;}
    const marker=Math.max(120,Math.min(window.innerHeight*.28,220));
    let current=sections[0];
    sections.forEach(section=>{if(section.getBoundingClientRect().top<=marker)current=section;});
    guestActiveCategory=current.id.replace(/^gv-sec-/,'');
    setGuestActiveCategory(guestActiveCategory);
  }
  function bindGuestCategoryNavigation(menuList){
    if(guestCategoryScrollHandler)window.removeEventListener('scroll',guestCategoryScrollHandler);
    if(guestCategoryResizeHandler)window.removeEventListener('resize',guestCategoryResizeHandler);
    if(guestCategoryRaf)cancelAnimationFrame(guestCategoryRaf);
    guestCategoryRaf=0;
    const schedule=()=>{
      if(guestCategoryRaf)return;
      guestCategoryRaf=requestAnimationFrame(()=>{guestCategoryRaf=0;updateGuestActiveCategory();});
    };
    guestCategoryScrollHandler=schedule;
    guestCategoryResizeHandler=schedule;
    window.addEventListener('scroll',guestCategoryScrollHandler,{passive:true});
    window.addEventListener('resize',guestCategoryResizeHandler);
    menuList.querySelectorAll('.cat-chip').forEach(button=>button.addEventListener('click',()=>{
      const target=document.getElementById(button.dataset.target);
      if(!target)return;
      guestActiveCategory=button.dataset.target.replace(/^gv-sec-/,'');
      setGuestActiveCategory(guestActiveCategory);
      target.scrollIntoView({behavior:'smooth',block:'start'});
      schedule();
    }));
    schedule();
  }
  function renderMenu(){
    const sections=[
      {cat:'favorites',label:'Favorit',items:mkSec('favorites',DEF_FAVORITES)},
      {cat:'main',label:'Makanan',items:mkSec('main',DEF_MAIN)},
      {cat:'dessert',label:'Cemilan',items:mkSec('dessert',DEF_DESSERT)},
      {cat:'drinks',label:'Minuman',items:mkSec('drinks',DEF_DRINKS)},
      {cat:'tambahan',label:'Tambahan',items:mkSec('tambahan',DEF_TAMBAHAN)},
    ];
    const query=guestSearchQuery.trim().toLocaleLowerCase('id');
    const visibleSections=sections.map(section=>({...section,items:section.items.filter(item=>!query||String(item.name||'').toLocaleLowerCase('id').includes(query))})).filter(section=>section.items.length);
    let h='<div class="gv-app-top"><div><div class="gv-app-kicker">Selamat datang</div><div class="gv-app-title">MULA Menu</div></div><div class="gv-app-bell" aria-hidden="true"></div></div>';
    h+=`<div class="gv-search-wrap"><div class="search-wrap-inner"><span class="search-icon" aria-hidden="true">🔍</span><input class="search-input" id="gvMenuSearch" type="search" autocomplete="off" placeholder="Cari menu..." value="${esc(guestSearchQuery)}" aria-label="Cari menu"><button class="search-clear" id="gvMenuSearchClear" type="button" aria-label="Hapus pencarian"${query?' style="display:block"':''}>×</button></div></div>`;
    if(!visibleSections.length){h+='<div class="gv-search-empty">Menu tidak ditemukan. Coba kata kunci lain.</div>';}
    else{
      h+='<div class="category-slider gv-cat-rail">';
      visibleSections.forEach(section=>{h+=`<button class="cat-chip" data-target="gv-sec-${section.cat}">${section.label}</button>`;});
      h+='</div>';
      h+='<div class=gv-menu-content>';
      visibleSections.forEach(section=>{
        h+=`<div class="gv-section" id="gv-sec-${section.cat}">${esc(section.label)}</div>`;
        section.items.forEach(item=>{
          const c=normalizeOrderEntry(guestCart[item.id]||{qty:0,note:'',tanpaNasiQty:0});
          const out=!!item.outOfStock;
          if(out&&guestCart[item.id]?.qty)guestCart[item.id]={qty:0,note:'',tanpaNasiQty:0};
          const isNasi=NASI_IDS.includes(item.id);
          const tnQty=getTanpaNasiQty(c);
          const dnQty=getDenganNasiQty(c);
          const avgPrice=c.qty?Math.round(calcOrderItemTotal(item,c)/c.qty):item.price;
          const priceStr=isNasi&&tnQty?`${dnQty?`<span style="display:block;font-size:11px;color:var(--muted2)">${dnQty} nasi</span>`:''}${rp(avgPrice)}`:rp(item.price);
          const tnBtn=isNasi&&c.qty?`<div class="gv-mi-opts" style="gap:8px;align-items:center"><button class="gv-tn-btn" data-id="${item.id}" data-d="-1">- Tanpa Nasi</button><span style="font-size:11px;color:var(--muted2)">${tnQty}/${c.qty} tanpa nasi</span><button class="gv-tn-btn${tnQty?' active':''}" data-id="${item.id}" data-d="1">+ Tanpa Nasi</button></div>`:'';
          const noteField=c.qty>0?`<input class="gv-note" type="text" data-id="${item.id}" placeholder="Catatan..." value="${esc(c.note)}">`:'';
          const optsRow=(tnBtn||noteField)?`<div class="gv-mi-opts">${tnBtn}${noteField}</div>`:'';
          const initial=esc((item.name||'?').trim().charAt(0).toUpperCase());
          h+=`<div class="gv-menu-item${out?' is-out':''}${c.qty>0?' is-selected':''}"><div class="gv-mi-top"><div class="gv-mi-thumb" aria-hidden="true">${initial}</div><div class="gv-mi-left"><div class="gv-mi-name">${esc(item.name)}${out?` <span class="gv-out-badge">Habis</span>`:''}</div><div class="gv-mi-price">${priceStr}</div></div><div class="gv-mi-ctrl"><button class="gv-qbtn minus" data-id="${item.id}" data-d="-1" ${out?'disabled':''} aria-label="Kurangi ${esc(item.name)}">-</button><div class="gv-qdisp ${c.qty>0?'active':''}" id="gvq_${item.id}">${c.qty}</div><button class="gv-qbtn plus" data-id="${item.id}" data-d="1" ${out?'disabled':''} aria-label="Tambah ${esc(item.name)}">+</button></div></div>${optsRow}</div>`;
        });
      });
      h+='</div>';
    }    const menuList=document.getElementById('gvMenuList');
    menuList.innerHTML=h;
    const searchInput=document.getElementById('gvMenuSearch');
    searchInput?.addEventListener('input',()=>{
      const caret=searchInput.selectionStart||guestSearchQuery.length;
      guestSearchQuery=searchInput.value.slice(0,80);
      renderMenu();
      const next=document.getElementById('gvMenuSearch');
      if(next){next.focus();const nextCaret=Math.min(caret,guestSearchQuery.length);next.setSelectionRange(nextCaret,nextCaret);}
    });
    document.getElementById('gvMenuSearchClear')?.addEventListener('click',()=>{guestSearchQuery='';renderMenu();document.getElementById('gvMenuSearch')?.focus();});
    bindGuestCategoryNavigation(menuList);
    menuList.querySelectorAll('.gv-qbtn').forEach(button=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.id,delta=parseInt(button.dataset.d);
        if(getAllGuest().find(item=>item.id===id)?.outOfStock){showToast('Menu sedang habis');return;}
        if(!guestCart[id])guestCart[id]={qty:0,note:'',tanpaNasiQty:0};
        guestCart[id]=normalizeOrderEntry({...guestCart[id],qty:Math.max(0,(guestCart[id].qty||0)+delta)});
        if(guestCart[id].qty===0)guestCart[id]={qty:0,note:'',tanpaNasiQty:0,tanpaNasi:false};
        renderMenu();
        updateFooter();
      });
    });
    menuList.querySelectorAll('.gv-tn-btn').forEach(button=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.id,delta=parseInt(button.dataset.d||'0');
        if(getAllGuest().find(item=>item.id===id)?.outOfStock){showToast('Menu sedang habis');return;}
        const current=normalizeOrderEntry(guestCart[id]||{qty:0,note:'',tanpaNasiQty:0});
        if(!current.qty)return;
        current.tanpaNasiQty=Math.max(0,Math.min(current.qty,current.tanpaNasiQty+delta));
        guestCart[id]=normalizeOrderEntry(current);
        renderMenu();updateFooter();
      });
    });
    menuList.querySelectorAll('.gv-note').forEach(input=>input.addEventListener('input',()=>{const id=input.dataset.id;if(getAllGuest().find(item=>item.id===id)?.outOfStock)return;guestCart[id]=normalizeOrderEntry({...guestCart[id],note:input.value});}));
  }  function updateFooter(){
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
  function renderGuestCheckout(){
    const items=getAllGuest().filter(item=>(guestCart[item.id]?.qty||0)>0);
    const rows=items.flatMap(item=>buildOrderLines(item,guestCart[item.id]).map(line=>`<div class="gv-item"><div><div class="gv-iname">${esc(line.name)}</div>${line.note?`<div class="gv-inote">* ${esc(line.note)}</div>`:''}</div><div class="gv-iright"><div class="gv-iqty">x${line.qty}</div><div class="gv-iprice">${rp(line.total)}</div></div></div>`)).join('');
    const total=calcCartTotal(),name=guestCustomerName.trim();
    const payBlock=document.getElementById('gvPayBlock');
    payBlock.innerHTML=`<div class="gv-pay-card checkout-shader"><div class="gv-pay-kicker">Cek pesanan</div><div class="gv-pay-title">Konfirmasi pesanan</div><div class="gv-pay-total">${rp(total)}</div><div class="gv-shell gv-pay-order"><div class="gv-shell-head"><span class="gv-shell-title" style="font-size:18px">Pesanan Anda</span></div>${rows}</div><div class="gv-pay-name">Setelah dikirim, silakan bayar langsung di kasir dengan menyebutkan nama pelanggan.</div><label class="gv-customer-name-field"><span>Nama pelanggan <small>wajib diisi sebelum pesanan dikirim</small></span><input id="gvCustomerName" type="text" maxlength="60" autocomplete="name" placeholder="Nama pelanggan" value="${esc(guestCustomerName)}"></label><div class="gv-pay-actions"><button type="button" class="gv-secondary-btn" data-guest-checkout-back>Kembali ke menu</button><button type="button" class="gv-pesan-btn" data-guest-checkout-submit ${name?'':'disabled'}>Pesan &amp; bayar di kasir</button></div></div>`;
    const input=document.getElementById('gvCustomerName'),submit=document.querySelector('[data-guest-checkout-submit]');
    input?.addEventListener('input',event=>{guestCustomerName=event.target.value.slice(0,60);if(submit)submit.disabled=!guestCustomerName.trim();});
    document.querySelector('[data-guest-checkout-back]')?.addEventListener('click',()=>{guestCheckoutOpen=false;renderGuest();});
    submit?.addEventListener('click',submitGuestOrder);
  }
  function getGuestCartItems(){return getAllGuest().filter(item=>(guestCart[item.id]?.qty||0)>0);}  function renderGuest(){
    const status=gvTableOrder?.status||'active';
    const menuBlock=document.getElementById('gvMenuBlock');
    const payBlock=document.getElementById('gvPayBlock');
    if(orderMode&&!selectedTable){showTablePicker();return;}    if(!gvTableOrder&&selectedTable&&tableIsBlocked(selectedTable)){menuBlock.style.display='none';document.getElementById('gvFooter').style.display='none';payBlock.style.display='block';payBlock.innerHTML='<div class="gv-done-card checkout-shader"><div class="gv-done-kicker">Meja diblokir</div><div class="gv-done-title">Pesanan sementara ditutup</div><div class="gv-done-sub">Meja '+selectedTable+' sedang diblokir oleh kasir. Silakan hubungi staf.</div></div>';return;}

    if(status==='pending_payment'||status==='waiting_verification'){
      guestCheckoutOpen=false;
      menuBlock.style.display='none';
      payBlock.style.display='block';
      document.getElementById('gvFooter').style.display='none';
      const total=gvTableOrder?.total||0;
      const items=gvTableOrder?.items||{};
      const all=getAllGuest();
      const orderItems=all.filter(item=>(items[item.id]?.qty||0)>0);
      const itemsHtml=orderItems.flatMap(item=>buildOrderLines(item,items[item.id]).map(line=>{
        const noteHtml=line.note?`<div class="gv-inote">* ${esc(line.note)}</div>`:"";
        return `<div class="gv-item"><div><div class="gv-iname">${esc(line.name)}</div>${noteHtml}</div><div class="gv-iright"><div class="gv-iqty">x${line.qty}</div><div class="gv-iprice">${rp(line.total)}</div></div></div>`;
      })).join('');
      payBlock.innerHTML=`<div class="gv-pay-card checkout-shader"><div class="gv-pay-kicker">Verifikasi pembayaran</div><div class="gv-pay-title">Menunggu pembayaran di kasir</div><div class="gv-pay-total">${rp(total)}</div><div class="gv-shell" style="margin-bottom:14px"><div class="gv-shell-head"><span class="gv-shell-title" style="font-size:18px">Pesanan Anda</span></div>${itemsHtml}</div><div class="gv-pay-steps"><div class="gv-pay-step" style="text-align:center"><span>Pesanan atas nama <strong>${esc(gvTableOrder?.customerName||'Pelanggan')}</strong> untuk <strong>${esc(formatSelectedTables(gvTableOrder?.tableIds||[selectedTable]))}</strong> sudah diterima. Silakan bayar langsung di kasir agar staf dapat mengonfirmasi pesanan.</span></div></div><div class="gv-pay-wait">Pesanan dan meja Anda sudah dicatat. Bayar di kasir agar staf dapat meneruskan pesanan ke dapur.</div></div>`;
      return;
    }    if(status==='paid'){
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
    if(guestCheckoutOpen){
      menuBlock.style.display='none';
      document.getElementById('gvFooter').style.display='none';
      document.getElementById('gvMintaBayarBtn').style.display='none';
      payBlock.style.display='block';
      renderGuestCheckout();
      return;
    }
    // active / default
    payBlock.style.display='none';
    menuBlock.style.display='block';
    document.getElementById('gvMintaBayarBtn').style.display='none';
    if(!menuRendered){renderMenu();menuRendered=true;}
    updateFooter();
  }
  async function ensureGuestUser(){
    if(currentUser)return currentUser;
    if(!fbAuth?.signInAnonymously)throw new Error('Koneksi aman belum siap. Coba lagi beberapa saat.');
    const credential=await fbAuth.signInAnonymously();
    const user=credential?.user||currentUser;
    if(!user)throw new Error('Koneksi aman belum siap. Coba lagi beberapa saat.');
    return user;
  }
  async function submitGuestOrder(){
    const curStatus=gvTableOrder?.status||'active';
    if(curStatus==='pending_payment'||curStatus==='waiting_verification'){alert('Pesanan ini sedang menunggu verifikasi pembayaran.');return;}
    if(curStatus==='paid'){alert('Pembayaran baru saja selesai. Tunggu sebentar sampai sesi meja dibersihkan.');return;}
    if(!getGuestCartItems().length)return;
    const customerName=guestCustomerName.trim().replace(/\s+/g,' ').slice(0,60);
    if(!customerName){showToast('Masukkan nama pelanggan terlebih dahulu.');document.getElementById('gvCustomerName')?.focus();return;}
    const button=document.querySelector('[data-guest-checkout-submit]');
    if(button){button.disabled=true;button.textContent='Mengirim pesanan...';}
    try{
      const items={};
      Object.entries(guestCart).forEach(([id,item])=>{const entry=normalizeOrderEntry(item);if(entry.qty>0)items[id]={qty:entry.qty,note:entry.note,tanpaNasiQty:entry.tanpaNasiQty,tanpaNasi:entry.tanpaNasi};});
      let total=0;
      getAllGuest().forEach(item=>{const entry=items[item.id];if(entry?.qty)total+=calcOrderItemTotal(item,entry);});
      const tableIds=[...new Set((orderMode?selectedTables:[selectedTable]).map(String).filter(id=>TABLE_IDS.includes(id)))];
      const primaryTable=tableIds[0];
      if(!primaryTable||!tableIds.length)throw new Error('Pilih minimal satu meja terlebih dahulu.');
      const busy=tableIds.find(id=>tableIsBlocked(id));
      if(busy)throw new Error(`Meja ${busy} sedang diblokir kasir.`);
      const user=await ensureGuestUser();
      const orderRef=push(ref(db,'tableOrders')),orderId=orderRef?.key;
      if(!orderId)throw new Error('ID pesanan belum tersedia. Coba lagi.');
      const createdAt=Date.now();
      const payload={orderId,guestUid:user.uid,tableLabel:formatSelectedTables(tableIds),tableId:primaryTable,primaryTableId:primaryTable,tableIds,customerName,status:'waiting_verification',createdAt,dateKey:today(),total,items,paymentAtCashier:true,customerConfirmedAt:createdAt};
      await set(orderRef,payload);
      gvTableOrder=null;
      guestCart={};guestCheckoutOpen=false;menuRendered=false;ensureTablePicker();renderGuest();
      showToast('Pesanan dicatat. Silakan bayar langsung di kasir.');
    }catch(error){
      console.error(error);
      alert('Gagal menyimpan pesanan: '+error.message);
      if(button){button.disabled=false;button.textContent='Pesan & bayar di kasir';}
    }
  }
  document.getElementById('gvPesanBtn').addEventListener('click',()=>{
    if(!getGuestCartItems().length)return;
    guestCheckoutOpen=true;
    renderGuest();
    setTimeout(()=>document.getElementById('gvCustomerName')?.focus(),0);
  });  document.getElementById('gvMintaBayarBtn').style.display='none';  document.getElementById('gvMintaBayarBtn').style.display='none';
})();
