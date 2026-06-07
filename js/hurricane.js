"use strict";

// Dynamic season default
(function(){
  const m = new Date().getMonth()+1;
  const opts = {6:"June - early season",7:"July",8:"August",9:"September - peak season",10:"October",11:"November - late season"};
  const label = opts[m] || (m<=5?"June - early season":"November - late season");
  const sel = document.getElementById("month");
  if(sel) for(var i=0;i<sel.options.length;i++) if(sel.options[i].value===label){sel.selectedIndex=i;break;}
})();

const SLIDERS=[{id:"sst",out:"sst-v",fmt:v=>v+"\u00b0F"},{id:"shear",out:"shear-v",fmt:v=>v+" kt"},{id:"pressure",out:"pressure-v",fmt:v=>v+" mb"},{id:"humidity",out:"humidity-v",fmt:v=>v+"%"}];
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

// Region configs: viewport bounds + storm origin + landfall destination
var REGION_CONFIG = {
  "Gulf of Mexico - SW Florida approach": {l0:-95,l1:-79,a0:21,a1:32,   sLon:-89,sLat:22.5,dLon:-82,  dLat:26.3,wlbl:"Gulf of Mexico",wlon:-88,wlat:24},
  "Gulf of Mexico - Texas/Louisiana":     {l0:-99,l1:-83,a0:22,a1:33,   sLon:-93,sLat:21.5,dLon:-93.5,dLat:29.5,wlbl:"Gulf of Mexico",wlon:-92,wlat:25},
  "Western Caribbean":                    {l0:-92,l1:-76,a0:13,a1:26,   sLon:-84,sLat:14.5,dLon:-81,  dLat:22.5,wlbl:"Caribbean Sea", wlon:-85,wlat:17},
  "Eastern Caribbean":                    {l0:-85,l1:-60,a0:11,a1:24,   sLon:-67,sLat:13,  dLon:-78,  dLat:21.5,wlbl:"Atlantic Ocean",wlon:-73,wlat:16},
  "Atlantic Basin - open ocean":          {l0:-88,l1:-58,a0:17,a1:36,   sLon:-65,sLat:19,  dLon:-75,  dLat:33.5,wlbl:"Atlantic Ocean",wlon:-73,wlat:26},
  "Bay of Campeche":                      {l0:-98,l1:-86,a0:16,a1:27,   sLon:-93,sLat:18.5,dLon:-89.5,dLat:24,  wlbl:"Bay of Campeche",wlon:-92,wlat:20}
};


