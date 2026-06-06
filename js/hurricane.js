"use strict";

// ── Dynamic season default ──────────────────────────────────────────────────
(function setSeasonDefault() {
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12
  const map = {
    1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",
    7:"July",8:"August",9:"September",10:"October",11:"November",12:"December"
  };
  const peakMonths = {6:"June - early season",7:"July",8:"August",9:"September - peak season",10:"October",11:"November - late season"};
  const label = peakMonths[m] || (m <= 5 ? "June - early season" : "November - late season");
  const sel = document.getElementById("month");
  if (sel) {
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === label || sel.options[i].value.startsWith(map[m])) {
        sel.selectedIndex = i; break;
      }
    }
  }
})();

// ── Sliders ─────────────────────────────────────────────────────────────────
const SLIDERS = [
  { id:"sst",      out:"sst-v",      fmt:v=>v+"°F" },
  { id:"shear",    out:"shear-v",    fmt:v=>v+" kt" },
  { id:"pressure", out:"pressure-v", fmt:v=>v+" mb" },
  { id:"humidity", out:"humidity-v", fmt:v=>v+"%" },
];
SLIDERS.forEach(function(s){
  const el=document.getElementById(s.id); if(!el) return;
  el.addEventListener("input",function(){document.getElementById(s.out).textContent=s.fmt(el.value);updateLive();});
});
["region","month"].forEach(function(id){const el=document.getElementById(id);if(el)el.addEventListener("change",updateLive);});

// ── Classification ───────────────────────────────────────────────────────────
function getClassification(sst,shear,pressure,humidity){
  let score=(sst-70)*1.8-shear*2.5+(1013-pressure)*0.6+(humidity-60)*0.4;
  if(score<10) return{cat:"TD",label:"Tropical Depression",winds:Math.max(25,Math.round(20+score)),cls:"cat-td"};
  if(score<25) return{cat:"TS",label:"Tropical Storm",winds:Math.round(40+score*0.8),cls:"cat-ts"};
  if(score<45) return{cat:"1",label:"Category 1",winds:Math.round(74+(score-25)*0.5),cls:"cat-1"};
  if(score<65) return{cat:"2",label:"Category 2",winds:Math.round(96+(score-45)*0.6),cls:"cat-2"};
  if(score<85) return{cat:"3",label:"Category 3 - Major",winds:Math.round(111+(score-65)*0.5),cls:"cat-3"};
  if(score<105) return{cat:"4",label:"Category 4 - Major",winds:Math.round(130+(score-85)*0.4),cls:"cat-4"};
  return{cat:"5",label:"Category 5 - Catastrophic",winds:Math.min(200,Math.round(157+(score-105)*0.3)),cls:"cat-5"};
}

// ── Model data ───────────────────────────────────────────────────────────────
function getModelData(sst,shear,pressure,humidity,region){
  const base=getClassification(sst,shear,pressure,humidity);
  const riCond=sst>=85&&shear<=12&&humidity>=72;
  const gulfSW=region.indexOf("SW Florida")!==-1;
  const catNums={TD:0,TS:0.5,"1":1,"2":2,"3":3,"4":4,"5":5};
  const bc=catNums[base.cat]||0;
  function adjCat(adj){const n=Math.min(5,Math.max(0,bc+adj));if(n===0)return"TD";if(n<=0.5)return"TS";return"Cat "+Math.round(n);}
  const gfsAdj=shear>20?-1:0,euroAdj=sst>=86?1:0,namAdj=-1,ukAdj=shear<=10?1:0;
  const spread=Math.abs(gfsAdj-euroAdj)+Math.abs(namAdj-ukAdj);
  return{
    gfs:{int:adjCat(gfsAdj),track:gulfSW?"Slight right of consensus":"Near consensus",ri:riCond&&shear<=15?"Moderate":"Low",lf:gulfSW?"SW Florida coast":"Gulf coast"},
    euro:{int:adjCat(euroAdj),track:"Left of consensus - stronger ridge",ri:riCond?"High - warm eddy favored":"Moderate",lf:gulfSW?"Naples-Fort Myers area":"Gulf coast"},
    nam:{int:adjCat(namAdj),track:"Near consensus",ri:"Low - regional dry air",lf:gulfSW?"Central FL west coast":"Gulf coast"},
    ukmet:{int:adjCat(ukAdj),track:shear<=10?"Tracks slightly north":"Right of consensus",ri:riCond&&shear<=10?"High":"Moderate",lf:gulfSW?"Tampa Bay - Charlotte Harbor":"Gulf coast"},
    spread:spread<=1?"Low":spread<=2?"Moderate":"High",ri:riCond
  };
}

