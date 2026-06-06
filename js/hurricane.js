"use strict";
const SLIDERS = [
  { id: "sst", out: "sst-v", fmt: v => v + "°F" },
  { id: "shear", out: "shear-v", fmt: v => v + " kt" },
  { id: "pressure", out: "pressure-v", fmt: v => v + " mb" },
  { id: "humidity", out: "humidity-v", fmt: v => v + "%" },
];
SLIDERS.forEach(function(s) {
  const el = document.getElementById(s.id);
  if (!el) return;
  el.addEventListener("input", function() { document.getElementById(s.out).textContent = s.fmt(el.value); updateLive(); });
});
["region","month"].forEach(function(id) { const el = document.getElementById(id); if (el) el.addEventListener("change", updateLive); });

function getClassification(sst, shear, pressure, humidity) {
  let score = (sst-70)*1.8 - shear*2.5 + (1013-pressure)*0.6 + (humidity-60)*0.4;
  if (score < 10) return { cat:"TD", label:"Tropical Depression", winds:Math.max(25,Math.round(20+score)), cls:"cat-td" };
  if (score < 25) return { cat:"TS", label:"Tropical Storm", winds:Math.round(40+score*0.8), cls:"cat-ts" };
  if (score < 45) return { cat:"1", label:"Category 1", winds:Math.round(74+(score-25)*0.5), cls:"cat-1" };
  if (score < 65) return { cat:"2", label:"Category 2", winds:Math.round(96+(score-45)*0.6), cls:"cat-2" };
  if (score < 85) return { cat:"3", label:"Category 3 - Major", winds:Math.round(111+(score-65)*0.5), cls:"cat-3" };
  if (score < 105) return { cat:"4", label:"Category 4 - Major", winds:Math.round(130+(score-85)*0.4), cls:"cat-4" };
  return { cat:"5", label:"Category 5 - Catastrophic", winds:Math.min(200,Math.round(157+(score-105)*0.3)), cls:"cat-5" };
}

function getModelData(sst, shear, pressure, humidity, region) {
  const base = getClassification(sst, shear, pressure, humidity);
  const riCond = sst >= 85 && shear <= 12 && humidity >= 72;
  const gulfSW = region.indexOf("SW Florida") !== -1;
  const catNums = {TD:0,TS:0.5,"1":1,"2":2,"3":3,"4":4,"5":5};
  const bc = catNums[base.cat] || 0;
  function adjCat(adj) { const n = Math.min(5,Math.max(0,bc+adj)); if(n===0) return "TD"; if(n<=0.5) return "TS"; return "Cat "+Math.round(n); }
  const gfsAdj = shear > 20 ? -1 : 0, euroAdj = sst >= 86 ? 1 : 0, namAdj = -1, ukAdj = shear <= 10 ? 1 : 0;
  const spread = Math.abs(gfsAdj-euroAdj) + Math.abs(namAdj-ukAdj);
  return {
    gfs:   { int:adjCat(gfsAdj),  track:gulfSW?"Slight right of consensus":"Near consensus", ri:riCond&&shear<=15?"Moderate":"Low", lf:gulfSW?"SW Florida coast":"Gulf coast" },
    euro:  { int:adjCat(euroAdj), track:"Left of consensus - stronger ridge", ri:riCond?"High - warm eddy favored":"Moderate", lf:gulfSW?"Naples-Fort Myers area":"Gulf coast" },
    nam:   { int:adjCat(namAdj),  track:"Near consensus", ri:"Low - regional dry air", lf:gulfSW?"Central FL west coast":"Gulf coast" },
    ukmet: { int:adjCat(ukAdj),   track:shear<=10?"Tracks slightly north":"Right of consensus", ri:riCond&&shear<=10?"High":"Moderate", lf:gulfSW?"Tampa Bay - Charlotte Harbor":"Gulf coast" },
    spread: spread<=1?"Low":spread<=2?"Moderate":"High", ri:riCond
  };
}

