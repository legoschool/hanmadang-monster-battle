// Deterministic 60 Hz simulation shared by the canvas and reward verifier.
export const ARCADE_VERSION=1;
export const ARCADE_GAMES={bubble:{name:'버블 정원',description:'방울로 몬스터를 가두고, 닿아서 터뜨려요.'},space:{name:'별빛 비행대',description:'자동 발사로 적을 물리치고, 탄막을 피해요.'}};
export const W=640,H=440,STEP=1/60,SAMPLE=6,STAGE_SAMPLES=300;
export function createArcade(kind,seed,stage=0,boost=false){
 let n=seed>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 return {kind,stage,frame:0,score:0,kills:0,hp:5,done:false,x:320,y:kind==='bubble'?382:365,vy:0,dir:1,ground:true,inv:0,shots:[],enemies:[],particles:[],rand:random,spawn:0,fire:0,boost:boost?360:0,jumpHeld:false};
}
function hit(s){if(s.inv>0)return;s.hp--;s.inv=90;if(s.hp<=0)s.done=true;}
export function stepArcade(s,bits){
 if(s.done)return;s.frame++;s.inv=Math.max(0,s.inv-1);s.boost=Math.max(0,s.boost-1);const left=bits&1,right=bits&2,jump=bits&4,slow=bits&8;let dx=(right?1:0)-(left?1:0);if(dx)s.dir=dx;s.x=Math.max(22,Math.min(W-22,s.x+dx*(slow?2:4)));
 if(s.kind==='bubble'){
  if(jump&&!s.jumpHeld&&s.ground){s.vy=-10.5;s.ground=false;}s.jumpHeld=!!jump;let old=s.y;s.vy+=.45;s.y+=s.vy;s.ground=false;
  for(const p of [{x:0,y:405,w:640},{x:40,y:305,w:180},{x:420,y:305,w:180},{x:235,y:205,w:170}])if(s.vy>=0&&old+18<=p.y+1&&s.y+18>=p.y&&s.x>=p.x-10&&s.x<=p.x+p.w+10){s.y=p.y-18;s.vy=0;s.ground=true;break;}
 }else{s.y=Math.max(245,Math.min(408,s.y+((bits&4)?-3:0)+((bits&8)?3:0)));}
 if(--s.fire<=0){s.fire=s.boost?12:s.kind==='bubble'?23:17;s.shots.push({x:s.x,y:s.y-5,vx:s.kind==='bubble'?s.dir*5:0,vy:s.kind==='bubble'?-.5:-8,life:90});}
 if(--s.spawn<=0){s.spawn=s.kind==='bubble'?95:55;const side=s.rand()<.5?-1:1;s.enemies.push(s.kind==='bubble'?{x:side<0?15:625,y:385,vx:side*(1+s.stage*.2),trapped:0,age:0,phase:s.rand()*6}:{x:30+s.rand()*580,y:-20,vx:Math.sin(s.rand()*6)*1.1,age:0,phase:s.rand()*6,shot:false});}
 for(const p of s.shots){p.x+=p.vx;p.y+=p.vy;p.life--;}
 for(const e of s.enemies){
  e.age++;
  if(s.kind==='bubble'){
   if(e.trapped){e.y-=.75;e.trapped--;if(Math.hypot(e.x-s.x,e.y-s.y)<65||e.y<80||e.trapped===0){e.dead=true;s.kills++;s.score+=100;s.particles.push({x:e.x,y:e.y,life:24});}}
   else{e.x+=e.vx;if(e.x<15||e.x>625)e.vx*=-1;e.y=385-Math.max(0,Math.sin(e.age*.032+e.phase))*180;}
  }else{e.x+=e.vx+Math.sin(e.age*.045+e.phase)*.7;e.y+=.75+s.stage*.15;if(!e.shot&&e.y>115){e.shot=true;s.shots.push({x:e.x,y:e.y,vx:0,vy:2+s.stage*.25,life:180,hostile:true});}if(e.y>470)e.dead=true;}
  if(!e.dead&&!e.trapped&&Math.hypot(e.x-s.x,e.y-s.y)<26)hit(s);
  for(const p of s.shots)if(!p.hostile&&p.life>0&&!e.dead&&!e.trapped&&Math.hypot(e.x-p.x,e.y-p.y)<23){p.life=0;if(s.kind==='bubble')e.trapped=200;else{e.dead=true;s.kills++;s.score+=100;s.particles.push({x:e.x,y:e.y,life:24});}break;}
 }
 for(const p of s.shots)if(p.hostile&&p.life>0&&Math.hypot(p.x-s.x,p.y-s.y)<18){p.life=0;hit(s);}
 s.shots=s.shots.filter(p=>p.life>0&&p.x>-30&&p.x<670&&p.y>-30&&p.y<470).slice(-100);s.enemies=s.enemies.filter(e=>!e.dead).slice(-40);s.particles=s.particles.filter(p=>--p.life>0);if(s.frame>=1800)s.done=true;
}
export function sampleArcade(s,bits){for(let i=0;i<SAMPLE;i++)stepArcade(s,bits);}
export function replayArcade(kind,seed,stage,boost,inputs){const s=createArcade(kind,seed,stage,boost);for(const bits of inputs)sampleArcade(s,bits);return s;}