function drawMap(sst,shear,pressure,region){
  var canvas=document.getElementById("trackMap");
  if(!canvas)return;
  var W=720,H=340;canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext("2d");
  var rc=REGION_CONFIG[region]||REGION_CONFIG["Gulf of Mexico - SW Florida approach"];
  var l0=rc.l0,l1=rc.l1,a0=rc.a0,a1=rc.a1;
  function proj(lon,lat){return[(lon-l0)/(l1-l0)*W,(a1-lat)/(a1-a0)*H];}

  var seaG=ctx.createLinearGradient(0,0,0,H);
  seaG.addColorStop(0,"#0a2240");seaG.addColorStop(1,"#060f20");
  ctx.fillStyle=seaG;ctx.fillRect(0,0,W,H);

  ctx.strokeStyle="rgba(20,70,130,0.06)";ctx.lineWidth=1;
  for(var y=20;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(W*.3,y-3,W*.7,y+3,W,y);ctx.stroke();}

  if(region.indexOf("Gulf")!==-1||region.indexOf("Campeche")!==-1){
    var cx2=proj((l0+l1)/2,(a0+a1)*0.4);
    var warm=ctx.createRadialGradient(cx2[0],cx2[1],0,cx2[0],cx2[1],180);
    warm.addColorStop(0,"rgba(15,80,60,0.10)");warm.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=warm;ctx.fillRect(0,0,W,H);
  }

  var lg=ctx.createLinearGradient(0,0,0,H);lg.addColorStop(0,"#1e3514");lg.addColorStop(1,"#192e10");
  function land(pts){
    ctx.shadowColor="rgba(0,0,0,0.65)";ctx.shadowBlur=6;
    ctx.beginPath();
    pts.forEach(function(p,i){var q=proj(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
    ctx.closePath();ctx.fillStyle=lg;ctx.fill();ctx.shadowBlur=0;
    ctx.beginPath();
    pts.forEach(function(p,i){var q=proj(p[0],p[1]);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);});
    ctx.closePath();ctx.strokeStyle="rgba(155,210,110,0.45)";ctx.lineWidth=0.85;ctx.stroke();
  }

  // US mainland — top edge at lat 50 so canvas clips cleanly at viewport top
  land([[-100,50],[-74,50],[-74,36],[-75,35.5],[-76,34.5],[-79,34],
    [-80,33],[-80.5,32],[-81,31.5],[-81.5,30.5],[-82,29.8],[-82.5,29.5],
    [-83,30.1],[-84,30.1],[-85,29.9],[-85.5,30.5],[-87,30.2],[-88,30.3],
    [-88.5,30],[-89,29],[-89.5,29],[-90,28.7],[-91,29],[-93,29.5],
    [-94,30],[-95.5,29],[-97,26],[-100,22],[-100,50]]);

  // Florida peninsula
  land([[-87.6,30.5],[-85,29.9],[-84,30.1],[-83,30.2],[-82.5,29.6],
    [-82,29.5],[-81.8,28.5],[-81.5,27],[-81.2,26],[-80.3,25.2],
    [-80.0,24.7],[-80.7,24.5],[-81.5,24.6],[-82.0,24.8],
    [-81.8,25.5],[-82,26.5],[-82.5,27.5],[-83.5,29.5],
    [-84.5,30.2],[-85.5,30.5],[-87.6,30.5]]);

  // Mexico Gulf coast — closes through interior so Bay of Campeche stays ocean
  land([[-100,50],[-100,16],[-92,18],[-94,18],[-97,19],[-99,22],
    [-100,28],[-100,50]]);

  // Yucatan peninsula
  land([[-90.5,21.5],[-89.5,21.5],[-87.5,21.5],[-87,20],[-86.5,19],
    [-86.5,17.5],[-87,17],[-88,17],[-89,18.5],[-90,18.5],
    [-90.5,20.5],[-90.5,21.5]]);

  // Belize / Guatemala coast
  land([[-89.5,18],[-87,17.5],[-87,16],[-89.5,16.5],[-89.5,18]]);

  // Honduras north coast
  land([[-89.5,16],[-83.5,16],[-83,15.5],[-89,15.5],[-89.5,16]]);

  // Nicaragua, Costa Rica, Panama
  land([[-83.5,15.5],[-83,14],[-83,9],[-79.5,8.5],[-79.5,6],
    [-84,6],[-88,13],[-83.5,15.5]]);

  // Cuba
  land([[-85,22.5],[-84,22.8],[-82,23],[-80,23.2],[-79,23.5],
    [-77.5,20],[-79,20],[-80.5,20.5],[-83,22],[-85,22.5]]);

  // Hispaniola
  land([[-74.5,19.5],[-73,19.8],[-71,19.9],[-69.6,19.4],
    [-68.5,18.4],[-70,18],[-72,18.2],[-74,18.5],[-74.5,19.5]]);

  // Puerto Rico
  land([[-67.3,18.5],[-65.6,18.5],[-65.6,17.9],[-67.3,17.9]]);

  // Jamaica
  land([[-78.4,18.4],[-76.2,18.4],[-76.2,17.7],[-78.4,17.7]]);

  // Bahamas
  land([[-79.5,27.5],[-77,27.5],[-76.5,26.5],[-78,25.5],[-79.5,26]]);
  land([[-76.5,25],[-75,25.2],[-74.5,24.2],[-76,24],[-76.5,25]]);

  // Northern South America (Colombia / Venezuela coast)
  land([[-80,6],[-60,6],[-60,11],[-61,12.5],[-64,11.5],[-68,12],
    [-72,12.5],[-75.5,11],[-80,10.5],[-80,6]]);

  // Lesser Antilles — each island as a small rectangle [nw-lon,n-lat,se-lon,s-lat]
  [[[-63.1,18.2],[-62.5,17.7]],[[-62.1,17.2],[-61.7,16.8]],
   [[-62.1,16.6],[-61.6,15.8]],[[-61.2,15.1],[-60.8,14.4]],
   [[-61.1,14.1],[-60.8,13.3]],[[-61.5,13.4],[-61.0,12.8]],
   [[-61.9,12.3],[-61.4,11.8]],[[-62.1,11.4],[-60.9,10.2]]
  ].forEach(function(b){
    land([[b[0][0],b[0][1]],[b[1][0],b[0][1]],[b[1][0],b[1][1]],[b[0][0],b[1][1]]]);
  });

  // Water label
  if(rc.wlbl){
    ctx.fillStyle="rgba(120,185,245,0.28)";ctx.font="italic 12px Georgia,serif";
    ctx.textAlign="center";ctx.textBaseline="middle";
    var wq=proj(rc.wlon,rc.wlat);ctx.fillText(rc.wlbl,wq[0],wq[1]);
  }

  // State labels — only render if centroid is within canvas bounds
  ctx.fillStyle="rgba(200,235,160,0.45)";ctx.font="bold 9px 'IBM Plex Mono',monospace";
  ctx.textAlign="center";ctx.textBaseline="middle";
  [["FL",[-82,28]],["GA",[-83.5,32]],["TX",[-97,30]],["LA",[-91.5,31]],
   ["MS",[-89,32]],["AL",[-87,32]],["SC",[-80.5,33]],["NC",[-79,35.5]],["VA",[-77,37]]
  ].forEach(function(s){
    var q=proj(s[1][0],s[1][1]);
    if(q[0]>5&&q[0]<W-5&&q[1]>5&&q[1]<H-5)ctx.fillText(s[0],q[0],q[1]);
  });

  // Storm tracks
  var ri=sst>=86&&shear<=12;
  var sLon=rc.sLon+((1010-pressure)/130)*2;
  var sLat=rc.sLat+((sst-70)/26)*1;
  var dLon=rc.dLon,dLat=rc.dLat;
  var N=18;
  var tracks=[
    {c:"#5ab4ff",w:1.8,d:[],    lv:0.55, lnv:0.32},
    {c:"#5dd88a",w:1.8,d:[],    lv:-0.50,lnv:-0.45},
    {c:"#ff8c5a",w:1.5,d:[5,4], lv:0.15, lnv:0.65},
    {c:"#b08fff",w:1.5,d:[2,3], lv:1.05, lnv:-0.22}
  ];
  tracks.forEach(function(m){
    var scale=ri?1.3:0.85;
    ctx.save();ctx.globalAlpha=0.10;ctx.strokeStyle=m.c;ctx.lineWidth=8;ctx.setLineDash([]);
    ctx.beginPath();
    for(var i=0;i<=N;i++){var t=i/N,cv=Math.sin(t*Math.PI),lon=sLon+(dLon-sLon)*t+cv*m.lnv*scale,lat=sLat+(dLat-sLat)*t+cv*m.lv*scale,q=proj(lon,lat);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);}
    ctx.stroke();ctx.restore();
    ctx.globalAlpha=0.85;ctx.strokeStyle=m.c;ctx.lineWidth=m.w;ctx.setLineDash(m.d);
    ctx.beginPath();
    for(var i=0;i<=N;i++){var t=i/N,cv=Math.sin(t*Math.PI),lon=sLon+(dLon-sLon)*t+cv*m.lnv*scale,lat=sLat+(dLat-sLat)*t+cv*m.lv*scale,q=proj(lon,lat);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);}
    ctx.stroke();
    var ep=proj(dLon+m.lnv*0.3,dLat+m.lv*0.3);ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.beginPath();ctx.arc(ep[0],ep[1],3,0,Math.PI*2);ctx.fillStyle=m.c;ctx.fill();
  });

  ctx.globalAlpha=0.9;ctx.strokeStyle="#ff5555";ctx.lineWidth=1.5;ctx.setLineDash([9,5]);
  ctx.beginPath();
  for(var i=0;i<=N;i++){var t=i/N,q=proj(sLon+(dLon-sLon)*t,sLat+(dLat-sLat)*t);i===0?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1]);}
  ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;

  var op=proj(sLon,sLat);
  var sc=(sst-70)*1.8-shear*2.5+(1013-pressure)*0.6;
  var cr=sc<10?"#9a9a9a":sc<25?"#5dd88a":sc<45?"#5ab4ff":sc<65?"#5dd88a":sc<85?"#ff8c5a":sc<105?"#e05050":"#c0392b";
  ctx.beginPath();ctx.arc(op[0],op[1],16,0,Math.PI*2);ctx.strokeStyle=cr;ctx.lineWidth=1;ctx.globalAlpha=0.25;ctx.stroke();ctx.globalAlpha=1;
  var sg=ctx.createRadialGradient(op[0]-2,op[1]-2,1,op[0],op[1],10);
  sg.addColorStop(0,"#d93030");sg.addColorStop(1,"#7a0000");
  ctx.beginPath();ctx.arc(op[0],op[1],10,0,Math.PI*2);ctx.fillStyle=sg;ctx.fill();
  ctx.strokeStyle=cr;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle="#fff";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("L",op[0],op[1]);
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
    const items=[{label:"GFS confidence",val:md.gfs.ri==="Low"?72:55,color:"#5ab4ff"},{label:"ECMWF confidence",val:md.euro.ri.indexOf("High")===0?88:70,color:"#5dd88a"},{label:"NAM confidence",val:68,color:"#ff8c5a"},{label:"UKMET confidence",val:md.ukmet.ri.indexOf("High")===0?82:65,color:"#b08fff"},{label:"Ensemble consensus",val:md.spread==="Low"?85:md.spread==="Moderate"?68:50,color:"#ff5555"}];
    document.getElementById("consensus-section").innerHTML="<p class='cons-title'>Model confidence</p>"+items.map(function(x){return"<div class='cons-row'><div class='cons-meta'><span>"+x.label+"</span><span class='cons-val'>"+x.val+"%</span></div><div class='cons-track'><div class='cons-fill' style='width:"+x.val+"%;background:"+x.color+";'></div></div></div>";}).join("");
  }catch(err){clearInterval(tick);em.style.display="block";em.textContent="Error: "+err.message;lb.style.display="none";}
  finally{setTimeout(function(){lb.style.display="none";lf.style.width="0%";},600);btn.disabled=false;btn.textContent="Regenerate ensemble analysis";}
}

updateLive();