function updateLive() {
  const sst=+document.getElementById("sst").value, shear=+document.getElementById("shear").value;
  const pressure=+document.getElementById("pressure").value, humidity=+document.getElementById("humidity").value;
  const region=document.getElementById("region").value;
  const r=getClassification(sst,shear,pressure,humidity), md=getModelData(sst,shear,pressure,humidity,region);
  const badge=document.getElementById("cat-badge"); badge.className="cat-badge "+r.cls; badge.textContent=r.label;
  document.getElementById("sv-winds").textContent=r.winds+" mph";
  document.getElementById("sv-ri").textContent=md.ri?"High":"Low";
  document.getElementById("sv-spread").textContent=md.spread;
  const tmap={TD:"Low",TS:"Low-Mod","1":"Moderate","2":"Mod-High","3":"High","4":"Very High","5":"Extreme"};
  document.getElementById("sv-threat").textContent=tmap[r.cat];
  const cats=["TD","TS","1","2","3","4","5"], segColors={TD:"#808080",TS:"#3a7d44","1":"#2d7dd2","2":"#3a7d44","3":"#c4501a","4":"#b01e1e","5":"#c0392b"};
  const ci=cats.indexOf(r.cat);
  cats.forEach(function(c,i){const el=document.getElementById("s"+i);el.style.background=i<=ci?segColors[c]:"var(--bg4)";});
  [["gfs","gfs"],["euro","euro"],["nam","nam"],["ukmet","uk"]].forEach(function(pair){
    const m=md[pair[0]];
    document.getElementById(pair[1]+"-int").textContent=m.int;
    document.getElementById(pair[1]+"-track").textContent=m.track;
    document.getElementById(pair[1]+"-ri").textContent=m.ri;
    document.getElementById(pair[1]+"-lf").textContent=m.lf;
  });
  drawTrackMap(sst,shear,pressure,region);
}

