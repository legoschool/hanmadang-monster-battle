import * as API from './api.js';
import {ZONES,GEAR,heroLevel,gearById,zoneById,gearImage,explorerTitle,BOSS_TYPES} from './expedition-config.js';
import {ExpeditionEngine} from './expedition-engine.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,user,profile,library=[],zone='code',mode='survival',gentle=true,engine=null,run=null,pending=null;
let busy=false,frame=0,lastFrame=0,hudTime=0,noticeTimer,keys=new Set(),pad={x:0,y:0},stick=null;
let view='lobby',answered=0,auto=true,lastMove={x:1,y:0};
let calmEffects=false;
const assets=new Map();
function img(path){if(!assets.has(path)){const i=new Image();i.src=path;assets.set(path,i);}return assets.get(path);}
function notice(text){$('notice').textContent=text;$('notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.display='none',3800);}
function dialog(html){$('dialog').hidden=false;$('dialog').innerHTML=`<div class="modal-cover"><section class="dialog-card" role="dialog" aria-modal="true">${html}</section></div>`;keys.clear();pad={x:0,y:0};stick=null;$('dialog').querySelector('input,button,a')?.focus({preventScroll:true});}
function closeDialog(){$('dialog').hidden=true;$('dialog').innerHTML='';$('arena')?.focus({preventScroll:true});}
async function request(type,params={}){const {result}=await API.act(type,params);if(!result?.ok)throw new Error(result?.reason||'원정 서버 응답을 확인하지 못했어요. 서버 업데이트가 필요할 수 있어요.');if(result.profile)profile=result.profile;return result;}
function header(){return `<header class="top"><div class="brand"><img src="assets/brand/gdeal.svg" alt="G-DEAL"><span>몬스터 원정대</span></div><a href="index.html#/home">공동 원정으로 돌아가기 ↗</a></header>`;}
function login(message='공동 원정에서 커뮤니티와 아바타를 고르면 이곳에서도 같은 대원으로 이어집니다.'){
  $('expedition').innerHTML=header()+`<section class="login-card"><span class="eyebrow">G-DEAL KNOWLEDGE QUEST</span><h1>내 아바타로 떠나는<br>지식의 숲</h1><p>${esc(message)}</p><a class="primary" href="index.html#/home">원정대에 참여하기</a><p class="muted">참여한 뒤 홈의 ‘지식의 숲’에서 돌아오세요.</p></section>`;
}
function renderLobby(){
  cancelAnimationFrame(frame);engine=null;view='lobby';run=null;pending=null;closeDialog();
  const z=zoneById(zone),lv=profile.level,weapon=gearById(profile.weapon),charm=gearById(profile.charm);
  const spots=[[18,38],[37,25],[64,22],[84,37],[82,68],[62,78],[35,78],[16,68]];
  $('expedition').innerHTML=header()+`<section class="lobby">
    <div class="intro"><div><div class="eyebrow">EXPEDITION 01 / LEARN · EXPLORE · GROW</div><h1>아는 만큼, 더 멀리.</h1><p>숲을 달리고, 버그를 물리치고, 배운 것으로 장비를 키워요.<br>한 문제씩 쌓은 힘이 우리 커뮤니티에도 전해집니다.</p></div><span class="season-tag">${ZONES.length}개 지역 · ${profile.total}문제 · 내 속도로</span></div>
    <div class="lobby-grid"><div class="map-card"><div class="map-scene"><span class="map-label">THE KNOWLEDGE FOREST</span>
      <svg class="map-path" viewBox="0 0 800 270" aria-hidden="true"><path d="M88 98 Q80 35 220 30 T600 63 Q760 110 665 194 T248 205 Q32 210 88 98" fill="none" stroke="#b9b58055" stroke-width="17"/><path d="M88 98 Q80 35 220 30 T600 63 Q760 110 665 194 T248 205 Q32 210 88 98" fill="none" stroke="#a8b18d" stroke-width="1.5" stroke-dasharray="4 9"/></svg>
      ${[5,24,46,70,93].map((x,i)=>`<i class="map-tree" style="left:${x}%;top:${i%2?58:4}%;opacity:.55"></i>`).join('')}
      <img class="map-hero" src="assets/avatars/${esc(profile.avatar)}.png" alt="내 원정대 아바타">
      ${ZONES.map((x,i)=>`<button class="map-node ${zone===x.id?'active':''}" style="left:${spots[i][0]}%;top:${spots[i][1]}%" data-zone="${x.id}" aria-label="${x.name} 선택">${String(i+1).padStart(2,'0')}<small>${x.name}</small></button>`).join('')}
      </div><div class="map-caption"><div><span class="eyebrow">${z.topic}</span><h2>${z.name}</h2><p>${z.desc}</p></div><button class="primary" data-action="start">원정 출발 <span>→</span></button></div></div>
      <aside class="hero-card"><span class="eyebrow">MY EXPLORER</span><div class="hero-display"><img src="assets/avatars/${esc(profile.avatar)}.png" alt="${esc(profile.name)}"><img class="worn-weapon" src="${gearImage(weapon.id)}" alt="${weapon.name}">${charm?`<img class="worn-charm" src="${gearImage(charm.id)}" alt="${charm.name}">`:""}</div>
      <h2>${esc(profile.name)}</h2><button class="plain" data-action="customize">이름 · 모습 바꾸기</button><p class="muted">${esc(weapon.name)}${charm?' · '+esc(charm.name):' · 첫 장비와 함께 출발'}</p><div class="hero-level"><b>Lv.${lv} ${explorerTitle(lv)}</b><span>${profile.xp%60} / 60 XP</span></div><div class="bar"><i style="width:${profile.xp%60/60*100}%"></i></div><p class="muted">새 정답 3개마다 개인 레벨 +1<br>배운 문제 ${profile.mastered.length} / ${profile.total}</p>
      <div class="gear-mini"><button data-action="gear">내 장비 ${profile.owned.length}종</button><button data-action="library">지식 도감 · 복습</button></div></aside></div>
    <div class="options-row"><label>진행 <select id="mode"><option value="survival" ${mode==='survival'?'selected':''}>숲 탐험 · 2분 30초 뒤 보스</option><option value="boss" ${mode==='boss'?'selected':''}>보스 도전 · 바로 전투</option><option value="study" ${mode==='study'?'selected':''}>지식 탐구 · 전투 없이 문제 풀기</option></select></label><label><input type="checkbox" id="gentle" ${gentle?'checked':''}> 여유 모드 (체력↑ · 적 속도↓)</label><button class="plain" data-action="guide">게임 방법</button></div>
    <div class="section-head"><h2>오늘은 어디로 갈까요?</h2><span>모든 지역이 처음부터 열려 있어요</span></div><div class="zones">${ZONES.map((x,i)=>{const p=profile.zones.find(v=>v.id===x.id);return `<button class="zone ${x.id===zone?'active':''}" data-zone="${x.id}" style="--zone:${x.color}" aria-pressed="${x.id===zone}"><span class="zone-number">REGION ${String(i+1).padStart(2,'0')}</span><i class="zone-dot"></i><b>${x.topic}</b><span>${x.name} · ${p.learned} / ${p.total}</span></button>`;}).join('')}</div>
    <div class="controls-note"><kbd>WASD</kbd> / 방향키 이동 · <kbd>Space</kbd> 공격 · <kbd>E</kbd> 스킬 · <kbd>Shift</kbd> 돌진 · <kbd>Esc</kbd> 쉬기<br>휴대폰은 화면을 드래그하거나 방향 버튼으로 이동해요. 공격은 자동으로도 나갑니다.</div>
    <footer class="lobby-foot"><span>처음 맞힌 문제: 개인 경험치 20 + 먹이 1 + 5P + 커뮤니티 경험치 10<br>복습도 전투 강화는 그대로. 접속하지 않은 날의 개인 경험치는 줄지 않아요.</span><a href="index.html#/crew">우리 커뮤니티 보기 ↗</a></footer>
  </section>`;
}
function customizeDialog(){
  dialog(`<div class="eyebrow">MY COMPANION</div><h2>함께 자랄 대원의 이름</h2><p>이름과 모습을 바꿔도 경험치와 장비는 그대로 남아요.</p><form id="customForm"><label>아바타 이름<input id="heroName" name="heroName" maxlength="16" required value="${esc(profile.name)}" autocomplete="off"></label><div class="avatar-picker">${Array.from({length:20},(_,i)=>{const id='a'+String(i+1).padStart(2,'0');return `<label><input type="radio" name="heroAvatar" value="${id}" ${profile.avatar===id?'checked':''}><img src="assets/avatars/${id}.png" alt="아바타 ${i+1}"></label>`;}).join('')}</div><div class="dialog-actions"><button class="primary" type="submit">내 대원으로 저장</button><button class="secondary" type="button" data-action="close">돌아가기</button></div><p id="customError" role="status"></p></form>`);
  $('customForm').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;try{const form=new FormData(e.target);await request('expeditionCustomize',{name:form.get('heroName'),avatar:form.get('heroAvatar')});renderLobby();notice('이름과 모습을 저장했어요. 다음 원정에도 함께해요.');}catch(err){$('customError').textContent=err.message;}finally{busy=false;}});
}
function guide(){dialog(`<div class="eyebrow">FIELD GUIDE</div><h2>움직이고 배우며<br>내 장비를 키워요.</h2><p>방향키·WASD 또는 화면 드래그로 이동합니다. 가까운 적은 자동 공격하고, Space로 직접 공격할 수도 있어요.</p><p>적이 남긴 보석을 주우면 전투 레벨이 올라요. 이때 퀴즈를 맞히면 공격력·연사·체력·자석 중 하나를 고릅니다. E는 범위 공격, Shift는 잠깐 무적이 되는 돌진입니다.</p><p>보스의 체력이 줄면 지식 봉인이 나타납니다. 퀴즈 중에는 시간과 공격이 모두 멈춰요. 틀려도 힌트를 보고 다시 답할 수 있고, 해설을 보고 넘어갈 수도 있습니다.</p><p>전투 강화는 이번 원정 동안만 유지됩니다. 처음 맞힌 문제로 얻은 개인 경험치와 장비는 서버에 남아 다음 원정에도 이어집니다. 쓰러져도 이미 얻은 지식 보상은 사라지지 않아요.</p><div class="dialog-actions"><button class="primary" data-action="close">준비됐어요</button></div>`);}
function gearDialog(){dialog(`<div class="eyebrow">EQUIPMENT COLLECTION</div><h2>내 아바타의 장비</h2><p class="muted">개인 레벨이 오르면 장비를 얻어요. 무기 하나와 보조 장비 하나를 착용할 수 있습니다.</p><div class="gear-grid">${GEAR.map(g=>{const own=profile.owned.includes(g.id),on=profile[g.slot]===g.id;return `<button class="gear-item ${own?'':'locked'} ${on?'equipped':''}" data-equip="${g.id}" ${own?'':'disabled'}><img class="item-art" src="${gearImage(g.id)}" alt="${g.name}"><b>${g.name}</b><small>${g.desc}</small><small>${on?'착용 중':own?'착용하기':`Lv.${g.level}에 획득`}</small></button>`;}).join('')}</div><div class="dialog-actions"><button class="primary" data-action="close">로비로</button></div>`);}
async function showLibrary(filter='all'){
  try{const r=await request('expeditionLibrary');library=r.cards;const list=library.filter(c=>filter!=='review'||c.review);
    dialog(`<div class="eyebrow">MY KNOWLEDGE JOURNAL</div><h2>배운 것, 다시 볼 것</h2><div class="library-filter"><button data-library="all">전체 ${library.length}</button><button data-library="review">다시 보기 ${library.filter(c=>c.review).length}</button></div>${list.length?list.map(c=>`<details class="library-card"><summary>${c.review?'[복습] ':''}${esc(c.q)}</summary><p><b>${esc(c.answer)}</b><br>${esc(c.explain)}</p>${c.source?`<a class="source" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">근거 자료 읽기 ↗</a>`:''}</details>`).join(''):'<p class="empty">원정에서 답한 문제가 이곳에 쌓입니다.<br>틀리거나 넘어간 문제도 다시 볼 수 있어요.</p>'}<div class="dialog-actions"><button class="primary" data-action="close">로비로</button></div>`);
  }catch(e){notice(e.message);}
}
async function start(){
  if(busy)return;busy=true;
  const startId=crypto.randomUUID();
  try{const r=await request('expeditionStart',{zone,mode,requestId:startId});run=r.runId;pending=r.question;answered=0;
    if(mode==='study'){view='study';$('expedition').innerHTML=header()+`<section class="login-card"><span class="eyebrow">${zoneById(zone).name}</span><h1>한 문제씩,<br>내 속도로.</h1><p>힌트를 보고 다시 답해도 괜찮아요. 새 정답의 보상은 즉시 저장됩니다.</p></section>`;showQuestion();}
    else{engine=new ExpeditionEngine({weapon:profile.weapon,charm:profile.charm,level:profile.level,mode,gentle,bossType:zoneById(zone).boss,seed:Date.now()>>>0});battle();}
  }catch(e){notice(e.message);}finally{busy=false;}
}
function battle(){
  view='battle';closeDialog();keys.clear();pad={x:0,y:0};auto=true;
  const z=zoneById(zone);
  $('expedition').innerHTML=`<section class="battle"><canvas id="arena" tabindex="0" aria-label="${z.name} 전투장. 방향키로 이동, Space 공격, E 스킬, Shift 돌진"></canvas>
    <div class="battle-top"><div class="hud-box"><div class="hud-title"><b>${esc(profile.name)}</b><span id="rank">전투 Lv.1</span></div><div class="bar hp"><i id="hpBar" style="width:100%"></i></div><div class="bar xp"><i id="xpBar" style="width:0%"></i></div><div class="hud-stats"><span id="hpText">체력</span><span id="kills">처치 0</span></div></div><div class="hud-box timer-box"><small>${z.name}</small><strong id="timer">2:30</strong></div><button class="pause-btn" data-action="pause" aria-label="일시정지">Ⅱ 쉬기</button></div>
    <div class="boss-hud" id="bossHud" hidden><span>${BOSS_TYPES[z.boss].name}</span><div class="bar"><i id="bossBar"></i></div><small id="bossText"></small></div>
    <div class="battle-bottom"><div class="dpad" aria-label="이동 버튼"><button data-move="up" aria-label="위로 이동">↑</button><button data-move="left" aria-label="왼쪽 이동">←</button><button data-move="down" aria-label="아래로 이동">↓</button><button data-move="right" aria-label="오른쪽 이동">→</button></div><div class="battle-actions"><button class="battle-action" data-action="dash">돌진<small id="dashCd">Shift</small></button><button class="battle-action" data-action="skill">${profile.weapon==='wand'?'별빛 폭풍':profile.weapon==='orbit'?'궤도 붕괴':'섬광 베기'}<small id="skillCd">E</small></button><button class="battle-action large" data-action="attack">공격<small>Space</small></button></div></div><div class="battle-help">이동 WASD · 공격 Space · 스킬 E · 돌진 Shift<br><span id="autoLabel">자동 공격 켜짐</span><br><span id="comboLabel"></span></div></section>`;
  const canvas=$('arena');canvas.focus();
  canvas.addEventListener('pointerdown',e=>{if(engine.phase!=='playing')return;canvas.setPointerCapture(e.pointerId);stick={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};});
  canvas.addEventListener('pointermove',e=>{if(stick?.id===e.pointerId){stick.dx=e.clientX-stick.x;stick.dy=e.clientY-stick.y;}});
  const stop=e=>{if(stick?.id===e.pointerId)stick=null;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);
  document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);const d=b.dataset.move;pad={x:d==='left'?-1:d==='right'?1:0,y:d==='up'?-1:d==='down'?1:0};});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>pad={x:0,y:0});});
  lastFrame=performance.now();hudTime=0;frame=requestAnimationFrame(tick);
}
function movement(){
  let x=pad.x+(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),y=pad.y+(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0);
  if(stick){x+=Math.max(-1,Math.min(1,stick.dx/40));y+=Math.max(-1,Math.min(1,stick.dy/40));}
  if(x||y)lastMove={x,y};return {x,y,auto,attack:keys.has(' ')};
}
function tick(t){
  if(!engine||view!=='battle')return;
  const dt=(t-lastFrame)/1000;lastFrame=t;engine.step(dt,movement());draw();
  if(t-hudTime>90){hud();hudTime=t;}
  if(engine.event){const event=engine.event;engine.event=null;if(event==='question')showQuestion();if(event==='end')finish();}
  frame=requestAnimationFrame(tick);
}
function hud(){
  if(!engine||!$('rank'))return;const h=engine.hero,b=engine.boss;
  $('comboLabel').textContent=engine.combo>1?`${engine.combo} 연속 처치!`:'';
  $('rank').textContent=`전투 Lv.${engine.rank}`;$('hpText').textContent=`${Math.ceil(h.hp)} / ${h.maxHp}`;
  $('hpBar').style.width=`${h.hp/h.maxHp*100}%`;$('xpBar').style.width=`${engine.xp/engine.nextXp*100}%`;$('kills').textContent=`처치 ${engine.kills}`;
  const left=Math.max(0,Math.ceil(150-engine.time));$('timer').textContent=b?'BOSS':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  $('dashCd').textContent=engine.dashCd>0?`${Math.ceil(engine.dashCd)}초`:'Shift';$('skillCd').textContent=engine.skillCd>0?`${Math.ceil(engine.skillCd)}초`:'E';
  $('bossHud').hidden=!b;if(b){$('bossBar').style.width=`${Math.max(0,b.hp/b.maxHp*100)}%`;$('bossText').textContent=`${Math.max(0,Math.ceil(b.hp))} / ${b.maxHp} · 봉인 해제 ${engine.seals}/3`;}
}
function draw(){
  const c=$('arena');if(!c||!engine)return;const dpr=Math.min(2,devicePixelRatio||1),rect=c.getBoundingClientRect(),w=rect.width,h=rect.height;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const scale=Math.max(w/1100,h/800),vw=w/scale,vh=h/scale,p=engine.hero;
  const camX=Math.max(0,Math.min(engine.width-vw,p.x-vw/2)),camY=Math.max(0,Math.min(engine.height-vh,p.y-vh/2));
  ctx.save();ctx.scale(scale,scale);ctx.translate(-camX,-camY);if(!calmEffects&&engine.shake>0)ctx.translate(Math.sin(engine.time*71)*engine.shake,Math.cos(engine.time*83)*engine.shake*.6);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#34583a';ctx.fillRect(0,0,1100,800);
  const grd=ctx.createRadialGradient(550,420,40,550,420,580);grd.addColorStop(0,'#557248');grd.addColorStop(1,BOSS_TYPES[zoneById(zone).boss].bg);ctx.fillStyle=grd;ctx.fillRect(0,0,1100,800);
  ctx.lineWidth=70;ctx.strokeStyle='#a6a07825';ctx.beginPath();ctx.moveTo(0,470);ctx.bezierCurveTo(300,280,620,600,1100,360);ctx.stroke();
  for(let i=0;i<310;i++){const x=(i*137+31)%1100,y=(i*239+71)%800;ctx.fillStyle=i%5?'#a7bc7530':'#d4d09465';ctx.fillRect(x,y,i%3?3:6,2);if(i%7===0){ctx.fillRect(x+2,y-3,2,3);ctx.fillRect(x+5,y-5,2,5);}}
  const tree=(x,y,s=1)=>{ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#17352355';ctx.beginPath();ctx.ellipse(0,25,26,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6f6443';ctx.fillRect(-5,-5,10,28);for(let k=0;k<3;k++){ctx.fillStyle=['#183b29','#244a31','#305739'][k];ctx.beginPath();ctx.moveTo(0,-65+k*17);ctx.lineTo(-29+k*2,2+k*12);ctx.lineTo(29-k*2,2+k*12);ctx.closePath();ctx.fill();}ctx.restore();};
  for(let i=0;i<16;i++){tree(20+i*75,55,0.85+(i%3)*.12);tree(i*75,775,.85+(i%4)*.09);}
  for(let i=1;i<10;i++){tree(20,i*77,1.05);tree(1080,i*77,.9);}
  // 고대 회로의 제단과 돌. 직접 그린 도형을 사용한다.
  ctx.strokeStyle='#ced59f29';ctx.lineWidth=2;ctx.beginPath();ctx.arc(550,400,155,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=550+Math.cos(a)*155,y=400+Math.sin(a)*155;ctx.fillStyle='#9baf7a';ctx.fillRect(x-5,y-5,10,10);ctx.fillStyle='#d5ddb1';ctx.fillRect(x-2,y-4,3,5);}
  const charging=engine.boss?.charge;if(charging&&charging.wait>0){const b=engine.boss;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(charging.angle);ctx.fillStyle='#ff674755';ctx.fillRect(0,-34,charging.left,68);ctx.strokeStyle='#ffb39c';ctx.setLineDash([12,8]);ctx.strokeRect(0,-34,charging.left,68);ctx.restore();}
  for(const z of engine.hazards){ctx.fillStyle=`rgba(244,130,91,${.08+(1-z.ttl/1.3)*.3})`;ctx.strokeStyle='#f0b87d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
  for(const d of engine.drops){ctx.save();ctx.translate(d.x,d.y);ctx.shadowBlur=10;ctx.shadowColor=d.kind==='gem'?'#adf3bc':'#ffd7a8';ctx.fillStyle=d.kind==='gem'?'#aee6c1':'#efb18a';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(6,0);ctx.lineTo(0,7);ctx.lineTo(-6,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#efffd2';ctx.fillRect(-1,-4,2,3);ctx.restore();}
  const entities=[...engine.enemies,...(engine.boss?[engine.boss]:[]),{...p,kind:'hero'}].sort((a,b)=>a.y-b.y);
  for(const e of entities){ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle='#0e271e55';ctx.beginPath();ctx.ellipse(0,e.r*.65,e.r*1.1,e.r*.4,0,0,Math.PI*2);ctx.fill();
    if(e.kind==='hero'){
      {
        if(p.inv>0)ctx.globalAlpha=Math.floor(engine.time*12)%2 ? 0.58 : 1;
        const hero=img(`assets/avatars/${profile.avatar}.png`);if(hero.complete&&hero.naturalWidth)ctx.drawImage(hero,-29,-39,58,58);else{ctx.fillStyle='#ecdca6';ctx.fillRect(-12,-25,24,32);}
        const a=engine.weapon==='orbit'?engine.time*3:p.face;
        const item=img(gearImage(engine.weapon));ctx.save();ctx.rotate(a+Math.PI/4);ctx.translate(24,-7);if(item.complete&&item.naturalWidth)ctx.drawImage(item,-20,-28,44,44);ctx.restore();
        if(profile.charm){const accessory=img(gearImage(profile.charm));if(accessory.complete&&accessory.naturalWidth)ctx.drawImage(accessory,profile.charm==='boots'?-14:-31,profile.charm==='boots'?6:-8,profile.charm==='boots'?28:23,profile.charm==='boots'?28:23);}
        ctx.fillStyle='#eaffda';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(profile.name,0,-48);
        ctx.globalAlpha=1;
      }
    }else if(e.kind==='boss'){
      const boss=img(`assets/bosses/${zoneById(zone).boss}.png`);if(boss.complete&&boss.naturalWidth)ctx.drawImage(boss,-60,-70,120,120);else{ctx.fillStyle='#c28cc6';ctx.fillRect(-35,-45,70,70);}
      if(e.enraged){ctx.strokeStyle='#ff9777';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-8,62+Math.sin(engine.time*5)*4,0,Math.PI*2);ctx.stroke();}
      if(e.flash>0){ctx.fillStyle='#fff6bd66';ctx.beginPath();ctx.arc(0,-10,48,0,Math.PI*2);ctx.fill();}
      if(e.shield){ctx.strokeStyle='#e4d391';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,65,0,Math.PI*2);ctx.stroke();}
    }else{
      ctx.fillStyle=e.flash>0?'#fff3c9':e.kind==='ghost'?'#b1a5cf':'#8cbb72';ctx.beginPath();ctx.arc(0,-5,e.r,Math.PI,0);ctx.lineTo(e.r,e.r*.65);ctx.lineTo(-e.r,e.r*.65);ctx.closePath();ctx.fill();
      ctx.fillStyle='#233d30';ctx.fillRect(-8,-6,5,6);ctx.fillRect(4,-6,5,6);ctx.fillStyle='#f2f2c8';ctx.fillRect(-8,-6,2,2);ctx.fillRect(4,-6,2,2);
      if(e.hp<e.maxHp){ctx.fillStyle='#153b29';ctx.fillRect(-18,-30,36,3);ctx.fillStyle='#e8c284';ctx.fillRect(-18,-30,36*Math.max(0,e.hp/e.maxHp),3);}
    }ctx.restore();}
  for(const shot of engine.shots){ctx.fillStyle=shot.enemy?'#e8b080':'#b5eeec';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(shot.x,shot.y,shot.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  for(const fx of engine.effects){const f=1-fx.ttl/fx.max,r=fx.r+(fx.endR-fx.r)*f;ctx.globalAlpha=Math.max(0,1-f);ctx.strokeStyle=fx.color;ctx.lineWidth=fx.arc==null?5:13;ctx.beginPath();ctx.arc(fx.x,fx.y,r,fx.arc==null?0:fx.arc-1.1,fx.arc==null?Math.PI*2:fx.arc+1.1);ctx.stroke();ctx.globalAlpha=1;}
  if(!calmEffects)for(const spark of engine.particles){ctx.globalAlpha=Math.max(0,spark.ttl/spark.max);ctx.fillStyle=spark.color;ctx.fillRect(spark.x-spark.r,spark.y-spark.r,spark.r*2,spark.r*2);}ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.font='bold 16px system-ui';for(const t of engine.texts){ctx.fillStyle=t.color;ctx.globalAlpha=Math.min(1,t.ttl*2);ctx.fillText(t.text,t.x,t.y);}ctx.globalAlpha=1;
  if(engine.phase==='playing'&&engine.time<9){ctx.fillStyle='#f3ebc9';ctx.font='14px system-ui';ctx.fillText('이동해서 보석을 주워요. 가까운 적은 자동 공격!',p.x,p.y+62);}
  ctx.restore();
  const shade=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.7);shade.addColorStop(0,'#0c271400');shade.addColorStop(1,'#071d1c7a');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
  if(engine.bannerTime>0){ctx.save();ctx.textAlign='center';ctx.font=`bold ${w<500?16:22}px system-ui`;ctx.fillStyle='#112b28dd';ctx.fillRect(w*.08,h*.73-24,w*.84,48);ctx.fillStyle='#ffe1a8';ctx.fillText(engine.banner,w/2,h*.73+7);ctx.restore();}
  if(stick){ctx.strokeStyle='#dde8b366';ctx.fillStyle='#dde8b333';ctx.lineWidth=2;ctx.beginPath();ctx.arc(stick.x-rect.left,stick.y-rect.top,36,0,Math.PI*2);ctx.stroke();const l=Math.max(1,Math.hypot(stick.dx,stick.dy)/32);ctx.beginPath();ctx.arc(stick.x-rect.left+stick.dx/l,stick.y-rect.top+stick.dy/l,15,0,Math.PI*2);ctx.fill();}
}
function pause(){if(!engine||engine.phase!=='playing')return;engine.pause();dialog(`<div class="eyebrow">TAKE YOUR TIME</div><h2>잠깐 쉬어가요.</h2><p>전투 시간과 적의 움직임이 멈췄습니다.<br>이번 원정 ${engine.kills}마리 처치 · 전투 Lv.${engine.rank}<br>내 영구 레벨 Lv.${profile.level} · 배운 문제 ${profile.mastered.length}개</p><label><input type="checkbox" id="calm" ${calmEffects?'checked':''}> 화면 흔들림 · 입자 효과 줄이기</label><br><label><input type="checkbox" id="auto" ${auto?'checked':''}> 자동 공격</label><div class="dialog-actions"><button class="primary" data-action="resume">계속하기</button><button class="secondary" data-action="finish">기록하고 로비로</button></div>`);}
async function showQuestion(){
  keys.clear();pad={x:0,y:0};stick=null;
  try{
    if(!pending){dialog('<p>다음 문제를 불러오고 있어요.</p>');const r=await request('expeditionNext',{runId:run});pending=r.question;}
    if(!pending){if(engine){engine.continueQuestion(true);showUpgrades();}else await finish();return;}
    const q=pending,seal=engine?.quizReason==='seal';
    dialog(`<div class="dialog-tag"><span>${seal?'보스의 지식 봉인':mode==='study'?'지식 탐구':'보석을 모았어요 · 강화 퀴즈'}</span><span>${q.number} / ${q.total} · ${q.difficulty}</span></div><h2 id="question-title">${esc(q.q)}</h2>
      ${q.type==='short'?`<form id="shortForm" class="short-form"><input id="shortAnswer" aria-label="주관식 답" placeholder="짧게 적어 주세요" maxlength="100" autocomplete="off"><button class="primary" type="submit">정답 확인</button></form>`:`<div class="answers">${q.options.map((o,i)=>`<button class="answer" data-answer="${i}"><em>${i+1}</em>${esc(o)}</button>`).join('')}</div>`}
      <div class="answer-status" id="answerStatus" role="status"></div><button class="plain" data-action="hint">${q.type==='short'?'초성·설명 힌트 보기':'힌트 보기'}</button><div id="hintBox" class="hint" hidden>${esc(q.hint)}</div><p class="muted">${mode==='study'?'시간 제한이 없어요.':'지금은 전투가 멈춰 있어요.'} 틀려도 힌트를 보고 다시 답할 수 있습니다.</p><div class="dialog-actions"><button class="secondary" data-action="skip">해설 보고 넘어가기</button><button class="plain" data-action="finish">이번 원정 마치기</button></div>`);
    $('shortForm')?.addEventListener('submit',e=>{e.preventDefault();submitAnswer($('shortAnswer').value);});
  }catch(e){dialog(`<h2>연결을 기다리고 있어요.</h2><p>${esc(e.message)}</p><p class="muted">전투는 멈춰 있습니다. 연결 후 같은 문제부터 이어갈 수 있어요.</p><div class="dialog-actions"><button class="primary" data-action="retryQuestion">다시 불러오기</button><button class="secondary" data-action="finish">원정 마치기</button></div>`);}
}
async function submitAnswer(answer,skip=false){
  if(busy||!pending)return;if(!skip&&typeof answer==='string'&&!answer.trim())return notice('답을 적어 주세요.');
  busy=true;document.querySelectorAll('#dialog button').forEach(b=>b.disabled=true);
  try{const r=await request('expeditionAnswer',{runId:run,questionId:pending.id,answer,skip});
    if(!r.correct&&!r.skipped){$('answerStatus').textContent='아직 정답이 아니에요. 힌트를 보고 다시 답해 주세요.';$('hintBox').hidden=false;return;}
    answered++;pending=null;
    dialog(`<div class="eyebrow">${r.correct?'KNOWLEDGE ACQUIRED':'LEARN AND CONTINUE'}</div><h2 class="${r.correct?'success-title':''}">${r.correct?'맞았어요. 힘이 생겼어요!':'이 답을 기억해 두세요.'}</h2><div class="explanation"><b>${esc(r.answer)}</b><br>${esc(r.explain)}</div>${r.source?`<a class="source" href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">근거 자료 읽기 ↗</a>`:''}<p class="save-note">${r.learned?'새 지식 저장 완료 · 개인 경험치 +20 · 먹이 +1 · 5P<br>우리 커뮤니티 경험치 +10':r.correct?'복습 정답! 영구 보상은 이미 받았어요. 이번 전투 강화는 그대로 받습니다.':'보상은 없지만 지식 도감의 복습 목록에 남겼어요.'}<br>내 영구 레벨 Lv.${profile.level}</p>${r.unlocked?.length?`<div class="hint"><b>새 장비 획득!</b><br>${r.unlocked.map(id=>esc(gearById(id).name)).join(' · ')}<br><small>원정을 마친 뒤 ‘내 장비’에서 착용해요.</small></div>`:''}<div class="dialog-actions"><button class="primary" data-continue="${r.correct?'correct':'skip'}">${mode==='study'?'다음 문제':r.correct?'강화 고르기':'전투로 돌아가기'}</button></div>`);
  }catch(e){if($('answerStatus'))$('answerStatus').textContent=`${e.message} 같은 답으로 다시 눌러 주세요.`;else notice(e.message);}
  finally{busy=false;document.querySelectorAll('#dialog button').forEach(b=>b.disabled=false);}
}
function showUpgrades(){dialog(`<div class="eyebrow">CHOOSE YOUR UPGRADE</div><h2>이번에는 어떤 힘을 키울까요?</h2><p class="muted">이번 원정에 적용됩니다. 퀴즈 정답으로 체력도 회복됐어요.</p><div class="upgrade-grid">${[
  ['power','⌁','날카로운 생각','공격력 +22%'],['rapid','»','빠른 실행','공격 속도 증가'],['heart','♡','튼튼한 마음','최대 체력 +25 · 회복 +45'],['magnet','∩','지식 수집가','보석 수집 범위 +40 · 이동 속도 증가'],
].map(([id,symbol,name,desc])=>`<button data-upgrade="${id}"><div class="upgrade-symbol">${symbol}</div><strong>${name}</strong><span>${desc}</span></button>`).join('')}</div>`);}
async function finish(){
  if(busy)return;busy=true;if(engine&&engine.phase==='playing')engine.pause();
  const won=engine?.phase==='won',lost=engine?.phase==='lost',kills=engine?.kills||0,rank=engine?.rank||1;
  try{const r=await request('expeditionFinish',{runId:run});view='result';cancelAnimationFrame(frame);
    dialog(`<div class="eyebrow">EXPEDITION REPORT</div><h2>${won?'지식 수호자를 물리쳤어요!':lost?'잠깐 숨을 고르고, 다시.':'오늘의 원정을 기록했어요.'}</h2><p class="muted">${lost?'쓰러져도 이미 얻은 개인 경험치와 장비는 남아 있어요.':'배운 문제와 개인 경험치가 서버에 저장됐어요.'}</p><div class="result-stats"><div><b>${r.summary.learned}</b><span>새로 배운 문제</span></div><div><b>+${r.summary.xp}</b><span>개인 경험치</span></div><div><b>${mode==='study'?r.summary.correct:kills}</b><span>${mode==='study'?'정답':'처치 (이번 기기)'}</span></div></div><p class="save-note">영구 Lv.${profile.level} · 수집한 장비 ${profile.owned.length}종<br>${mode==='study'?'':`이번 전투 Lv.${rank} · `}정답 ${r.summary.correct} / 답 제출 ${r.summary.attempts}회<br>새 정답의 커뮤니티 기여는 이미 반영됐습니다.</p><div class="dialog-actions"><button class="primary" data-action="lobby">지역 선택으로</button><button class="secondary" data-action="again">같은 지역 다시</button></div>`);
  }catch(e){dialog(`<h2>원정 기록을 확인하고 있어요.</h2><p>${esc(e.message)}</p><p class="muted">이미 정답 처리된 지식 보상은 서버에 남아 있습니다.</p><div class="dialog-actions"><button class="primary" data-action="finish">기록 다시 확인</button><button class="secondary" data-action="lobby">로비로 돌아가기</button></div>`);}
  finally{busy=false;}
}

document.addEventListener('click',async e=>{
  const el=e.target.closest('button');if(!el||el.disabled)return;
  if(el.dataset.zone){zone=el.dataset.zone;renderLobby();return;}
  if(el.dataset.equip){if(busy)return;busy=true;try{await request('expeditionEquip',{item:el.dataset.equip});gearDialog();}catch(err){notice(err.message);}finally{busy=false;}return;}
  if(el.dataset.library){showLibrary(el.dataset.library);return;}
  if(el.dataset.answer!==undefined){submitAnswer(Number(el.dataset.answer));return;}
  if(el.dataset.continue){if(mode==='study'){showQuestion();return;}engine.continueQuestion(el.dataset.continue==='correct');if(engine.phase==='upgrade')showUpgrades();else closeDialog();return;}
  if(el.dataset.upgrade){engine.upgrade(el.dataset.upgrade);closeDialog();return;}
  const action=el.dataset.action;
  if(action==='start')start();
  if(action==='guide')guide();
  if(action==='gear')gearDialog();
  if(action==='customize')customizeDialog();
  if(action==='library')showLibrary();
  if(action==='close'){closeDialog();renderLobby();}
  if(action==='pause')pause();
  if(action==='resume'){closeDialog();engine.resume();}
  if(action==='attack')engine?.attack();
  if(action==='skill')engine?.skill();
  if(action==='dash')engine?.dash(lastMove.x,lastMove.y);
  if(action==='hint')$('hintBox').hidden=false;
  if(action==='skip')submitAnswer('',true);
  if(action==='retryQuestion')showQuestion();
  if(action==='finish')finish();
  if(action==='lobby')renderLobby();
  if(action==='again'){renderLobby();start();}
});
document.addEventListener('change',e=>{if(e.target.id==='calm')calmEffects=e.target.checked;if(e.target.id==='mode')mode=e.target.value;if(e.target.id==='gentle')gentle=e.target.checked;if(e.target.id==='auto'){auto=e.target.checked;if($('autoLabel'))$('autoLabel').textContent=auto?'자동 공격 켜짐':'직접 공격';}});
document.addEventListener('keydown',e=>{
  if(!$('dialog').hidden){
    if(e.key==='Tab'){
      const f=[...$('dialog').querySelectorAll('button:not(:disabled),input,a[href],select')];
      if(f.length){
        if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}
        else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}
      }
    }
    return;
  }
  if(view!=='battle'||e.target.matches('input,select,textarea'))return;const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' ','e','shift','escape'].includes(k))e.preventDefault();
  keys.add(k);if(!e.repeat){if(k==='e')engine.skill();if(k==='shift')engine.dash(lastMove.x,lastMove.y);if(k==='escape')pause();}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();pad={x:0,y:0};stick=null;if(engine?.phase==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine?.phase==='playing')pause();});
window.addEventListener('beforeunload',e=>{if(run&&['battle','study'].includes(view)){e.preventDefault();e.returnValue='';}});

async function boot(){
  try{state=await API.fetchState();user=state.users?.[state.me];if(!user){login();return;}const r=await request('expeditionLibrary');profile=r.profile;renderLobby();}
  catch(e){$('expedition').innerHTML=header()+`<section class="login-card"><h1>연결을 확인해 주세요.</h1><p>${esc(e.message)}</p><button class="primary" id="retryBoot">다시 연결</button><p><a href="index.html#/home">공동 원정으로</a></p></section>`;$('retryBoot').onclick=boot;}
}
boot();
