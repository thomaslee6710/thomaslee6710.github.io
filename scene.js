const canvas = document.querySelector("#page-mesh");
const control = document.querySelector("#foot-control");
let groundY, controlHeight;
const ctx = canvas.getContext("2d");
const statusLine = document.querySelector(".status");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const height = (x,y) => .38*Math.sin(2*x+y)+.19*Math.cos(x-3*y);
const sample = (x,y) => ({x,y,z:height(x,y)});
const legs = [[.55,-.28],[.55,.28],[-.55,-.28],[-.55,.28]].map(([x,y])=>({x,y,foot:sample(x,y)}));
let contacts = legs.map(leg=>leg.foot).slice(-3);
let active=0, prediction=estimate(legs[0].x,legs[0].y);
let width,viewHeight,unit,drag,frame;
const yaw=-.48,pitch=.45,zoom=1;
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
  return [width/2+unit*u,groundY+unit*(v*Math.sin(pitch)-z*Math.cos(pitch))];
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
  unit=Math.min(width/3.6,controlHeight/2.15)*zoom;
  // Invert the fixed camera projection to cover all four viewport corners.
  const halfU=width/(2*unit);
  const halfV=Math.max(groundY,viewHeight-groundY)/(unit*Math.sin(pitch));
  const extentX=Math.ceil((halfU*Math.abs(Math.cos(yaw))+halfV*Math.abs(Math.sin(yaw))+.7)*8);
  const extentY=Math.ceil((halfU*Math.abs(Math.sin(yaw))+halfV*Math.abs(Math.cos(yaw))+.7)*8);
  for(let axis=0;axis<2;axis++){
    const across=axis?extentX:extentY, along=axis?extentY:extentX;
    for(let i=-across;i<=across;i++){
      const points=[];
      for(let j=-along;j<=along;j++){
        const x=(axis?i:j)/8, y=(axis?j:i)/8;
        points.push(project(x,y,estimate(x,y)));
      }
      line(points,axis?"#376d62":"#70a992",1);
    }
  }
  const legOrder=[0,2,1,3].filter(i=>i!==active);
  function drawLeg(i){
    const leg=legs[i], f=leg.foot;
    const hip=project(leg.x,leg.y,.77), pad=project(f.x,f.y,f.z);
    const knee=project((leg.x+f.x)/2-.19, (leg.y+f.y)/2, (.77+f.z)/2+.09);
    const selected=i===active;
    line([hip,knee,pad],"#102829",selected?13:10);
    line([hip,knee,pad],selected?"#fff0cb":"#829b97",selected?8:6);
    dot(knee,5,"#4a6567");dot(pad,selected?7:4,selected?"#ffc16b":"#abc2b8");
  }
  legOrder.forEach(drawLeg);
  const corners=[[-.68,-.32],[.62,-.32],[.72,.08],[.61,.32],[-.68,.32]];
  function face(points,color){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  face(corners.map(([x,y])=>project(x,y,.84)),"#c4d4ce");
  face([project(-.68,.32,.84),project(.61,.32,.84),project(.61,.32,.69),project(-.68,.32,.69)],"#789692");
  dot(project(.63,.15,.80),4,"#213d41");
  const foot=legs[active].foot;
  const ring=project(foot.x,foot.y,prediction);
  ctx.beginPath();ctx.setLineDash([4,3]);ctx.ellipse(...ring,16,7,0,0,2*Math.PI);
  ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
  drawLeg(active);
}
function resize(){
  const box=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio,2);
  const area=control.getBoundingClientRect();
  controlHeight=area.height;groundY=area.top-box.top+area.height*.56;
  width=box.width;viewHeight=box.height;canvas.width=width*ratio;canvas.height=viewHeight*ratio;
  ctx.setTransform(ratio,0,0,ratio,0,0);draw();
}
function aim(x,y){
  cancelAnimationFrame(frame);
  const leg=legs[active];
  x=clamp(x,leg.x-.68,leg.x+.68);y=clamp(y,leg.y-.50,leg.y+.50);
  prediction=estimate(x,y);
  leg.foot={x,y,z:prediction+.22};
  draw();
}
function land(){
  cancelAnimationFrame(frame);
  const leg=legs[active],from=leg.foot,p=sample(from.x,from.y);
  const start=performance.now(), delta=p.z-prediction;
  function animate(now){
    const t=matchMedia("(prefers-reduced-motion: reduce)").matches?1:clamp((now-start)/250,0,1);
    leg.foot={...p,z:from.z+(p.z-from.z)*t};
    if(t<1)frame=requestAnimationFrame(animate);
    else{
      contacts=[...contacts.slice(-2),p];
      statusLine.textContent=(Math.abs(delta)<.035?"Contact matched the prediction.":delta>0?"The foot touched higher than predicted.":"The foot touched lower than predicted.")+" The mesh now includes this step.";
    }
    draw();
  }
  animate(start);
}
const selector=document.querySelector("#leg");
selector.onchange=()=>{cancelAnimationFrame(frame);legs[active].foot=sample(legs[active].foot.x,legs[active].foot.y);active=selector.selectedIndex;prediction=estimate(legs[active].foot.x,legs[active].foot.y);draw();};
control.onpointerdown=e=>{
  if(!e.isPrimary)return;
  const b=canvas.getBoundingClientRect();
  const hits=legs.map(({foot:f},i)=>{const [x,y]=project(f.x,f.y,f.z);return {i,d:Math.hypot(x-e.clientX+b.left,y-e.clientY+b.top)};}).sort((a,b)=>a.d-b.d);
  if(hits[0].d<24){selector.selectedIndex=hits[0].i;selector.onchange();}
  const f=legs[active].foot;
  drag={sx:e.clientX,sy:e.clientY,x:f.x,y:f.y};control.setPointerCapture(e.pointerId);aim(f.x,f.y);
};
control.onpointermove=e=>{
  if(!drag||!e.isPrimary)return;
  const u=(e.clientX-drag.sx)/unit,v=(e.clientY-drag.sy)/(unit*Math.sin(pitch));
  aim(drag.x+u*Math.cos(yaw)+v*Math.sin(yaw),drag.y-u*Math.sin(yaw)+v*Math.cos(yaw));
};
control.onpointerup=e=>{if(drag&&e.isPrimary){drag=null;land();}};
control.onpointercancel=()=>{if(drag){drag=null;land();}};
control.onkeydown=e=>{
  const f=legs[active].foot;
  if(e.key==="Enter"){land();return;}
  if(!e.key.startsWith("Arrow"))return;
  e.preventDefault();aim(f.x+.09*((e.key==="ArrowRight")-(e.key==="ArrowLeft")),f.y+.09*((e.key==="ArrowDown")-(e.key==="ArrowUp")));
};
const observer=new ResizeObserver(resize);
observer.observe(canvas);observer.observe(control);observer.observe(document.querySelector(".profile"));resize();