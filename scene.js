const canvas = document.querySelector("#page-mesh");
const ctx = canvas.getContext("2d");
const grid = document.createElement("canvas");
const mesh = grid.getContext("2d");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const patch = {x:.57, y:.52};
const robot = {x:.15, y:.52, direction:1, phase:0, observed:0, lateral:0};
let width, height, ratio, stride, forecast, pointer=null, previous;
function softness(x,y){
  return Math.exp(-(((x-patch.x)/.135)**2+((y-patch.y)/.25)**2));
}
function projectY(x,y){return height*(.14+.72*y+.19*softness(x,y));}
function updateGrid(){
  mesh.clearRect(0,0,width,height);
  const cols=Math.ceil(width/20);
  function line(count,point,color){
    mesh.beginPath();
    for(let i=0;i<count;i++){
      const [x,y]=point(i), px=x*width, py=projectY(x,y);
      if(i)mesh.lineTo(px,py);else mesh.moveTo(px,py);
    }
    mesh.strokeStyle=color;mesh.stroke();
  }
  for(let j=-9;j<=33;j++)line(cols*2+5,i=>[(i-2)/(cols*2),j/24],"#6b9e8a");
  for(let i=-5;i<=cols+5;i++)line(47,j=>{const y=(j-9)/28;return [i/cols+.07*(y-.5),y];},"#427466");
}
function predict(){
  forecast={x:robot.x+robot.direction*stride*(1-.56*robot.observed),
    y:robot.y+robot.lateral,depth:robot.observed};
}
function advance(dt){
  const amount=Math.min(dt,.05)/.9;
  robot.x+=amount*robot.direction*stride*(1-.56*softness(robot.x,robot.y));
  robot.y=clamp(robot.y+amount*robot.lateral,.29,.74);
  robot.phase+=amount;
  if(robot.phase>=1){
    robot.phase-=1;
    const spread=.07;
    const left=softness(robot.x,robot.y-spread),right=softness(robot.x,robot.y+spread);
    robot.observed=(left+right)/2;
    robot.lateral=clamp((left-right)*.11+(.52-robot.y)*.12,-.06,.06);
    if(robot.x+robot.direction*stride>.93||robot.x+robot.direction*stride<.07)robot.direction*=-1;
    predict();
  }
}
function body(x,baseline,ghost){
  ctx.save();ctx.translate(x,baseline);ctx.scale(robot.direction,1);
  const scale=Math.min(1,width/520);ctx.scale(scale,scale);
  ctx.lineJoin="round";ctx.lineCap="round";
  ctx.strokeStyle=ghost?"#d2e6cc":"#f6dfad";
  if(ghost)ctx.setLineDash([4,4]);
  const swing=Math.sin(robot.phase*2*Math.PI);
  for(const [hip,offset,phase] of [[-16,-5,-1],[16,-5,1],[-16,3,1],[16,3,-1]]){
    const dx=ghost?0:7*phase*swing;
    ctx.beginPath();ctx.moveTo(hip+offset,-25);ctx.lineTo(hip+offset-5+dx/2,-14);
    ctx.lineTo(hip+offset+dx,-2-(ghost?0:Math.max(0,phase*swing)*5));
    ctx.lineWidth=ghost?1.3:3;ctx.stroke();
  }
  ctx.beginPath();ctx.roundRect(-23,-37,49,15,5);
  if(!ghost){ctx.fillStyle="#b6cbc0";ctx.fill();}
  ctx.stroke();ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,width,height);ctx.drawImage(grid,0,0,width,height);
  const fy=height*(.14+.72*forecast.y+.19*forecast.depth);
  body(forecast.x*width,fy,true);
  body(robot.x*width,projectY(robot.x,robot.y),false);
}
function resize(){
  const box=canvas.getBoundingClientRect();width=box.width;height=box.height;
  ratio=Math.min(devicePixelRatio||1,2);
  for(const layer of [canvas,grid]){layer.width=Math.round(width*ratio);layer.height=Math.round(height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);mesh.setTransform(ratio,0,0,ratio,0,0);
  stride=clamp(115/width,.085,.20);predict();updateGrid();draw();
}
function movePatch(x,y){patch.x=clamp(x,0,1);patch.y=clamp(y,0,1);updateGrid();draw();}
function drag(e){
  const box=canvas.getBoundingClientRect();
  movePatch((e.clientX-box.left)/width,((e.clientY-box.top)/height-.14)/.72);
}
canvas.onpointerdown=e=>{if(pointer!==null)return;pointer=e.pointerId;canvas.setPointerCapture(pointer);drag(e);};
canvas.onpointermove=e=>{if(pointer===e.pointerId)drag(e);};
canvas.onlostpointercapture=()=>{pointer=null;};
canvas.onkeydown=e=>{
  const directions={ArrowLeft:[-.03,0],ArrowRight:[.03,0],ArrowUp:[0,-.06],ArrowDown:[0,.06]};
  const delta=directions[e.key];if(!delta)return;
  e.preventDefault();movePatch(patch.x+delta[0],patch.y+delta[1]);
};
function animate(now){
  if(previous!==undefined)advance((now-previous)/1000);
  previous=now;draw();requestAnimationFrame(animate);
}
new ResizeObserver(resize).observe(canvas);resize();requestAnimationFrame(animate);
