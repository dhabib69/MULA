// Financial Analytics — Calendar-aligned charts, 3-Tier Forecast, Menu Summary (no LLM)
var analysisLoading = false;
var _menuMaps = {}; // stores {today, week, month} item maps for tab switching
var _sortMode = 'qty'; // 'qty' or 'revenue'
var _activePeriod = 'today'; // track active period for re-sort
var _viewYear = null; // null = current month
var _viewMonth = null;
var _menuViewYear = null; // null = current month
var _menuViewMonth = null;
var _menuMonthMaps = {};
var _analyticsDataset = {};

function menuMonthKey(year, month){
  return `${year}-${String(month+1).padStart(2,'0')}`;
}

// --- Smooth Bezier Curve Generator ---
function createSmoothPath(points){
  if(!points||points.length<2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for(let i=0; i<points.length-1; i++){
    const p0=points[i], p1=points[i+1], cx=(p0.x+p1.x)/2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function formatCompactCurrency(val){
  if(val>=1000000) return (val/1000000).toFixed(1).replace(/\.0$/,'')+'Jt';
  if(val>=1000) return (val/1000).toFixed(0)+'Rb';
  return val.toLocaleString('id');
}

// Aggregate items from a Firebase orders snapshot into a map
function _aggregateItems(ordersSnap, itemMap, all){
  const orders = ordersSnap || {};
  Object.entries(orders).forEach(([k,tx])=>{
    if(k==='receipts') return;
    if(tx.qty!==undefined) return; // legacy
    Object.entries(tx.items||{}).forEach(([iid,idata])=>{
      const m=all.find(x=>x.id===iid); if(!m) return;
      const lines=typeof buildOrderLines==='function'?buildOrderLines(m,idata):[];
      lines.forEach(line=>{
        const key=iid+'|'+line.name;
        if(!itemMap[key]) itemMap[key]={name:line.name,qty:0,revenue:0};
        itemMap[key].qty += line.qty||0;
        itemMap[key].revenue += (line.price||m.price||0)*(line.qty||0);
      });
    });
  });
}

// --- Gather all data (fully parallelised with Promise.all) ---
async function gatherAnalysisData(viewYear, viewMonth){
  const all = getAll();
  const now = new Date();
  const year  = (viewYear  !== undefined && viewYear  !== null) ? viewYear  : now.getFullYear();
  const month = (viewMonth !== undefined && viewMonth !== null) ? viewMonth : now.getMonth();
  const todayStr = today();
  const viewingCurrentMonth = (year === now.getFullYear() && month === now.getMonth());

  // --- Build all day-keys we need in one shot ---
  // 90-day history (for projection stats, always from today backwards)
  const historyDays = [];
  for(let i=0;i<90;i++){
    const d=new Date(now); d.setDate(now.getDate()-i);
    historyDays.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  // Current week
  const currentDayOfWeek=now.getDay();
  const distToMon=currentDayOfWeek===0?6:currentDayOfWeek-1;
  const mondayDate=new Date(now); mondayDate.setDate(now.getDate()-distToMon);
  const dayNames=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  const weeklyDayKeys=[];
  for(let i=0;i<7;i++){
    const d=new Date(mondayDate); d.setDate(mondayDate.getDate()+i);
    weeklyDayKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  // Viewed month
  const firstDayOfMonth=new Date(year,month,1);
  const lastDayOfMonth=new Date(year,month+1,0);
  const totalDaysInMonth=lastDayOfMonth.getDate();
  const monthlyDayKeys=[];
  for(let d=1;d<=totalDaysInMonth;d++){
    const date=new Date(year,month,d);
    monthlyDayKeys.push(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }

  // Deduplicate all day keys
  const allDayKeys=[...new Set([...historyDays,...weeklyDayKeys,...monthlyDayKeys])];

  // === PARALLEL FETCH: all orders + receipts at once ===
  const [rSnap,...orderSnaps] = await Promise.all([
    get(ref(db,'receipts')).catch(()=>null),
    ...allDayKeys.map(k=>get(ref(db,`orders/${k}`)).catch(()=>null))
  ]);

  // Build lookup map
  const snapMap={};
  allDayKeys.forEach((k,i)=>{snapMap[k]=orderSnaps[i];});

  // Process receipts
  let receiptsMap={};
  try{
    const rData=(rSnap&&rSnap.val())||{};
    Object.values(rData).forEach(r=>{
      const dKey=(r.date||'').slice(0,10);
      if(dKey){
        const itemsArr=Array.isArray(r.items)?r.items:(r.items?Object.values(r.items):[]);
        const t=r.total||itemsArr.reduce((s,i)=>s+parseInt((i.price||'').replace(/\D/g,'')||0),0)||0;
        receiptsMap[dKey]=(receiptsMap[dKey]||0)+t;
      }
    });
  }catch(e){}

  // 90-day historical revenues for stats
  const historicalRevenues=[];
  historyDays.forEach(dayKey=>{
    const snap=snapMap[dayKey]; if(!snap) return;
    const orders=snap.val()||{};
    let dayRevenue=0;
    Object.entries(orders).forEach(([k,v])=>{if(k!=='receipts')dayRevenue+=(v.total||0);});
    historicalRevenues.push(dayRevenue);
  });
  const nHist=historicalRevenues.length||1;
  const meanDailyRev=historicalRevenues.reduce((s,r)=>s+r,0)/nHist;
  const varRev=historicalRevenues.reduce((s,r)=>s+Math.pow(r-meanDailyRev,2),0)/nHist;
  const stdDevRev=Math.sqrt(varRev);
  const z=1.96;
  const optDailyRev=meanDailyRev+(z*stdDevRev);
  const consDailyRev=Math.max(0,meanDailyRev-(z*stdDevRev));

  // Weekly calendar + item aggregation
  const weeklyCalendar=[];
  const weeklyItemMap={};
  weeklyDayKeys.forEach((dateKey,i)=>{
    const isPastOrToday=dateKey<=todayStr;
    let dayRev=0,dayExp=0,dayTx=0;
    if(isPastOrToday){
      const orders=(snapMap[dateKey]&&snapMap[dateKey].val())||{};
      Object.entries(orders).forEach(([k,v])=>{if(k!=='receipts'){dayRev+=(v.total||0);dayTx++;}});
      _aggregateItems(orders,weeklyItemMap,all);
      dayExp=receiptsMap[dateKey]||0;
    }
    const d=new Date(mondayDate); d.setDate(mondayDate.getDate()+i);
    weeklyCalendar.push({dateKey,dayName:dayNames[i],label:`${dayNames[i]} ${d.getDate()}`,revenue:isPastOrToday?dayRev:null,expenses:isPastOrToday?dayExp:null,txCount:isPastOrToday?dayTx:null,isFuture:!isPastOrToday,isToday:dateKey===todayStr});
  });

  // Monthly calendar + item aggregation
  const monthlyCalendar=[];
  const monthlyItemMap={};
  let cumActualRev=0;
  monthlyDayKeys.forEach((dateKey,idx)=>{
    const dayNum=idx+1;
    const isPastOrToday=dateKey<=todayStr;
    let dayRev=0,dayExp=0;
    if(isPastOrToday){
      const orders=(snapMap[dateKey]&&snapMap[dateKey].val())||{};
      Object.entries(orders).forEach(([k,v])=>{if(k!=='receipts')dayRev+=(v.total||0);});
      _aggregateItems(orders,monthlyItemMap,all);
      dayExp=receiptsMap[dateKey]||0;
      cumActualRev+=dayRev;
    }
    monthlyCalendar.push({dayNum,dateKey,revenue:isPastOrToday?dayRev:null,expenses:isPastOrToday?dayExp:null,isPastOrToday,isToday:dateKey===todayStr});
  });

  // Today item map from in-memory dailyOrders
  const todayItemMap={};
  const _dailyOrders=typeof dailyOrders!=='undefined'?dailyOrders:{};
  Object.values(_dailyOrders).forEach(tx=>{
    if(tx.qty!==undefined) return;
    Object.entries(tx.items||{}).forEach(([iid,idata])=>{
      const m=all.find(x=>x.id===iid); if(!m) return;
      const lines=typeof buildOrderLines==='function'?buildOrderLines(m,idata):[];
      lines.forEach(line=>{
        const key=iid+'|'+line.name;
        if(!todayItemMap[key]) todayItemMap[key]={name:line.name,qty:0,revenue:0};
        todayItemMap[key].qty+=line.qty||0;
        todayItemMap[key].revenue+=(line.price||m.price||0)*(line.qty||0);
      });
    });
  });

  // Store globally for tab switching
  _menuMaps={today:todayItemMap,week:weeklyItemMap,month:monthlyItemMap};
  _menuMonthMaps[menuMonthKey(year,month)]=monthlyItemMap;

  // 3-tier projections
  const todayIndex=monthlyCalendar.findIndex(m=>m.isToday);
  const startProjIndex=todayIndex>=0?todayIndex:totalDaysInMonth-1;
  const startCumVal=cumActualRev;
  let cumOpt=startCumVal,cumBase=startCumVal,cumCons=startCumVal;
  monthlyCalendar.forEach((m,idx)=>{
    m.cumPrediction=Math.round(meanDailyRev*m.dayNum);
    if(idx<startProjIndex){
      m.cumActual=monthlyCalendar.slice(0,idx+1).reduce((s,x)=>s+(x.revenue||0),0);
      m.cumOptimistic=null;m.cumRealistic=null;m.cumLower=null;
    } else if(idx===startProjIndex){
      m.cumActual=startCumVal;m.cumOptimistic=startCumVal;m.cumRealistic=startCumVal;m.cumLower=startCumVal;
    } else {
      m.cumActual=null;
      // For past months: project based on remaining days = 0 (show flat)
      if(!viewingCurrentMonth && dateKey<=todayStr){
        m.cumActual=monthlyCalendar.slice(0,idx+1).reduce((s,x)=>s+(x.revenue||0),0);
        m.cumOptimistic=null;m.cumRealistic=null;m.cumLower=null;
      } else {
        cumOpt+=optDailyRev;cumBase+=meanDailyRev;cumCons+=consDailyRev;
        m.cumOptimistic=Math.round(cumOpt);m.cumRealistic=Math.round(cumBase);m.cumLower=Math.round(cumCons);
      }
    }
  });

  const monthNameStr=firstDayOfMonth.toLocaleString('id',{month:'long',year:'numeric'});
  return {weeklyCalendar,monthlyCalendar,monthNameStr,totalDaysInMonth,todayDayNum:now.getDate(),meanDailyRev:Math.round(meanDailyRev),optDailyRev:Math.round(optDailyRev),consDailyRev:Math.round(consDailyRev),projMonthEndOptimistic:Math.round(cumOpt),projMonthEndRealistic:Math.round(cumBase),projMonthEndLower:Math.round(cumCons),cumActualSoFar:startCumVal,todayStr,viewYear:year,viewMonth:month};
}

// Navigate graph by month offset
function navigateAnalysisMonth(offset){
  const now=new Date();
  const curYear=(_viewYear!==null)?_viewYear:now.getFullYear();
  const curMonth=(_viewMonth!==null)?_viewMonth:now.getMonth();
  let newMonth=curMonth+offset;
  let newYear=curYear;
  if(newMonth>11){newMonth=0;newYear++;}
  if(newMonth<0){newMonth=11;newYear--;}
  // Don't navigate into the future beyond current month
  if(newYear>now.getFullYear()||(newYear===now.getFullYear()&&newMonth>now.getMonth())){
    newYear=now.getFullYear();newMonth=now.getMonth();
  }
  _viewYear=newYear;_viewMonth=newMonth;
  runAnalysis();
}

// --- Monthly Forecast Chart ---



function buildProfessionalMonthlyForecastSVG(data){
  const mCal=data.monthlyCalendar||[];
  const W=720,H=260,padL=65,padR=40,padT=35,padB=40;
  let maxVal=100000;
  mCal.forEach(m=>{
    if(m.cumActual!==null&&m.cumActual>maxVal) maxVal=m.cumActual;
    if(m.cumOptimistic!==null&&m.cumOptimistic>maxVal) maxVal=m.cumOptimistic;
    if(m.cumRealistic!==null&&m.cumRealistic>maxVal) maxVal=m.cumRealistic;
    if(m.cumLower!==null&&m.cumLower>maxVal) maxVal=m.cumLower;
    if(m.cumPrediction!==null&&m.cumPrediction>maxVal) maxVal=m.cumPrediction;
  });
  maxVal=Math.ceil(maxVal*1.1);
  const mapX=(dayIndex)=>padL+(dayIndex*(W-padL-padR)/(mCal.length-1));
  const mapY=(val)=>H-padB-Math.round((val/maxVal)*(H-padT-padB));
  const zeroPoint={x:mapX(0),y:mapY(0)};
  const actualPoints=[zeroPoint,...mCal.filter(m=>m.cumActual!==null&&m.dayNum>1).map(m=>({x:mapX(m.dayNum-1),y:mapY(m.cumActual),val:m.cumActual,day:m.dayNum}))];
  const optPoints=[zeroPoint,...mCal.filter(m=>m.cumOptimistic!==null&&m.dayNum>1).map(m=>({x:mapX(m.dayNum-1),y:mapY(m.cumOptimistic)}))];
  const realPoints=[zeroPoint,...mCal.filter(m=>m.cumRealistic!==null&&m.dayNum>1).map(m=>({x:mapX(m.dayNum-1),y:mapY(m.cumRealistic)}))];
  const lowerPoints=[zeroPoint,...mCal.filter(m=>m.cumLower!==null&&m.dayNum>1).map(m=>({x:mapX(m.dayNum-1),y:mapY(m.cumLower)}))];
  const actualPathD=createSmoothPath(actualPoints);
  const optPathD=createSmoothPath(optPoints);
  const realPathD=createSmoothPath(realPoints);
  const lowerPathD=createSmoothPath(lowerPoints);
  const yTicks=[];
  for(let i=0;i<=4;i++){const v=Math.round((maxVal/4)*i);yTicks.push({y:mapY(v),label:formatCompactCurrency(v)});}
  const xTicks=[];
  mCal.forEach(m=>{if(m.dayNum===1||m.dayNum%5===0||m.dayNum===data.totalDaysInMonth){xTicks.push({x:mapX(m.dayNum-1),label:`${m.dayNum}`});}});
  return `<div style="background:linear-gradient(145deg,rgba(20,20,26,0.85),rgba(12,12,16,0.92));backdrop-filter:blur(20px);border:1px solid rgba(212,168,83,0.25);border-radius:18px;padding:22px;margin-bottom:20px;box-shadow:0 14px 36px rgba(0,0,0,0.45)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:18px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--gold,#c9a84c);letter-spacing:1.2px;text-transform:uppercase">Proyeksi Pendapatan Bulanan</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <button onclick="navigateAnalysisMonth(-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:8px;padding:3px 10px;cursor:pointer;font-size:14px;font-family:Outfit,sans-serif">&#8249;</button>
          <span style="font-size:13px;font-weight:600;color:var(--text);min-width:130px;text-align:center">${data.monthNameStr}</span>
          <button onclick="navigateAnalysisMonth(1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:8px;padding:3px 10px;cursor:pointer;font-size:14px;font-family:Outfit,sans-serif">&#8250;</button>
        </div>
        <div style="font-size:11px;color:var(--muted2);margin-top:3px">Kalender 1 s.d ${data.totalDaysInMonth} ${data.monthNameStr} — referensi harian historis${data.growth?` · optimis +${Math.round(data.growth*100)}% dari tren pertumbuhan`:''}</div>
      </div>
      <div style="display:flex;gap:14px;font-size:10px;color:var(--muted2);flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:3px;background:#5fa97c;border-radius:2px"></span> Aktual</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:2px;background:rgba(68,208,128,0.65);border-radius:2px"></span> Optimis</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:2px;background:rgba(212,168,83,0.65);border-radius:2px"></span> Realistis</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:2px;background:rgba(255,107,107,0.65);border-radius:2px"></span> Konservatif</span>
      </div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:260px;overflow:visible">
      ${yTicks.map(t=>`<line x1="${padL}" y1="${t.y}" x2="${W-padR}" y2="${t.y}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="3 3"/><text x="${padL-10}" y="${t.y+4}" font-size="10" fill="var(--muted2)" text-anchor="end" font-family="Outfit,sans-serif">Rp ${t.label}</text>`).join('')}
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(255,255,255,0.15)"/>
      ${xTicks.map(t=>`<line x1="${t.x}" y1="${H-padB}" x2="${t.x}" y2="${H-padB+4}" stroke="rgba(255,255,255,0.2)"/><text x="${t.x}" y="${H-padB+18}" font-size="10" fill="var(--muted2)" text-anchor="middle" font-family="Outfit,sans-serif">${t.label}</text>`).join('')}
      ${optPathD?`<path d="${optPathD}" fill="none" stroke="rgba(68,208,128,0.65)" stroke-width="1.8" stroke-dasharray="4 5" stroke-linecap="round" opacity="0.7"/>`:''}
      ${realPathD?`<path d="${realPathD}" fill="none" stroke="rgba(212,168,83,0.65)" stroke-width="1.8" stroke-dasharray="4 5" stroke-linecap="round" opacity="0.7"/>`:''}
      ${lowerPathD?`<path d="${lowerPathD}" fill="none" stroke="rgba(255,107,107,0.65)" stroke-width="1.8" stroke-dasharray="4 5" stroke-linecap="round" opacity="0.7"/>`:''}
      ${actualPathD?`<path d="${actualPathD}" fill="none" stroke="#5fa97c" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`:''}
      ${actualPoints.length?`<circle cx="${actualPoints[actualPoints.length-1].x}" cy="${actualPoints[actualPoints.length-1].y}" r="5" fill="var(--gold)" stroke="#000" stroke-width="2"/><text x="${actualPoints[actualPoints.length-1].x}" y="${actualPoints[actualPoints.length-1].y-12}" font-size="10" fill="var(--gold)" font-weight="700" text-anchor="middle" font-family="Outfit,sans-serif">Hari ini (${data.todayDayNum})</text>`:''}
      ${optPoints.length?`<text x="${W-padR+6}" y="${optPoints[optPoints.length-1].y+4}" font-size="10" fill="#44d080" font-weight="700" font-family="Outfit,sans-serif">Rp ${formatCompactCurrency(data.projMonthEndOptimistic)}</text><text x="${W-padR+6}" y="${realPoints[realPoints.length-1].y+4}" font-size="10" fill="var(--gold)" font-weight="700" font-family="Outfit,sans-serif">Rp ${formatCompactCurrency(data.projMonthEndRealistic)}</text><text x="${W-padR+6}" y="${lowerPoints[lowerPoints.length-1].y+4}" font-size="10" fill="#ff6b6b" font-weight="700" font-family="Outfit,sans-serif">Rp ${formatCompactCurrency(data.projMonthEndLower)}</text>`:''}
    </svg>
  </div>`;
}

// --- Weekly Bar Chart ---
function buildProfessionalWeeklyChartSVG(data){
  const wCal=data.weeklyCalendar||[];
  const W=720,H=200,padL=60,padR=25,padT=30,padB=40;
  let maxVal=100000;
  wCal.forEach(w=>{
    if(w.revenue!==null&&w.revenue>maxVal) maxVal=w.revenue;
    if(w.expenses!==null&&w.expenses>maxVal) maxVal=w.expenses;
  });
  maxVal=Math.ceil(maxVal*1.15);
  const n=wCal.length;
  const colWidth=(W-padL-padR)/n;
  const barWidth=Math.min(22,colWidth*0.32);
  const mapY=(val)=>H-padB-Math.round((val/maxVal)*(H-padT-padB));
  const yTicks=[];
  for(let i=0;i<=3;i++){const v=Math.round((maxVal/3)*i);yTicks.push({y:mapY(v),label:formatCompactCurrency(v)});}
  let barsHTML='';
  wCal.forEach((w,i)=>{
    const cx=padL+i*colWidth+colWidth/2;
    if(w.isFuture){
      barsHTML+=`<g><rect x="${cx-colWidth*0.4}" y="${padT}" width="${colWidth*0.8}" height="${H-padT-padB}" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" stroke-dasharray="2 2"/><text x="${cx}" y="${H-padB-(H-padT-padB)/2}" font-size="10" fill="rgba(255,255,255,0.2)" text-anchor="middle" font-family="Outfit,sans-serif">Belum Ada</text><text x="${cx}" y="${H-12}" font-size="11" fill="rgba(255,255,255,0.3)" text-anchor="middle" font-weight="600" font-family="Outfit,sans-serif">${w.label}</text></g>`;
    } else {
      const revH=Math.round(((w.revenue||0)/maxVal)*(H-padT-padB));
      const expH=Math.round(((w.expenses||0)/maxVal)*(H-padT-padB));
      const revY=H-padB-revH; const expY=H-padB-expH;
      const hl=w.isToday?'stroke="var(--gold)" stroke-width="1.5"':'';
      barsHTML+=`<g><rect x="${cx-barWidth-2}" y="${revY}" width="${barWidth}" height="${Math.max(4,revH)}" rx="5" fill="url(#barRevGrad)" ${hl}><title>${w.label}: Pemasukan Rp ${(w.revenue||0).toLocaleString('id')}</title></rect><rect x="${cx+2}" y="${expY}" width="${barWidth}" height="${Math.max(4,expH)}" rx="5" fill="url(#barExpGrad)"><title>${w.label}: Pengeluaran Rp ${(w.expenses||0).toLocaleString('id')}</title></rect><text x="${cx}" y="${H-12}" font-size="11" fill="${w.isToday?'var(--gold)':'var(--text)'}" font-weight="${w.isToday?'700':'500'}" text-anchor="middle" font-family="Outfit,sans-serif">${w.label}${w.isToday?' ★':''}</text></g>`;
    }
  });
  return `<div style="background:linear-gradient(145deg,rgba(20,20,26,0.85),rgba(12,12,16,0.92));backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:22px;margin-bottom:20px;box-shadow:0 14px 36px rgba(0,0,0,0.45)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--gold,#c9a84c);letter-spacing:1.2px;text-transform:uppercase">Grafik Mingguan (Senin s.d Minggu)</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">Hari belum berjalan tampil kosong</div>
      </div>
      <div style="display:flex;gap:14px;font-size:10px;color:var(--muted2)">
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#5fa97c;border-radius:2px"></span> Pemasukan</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#ff8e8e;border-radius:2px"></span> Pengeluaran Nota</span>
      </div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:200px;overflow:visible">
      <defs>
        <linearGradient id="barRevGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#72c493"/><stop offset="100%" stop-color="#3d7d56"/></linearGradient>
        <linearGradient id="barExpGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff8e8e"/><stop offset="100%" stop-color="#a83b3b"/></linearGradient>
      </defs>
      ${yTicks.map(t=>`<line x1="${padL}" y1="${t.y}" x2="${W-padR}" y2="${t.y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"/><text x="${padL-10}" y="${t.y+4}" font-size="10" fill="var(--muted2)" text-anchor="end" font-family="Outfit,sans-serif">Rp ${t.label}</text>`).join('')}
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(255,255,255,0.15)"/>
      ${barsHTML}
    </svg>
  </div>`;
}

// --- KPI Cards ---
function buildFinancialKpiHTML(data){
  if(!data) return '';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
    <div style="background:linear-gradient(145deg,rgba(212,168,83,0.14),rgba(212,168,83,0.04));border:1px solid rgba(212,168,83,0.3);border-radius:14px;padding:14px">
      <div style="font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:1px">Aktual s.d Hari Ini</div>
      <div style="font-size:18px;font-weight:700;color:var(--gold);font-family:'Playfair Display',serif;margin-top:2px">Rp ${(data.cumActualSoFar||0).toLocaleString('id')}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">Rata-rata Harian: Rp ${(data.meanDailyRev||0).toLocaleString('id')}</div>
    </div>
    <div style="background:linear-gradient(145deg,rgba(68,208,128,0.14),rgba(68,208,128,0.04));border:1px solid rgba(68,208,128,0.3);border-radius:14px;padding:14px">
      <div style="font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:1px">Proyeksi Optimis 🟢</div>
      <div style="font-size:18px;font-weight:700;color:#44d080;font-family:'Playfair Display',serif;margin-top:2px">Rp ${(data.projMonthEndOptimistic||0).toLocaleString('id')}</div>
      <div style="font-size:10px;color:#44d080;margin-top:2px">Akhir Bulan (${data.monthNameStr})</div>
    </div>
    <div style="background:linear-gradient(145deg,rgba(255,107,107,0.14),rgba(255,107,107,0.04));border:1px solid rgba(255,107,107,0.3);border-radius:14px;padding:14px">
      <div style="font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:1px">Proyeksi Konservatif 🔴</div>
      <div style="font-size:18px;font-weight:700;color:#ff6b6b;font-family:'Playfair Display',serif;margin-top:2px">Rp ${(data.projMonthEndLower||0).toLocaleString('id')}</div>
      <div style="font-size:10px;color:#ff6b6b;margin-top:2px">Batas Risiko Bawah</div>
    </div>
  </div>`;
}

// --- Menu Summary rows from an itemMap ---
function _renderMenuRows(itemMap, emptyLabel){
  const raw=Object.values(itemMap);
  const items=_sortMode==='revenue'
    ? raw.sort((a,b)=>b.revenue-a.revenue)
    : raw.sort((a,b)=>b.qty-a.qty);
  if(!items.length) return `<div style="text-align:center;padding:18px;color:rgba(255,255,255,0.35);font-size:13px">${emptyLabel||'Belum ada order'}</div>`;
  const maxVal=_sortMode==='revenue'?(items[0].revenue||1):(items[0].qty||1);
  const rows=items.map((item,idx)=>{
    const barVal=_sortMode==='revenue'?item.revenue:item.qty;
    const pct=Math.round((barVal/maxVal)*100);
    const rankColor=idx===0?'#c9a84c':idx===1?'#aaa':idx===2?'#cd7f32':'rgba(255,255,255,0.3)';
    const medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':`<span style="font-size:11px;color:rgba(255,255,255,0.35);font-weight:700;width:20px;display:inline-block;text-align:center">#${idx+1}</span>`;
    const priorQty=Object.values(_analyticsDataset||{}).filter(d=>d.dateKey<today()).reduce((s,d)=>s+Object.values(d.menuMap||{}).filter(x=>x.id===item.id).reduce((q,x)=>q+x.qty,0),0);const priorDays=Object.values(_analyticsDataset||{}).filter(d=>d.dateKey<today()&&d.txCount).length;const signal=idx<3&&priorDays&&item.qty>priorQty/priorDays*1.2?'Naik dibanding pola':idx<3&&priorDays&&item.qty<priorQty/priorDays*.8?'Turun dibanding pola':idx<3?'Stabil':'';
    return `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;gap:5px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="width:20px;text-align:center;flex-shrink:0;font-size:15px">${medal}</span>
          <span style="font-weight:600;color:#f0ece4;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}${signal?` <small style="color:var(--gold);font-weight:500">· ${signal}</small>`:''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:17px;font-weight:800;color:${rankColor};font-family:'Playfair Display',serif">${item.qty}</span>
          <span style="font-size:10px;color:rgba(255,255,255,0.4)">pcs</span>
          <span style="font-size:12px;font-weight:700;color:#5fa97c">${typeof rp==='function'?rp(item.revenue):'Rp '+item.revenue.toLocaleString('id')}</span>
        </div>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${rankColor},${rankColor}66);border-radius:99px"></div>
      </div>
    </div>`;
  }).join('');
  return `<div id="rkRowsInner">${rows}</div>`;
}

// Toggle sort mode
function setMenuSortMode(mode){
  _sortMode=mode;
  const btnRp=document.getElementById('rkSort-revenue');
  const btnPcs=document.getElementById('rkSort-qty');
  [btnRp,btnPcs].forEach(btn=>{
    if(!btn) return;
    const isActive=(btn.id==='rkSort-revenue'&&mode==='revenue')||(btn.id==='rkSort-qty'&&mode==='qty');
    btn.style.background=isActive?'rgba(212,168,83,0.25)':'transparent';
    btn.style.color=isActive?'var(--gold,#c9a84c)':'rgba(255,255,255,0.35)';
    btn.style.borderColor=isActive?'rgba(212,168,83,0.5)':'rgba(255,255,255,0.1)';
  });
  // Re-render rows with new sort
  const map=_menuMaps[_activePeriod]||{};
  const empty={today:'Belum ada order hari ini',week:'Belum ada order minggu ini',month:'Belum ada order bulan ini'};
  const body=document.getElementById('rkBody');
  if(body) body.innerHTML=_renderMenuRows(map, empty[_activePeriod]||'Belum ada data');
}

// Navigate menu to a different month and fetch its data
async function navigateMenuMonth(offset){
  const now=new Date();
  const curYear=(_menuViewYear!==null)?_menuViewYear:now.getFullYear();
  const curMonth=(_menuViewMonth!==null)?_menuViewMonth:now.getMonth();
  let newYear=curYear, newMonth=curMonth;
  if(offset===999){newYear=now.getFullYear();newMonth=now.getMonth();}
  else{
    newMonth=curMonth+offset;
    if(newMonth>11){newMonth=0;newYear++;}
    if(newMonth<0){newMonth=11;newYear--;}
    if(newYear>now.getFullYear()||(newYear===now.getFullYear()&&newMonth>now.getMonth())){
      newYear=now.getFullYear();newMonth=now.getMonth();
    }
  }
  _menuViewYear=newYear;_menuViewMonth=newMonth;
  const monthKey=menuMonthKey(newYear,newMonth);
  // Update label immediately
  const lbl=document.getElementById('rkMonthLabel');
  if(lbl) lbl.textContent=new Date(newYear,newMonth,1).toLocaleString('id',{month:'long',year:'numeric'});
  // Fetch this month's orders
  const body=document.getElementById('rkBody');
  if(body) body.innerHTML='<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4)"><span style="display:inline-block;width:20px;height:20px;border:2px solid var(--gold-dim);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:8px"></span>Memuat...</div>';
  if(_menuMonthMaps[monthKey]){
    _menuMaps.month=_menuMonthMaps[monthKey];
    if(_activePeriod==='month'&&body) body.innerHTML=_renderMenuRows(_menuMaps.month,`Tidak ada order di ${new Date(newYear,newMonth,1).toLocaleString('id',{month:'long',year:'numeric'})}`);
    return;
  }
  if(Object.keys(_analyticsDataset||{}).length){
    const itemMap={};Object.values(_analyticsDataset).filter(d=>d.dateKey.startsWith(monthKey)).forEach(d=>Object.values(d.menuMap||{}).forEach(i=>{const k=i.id+'|'+i.name;(itemMap[k]??={id:i.id,name:i.name,qty:0,revenue:0});itemMap[k].qty+=i.qty;itemMap[k].revenue+=i.revenue;}));
    _menuMonthMaps[monthKey]=itemMap;_menuMaps.month=itemMap;if(_activePeriod==='month'&&body)body.innerHTML=_renderMenuRows(itemMap,`Tidak ada order di ${new Date(newYear,newMonth,1).toLocaleString('id',{month:'long',year:'numeric'})}`);return;
  }
  const all=getAll();
  const firstDay=new Date(newYear,newMonth,1);
  const totalDays=new Date(newYear,newMonth+1,0).getDate();
  const todayStr=today();
  const dayKeys=[];
  for(let d=1;d<=totalDays;d++){
    const date=new Date(newYear,newMonth,d);
    dayKeys.push(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }
  const snaps=await Promise.all(dayKeys.map(k=>get(ref(db,`orders/${k}`)).catch(()=>null)));
  const itemMap={};
  snaps.forEach(snap=>{
    if(!snap) return;
    const orders=snap.val()||{};
    _aggregateItems(orders,itemMap,all);
  });
  _menuMonthMaps[monthKey]=itemMap;
  _menuMaps.month=itemMap;
  const isCurrentMonth=(newYear===now.getFullYear()&&newMonth===now.getMonth());
  const emptyLabel=isCurrentMonth?'Belum ada order bulan ini':`Tidak ada order di ${new Date(newYear,newMonth,1).toLocaleString('id',{month:'long',year:'numeric'})}`;
  if(body) body.innerHTML=_renderMenuRows(itemMap,emptyLabel);
  // Update badge
  const items=Object.values(itemMap);
  const badge=document.getElementById('rkBadge');
  if(badge) badge.textContent=`${items.length} menu · ${items.reduce((s,i)=>s+i.qty,0)} pcs`;
}


// Switch active period tab in menu summary
function switchMenuPeriod(period){
  _activePeriod=period;
  const now=new Date();
  const selectedKey=menuMonthKey(_menuViewYear!==null?_menuViewYear:now.getFullYear(),_menuViewMonth!==null?_menuViewMonth:now.getMonth());
  const map=period==='month'?(_menuMonthMaps[selectedKey]||_menuMaps.month||{}):(_menuMaps[period]||{});
  const empty={today:'Belum ada order hari ini',week:'Belum ada order minggu ini',month:'Belum ada order bulan ini'};
  const items=Object.values(map);
  const totalQty=items.reduce((s,i)=>s+i.qty,0);

  // Update tab button styles
  ['today','week','month'].forEach(p=>{
    const btn=document.getElementById('rkTab-'+p);
    if(!btn) return;
    btn.style.background=p===period?'rgba(212,168,83,0.2)':'transparent';
    btn.style.color=p===period?'var(--gold,#c9a84c)':'rgba(255,255,255,0.45)';
    btn.style.borderColor=p===period?'rgba(212,168,83,0.5)':'rgba(255,255,255,0.1)';
  });

  // Update count badge
  const badge=document.getElementById('rkBadge');
  if(badge) badge.textContent=`${items.length} menu · ${totalQty} pcs`;

  // Update rows (uses current _sortMode)
  const body=document.getElementById('rkBody');
  if(body) body.innerHTML=_renderMenuRows(map, empty[period]);
}

// --- Full menu summary block with tabs ---
function buildMenuSummaryHTML(){
  const now=new Date();
  const tabStyle='border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 14px;font-size:11px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)';
  const activeStyle='background:rgba(212,168,83,0.2);color:var(--gold,#c9a84c);border-color:rgba(212,168,83,0.5)';
  const sortBase='border:1px solid;border-radius:20px;padding:4px 11px;font-size:10px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;transition:all 0.2s;';
  const sortActiveStyle=sortBase+'background:rgba(212,168,83,0.25);color:var(--gold,#c9a84c);border-color:rgba(212,168,83,0.5)';
  const sortInactiveStyle=sortBase+'background:transparent;color:rgba(255,255,255,0.35);border-color:rgba(255,255,255,0.1)';
  const navBtnStyle='background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#ccc;border-radius:8px;padding:2px 9px;cursor:pointer;font-size:13px;font-family:Outfit,sans-serif;';
  const activeMap=_menuMaps[_activePeriod]||_menuMaps.today||{};
  const todayItems=Object.values(activeMap);
  const totalQty=todayItems.reduce((s,i)=>s+i.qty,0);
  // Build month nav label
  const mvy=(_menuViewYear!==null)?_menuViewYear:now.getFullYear();
  const mvm=(_menuViewMonth!==null)?_menuViewMonth:now.getMonth();
  const mvLabel=new Date(mvy,mvm,1).toLocaleString('id',{month:'long',year:'numeric'});
  const isCurrentMonth=(mvy===now.getFullYear()&&mvm===now.getMonth());
  return `<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px 18px;margin-top:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);font-weight:600">📋 Rangkuman Menu Terjual</span>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button id="rkTab-today" style="${tabStyle};${_activePeriod==='today'?activeStyle:''}" onclick="switchMenuPeriod('today')">Hari Ini</button>
        <button id="rkTab-week" style="${tabStyle};${_activePeriod==='week'?activeStyle:''}" onclick="switchMenuPeriod('week')">Minggu Ini</button>
        <button id="rkTab-month" style="${tabStyle};${_activePeriod==='month'?activeStyle:''}" onclick="switchMenuPeriod('month')">Bulan Ini</button>
        <span id="rkBadge" style="font-size:11px;color:rgba(255,255,255,0.35);margin-left:4px">${todayItems.length} menu · ${totalQty} pcs</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px">Bulan:</span>
      <button style="${navBtnStyle}" onclick="navigateMenuMonth(-1)">&#8249;</button>
      <span id="rkMonthLabel" style="font-size:12px;font-weight:600;color:var(--text);min-width:110px;text-align:center">${mvLabel}</span>
      <button style="${navBtnStyle}" onclick="navigateMenuMonth(1)" ${isCurrentMonth?'disabled style="'+navBtnStyle+'opacity:0.3;cursor:not-allowed"':''}>&#8250;</button>
      ${!isCurrentMonth?'<button style="'+sortBase+'background:rgba(212,168,83,0.1);color:var(--gold,#c9a84c);border-color:rgba(212,168,83,0.3);font-size:10px" onclick="navigateMenuMonth(999)">Hari Ini</button>':''}
      <span style="font-size:10px;color:rgba(255,255,255,0.25);margin-left:4px">|</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px">Sorting:</span>
      <button id="rkSort-qty" style="${_sortMode==='qty'?sortActiveStyle:sortInactiveStyle}" onclick="setMenuSortMode('qty')">📦 Pcs</button>
      <button id="rkSort-revenue" style="${_sortMode==='revenue'?sortActiveStyle:sortInactiveStyle}" onclick="setMenuSortMode('revenue')">💰 Rp</button>
    </div>
    <div id="rkBody">${_renderMenuRows(activeMap,_activePeriod==='month'?'Belum ada order bulan ini':_activePeriod==='week'?'Belum ada order minggu ini':'Belum ada order hari ini')}</div>
  </div>`;
}

// --- Minimize toggle ---
function toggleGroqCard(){
  const wrap=document.getElementById('groqContentWrap');
  const btn=document.getElementById('groqMinimizeBtn');
  if(!wrap||!btn) return;
  const isHidden=wrap.style.display==='none';
  wrap.style.display=isHidden?'block':'none';
  btn.textContent=isHidden?'▲ Minimize':'▼ Sembunyikan';
  localStorage.setItem('mula_analysis_minimized',isHidden?'false':'true');
}

// --- Render the analysis card ---
function showAnalysisResult(data){
  let el=document.getElementById('groqResult');
  if(!el){
    el=document.createElement('div');
    el.id='groqResult';
    el.className='analysis-card';
    el.style.gridColumn='1/-1';
    document.getElementById('analysisBody')?.appendChild(el);
  }
  const timeStr=new Date().toLocaleTimeString('id',{hour:'2-digit',minute:'2-digit'});
  const isMinimized=localStorage.getItem('mula_analysis_minimized')==='true';
  el.innerHTML=`<div class="analysis-kicker" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span style="font-weight:600">📊 Financial Analytics &amp; 3-Tier Forecast — ${timeStr}</span>
    <button id="groqMinimizeBtn" onclick="toggleGroqCard()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:var(--text);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:Outfit,sans-serif">${isMinimized?'▼ Sembunyikan':'▲ Minimize'}</button>
  </div>
  <div id="groqContentWrap" style="display:${isMinimized?'none':'block'}">
    ${buildOperationalInsightHTML(data)}
    ${buildFinancialKpiHTML(data)}
    ${buildForecastMethodHTML(data)}
    ${buildProfessionalMonthlyForecastSVG(data)}
    ${buildForecastVarianceHTML(data)}
    ${buildProfessionalWeeklyChartSVG(data)}
    ${buildWeeklyInsightHTML(data)}
    ${buildMenuSummaryHTML()}
  </div>`;
  el.style.display='block';
}

function showAnalysisLoading(){
  let el=document.getElementById('groqResult');
  if(!el){
    el=document.createElement('div');
    el.id='groqResult';
    el.className='analysis-card';
    el.style.gridColumn='1/-1';
    document.getElementById('analysisBody')?.appendChild(el);
  }
  el.innerHTML='<div class="analysis-note" style="text-align:center;padding:36px"><span style="display:inline-block;width:24px;height:24px;border:3px solid var(--gold-dim);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;margin-right:12px;vertical-align:middle"></span>Menghitung proyeksi kalender finansial...</div>';
  el.style.display='block';
}

async function runAnalysis(){
  if(analysisLoading) return;
  analysisLoading=true;
  const btn=document.getElementById('groqAnalyzeBtn');
  if(btn){btn.textContent='Memuat...';btn.disabled=true;}
  showAnalysisLoading();
  try{
    const data=await gatherAnalysisData(_viewYear,_viewMonth);
    showAnalysisResult(data);
  }catch(e){
    console.error('Analysis failed',e);
    const el=document.getElementById('groqResult');
    if(el) el.innerHTML=`<div class="analysis-note" style="color:var(--red)">Gagal memuat data: ${esc(e.message||'Error')}</div>`;
  }finally{
    analysisLoading=false;
    if(btn){btn.textContent='🔄 Refresh Analisis';btn.disabled=false;}
  }
}

function ensureGroqBtn(){
  const head=document.querySelector('.analysis-head');
  if(!head) return;
  if(!document.getElementById('groqAnalyzeBtn')){
    const btn=document.createElement('button');
    btn.id='groqAnalyzeBtn';
    btn.className='analysis-action';
    btn.style.cssText='background:linear-gradient(135deg,rgba(212,168,83,0.25),rgba(212,168,83,0.08));border:1px solid rgba(212,168,83,0.45);color:var(--gold,#c9a84c);box-shadow:0 4px 16px rgba(0,0,0,0.35);font-weight:600;transition:all 0.2s';
    btn.textContent='🔄 Refresh Analisis';
    btn.addEventListener('click',runAnalysis);
    head.querySelector('div')?.insertAdjacentElement('afterend',btn);
  }
  runAnalysis();
}

// Read-only normalized historical dataset. Forecasts and insights use this single source.
function _analyticsDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function _analyticsMoney(v){const n=typeof v==='number'?v:parseInt(String(v||'').replace(/\D/g,''),10);return Number.isFinite(n)&&n>=0?n:0;}
function _analyticsReceiptTotals(data){const out={};Object.values(data||{}).forEach(r=>{const k=String(r?.date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return;const xs=Array.isArray(r.items)?r.items:(r.items?Object.values(r.items):[]);const total=_analyticsMoney(r.total)||xs.reduce((s,i)=>s+_analyticsMoney(i?.price),0);out[k]=(out[k]||0)+total;});return out;}
function _analyticsValidTx(tx){return !!(tx&&typeof tx==='object'&&tx.items&&typeof tx.items==='object'&&Number.isFinite(Number(tx.total))&&Number(tx.total)>=0&&tx.test!==true&&tx.isTest!==true&&String(tx.status||'').toLowerCase()!=='test');}
function _analyticsDay(key,raw,all,expenses){const d=new Date(`${key}T12:00:00`),menuMap={};let revenue=0,txCount=0,itemQty=0;Object.entries(raw||{}).forEach(([id,tx])=>{if(id==='receipts'||!_analyticsValidTx(tx))return;revenue+=_analyticsMoney(tx.total);txCount++;Object.entries(tx.items||{}).forEach(([iid,data])=>{const m=all.find(x=>x.id===iid);if(!m)return;const lines=typeof buildOrderLines==='function'?buildOrderLines(m,data):[];lines.forEach(line=>{const qty=Math.max(0,Number(line.qty)||0);if(!qty)return;const k=iid+'|'+line.name;if(!menuMap[k])menuMap[k]={id:iid,name:line.name,qty:0,revenue:0};menuMap[k].qty+=qty;menuMap[k].revenue+=_analyticsMoney(line.price||m.price)*qty;itemQty+=qty;});});});return {dateKey:key,revenue,txCount,avgBasket:txCount?revenue/txCount:0,itemQty,menuMap,weekday:d.getDay(),dayOfMonth:d.getDate(),expenses:expenses[key]||0};}
function _analyticsTrimmed(xs){const a=xs.filter(v=>Number.isFinite(v)&&v>=0).sort((x,y)=>x-y);if(!a.length)return 0;const t=a.length>=6?Math.floor(a.length*.15):0;const b=a.slice(t,a.length-t||undefined);return b.reduce((s,v)=>s+v,0)/(b.length||1);}
function _analyticsPct(xs,p){const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a[Math.floor((a.length-1)*p)]:0;}
function _analyticsFillMissingDays(dataset,start,end,all,expenses){for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const key=_analyticsDateKey(d);if(!dataset[key])dataset[key]=_analyticsDay(key,{},all,expenses);}}
async function gatherAnalysisData(viewYear,viewMonth){
  const all=getAll(),now=new Date(),todayStr=today(),year=viewYear==null?now.getFullYear():viewYear,month=viewMonth==null?now.getMonth():viewMonth;
  const prefix=`${year}-${String(month+1).padStart(2,'0')}`,monthStart=`${prefix}-01`,days=new Date(year,month+1,0).getDate(),historyStartDate=new Date(year,3,1),historyStart=_analyticsDateKey(historyStartDate);
  const ordersRef=ref(db,'orders'),scopedOrders=typeof DEMO_MODE!=='undefined'&&DEMO_MODE?ordersRef:ordersRef.orderByKey().startAt(historyStart).endAt(`${prefix}-31`);
  const ordersSnap=await get(scopedOrders).catch(()=>null),expenses=_analyticsReceiptTotals(typeof receipts!=='undefined'?receipts:{}),dataset={};
  Object.entries(ordersSnap?.val()||{}).forEach(([k,v])=>{if(/^\d{4}-\d{2}-\d{2}$/.test(k))dataset[k]=_analyticsDay(k,v,all,expenses);});
  Object.keys(expenses).forEach(k=>{if(!dataset[k])dataset[k]=_analyticsDay(k,{},all,expenses);});
  _analyticsFillMissingDays(dataset,historyStartDate,new Date(`${monthStart}T12:00:00`),all,expenses);
  // Do not let unrecorded calendar days dilute the operating baseline.
  const prior=Object.values(dataset).filter(d=>d.dateKey<monthStart&&d.txCount>0),byWeek={},byDay={},months={};
  prior.forEach(d=>{(byWeek[d.weekday]??=[]).push(d.revenue);(byDay[d.dayOfMonth]??=[]).push(d.revenue);(months[d.dateKey.slice(0,7)]??=[]).push(d);});
  const daily=prior.map(d=>d.revenue),base=_analyticsTrimmed(daily),low=_analyticsPct(daily,.2)||base;
  const monthHistory=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).map(([key,rows])=>({key,total:rows.reduce((sum,row)=>sum+row.revenue,0),days:rows.length}));
  const completedMonths=monthHistory.filter(({key,days})=>days>=new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),0).getDate()*.8).map(row=>row.total);
  const growths=[];for(let i=1;i<completedMonths.length;i++)if(completedMonths[i-1]>0)growths.push(completedMonths[i]/completedMonths[i-1]-1);
  const rawGrowth=Math.max(-.1,Math.min(.18,_analyticsTrimmed(growths)||0)),growth=Math.max(0,rawGrowth);
  const isCurrent=prefix===todayStr.slice(0,7),analysisDateKey=isCurrent?todayStr:`${prefix}-${String(days).padStart(2,'0')}`,monthlyCalendar=[];let actual=0,real=0,opt=0,cons=0,realToDate=0;
  for(let day=1;day<=days;day++){
    const key=_analyticsDateKey(new Date(year,month,day)),row=dataset[key],observed=key<=analysisDateKey,wd=new Date(`${key}T12:00:00`).getDay();
    const weekdayBase=_analyticsTrimmed(byWeek[wd]||[])||base,calendarBase=_analyticsTrimmed(byDay[day]||[])||base,normal=weekdayBase*.7+calendarBase*.3;
    if(observed)actual+=row?.revenue||0;
    real+=normal;opt+=normal*(1+growth);cons+=Math.max(0,low+(normal-low)*.45);
    if(key===analysisDateKey)realToDate=real;
    monthlyCalendar.push({dayNum:day,dateKey:key,revenue:observed?(row?.revenue||0):null,expenses:observed?(row?.expenses||0):null,isPastOrToday:observed,isToday:key===analysisDateKey,cumActual:observed?actual:null,cumRealistic:Math.round(real),cumOptimistic:Math.round(opt),cumLower:Math.round(cons),cumPrediction:Math.round(real)});
  }
  const monday=new Date(now);monday.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));const names=['Sen','Sel','Rab','Kam','Jum','Sab','Min'],weeklyCalendar=[];
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const k=_analyticsDateKey(d),row=dataset[k],future=k>todayStr;weeklyCalendar.push({dateKey:k,dayName:names[i],label:`${names[i]} ${d.getDate()}`,revenue:future?null:(row?.revenue||0),expenses:future?null:(row?.expenses||0),txCount:future?null:(row?.txCount||0),isFuture:future,isToday:k===todayStr});}
  const merge=(rows)=>{const out={};rows.forEach(d=>Object.values(dataset[d.dateKey]?.menuMap||{}).forEach(i=>{const k=i.id+'|'+i.name;(out[k]??={id:i.id,name:i.name,qty:0,revenue:0});out[k].qty+=i.qty;out[k].revenue+=i.revenue;}));return out;};
  const monthRows=monthlyCalendar.filter(d=>d.isPastOrToday),todayRow=dataset[analysisDateKey]||_analyticsDay(analysisDateKey,{},all,expenses);_analyticsDataset=dataset;_menuMaps={today:todayRow.menuMap||{},week:merge(weeklyCalendar),month:merge(monthRows)};_menuMonthMaps[menuMonthKey(year,month)]=_menuMaps.month;
  return {dataset,weeklyCalendar,monthlyCalendar,monthNameStr:new Date(year,month,1).toLocaleString('id',{month:'long',year:'numeric'}),totalDaysInMonth:days,todayDayNum:isCurrent?now.getDate():days,meanDailyRev:Math.round(base),projMonthEndOptimistic:Math.round(opt),projMonthEndRealistic:Math.round(real),projMonthEndLower:Math.round(cons),cumActualSoFar:actual,realisticToDate:Math.round(realToDate),todayStr,viewYear:year,viewMonth:month,analysisDateKey,confidence:prior.length>=60?'Tinggi':prior.length>=20?'Sedang':'Data masih terbatas',historyDays:prior,normalDaily:base,growth,actualDay:todayRow,weekdayPattern:byWeek,monthHistory};
}

