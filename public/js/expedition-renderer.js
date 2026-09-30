import {drawWalker} from './rpg-walk.js?v=art8';
import {makeEnvironment,drawAtmosphere} from './expedition-environment.js?v=pet1';
import {BOSS_TYPES,gearImage} from './expedition-config.js?v=quiz4';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS={blade:'#ffda7b',wand:'#80ecff',orbit:'#d4a3ff'};
export function viewMetrics(w,h){const scale=Math.max(w/1100,h/800)*(w<700?1.02:1.2);return {scale,vw:w/scale,vh:h/scale};}
const circle=(c,x,y,r)=>{c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);};
// Cosmetic events never award rewards or change collisions. All canvases are local assets.
export class ExpeditionRenderer{
  constructor(canvas,{profile,zone,image,audio,calm=false,quality='high'}={}){
    Object.assign(this,{canvas,profile,zone,image,audio,calm,quality,clock:0,fx:[],sparks:[],shake:0,flash:0,hurt:0,frameCount:0,frameTotal:0,cam:null,lastHero:null,swing:0});
    this.ctx=canvas.getContext('2d',{alpha:false});this.glows=new Map();this.background=makeEnvironment(this.zone);
    for(const id of ['blade','wand','orbit','boots','shield','lens','magnet'])image(gearImage(id));
    image(`assets/avatars/${profile.avatar}.png`);image(`assets/bosses/${zone.boss}.png`);
  }
  glow(color){
    if(this.glows.has(color))return this.glows.get(color);
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);
    r.addColorStop(0,color+'d0');r.addColorStop(.23,color+'70');r.addColorStop(1,color+'00');g.fillStyle=r;g.fillRect(0,0,128,128);this.glows.set(color,c);return c;
  }
  light(c,x,y,size,color,alpha=1){c.save();c.globalAlpha=alpha;c.globalCompositeOperation='lighter';c.drawImage(this.glow(color),x-size/2,y-size/2,size,size);c.restore();}
  consume(events){for(const e of events){
    const durations={petSkill:1.2,petAttack:.35,attack:.42,hit:.48,skill:1.35,dash:.45,kill:.7,pickup:.38,level:1.2,upgrade:1.2,bossIntro:1.8,bossAttack:.65,meteor:.8,rage:1.6,victory:2.5,defeat:1.8,combo:1.1,hurt:.35};
    const fx={...e,age:0,duration:durations[e.kind]||.6};this.fx.push(fx);
    if(e.kind==='attack')this.swing=e.angle;
    if(['skill','meteor','victory','rage'].includes(e.kind)){this.shake=Math.max(this.shake,e.kind==='victory'?14:9);this.flash=Math.max(this.flash,e.kind==='skill'?.1:.06);}
    if(e.kind==='hurt'){this.hurt=.45;this.shake=Math.max(this.shake,5);}
    if(e.kind==='hit'&&e.big)this.shake=Math.max(this.shake,5);
    const count=this.calm?0:({hit:7,kill:22,skill:64,meteor:36,upgrade:40,victory:100,dash:16}[e.kind]||0);
    const color=e.kind==='meteor'?'#ff977f':e.kind==='victory'?'#ffe4a0':COLORS[e.weapon]||'#b3ffe2';
    for(let i=0;i<count;i++){const angle=i*2.39996,speed=(e.kind==='skill'?160:60)+(i%9)*23;this.sparks.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,age:0,life:.4+(i%7)*.11,color,size:2+i%4});}
    this.audio?.play(e.kind==='petSkill'?'upgrade':e.kind==='petAttack'?'pickup':e.kind,e);
  }this.fx=this.fx.slice(-90);this.sparks=this.sparks.slice(-(this.quality==='low'?120:360));}
  draw(engine,dt,{stick=null}={}){
    const begun=performance.now();this.consume(engine.fxEvents.splice(0));
    const active=['playing','won','lost'].includes(engine.phase),delta=active?clamp(dt,0,.05):0;this.clock+=delta;
    for(const f of this.fx)f.age+=delta;this.fx=this.fx.filter(f=>f.age<f.duration);
    for(const p of this.sparks){p.age+=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;p.vx*=Math.pow(.12,delta);p.vy*=Math.pow(.12,delta);}this.sparks=this.sparks.filter(p=>p.age<p.life);
    this.shake=Math.max(0,this.shake-delta*23);this.flash=Math.max(0,this.flash-delta*.4);this.hurt=Math.max(0,this.hurt-delta);
    const c=this.ctx,rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(this.quality==='low'?1:1.5,devicePixelRatio||1);
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}
    c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#0b1824';c.fillRect(0,0,w,h);
    const {scale,vw,vh}=viewMetrics(w,h),hero=engine.hero;
    const aim={x:clamp(hero.x-vw/2,0,Math.max(0,1100-vw)),y:clamp(engine.boss&&Math.abs(engine.boss.y-hero.y)<300?Math.min(hero.y-vh*.56,engine.boss.y-128-180/scale):hero.y-vh*.56,0,Math.max(0,800-vh))};
    if(!this.cam||this.calm)this.cam=aim;else{const blend=1-Math.exp(-delta*14);this.cam.x+=(aim.x-this.cam.x)*blend;this.cam.y+=(aim.y-this.cam.y)*blend;}
    const shake=this.calm?0:this.shake;c.save();c.scale(scale,scale);c.translate(-this.cam.x+Math.sin(this.clock*61)*shake,-this.cam.y+Math.cos(this.clock*73)*shake*.55);
    c.drawImage(this.background,0,0);drawAtmosphere(c,this.zone,this.clock,this.calm,this.quality==='low');
    if(!this.calm)for(let i=0;i<22;i++){const x=(i*167+this.clock*7)%1100,y=(i*97+Math.sin(this.clock*.7+i)*15)%800;this.light(c,x,y,18,this.zone.color,.18+Math.sin(this.clock+i)*.08);}
    this.drawWarnings(c,engine);
    this.light(c,hero.x,hero.y,210,COLORS[engine.weapon],.17);
    for(const d of engine.drops){const bob=Math.sin(this.clock*4+d.x)*3;this.light(c,d.x,d.y,44,d.kind==='gem'?'#83ffdb':'#ffba96',.65);c.save();c.translate(d.x,d.y+bob);c.rotate(Math.PI/4);c.fillStyle=d.kind==='gem'?'#6de6c6':'#ffad8d';c.fillRect(-6,-6,12,12);c.fillStyle='#effff0';c.fillRect(-4,-4,4,4);c.restore();}
    const entities=[...engine.enemies,...(engine.boss?[engine.boss]:[]),{...hero,kind:'hero'},...(engine.pet?[{...engine.pet,kind:'pet'}]:[])].sort((a,b)=>a.y-b.y);
    for(const e of entities)this.drawEntity(c,e,engine);
    for(const shot of engine.shots){const color=shot.color||(shot.enemy?BOSS_TYPES[this.zone.boss].color:COLORS[engine.weapon]),a=Math.atan2(shot.vy,shot.vx);c.save();c.translate(shot.x,shot.y);c.rotate(a);this.light(c,0,0,shot.enemy?48:65,color,.8);const trail=c.createLinearGradient(-55,0,8,0);trail.addColorStop(0,color+'00');trail.addColorStop(1,color);c.fillStyle=trail;c.beginPath();c.moveTo(-55,0);c.quadraticCurveTo(0,-shot.r*1.5,shot.r,0);c.quadraticCurveTo(0,shot.r*1.5,-55,0);c.fill();c.fillStyle='#fff8de';circle(c,0,0,shot.r*.6);c.fill();c.restore();}
    for(const f of this.fx)this.drawEffect(c,f,engine);
    if(!this.calm){c.save();c.globalCompositeOperation='lighter';for(const p of this.sparks){c.globalAlpha=(1-p.age/p.life)*.9;c.strokeStyle=p.color;c.lineWidth=p.size;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.025,p.y-p.vy*.025);c.stroke();}c.restore();}
    c.restore();this.screen(c,w,h,engine);
    if(stick){c.strokeStyle='#d9ffff70';c.fillStyle='#8fdde433';c.lineWidth=2;circle(c,stick.x-rect.left,stick.y-rect.top,40);c.stroke();const len=Math.max(1,Math.hypot(stick.dx,stick.dy)/32);circle(c,stick.x-rect.left+stick.dx/len,stick.y-rect.top+stick.dy/len,17);c.fill();}
    this.lastHero={x:hero.x,y:hero.y};this.frameTotal+=performance.now()-begun;this.frameCount++;
    if(this.frameCount%60===0){this.canvas.dataset.renderMs=(this.frameTotal/60).toFixed(2);this.canvas.dataset.particles=String(this.sparks.length);this.frameTotal=0;}
  }
  drawWarnings(c,e){
    const b=e.boss;
    if(b){this.light(c,b.x,b.y,260,b.enraged?'#ff8369':BOSS_TYPES[this.zone.boss].color,.24);c.save();c.translate(b.x,b.y);c.rotate(this.clock*.18);c.strokeStyle=BOSS_TYPES[this.zone.boss].color+'50';c.lineWidth=2;c.setLineDash([15,12]);circle(c,0,0,89);c.stroke();c.restore();}
    if(b?.charge?.wait>0){const q=b.charge;c.save();c.translate(b.x,b.y);c.rotate(q.angle);c.fillStyle='#ff6a5544';c.fillRect(0,-40,q.left,80);c.strokeStyle='#ffb18b';c.lineWidth=3;c.strokeRect(0,-40,q.left,80);for(let x=25;x<q.left;x+=45){c.beginPath();c.moveTo(x,-15);c.lineTo(x+18,0);c.lineTo(x,15);c.stroke();}c.restore();}
    for(const z of e.hazards){const f=clamp(1-z.ttl/1.8,0,1);c.fillStyle='#ff614d30';circle(c,z.x,z.y,z.r);c.fill();c.strokeStyle='#ffae87';c.lineWidth=3;c.stroke();c.lineWidth=6;c.beginPath();c.arc(z.x,z.y,z.r,-Math.PI/2,-Math.PI/2+TAU*f);c.stroke();c.lineWidth=2;c.beginPath();c.moveTo(z.x-12,z.y);c.lineTo(z.x+12,z.y);c.moveTo(z.x,z.y-12);c.lineTo(z.x,z.y+12);c.stroke();}
  }
  drawEntity(c,e,engine){
    c.save();c.translate(e.x,e.y);c.fillStyle='#020b17a0';c.beginPath();c.ellipse(0,15,e.kind==='boss'?69:e.kind==='hero'?33:27,12,0,0,TAU);c.fill();c.imageSmoothingEnabled=false;
    if(e.kind==='pet'){
      const pet=this.image(e.image),size=e.size,bob=this.calm?0:Math.sin(this.clock*5)*3;
      this.light(c,0,-12,size*1.6,e.color,e.charge>=100?.32:.12);
      if(e.level>=3){c.strokeStyle=e.color+'77';c.lineWidth=2;circle(c,0,3,size*.46);c.stroke();}
      if(e.level>=7)this.runes(c,0,3,size*.58,this.clock*.4,e.color,.45);
      if(pet.complete&&pet.naturalWidth){c.save();c.translate(0,bob);if(e.flash>0)c.filter='brightness(1.4)';c.drawImage(pet,-size/2,-size*.86,size,size);c.restore();}
      c.font='bold 10px system-ui';c.textAlign='center';c.strokeStyle='#0b2230';c.lineWidth=3;c.strokeText(e.name+' Lv.'+e.level,0,-size*.93);c.fillStyle=e.color;c.fillText(e.name+' Lv.'+e.level,0,-size*.93);
      if(e.guard>0){c.strokeStyle=e.color;c.lineWidth=3;circle(c,engine.hero.x-e.x,engine.hero.y-e.y-15,50);c.stroke();}
    }else if(e.kind==='hero'){
      const moving=this.lastHero&&Math.hypot(e.x-this.lastHero.x,e.y-this.lastHero.y)>.05;
      const bob=this.calm?0:moving?Math.sin(this.clock*15)*3:Math.sin(this.clock*2)*1.5;
      const attack=this.fx.findLast(f=>f.kind==='attack'),swing=attack?Math.sin(attack.age/.42*Math.PI)*.6:0;
      c.save();if(e.inv>0)c.globalAlpha=.8;
      const dx=e.x-(this.lastHero?.x??e.x),dy=e.y-(this.lastHero?.y??e.y);this.walkDistance=(this.walkDistance||0)+Math.hypot(dx,dy);if(moving)this.walkDirection=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';drawWalker(c,null,0,15,86,{distance:this.walkDistance,walking:moving,direction:this.walkDirection||'down'});
      const a=engine.weapon==='orbit'?this.clock*2.4:e.face+swing;
      c.save();c.rotate(a+Math.PI/4);c.translate(36,0);const item=this.image(gearImage(engine.weapon));if(item.complete&&item.naturalWidth)c.drawImage(item,-29,-38,62,62);c.restore();
      if(this.profile.charm){const item=this.image(gearImage(this.profile.charm)),boots=this.profile.charm==='boots';if(item.complete&&item.naturalWidth)c.drawImage(item,boots?-17:-43,boots?7:-14,boots?34:32,boots?34:32);}
      c.restore();if(e.inv>0){c.strokeStyle='#bfffee88';c.lineWidth=2;circle(c,0,-16,48);c.stroke();}
      c.font='bold 11px system-ui';c.textAlign='center';c.fillStyle='#e5f7e7';c.fillText(this.profile.name,0,-77);
    }else if(e.kind==='boss'){
      const death=this.fx.find(f=>f.kind==='victory'),bob=this.calm?0:Math.sin(this.clock*2.5)*4;
      if(death)c.globalAlpha=Math.max(0,1-death.age/.9);
      const boss=this.image(`assets/bosses/${this.zone.boss}.png`);if(boss.complete&&boss.naturalWidth){c.save();c.translate(0,bob);if(e.flash>0)c.filter='brightness(1.8)';c.drawImage(boss,-98,-128,196,196);c.restore();}
      if(e.shield){c.strokeStyle='#ffe1a5';c.lineWidth=4;circle(c,0,-18,105);c.stroke();this.runes(c,0,-18,111,this.clock*.2,'#ffdfa7',.9);}
      if(e.enraged){c.strokeStyle='#ff8b7166';c.lineWidth=4;circle(c,0,-14,97);c.stroke();}
    }else{
      const enemy=this.image('assets/bosses/'+(e.kind==='ghost'?'halluci':'bugbug')+'.png'),size=e.r*3.4;const bounce=this.calm?0:Math.sin(this.clock*7+e.id)*2;c.translate(0,bounce);if(enemy.complete&&enemy.naturalWidth){if(e.flash>0)c.filter='brightness(1.5)';c.drawImage(enemy,-size/2,-size*.75,size,size);c.filter='none';}
      if(e.hp<e.maxHp){c.fillStyle='#102834';c.fillRect(-24,-e.r*1.6-9,48,4);c.fillStyle='#f2c789';c.fillRect(-24,-e.r*1.6-9,48*Math.max(0,e.hp/e.maxHp),4);}
    }c.restore();
  }
  runes(c,x,y,r,angle,color,alpha){c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=2;circle(c,0,0,r);c.stroke();circle(c,0,0,r*.92);c.stroke();for(let i=0;i<12;i++){c.save();c.rotate(i*TAU/12);c.beginPath();c.moveTo(r*.97,-8);c.lineTo(r*1.05,0);c.lineTo(r*.97,8);c.stroke();c.restore();}c.restore();}
  slash(c,x,y,r,angle,color,alpha,progress){
    c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;c.globalCompositeOperation='lighter';
    const end=-1.7+progress*3.4,start=end-1.8;for(const [width,opacity] of [[44,.13],[25,.35],[8,.9]]){c.globalAlpha=alpha*opacity;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(0,0,r,start,end);c.stroke();}c.globalAlpha=alpha;c.strokeStyle='#fffbea';c.lineWidth=3;c.beginPath();c.arc(0,0,r+5,end-.9,end);c.stroke();c.restore();
  }
  drawEffect(c,f,engine){
    const t=f.age/f.duration,k=1-t,color=COLORS[f.weapon]||'#a6ffe0',ease=1-Math.pow(1-t,3);
    c.save();
    if(f.kind==='petAttack'){
      this.light(c,f.x,f.y,55,f.color,k*.7);
    }else if(f.kind==='petSkill'){
      c.strokeStyle=f.color;c.lineWidth=4;c.globalAlpha=k;
      for(const target of f.targets||[]){c.beginPath();c.moveTo(f.x,f.y-18);c.quadraticCurveTo((f.x+target.x)/2,f.y-70,target.x,target.y);c.stroke();this.light(c,target.x,target.y,100,f.color,k*.7);}
      const h=engine.hero;if(f.type==='heal'||f.type==='guard'){this.runes(c,h.x,h.y,45+ease*35,f.age,f.color,k);for(let i=0;i<5;i++){c.fillStyle=f.color;c.fillRect(h.x-40+i*20,h.y-ease*65-(i%2)*15,3,12);c.fillRect(h.x-44+i*20,h.y-ease*65+4-(i%2)*15,11,3);}}
      else this.runes(c,f.x,f.y,30+ease*(f.type==='burst'?150:65),f.age,f.color,k*.7);
    }else if(f.kind==='attack'){
      if(f.weapon==='blade'){this.slash(c,f.x,f.y,80+ease*80,f.angle,color,k,t);this.slash(c,f.x,f.y,60+ease*90,f.angle-.18,'#fff0b1',k*.5,t);}
      else if(f.weapon==='orbit'){this.runes(c,f.x,f.y,70+ease*80,this.clock*2,color,k);this.light(c,f.x,f.y,240,color,k*.2);}
      else this.light(c,f.x+Math.cos(f.angle)*36,f.y+Math.sin(f.angle)*36,130,color,k*.65);
    }else if(f.kind==='skill'){
      const r=f.radius*clamp(f.age/.55,0,1);this.light(c,f.x,f.y,Math.max(10,r*2.4),color,k*.5);
      this.runes(c,f.x,f.y,Math.max(8,r),f.age*.4,color,k*.8);
      if(f.weapon==='blade'){this.slash(c,f.x,f.y,Math.max(10,r),f.angle,color,k,clamp(f.age/.55,0,1));this.slash(c,f.x,f.y,Math.max(10,r*.86),f.angle+Math.PI,color,k,clamp(f.age/.55,0,1));}
      else if(f.weapon==='wand'){for(let i=0;i<8;i++){const a=i*TAU/8+f.age*.7;c.strokeStyle=color;c.globalAlpha=k*.5;c.lineWidth=4;c.beginPath();c.moveTo(f.x+Math.cos(a)*25,f.y+Math.sin(a)*25);c.lineTo(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r);c.stroke();this.light(c,f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,90,color,k);}}
      else{for(let i=0;i<3;i++){c.save();c.translate(f.x,f.y);c.rotate(i*Math.PI/3+f.age*2);c.scale(1,.48);this.runes(c,0,0,Math.max(10,r),0,color,k);c.restore();}c.globalAlpha=k*.7;c.fillStyle='#140d37';circle(c,f.x,f.y,55*k);c.fill();}
    }else if(f.kind==='dash'){
      const hero=this.image(`assets/avatars/${this.profile.avatar}.png`);for(let i=0;i<5;i++){const z=i/5,x=f.fromX+(f.x-f.fromX)*z,y=f.fromY+(f.y-f.fromY)*z;c.globalAlpha=k*(.08+z*.18);drawWalker(c,null,x,y+15,86,{direction:this.walkDirection||'right'});}c.globalAlpha=k;c.lineWidth=4;c.strokeStyle='#affaff';c.beginPath();c.moveTo(f.fromX,f.fromY);c.lineTo(f.x,f.y);c.stroke();
    }else if(f.kind==='hit'){
      if(!this.calm){c.save();c.translate(f.x,f.y-15);c.rotate(.7);c.globalCompositeOperation='lighter';c.globalAlpha=k;c.fillStyle='#ffe6ae';c.fillRect(-35*k,-3,70*k,6);c.fillRect(-3,-35*k,6,70*k);c.restore();}
      c.textAlign='center';c.font=`900 ${f.big?37:25}px system-ui`;c.lineWidth=4;c.strokeStyle='#152135';c.fillStyle=f.big?'#ffe191':'#fff9df';c.globalAlpha=Math.min(1,k*3);const y=f.y-50-ease*35;c.strokeText(String(f.damage),f.x,y);c.fillText(String(f.damage),f.x,y);
    }else if(['kill','meteor','upgrade','victory'].includes(f.kind)){
      const r=f.kind==='victory'?340:f.kind==='upgrade'?180:f.kind==='meteor'?f.radius:55,col=f.kind==='meteor'?'#ff996b':f.kind==='victory'?'#ffdf8c':color;this.light(c,f.x,f.y,r*2.8,col,k*.8);c.globalAlpha=k;c.strokeStyle=col;c.lineWidth=8*k+1;circle(c,f.x,f.y,10+ease*r);c.stroke();if(f.kind==='victory')this.runes(c,f.x,f.y,10+ease*r,f.age,col,k);
    }else if(f.kind==='pickup'){this.light(c,f.x,f.y,65,color,k*.5);}
    c.restore();
  }
  screen(c,w,h,engine){
    const vignette=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.75);vignette.addColorStop(0,'#040c1800');vignette.addColorStop(1,this.hurt>0?'#912c3b90':'#030b187c');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    if(!this.calm&&this.flash>0){c.fillStyle=`rgba(255,221,158,${this.flash})`;c.fillRect(0,0,w,h);}
    const intro=this.fx.find(f=>f.kind==='bossIntro'),victory=this.fx.find(f=>f.kind==='victory'),defeat=this.fx.find(f=>f.kind==='defeat');
    if(intro){const t=intro.age/intro.duration,alpha=Math.min(1,t*6,(1-t)*5),boss=BOSS_TYPES[this.zone.boss];c.save();c.globalAlpha=alpha;c.fillStyle='#06101ddd';const top=h*.29,boxH=w<600?150:175;c.fillRect(0,top,w,boxH);c.fillStyle=boss.color;c.fillRect(0,top,w,2);c.fillRect(0,top+boxH,w,2);const art=this.image(`assets/bosses/${this.zone.boss}.png`);if(art.complete&&art.naturalWidth){c.imageSmoothingEnabled=false;c.globalAlpha=alpha*.65;c.drawImage(art,w*.14-90,top-45,230,230);c.globalAlpha=alpha;}c.textAlign='center';c.fillStyle=boss.color;c.font='bold 12px system-ui';c.fillText('GUARDIAN ENCOUNTER',w*.58,top+40);c.fillStyle='#fff7df';c.font=`900 ${w<600?29:46}px system-ui`;c.fillText(boss.name,w*.58,top+88);c.font=`${w<600?12:15}px system-ui`;c.fillStyle='#cbdad8';c.fillText(boss.skill,w/2,top+boxH-25);c.restore();}
    if(victory||defeat){const f=victory||defeat,t=f.age;c.save();c.globalAlpha=clamp(t*2,0,1);c.fillStyle='#07142288';c.fillRect(0,h*.3,w,h*.32);c.textAlign='center';c.fillStyle=victory?'#ffe1a0':'#dce9fa';c.font=`900 ${w<600?38:72}px system-ui`;c.fillText(victory?'VICTORY':'다시, 한 걸음',w/2,h*.44);c.font=`bold ${w<600?15:22}px system-ui`;c.fillText(victory?'지식 수호자를 물리쳤습니다':'배운 지식과 장비는 남아 있어요',w/2,h*.52);c.restore();}
    if(!intro&&!victory&&!defeat){const skill=this.fx.findLast(f=>f.kind==='skill'),combo=this.fx.findLast(f=>f.kind==='combo');
      if(skill){c.save();c.textAlign='center';c.globalAlpha=Math.min(1,(1-skill.age/skill.duration)*3);c.fillStyle='#071724c9';c.fillRect(w*.12,h*.7-27,w*.76,55);c.fillStyle=COLORS[skill.weapon];c.font=`900 ${w<600?25:36}px system-ui`;c.fillText(skill.weapon==='blade'?'섬광 베기':skill.weapon==='wand'?'별빛 폭풍':'궤도 붕괴',w/2,h*.7+10);c.restore();}
      else if(engine.bannerTime>0){c.textAlign='center';c.font=`bold ${w<600?14:20}px system-ui`;c.fillStyle='#ffe2b1';c.fillText(engine.banner,w/2,h*.7);}
      if(combo){c.save();c.textAlign='right';c.globalAlpha=1-combo.age/combo.duration;c.fillStyle='#ffe0a0';c.font=`900 ${w<600?26:42}px system-ui`;c.fillText(`${combo.count} COMBO`,w-25,h*.36);c.restore();}
    }
    // A dangerous enemy outside the camera gets a directional marker on narrow screens.
    if(engine.boss?.hp>0&&w<700){const {scale}=viewMetrics(w,h),b=engine.boss,x=(b.x-this.cam.x)*scale,y=(b.y-this.cam.y)*scale;if(x<35||x>w-35||y<180||y>h-110){const px=clamp(x,25,w-25),py=clamp(y,190,h-125);c.save();c.translate(px,py);c.rotate(Math.atan2(y-h/2,x-w/2));c.fillStyle='#ffc08a';c.beginPath();c.moveTo(13,0);c.lineTo(-9,-8);c.lineTo(-9,8);c.closePath();c.fill();c.restore();}}
  }
}
