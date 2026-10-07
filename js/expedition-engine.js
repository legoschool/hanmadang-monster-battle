import {lootChoices} from './expedition-loot.js?v=combat1';
import {makeCompanion,companionStep,castCompanion} from './expedition-companions.js?v=experience1';
// 순수 전투 시뮬레이션. DOM·서버와 분리해 이동, 충돌, 일시정지, 강화 등을 검사한다.
export class ExpeditionEngine {
  constructor({weapon='blade',charm=null,level=1,mode='survival',gentle=true,seed=1,bossType='bugbug',cinematic=false,companion=null,questionGap=45,difficulty=null,gameSpeed=1,autoSkills=false,experience=false}={}) {
    Object.assign(this,{width:1100,height:800,weapon,charm,mode,gentle,seed,phase:'playing',time:0,kills:0,
      xp:0,rank:1,nextXp:6,attackCd:0,dashCd:0,skillCd:0,spawnCd:0,seq:0,boss:null,bossMade:false,
      enemies:[],shots:[],drops:[],effects:[],texts:[],hazards:[],particles:[],quizReason:'',seals:0,event:null,bossType,shake:0,combo:0,comboTime:0,bestCombo:0,banner:'',bannerTime:0,cinematic,entrance:0,hitStop:0,fxEvents:[],swing:0});
    this.questionGap=[30,45,60].includes(Number(questionGap))?Number(questionGap):45;
    this.nextQuestionAt=20;this.pendingLevelQuestion=false;
    const maxHp=(gentle?150:100)+(charm==='shield'?35:0);
    this.hero={x:550,y:400,hp:maxHp,maxHp,r:22,face:0,inv:1,speed:190*(charm==='boots'?1.15:1),
      damage:(24+Math.min(10,level-1)*1.5)*(charm==='lens'?1.2:1),rate:1,magnet:85+(charm==='magnet'?60:0)};
    this.gameSpeed=[.5,.7,1].includes(Number(gameSpeed))?Number(gameSpeed):1;this.autoSkills=!!autoSkills;
    this.setDifficulty(difficulty||(gentle?'gentle':'standard'));
    this.pet=makeCompanion(companion,this.hero);
    Object.assign(this,{experience,mods:{},lootHistory:[],encounter:experience?'warmup':'legacy',attacks:0,damageTaken:0,lastHurt:'',dodges:0,counters:0,offered:[],bombs:[],attackBuffer:0});
    if(mode==='boss'&&!experience) this.spawnBoss();
    else if(experience||cinematic&&mode==='survival'){for(let i=0;i<3;i++)this.spawn(experience?105+i*24:220+i*22);this.spawnCd=2;this.emit('wave',{count:3});}
  }
  setDifficulty(value){
    const levels={beginner:{hp:220,speed:.6,damage:.5,spawn:1.7,cap:18},gentle:{hp:150,speed:.8,damage:1,spawn:1,cap:38},standard:{hp:100,speed:1,damage:1,spawn:1,cap:38}};
    const next=levels[value]||levels.gentle,old=this.difficultyStats;
    const ratio=this.hero.hp/this.hero.maxHp,oldBase=old?.hp||(this.gentle?150:100);
    this.hero.maxHp+=next.hp-oldBase;this.hero.hp=Math.max(0,Math.min(this.hero.maxHp,this.hero.maxHp*ratio));
    for(const e of this.enemies)e.speed*=next.speed/(old?.speed||(this.gentle?.8:1));
    this.difficulty=levels[value]?value:'gentle';this.difficultyStats=next;this.gentle=this.difficulty!=='standard';
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  burst(x,y,color,count=18){for(let i=0;i<count;i++){const a=i/count*Math.PI*2,s=50+(i%5)*35;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,ttl:.55+(i%3)*.15,max:.85,color,r:2+i%3});}this.particles=this.particles.slice(-240);}
  emit(kind,data={}){this.fxEvents.push({kind,x:this.hero.x,y:this.hero.y,weapon:this.weapon,...data});this.fxEvents=this.fxEvents.slice(-64);}
  pause(){if(this.phase==='playing')this.phase='paused';}
  resume(){if(this.phase==='paused')this.phase='playing';}
  requestQuestion(reason){if(this.phase!=='playing')return;this.phase='question';this.quizReason=reason;this.event='question';this.pendingLevelQuestion=false;}
  continueQuestion(correct){
    if(this.phase!=='question')return;
    if(this.quizReason==='seal'){this.seals++;if(this.boss){this.boss.shield=false;this.boss.nextSeal-=0.34;}}
    this.nextQuestionAt=this.time+this.questionGap;
    this.phase=correct?'upgrade':'playing';
    if(this.experience){if(correct)this.offerLoot(this.quizReason==='seal'?'보스 약점 해제':'적 무리 돌파');else if(this.encounter==='assault'){this.encounter='boss';this.spawnBoss();}}
    if(correct){this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+18);this.skillCd=0;}
    this.hero.inv=2;
  }
  upgrade(kind){
    if(this.phase!=='upgrade')return;
    if(this.experience){if(!this.offered.includes(kind))return;this.mods[kind]=true;this.lootHistory.push({id:kind,source:this.rewardSource});if(kind==='heart')this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+45);this.offered=[];if(this.encounter==='cache'){this.encounter='assault';this.waveGoal=this.kills+10;for(let i=0;i<4;i++)this.spawn(230+i*10);}else if(this.encounter==='assault'){this.encounter='boss';this.spawnBoss();}this.phase='playing';this.hero.inv=1.5;this.banner='장비 장착 · 다음 전투';this.bannerTime=1.6;this.event=null;this.emit('upgrade',{upgrade:kind});return;}
    if(kind==='power')this.hero.damage*=1.22;
    if(kind==='rapid')this.hero.rate=Math.min(3,this.hero.rate+0.2);
    if(kind==='heart'){this.hero.maxHp+=25;this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+45);}
    if(kind==='magnet'){this.hero.magnet=Math.min(260,this.hero.magnet+40);this.hero.speed=Math.min(285,this.hero.speed+12);}
    this.phase='playing';this.emit('upgrade',{upgrade:kind});this.effects.push({x:this.hero.x,y:this.hero.y,r:20,endR:100,ttl:0.8,max:0.8,color:'#b9f5b0'});
  }
  offerLoot(source){this.rewardSource=source;this.offered=lootChoices(this);if(!this.offered.length){this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+25);if(this.encounter==='cache'){this.encounter='assault';this.waveGoal=this.kills+10;}else if(this.encounter==='assault'){this.encounter='boss';this.spawnBoss();}this.phase='playing';this.event=null;return;}this.phase='upgrade';this.event='upgrade';}
  queueAttack(){this.attackBuffer=.18;}
  nearest(){return [...this.enemies,...(this.boss?[this.boss]:[])].filter(e=>e.hp>0).sort((a,b)=>this.dist(a,this.hero)-this.dist(b,this.hero))[0];}
  dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  attack(){
    if(this.phase!=='playing'||this.entrance>0||this.attackCd>0)return;
    const h=this.hero,target=this.nearest();if(target)h.face=Math.atan2(target.y-h.y,target.x-h.x);
    this.attacks++;this.attackBuffer=0;

    this.attackCd=(this.weapon==='wand'?0.62:0.7)/h.rate;this.swing++;this.emit('attack',{angle:h.face,swing:this.swing});
    if(this.weapon==='wand'){
      for(const offset of (this.mods.split?[-.22,0,.22]:[0]))this.shots.push({x:h.x,y:h.y,vx:Math.cos(h.face+offset)*430,vy:Math.sin(h.face+offset)*430,ttl:1.8,damage:h.damage*1.35,enemy:false,r:10,chain:this.mods.chain});
    } else {
      const reach=this.weapon==='orbit'?150:160;
      for(const e of [...this.enemies,...(this.boss?[this.boss]:[])])if(this.dist(e,h)<reach+e.r)this.hit(e,h.damage,'hero',true);
      this.effects.push({x:h.x,y:h.y,r:25,endR:reach,ttl:0.24,max:0.24,color:this.weapon==='orbit'?'#c8aeff':'#b5f6bc',arc:this.weapon==='blade'?h.face:null});
    }
    if(this.mods.shockwave||this.mods.shards){const count=this.mods.shards?6:1;for(let i=0;i<count;i++){const angle=h.face+i*Math.PI*2/count;this.shots.push({x:h.x,y:h.y,vx:Math.cos(angle)*520,vy:Math.sin(angle)*520,ttl:.9,damage:h.damage*.85,enemy:false,r:this.mods.shockwave?19:8,pierce:!!this.mods.shockwave,hitIds:[],chain:this.mods.chain});}}
  }
  dash(dx=0,dy=0){
    if(this.phase!=='playing'||this.entrance>0||this.dashCd>0)return;
    const h=this.hero,fromX=h.x,fromY=h.y,len=Math.hypot(dx,dy);if(!len){dx=Math.cos(h.face);dy=Math.sin(h.face);}else{dx/=len;dy/=len;}
    this.effects.push({x:h.x,y:h.y,r:15,endR:42,ttl:0.4,max:0.4,color:'#b2e5ff'});
    h.x=Math.max(40,Math.min(this.width-40,h.x+dx*120));h.y=Math.max(40,Math.min(this.height-40,h.y+dy*120));
    h.inv=0.65;this.dashCd=2.2;this.dodges++;this.lastDashAt=this.time;this.dashRewarded=false;
    if(this.mods.echo)this.bombs.push({x:fromX,y:fromY,ttl:.55,r:110});
    this.burst(h.x-dx*60,h.y-dy*60,'#99e9ff',22);this.emit('dash',{fromX,fromY,angle:Math.atan2(dy,dx)});
  }
  skill(){
    if(this.phase!=='playing'||this.entrance>0||this.skillCd>0)return;
    const h=this.hero;this.skillCd=9;this.emit('skill',{angle:h.face,radius:300});if(this.cinematic)this.hitStop=.065;
    for(const e of [...this.enemies,...(this.boss?[this.boss]:[])])if(this.dist(e,h)<300+e.r)this.hit(e,h.damage*2.8);
    this.shots=this.shots.filter(p=>!p.enemy||this.dist(p,h)>300);
    this.effects.push({x:h.x,y:h.y,r:20,endR:300,ttl:0.6,max:0.6,color:'#ffd994'});
    this.burst(h.x,h.y,this.weapon==='wand'?'#87edff':this.weapon==='orbit'?'#d2a4ff':'#ffe6a0',40);this.shake=8;
    this.banner=this.weapon==='wand'?'별빛 폭풍':this.weapon==='orbit'?'궤도 붕괴':'섬광 베기';this.bannerTime=1.1;
    if(this.weapon==='wand')for(let i=0;i<12;i++){const a=i*Math.PI/6;this.shots.push({x:h.x,y:h.y,vx:Math.cos(a)*350,vy:Math.sin(a)*350,ttl:1,damage:h.damage,enemy:false,r:6});}
    h.inv=Math.max(h.inv,0.5);
  }
  petSkill(){return castCompanion(this);}
  hit(e,n,source='hero',chain=false){if(e.hp<=0||e.shield)return;if(this.experience&&!e.stun){if(e.kind==='elite')n*=.2;else if(e.kind==='boss')n*=.65;}if(e.stun>0){n*=2;if(source==='hero')this.counters++;}if(source==='hero'&&e.kind!=='boss'){const a=Math.atan2(e.y-this.hero.y,e.x-this.hero.x);e.x=Math.max(32,Math.min(1068,e.x+Math.cos(a)*12));e.y=Math.max(32,Math.min(768,e.y+Math.sin(a)*12));}if(chain&&this.mods.chain){const targets=this.enemies.filter(t=>t!==e&&t.hp>0&&this.dist(t,e)<190).slice(0,2);for(const t of targets){this.hit(t,n*.55,'chain');this.emit('chain',{x:e.x,y:e.y,toX:t.x,toY:t.y});}}if(this.pet){this.pet.charge=Math.min(100,this.pet.charge+(source==='pet'?2:1));if(source==='pet')this.pet.dealt+=Math.min(e.hp,n);}e.hp-=n;e.flash=0.15;this.emit('hit',{x:e.x,y:e.y,targetId:e.id,angle:Math.atan2(e.y-this.hero.y,e.x-this.hero.x),damage:Math.round(n),boss:e.kind==='boss',big:n>this.hero.damage*1.8});if(this.cinematic&&(source==='hero'||n>this.hero.damage*1.8))this.hitStop=Math.max(this.hitStop,n>this.hero.damage*1.8?.055:.025);this.burst(e.x,e.y,'#ffe6a0',6);this.texts.push({x:e.x,y:e.y-20,text:String(Math.round(n)),ttl:0.7,color:'#fff3b8'});}
  hurt(n,cause='적 접촉'){const h=this.hero;if(this.phase!=='playing')return;if(h.inv>0){if(this.experience&&this.lastDashAt!==undefined&&this.time-this.lastDashAt<=.65&&!this.dashRewarded){this.dashRewarded=true;this.dodgeSaves=(this.dodgeSaves||0)+1;this.skillCd=Math.max(0,this.skillCd-2);this.banner='회피 성공 · 스킬 대기 2초 감소';this.bannerTime=1.2;this.emit('evade',{x:h.x,y:h.y});}return;}if(this.experience&&this.attacks===0&&this.time<12)return;n*=this.difficultyStats.damage;if(this.pet?.guard>0){this.pet.blocked=(this.pet.blocked||0)+Math.min(h.hp,n)-Math.min(h.hp,n*.55);n*=.55;}this.damageTaken+=n;this.lastHurt=cause;h.hp=Math.max(0,h.hp-n);this.emit('hurt',{damage:n});h.inv=this.gentle?1.1:0.7;
    this.texts.push({x:h.x,y:h.y-26,text:`-${n}`,ttl:0.7,color:'#ffa49e'});if(h.hp<=0){this.phase='lost';this.event='end';this.emit('defeat');}}
  spawn(distance=null){
    const angle=this.random()*Math.PI*2,dist=distance??(this.cinematic?260+this.random()*65:330+this.random()*80),h=this.hero;
    const x=Math.max(32,Math.min(this.width-32,h.x+Math.cos(angle)*dist)),y=Math.max(32,Math.min(this.height-32,h.y+Math.sin(angle)*dist));
    const kind=this.random()>0.7?'ghost':'slime',hp=kind==='ghost'?55:35;
    this.enemies.push({id:++this.seq,x,y,hp,maxHp:hp,r:kind==='ghost'?26:24,kind,flash:0,arrival:this.cinematic?.5:0,speed:(kind==='ghost'?72:48)*this.difficultyStats.speed*(1+this.time/300)});
    if(this.cinematic)this.emit('spawn',{x,y});
  }
  spawnBoss(){
    this.bossMade=true;this.boss={id:'boss',x:this.hero.x,y:Math.max(150,this.hero.y-120),hp:this.experience?1450:900,maxHp:this.experience?1450:900,r:65,kind:'boss',speed:30,attack:2.4,nextSeal:0.72,shield:false,flash:0};
    this.enemies=this.enemies.slice(0,6);this.texts.push({x:550,y:240,text:'보스 등장',ttl:2,color:'#ffd994'});
    this.banner='수호자가 깨어났습니다';this.bannerTime=2;this.shake=6;this.boss.turn=0;this.boss.enraged=false;this.entrance=this.cinematic?1.7:0;this.emit('bossIntro',{x:this.boss.x,y:this.boss.y,bossType:this.bossType});
  }
  charger(e,dt){
    e.stun=Math.max(0,(e.stun||0)-dt);if(e.stun)return;
    if(e.charge){const q=e.charge;q.wait-=dt;if(q.wait<=0){e.x+=Math.cos(q.angle)*520*dt;e.y+=Math.sin(q.angle)*520*dt;if(e.x<=45||e.x>=this.width-45||e.y<=45||e.y>=this.height-45){e.x=Math.max(45,Math.min(this.width-45,e.x));e.y=Math.max(45,Math.min(this.height-45,e.y));e.charge=null;e.stun=2.6;e.cool=1;this.banner='벽에 충돌! 가까이 가서 공격';this.bannerTime=2.6;this.emit('stagger',{x:e.x,y:e.y});}if(this.dist(e,this.hero)<e.r+this.hero.r)this.hurt(20,'정예 돌진');}return;}
    e.cool=(e.cool||0)-dt;if(e.cool<=0){e.charge={angle:Math.atan2(this.hero.y-e.y,this.hero.x-e.x),wait:1.15,left:1300};this.emit('bossAttack',{x:e.x,y:e.y});}
  }
  encounters(dt){
    for(const bomb of this.bombs){bomb.ttl-=dt;if(bomb.ttl<=0){for(const e of [...this.enemies,...(this.boss?[this.boss]:[])])if(this.dist(e,bomb)<bomb.r+e.r)this.hit(e,this.hero.damage*2,'echo');this.emit('meteor',{x:bomb.x,y:bomb.y,radius:bomb.r});}}this.bombs=this.bombs.filter(b=>b.ttl>0);
    if(this.encounter==='warmup'&&this.kills>=4){this.encounter='elite';this.enemies=[];this.enemies.push({id:++this.seq,kind:'elite',x:150,y:180,hp:300,maxHp:300,r:34,speed:0,flash:0,cool:1});this.banner='정예 돌진병 · 벽 충돌 뒤 반격';this.bannerTime=2;}
    else if(this.encounter==='warmup'&&this.enemies.filter(e=>e.hp>0).length<2&&this.kills<4)this.spawn(170);
    else if(this.encounter==='assault'&&this.kills>=this.waveGoal){this.enemies=[];this.requestQuestion('wave');}
    else if(this.encounter==='assault'&&this.enemies.filter(e=>e.hp>0).length<2)this.spawn(210);
    if(this.time>12&&!this.riskChest){this.riskChest=true;this.drops.push({x:990,y:690,kind:'chest',source:'위험 구역 상자'});this.hazards.push({x:990,y:690,r:95,ttl:1.8,risk:true});}
  }
  step(dt,input={}){
    if(this.phase!=='playing')return;
    dt=Math.max(0,Math.min(0.05,dt))*this.gameSpeed;if(this.entrance>0){this.entrance=Math.max(0,this.entrance-dt);return;}if(this.hitStop>0){this.hitStop=Math.max(0,this.hitStop-dt);return;}this.time+=dt;const h=this.hero;
    this.shake=Math.max(0,this.shake-dt*20);this.bannerTime=Math.max(0,this.bannerTime-dt);this.comboTime=Math.max(0,this.comboTime-dt);if(!this.comboTime)this.combo=0;
    for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.ttl-=dt;p.vx*=.96;p.vy*=.96;}this.particles=this.particles.filter(p=>p.ttl>0);
    this.attackCd-=dt;this.dashCd=Math.max(0,this.dashCd-dt);this.skillCd=Math.max(0,this.skillCd-dt);h.inv=Math.max(0,h.inv-dt);
    let dx=input.x||0,dy=input.y||0,len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
    if(len>0){h.face=Math.atan2(dy,dx);h.x=Math.max(32,Math.min(this.width-32,h.x+dx*h.speed*dt));h.y=Math.max(32,Math.min(this.height-32,h.y+dy*h.speed*dt));}
    if(this.autoSkills){const target=this.nearest();if(target&&this.dist(target,h)<270)this.skill();if(this.pet&&(target&&this.dist(target,this.pet)<340||this.pet.type==='heal'&&h.hp<h.maxHp*.7))this.petSkill();}
    this.attackBuffer=Math.max(0,this.attackBuffer-dt);if(input.attack||this.attackBuffer>0)this.attack();
    companionStep(this,dt);
    if(this.experience)this.encounters(dt);if(this.phase!=='playing')return;
    this.spawnCd-=dt;if(!this.experience&&this.spawnCd<=0&&this.enemies.length<this.difficultyStats.cap){this.spawn();this.spawnCd=Math.max(0.45,1.3-this.time/230)*(this.boss?2.4:1)*this.difficultyStats.spawn;}
    if(!this.experience&&!this.bossMade&&this.time>=150)this.spawnBoss();
    for(const e of this.enemies){
      e.flash=Math.max(0,e.flash-dt);if(e.hp<=0)continue;if(e.kind==='elite'){this.charger(e,dt);continue;}if(e.arrival>0){e.arrival=Math.max(0,e.arrival-dt);continue;}if(this.experience&&this.attacks===0&&this.time<12)continue;const d=this.dist(e,h)||1;
      e.x+=(h.x-e.x)/d*e.speed*dt;e.y+=(h.y-e.y)/d*e.speed*dt;
      if(d<e.r+h.r)this.hurt(this.gentle?8:13);
    }
    if(this.phase!=='playing')return;
    const b=this.boss;
    if(b&&b.hp>0){
      b.stun=Math.max(0,(b.stun||0)-dt);if(b.recovery>0){b.recovery-=dt;if(b.recovery<=0){b.stun=1.8;this.banner='공격 후 빈틈 · 노란 적을 공격!';this.bannerTime=1.8;}}
      if(b.hp<b.maxHp*.4&&!b.enraged){b.enraged=true;b.speed*=1.3;this.banner='분노한 수호자 · 공격 속도 상승';this.bannerTime=2;this.burst(b.x,b.y,'#ff927b',32);this.emit('rage',{x:b.x,y:b.y});}
      if(b.charge){b.charge.wait-=dt;if(b.charge.wait<=0){const travel=Math.min(dt*620,b.charge.left);b.x+=Math.cos(b.charge.angle)*travel;b.y+=Math.sin(b.charge.angle)*travel;b.charge.left-=travel;if(b.charge.left<=0){b.x=Math.max(50,Math.min(1050,b.x));b.y=Math.max(50,Math.min(750,b.y));b.charge=null;b.stun=2.2;this.banner='돌진 끝 · 노란 빈틈에 공격!';this.bannerTime=2.2;this.emit('stagger',{x:b.x,y:b.y});this.shake=5;}}}
      b.flash=Math.max(0,b.flash-dt);let d=this.dist(b,h)||1;
      if(d>100&&!b.charge&&!b.stun){b.x+=(h.x-b.x)/d*b.speed*dt;b.y+=(h.y-b.y)/d*b.speed*dt;}
      if(d<b.r+h.r&&!b.stun)this.hurt(this.gentle?12:20);
      b.attack-=dt;
      if(b.attack<=0&&!b.stun&&!b.charge){b.attack=(this.gentle?3.7:2.7)*(b.enraged?.78:1);b.turn++;
        const aim=Math.atan2(h.y-b.y,h.x-b.x),pattern=this.bossType;
        if(pattern==='bugbug'){b.charge={angle:aim,wait:1.1,left:Math.min(320,d+65)};this.banner='돌진 예고 · 붉은 길을 피하세요';}
        else if(pattern==='doppel'){for(let i=0;i<5;i++)this.hazards.push({x:Math.max(50,Math.min(1050,h.x+Math.cos(i*2.4)*i*55)),y:Math.max(50,Math.min(750,h.y+Math.sin(i*2.4)*i*55)),r:58,ttl:1.3+i*.18});this.banner='운석 낙하 · 원 밖으로 이동';}
        else{const count=pattern==='bubble'?7:12;for(let i=0;i<count;i++){const a=pattern==='bubble'?aim+(i-3)*.19:i*Math.PI*2/count+b.turn*.37;const speed=pattern==='bubble'?145:100;this.shots.push({x:b.x,y:b.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,ttl:5,damage:12,enemy:true,r:7});}this.banner=pattern==='bubble'?'파도 탄막 · 옆으로 피하세요':'나선 탄막 · 틈을 찾으세요';}
        if(pattern!=='bugbug')b.recovery=1.5;this.bannerTime=1.3;this.emit('bossAttack',{x:b.x,y:b.y,bossType:this.bossType});
      }
      if(this.time>=this.nextQuestionAt&&b.hp/b.maxHp<=b.nextSeal&&b.nextSeal>0){b.shield=true;this.requestQuestion('seal');return;}
    }
    if(this.phase!=='playing')return;
    for(const shot of this.shots){
      shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.ttl-=dt;
      if(shot.enemy){if(this.dist(shot,h)<h.r+shot.r){this.hurt(shot.damage,'보스 탄막');shot.ttl=0;}}
      else for(const e of [...this.enemies,...(b?[b]:[])])if(e.hp>0&&!shot.hitIds?.includes(e.id)&&this.dist(shot,e)<e.r+shot.r){this.hit(e,shot.damage,shot.source,shot.chain);if(shot.pierce){shot.hitIds.push(e.id);}else{shot.ttl=0;break;}}
    }
    if(this.phase!=='playing')return;
    this.shots=this.shots.filter(p=>p.ttl>0);
    for(const z of this.hazards){z.ttl-=dt;if(z.ttl<=0){if(this.dist(z,h)<z.r+h.r)this.hurt(this.gentle?14:22,'운석 범위');this.emit('meteor',{x:z.x,y:z.y,radius:z.r});this.effects.push({...z,endR:z.r+15,ttl:0.3,max:0.3,color:'#ff9584'});if(z.risk)z.ttl=1.8;}}
    if(this.phase!=='playing')return;
    this.hazards=this.hazards.filter(z=>z.ttl>0);
    for(const e of this.enemies.filter(e=>e.hp<=0)){
      this.kills++;if(this.mods.heart&&this.kills%5===0)this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+12);if(e.kind==='elite'){this.encounter='cache';this.enemies.forEach(t=>{if(t!==e)t.hp=0;});this.drops.push({x:e.x,y:e.y,kind:'chest',source:'정예 돌진병 처치'});}this.drops.push({x:e.x,y:e.y,kind:'gem',v:3});
      this.emit('kill',{x:e.x,y:e.y,enemyKind:e.kind,angle:Math.atan2(e.y-h.y,e.x-h.x)});this.combo++;this.comboTime=5;this.bestCombo=Math.max(this.bestCombo,this.combo);if(this.combo%5===0)this.emit('combo',{count:this.combo});this.burst(e.x,e.y,'#bcf997',16);
      if(this.kills%7===0)this.drops.push({x:e.x+15,y:e.y,kind:'heal',v:22});
    }
    this.enemies=this.enemies.filter(e=>e.hp>0);
    for(const d of this.drops){const dist=this.dist(d,h)||1;
      if(d.kind!=='chest'&&dist<h.magnet){d.x+=(h.x-d.x)/dist*260*dt;d.y+=(h.y-d.y)/dist*260*dt;}
      if(this.phase==='playing'&&dist<(d.kind==='chest'?46:24)){d.used=true;if(d.kind==='chest'){if(d.source==='위험 구역 상자')this.hazards=this.hazards.filter(z=>!z.risk);this.offerLoot(d.source);continue;}this.emit('pickup',{x:d.x,y:d.y,heal:d.kind==='heal'});if(d.kind==='gem')this.xp+=d.v;else h.hp=Math.min(h.maxHp,h.hp+d.v);}
    }
    this.drops=this.drops.filter(d=>!d.used).slice(-200);
    for(const effect of this.effects)effect.ttl-=dt;this.effects=this.effects.filter(e=>e.ttl>0);
    for(const text of this.texts){text.ttl-=dt;text.y-=25*dt;}this.texts=this.texts.filter(t=>t.ttl>0).slice(-30);
    if(this.phase!=='playing')return;
    if(b&&b.hp<=0){this.phase='won';this.encounter='complete';this.event='end';this.emit('victory',{x:b.x,y:b.y});return;}
    if(this.xp>=this.nextXp){this.xp-=this.nextXp;this.rank++;this.nextXp=6+this.rank*4;this.hero.damage*=1.06;this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+8);this.emit('level',{level:this.rank});this.pendingLevelQuestion=true;}
    if(!this.experience&&this.pendingLevelQuestion&&this.time>=this.nextQuestionAt)this.requestQuestion('level');
  }
}
