(function(root,factory){if(typeof module==='object')module.exports=factory();else root.RadioPhysics=factory();})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const C=Object.freeze({width:1000,height:600,left:70,right:930,top:45,bottom:555,goalTop:190,goalBottom:410,carRadius:22,ballRadius:16,acceleration:410,maxSpeed:275,turnSpeed:2.8,drag:1.8,roundSeconds:180,goalTarget:5});
 const SKINS=Object.freeze([{name:'Rally',color:'#f5c84c',shape:0},{name:'Sport',color:'#ff7670',shape:1},{name:'Buggy',color:'#63d9b5',shape:2},{name:'Retro',color:'#b8a0ff',shape:3},{name:'Mini',color:'#83caff',shape:4},{name:'Taxi',color:'#ff9d53',shape:5}]);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function kickoff(w){
  w.ball={x:500,y:300,vx:0,vy:0,r:C.ballRadius,mass:.65};
  for(const team of [0,1]){const list=w.cars.filter(c=>c.team===team);list.forEach((c,i)=>{c.x=team?745:255;c.y=300+(i-(list.length-1)/2)*90;c.angle=team?Math.PI:0;c.vx=0;c.vy=0;});}
 }
 function create(players,gameId='practice'){
  const w={gameId,seq:0,cars:players.map(p=>({id:p.id,name:p.name,skin:p.skin,team:p.team,x:0,y:0,angle:0,vx:0,vy:0,r:C.carRadius,mass:2})),ball:null,goals:[0,0],wins:[0,0],round:1,remaining:C.roundSeconds,overtime:false,phase:'kickoff',wait:3,event:'AVSPARK',winner:null};kickoff(w);return w;
 }
 function endRound(w,team){
  w.wins[team]++;w.winner=team;
  if(w.wins[team]===2){w.phase='finished';w.event='MATCHVINNARE';w.wait=0;}
  else{w.phase='between';w.wait=6;w.event='OMGÅNG '+w.round+' TILL '+(team?'KORALL':'TURKOS');}
 }
 function goal(w,team){
  w.goals[team]++;w.event='MÅL FÖR '+(team?'KORALL':'TURKOS');
  if(w.overtime||w.goals[team]>=C.goalTarget){endRound(w,team);return;}
  w.phase='goal';w.wait=2.5;
 }
 function collision(a,b){
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d>=min)return;
  if(d<.0001){dx=1;dy=0;d=1;}
  const nx=dx/d,ny=dy/d,ia=1/a.mass,ib=1/b.mass,overlap=min-d;
  a.x-=nx*overlap*ia/(ia+ib);a.y-=ny*overlap*ia/(ia+ib);b.x+=nx*overlap*ib/(ia+ib);b.y+=ny*overlap*ib/(ia+ib);
  const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(closing<0){const impulse=-(1.8)*closing/(ia+ib);a.vx-=impulse*nx*ia;a.vy-=impulse*ny*ia;b.vx+=impulse*nx*ib;b.vy+=impulse*ny*ib;}
 }
 function wall(o,ball=false){
  if(o.y<C.top+o.r){o.y=C.top+o.r;o.vy=Math.abs(o.vy)*.78;}if(o.y>C.bottom-o.r){o.y=C.bottom-o.r;o.vy=-Math.abs(o.vy)*.78;}
  const opening=ball&&o.y>C.goalTop+o.r&&o.y<C.goalBottom-o.r;
  if(!opening){if(o.x<C.left+o.r){o.x=C.left+o.r;o.vx=Math.abs(o.vx)*.78;}if(o.x>C.right-o.r){o.x=C.right-o.r;o.vx=-Math.abs(o.vx)*.78;}}
 }
 function step(w,inputs,dt){
  if(w.phase==='finished')return;
  dt=clamp(Number(dt)||0,0,1/30);w.seq++;
  if(['kickoff','goal','between'].includes(w.phase)){
   w.wait=Math.max(0,w.wait-dt);if(w.wait>0)return;
   if(w.phase==='between'){w.round++;w.goals=[0,0];w.remaining=C.roundSeconds;w.overtime=false;w.winner=null;w.phase='kickoff';w.wait=3;w.event='AVSPARK';kickoff(w);return;}
   if(w.phase==='goal'){kickoff(w);w.phase='kickoff';w.wait=2;w.event='AVSPARK';return;}
   w.phase='playing';w.event=w.overtime?'GOLDEN GOAL':'';
  }
  w.remaining=Math.max(0,w.remaining-dt);
  for(const car of w.cars){const input=inputs[car.id]||{},gas=clamp(Number(input.gas)||0,0,1),steer=clamp(Number(input.steer)||0,-1,1);
   car.angle=(car.angle+steer*C.turnSpeed*dt)%(Math.PI*2);
   car.vx+=Math.cos(car.angle)*C.acceleration*gas*dt;car.vy+=Math.sin(car.angle)*C.acceleration*gas*dt;
   // Keep tyre grip while retaining enough sideways momentum for bumper impacts.
   const rightX=-Math.sin(car.angle),rightY=Math.cos(car.angle),side=car.vx*rightX+car.vy*rightY;
   car.vx-=rightX*side*Math.min(1,7*dt);car.vy-=rightY*side*Math.min(1,7*dt);
   const drag=Math.exp(-C.drag*dt);car.vx*=drag;car.vy*=drag;
   const speed=Math.hypot(car.vx,car.vy);if(speed>C.maxSpeed){car.vx*=C.maxSpeed/speed;car.vy*=C.maxSpeed/speed;}
   car.x+=car.vx*dt;car.y+=car.vy*dt;
  }
  const b=w.ball,drag=Math.exp(-.55*dt);b.vx*=drag;b.vy*=drag;b.x+=b.vx*dt;b.y+=b.vy*dt;
  // Two passes keep crowded bumper collisions stable.
  for(let pass=0;pass<2;pass++){
   for(let i=0;i<w.cars.length;i++){collision(w.cars[i],b);for(let j=i+1;j<w.cars.length;j++)collision(w.cars[i],w.cars[j]);}
   w.cars.forEach(c=>wall(c));wall(b,true);
  }
  const ballSpeed=Math.hypot(b.vx,b.vy);if(ballSpeed>650){b.vx*=650/ballSpeed;b.vy*=650/ballSpeed;}
  if(b.y>C.goalTop+b.r&&b.y<C.goalBottom-b.r){if(b.x<C.left-b.r){goal(w,1);return;}if(b.x>C.right+b.r){goal(w,0);return;}}
  if(w.remaining<=0&&!w.overtime){if(w.goals[0]!==w.goals[1])endRound(w,w.goals[0]>w.goals[1]?0:1);else{w.overtime=true;w.event='GOLDEN GOAL';}}
 }
 function valid(w,players,gameId){
  if(!w||w.gameId!==gameId||!Array.isArray(w.cars)||w.cars.length!==players.length||!['kickoff','playing','goal','between','finished'].includes(w.phase))return false;
  if(!Number.isSafeInteger(w.seq)||w.seq<0||!Number.isFinite(w.remaining)||w.remaining<0||w.remaining>C.roundSeconds||!Number.isFinite(w.wait)||w.wait<0||w.wait>6)return false;
  if(![1,2,3].includes(w.round)||typeof w.overtime!=='boolean'||typeof w.event!=='string'||w.event.length>100||![null,0,1].includes(w.winner))return false;
  if(![w.goals,w.wins].every(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=5)))return false;
  if(w.wins.some(n=>n>2))return false;
  const objects=[w.ball,...w.cars];if(objects.some(o=>!o||!['x','y','vx','vy'].every(k=>Number.isFinite(o[k])&&Math.abs(o[k])<3000)))return false;
  if(w.ball.r!==C.ballRadius||w.ball.mass!==.65)return false;
  return w.cars.every(c=>{const p=players.find(p=>p.id===c.id);return p&&p.team===c.team&&p.skin===c.skin&&p.name===c.name&&c.r===C.carRadius&&c.mass===2&&Number.isFinite(c.angle)&&Math.abs(c.angle)<20;})&&new Set(w.cars.map(c=>c.id)).size===players.length;
 }
 return {C,SKINS,create,step,kickoff,valid};
});
