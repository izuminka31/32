'use strict';
(function(){
const section=document.querySelector('#model'),canvas=document.querySelector('#school-model-canvas');
if(!section||!canvas)return;
const ctx=canvas.getContext('2d'),$=s=>section.querySelector(s),data=window.SchoolModelData;
if(!ctx){$('#model-fallback').hidden=false;$('#model-loading').hidden=true;return;}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene=[],markers=[],pointerMap=new Map();let W=800,H=570,dpr=1,raf=0,visible=true,lastTime=0,lastPolygons=[],selectedFloor=0,chosenZone=null,expanded=false,topView=false,tourTimer=null,tourIndex=0;
const current={yaw:-.66,pitch:.61,zoom:1,gap:0,cut:0,focusX:5,focusY:7,focusZ:2,opacity:[1,1,1,1]};
const target={...current,opacity:[1,1,1,1]};let pointerStart=null,pinchStart=null,dragged=false,projection;
function mesh(x,y,z,w,h,d,color,floor=-1,kind='shared',zone=null){scene.push({x,y,z,w,h,d,color,floor,kind,zone});}
function shade(hex,factor){const n=parseInt(hex.slice(1),16);return `rgb(${Math.min(255,Math.round((n>>16)*factor))},${Math.min(255,Math.round((n>>8&255)*factor))},${Math.min(255,Math.round((n&255)*factor))})`;}
function slab(x,z,w,d,level){mesh(x,level*4,z,w,.28,d,'#b9c1b0',level);}
function buildingPart(x,z,w,d,level){slab(x,z,w,d,level);mesh(x,level*4+.28,z,w,3.55,d,'#e9e3d4',level,'outside');
 // Low perimeter walls make the cutaway readable without inventing an exact plan.
 mesh(x,level*4+.3,z-d/2,w,.65,.24,'#dedccc',level,'inside');mesh(x,level*4+.3,z+d/2,w,.65,.24,'#dedccc',level,'inside');mesh(x-w/2,level*4+.3,z,.24,.65,d,'#dedccc',level,'inside');mesh(x+w/2,level*4+.3,z,.24,.65,d,'#dedccc',level,'inside');}
function windowsX(x0,x1,z,level){for(let x=x0+2;x<x1-1;x+=3.7){mesh(x,level*4+1.12,z,1.8,1.7,.09,'#9db6bf',level,'outside');mesh(x,level*4+1.06,z,2,.12,.16,'#f8f4e9',level,'outside');}}
function windowsZ(x,z0,z1,level){for(let z=z0+2;z<z1-1;z+=3.7){mesh(x,level*4+1.12,z,.09,1.7,1.8,'#9db6bf',level,'outside');mesh(x,level*4+1.06,z,.16,.12,2,'#f8f4e9',level,'outside');}}
function sofa(x,y,z,level,zone,color='#7d9d61'){mesh(x,y+.05,z,3.5,.75,1.4,color,level,'inside',zone);mesh(x,y+.7,z+.52,3.5,.7,.32,color,level,'inside',zone);mesh(x-1.6,y+.5,z,.3,.6,1.4,color,level,'inside',zone);mesh(x+1.6,y+.5,z,.3,.6,1.4,color,level,'inside',zone);}
function table(x,y,z,level,zone,w=1.8,d=1.4,color='#e4c9a1'){mesh(x,y+.62,z,w,.17,d,color,level,'inside',zone);mesh(x,y,z,.25,.62,.25,'#9b9e8f',level,'inside',zone);}
function chair(x,y,z,level,zone,color='#a9b693'){mesh(x,y+.3,z,.72,.18,.75,color,level,'inside',zone);mesh(x,y+.4,z+.3,.72,.65,.15,color,level,'inside',zone);}
function zoneFurniture(z){const y=(z.floor-1)*4+.34,level=z.floor-1;
 mesh(z.x,y,z.z,z.w,.08,z.d,z.color,level,'inside',z.id);
 if(z.type==='rest'){
  sofa(z.x-2,y,z.z+1.8,level,z.id);sofa(z.x+2,y,z.z-1.6,level,z.id,'#a4b57b');table(z.x,y,z.z,level,z.id);chair(z.x+3.4,y,z.z+1.3,level,z.id);
 }else if(z.type==='creative'||z.type==='study'){
  for(let i=0;i<2;i++)for(let j=0;j<3;j++){const x=z.x-2+i*3.5,zz=z.z-3+j*2.7;table(x,y,zz,level,z.id);chair(x,y,zz+1,level,z.id);if(z.type==='creative')mesh(x,y+.8,zz,.9,.7,.12,'#4c6063',level,'inside',z.id);}
 }else if(z.type==='library'){
  for(let i=0;i<3;i++){mesh(z.x-5+i*4,y,z.z+2.6,2.8,1.65,.8,'#ae8f65',level,'inside',z.id);for(let j=0;j<5;j++)mesh(z.x-6+i*4+j*.47,y+.3,z.z+2.12,.3,1,.17,['#93aa8a','#a8b8c4','#d8b78b'][j%3],level,'inside',z.id);}table(z.x,y,z.z-1,level,z.id,3,2);chair(z.x-2,y,z.z-1,level,z.id);chair(z.x+2,y,z.z-1,level,z.id);
 }else if(z.type==='dining'){
  for(let i=0;i<3;i++){table(z.x-4+i*4,y,z.z,level,z.id,2.5,1.8);chair(z.x-4+i*4,y,z.z-1.3,level,z.id);chair(z.x-4+i*4,y,z.z+1.3,level,z.id);}
 }else if(z.type==='sport'){
  mesh(z.x,y+.1,z.z,z.w-1,.08,z.d-1,'#c7926f',level,'inside',z.id);for(const sign of [-1,1]){mesh(z.x,y+.15,z.z+sign*(z.d/2-1.6),z.w-2,.04,.12,'#fff1d9',level,'inside',z.id);mesh(z.x+sign*(z.w/2-1),y+.15,z.z,.12,.04,z.d-3,'#fff1d9',level,'inside',z.id);}mesh(z.x,y+.15,z.z,z.w-2,.04,.12,'#fff1d9',level,'inside',z.id);
 }else if(z.id==='wardrobe'){
  for(let i=0;i<3;i++)mesh(z.x-3+i*3,y,z.z,1.2,1.6,4,'#a4b3a2',level,'inside',z.id);
 }
}
function makeScene(){
 mesh(5,-.9,3,104,.8,76,'#dce3d2',-1,'ground');mesh(4,-.07,-24,104,.07,8,'#bcc4b7',-1,'ground');mesh(4,.01,-24,100,.035,.16,'#e9eadb',-1,'ground');
 mesh(0,-.04,9,32,.08,25,'#c6d6b7',-1,'ground');mesh(0,.02,8,3,.07,24,'#e5e5d4',-1,'ground');mesh(-21,.01,-18,4,.09,8,'#ece7d9',-1,'ground');mesh(24,.01,-18,4,.09,8,'#ece7d9',-1,'ground');
 for(const [x,z] of [[-36,-12],[-36,6],[-33,27],[-12,30],[11,30],[49,22],[49,-8]]){mesh(x,-.1,z,.5,3,.5,'#8c836a',-1,'ground');mesh(x,1.8,z,4,3.7,4,'#9eb28b',-1,'ground');mesh(x,4,z,2.9,1.5,2.9,'#aec29a',-1,'ground');}
 for(let l=0;l<4;l++){
  buildingPart(0,-10.5,56,9,l);buildingPart(-22.5,8,11,28,l);buildingPart(22.5,8,11,28,l);
  windowsX(-28,28,-15.05,l);windowsX(-17,17,-5.95,l);windowsX(-28,-17,22.05,l);windowsX(17,28,22.05,l);windowsZ(-28.05,-6,22,l);windowsZ(-16.95,-6,22,l);windowsZ(16.95,-6,22,l);windowsZ(28.05,-6,22,l);
  // Corridors and abbreviated classroom bays.
  mesh(0,l*4+.31,-8,54,.04,2.5,'#eee9da',l,'inside');
  for(const x of [-19,19])mesh(x,l*4+.31,8,2.3,.04,26,'#eee9da',l,'inside');
  for(const side of [-1,1])for(let j=0;j<4;j++){const x=side*24,z=-2+j*6.5;mesh(x,l*4+.32,z,7,.04,5.9,'#dce0d1',l,'inside');if(j<3)mesh(x,l*4+.34,z+3.1,7,.55,.16,'#dbdac9',l,'inside');if(j%2===0){table(x,l*4+.35,z,l,null,2.2,1.4);chair(x,l*4+.35,z+1.2,l,null);}}
  mesh(0,l*4+.33,-11,5.5,.12,6.7,'#c7ccbc',l,'inside');for(let j=0;j<7;j++)mesh(-1.25,l*4+.42+j*.14,-13+j*.65,2.1,.18,.65,'#b2bca8',l,'inside');mesh(1.7,l*4+.4,-10,.16,1.1,5,'#a3ae97',l,'inside');
  if(l<2){buildingPart(36,-10.5,16,9,l);buildingPart(35,-2,14,8,l);windowsX(28,44,-15.06,l);windowsZ(44.06,-15,2,l);}
 }
 // Roofs belong to the fourth storey, while the annex has its own lower roof.
 for(const [x,z,w,d] of [[0,-10.5,56,9],[-22.5,8,11,28],[22.5,8,11,28]])mesh(x,15.85,z,w,.24,d,'#b8c3ae',3,'outside');
 mesh(36,7.85,-10.5,16,.22,9,'#b8c3ae',1,'outside');mesh(35,7.85,-2,14,.22,8,'#b8c3ae',1,'outside');
 // A two-storey gym: no floor slab through the middle of the hall.
 mesh(37,.02,11,13,.26,18,'#bec8af',-2);mesh(37,.28,11,13,7.5,18,'#e4d5bf',-2,'outside');mesh(37,7.85,11,13,.24,18,'#b5c2a6',-2,'outside');
 for(const x of [30.5,43.5])mesh(x,.3,11,.22,.9,18,'#d5c9b5',-2,'inside');for(const z of [2,20])mesh(37,.3,z,13,.9,.22,'#d5c9b5',-2,'inside');
 for(const x of [30.7,43.3])for(const z of [2.2,19.8])mesh(x,.3,z,.3,7.2,.3,'#ddd8c6',-2,'inside');
 for(let z=5;z<20;z+=4){mesh(43.56,3.7,z,.07,2.6,2.2,'#9db6bf',-2,'outside');}
 for(const [x,w] of [[-21,5],[24,4]]){mesh(x,.15,-15.25,w,2.8,.16,'#778c85',0,'outside');mesh(x,2.9,-16,w+1,.22,2.2,'#c67e60',0,'outside');mesh(x,-.01,-17,w+1,.25,2,'#b4b6a8',-1,'ground');}
 for(const z of data.zones)zoneFurniture(z);
 // Gym markings use the shared two-storey group so the first-floor court remains visible from floor two.
 for(const m of scene)if(m.zone==='gym')m.floor=-2;
}
function worldAlpha(m){let a=m.floor===-2?Math.max(current.opacity[0],current.opacity[1]):m.floor>=0?current.opacity[m.floor]:1;if(m.kind==='outside')a*=1-current.cut;if(m.kind==='inside')a*=current.cut;return a;}
function worldOffset(m){return m.floor>=0?m.floor*current.gap:0;}
function project(x,y,z){const dx=x-current.focusX,dz=z-current.focusZ,dy=y-current.focusY;const u=dx*projection.cy+dz*projection.sy,v=-dx*projection.sy+dz*projection.cy;return {x:W*.5+u*projection.scale,y:H*.52+(v*projection.sp-dy*projection.cp)*projection.scale,depth:v*projection.cp+dy*projection.sp};}
function makeProjection(){const cy=Math.cos(current.yaw),sy=Math.sin(current.yaw),sp=Math.sin(current.pitch),cp=Math.cos(current.pitch);const spanY=18+current.gap*3;const safeW=Math.max(1,W-60),safeH=Math.max(1,H-90);const fit=Math.min(safeW/115,safeH/(62*sp+spanY*cp));projection={cy,sy,sp,cp,scale:fit*current.zoom};}
function face(points,normal,color,alpha,zone,top){const visibleNormal=normal[0]*(-projection.sy*projection.cp)+normal[1]*projection.sp+normal[2]*(projection.cy*projection.cp);if(visibleNormal<=.001)return null;const p=points.map(v=>project(...v));return {p,depth:p.reduce((s,v)=>s+v.depth,0)/p.length,color,alpha,zone,top};}
function faces(m){const alpha=worldAlpha(m);if(alpha<.015)return [];const x=m.x-m.w/2,X=m.x+m.w/2,z=m.z-m.d/2,Z=m.z+m.d/2,y=m.y+worldOffset(m),Y=y+m.h;const highlight=m.zone&&m.zone===chosenZone;const c=highlight?'#f1bc72':m.color;const result=[
  face([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],[0,1,0],shade(c,1.04),alpha,m.zone,true),
  face([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],[0,0,1],shade(c,.85),alpha,m.zone,false),
  face([[X,y,z],[x,y,z],[x,Y,z],[X,Y,z]],[0,0,-1],shade(c,.86),alpha,m.zone,false),
  face([[X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z]],[1,0,0],shade(c,.93),alpha,m.zone,false),
  face([[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z]],[-1,0,0],shade(c,.77),alpha,m.zone,false)
 ].filter(Boolean);if(m.kind!=='ground'&&m.h<.5&&(m.w>8||m.d>8)){const index=result.findIndex(f=>f.top);if(index>=0)result.splice(index,1);const nx=Math.ceil(m.w/3),nz=Math.ceil(m.d/3);for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=x+m.w*i/nx,b=x+m.w*(i+1)/nx,c0=z+m.d*j/nz,d0=z+m.d*(j+1)/nz;const f=face([[a,Y,c0],[b,Y,c0],[b,Y,d0],[a,Y,d0]],[0,1,0],shade(c,1.04),alpha,m.zone,true);if(f)result.push(f);}}
 return result.filter(f=>!(m.kind==='outside'&&m.h>2&&f.top)).map(f=>({...f,background:m.kind==='ground'&&m.h<1}));}
function draw(){makeProjection();ctx.clearRect(0,0,W,H);const polys=[];for(const m of scene)polys.push(...faces(m));polys.sort((a,b)=>Number(!a.background)-Number(!b.background)||a.depth-b.depth);lastPolygons=polys;for(const f of polys){ctx.globalAlpha=f.alpha;ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();if(f.top&&f.zone){ctx.strokeStyle=f.zone===chosenZone?'#b57e3a':'#78856c40';ctx.lineWidth=f.zone===chosenZone?1.4:.5;ctx.stroke();}}ctx.globalAlpha=1;
 for(const m of markers){const z=m.zone;let show=selectedFloor?z.floor===selectedFloor:['media','gym','rest3right','library'].includes(z.id);if(expanded&&selectedFloor===0)show=['media','library','rest3right','rest4left'].includes(z.id);const y=(z.floor-1)*(4+current.gap)+(current.cut>.5?.8:3.9);const p=project(z.x,y,z.z);m.button.hidden=!show||p.x<32||p.x>W-32||p.y<58||p.y>H-50;m.button.style.left=p.x+'px';m.button.style.top=p.y+'px';m.button.setAttribute('aria-pressed',String(chosenZone===z.id));}
}
function animate(time){raf=0;if(!visible)return;const dt=Math.min(50,lastTime?time-lastTime:16);lastTime=time;const k=reduced?1:1-Math.exp(-dt/150);let remaining=0;for(const key of ['yaw','pitch','zoom','gap','cut','focusX','focusY','focusZ']){const d=target[key]-current[key];remaining+=Math.abs(d);current[key]+=d*k;}for(let i=0;i<4;i++){const d=target.opacity[i]-current.opacity[i];remaining+=Math.abs(d);current.opacity[i]+=d*k;}draw();if(remaining>.002)raf=requestAnimationFrame(animate);}
function wake(){if(!visible||raf)return;lastTime=0;raf=requestAnimationFrame(animate);}
function stopTour(){if(tourTimer){clearTimeout(tourTimer);tourTimer=null;}$('#model-tour').setAttribute('aria-pressed','false');$('#model-tour').textContent='Прогулка по школе';$('#model-tour-status').textContent='';}
function resetFocus(){target.focusX=5;target.focusZ=2;target.focusY=selectedFloor?(selectedFloor-1)*4+1:7+target.gap*1.5;target.zoom=1;}
function setFloor(floor,fromTour=false){if(!fromTour)stopTour();selectedFloor=floor;chosenZone=null;expanded=false;target.gap=0;$('#model-explode').setAttribute('aria-pressed','false');target.cut=floor?1:0;target.opacity=[0,1,2,3].map(i=>floor===0||i===floor-1?1:0);resetFocus();updatePanel();wake();}
function chooseZone(id,fromTour=false){const z=data.zones.find(z=>z.id===id);if(!z)return;if(!fromTour)stopTour();selectedFloor=z.floor;chosenZone=id;expanded=false;target.gap=0;$('#model-explode').setAttribute('aria-pressed','false');target.opacity=[0,1,2,3].map(i=>i===z.floor-1?1:0);target.cut=1;target.focusX=z.x*.55+2;target.focusZ=z.z*.55;target.focusY=(z.floor-1)*(4+target.gap)+1.2;target.zoom=1.3;target.pitch=topView?1.43:.82;updatePanel();wake();}
function updatePanel(){section.querySelectorAll('[data-model-floor]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.modelFloor)===selectedFloor)));const f=data.floors.find(f=>f.number===selectedFloor);$('#model-stage-label').textContent=f?`${f.number} ЭТАЖ · ВИД В РАЗРЕЗЕ`:expanded?'ЧЕТЫРЕ ЭТАЖА · РАЗДЕЛЁННЫЙ ВИД':'ШКОЛА № 534 · ОБЩИЙ ВИД';$('#model-floor-title').textContent=f?f.title:'Знакомая школа. Новый ракурс.';$('#model-floor-description').textContent=f?f.description:'П-образная учебная часть в четыре этажа. Справа — пониженный блок столовой и спортивных помещений. Выбери этаж или зону.';
 const list=$('#model-zone-list');list.replaceChildren();const zones=selectedFloor?data.zones.filter(z=>z.floor===selectedFloor):data.zones.filter(z=>['media','gym','library','rest3right','science'].includes(z.id));for(const z of zones){const b=document.createElement('button');b.type='button';b.textContent=z.name;b.style.setProperty('--zone-color',z.color);b.setAttribute('aria-pressed',String(z.id===chosenZone));const small=document.createElement('small');small.textContent=z.floor+' этаж';b.append(small);b.addEventListener('click',()=>chooseZone(z.id));list.append(b);}
 const z=data.zones.find(z=>z.id===chosenZone);$('#model-zone-title').textContent=z?z.name:'Выбери точку интереса';$('#model-zone-text').textContent=z?z.text:'На модели и в списке доступны учебные помещения, отдых, библиотека, столовая и спорт. Все положения показаны ориентировочно.';$('#model-research').hidden=!z?.research;if(z?.research)updateResearch(z);$('#model-research-link').hidden=!z?.research;
 $('#model-reset').textContent=chosenZone?'Общий вид':'Сбросить ракурс';}
function updateResearch(z){const group=document.querySelector('#class-filter')?.value||'all';const snapshot=window.SchoolModelSummary||window.SchoolInitial;const d=typeof selected==='function'?selected().results[z.research]:snapshot?.groups[group]?.results[z.research];$('#model-research').textContent=d?.answered?`Ответов на связанный вопрос в выбранной группе: ${d.answered}. Оценки относятся к теме в целом, а не отдельно к этой комнате.`:'По связанной теме в выбранной группе пока нет ответов.';}
function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function canvasPoint(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*W/r.width,y:(event.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointerdown',e=>{stopTour();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const p=canvasPoint(e);pointerMap.set(e.pointerId,p);if(pointerMap.size===1){pointerStart={...p,yaw:target.yaw,pitch:target.pitch};dragged=false;}else if(pointerMap.size===2){const ps=[...pointerMap.values()];pinchStart={distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),zoom:target.zoom};dragged=true;}});
canvas.addEventListener('pointermove',e=>{if(!pointerMap.has(e.pointerId))return;const p=canvasPoint(e);pointerMap.set(e.pointerId,p);if(pointerMap.size===2&&pinchStart){const ps=[...pointerMap.values()];target.zoom=Math.max(.65,Math.min(2.5,pinchStart.zoom*Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)/Math.max(1,pinchStart.distance)));wake();}else if(pointerMap.size===1&&pointerStart){const dx=p.x-pointerStart.x,dy=p.y-pointerStart.y;if(Math.abs(dx)+Math.abs(dy)>5)dragged=true;target.yaw=pointerStart.yaw+dx*.008;target.pitch=Math.max(.22,Math.min(1.48,pointerStart.pitch+dy*.005));wake();}});
function pointerEnd(e){if(!pointerMap.has(e.pointerId))return;const p=canvasPoint(e);pointerMap.delete(e.pointerId);if(!dragged&&pointerStart&&pointerMap.size===0){const hit=[...lastPolygons].reverse().find(f=>f.zone&&f.top&&f.alpha>.65&&insidePolygon(p.x,p.y,f.p));if(hit)chooseZone(hit.zone);}pointerStart=null;pinchStart=null;}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',()=>{pointerMap.clear();pointerStart=null;pinchStart=null;});
canvas.addEventListener('wheel',e=>{if(!canvas.matches(':focus'))return;e.preventDefault();stopTour();target.zoom=Math.max(.65,Math.min(2.5,target.zoom*Math.exp(-e.deltaY*.001)));wake();},{passive:false});
canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>target.yaw-=.2,ArrowRight:()=>target.yaw+=.2,ArrowUp:()=>target.pitch=Math.min(1.48,target.pitch+.12),ArrowDown:()=>target.pitch=Math.max(.22,target.pitch-.12),'+':()=>target.zoom=Math.min(2.5,target.zoom*1.15),'=':()=>target.zoom=Math.min(2.5,target.zoom*1.15),'-':()=>target.zoom=Math.max(.65,target.zoom/1.15),Home:reset,Escape:stopTour};if(/^[1-4]$/.test(e.key)){e.preventDefault();setFloor(Number(e.key));return;}if(actions[e.key]){e.preventDefault();stopTour();actions[e.key]();wake();}});
function reset(){stopTour();expanded=false;topView=false;target.gap=0;target.yaw=-.66;target.pitch=.61;$('#model-explode').setAttribute('aria-pressed','false');$('#model-top').setAttribute('aria-pressed','false');setFloor(0);}
section.querySelectorAll('[data-model-floor]').forEach(b=>b.addEventListener('click',()=>setFloor(Number(b.dataset.modelFloor))));
$('#model-explode').addEventListener('click',()=>{stopTour();expanded=!expanded;selectedFloor=0;chosenZone=null;target.gap=expanded?7:0;target.cut=expanded?1:0;target.opacity=[1,1,1,1];target.pitch=.55;resetFocus();$('#model-explode').setAttribute('aria-pressed',String(expanded));updatePanel();wake();});
$('#model-top').addEventListener('click',()=>{stopTour();topView=!topView;target.pitch=topView?1.43:.61;target.yaw=topView?0:-.66;$('#model-top').setAttribute('aria-pressed',String(topView));wake();});
$('#model-reset').addEventListener('click',reset);$('#model-zoom-in').addEventListener('click',()=>{stopTour();target.zoom=Math.min(2.5,target.zoom*1.2);wake();});$('#model-zoom-out').addEventListener('click',()=>{stopTour();target.zoom=Math.max(.65,target.zoom/1.2);wake();});
const tour=['entrance','media','gym','library','rest3right','science'];
$('#model-tour').addEventListener('click',()=>{if(tourTimer){stopTour();return;}expanded=false;target.gap=0;$('#model-explode').setAttribute('aria-pressed','false');tourIndex=0;const next=()=>{const id=tour[tourIndex];chooseZone(id,true);$('#model-tour').setAttribute('aria-pressed','true');$('#model-tour').textContent='Остановить прогулку';$('#model-tour-status').textContent=`Остановка ${tourIndex+1} из ${tour.length}: ${data.zones.find(z=>z.id===id).name}. Прогулку можно остановить в любой момент.`;tourIndex++;tourTimer=setTimeout(()=>{if(tourIndex<tour.length)next();else stopTour();},5000);};next();});
for(const z of data.zones){const button=document.createElement('button');button.type='button';button.className='model-marker';button.textContent=z.name+' · '+z.floor;button.setAttribute('aria-label',z.name+', '+z.floor+' этаж');button.addEventListener('click',()=>chooseZone(z.id));$('#model-markers').append(button);markers.push({zone:z,button});}
window.addEventListener('school-summary',e=>{window.SchoolModelSummary=e.detail;const z=data.zones.find(z=>z.id===chosenZone);if(z?.research)updateResearch(z);});window.addEventListener('school-data-change',()=>{const z=data.zones.find(z=>z.id===chosenZone);if(z?.research)updateResearch(z);});document.querySelector('#class-filter')?.addEventListener('change',()=>{const z=data.zones.find(z=>z.id===chosenZone);if(z?.research)updateResearch(z);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTour();});
new ResizeObserver(entries=>{const r=entries[0].contentRect;W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();wake();}).observe($('#model-stage'));

makeScene();updatePanel();$('#model-loading').hidden=true;wake();
})();
