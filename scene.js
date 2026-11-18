const canvas = document.querySelector("#page-mesh");
const walker = document.querySelector("#walker");
const ctx = walker.getContext("2d");

const grid = document.createElement("canvas");
const mesh = grid.getContext("2d");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const patch = {x:.51, y:.72, depth:.46};
const resolution=80;
const brush={x:patch.x,y:patch.y};
let dragY=0,dirty=false,headroom=0;
const drop = .34;
// Limit the added ridge to a quarter of the terrain panel height.
const ridgeLimit=.25/drop;
const hollowLimit=.25/drop;
let pelvisY, fallSpeed=0, side=1;
let angle=Math.PI*.76;
function route(a){
  return {x:.50+.36*Math.cos(a),y:.56+.24*Math.sin(a),direction:-Math.sin(a)};
}
const robot={...route(angle),phase:0,observed:0};
let planted=route(angle), trailing=route(angle-.11);
let width, height, ratio, stride, forecast, pointer=null, previous;
function terrainDepth(x,y){
  const hills=.32*Math.sin(2*Math.PI*(x+.23*y))+.18*Math.cos(2*Math.PI*(y-.52*x));
  return hills+patch.depth*Math.exp(-(((x-patch.x)/.135)**2+((y-patch.y)/.25)**2));
}
function projectY(x,y){return height*(.14+.72*y+drop*terrainDepth(x,y));}
function updateGrid(){
  mesh.clearRect(0,-headroom,width,height+headroom);
  const cols=Math.ceil(width/20);
  // Paint from the far edge toward the near lip so folded faces occlude the hollow.
  const rows=28;
  function vertex(i,j){
    const y=j/rows,x=i/cols+.09*(y-.5);
    return [x*width,projectY(x,y)];
  }
  for(let j=-9;j<rows+10;j++){
    for(let i=-Math.ceil(cols*.12)-1;i<cols*1.12+1;i++){
      const y=(j+.5)/rows,x=(i+.5)/cols+.09*(y-.5);
      const depth=terrainDepth(x,y);
      // Fade by the row's original position so lifting it carries its opacity upward.
      const topFade=clamp((.14+.72*y)/.28,0,1);
      const screenY=projectY(x,y)/height;
      const bottomFade=clamp((1-screenY)/.12,0,1);
      const rowOpacity=topFade*topFade*bottomFade*bottomFade;
      if(rowOpacity<.002)continue;
      mesh.globalAlpha=rowOpacity;
      const slope=(terrainDepth(x+.012,y)-terrainDepth(x-.012,y))*6+
                  (terrainDepth(x,y+.015)-terrainDepth(x,y-.015))*5;
      const light=clamp(24-14*depth+10*slope,8,39);
      const points=[vertex(i,j),vertex(i+1,j),vertex(i+1,j+1),vertex(i,j+1)];
      mesh.beginPath();points.forEach(([px,py],k)=>k?mesh.lineTo(px,py):mesh.moveTo(px,py));
      mesh.closePath();mesh.fillStyle="hsl(169 31% "+light+"%)";mesh.fill();
      mesh.strokeStyle="hsla(158,38%,"+(49+8*slope)+"%,.62)";mesh.lineWidth=.7;mesh.stroke();
    }
  }
  mesh.globalAlpha=1;
}
function angleStep(depth){
  return stride*(1-.50*Math.min(Math.abs(depth),1.4))/.36;
}
let target, nextTarget;
function footfall(a,leg){
  const p=route(a);
  return {...p,y:p.y+.018*leg};
}
function predict(){
  const step=angleStep(robot.observed);
  if(!target)target=footfall(angle+step,-side);
  nextTarget=footfall(angle+2*step,side);
  forecast={...target,depth:robot.observed};
}
function interpolateFoot(a,b,t){
  const blend=t*t*(3-2*t);
  return {x:a.x+(b.x-a.x)*blend,y:a.y+(b.y-a.y)*blend};
}
function advance(dt){
  const amount=Math.min(dt,.05)/.9;
  angle+=amount*angleStep(terrainDepth(robot.x,robot.y));
  Object.assign(robot,route(angle));
  robot.phase+=amount;
  if(robot.phase>=1){
    robot.phase-=1;
    trailing=planted;planted=target;target=nextTarget;side*=-1;
    robot.observed=terrainDepth(planted.x,planted.y);
    predict();
  }
}
function swingPoint(phase){
  const p=interpolateFoot(trailing,target,phase);
  return [p.x*width,projectY(p.x,p.y)-height*.052*Math.sin(Math.PI*phase)];
}
function pose(){
  const ground=projectY(planted.x,planted.y);
  return {ground,feet:[[planted.x*width,ground],swingPoint(robot.phase)]};
}
function body(px,hip,feet,ghost){
  const s=clamp(height/255,.78,1.12)*Math.min(1,width/475),dir=ghost?forecast.direction:robot.direction;
  ctx.save();ctx.lineJoin="round";ctx.lineCap="round";
  if(ghost)ctx.setLineDash([4,4]);
  function limb(points,ink,weight){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=ghost?"rgba(218,240,210,.65)":ink;ctx.lineWidth=ghost?1.4:weight*s;ctx.stroke();
  }
  function plate(x,y,w,h,r,color){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(ghost)ctx.stroke();else{ctx.fillStyle=color;ctx.fill();}
  }
  feet.forEach(([fx,fy],i)=>{
    const hx=px+(i?3:-3)*s,hy=hip;
    const dx=fx-hx,dy=fy-3*s-hy;
    const reach=Math.hypot(dx,dy);
    const segment=25*s;
    const dist=clamp(reach,.001,1.94*segment);
    const ux=reach>0?dx/reach:0,uy=reach>0?dy/reach:1;
    const ankle=[hx+ux*dist,hy+uy*dist];
    const bend=Math.sqrt(Math.max(0,segment**2-(dist/2)**2));
    const knee=[(hx+ankle[0])/2+(dir<0?-1:1)*uy*bend,(hy+ankle[1])/2-(dir<0?-1:1)*ux*bend];
    limb([[hx,hy],knee,ankle,[ankle[0]+dir*8*s,ankle[1]+s]],i?"#f0dbba":"#83a59d",6);
  });
  function arm(near){
    const sideOfTorso=near?1:-1;
    const cycle=(ghost?-side:side)*Math.cos(robot.phase*Math.PI)*sideOfTorso;
    const facing=dir<0?-1:1;
    const shoulder=[px+sideOfTorso*6*s,hip-22*s];
    const upper=cycle*.56;
    const forearm=upper+.32+.44*Math.max(0,cycle);
    const elbow=[shoulder[0]+facing*Math.sin(upper)*13*s,shoulder[1]+Math.cos(upper)*13*s];
    const wrist=[elbow[0]+facing*Math.sin(forearm)*11*s,elbow[1]+Math.cos(forearm)*11*s];
    limb([shoulder,elbow,wrist],near?"#efbb7d":"#839e96",4);
  }
  arm(false);
  plate(px-10*s,hip-28*s,21*s,30*s,6*s,"#cee0d6");
  plate(px-7*s,hip-46*s,16*s,16*s,5*s,"#e2e9df");
  if(!ghost)plate(px+(-3+3*dir)*s,hip-42*s,8*s,4*s,1,"#173d41");
  arm(true);
  ctx.restore();
}

