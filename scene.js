const canvas = document.querySelector("#page-mesh");
const ctx = canvas.getContext("2d");
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
let x=.22, y=.48, width, height, pointer=null, frame=0, previousTime=0;
// At a fixed load, local compliance sets the depth of the observed contact.
function contactDepth(u,v){
  return .018+.18*Math.exp(-(((u-.59)/.21)**2+((v-.54)/.42)**2));
}
let predicted=contactDepth(x,y);
function groundY(v){return height*(.14+.72*v);}
function stroke(points,color,weight){
  ctx.beginPath();
  points.forEach(([u,v],i)=>i?ctx.lineTo(u,v):ctx.moveTo(u,v));
  ctx.lineWidth=weight;ctx.strokeStyle=color;ctx.stroke();
}
function foot(px,py,ghost){
  const ink=ghost?"#c0ddbc":"#ffcb85";
  const s=Math.min(1,height/245);
  ctx.save();ctx.translate(px,py);ctx.scale(s,s);
  ctx.lineCap="round";ctx.lineJoin="round";
  if(ghost)ctx.setLineDash([4,4]);
  stroke([[-17,-46],[5,-34],[-3,-7]],ink,ghost?2:6);
  ctx.beginPath();ctx.ellipse(0,-4,11,5,0,0,Math.PI*2);
  if(ghost){ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();}
  else{ctx.fillStyle=ink;ctx.fill();}
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,width,height);
  const depth=contactDepth(x,y);
  function point(u,v){
    const du=(u-x)*width/height;
    const patch=Math.exp(-((du/.32)**2+((v-y)/.24)**2));
    return [u*width,groundY(v)+height*depth*patch];
  }
  const cols=Math.ceil(width/20);
  for(let j=0;j<=24;j++){
    const v=j/24;
    stroke(Array.from({length:cols*2+5},(_,i)=>point((i-2)/(cols*2),v)),"#6b9e8a",1);
  }
  for(let i=-4;i<=cols+4;i++){
    stroke(Array.from({length:29},(_,j)=>{const v=j/28;return point(i/cols+.07*(v-.5),v);}),"#427466",1);
  }
  const stride=Math.min(.29,Math.max(.13,108/width));
  const nextX=x+stride<=.98?x+stride:x-stride;
  const currentY=groundY(y)+height*depth, nextY=groundY(y)+height*predicted;
  foot(nextX*width,nextY,true);foot(x*width,currentY,false);
  ctx.font="13px system-ui";ctx.textBaseline="middle";
  function label(text,px,py,color){
    const w=ctx.measureText(text).width;
    const left=clamp(px-w/2,4,width-w-4),top=clamp(py,22,height-22);
    ctx.fillStyle="#102d30";ctx.fillRect(left-3,top-9,w+6,18);
    ctx.fillStyle=color;ctx.fillText(text,left,top);
  }
  label("Current step",x*width,currentY+16,"#ffcb85");
  label("Predicted next step",nextX*width,nextY-56,"#cee3ca");
}
function update(time){
  const elapsed=previousTime?Math.min(time-previousTime,60):16;
  previousTime=time;
  predicted+=(contactDepth(x,y)-predicted)*(1-Math.exp(-elapsed/360));
  draw();
  if(Math.abs(contactDepth(x,y)-predicted)>.0003)frame=requestAnimationFrame(update);
  else{frame=0;previousTime=0;}
}
function refresh(){draw();if(!frame)frame=requestAnimationFrame(update);}
function move(e){
  const r=canvas.getBoundingClientRect();
  x=clamp((e.clientX-r.left)/width,0,1);
  y=clamp(((e.clientY-r.top)/height-.14)/.72,0,1);
  refresh();
}
canvas.onpointerdown=e=>{if(pointer!==null)return;pointer=e.pointerId;canvas.setPointerCapture(pointer);move(e);};
canvas.onpointermove=e=>{if(e.pointerId===pointer)move(e);};
canvas.onlostpointercapture=()=>{pointer=null;};
canvas.onkeydown=e=>{
  const dirs={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.05],ArrowDown:[0,.05]};
  if(!dirs[e.key])return;
  e.preventDefault();const [dx,dy]=dirs[e.key];x=clamp(x+dx,0,1);y=clamp(y+dy,0,1);refresh();
};
function resize(){
  const box=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  width=box.width;height=box.height;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);draw();
}
new ResizeObserver(resize).observe(canvas);resize();
