"use strict";

// Dynamic season default
(function(){
  const m = new Date().getMonth()+1;
  const opts = {6:"June - early season",7:"July",8:"August",9:"September - peak season",10:"October",11:"November - late season"};
  const label = opts[m] || (m<=5?"June - early season":"November - late season");
  const sel = document.getElementById("month");
  if(sel) for(var i=0;i<sel.options.length;i++) if(sel.options[i].value===label||sel.options[i].value.startsWith(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1])){sel.selectedIndex=i;break;}
})();

const SLIDERS=[{id:"sst",out:"sst-v",fmt:v=>v+"°F"},{id:"shear",out:"shear-v",fmt:v=>v+" kt"},{id:"pressure",out:"pressure-v",fmt:v=>v+" mb"},{id:"humidity",out:"humidity-v",fmt:v=>v+"%"}];
SLIDERS.forEach(function(s){const el=document.getElementById(s.id);if(!el)return;el.addEventListener("input",function(){document.getElementById(s.out).textContent=s.fmt(el.value);updateLive();});});
["region","month"].forEach(function(id){const el=document.getElementById(id);if(el)el.addEventListener("change",updateLive);});

function getClassification(sst,shear,pressure,humidity){
  let s=(sst-70)*1.8-shear*2.5+(1013-pressure)*0.6+(humidity-60)*0.4;
  if(s<10)return{cat:"TD",label:"Tropical Depression",winds:Math.max(25,Math.round(20+s)),cls:"cat-td"};
  if(s<25)return{cat:"TS",label:"Tropical Storm",winds:Math.round(40+s*0.8),cls:"cat-ts"};
  if(s<45)return{cat:"1",label:"Category 1",winds:Math.round(74+(s-25)*0.5),cls:"cat-1"};
  if(s<65)return{cat:"2",label:"Category 2",winds:Math.round(96+(s-45)*0.6),cls:"cat-2"};
  if(s<85)return{cat:"3",label:"Category 3 - Major",winds:Math.round(111+(s-65)*0.5),cls:"cat-3"};
  if(s<105)return{cat:"4",label:"Category 4 - Major",winds:Math.round(130+(s-85)*0.4),cls:"cat-4"};
  return{cat:"5",label:"Category 5 - Catastrophic",winds:Math.min(200,Math.round(157+(s-105)*0.3)),cls:"cat-5"};
}

function getModelData(sst,shear,pressure,humidity,region){
  const base=getClassification(sst,shear,pressure,humidity);
  const ri=sst>=85&&shear<=12&&humidity>=72;
  const sw=region.indexOf("SW Florida")!==-1;
  const cn={TD:0,TS:0.5,"1":1,"2":2,"3":3,"4":4,"5":5};
  const bc=cn[base.cat]||0;
  function ac(adj){const n=Math.min(5,Math.max(0,bc+adj));return n===0?"TD":n<=0.5?"TS":"Cat "+Math.round(n);}
  const ga=shear>20?-1:0,ea=sst>=86?1:0,na=-1,ua=shear<=10?1:0;
  const sp=Math.abs(ga-ea)+Math.abs(na-ua);
  return{
    gfs:{int:ac(ga),track:sw?"Slight right of consensus":"Near consensus",ri:ri&&shear<=15?"Moderate":"Low",lf:sw?"SW Florida coast":"Gulf coast"},
    euro:{int:ac(ea),track:"Left of consensus - stronger ridge",ri:ri?"High - warm eddy favored":"Moderate",lf:sw?"Naples-Fort Myers area":"Gulf coast"},
    nam:{int:ac(na),track:"Near consensus",ri:"Low - regional dry air",lf:sw?"Central FL west coast":"Gulf coast"},
    ukmet:{int:ac(ua),track:shear<=10?"Tracks slightly north":"Right of consensus",ri:ri&&shear<=10?"High":"Moderate",lf:sw?"Tampa Bay - Charlotte Harbor":"Gulf coast"},
    spread:sp<=1?"Low":sp<=2?"Moderate":"High",ri:ri
  };
}

