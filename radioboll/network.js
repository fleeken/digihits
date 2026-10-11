'use strict';
class RadioLink {
 constructor(rpc,callbacks){this.rpc=rpc;this.callbacks=callbacks;this.peers=new Map();this.gameId=null;this.state=null;this.after=0;this.queue=Promise.resolve();this.iceInbox=new Map();this.inputSeq=0;this.frameSeq=0;this.closed=false;}
 async sync(state){
  if(this.closed)return;
  if(this.gameId!==state.gameId){this.clear();this.gameId=state.gameId;this.after=0;}
  this.state=state;
  const ids=new Set(state.players.map(p=>p.id));
  for(const [id,p] of this.peers)if(!ids.has(id)){p.pc.close();this.peers.delete(id);}
  for(const message of state.signals||[]){if(message.id<=this.after)continue;this.after=message.id;this.queue=this.queue.then(()=>this.handleSignal(message)).catch(()=>this.callbacks.change());}
  if(state.host){for(const player of state.players){if(player.id===state.me)continue;const old=this.peers.get(player.id);
   if(!old||(old.failedAt&&performance.now()-old.failedAt>4000)){old?.pc.close();const p=this.makePeer(player.id,crypto.randomUUID());this.attach(p,p.pc.createDataChannel('radioboll',{ordered:false,maxRetransmits:0}));await this.offer(p);}
  }}
 }
 makePeer(id,connection){
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]});
  const p={id,connection,pc,dc:null,localIce:[],sdpSent:false,remoteSeq:-1,failedAt:0,created:performance.now(),signalChain:Promise.resolve()};
  this.peers.set(id,p);
  pc.onicecandidate=e=>{if(!e.candidate)return;const data={kind:'ice',connection,candidate:e.candidate.toJSON()};if(p.sdpSent)this.signal(p,data);else p.localIce.push(data);};
  pc.ondatachannel=e=>this.attach(p,e.channel);
  pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState)&&!p.failedAt)p.failedAt=performance.now();this.callbacks.change();};
  return p;
 }
 signal(p,data){
  const gameId=this.gameId,code=this.state.code;
  p.signalChain=p.signalChain.then(()=>{if(this.closed||this.peers.get(p.id)!==p||this.gameId!==gameId)return;return this.rpc('signal',{code,gameId,target:p.id,data});}).catch(()=>{p.failedAt=performance.now();this.callbacks.change();});
  return p.signalChain;
 }
 async sendDescription(p,description){
  await p.pc.setLocalDescription(description);
  await this.signal(p,{kind:description.type,connection:p.connection,sdp:p.pc.localDescription.sdp});
  p.sdpSent=true;for(const ice of p.localIce.splice(0))this.signal(p,ice);
 }
 async offer(p){try{await this.sendDescription(p,await p.pc.createOffer());}catch{p.failedAt=performance.now();}}
 async handleSignal(m){
  if(this.closed||!this.state?.players.some(p=>p.id===m.sender))return;
  const d=m.data;if(!d||typeof d.connection!=='string')return;
  let p=this.peers.get(m.sender);
  if(d.kind==='offer'){
   if(this.state.host||m.sender!==this.state.hostId)return;
   if(p?.connection===d.connection)return;
   p?.pc.close();p=this.makePeer(m.sender,d.connection);
   await p.pc.setRemoteDescription({type:'offer',sdp:d.sdp});
   await this.drainIce(p);await this.sendDescription(p,await p.pc.createAnswer());
  }else if(d.kind==='answer'){
   if(!this.state.host||p?.connection!==d.connection)return;
   if(p.pc.signalingState!=='have-local-offer')return;
   await p.pc.setRemoteDescription({type:'answer',sdp:d.sdp});await this.drainIce(p);
  }else if(d.kind==='ice'){
   if(p?.connection===d.connection&&p.pc.remoteDescription)await p.pc.addIceCandidate(d.candidate);
   else{if(this.iceInbox.size>40)this.iceInbox.clear();const list=this.iceInbox.get(d.connection)||[];if(list.length<40)list.push(d.candidate);this.iceInbox.set(d.connection,list);}
  }
 }
 async drainIce(p){for(const ice of this.iceInbox.get(p.connection)||[])await p.pc.addIceCandidate(ice);this.iceInbox.delete(p.connection);}
 attach(p,dc){
  p.dc=dc;dc.onopen=()=>{p.failedAt=0;this.callbacks.change();};dc.onclose=()=>{p.failedAt=performance.now();this.callbacks.change();};
  dc.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>20000||this.peers.get(p.id)!==p)return;let m;try{m=JSON.parse(e.data);}catch{return;}
   if(m.gameId!==this.gameId||!Number.isSafeInteger(m.n)||m.n<=p.remoteSeq)return;
   if(this.state.host&&m.type==='input'&&Number.isFinite(m.gas)&&Number.isFinite(m.steer)){
    p.remoteSeq=m.n;this.callbacks.input(p.id,{gas:Math.max(0,Math.min(1,m.gas)),steer:Math.max(-1,Math.min(1,m.steer))});
   }else if(!this.state.host&&p.id===this.state.hostId&&m.type==='frame'&&RadioPhysics.valid(m.world,this.state.players,this.gameId)){
    p.remoteSeq=m.n;this.callbacks.frame(m.world,!!m.paused);
   }
  };
 }
 send(p,message){if(p?.dc?.readyState==='open'&&p.dc.bufferedAmount<16000)try{p.dc.send(JSON.stringify(message));}catch{}}
 input(input){this.send(this.peers.get(this.state?.hostId),{type:'input',gameId:this.gameId,n:++this.inputSeq,...input});}
 frame(world,paused){const msg={type:'frame',gameId:this.gameId,n:++this.frameSeq,world,paused};for(const p of this.peers.values())this.send(p,msg);}
 connected(id){return id===this.state?.me||this.peers.get(id)?.dc?.readyState==='open';}
 retry(){for(const p of this.peers.values()){p.pc.close();p.failedAt=performance.now()-5000;}this.callbacks.change();}
 clear(){for(const p of this.peers.values())p.pc.close();this.peers.clear();this.iceInbox.clear();this.inputSeq=0;this.frameSeq=0;}
 close(){this.closed=true;this.clear();}
}
