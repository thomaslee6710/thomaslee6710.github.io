const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const statusLine = document.querySelector(".status");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const height = (x,y) => .38*Math.sin(2*x+y)+.19*Math.cos(x-3*y);
const sample = (x,y) => ({x,y,z:height(x,y)});
let contacts = [sample(-.65,.24),sample(-.24,.05),sample(.13,.19)];
let aim = {...contacts[2]}, legHeight = aim.z;
let yaw = -.32, pitch = .58, zoom = 1, width, viewHeight, unit;
let gesture, frame;
function estimate(x,y) {
  let sum=0, weight=.07;
  for(const p of contacts){
    const d=(x-p.x)**2+(y-p.y)**2;
    if(d<.00001) return p.z;
    const k=Math.exp(-2*d)/(.02+d);
    weight+=k; sum+=k*p.z;
  }
  return sum/weight;
}
function project(x,y,z){
  const u=x*Math.cos(yaw)-y*Math.sin(yaw);
  const v=x*Math.sin(yaw)+y*Math.cos(yaw);
  return [width/2+unit*u,viewHeight*.56+unit*(v*Math.sin(pitch)-z*Math.cos(pitch))];
}
function line(points,color,thickness){
  ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.stroke();
}
function dot(pos,r,color){
  ctx.beginPath();ctx.arc(...pos,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
}
function draw(){
  ctx.clearRect(0,0,width,viewHeight);
  unit=Math.min(width/3.6,viewHeight/2.15)*zoom;
  for(let axis=0;axis<2;axis++){
    for(let i=0;i<=40;i++){
      const points=[];
      for(let j=0;j<=64;j++){
        const x=-1.6+3.2*(axis?i/40:j/64), y=-1+2*(axis?j/64:i/40);
        points.push(project(x,y,estimate(x,y)));
      }
      line(points,axis?"#376d62":"#70a992",1);
    }
  }
  for(const p of contacts) dot(project(p.x,p.y,p.z),5,"#ffca77");
  const {x,y}=aim;
  const pad=project(x,y,legHeight);
  const leg=[project(x+.22,y,legHeight+.73),project(x-.08,y,legHeight+.63),project(x+.15,y,legHeight+.36),pad];
  ctx.lineCap="round";ctx.lineJoin="round";
  line(leg,"#0c2225",13);line(leg,"#eee7d2",7);
  leg.slice(1,3).forEach(p=>{dot(p,8,"#68867e");dot(p,3,"#f4eacb");});
  dot(pad,7,"#ffca77");
}
function resize(){
  const box=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio,2);
  width=box.width;viewHeight=box.height;canvas.width=width*ratio;canvas.height=viewHeight*ratio;
  ctx.setTransform(ratio,0,0,ratio,0,0);draw();
}
function step(x,y){
  cancelAnimationFrame(frame);
  const p=sample(x,y), prediction=estimate(x,y);
  aim=p;const start=performance.now();
  const duration=matchMedia("(prefers-reduced-motion: reduce)").matches?0:330;
  function lower(now){
    const t=duration?clamp((now-start)/duration,0,1):1;
    legHeight=p.z+.45*(1-t);
    if(t<1) frame=requestAnimationFrame(lower);
    else {
      contacts=[...contacts.slice(-2),p];
      const diff=p.z-prediction;
      statusLine.textContent=Math.abs(diff)<.035?"Contact matched the estimate.":diff>0?"The foot met higher ground. The mesh rose around it.":"The foot landed lower. The mesh dipped around it.";
    }
    draw();
  }
  lower(start);
}
function pick(px,py){
  let best, distance=Infinity;
  for(let i=0;i<=80;i++) for(let j=0;j<=50;j++){
    const x=-1.6+i*.04,y=-1+j*.04;
    const [sx,sy]=project(x,y,estimate(x,y));
    const d=(px-sx)**2+(py-sy)**2;
    if(d<distance){distance=d;best={x,y};}
  }
  if(distance<28**2) step(best.x,best.y);
}
canvas.onpointerdown=e=>{
  if(!e.isPrimary) return;
  canvas.setPointerCapture(e.pointerId);
  gesture={x:e.clientX,y:e.clientY,yaw,pitch,drag:false};
};
canvas.onpointermove=e=>{
  if(!gesture||!e.isPrimary)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(Math.hypot(dx,dy)>4)gesture.drag=true;
  if(gesture.drag){yaw=gesture.yaw+dx*.008;pitch=clamp(gesture.pitch+dy*.006,.18,1.42);draw();}
};
canvas.onpointerup=e=>{
  if(!gesture||!e.isPrimary)return;
  if(!gesture.drag){const b=canvas.getBoundingClientRect();pick(e.clientX-b.left,e.clientY-b.top);}
  gesture=null;
};
canvas.onpointercancel=()=>{gesture=null;};
function magnify(factor){zoom=clamp(zoom*factor,.65,2.3);draw();}
canvas.addEventListener("wheel",e=>{e.preventDefault();magnify(Math.exp(-e.deltaY*.0015));},{passive:false});
document.querySelector("#in").onclick=()=>magnify(1.2);
document.querySelector("#out").onclick=()=>magnify(1/1.2);
document.querySelector("#reset").onclick=()=>{yaw=-.32;pitch=.58;zoom=1;draw();};
canvas.onkeydown=e=>{
  if(e.key==="Enter"){step(aim.x,aim.y);return;}
  if(!e.key.startsWith("Arrow"))return;
  e.preventDefault();
  const dx=Number(e.key==="ArrowRight")-Number(e.key==="ArrowLeft");
  const dy=Number(e.key==="ArrowDown")-Number(e.key==="ArrowUp");
  if(e.shiftKey){yaw+=dx*.14;pitch=clamp(pitch+dy*.1,.18,1.42);}
  else{cancelAnimationFrame(frame);aim={x:clamp(aim.x+dx*.12,-1.6,1.6),y:clamp(aim.y+dy*.12,-1,1)};legHeight=estimate(aim.x,aim.y)+.15;}
  draw();
};
new ResizeObserver(resize).observe(canvas);
resize();