function buildOperationalInsightHTML(data){const d=data.actualDay||{},normal=data.normalDaily||0,diff=(d.revenue||0)-normal,pct=normal?Math.round(diff/normal*100):0;const state=!d.txCount?'Data belum cukup':pct>=8?'Diatas normal':pct<=-8?'Dibawah normal':'Normal';const avgNormal=data.historyDays?.length?_analyticsTrimmed(data.historyDays.map(x=>x.avgBasket)):0;const basketDiff=(d.avgBasket||0)-avgNormal;const top=Object.values(d.menuMap||{}).sort((a,b)=>b.revenue-a.revenue)[0],label=data.analysisDateKey===today()?'Hari ini':`Hari ${String(data.analysisDateKey||'').slice(-2)}`;return `<div style="padding:12px 14px;border:1px solid rgba(212,168,83,.2);border-radius:12px;background:rgba(212,168,83,.06);margin-bottom:12px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gold)">${label} dibanding pola normal</div><div style="margin-top:5px;font-weight:700;color:var(--text)">${state}${d.txCount?` · ${diff>=0?'+':''}${rp(diff)} (${pct>=0?'+':''}${pct}%)`:''}</div><div style="font-size:11px;color:var(--muted2);margin-top:3px">Rata-rata basket ${d.txCount?rp(d.avgBasket):'Rp 0'} vs normal ${avgNormal?rp(avgNormal):'belum cukup data'}${avgNormal&&basketDiff?` (${basketDiff>=0?'+':''}${rp(basketDiff)})`:''}${top?` · Pengaruh terbesar: ${esc(top.name)}`:''}</div></div>`;}
function buildWeeklyInsightHTML(data){const rows=(data.weeklyCalendar||[]).filter(x=>!x.isFuture),by={};rows.forEach(x=>(by[x.dayName]??=[]).push(x.revenue||0));const ranked=Object.entries(by).map(([k,v])=>[k,_analyticsTrimmed(v)]).sort((a,b)=>b[1]-a[1]);const normal=data.normalDaily||0;const thisWeek=rows.reduce((s,x)=>s+(x.revenue||0),0),normalWeek=normal*7;return `<div style="font-size:11px;color:var(--muted2);margin:-12px 0 18px;padding:0 4px">${ranked.length?`Terkuat ${ranked[0][0]}, terlemah ${ranked[ranked.length-1][0]}`:'Data belum cukup'}${rows.length?` · Minggu ini ${thisWeek>=normalWeek?'+':''}${Math.round((thisWeek-normalWeek)/(normalWeek||1)*100)}% vs pola hari kerja normal`:''}</div>`;}
function buildForecastMethodHTML(data){const history=(data.monthHistory||[]).filter(x=>x.key!==data.monthNameStr);const labels=history.map(x=>{const [y,m]=x.key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleString('id',{month:'short'})}).join(' · ');const actual=data.cumActualSoFar||0,ref=data.realisticToDate||0,pct=ref?Math.round((actual-ref)/ref*100):0;return `<div class="analysis-method-card"><div class="analysis-kicker">Cara membaca prediksi</div><div class="analysis-method-grid"><div><strong>${history.length||0} bulan</strong><span>riwayat terpakai${labels?` (${labels})`:''}</span></div><div><strong>${data.historyDays?.length||0} hari</strong><span>hari transaksi valid</span></div><div><strong>${rp(data.meanDailyRev||0)}</strong><span>rata-rata hari aktif</span></div><div><strong>${actual?`${pct>=0?'+':''}${pct}%`: '—'}</strong><span>aktual vs realistis saat ini</span></div></div><details><summary>Kenapa angka ini?</summary><p>Referensi memakai pola weekday, pola tanggal dalam bulan, trimmed average, dan tren pertumbuhan dari bulan sebelumnya. Hari tanpa transaksi tidak dimasukkan ke rata-rata operasional.</p></details></div>`;}
function buildForecastVarianceHTML(data){const actual=data.cumActualSoFar||0,ref=data.realisticToDate||0,pct=ref?Math.round((actual-ref)/ref*100):0;const label=data.analysisDateKey===today()?'sampai hari ini':`sampai hari ${String(data.analysisDateKey||'').slice(-2)}`;return `<div style="font-size:11px;color:var(--muted2);margin:-12px 0 18px;padding:0 4px">${actual?`Aktual ${pct>=0?'+':''}${pct}% ${pct>=0?'di atas':'di bawah'} realistis ${label}`:'Data aktual belum cukup'} · Garis referensi tetap statis untuk seluruh bulan</div>`;}
// Updated labels for the forecast row while retaining the existing card placement.
function buildFinancialKpiHTML(data){const confidence=data.confidence==='Tinggi'?'High':data.confidence==='Sedang'?'Medium':'Low';return `<div style="font-size:11px;color:var(--muted2);margin:-4px 0 10px">Neural agent predictions confidence: <strong style="color:var(--gold)">${confidence}</strong></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px"><div class="analysis-card"><div class="analysis-kicker">Aktual bulan berjalan</div><strong style="font-size:18px;color:var(--gold)">${rp(data.cumActualSoFar||0)}</strong></div><div class="analysis-card"><div class="analysis-kicker">Referensi realistis akhir bulan</div><strong style="font-size:18px;color:var(--gold)">${rp(data.projMonthEndRealistic||0)}</strong></div><div class="analysis-card"><div class="analysis-kicker">Potensi optimis akhir bulan</div><strong style="font-size:18px;color:#44d080">${rp(data.projMonthEndOptimistic||0)}</strong></div><div class="analysis-card"><div class="analysis-kicker">Batas konservatif akhir bulan</div><strong style="font-size:18px;color:#ff6b6b">${rp(data.projMonthEndLower||0)}</strong></div></div>`;}
ensureGroqBtn();
if(typeof window!=='undefined'){
  // Do not fetch historical analytics during app startup. The finance tab
  // calls ensureGroqBtn() when it is opened, keeping WebView startup light.
  window.addEventListener('load',()=>{
    if(document.getElementById('tab-keuangan')?.classList.contains('active'))ensureGroqBtn();
  });
}
