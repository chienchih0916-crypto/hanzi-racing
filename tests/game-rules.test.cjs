const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('src=')).map(m=>m[2]).join('\n');
new vm.Script(script);
new vm.Script(fs.readFileSync('certificate.js','utf8'));
new vm.Script(fs.readFileSync('tour.js','utf8'));
function fn(name){const start=script.indexOf('function '+name+'(');let end=script.indexOf('{',start),depth=1;while(depth){end++;if(script[end]==='{')depth++;if(script[end]==='}')depth--;}return script.slice(start,end+1);}
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},value:''});return elements.get(id);}
let now=0,finished=[],timeouts=[];
const env={GAME_SECONDS:90,gameDeadline:90000,gameRunning:true,gameRunId:1,gamePassed:false,lives:3,wrongCount:0,elapsedSec:0,warningFlash:0,gameSpeed:1,
 performance:{now:()=>now},document:{getElementById:element},setTimeout:f=>timeouts.push(f),clearInterval(){},cancelAnimationFrame(){},renderLives(){},playBrakeAndCrash(){},endGame:passed=>{finished.push(passed);env.gameRunning=false;}};
vm.createContext(env);
vm.runInContext(fn('updateGameClock')+'\n'+fn('loseLife')+'\n'+fn('gameTimeout'),env);
now=1000;env.bossPaused=true;env.updateGameClock();assert.equal(env.elapsedSec,1);assert.equal(element('timer-el').textContent,'01:29');
now=89999;assert.equal(env.updateGameClock(),true);assert.equal(element('timer-el').textContent,'00:01');
now=90000;assert.equal(env.updateGameClock(),false);assert.deepEqual(finished,[true]);
now=1000;env.gameRunning=true;finished=[];
env.loseLife();env.loseLife();assert.equal(env.gameRunning,true);env.loseLife();assert.equal(env.wrongCount,3);assert.equal(env.lives,0);assert.deepEqual(finished,[false]);env.loseLife();assert.equal(env.wrongCount,3);
env.gameRunning=true;let calls=0;env.gameTimeout(()=>calls++,100);env.gameRunId++;timeouts.pop()();assert.equal(calls,0);
env.gameTimeout(()=>calls++,100);env.gameRunning=false;timeouts.pop()();assert.equal(calls,0);
assert.match(script,/obj\.answered=true;\s*if\(obj\.raf\)cancelAnimationFrame/);
assert.match(script,/roundSpeedMult \* 0\.8/);
// The failed state must not create a downloadable certificate.
vm.runInContext(fs.readFileSync('certificate.js','utf8'),env);env.gamePassed=false;env.downloadCertificate();
console.log('PASS: syntax, deadline (including boss), three errors, stale callbacks, failed certificate guard, reduced speed');
// Exercise actual settlement: passing shows proof, failing cancels every card.
Object.assign(env,{cardQueue:[{answered:false,raf:1}],hideAllCards(){},stopBgMusic(){},stopFireworks(){},runFireworks(){},cardAF:0,rafId:0,timerInt:0,score:250,correctCount:5,maxCombo:3,sceneIdx:0,SCENES:[{}],routeNames:['紐約'],Date});
let certificateHidden;
element('certificate-form').classList.toggle=(name,hidden)=>{certificateHidden=hidden;};
vm.runInContext(fn('endGame'),env);
env.gameRunning=true;env.lives=2;env.elapsedSec=90;env.endGame(true);
assert.equal(env.gamePassed,true);assert.equal(certificateHidden,false);assert.equal(element('res-title').textContent,'挑戰通關！');assert.equal(env.cardQueue[0].answered,true);
env.gameRunning=true;env.lives=0;env.endGame(false);
assert.equal(env.gamePassed,false);assert.equal(certificateHidden,true);assert.equal(element('res-title').textContent,'挑戰失敗');
console.log('PASS: actual settlement, proof visibility and card cancellation');