function updateLive(){
  const sst=+document.getElementById("sst").value,shear=+document.getElementById("shear").value;
  const pressure=+document.getElementById("pressure").value,humidity=+document.getElementById("humidity").value;
  const region=document.getElementById("region").value;
  const r=getClassification(sst,shear,pressure,humidity),md=getModelData(sst,shear,pressure,humidity,region);
  const badge=document.getElementById("cat-badge");badge.className="cat-badge "+r.cls;badge.textContent=r.label;
  document.getElementById("sv-winds").textContent=r.winds+" mph";
  document.getElementById("sv-ri").textContent=md.ri?"High":"Low";
  document.getElementById("sv-spread").textContent=md.spread;
  const tm={TD:"Low",TS:"Low-Mod","1":"Moderate","2":"Mod-High","3":"High","4":"Very High","5":"Extreme"};
  document.getElementById("sv-threat").textContent=tm[r.cat];
  const cats=["TD","TS","1","2","3","4","5"],sc={TD:"#808080",TS:"#3a7d44","1":"#2d7dd2","2":"#3a7d44","3":"#c4501a","4":"#b01e1e","5":"#c0392b"};
  const ci=cats.indexOf(r.cat);
  cats.forEach(function(c,i){const el=document.getElementById("s"+i);if(el)el.style.background=i<=ci?sc[c]:"var(--bg4)";});
  [["gfs","gfs"],["euro","euro"],["nam","nam"],["ukmet","uk"]].forEach(function(p){
    const m=md[p[0]];
    document.getElementById(p[1]+"-int").textContent=m.int;
    document.getElementById(p[1]+"-track").textContent=m.track;
    document.getElementById(p[1]+"-ri").textContent=m.ri;
    document.getElementById(p[1]+"-lf").textContent=m.lf;
  });
  drawMap(sst,shear,pressure,region);
}

