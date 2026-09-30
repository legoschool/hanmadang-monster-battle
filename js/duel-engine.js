// Deterministic 30 Hz duel rules shared with the reward server.
export const VERSION=1, FPS=30, FRAMES=1350, SAMPLE=3, MAX_INPUTS=450;
export const PETS={koalbot:'beam',antro:'burst',monggeul:'heal',digibugi:'guard',pickling:'burst',droni:'burst',owllab:'burst',hongaengi:'guard',maninyang:'dash',h2o:'heal'};
export const SKILLS={beam:'광선',burst:'범위 공격',heal:'회복',guard:'보호막',dash:'돌진'};
export function createDuel(seed=1,difficulty='easy',pet='koalbot'){
 return {frame:0,seed:seed>>>0,difficulty,pet:PETS[pet]?pet:'koalbot',done:false,winner:null,events:[],hits:0,blocks:0,casts:0,combo:0,p:{x:230,hp:240,guard:100,shield:0,cd:0,attack:0,charge:50,stun:0},e:{x:570,hp:240,guard:100,shield:0,cd:30,attack:0,charge:0,stun:0},projectiles:[]};
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function damage(s,target,amount,source){const p=s[target];if(target==='p'&&s.difficulty==='practice')amount=0;if(p.shield>0)amount*=.25;if(p.block&&p.guard>5){amount*=.2;p.guard=Math.max(0,p.guard-15);s.blocks++;s.events.push({type:'block',x:p.x});}p.hp=Math.max(0,p.hp-amount);p.stun=4;if(target==='e'&&amount>0)s.hits++;s.events.push({type:'hit',x:p.x,n:Math.round(amount),source});}
export function stepDuel(s,bits=0){
 if(s.done)return;s.events=[];s.frame++;const p=s.p,e=s.e;
 for(const f of [p,e]){f.cd=Math.max(0,f.cd-1);f.attack=Math.max(0,f.attack-1);f.stun=Math.max(0,f.stun-1);f.shield=Math.max(0,f.shield-1);f.charge=Math.min(100,f.charge+.095);}
 p.block=!!(bits&8)&&p.guard>0;p.guard=Math.min(100,Math.max(0,p.guard+(p.block?-.6:.5)));
 if(!p.stun&&!p.block)p.x=Math.max(55,Math.min(745,p.x+((bits&2?1:0)-(bits&1?1:0))*4));
 if(bits&4&&!p.cd&&!p.block){p.cd=17;p.attack=12;s.combo=(s.combo+1)%3;s.events.push({type:'swing',x:p.x});if(Math.abs(p.x-e.x)<116)damage(s,'e',s.combo===2?9:6,'attack');}
 if(bits&16&&p.charge>=100){p.charge=0;s.casts++;const type=PETS[s.pet];s.events.push({type:'skill',skill:type,x:p.x,to:e.x});if(type==='heal')p.hp=Math.min(240,p.hp+35);else if(type==='guard')p.shield=150;else{if(type==='dash')p.x=Math.max(55,Math.min(745,e.x+(p.x<e.x?-78:78)));damage(s,'e',type==='burst'?23:28,'pet');}}
 if(s.frame%100===0)s.projectiles.push({x:p.x,y:285,dir:p.x<e.x?1:-1,life:110});
 if(s.frame%180===0)s.projectiles.push({x:e.x,dir:e.x<p.x?1:-1,life:110,enemy:true});
 for(const shot of s.projectiles){shot.x+=shot.dir*7;shot.life--;if(Math.abs(shot.x-(shot.enemy?p.x:e.x))<25){damage(s,shot.enemy?'p':'e',shot.enemy?3:4,'pet');shot.life=0;}}
 s.projectiles=s.projectiles.filter(x=>x.life>0&&x.x>0&&x.x<800);
 const dist=Math.abs(e.x-p.x);e.block=false;
 if(e.attack>0){if(e.attack===1&&dist<132)damage(s,'p',s.difficulty==='normal'?12:7,'enemy');}
 else if(!e.stun){if(dist>94)e.x+=(p.x>e.x?1:-1)*(s.difficulty==='normal'?2.6:1.8);if(!e.cd&&dist<145){e.attack=s.difficulty==='normal'?18:28;e.cd=(s.difficulty==='normal'?43:64)+Math.floor(random(s)*15);s.events.push({type:'warning',x:e.x});}}
 if(dist<60){const mid=(p.x+e.x)/2,dir=p.x<e.x?-1:1;p.x=Math.max(55,Math.min(745,mid+dir*30));e.x=Math.max(55,Math.min(745,mid-dir*30));}
 if(p.hp<=0||e.hp<=0||s.frame>=FRAMES){s.done=true;s.winner=p.hp===e.hp?'draw':p.hp>e.hp?'player':'enemy';}
}
export function replayDuel(seed,difficulty,pet,inputs){const s=createDuel(seed,difficulty,pet);for(const b of inputs)for(let i=0;i<SAMPLE&&!s.done;i++)stepDuel(s,b);return s;}
