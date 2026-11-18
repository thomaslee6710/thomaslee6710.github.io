const canvas = document.querySelector("#page-mesh");
const ctx = canvas.getContext("2d");
const grid = document.createElement("canvas");
const mesh = grid.getContext("2d");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const patch = {x:.45, y:.52, depth:.48};
let targetDepth=patch.depth, terrainSpeed=0, dragY=0, dirty=false;
const drop = .34;
let pelvisY, fallSpeed=0, plantedX=.15, trailingX=.12, side=1;
const robot = {x:.15, y:.52, direction:1, phase:0, observed:0, lateral:0};
let width, height, ratio, stride, forecast, pointer=null, previous;
function terrainDepth(x,y){
  return patch.depth*Math.exp(-(((x-patch.x)/.135)**2+((y-patch.y)/.25)**2));
}
function projectY(x,y){return height*(.14+.72*y+drop*terrainDepth(x,y));}
function updateGrid(){
  mesh.clearRect(0,0,width,height);
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
      const slope=(terrainDepth(x+.012,y)-terrainDepth(x-.012,y))*6+
                  (terrainDepth(x,y+.015)-terrainDepth(x,y-.015))*5;
      const light=clamp(24-14*depth+10*slope,8,39);
      const points=[vertex(i,j),vertex(i+1,j),vertex(i+1,j+1),vertex(i,j+1)];
      mesh.beginPath();points.forEach(([px,py],k)=>k?mesh.lineTo(px,py):mesh.moveTo(px,py));
      mesh.closePath();mesh.fillStyle="hsl(169 31% "+light+"%)";mesh.fill();
      mesh.strokeStyle="hsla(158,38%,"+(49+8*slope)+"%,.62)";mesh.lineWidth=.7;mesh.stroke();
    }
  }
}
function predict(){
  forecast={x:robot.x+robot.direction*stride*(1-.56*Math.abs(robot.observed)),
    y:robot.y+robot.lateral,depth:robot.observed};
}
function advance(dt){
  const amount=Math.min(dt,.05)/.9;
  robot.x+=amount*robot.direction*stride*(1-.56*Math.abs(terrainDepth(robot.x,robot.y)));
  robot.y=clamp(robot.y+amount*robot.lateral,.29,.74);
  robot.phase+=amount;
  if(robot.phase>=1){
    robot.phase-=1;
    trailingX=plantedX;plantedX=robot.x+robot.direction*stride*.30;side*=-1;
    const spread=.07;
    const left=terrainDepth(plantedX,robot.y-spread),right=terrainDepth(plantedX,robot.y+spread);
    robot.observed=(left+right)/2;
    robot.lateral=clamp((left-right)*.11+(.52-robot.y)*.12,-.06,.06);
    if(robot.x+robot.direction*stride>.93||robot.x+robot.direction*stride<.07)robot.direction*=-1;
    predict();
  }
}
function pose(){
  const phase=robot.phase, blend=phase*phase*(3-2*phase);
  const landing=robot.x+robot.direction*stride*(1-phase+.30)*(1-.56*Math.abs(robot.observed));
  const swingX=trailingX+(landing-trailingX)*blend;
  const ground=projectY(plantedX,robot.y);
  const lift=height*.072*Math.sin(Math.PI*phase);
  return {ground,feet:[[plantedX*width,ground],[swingX*width,projectY(swingX,robot.y)-lift]]};
}
function body(px,hip,feet,ghost){
  const s=clamp(height/255,.78,1.12)*Math.min(1,width/475),dir=robot.direction;
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
    const dx=fx-hx,dy=fy-hy,dist=Math.max(1,Math.hypot(dx,dy));
    const bend=Math.sqrt(Math.max(0,(28*s)**2-(dist/2)**2));
    const knee=[(hx+fx)/2+dir*dy/dist*bend,(hy+fy)/2-dir*dx/dist*bend];
    limb([[hx,hy],knee,[fx,fy-3*s],[fx+dir*8*s,fy-2*s]],i?"#f0dbba":"#83a59d",6);
  });
  plate(px-10*s,hip-28*s,21*s,30*s,6*s,"#cee0d6");
  plate(px-7*s,hip-46*s,16*s,16*s,5*s,"#e2e9df");
  if(!ghost)plate(px+(dir>0?0:-6)*s,hip-42*s,8*s,4*s,1,"#173d41");
  for(const n of [-1,1]){
    const swing=n*side*Math.cos(robot.phase*Math.PI)*9*s;
    limb([[px+n*5*s,hip-22*s],[px+swing-dir*4*s,hip-10*s],[px+1.6*swing+dir*3*s,hip-3*s]],n>0?"#efbb7d":"#839e96",4);
  }
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,width,height);ctx.drawImage(grid,0,0,width,height);
  const fy=height*(.14+.72*forecast.y+drop*forecast.depth),fx=forecast.x*width;
  const legLength=clamp(height/255,.78,1.12)*Math.min(1,width/475)*47;
  body(fx,fy-legLength,[[fx-7,fy],[fx+8,fy]],true);
  const {ground,feet}=pose();
  body(robot.x*width,pelvisY??ground-legLength,feet,false);
}
function settle(dt){
  const {ground}=pose();
  const length=clamp(height/255,.78,1.12)*Math.min(1,width/475)*47;
  const rest=ground-length*(1-.15*terrainDepth(plantedX,robot.y));
  if(pelvisY===undefined)pelvisY=rest;
  const time=clamp(dt,0,.04);
  fallSpeed+=clamp(100*(rest-pelvisY)-17*fallSpeed,-height*6,height*6)*time;
  pelvisY+=fallSpeed*time;
}
function resize(){
  const box=canvas.getBoundingClientRect();width=box.width;height=box.height;
  ratio=Math.min(devicePixelRatio||1,2);
  for(const layer of [canvas,grid]){layer.width=Math.round(width*ratio);layer.height=Math.round(height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);mesh.setTransform(ratio,0,0,ratio,0,0);
  stride=clamp(68/width,.025,.15);pelvisY=undefined;predict();updateGrid();draw();
}
function changeDepth(delta){
  targetDepth=clamp(targetDepth+delta,-.83,1.15);
}
function flex(dt){
  const t=Math.min(dt,.04);
  if(Math.abs(targetDepth-patch.depth)+Math.abs(terrainSpeed)>.002){
    terrainSpeed+=(175*(targetDepth-patch.depth)-16*terrainSpeed)*t;
    patch.depth+=terrainSpeed*t;
    dirty=true;
  }
  if(dirty){updateGrid();dirty=false;}
}
canvas.onpointerdown=e=>{
  if(pointer!==null)return;
  const box=canvas.getBoundingClientRect();
  pointer=e.pointerId;canvas.setPointerCapture(pointer);
  patch.x=clamp((e.clientX-box.left)/width,0,1);
  patch.y=clamp(((e.clientY-box.top)/height-.14-drop*patch.depth)/.72,0,1);
  dragY=e.clientY;dirty=true;
};
canvas.onpointermove=e=>{
  if(pointer!==e.pointerId)return;
  patch.x=clamp((e.clientX-canvas.getBoundingClientRect().left)/width,0,1);
  changeDepth((e.clientY-dragY)/(height*drop));
  dragY=e.clientY;dirty=true;
};
canvas.onlostpointercapture=()=>{pointer=null;};
canvas.onkeydown=e=>{
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
  e.preventDefault();
  if(e.key==="ArrowUp")changeDepth(-.15);
  if(e.key==="ArrowDown")changeDepth(.15);
  if(e.key==="ArrowLeft")patch.x=clamp(patch.x-.03,0,1);
  if(e.key==="ArrowRight")patch.x=clamp(patch.x+.03,0,1);
  dirty=true;
};
function animate(now){
  if(previous!==undefined){const dt=(now-previous)/1000;flex(dt);advance(dt);settle(dt);}
  previous=now;draw();requestAnimationFrame(animate);
}
new ResizeObserver(resize).observe(canvas);resize();requestAnimationFrame(animate);