function drawMap(sst,shear,pressure,region){
  const canvas=document.getElementById("trackMap");
  if(!canvas)return;
  const W=680,H=320;
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d");

  // Projection: lon -100..-78, lat 17..33
  const L0=-100,L1=-78,A0=17,A1=33;
  function px(lon,lat){return[Math.round((lon-L0)/(L1-L0)*W),Math.round((A1-lat)/(A1-A0)*H)];}

  // Ocean
  var grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,"#071425");grad.addColorStop(1,"#0d2040");
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle="rgba(80,120,180,0.12)";ctx.lineWidth=0.5;
  for(var lo=-98;lo<=-80;lo+=2){var a=px(lo,A0),b=px(lo,A1);ctx.beginPath();ctx.moveTo(a[0],H);ctx.lineTo(b[0],0);ctx.stroke();}
  for(var la=18;la<=32;la+=2){var a=px(L0,la);ctx.beginPath();ctx.moveTo(0,a[1]);ctx.lineTo(W,a[1]);ctx.stroke();}

  // Land fill helper
  function land(pts,fill){
    ctx.beginPath();
    pts.forEach(function(p,i){var q=px(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    ctx.strokeStyle="rgba(160,200,120,0.35)";ctx.lineWidth=0.8;ctx.stroke();
  }

  // US top bar
  ctx.fillStyle="#18241a";ctx.fillRect(0,0,W,px(L0,33)[1]);

  // Texas
  land([[-100,33],[-100,26],[-97,26],[-97,28],[-94.5,29.5],[-94,30],[-94,33]],"#1a2a1c");
  // Louisiana
  land([[-94,33],[-94,30],[-93,29.5],[-91,29],[-89.5,29],[-89,29.5],[-88.8,30.3],[-89,31],[-91,31.5],[-94,33]],"#1a2a1c");
  // MS/AL panhandle coast
  land([[-88.8,30.3],[-88.2,30.4],[-87.5,30.4],[-85.5,30.4],[-85,30.0],[-87,30],[-88,29.5],[-88.8,30.3]],"#1a2a1c");
  // Florida
  land([[-87.6,30.6],[-85,29.9],[-84.2,30.1],[-83.2,30.2],[-82.6,29.6],[-82,29.5],[-81.8,28.5],[-81.5,27],[-81.2,26],[-80.4,25.3],[-80.1,25.7],[-80.3,27.5],[-80.8,28.5],[-81.5,30.2],[-84.5,30.2],[-85.5,30.5],[-87.6,30.6]],"#1a2a1c");
  // Georgia/Carolinas coast
  land([[-85.5,30.5],[-82,31],[-81,31.5],[-80,32.5],[-79,33.5],[-79,33],[-81,32],[-83,31],[-85,31],[-85.5,30.5]],"#1a2a1c");

  // Mexico
  land([[-100,28],[-100,24],[-97,19],[-92,19],[-90,21],[-87,21],[-87,17],[-91,17],[-95,19],[-97,26],[-100,28]],"#1a2a1c");
  // Yucatan
  land([[-90,21],[-87,21],[-87,18],[-90,18],[-90,21]],"#1a2a1c");
  // Cuba
  land([[-85,22.5],[-82,23],[-79.5,22],[-78,20],[-80,20],[-83,22],[-85,22.5]],"#1a2a1c");

  // Water labels
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillStyle="rgba(100,160,220,0.4)";ctx.font="italic 11px 'IBM Plex Mono',monospace";
  var gp=px(-90,22.5);ctx.fillText("Gulf of Mexico",gp[0],gp[1]);
  var cp=px(-82.5,18.5);ctx.fillText("Caribbean Sea",cp[0],cp[1]);

  // State labels
  ctx.fillStyle="rgba(180,220,150,0.45)";ctx.font="bold 9px 'IBM Plex Mono',monospace";
  [["FL",px(-82,27.5)],["TX",px(-98,30)],["LA",px(-91.5,30.5)],["MS",px(-89,31.5)],["AL",px(-86.5,31.5)],["GA",px(-83.5,32)]].forEach(function(l){ctx.fillText(l[0],l[1][0],l[1][1]);});

  // Storm tracks
  const sw=region.indexOf("SW Florida")!==-1;
  const ri=sst>=86&&shear<=12;
  var sLon=-93+((1010-pressure)/130)*3;
  var sLat=20+((sst-70)/26)*2;
  var dLon=sw?-81.8:-95.5,dLat=sw?26.2:29.5;
  var N=12;

  var models=[
    {c:"#4a9eff",d:[],la:sw?0.4:-0.2,lo:sw?0.3:0.4},
    {c:"#4caf70",d:[],la:sw?0.7:0.5,lo:sw?-0.4:-0.3},
    {c:"#ff7043",d:[4,3],la:sw?0.1:0.1,lo:sw?0.5:0.6},
    {c:"#9c7eff",d:[2,2],la:sw?0.8:0.4,lo:sw?-0.1:0.2},
  ];

  models.forEach(function(m){
    ctx.strokeStyle=m.c;ctx.lineWidth=1.8;ctx.setLineDash(m.d);
    ctx.beginPath();
    for(var i=0;i<=N;i++){
      var t=i/N,cv=Math.sin(t*Math.PI);
      var lon=sLon+(dLon-sLon)*t+cv*m.lo*(ri?1.3:0.9);
      var lat=sLat+(dLat-sLat)*t+cv*m.la;
      var p=px(lon,lat);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);
    }
    ctx.stroke();
    // endpoint dot
    var ep=px(dLon+m.lo*0.3,dLat+m.la*0.3);
    ctx.setLineDash([]);ctx.beginPath();ctx.arc(ep[0],ep[1],3.5,0,Math.PI*2);ctx.fillStyle=m.c;ctx.fill();
  });

  // Consensus
  ctx.strokeStyle="#ff4444";ctx.lineWidth=1.5;ctx.setLineDash([8,5]);
  ctx.beginPath();
  for(var i=0;i<=N;i++){var t=i/N,p=px(sLon+(dLon-sLon)*t,sLat+(dLat-sLat)*t);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);}
  ctx.stroke();ctx.setLineDash([]);

  // Storm symbol
  var op=px(sLon,sLat);
  const catColor={TD:"#808080",TS:"#3a7d44","1":"#2d7dd2","2":"#3a7d44","3":"#c4501a","4":"#b01e1e","5":"#c0392b"};
  const r2=getClassification(sst,shear,pressure,+document.getElementById("humidity").value);
  ctx.beginPath();ctx.arc(op[0],op[1],11,0,Math.PI*2);ctx.strokeStyle=catColor[r2.cat]||"#c0392b";ctx.lineWidth=2.5;ctx.stroke();
  ctx.beginPath();ctx.arc(op[0],op[1],8,0,Math.PI*2);ctx.fillStyle="#c0392b";ctx.fill();
  ctx.fillStyle="#fff";ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText("L",op[0],op[1]);
  ctx.textAlign="left";ctx.textBaseline="alphabetic";
}

