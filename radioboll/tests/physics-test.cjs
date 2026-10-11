const assert=require('node:assert/strict'),P=require('../physics.js');
const players=[{id:'a',name:'Mia',skin:0,team:0},{id:'b',name:'Viktor',skin:1,team:1}];
const play=()=>{const w=P.create(players,'test');w.phase='playing';return w;};
function score(w,team){w.phase='playing';w.ball.x=team===0?P.C.right+P.C.ballRadius+1:P.C.left-P.C.ballRadius-1;w.ball.y=300;w.ball.vx=0;w.ball.vy=0;P.step(w,{},1/60);}
function advance(w,seconds){for(let i=0;i<seconds*60+1;i++)P.step(w,{},1/60);}
// Every visual skin has exactly the same trajectory for identical controls.
const trajectories=[];
for(let skin=0;skin<6;skin++){const w=P.create([{id:'a',name:'A',skin,team:0}]);w.phase='playing';w.ball.x=850;w.ball.y=500;for(let i=0;i<180;i++)P.step(w,{a:{gas:1,steer:.2}},1/60);trajectories.push([w.cars[0].x,w.cars[0].y,w.cars[0].vx,w.cars[0].vy,w.cars[0].angle]);}
trajectories.forEach(t=>assert.deepEqual(t,trajectories[0]));
let w=play();assert(P.valid(w,players,'test'));w.cars[0].x=430;w.cars[0].vx=220;w.ball.x=466;P.step(w,{a:{gas:1}},1/60);assert(w.ball.vx>0,'Bumper transfers momentum into ball');
w=play();w.ball.x=20;w.ball.y=100;P.step(w,{},1/60);assert.deepEqual(w.goals,[0,0]);assert(w.ball.x>=P.C.left+P.C.ballRadius,'Outside opening must bounce');
w=play();score(w,0);assert.deepEqual(w.goals,[1,0]);assert.equal(w.phase,'goal');advance(w,5);assert.equal(w.phase,'playing');assert.equal(w.ball.x,500);assert.deepEqual(w.goals,[1,0]);
// Golden goal wins this round, not the entire best-of-three match.
w=play();w.goals=[2,2];w.remaining=.001;P.step(w,{},1/60);assert(w.overtime);assert.equal(w.phase,'playing');score(w,1);assert.deepEqual(w.wins,[0,1]);assert.equal(w.phase,'between');advance(w,9.1);assert.equal(w.round,2);assert(w.remaining>179.8&&w.remaining<=P.C.roundSeconds);assert(!w.overtime);assert.deepEqual(w.goals,[0,0]);
for(let i=0;i<5;i++)score(w,0);assert.deepEqual(w.wins,[1,1]);assert.equal(w.phase,'between');advance(w,9.1);assert.equal(w.round,3);for(let i=0;i<5;i++)score(w,1);assert.equal(w.phase,'finished');assert.equal(w.winner,1);assert.deepEqual(w.wins,[1,2]);const seq=w.seq;advance(w,5);assert.equal(w.seq,seq);
w=play();w.goals=[3,1];w.remaining=.001;P.step(w,{},1/60);assert.deepEqual(w.wins,[1,0]);assert.equal(w.phase,'between');
w=play();const good=JSON.parse(JSON.stringify(w));assert(P.valid(good,players,'test'));good.cars[0].mass=99;assert(!P.valid(good,players,'test'));assert(!P.valid(w,players,'wrong'));w.cars[1].id='a';assert(!P.valid(w,players,'test'));
// Cars cannot leave the pitch, and releasing gas loses speed.
w=play();w.cars[0].x=930;w.cars[0].vx=100;P.step(w,{},1/60);assert(w.cars[0].x<=P.C.right-P.C.carRadius);w.cars[0].x=500;w.cars[0].vx=100;P.step(w,{},1/60);assert(Math.abs(w.cars[0].vx)<100);
console.log('PASS: six equal car skins, collisions, closed walls and open goals, score/kickoff, timed wins, golden goal, best-of-three, reset rounds, release gas and snapshot validation');
