// Native/Web Bluetooth/browser print paths and ESC/POS receipt generation
async function autoPrint(items,total,tableLabel,cashGiven,change){
  const all=getAll();
  const orderItems=all.filter(i=>(items[i.id]?.qty||0)>0);
  if(!orderItems.length)return;
  const printItems=orderItems.flatMap(i=>buildOrderLines(i,items[i.id]).map(line=>({name:line.name,qty:line.qty,price:rp(line.total),note:line.note||''})));
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

var btDevice=null,btChar=null;
var BLE_SERVICES=[
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
  const items=orderItems.flatMap(i=>buildOrderLines(i,orders[i.id]).map(line=>{total+=line.total;return{name:line.name,qty:line.qty,price:rp(line.total),note:line.note||''};}));
  
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