// ── Live update ──────────────────────────────────────────────────────────────
function updateLive(){
  const sst=+document.getElementById("sst").value,shear=+document.getElementById("shear").value;
  const pressure=+document.getElementById("pressure").value,humidity=+document.getElementById("humidity").value;
  const region=document.getElementById("region").value;
  const r=getClassification(sst,shear,pressure,humidity),md=getModelData(sst,shear,pressure,humidity,region);
  const badge=document.getElementById("cat-badge");badge.className="cat-badge "+r.cls;badge.textContent=r.label;
  document.getElementById("sv-winds").textContent=r.winds+" mph";
  document.getElementById("sv-ri").textContent=md.ri?"High":"Low";
  document.getElementById("sv-spread").textContent=md.spread;
  const tmap={TD:"Low",TS:"Low-Mod","1":"Moderate","2":"Mod-High","3":"High","4":"Very High","5":"Extreme"};
  document.getElementById("sv-threat").textContent=tmap[r.cat];
  const cats=["TD","TS","1","2","3","4","5"],segColors={TD:"#808080",TS:"#3a7d44","1":"#2d7dd2","2":"#3a7d44","3":"#c4501a","4":"#b01e1e","5":"#c0392b"};
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

// ── Map projection: lon/lat -> canvas x/y ───────────────────────────────────
// Viewport: lon -100 to -78, lat 17 to 33 (Gulf + Caribbean + SE US)
function drawTrackMap(sst,shear,pressure,region){
  const canvas=document.getElementById("trackMap");if(!canvas)return;
  const W=680,H=320;canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d");

  const LON0=-100,LON1=-78,LAT0=17,LAT1=33;
  function px(lon,lat){
    return[
      Math.round((lon-LON0)/(LON1-LON0)*W),
      Math.round((LAT1-lat)/(LAT1-LAT0)*H)
    ];
  }

  // ── Ocean background gradient ─────────────────────────────────────────────
  const oceanGrad=ctx.createLinearGradient(0,0,0,H);
  oceanGrad.addColorStop(0,"#0a1628");
  oceanGrad.addColorStop(1,"#0e2040");
  ctx.fillStyle=oceanGrad;ctx.fillRect(0,0,W,H);

  // ── Gulf depth shading (shallow shelf warm colors) ────────────────────────
  // West Florida shelf (shallow, lighter)
  ctx.fillStyle="rgba(20,60,100,0.5)";ctx.beginPath();
  var shelf=[[-84,24.5],[-82,24],[-81.5,25.5],[-81.8,27],[-82.5,28],[-83.5,29.5],[-84.5,30],[-85,29],[-84,24.5]];
  shelf.forEach(function(p,i){var q=px(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
  ctx.closePath();ctx.fill();

  // Loop Current (slightly warmer tint in central Gulf)
  var loopGrad=ctx.createRadialGradient(px(-87,24)[0],px(-87,24)[1],10,px(-87,24)[0],px(-87,24)[1],120);
  loopGrad.addColorStop(0,"rgba(30,80,40,0.15)");
  loopGrad.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=loopGrad;ctx.fillRect(0,0,W,H);

  // ── Land masses ───────────────────────────────────────────────────────────
  function drawLand(poly,fill,stroke){
    ctx.beginPath();
    poly.forEach(function(p,i){var q=px(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=0.8;ctx.stroke();}
  }

  // Mexico
  drawLand([[-100,33],[-97,26],[-95,19],[-91,17],[-87,17],[-85,21],[-87,22],[-90,21],[-92,19],[-94,18],[-97,19],[-99,22],[-100,28],[-100,33]],"#1e2a14","#2d3d1e");

  // Cuba
  drawLand([[-85,22.5],[-82,23],[-80,23.2],[-78,22],[-77.5,20],[-80,20],[-83,22],[-85,22.5]],"#1e2a14","#2d3d1e");

  // Yucatan peninsula
  drawLand([[-90,21],[-87,21],[-87,18],[-90,18],[-92,19],[-90,21]],"#1e2a14","#2d3d1e");

  // US mainland - SE states
  // Texas coast
  drawLand([[-100,33],[-100,27],[-97,26],[-97,28],[-95,29],[-94,30],[-94,33],[-100,33]],"#1c2816","#28381e");
  // Louisiana
  drawLand([[-94,33],[-94,30],[-93,29.5],[-91,29],[-90,28.7],[-89.5,29],[-89,29],[-88.5,30],[-88,30.5],[-89,31],[-91,31],[-93,31.5],[-94,33]],"#1c2816","#28381e");
  // Mississippi/Alabama coast
  drawLand([[-88.5,30],[-88,30.5],[-87.5,30.5],[-87,30.3],[-85.5,30.5],[-85,30],[-87,30],[-88,29.5],[-88.5,30]],"#1c2816","#28381e");
  // Florida panhandle + peninsula
  drawLand([[-87.6,30.5],[-85,29.9],[-84,30.1],[-83,30.2],[-82.5,29.6],[-82,29.5],[-81.8,28.5],[-81.5,27],[-81.2,26],[-80.3,25.2],[-80.1,25.8],[-80.3,27.5],[-80.7,28.5],[-81.5,30],[-82.5,30.3],[-84.5,30.2],[-85.5,30.5],[-87.6,30.5]],"#1c2816","#28381e");
  // Georgia/SC coast
  drawLand([[-85.5,30.5],[-83,32],[-80,32.5],[-79,33],[-78,33.5],[-78,33],[-80,32],[-81,31],[-82,31],[-84,31],[-85.5,30.5]],"#1c2816","#28381e");
  // US top fill
  ctx.fillStyle="#1c2816";ctx.fillRect(0,0,W,px(LON0,33)[1]);

  // ── Coastline crisp outline ────────────────────────────────────────────────
  ctx.strokeStyle="rgba(180,210,160,0.5)";ctx.lineWidth=1;
  // FL peninsula outline
  ctx.beginPath();
  [[-87.6,30.5],[-85,29.9],[-84,30.1],[-83,30.2],[-82.5,29.6],[-82,29.5],[-81.8,28.5],[-81.5,27],[-81.2,26],[-80.3,25.2],[-80.1,25.8],[-80.3,27.5],[-80.7,28.5],[-81.5,30]].forEach(function(p,i){var q=px(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
  ctx.stroke();

  // ── State borders (dashed) ─────────────────────────────────────────────────
  ctx.strokeStyle="rgba(150,180,130,0.25)";ctx.lineWidth=0.7;ctx.setLineDash([4,4]);
  // FL/GA border
  var fa=px(-85,31),fb=px(-81,31);ctx.beginPath();ctx.moveTo(fa[0],fa[1]);ctx.lineTo(fb[0],fb[1]);ctx.stroke();
  // TX/LA border
  var ta=px(-94,33),tb=px(-94,30);ctx.beginPath();ctx.moveTo(ta[0],ta[1]);ctx.lineTo(tb[0],tb[1]);ctx.stroke();
  ctx.setLineDash([]);

  // ── Water labels ──────────────────────────────────────────────────────────
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillStyle="rgba(120,170,220,0.45)";ctx.font="italic 11px 'IBM Plex Mono', monospace";
  var gom=px(-90,23);ctx.fillText("Gulf of Mexico",gom[0],gom[1]);
  var cb=px(-83,18.5);ctx.fillText("Caribbean Sea",cb[0],cb[1]);

  // ── State labels ──────────────────────────────────────────────────────────
  ctx.fillStyle="rgba(180,210,160,0.4)";ctx.font="9px 'IBM Plex Mono', monospace";
  var labels=[["FL",px(-82.5,28)],["GA",px(-83,32)],["LA",px(-91.5,31)],["TX",px(-97.5,31)],["MS",px(-89,32)],["AL",px(-86.5,32)]];
  labels.forEach(function(l){ctx.fillText(l[0],l[1][0],l[1][1]);});

  // ── Grid lines ────────────────────────────────────────────────────────────
  ctx.strokeStyle="rgba(100,150,200,0.08)";ctx.lineWidth=0.5;
  for(var lon=-98;lon<=-80;lon+=2){var p=px(lon,LAT0),q=px(lon,LAT1);ctx.beginPath();ctx.moveTo(p[0],H);ctx.lineTo(q[0],0);ctx.stroke();}
  for(var lat=18;lat<=32;lat+=2){var p=px(LON0,lat),q=px(LON1,lat);ctx.beginPath();ctx.moveTo(0,p[1]);ctx.lineTo(W,q[1]);ctx.stroke();}

  // ── Storm tracks ─────────────────────────────────────────────────────────
  const gulfSW=region.indexOf("SW Florida")!==-1;
  const riStrong=sst>=86&&shear<=12;
  var startLon=-93+((1010-pressure)/130)*3;
  var startLat=21+((sst-70)/26)*2;
  var destLon=gulfSW?-81.8:-95.5;
  var destLat=gulfSW?26.2:29.5;
  var STEPS=12;

  var models=[
    {color:"#4a9eff",dash:[],latOff:gulfSW?0.4:-0.2,lonOff:gulfSW?0.3:0.3,name:"GFS"},
    {color:"#4caf70",dash:[],latOff:gulfSW?0.7:0.5,lonOff:gulfSW?-0.4:-0.3,name:"EURO"},
    {color:"#ff7043",dash:[4,3],latOff:gulfSW?0.1:0.1,lonOff:gulfSW?0.5:0.6,name:"NAM"},
    {color:"#9c7eff",dash:[2,2],latOff:gulfSW?0.8:0.4,lonOff:gulfSW?-0.1:0.2,name:"UKMET"},
  ];

  // Draw track glow + line
  models.forEach(function(m){
    // Glow
    ctx.beginPath();ctx.strokeStyle=m.color.replace(")",",0.2)").replace("rgb","rgba").replace("#","rgba(").replace(/rgba(([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/,function(x,r,g,b){return"rgba("+parseInt(r,16)+","+parseInt(g,16)+","+parseInt(b,16);});
    ctx.lineWidth=6;ctx.setLineDash([]);
    // Fallback: just do a wide stroke
    ctx.strokeStyle=m.color+"88";ctx.lineWidth=5;ctx.setLineDash(m.dash);
    ctx.beginPath();
    for(var i=0;i<=STEPS;i++){
      var t=i/STEPS;
      var curve=Math.sin(t*Math.PI);
      var lon=startLon+(destLon-startLon)*t+curve*m.lonOff*(riStrong?1.3:0.9);
      var lat=startLat+(destLat-startLat)*t+curve*m.latOff;
      var p=px(lon,lat);
      i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);
    }
    ctx.stroke();
    // Crisp line on top
    ctx.strokeStyle=m.color;ctx.lineWidth=1.8;ctx.setLineDash(m.dash);
    ctx.beginPath();
    for(var i=0;i<=STEPS;i++){
      var t=i/STEPS;var curve=Math.sin(t*Math.PI);
      var lon=startLon+(destLon-startLon)*t+curve*m.lonOff*(riStrong?1.3:0.9);
      var lat=startLat+(destLat-startLat)*t+curve*m.latOff;
      var p=px(lon,lat);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);
    }
    ctx.stroke();
    // Endpoint dot
    var t=1,curve=Math.sin(Math.PI);
    var epLon=destLon+m.lonOff*0.3,epLat=destLat+m.latOff*0.3;
    var ep=px(epLon,epLat);
    ctx.setLineDash([]);ctx.beginPath();ctx.arc(ep[0],ep[1],4,0,Math.PI*2);
    ctx.fillStyle=m.color;ctx.fill();
  });

  // Consensus track
  ctx.beginPath();ctx.strokeStyle="#ff4444";ctx.lineWidth=1.5;ctx.setLineDash([8,5]);
  for(var i=0;i<=STEPS;i++){
    var t=i/STEPS,p=px(startLon+(destLon-startLon)*t,startLat+(destLat-startLat)*t);
    i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);
  }
  ctx.stroke();ctx.setLineDash([]);

  // ── Storm origin symbol ───────────────────────────────────────────────────
  var op=px(startLon,startLat);
  // Outer glow ring
  ctx.beginPath();ctx.arc(op[0],op[1],13,0,Math.PI*2);
  ctx.fillStyle="rgba(192,57,43,0.2)";ctx.fill();
  ctx.beginPath();ctx.arc(op[0],op[1],9,0,Math.PI*2);
  ctx.fillStyle="#c0392b";ctx.fill();
  ctx.fillStyle="#fff";ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText("L",op[0],op[1]);

  // ── Intensity color ring at origin based on category ─────────────────────
  const r2=getClassification(sst,shear,pressure,humidity);
  const catColor={TD:"#808080",TS:"#3a7d44","1":"#2d7dd2","2":"#3a7d44","3":"#c4501a","4":"#b01e1e","5":"#c0392b"};
  ctx.beginPath();ctx.arc(op[0],op[1],11,0,Math.PI*2);
  ctx.strokeStyle=catColor[r2.cat]||"#fff";ctx.lineWidth=2.5;ctx.stroke();

  ctx.textAlign="left";ctx.textBaseline="alphabetic";
}

// ── AI forecast ───────────────────────────────────────────────────────────────
async function runForecast(){
  const btn=document.getElementById("run-btn"),loadBar=document.getElementById("loading-bar"),loadFill=document.getElementById("loading-fill"),errMsg=document.getElementById("error-msg"),aiSec=document.getElementById("ai-section"),aiOut=document.getElementById("ai-output");
  btn.disabled=true;btn.textContent="Analyzing...";errMsg.style.display="none";loadBar.style.display="block";
  let pct=0;const ticker=setInterval(function(){pct=Math.min(pct+3,85);loadFill.style.width=pct+"%";},200);
  const sst=+document.getElementById("sst").value,shear=+document.getElementById("shear").value,pressure=+document.getElementById("pressure").value,humidity=+document.getElementById("humidity").value;
  const region=document.getElementById("region").value,month=document.getElementById("month").value,question=document.getElementById("question").value.trim();
  const r=getClassification(sst,shear,pressure,humidity),md=getModelData(sst,shear,pressure,humidity,region);
  try{
    const res=await fetch("/api/forecast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sst,shear,pressure,humidity,region,month,question,classification:r.label+" (~"+r.winds+" mph)",modelData:{gfs:md.gfs,euro:md.euro,nam:md.nam,ukmet:md.ukmet,spread:md.spread}})});
    clearInterval(ticker);loadFill.style.width="100%";
    if(!res.ok){const err=await res.json().catch(function(){return{};});throw new Error(err.error||"HTTP "+res.status);}
    const data=await res.json();aiSec.style.display="block";aiOut.textContent=data.forecast||"No forecast returned.";
    const items=[{label:"GFS confidence",val:md.gfs.ri==="Low"?72:55,color:"#4a9eff"},{label:"ECMWF confidence",val:md.euro.ri.indexOf("High")===0?88:70,color:"#4caf70"},{label:"NAM confidence",val:68,color:"#ff7043"},{label:"UKMET confidence",val:md.ukmet.ri.indexOf("High")===0?82:65,color:"#9c7eff"},{label:"Ensemble consensus",val:md.spread==="Low"?85:md.spread==="Moderate"?68:50,color:"#ff4444"}];
    document.getElementById("consensus-section").innerHTML="<p class='cons-title'>Model confidence</p>"+items.map(function(x){return"<div class='cons-row'><div class='cons-meta'><span>"+x.label+"</span><span class='cons-val'>"+x.val+"%</span></div><div class='cons-track'><div class='cons-fill' style='width:"+x.val+"%;background:"+x.color+";'></div></div></div>";}).join("");
  }catch(err){clearInterval(ticker);errMsg.style.display="block";errMsg.textContent="Error: "+err.message;loadBar.style.display="none";}
  finally{setTimeout(function(){loadBar.style.display="none";loadFill.style.width="0%";},600);btn.disabled=false;btn.textContent="Regenerate ensemble analysis";}
}

updateLive();
