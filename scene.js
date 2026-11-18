const canvas = document.querySelector("canvas");
const slider = document.querySelector("#position");
const ctx = canvas.getContext("2d");
const surface = (x,y) => .4*Math.sin(x*6+y*3)+.28*Math.cos(x*11-y*5)+.16*Math.sin(y*9+x*3);
function draw() {
  const {width:w,height:h} = canvas.getBoundingClientRect();
  const scale = Math.min(devicePixelRatio || 1,2);
  canvas.width = Math.round(w*scale);
  canvas.height = Math.round(h*scale);
  ctx.setTransform(scale,0,0,scale,0,0);
  const center = .12 + .77*Number(slider.value)/100;
  const contacts = [-.085,-.042,0].map((offset,i) => {
    const x = center+offset, y = .48+.09*Math.sin(x*14+i);
    return {x,y,z:surface(x,y)};
  });
  function estimate(x,y) {
    let sum = 0, weight = .08;
    for (const p of contacts) {
      const k = Math.exp(-24*((x-p.x)**2+(y-p.y)**2));
      sum += k*p.z;
      weight += k;
    }
    return sum/weight;
  }
  function project(x,y,z) {
    return [w*(x+.12*(y-.5)), h*(.27+.61*y-.19*z-.06*Math.sin(x*5))];
  }
  function point(x,y) {return project(x,y,estimate(x,y));}
  function stroke(points,color) {
    ctx.beginPath();
    points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.strokeStyle=color;
    ctx.stroke();
  }
  const cols = Math.max(32, Math.round(w/18)), rows = 26;
  for(let j=0;j<=rows;j++) {
    const y=j/rows;
    stroke(Array.from({length:cols+1},(_,i)=>point(-.12+1.24*i/cols,y)), 'rgba(137,199,173,'+(.19+.47*y)+')');
  }
  for(let i=0;i<=cols;i++) {
    const x=-.12+1.24*i/cols;
    stroke(Array.from({length:rows+1},(_,j)=>point(x,j/rows)), '#356362');
  }
  const marks=contacts.map(p=>project(p.x,p.y,p.z));
  stroke(marks,'#e3f3ad');
  marks.forEach(([x,y],i)=>{
    ctx.beginPath();ctx.arc(x,y,4+i,0,2*Math.PI);
    ctx.fillStyle='#d3ed91';ctx.fill();
    if(i===2){ctx.beginPath();ctx.arc(x,y,12,0,2*Math.PI);ctx.strokeStyle='#d3ed91';ctx.stroke();}
  });
  const [footX,footY] = marks[2];
  const side = footX < w/2 ? 1 : -1;
  ctx.save();
  ctx.translate(footX,footY);
  ctx.scale(side,1);
  ctx.lineCap="round";
  ctx.lineJoin="round";
  const leg=[[42,-98],[14,-87],[33,-54],[0,-8]];
  ctx.lineWidth=13;
  stroke(leg,"#101f24");
  ctx.lineWidth=7;
  stroke(leg,"#e9dfc8");
  for(const [x,y] of leg.slice(1,3)){
    ctx.beginPath();ctx.arc(x,y,8,0,2*Math.PI);ctx.fillStyle="#708681";ctx.fill();
    ctx.beginPath();ctx.arc(x,y,3,0,2*Math.PI);ctx.fillStyle="#e9dfc8";ctx.fill();
  }
  ctx.beginPath();ctx.ellipse(0,-5,10,6,0,0,2*Math.PI);ctx.fillStyle="#f1bc7b";ctx.fill();
  ctx.restore();
}
function move(event) {
  const bounds=canvas.getBoundingClientRect();
  slider.value=Math.round(100*((event.clientX-bounds.left)/bounds.width-.12)/.77);
  draw();
}
canvas.addEventListener("pointerdown",move);
canvas.addEventListener("pointermove",event=>{if(event.buttons===1) move(event);});
slider.addEventListener("input",draw);
new ResizeObserver(draw).observe(canvas);
draw();