async function runForecast(){
  const btn=document.getElementById("run-btn"),lb=document.getElementById("loading-bar"),lf=document.getElementById("loading-fill"),em=document.getElementById("error-msg"),as=document.getElementById("ai-section"),ao=document.getElementById("ai-output");
  btn.disabled=true;btn.textContent="Analyzing...";em.style.display="none";lb.style.display="block";
  let pct=0;const tick=setInterval(function(){pct=Math.min(pct+3,85);lf.style.width=pct+"%";},200);
  const sst=+document.getElementById("sst").value,shear=+document.getElementById("shear").value;
  const pressure=+document.getElementById("pressure").value,humidity=+document.getElementById("humidity").value;
  const region=document.getElementById("region").value,month=document.getElementById("month").value;
  const question=document.getElementById("question").value.trim();
  const r=getClassification(sst,shear,pressure,humidity),md=getModelData(sst,shear,pressure,humidity,region);
  try{
    const res=await fetch("/api/forecast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sst,shear,pressure,humidity,region,month,question,classification:r.label+" (~"+r.winds+" mph)",modelData:{gfs:md.gfs,euro:md.euro,nam:md.nam,ukmet:md.ukmet,spread:md.spread}})});
    clearInterval(tick);lf.style.width="100%";
    if(!res.ok){const e=await res.json().catch(function(){return{};});throw new Error(e.error||"HTTP "+res.status);}
    const data=await res.json();as.style.display="block";ao.textContent=data.forecast||"No forecast returned.";
    const items=[{label:"GFS confidence",val:md.gfs.ri==="Low"?72:55,color:"#4a9eff"},{label:"ECMWF confidence",val:md.euro.ri.indexOf("High")===0?88:70,color:"#4caf70"},{label:"NAM confidence",val:68,color:"#ff7043"},{label:"UKMET confidence",val:md.ukmet.ri.indexOf("High")===0?82:65,color:"#9c7eff"},{label:"Ensemble consensus",val:md.spread==="Low"?85:md.spread==="Moderate"?68:50,color:"#ff4444"}];
    document.getElementById("consensus-section").innerHTML="<p class='cons-title'>Model confidence</p>"+items.map(function(x){return"<div class='cons-row'><div class='cons-meta'><span>"+x.label+"</span><span class='cons-val'>"+x.val+"%</span></div><div class='cons-track'><div class='cons-fill' style='width:"+x.val+"%;background:"+x.color+";'></div></div></div>";}).join("");
  }catch(err){clearInterval(tick);em.style.display="block";em.textContent="Error: "+err.message;lb.style.display="none";}
  finally{setTimeout(function(){lb.style.display="none";lf.style.width="0%";},600);btn.disabled=false;btn.textContent="Regenerate ensemble analysis";}
}

updateLive();