function drawTrackMap(sst,shear,pressure,region) {
  const canvas=document.getElementById("trackMap"); if(!canvas) return;
  const W=640,H=300; canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext("2d"), gulfSW=region.indexOf("SW Florida")!==-1, riStrong=sst>=86&&shear<=12;
  function px(lon,lat){return[(lon+100)*4.2+80,(28-lat)*7.5+80];}
  ctx.fillStyle="#131519"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#0e2340"; ctx.beginPath();
  [[-98,30],[-80,30],[-80,23],[-86,23],[-87,27],[-98,28]].forEach(function(p,i){var q=px(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
  ctx.closePath(); ctx.fill();
  ctx.fillStyle="#1f2a1a"; ctx.beginPath();
  [[-87.6,30.5],[-85,29.8],[-83.5,30],[-82,29.5],[-81.5,28.5],[-81.8,27],[-81.5,26],[-80.5,25.5],[-80.2,26],[-80.3,28],[-80.8,29.5],[-81.5,31],[-84,30.2],[-87,30.5]].forEach(function(p,i){var q=px(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
  ctx.closePath(); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=0.5; ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,0.3)"; ctx.font="11px monospace";
  var glp=px(-92,26); ctx.fillText("Gulf of Mexico",glp[0],glp[1]);
  var flp=px(-82.8,27.8); ctx.fillText("Florida",flp[0],flp[1]);
  var startLon=-93+((1010-pressure)/130)*3, startLat=23+((sst-70)/26)*1.5;
  var destLon=gulfSW?-81.8:-95, destLat=gulfSW?26.2:29.5, STEPS=8;
  var models=[
    {color:"#2d7dd2",dash:[],latOff:gulfSW?0.3:-0.2,lonOff:gulfSW?0.2:0.3},
    {color:"#3a7d44",dash:[],latOff:gulfSW?0.5:0.4,lonOff:gulfSW?-0.3:-0.2},
    {color:"#c4501a",dash:[4,3],latOff:gulfSW?0:0.1,lonOff:gulfSW?0.4:0.5},
    {color:"#6b47c2",dash:[2,2],latOff:gulfSW?0.6:0.3,lonOff:gulfSW?-0.1:0.2}
  ];
  models.forEach(function(m){
    ctx.beginPath(); ctx.strokeStyle=m.color; ctx.lineWidth=2; ctx.setLineDash(m.dash);
    for(var i=0;i<=STEPS;i++){var t=i/STEPS,lon=startLon+(destLon-startLon)*t+Math.sin(t*Math.PI)*m.lonOff*(riStrong?1.2:0.8),lat=startLat+(destLat-startLat)*t+Math.sin(t*Math.PI*0.7)*m.latOff,p=px(lon,lat);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);}
    ctx.stroke(); var ep=px(destLon+m.lonOff*0.3,destLat+m.latOff*0.3); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(ep[0],ep[1],3.5,0,Math.PI*2); ctx.fillStyle=m.color; ctx.fill();
  });
  ctx.beginPath(); ctx.strokeStyle="#c0392b"; ctx.lineWidth=2; ctx.setLineDash([6,4]);
  for(var i=0;i<=STEPS;i++){var t=i/STEPS,p=px(startLon+(destLon-startLon)*t,startLat+(destLat-startLat)*t);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);}
  ctx.stroke(); ctx.setLineDash([]);
  var op=px(startLon,startLat); ctx.beginPath(); ctx.arc(op[0],op[1],7,0,Math.PI*2); ctx.fillStyle="#c0392b"; ctx.fill();
  ctx.fillStyle="#fff"; ctx.font="bold 9px monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("L",op[0],op[1]); ctx.textAlign="left"; ctx.textBaseline="alphabetic";
}

async function runForecast() {
  const btn=document.getElementById("run-btn"), loadBar=document.getElementById("loading-bar"), loadFill=document.getElementById("loading-fill"), errMsg=document.getElementById("error-msg"), aiSec=document.getElementById("ai-section"), aiOut=document.getElementById("ai-output");
  btn.disabled=true; btn.textContent="Analyzing..."; errMsg.style.display="none"; loadBar.style.display="block";
  let pct=0; const ticker=setInterval(function(){pct=Math.min(pct+3,85);loadFill.style.width=pct+"%";},200);
  const sst=+document.getElementById("sst").value, shear=+document.getElementById("shear").value, pressure=+document.getElementById("pressure").value, humidity=+document.getElementById("humidity").value;
  const region=document.getElementById("region").value, month=document.getElementById("month").value, question=document.getElementById("question").value.trim();
  const r=getClassification(sst,shear,pressure,humidity), md=getModelData(sst,shear,pressure,humidity,region);
  try {
    const res=await fetch("/api/forecast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sst,shear,pressure,humidity,region,month,question,classification:r.label+" (~"+r.winds+" mph)",modelData:{gfs:md.gfs,euro:md.euro,nam:md.nam,ukmet:md.ukmet,spread:md.spread}})});
    clearInterval(ticker); loadFill.style.width="100%";
    if(!res.ok){const err=await res.json().catch(function(){return{};});throw new Error(err.error||"HTTP "+res.status);}
    const data=await res.json(); aiSec.style.display="block"; aiOut.textContent=data.forecast||"No forecast returned.";
    const items=[{label:"GFS confidence",val:md.gfs.ri==="Low"?72:55,color:"#2d7dd2"},{label:"ECMWF confidence",val:md.euro.ri.indexOf("High")===0?88:70,color:"#3a7d44"},{label:"NAM confidence",val:68,color:"#c4501a"},{label:"UKMET confidence",val:md.ukmet.ri.indexOf("High")===0?82:65,color:"#6b47c2"},{label:"Ensemble consensus",val:md.spread==="Low"?85:md.spread==="Moderate"?68:50,color:"#c0392b"}];
    document.getElementById("consensus-section").innerHTML="<p class='cons-title'>Model confidence</p>"+items.map(function(x){return"<div class='cons-row'><div class='cons-meta'><span>"+x.label+"</span><span class='cons-val'>"+x.val+"%</span></div><div class='cons-track'><div class='cons-fill' style='width:"+x.val+"%;background:"+x.color+";'></div></div></div>";}).join("");
  } catch(err){clearInterval(ticker);errMsg.style.display="block";errMsg.textContent="Error: "+err.message;loadBar.style.display="none";}
  finally{setTimeout(function(){loadBar.style.display="none";loadFill.style.width="0%";},600);btn.disabled=false;btn.textContent="Regenerate ensemble analysis";}
}
updateLive();
