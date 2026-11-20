const canvas = document.querySelector("#page-mesh");
const walker = document.querySelector("#walker");
const ctx = walker.getContext("2d");

const grid = document.createElement("canvas");
const mesh = grid.getContext("2d");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const patch = {x:.51, y:.72, depth:.46};
const resolution=80;
let edited=false, elapsed=0;
let humanStance=0,dogStance=0;
const humanPause={armed:true,pending:false,left:0,speed:null}, dogPause={armed:true,pending:false,left:0,speed:null};
const brush={x:patch.x,y:patch.y};
let dragY=0,dirty=false,headroom=0;
const drop = .34;
// Limit the added ridge to a quarter of the terrain panel height.
const ridgeLimit=.25/drop;
const hollowLimit=.25/drop;
let pelvisY, fallSpeed=0, side=1;
let angle=Math.PI*.76;
const followingGap=1.03;
let dogAngle=angle-followingGap;
function route(a){
  return {x:.50+.36*Math.cos(a),y:.56+.24*Math.sin(a),direction:-Math.sin(a)};
}
const robot={...route(angle),phase:0,observed:0};
let planted=route(angle), trailing=route(angle-.11);
let width, height, ratio, stride, forecast, pointer=null, previous;
function sculptedDepth(x,y){
  return patch.depth*Math.exp(-(((x-patch.x)/.135)**2+((y-patch.y)/.25)**2));
}
function terrainDepth(x,y){
  const hills=.32*Math.sin(2*Math.PI*(x+.23*y))+.18*Math.cos(2*Math.PI*(y-.52*x));
  return hills+sculptedDepth(x,y);
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
      const bottomFade=clamp((1-screenY)/.17,0,1);
      const deformation=sculptedDepth(x,y);
      const crest=clamp(-deformation*3,0,1);
      const edgeOpacity=topFade*topFade*bottomFade*bottomFade;
      const rowOpacity=edgeOpacity+(1-edgeOpacity)*.25*crest*crest;
      if(rowOpacity<.002)continue;
      mesh.globalAlpha=rowOpacity;
      const slope=(terrainDepth(x+.012,y)-terrainDepth(x-.012,y))*6+
                  (terrainDepth(x,y+.015)-terrainDepth(x,y-.015))*5;
      const light=clamp(24-14*depth+10*slope,8,39);
      const points=[vertex(i,j),vertex(i+1,j),vertex(i+1,j+1),vertex(i,j+1)];
      mesh.beginPath();points.forEach(([px,py],k)=>k?mesh.lineTo(px,py):mesh.moveTo(px,py));
      mesh.closePath();
      mesh.fillStyle="hsl(160 20% "+(65+light*.38-6*crest)+"%)";
      mesh.fill();
      mesh.strokeStyle="hsla(159,25%,"+(40+8*slope)+"%,.33)";mesh.lineWidth=.7;mesh.stroke();
    }
  }
  mesh.globalAlpha=1;
}
function angleStep(depth){
  return stride*(1-.50*Math.min(Math.abs(depth),1.4))/.36;
}
let target, nextTarget, ghostTarget;
let landedSwing=false;
function footfall(a,leg){
  const p=route(a);
  return {...p,y:p.y+.018*leg,angle:a};
}
function predict(){
  const step=angleStep(robot.observed);
  if(!target)target=footfall(angle+step,-side);
  if(!nextTarget)nextTarget=footfall(angle+2*step,side);
  ghostTarget=footfall(Math.max(angle+3*step,nextTarget.angle+step*.5),-side);
  forecast={...nextTarget,depth:robot.observed};
}
function interpolateFoot(a,b,t){
  const blend=t*t*(3-2*t);
  return {x:a.x+(b.x-a.x)*blend,y:a.y+(b.y-a.y)*blend};
}
function obstacleEffort(a){
  if(!edited)return 0;
  const p=route(a+.045);
  const dx=(p.x-patch.x)/.135,dy=(p.y-patch.y)/.25;
  return clamp(Math.abs(patch.depth)*2.4,0,1)*Math.exp(-.65*(dx*dx+dy*dy));
}
function requestStop(state,a){
  const effort=obstacleEffort(a+.12);
  if(effort<.13)state.armed=true;
  if(state.armed&&effort>.32){state.armed=false;state.pending=true;}
}
const standingDuration=.95;
function stopWobble(state){
  const progress=1-state.left/standingDuration;
  return .23*(1-progress)**2*Math.sin(progress*3*Math.PI);
}
function projectionProgress(state){
  const stoppedFor=standingDuration-state.left;
  return state.left>0?clamp((stoppedFor-.18)/.48,0,1):1;
}
function stand(state){
  state.pending=false;
  state.left=standingDuration;
  state.speed=0;
}
function smoothSpeed(state,target,time){
  const speed=state.speed??target;
  // Ramp up over several frames while allowing quicker braking.
  const rate=target>speed?2.2:7;
  state.speed=speed+(target-speed)*(1-Math.exp(-rate*time));
  return state.speed;
}
function advance(dt){
  const time=Math.min(dt,.05);
  elapsed+=time;
  requestStop(humanPause,angle);
  requestStop(dogPause,dogAngle);
  const wasHumanStopped=humanPause.left>0;
  const angularSpeed=angleStep(terrainDepth(robot.x,robot.y));
  let amount=0;
  if(humanPause.left>0)humanPause.left=Math.max(0,humanPause.left-time);
  else if(humanPause.pending&&robot.phase===0)stand(humanPause);
  else{
    amount=time/.9*smoothSpeed(humanPause,angularSpeed,time)/angularSpeed;
    if(humanPause.pending)amount=Math.min(amount,1-robot.phase);
  }
  angle+=amount*angularSpeed;
  const correction=clamp((angle-dogAngle-followingGap)*2,-.2,.2);
  if(dogPause.left>0)dogPause.left=Math.max(0,dogPause.left-time);
  else{
    const available=Math.max(0,angle-.68-dogAngle);
    const desired=Math.min(Math.max(0,angularSpeed+correction),available*.9/Math.max(time,.001));
    const speed=smoothSpeed(dogPause,desired,time);
    const next=dogAngle+Math.min(available,time/.9*speed);
    // Both diagonal pairs are in stance just after each half-cycle boundary.
    const stance=Math.ceil((dogAngle-.00001)/.09)*.09+.00001;
    if(dogPause.pending&&stance<=next){dogAngle=stance;stand(dogPause);}
    else dogAngle=next;
  }
  Object.assign(robot,route(angle));
  robot.phase+=amount;
  if(robot.phase>=1){
    robot.phase-=1;
    landedSwing=true;
    if(humanPause.pending){robot.phase=0;stand(humanPause);}
    trailing=planted;planted=target;target=nextTarget;nextTarget=ghostTarget;side*=-1;
    robot.observed=terrainDepth(planted.x,planted.y);
    predict();
  }
  if(!wasHumanStopped&&humanPause.left>0){
    // Discard the old forecast and seed a new plan from the stop location.
    robot.observed=terrainDepth(robot.x,robot.y);
    target=null;
    nextTarget=null;
    predict();
  }
  const blend=Math.min(1,time*7);
  humanStance=clamp(humanStance+(humanPause.left?blend:-blend),0,1);
  dogStance=clamp(dogStance+(dogPause.left?blend:-blend),0,1);
}
function swingLift(from,to,phase){
  const rise=height*drop*(terrainDepth(from.x,from.y)-terrainDepth(to.x,to.y));
  const clearance=height*.040+clamp(rise*.33,0,15);
  return clearance*Math.sin(Math.PI*phase);
}
function swingPoint(from,to,phase){
  const p=interpolateFoot(from,to,phase);
  return [p.x*width,projectY(p.x,p.y)-swingLift(from,to,phase)];
}
function pose(){
  const ground=projectY(planted.x,planted.y);
  const feet=[[planted.x*width,ground],swingPoint(trailing,target,robot.phase)];
  const standingGround=projectY(robot.x,robot.y);
  const stanceWidth=5*Math.min(1,width/475);
  for(let i=0;i<feet.length;i++){
    feet[i][0]+=humanStance*(robot.x*width+(i?stanceWidth:-stanceWidth)-feet[i][0]);
    const footGround=projectY(feet[i][0]/width,robot.y);
    feet[i][1]+=humanStance*(footGround-feet[i][1]);
  }
  return {ground:ground+(standingGround-ground)*humanStance,feet};
}
function terrainRise(a){
  const p=route(a),ahead=route(a+.09);
  return terrainDepth(p.x,p.y)-terrainDepth(ahead.x,ahead.y);
}
function slopeTilt(a){
  const rise=terrainRise(a);
  if(obstacleEffort(a)<.16||Math.abs(rise)<.018)return 0;
  const facing=route(a).direction;
  return clamp(-rise*1.7,-.32,.32)*facing+Math.sin(elapsed*17)*.065;
}
function body(px,hip,feet,ghost){
  const s=clamp(height/255,.78,1.12)*Math.min(1,width/475),dir=ghost?forecast.direction:robot.direction;
  ctx.save();ctx.lineJoin="round";ctx.lineCap="round";
  if(ghost)ctx.setLineDash([4,4]);
  function limb(points,ink,weight){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=ghost?"hsl(11 23% 32% / .76)":ink;ctx.lineWidth=ghost?1.4:weight*s;ctx.stroke();
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
    const facing=dir<0?-1:1;
    const thigh=clamp(Math.atan2(facing*(knee[0]-hx),knee[1]-hy),-.65,1.18);
    const limitedKnee=[hx+facing*segment*Math.sin(thigh),hy+segment*Math.cos(thigh)];
    const shin=Math.atan2(facing*(ankle[0]-knee[0]),ankle[1]-knee[1]);
    const flex=clamp(thigh-shin,.16,2.15);
    const foot=ghost?[limitedKnee[0]+facing*segment*Math.sin(thigh-flex),limitedKnee[1]+segment*Math.cos(thigh-flex)]:ankle;
    limb([[hx,hy],ghost?limitedKnee:knee,foot,[foot[0]+dir*8*s,foot[1]+s]],i?"hsl(11 23% 37%)":"hsl(11 21% 31%)",6);
  });
  function arm(near){
    const sideOfTorso=near?1:-1;
    const cycle=(!ghost&&humanPause.left>0?0:ghost?-side:side)*Math.cos(robot.phase*Math.PI)*sideOfTorso;
    const facing=dir<0?-1:1;
    const shoulder=[px+sideOfTorso*6*s,hip-22*s];
    const upper=cycle*.56;
    const forearm=upper+.32+.44*Math.max(0,cycle);
    const elbow=[shoulder[0]+facing*Math.sin(upper)*13*s,shoulder[1]+Math.cos(upper)*13*s];
    const wrist=[elbow[0]+facing*Math.sin(forearm)*11*s,elbow[1]+Math.cos(forearm)*11*s];
    limb([shoulder,elbow,wrist],near?"hsl(11 23% 36%)":"hsl(11 21% 34%)",4);
  }
  ctx.translate(px,hip);
  ctx.rotate(ghost?0:humanPause.left?stopWobble(humanPause):slopeTilt(angle)*.62);
  ctx.translate(-px,-hip);
  arm(false);
  plate(px-10*s,hip-28*s,21*s,30*s,6*s,"hsl(11 23% 39%)");
  plate(px-7*s,hip-46*s,16*s,16*s,5*s,"hsl(11 23% 45%)");
  if(!ghost)plate(px+(-3+3*dir)*s,hip-42*s,8*s,4*s,1,"#e7d9cf");
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
function drawSwing(from,to,progress,color,consumeStart=false){
  ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineCap="round";
  const point=phase=>swingPoint(from,to,phase);
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
  for(const contact of consumeStart && progress>0?[to]:[from,to]){
    const px=contact.x*width;
    ctx.save();clipToTerrain(px-9,px+9,contact.y);
    ctx.beginPath();ctx.ellipse(px,projectY(contact.x,contact.y),7,3,0,0,2*Math.PI);ctx.stroke();
    ctx.restore();
  }
}
function drawQuadruped(predictive=false){
  const projection=predictive?projectionProgress(dogPause):1;
  if(projection===0)return;
  const lead=projection*projection*(3-2*projection);
  const a=dogAngle+(predictive?.18*lead:0);
  const dog=route(a);
  const scale=Math.min(1,width/530);
  const forwardX=-Math.sin(a),forwardY=Math.cos(a);
  const rightX=-forwardY,rightY=forwardX;
  const projectBody=(long,wide)=>[
    (long*forwardX+wide*rightX)*scale,
    (long*forwardY+wide*rightY)*scale*.45
  ];
  const px=dog.x*width;
  const tilt=predictive?0:dogPause.left?stopWobble(dogPause):slopeTilt(a);
  const legs=[];
  const step=.18, duty=.62;
  for(const [front,lateral] of [[1,-1],[-1,-1],[1,1],[-1,1]]){
    const offset=front===lateral?.5:0;
    const cycle=a/step+offset, phase=cycle-Math.floor(cycle);
    const anchor=(Math.floor(cycle)-offset)*step+front*.063+step*duty/2;
    const from=route(anchor),to=route(anchor+step);
    for(const [point,heading] of [[from,anchor],[to,anchor+step]]){
      point.x-=lateral*Math.cos(heading)*9*scale/width;
      point.y-=lateral*Math.sin(heading)*.025;
    }
    const swing=Math.max(0,(phase-duty)/(1-duty));
    const foot=interpolateFoot(from,to,swing);
    const standing=predictive?0:dogStance;
    const [standX,standY]=projectBody(front*15,lateral*7);
    foot.x+=standing*(dog.x+standX/width-foot.x);
    foot.y+=standing*(dog.y+standY/(.72*height)-foot.y);
    legs.push({front,lateral,from,to,swing,foot,standing});
  }
  const support=legs.filter(leg=>!leg.swing);
  const torso=support.reduce((sum,leg)=>sum+projectY(leg.foot.x,leg.foot.y),0)/support.length-25*scale;
  if(!predictive&&!dogPause.left)for(const leg of legs)drawSwing(leg.from,leg.to,leg.swing,"hsl(213 23% 31% / .72)");
  ctx.save();ctx.globalAlpha*=projection;clipToTerrain(px-65*scale,px+65*scale,dog.y);
  ctx.lineCap="round";ctx.lineJoin="round";
  if(predictive)ctx.setLineDash([3,4]);
  for(const {front,lateral,from,to,swing,foot,standing} of legs){
    const [hipOffsetX,hipOffsetY]=projectBody(front*16,lateral*7);
    const hipX=px+hipOffsetX*Math.cos(tilt)-hipOffsetY*Math.sin(tilt);
    const hipY=torso+hipOffsetX*Math.sin(tilt)+hipOffsetY*Math.cos(tilt);
    const dx=foot.x*width-hipX,dy=projectY(foot.x,foot.y)-swingLift(from,to,swing)*(1-standing)-hipY;
    const bearing=Math.atan2(dx,dy),segment=15*scale;
    const reach=clamp(Math.hypot(dx,dy),segment*.45,segment*1.93);
    const bend=-Math.acos(reach/(2*segment))*forwardX;
    const kneeX=hipX+Math.sin(bearing+bend)*segment,kneeY=hipY+Math.cos(bearing+bend)*segment;
    ctx.beginPath();ctx.moveTo(hipX,hipY);ctx.lineTo(kneeX,kneeY);
    ctx.lineTo(hipX+Math.sin(bearing)*reach,hipY+Math.cos(bearing)*reach);
    ctx.lineWidth=(predictive?1.3:3.5)*scale;
    ctx.strokeStyle=predictive?"hsl(213 23% 32% / .76)":lateral>0?"hsl(213 23% 37%)":"hsl(213 21% 31%)";
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.translate(px,torso);ctx.rotate(tilt);
  ctx.roundRect(-22*scale,-8*scale,44*scale,13*scale,4*scale);
  if(predictive)ctx.stroke();else{ctx.fillStyle="hsl(213 23% 39%)";ctx.fill();}
  ctx.restore();
}
function drawEffortLines(a,centerY,spread,color="hsl(11 23% 36%)"){
  const p=route(a);
  const rise=terrainRise(a);
  if(obstacleEffort(a)<.16||Math.abs(rise)<.018)return;
  ctx.save();
  const center=p.x*width;
  clipToTerrain(center-spread-36,center+spread+36,p.y);
  ctx.strokeStyle=color;
  ctx.lineWidth=1.7;ctx.lineCap="round";
  const marks=[
    {side:-1,offset:-17,length:14,tilt:-6,phase:0},
    {side:-1,offset:-7,length:8,tilt:3,phase:.16},
    {side:1,offset:9,length:15,tilt:7,phase:.44},
    {side:1,offset:19,length:9,tilt:2,phase:.55},
  ];
  for(const {side,offset,length,tilt,phase} of marks){
    const cycle=elapsed*2.7+phase;
    const burst=cycle%1;
    const burstSide=Math.floor(cycle)%2===0?side:-side;
    if(burst>.75)continue;
    ctx.globalAlpha=.9*Math.sin(Math.PI*burst/.75);
    const x=center+burstSide*(spread+3+burst*12);
    const y=centerY+offset;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.bezierCurveTo(x+burstSide*length*.34,y-3,x+burstSide*length*.58,y+tilt+3,x+burstSide*length,y+tilt);
    ctx.stroke();
  }
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,-headroom,width,height+headroom);
  ctx.drawImage(grid,0,-headroom,width,height+headroom);
  const preview=interpolateFoot(nextTarget,ghostTarget,robot.phase);
  const fy=height*(.14+.72*preview.y+drop*forecast.depth);
  const ghostFeet=[[nextTarget.x*width,projectY(nextTarget.x,nextTarget.y)],
    swingPoint(target,ghostTarget,robot.phase)];
  const legLength=clamp(height/255,.78,1.12)*Math.min(1,width/475)*43;
  const {ground,feet}=pose();
  const hip=pelvisY??ground-legLength;
  ctx.save();
  const projection=projectionProgress(humanPause);
  if(projection>0){
    const location=interpolateFoot(robot,preview,projection);
    const blend=projection*projection*(3-2*projection);
    const projectedFeet=ghostFeet.map(([x,y],i)=>[
      feet[i][0]+(x-feet[i][0])*blend,
      feet[i][1]+(y-feet[i][1])*blend
    ]);
    ctx.save();
    ctx.globalAlpha*=projection;
    visibleBody(location.x,location.y,hip+(fy-legLength-hip)*blend,projectedFeet,true);
    ctx.restore();
  }
  // Each landed prediction becomes the solid humanoid’s next swing.
  if(landedSwing&&!humanPause.left&&humanStance===0){
    drawSwing(planted,nextTarget,0,"hsl(11 23% 36%)");
    drawSwing(trailing,target,robot.phase,"hsl(11 23% 36%)",true);
  }
  drawQuadruped(true);
  drawQuadruped();
  const dog=route(dogAngle);
  if(!dogPause.left)drawEffortLines(dogAngle,projectY(dog.x,dog.y)-30,28,"hsl(213 23% 36%)");
  visibleBody(robot.x,robot.y,hip,feet,false);
  if(!humanPause.left)drawEffortLines(angle,hip-22,18);
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
  edited=true;
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
