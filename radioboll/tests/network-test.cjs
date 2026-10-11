const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),P=require('../physics.js');
class Peer {constructor(){this.connectionState='new';}close(){this.connectionState='closed';}}
const context=vm.createContext({RTCPeerConnection:Peer,performance,crypto,RadioPhysics:P});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../network.js'),'utf8')+'\nthis.RadioLink=RadioLink;',context);
const players=[{id:'host',name:'A',skin:0,team:0},{id:'guest',name:'B',skin:1,team:1}];
const calls=[],host=new context.RadioLink(()=>{}, {input:(id,data)=>calls.push({id,...data}),change:()=>{},frame:()=>{}});
host.state={host:true,hostId:'host',me:'host',players};host.gameId='game';
let p=host.makePeer('guest','connection'),dc={readyState:'open',bufferedAmount:0,send:()=>{}};host.attach(p,dc);
const send=m=>dc.onmessage({data:JSON.stringify(m)});
send({type:'input',gameId:'game',n:1,gas:9,steer:-9,id:'host'});assert.equal(calls.length,1);assert.equal(calls[0].id,'guest');assert.equal(calls[0].gas,1);assert.equal(calls[0].steer,-1);
send({type:'input',gameId:'game',n:1,gas:0,steer:0});send({type:'input',gameId:'old',n:9,gas:1,steer:1});send({type:'input',gameId:'game',n:2,gas:'1',steer:0});send({type:'frame',gameId:'game',n:2,world:P.create(players,'game')});assert.equal(calls.length,1);
send({type:'input',gameId:'game',n:3,gas:0,steer:.5});assert.equal(calls.length,2);
const frames=[],guest=new context.RadioLink(()=>{},{input:()=>{},change:()=>{},frame:(w,paused)=>frames.push({w,paused})});guest.gameId='game';guest.state={host:false,hostId:'host',me:'guest',players};p=guest.makePeer('host','connection');dc={readyState:'open',bufferedAmount:0};guest.attach(p,dc);
const w=P.create(players,'game');dc.onmessage({data:JSON.stringify({type:'frame',gameId:'game',n:1,world:w,paused:true})});assert.equal(frames.length,1);assert.equal(frames[0].paused,true);
dc.onmessage({data:JSON.stringify({type:'frame',gameId:'game',n:1,world:w})});assert.equal(frames.length,1);
w.cars[0].mass=99;dc.onmessage({data:JSON.stringify({type:'frame',gameId:'game',n:2,world:w})});assert.equal(frames.length,1);
guest.clear();assert.equal(guest.peers.size,0);
console.log('PASS: connection-owned identity, clamped finite gas/steer, stale/wrong-game packets rejected, guests cannot send state, authoritative frames validated, connections cleared');
