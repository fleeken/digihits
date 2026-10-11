const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const render=source.slice(source.indexOf(' function render('),source.indexOf(' function confirmExit('));
for(const host of [true,false]){
 const elements={},calls=[];
 const app={set innerHTML(html){this.html=html;for(const id of ['new','home'])if(html.includes(`id="${id}"`))elements[id]={};}};
 const context=vm.createContext({state:{host,phase:'finished',code:'123456',players:[{score:500,name:'Mia'}]},app,busy:false,
  esc:x=>x,players:()=>'',waiting:t=>t,$:id=>elements[id],
  document:{querySelectorAll:()=>[]},hideScoreboard:()=>{},setDisabled:()=>{},
  perform:action=>calls.push(action),reset:()=>calls.push('home')});
 vm.runInContext(render,context);context.render();
 if(host){assert(elements.new);elements.new.onclick();assert.deepEqual(calls,['restart']);}
 else{assert(!elements.new);assert.match(app.html,/Väntar på att värden/);}
 elements.home.onclick();assert.equal(calls.at(-1),'home');
}
console.log('PASS: host replay calls shared restart; guests wait; home resets only local view');