// In this projection larger ground-y is nearer the viewer. The foremost
// terrain silhouette hides the part of a figure below it at each screen x.
function clipToTerrain(left,right,v){
  ctx.beginPath();ctx.moveTo(left,-headroom);ctx.lineTo(right,-headroom);
  for(let px=right;px>=left-3;px-=3){
    let rim=Infinity;
    for(let row=v+.012;row<=1.36;row+=1/64)
      rim=Math.min(rim,projectY(px/width,row));
    ctx.lineTo(px,rim+1);
  }
  ctx.closePath();ctx.clip();
}

function visibleBody(u,v,hip,feet,ghost){
  const center=u*width;
  const left=Math.min(center-48,...feet.map(p=>p[0]-24));
  const right=Math.max(center+48,...feet.map(p=>p[0]+24));
  ctx.save();
  clipToTerrain(left,right,v);
  body(center,hip,feet,ghost);
  ctx.restore();
}
function drawSwing(from,to,progress,color){
  ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineCap="round";
  function point(phase){
    const p=interpolateFoot(from,to,phase);
    return [p.x*width,projectY(p.x,p.y)-height*.052*Math.sin(Math.PI*phase)];
  }
  let start=point(progress);
  for(let i=1;i<=20;i++){
    const phase=progress+(1-progress)*i/20;
    const end=point(phase);
    const midPhase=phase-(1-progress)/40;
    const depth=interpolateFoot(from,to,midPhase).y;
    ctx.save();
    clipToTerrain(Math.min(start[0],end[0])-2,Math.max(start[0],end[0])+2,depth);
    ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();
    ctx.restore();start=end;
  }
  for(const contact of [from,to]){
    const px=contact.x*width;
    ctx.save();clipToTerrain(px-9,px+9,contact.y);
    ctx.beginPath();ctx.ellipse(px,projectY(contact.x,contact.y),7,3,0,0,2*Math.PI);ctx.stroke();
    ctx.restore();
  }
}
function draw(){
  ctx.clearRect(0,-headroom,width,height+headroom);
  ctx.drawImage(grid,0,-headroom,width,height+headroom);
  const preview=interpolateFoot(target,nextTarget,robot.phase);
  const fy=height*(.14+.72*preview.y+drop*forecast.depth);
  const ghostSwing=interpolateFoot(planted,nextTarget,robot.phase);
  const ghostFeet=[[target.x*width,projectY(target.x,target.y)],
    [ghostSwing.x*width,projectY(ghostSwing.x,ghostSwing.y)-height*.052*Math.sin(robot.phase*Math.PI)]];
  const legLength=clamp(height/255,.78,1.12)*Math.min(1,width/475)*43;
  const {ground,feet}=pose();
  const hip=pelvisY??ground-legLength;
  ctx.save();
  // Render only the remaining swing, from the lifted foot to touchdown.
  // The stance leg's next swing starts after the current leg touches down.
  drawSwing(planted,nextTarget,0,"rgba(240,196,103,.62)");
  drawSwing(trailing,target,robot.phase,"#ffda83");
  visibleBody(preview.x,preview.y,fy-legLength,ghostFeet,true);
  visibleBody(robot.x,robot.y,hip,feet,false);
  ctx.restore();
}
function settle(dt){
  const {ground}=pose();
  const length=clamp(height/255,.78,1.12)*Math.min(1,width/475)*43;
  const rest=ground-length*(1-.15*terrainDepth(planted.x,planted.y));
  if(pelvisY===undefined)pelvisY=rest;
  const time=clamp(dt,0,.04);
  fallSpeed+=clamp(100*(rest-pelvisY)-17*fallSpeed,-height*6,height*6)*time;
  pelvisY+=fallSpeed*time;
}
function resize(){
  const box=canvas.getBoundingClientRect();width=box.width;height=box.height;
  ratio=Math.min(devicePixelRatio||1,2);
  for(const layer of [canvas,grid]){layer.width=Math.round(width*ratio);layer.height=Math.round(height*ratio);}
  headroom=Math.ceil(Math.max(height,box.top-document.querySelector("#demo-title").getBoundingClientRect().top+120));
  walker.style.top=-headroom+"px";walker.style.height=(height+headroom)+"px";
  walker.width=canvas.width;walker.height=Math.ceil((height+headroom)*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,headroom*ratio);grid.height=walker.height;mesh.setTransform(ratio,0,0,ratio,0,headroom*ratio);
  stride=clamp(68/width,.025,.15);pelvisY=undefined;predict();updateGrid();draw();
}
function changeDepth(delta){
  if(!delta)return;
  patch.x=brush.x;
  patch.y=brush.y;
  patch.depth=clamp(patch.depth+delta,-ridgeLimit,hollowLimit);
  dirty=true;
}
function flex(){if(dirty){updateGrid();dirty=false;}}
canvas.onpointerdown=e=>{
  if(pointer!==null)return;
  const box=canvas.getBoundingClientRect();
  pointer=e.pointerId;canvas.setPointerCapture(pointer);
  brush.x=clamp((e.clientX-box.left)/width,0,1);
  // Select the nearest visible mesh row at the clicked height.
  let best=Infinity;
  for(let j=resolution;j>=0;j--){
    const y=j/resolution,error=Math.abs(projectY(brush.x,y)-(e.clientY-box.top));
    if(error<best){best=error;brush.y=y;}
  }
  dragY=e.clientY;
};
canvas.onpointermove=e=>{
  if(pointer!==e.pointerId)return;
  brush.x=clamp((e.clientX-canvas.getBoundingClientRect().left)/width,0,1);
  changeDepth((e.clientY-dragY)/(height*drop));
  dragY=e.clientY;dirty=true;
};
canvas.onlostpointercapture=()=>{pointer=null;};
canvas.onkeydown=e=>{
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
  e.preventDefault();
  if(e.key==="ArrowUp")changeDepth(-.15);
  if(e.key==="ArrowDown")changeDepth(.15);
  if(e.key==="ArrowLeft")brush.x=clamp(brush.x-.03,0,1);
  if(e.key==="ArrowRight")brush.x=clamp(brush.x+.03,0,1);
  dirty=true;
};
function animate(now){
  if(previous!==undefined){const dt=(now-previous)/1000;flex(dt);advance(dt);settle(dt);}
  previous=now;draw();requestAnimationFrame(animate);
}
new ResizeObserver(resize).observe(canvas);resize();requestAnimationFrame(animate);
