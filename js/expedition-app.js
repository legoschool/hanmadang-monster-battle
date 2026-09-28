import {TEAMS} from './config.js';
import {petGrowthMarkup} from './pet-growth.js?v=growth1';
import {levelInfo} from './game.js';
import {companionSpec} from './expedition-companions.js?v=growth1';
import {BIOMES} from './expedition-environment.js?v=pet1';
import {storyPages,StoryDirector} from './expedition-story.js?v=story5';
import * as API from './api.js';
import {ZONES,GEAR,heroLevel,gearById,zoneById,gearImage,explorerTitle,BOSS_TYPES} from './expedition-config.js?v=story5';
import {ExpeditionEngine} from './expedition-engine.js?v=growth1';
import {ExpeditionRenderer} from './expedition-renderer.js?v=pet1';
import {ExpeditionAudio} from './expedition-audio.js?v=story5';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,user,profile,library=[],zone='code',theme='mixed',mode='survival',gentle=true,difficulty='beginner',gameSpeed=.7,autoSkills=true,questionGap=60,engine=null,run=null,pending=null;
try{const options=JSON.parse(localStorage.getItem('expedition-comfort')||'{}');if(['beginner','gentle','standard'].includes(options.difficulty))difficulty=options.difficulty;if([.5,.7,1].includes(options.gameSpeed))gameSpeed=options.gameSpeed;if(typeof options.autoSkills==='boolean')autoSkills=options.autoSkills;if([30,45,60].includes(options.questionGap))questionGap=options.questionGap;}catch{}gentle=difficulty!=='standard';
function saveComfort(){try{localStorage.setItem('expedition-comfort',JSON.stringify({difficulty,gameSpeed,autoSkills,questionGap}));}catch{}}
let helpPage=0,helpReturn=null,helpSeen=false;
function comfortControls(){return `<div class="comfort-controls"><label>전투 난이도 <select id="battleDifficulty">${[['beginner','입문 · 추천 / 체력 220 · 피해 절반'],['gentle','여유 / 체력 150'],['standard','표준 / 체력 100']].map(([id,label])=>`<option value="${id}" ${difficulty===id?'selected':''}>${label}</option>`).join('')}</select></label><label>게임 속도 <select id="gameSpeed">${[[.5,'아주 천천히 · 0.5배'],[.7,'천천히 · 0.7배 (추천)'],[1,'기본 · 1배']].map(([id,label])=>`<option value="${id}" ${gameSpeed===id?'selected':''}>${label}</option>`).join('')}</select></label><label><input id="autoSkills" type="checkbox" ${autoSkills?'checked':''}> 스킬과 펫 기술도 자동으로 사용</label><small>입문은 적 수가 적고 느리며 받는 피해가 절반이에요. 속도는 이동·공격·전투 시간을 함께 늦춥니다. 변경은 지금 적용되고 다음에도 기억해요.</small></div>`;}
function playHelp(done){const wasPlaying=engine?.phase==='playing';if(wasPlaying)engine.pause();helpPage=0;helpReturn=done||(()=>{if(wasPlaying)engine?.resume();});paintHelp();}
function paintHelp(){const steps=[['1. 이동만 해 보세요','PC는 방향키 또는 WASD, 휴대폰은 화면을 누른 채 원하는 방향으로 밀어요. 왼쪽 방향 버튼을 눌러도 됩니다.','가까운 적은 자동 공격해요. 자동 기술을 켜면 스킬과 펫도 알아서 도와줍니다.'],['2. 붉은 표시를 피하고, 보석을 모아요','적과 붉은 원·길에서 조금 떨어져 보세요. 적이 남긴 보석에 가까이 가면 자동으로 모이고 레벨이 올라요.','어려우면 오른쪽 위 ‘쉬기’에서 난이도와 속도를 즉시 낮추세요. 더 느리게 해도 보상이 줄지 않아요.'],['3. 문제는 서두르지 않아도 돼요','문제가 나오면 전투가 완전히 멈춥니다. 힌트를 보고 다시 답하거나 해설을 보고 넘어갈 수 있어요.','전투 중 ‘방법’에서 이 안내를 다시 볼 수 있어요. 이미 받은 지식 보상은 쓰러져도 남아요.']][helpPage];dialog(`<div class="eyebrow">처음 플레이 안내 · ${helpPage+1} / 3</div><h2>${steps[0]}</h2><p class="help-lead">${steps[1]}</p><div class="hint">${steps[2]}</div>${helpPage===0?comfortControls():''}<div class="dialog-actions"><button class="secondary" data-action="helpPrev" ${helpPage===0?'disabled':''}>이전</button><button class="primary" data-action="helpNext">${helpPage===2?'준비됐어요 · 시작':'다음'}</button><button class="plain" data-action="helpDone">안내 닫기</button></div>`);}
function endHelp(){const done=helpReturn;helpReturn=null;helpSeen=true;closeDialog();done?.();}
let story=null,storyDirector=new StoryDirector(),storyRead=[];
try{const saved=JSON.parse(localStorage.getItem('expedition-story-read')||'[]');if(Array.isArray(saved))storyRead=saved.filter(x=>ZONES.some(z=>z.id===x.zone)&&['intro','trail','boss','seal','win','rest'].includes(x.beat));}catch{}
let busy=false,frame=0,lastFrame=0,hudTime=0,noticeTimer,keys=new Set(),pad={x:0,y:0},stick=null;
let view='lobby',answered=0,auto=true,lastMove={x:1,y:0};
let preferences={sound:true,music:false,volume:.22,calm:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:'high'};
try{const saved=JSON.parse(localStorage.getItem('expedition-presentation')||'null');if(saved)preferences={...preferences,...saved};}catch{}
let calmEffects=!!preferences.calm,renderer=null,endingRemaining=-1,training=false;
const THEMES={mixed:'전체 골고루',region:'선택한 지역 주제',stories:'AI·디지털 사건 이야기',trivia:'생활 속 일반 상식',everyday:'AI 활용·디지털 생활'};
const audio=new ExpeditionAudio();audio.configure(preferences);
function savePreferences(){calmEffects=!!preferences.calm;audio.configure(preferences);if(renderer){renderer.calm=calmEffects;renderer.quality=preferences.quality;}try{localStorage.setItem('expedition-presentation',JSON.stringify(preferences));}catch{}}

const assets=new Map();
function img(path){if(!assets.has(path)){const i=new Image();i.src=path;assets.set(path,i);}return assets.get(path);}
function notice(text){$('notice').textContent=text;$('notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.display='none',3800);}
function dialog(html){$('expedition').inert=true;$('dialog').hidden=false;$('dialog').innerHTML=`<div class="modal-cover"><section class="dialog-card" role="dialog" aria-modal="true">${html}</section></div>`;keys.clear();pad={x:0,y:0};stick=null;$('dialog').querySelector('input,button,a')?.focus({preventScroll:true});}
function showStory(beat,done,storyZone=zone){
  const paused=engine?.phase==='playing';if(paused)engine.pause();if(engine&&view==='battle')hud();
  audio.update(false);keys.clear();pad={x:0,y:0};stick=null;
  story={pages:storyPages(storyZone,beat,profile?.name),index:0,done,paused,zone:storyZone};
  if(!storyRead.some(x=>x.zone===storyZone&&x.beat===beat)){storyRead.push({zone:storyZone,beat});try{localStorage.setItem('expedition-story-read',JSON.stringify(storyRead));}catch{}}
  paintStory();
}
function paintStory(){
 const p=story.pages[story.index],z=zoneById(story.zone);
 dialog(`<div class="story-scene" style="--story-color:${z.color}"><div class="story-art" aria-hidden="true"><div class="story-orbit"></div><img src="assets/avatars/${esc(profile?.avatar||'a05')}.png" alt=""><img class="story-enemy" src="assets/bosses/${z.boss}.png" alt=""></div><div class="story-topline"><span>${z.name} · 원정 이야기</span><span>${story.index+1} / ${story.pages.length}</span></div><h2 id="storyTitle">${esc(p.title)}</h2><div class="story-speaker">${esc(p.speaker)}</div><p class="story-prose">${esc(p.text)}</p><p class="story-time">읽는 동안 전투와 제한 시간이 멈춥니다. 준비되면 넘겨 주세요.</p><div class="dialog-actions"><button class="secondary" data-action="storyBack" ${story.index===0?'disabled':''}>앞 장면</button><button class="primary" data-action="storyNext">${story.index+1<story.pages.length?'다음 장면':'이어서 진행'}</button><button class="plain" data-action="storySkip">이 장면 건너뛰기</button></div></div>`);
 $('dialog').querySelector('[role="dialog"]').setAttribute('aria-labelledby','storyTitle');
 $('dialog').querySelector('[data-action=storyNext]').focus({preventScroll:true});
}
function endStory(){const current=story;if(!current)return;story=null;closeDialog();if(current.paused)engine?.resume();lastFrame=performance.now();current.done?.();}
function storyJournal(){dialog(`<div class="eyebrow">STORY JOURNAL</div><h2>지나온 이야기</h2><p>이 기기에서 만난 장면입니다. 다시 읽어도 경험치와 보상은 바뀌지 않아요.</p><div class="story-journal">${storyRead.length?storyRead.map((r,i)=>`<button class="secondary" data-story-replay="${i}">${zoneById(r.zone).name} · ${storyPages(r.zone,r.beat,profile?.name)[0].title}</button>`).join(''):'<p>원정을 출발하면 첫 이야기가 펼쳐집니다.</p>'}</div><div class="dialog-actions"><button class="primary" data-action="close">돌아가기</button></div>`);}
function closeDialog(){$('expedition').inert=false;$('dialog').hidden=true;$('dialog').innerHTML='';$('arena')?.focus({preventScroll:true});}
async function request(type,params={}){const {result}=await API.act(type,params);if(!result?.ok)throw new Error(result?.reason||'원정 서버 응답을 확인하지 못했어요. 서버 업데이트가 필요할 수 있어요.');if(result.profile)profile=result.profile;return result;}
function petSpec(){const team=TEAMS.find(t=>t.id===user?.teamId)||TEAMS[0];return companionSpec(team,user?levelInfo(state?.teams?.[team.id]?.exp||0).level:3);}
function petCard(){const p=petSpec();return '<div class="companion-profile"><img src="'+p.image+'" alt="'+p.monsterName+'"><div><b>동행 펫 · '+p.monsterName+'</b><span>Lv.'+p.level+' · '+p.stage+' 단계</span><small>'+p.skillName+' · 자동 공격 + 합동 기술</small><small>'+(user?'Lv.1 새싹 → Lv.3 동료 → Lv.7 수호. 먹이와 배움으로 함께 키워요.':'체험에서는 Lv.3 펫이 함께해요.')+'</small></div></div>'+(user?petGrowthMarkup(TEAMS.find(t=>t.id===user.teamId)||TEAMS[0],state?.teams?.[user.teamId]?.exp||0):'');}
function header(){return `<header class="top"><div class="brand"><img src="assets/brand/gdeal.svg" alt="G-DEAL"><span>몬스터 원정대</span></div><a href="index.html#/home">공동 원정으로 돌아가기 ↗</a></header>`;}
function login(message='공동 원정에서 커뮤니티와 아바타를 고르면 이곳에서도 같은 대원으로 이어집니다.'){
  $('expedition').innerHTML=header()+`<section class="login-card"><span class="eyebrow">G-DEAL KNOWLEDGE QUEST</span><h1>내 아바타로 떠나는<br>지식의 숲</h1><p>${esc(message)}</p><a class="primary" href="index.html#/home">원정대에 참여하기</a><p class="muted">참여한 뒤 홈의 ‘지식의 숲’에서 돌아오세요.</p><button class="secondary" data-action="guestTraining">가입 없이 전투 체험</button><p class="muted">체험에서는 이름이나 플레이 기록을 서버에 저장하지 않습니다.</p></section>`;
}
function renderLobby(){
  story=null;cancelAnimationFrame(frame);engine=null;renderer=null;training=false;endingRemaining=-1;view='lobby';audio.update(false);run=null;pending=null;closeDialog();
  if(!user){login();return;}
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
      <h2>${esc(profile.name)}</h2>${petCard()}<button class="plain" data-action="customize">이름 · 모습 바꾸기</button><p class="muted">${esc(weapon.name)}${charm?' · '+esc(charm.name):' · 첫 장비와 함께 출발'}</p><div class="hero-level"><b>Lv.${lv} ${explorerTitle(lv)}</b><span>${profile.xp%60} / 60 XP</span></div><div class="bar"><i style="width:${profile.xp%60/60*100}%"></i></div><p class="muted">새 정답 3개마다 개인 레벨 +1<br>배운 문제 ${profile.mastered.length} / ${profile.total}</p>
      <div class="gear-mini"><button data-action="gear">내 장비 ${profile.owned.length}종</button><button data-action="library">지식 도감 · 복습</button></div></aside></div>
    <div class="options-row"><label>문제 꾸러미 <select id="questionTheme">${Object.entries(THEMES).map(([id,label])=>`<option value="${id}" ${theme===id?'selected':''}>${label}</option>`).join('')}</select></label><label>진행 <select id="mode"><option value="survival" ${mode==='survival'?'selected':''}>숲 탐험 · 2분 30초 뒤 보스</option><option value="boss" ${mode==='boss'?'selected':''}>보스 도전 · 바로 전투</option><option value="study" ${mode==='study'?'selected':''}>지식 탐구 · 전투 없이 문제 풀기</option></select></label>${comfortControls()}<label>문제 출제 간격 <select id="questionPace">${[60,45,30].map(n=>`<option value="${n}" ${questionGap===n?'selected':''}>${n===60?'전투 중심 · 추천':n===45?'균형':'학습 자주'} · 최소 ${n}초</option>`).join('')}</select></label><button class="plain" data-action="guide">게임 방법</button><button class="secondary" data-action="settings">소리 · 화면 효과</button><button class="secondary" data-action="trainingMenu">장비 체험 훈련장</button><button class="secondary" data-action="storyJournal">이야기 다시 읽기</button></div>
    <div class="section-head"><h2>오늘은 어디로 갈까요?</h2><span>모든 지역이 처음부터 열려 있어요</span></div><div class="zones">${ZONES.map((x,i)=>{const p=profile.zones.find(v=>v.id===x.id);return `<button class="zone ${x.id===zone?'active':''}" data-zone="${x.id}" style="--zone:${x.color}" aria-pressed="${x.id===zone}"><span class="zone-number">REGION ${String(i+1).padStart(2,'0')}</span><i class="zone-dot"></i><b>${x.topic}</b><span>${x.name} · ${p.learned} / ${p.total}</span></button>`;}).join('')}</div>
    <p class="pace-note">출제 간격은 실제 전투 시간 기준이며 보스 봉인 문제에도 적용돼요. 첫 문제는 20초 이후, 보석 레벨업은 기다리지 않고 공격력 +6% · 체력 8 회복을 받아요. 지식 탐구는 원하는 속도로 다음 문제를 풉니다. 전투 난이도는 문제 자체의 난이도를 바꾸지 않아요.</p><div class="controls-note"><kbd>WASD</kbd> / 방향키 이동 · <kbd>Space</kbd> 공격 · <kbd>E</kbd> 스킬 · <kbd>Shift</kbd> 돌진 · <kbd>Esc</kbd> 쉬기<br>휴대폰은 화면을 드래그하거나 방향 버튼으로 이동해요. 공격은 자동으로도 나갑니다.</div>
    <footer class="lobby-foot"><span>처음 맞힌 문제: 개인 경험치 20 + 먹이 1 + 5P + 커뮤니티 경험치 10<br>복습도 전투 강화는 그대로. 접속하지 않은 날의 개인 경험치는 줄지 않아요.</span><a href="index.html#/crew">우리 커뮤니티 보기 ↗</a></footer>
  </section>`;
}
function settingsDialog(){
 dialog(`<div class="eyebrow">PRESENTATION</div><h2>나에게 맞는 전투 연출</h2><div class="settings-list"><label><input id="soundSetting" type="checkbox" ${preferences.sound?'checked':''}> 타격음과 스킬 소리</label><label><input id="musicSetting" type="checkbox" ${preferences.music?'checked':''}> 전투 배경 선율</label><label>소리 크기 <input id="volumeSetting" aria-label="소리 크기" type="range" min="0" max="50" value="${Math.round(preferences.volume*100)}"></label><label><input id="calmSetting" type="checkbox" ${preferences.calm?'checked':''}> 화면 흔들림과 입자 줄이기</label><label>화면 품질 <select id="qualitySetting"><option value="high" ${preferences.quality==='high'?'selected':''}>선명하게</option><option value="low" ${preferences.quality==='low'?'selected':''}>가볍게</option></select></label></div><p class="muted">공격 범위와 적의 공격 예고는 어느 설정에서도 표시됩니다. 소리는 출발 버튼을 누른 뒤 재생돼요.</p><div class="dialog-actions"><button class="primary" data-action="settingsDone">설정 완료</button></div>`);
}
function trainingMenu(){dialog(`<div class="eyebrow">TRAINING GROUNDS</div><h2>세 무기를 직접 써 보세요.</h2><p>보상과 기록이 없는 체험 전투입니다. 모든 무기를 시험할 수 있고 체력이 넉넉합니다.</p><label class="training-region">체험할 지역 <select id="trainingZone">${ZONES.map(z=>`<option value="${z.id}" ${zone===z.id?'selected':''}>${z.name}</option>`).join('')}</select></label><div class="training-weapons">${['blade','wand','orbit'].map(id=>`<button data-training="${id}"><img src="${gearImage(id)}" alt=""><b>${gearById(id).name}</b><small>${id==='blade'?'대형 검격과 충격파':id==='wand'?'별빛 탄환과 방사 폭발':'회전 궤도와 중력장'}</small></button>`).join('')}</div><div class="dialog-actions"><button class="secondary" data-action="close">돌아가기</button></div>`);}
async function startTraining(weapon,quick=false){
 if(busy)return;busy=true;
 if(!quick)await audio.unlock();audio.configure(preferences);training=true;run=null;pending=null;engine=new ExpeditionEngine({weapon,charm:profile.charm,level:profile.level,companion:petSpec(),mode:'boss',gentle:true,difficulty,gameSpeed,autoSkills,questionGap,bossType:zoneById(zone).boss,cinematic:true,seed:Date.now()>>>0});engine.hero.maxHp=engine.hero.hp=750;if(engine.pet)engine.pet.charge=100;try{storyDirector=new StoryDirector();battle();storyDirector.take('intro');if(quick){for(const beat of ['trail','boss','seal'])storyDirector.take(beat);notice('동행 펫 준비 완료 · 합동 기술 Q / 버튼');}else showStory('intro',()=>{});}finally{busy=false;}
}
function customizeDialog(){
  dialog(`<div class="eyebrow">MY COMPANION</div><h2>함께 자랄 대원의 이름</h2><p>이름과 모습을 바꿔도 경험치와 장비는 그대로 남아요.</p><form id="customForm"><label>아바타 이름<input id="heroName" name="heroName" maxlength="16" required value="${esc(profile.name)}" autocomplete="off"></label><div class="avatar-picker">${Array.from({length:20},(_,i)=>{const id='a'+String(i+1).padStart(2,'0');return `<label><input type="radio" name="heroAvatar" value="${id}" ${profile.avatar===id?'checked':''}><img src="assets/avatars/${id}.png" alt="아바타 ${i+1}"></label>`;}).join('')}</div><div class="dialog-actions"><button class="primary" type="submit">내 대원으로 저장</button><button class="secondary" type="button" data-action="close">돌아가기</button></div><p id="customError" role="status"></p></form>`);
  $('customForm').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;try{const form=new FormData(e.target);await request('expeditionCustomize',{name:form.get('heroName'),avatar:form.get('heroAvatar')});renderLobby();notice('이름과 모습을 저장했어요. 다음 원정에도 함께해요.');}catch(err){$('customError').textContent=err.message;}finally{busy=false;}});
}
function guide(){dialog(`<div class="eyebrow">FIELD GUIDE</div><h2>움직이고 배우며<br>내 장비를 키워요.</h2><p>문제는 첫 20초 이후에 나오고, 이후에는 선택한 30·45·60초 이상의 전투 간격을 둡니다. 보석 레벨업은 자동 성장하고, 퀴즈 정답은 추가 강화를 줍니다.</p><p>방향키·WASD 또는 화면 드래그로 이동합니다. 가까운 적은 자동 공격하고, Space로 직접 공격할 수도 있어요.</p><p>적이 남긴 보석을 주우면 전투 레벨이 올라요. 레벨업은 자동으로 성장하며, 출제 간격이 지나 퀴즈를 맞히면 공격력·연사·체력·자석 중 하나를 추가로 고릅니다. E는 범위 공격, Shift는 잠깐 무적이 되는 돌진입니다.</p><p>우리 커뮤니티 몬스터가 동행 펫으로 함께 싸웁니다. 평소에는 자동 공격하고, 합동 게이지가 차면 Q 또는 합동 기술 버튼으로 고유 기술을 써요. 펫 레벨에 따라 크기·오라·기술 위력이 달라집니다. 회복형·방어형 펫도 있어요.</p><p>보스의 체력이 줄면 지식 봉인이 나타납니다. 퀴즈 중에는 시간과 공격이 모두 멈춰요. 틀려도 힌트를 보고 다시 답할 수 있고, 해설을 보고 넘어갈 수도 있습니다.</p><p>전투 강화는 이번 원정 동안만 유지됩니다. 처음 맞힌 문제로 얻은 개인 경험치와 장비는 서버에 남아 다음 원정에도 이어집니다. 쓰러져도 이미 얻은 지식 보상은 사라지지 않아요.</p><div class="dialog-actions"><button class="primary" data-action="close">준비됐어요</button></div>`);}
function gearDialog(){dialog(`<div class="eyebrow">EQUIPMENT COLLECTION</div><h2>내 아바타의 장비</h2><p class="muted">개인 레벨이 오르면 장비를 얻어요. 무기 하나와 보조 장비 하나를 착용할 수 있습니다.</p><div class="gear-grid">${GEAR.map(g=>{const own=profile.owned.includes(g.id),on=profile[g.slot]===g.id;return `<button class="gear-item ${own?'':'locked'} ${on?'equipped':''}" data-equip="${g.id}" ${own?'':'disabled'}><img class="item-art" src="${gearImage(g.id)}" alt="${g.name}"><b>${g.name}</b><small>${g.desc}</small><small>${on?'착용 중':own?'착용하기':`Lv.${g.level}에 획득`}</small></button>`;}).join('')}</div><div class="dialog-actions"><button class="primary" data-action="close">로비로</button></div>`);}
async function showLibrary(filter='all'){
  try{const r=await request('expeditionLibrary');library=r.cards;const list=library.filter(c=>filter!=='review'||c.review);
    dialog(`<div class="eyebrow">MY KNOWLEDGE JOURNAL</div><h2>배운 것, 다시 볼 것</h2><div class="library-filter"><button data-library="all">전체 ${library.length}</button><button data-library="review">다시 보기 ${library.filter(c=>c.review).length}</button></div>${list.length?list.map(c=>`<details class="library-card"><summary>${c.review?'[복습] ':''}${esc(c.q)}</summary><p><b>${esc(c.answer)}</b><br>${esc(c.explain)}</p>${c.source?`<a class="source" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">근거 자료 읽기 ↗</a>`:''}</details>`).join(''):'<p class="empty">원정에서 답한 문제가 이곳에 쌓입니다.<br>틀리거나 넘어간 문제도 다시 볼 수 있어요.</p>'}<div class="dialog-actions"><button class="primary" data-action="close">로비로</button></div>`);
  }catch(e){notice(e.message);}
}
async function start(){
  if(!helpSeen){playHelp(()=>start());return;}
  if(busy)return;busy=true;training=false;await audio.unlock();audio.configure(preferences);
  const startId=crypto.randomUUID();
  try{state=await API.fetchState();user=state.users?.[state.me];const r=await request('expeditionStart',{zone,mode,theme,requestId:startId});run=r.runId;pending=r.question;answered=0;storyDirector=new StoryDirector();storyDirector.take('intro');
    if(mode==='study'){view='study';$('expedition').innerHTML=header()+`<section class="login-card"><span class="eyebrow">${zoneById(zone).name}</span><h1>한 문제씩,<br>내 속도로.</h1><p>힌트를 보고 다시 답해도 괜찮아요. 새 정답의 보상은 즉시 저장됩니다.</p></section>`;showStory('intro',()=>showQuestion());}
    else{engine=new ExpeditionEngine({weapon:profile.weapon,charm:profile.charm,level:profile.level,companion:petSpec(),mode,gentle,difficulty,gameSpeed,autoSkills,questionGap,bossType:zoneById(zone).boss,cinematic:true,seed:Date.now()>>>0});battle();showStory('intro',()=>{});}
  }catch(e){notice(e.message);}finally{busy=false;}
}
function battle(){
  cancelAnimationFrame(frame);view='battle';endingRemaining=-1;closeDialog();keys.clear();pad={x:0,y:0};auto=true;
  const z=zoneById(zone);
  $('expedition').innerHTML=`<section class="battle"><canvas id="arena" tabindex="0" aria-label="${z.name} 전투장. 방향키로 이동, Space 공격, E 스킬, Shift 돌진"></canvas>
    <div class="battle-top"><div class="hud-box player-hud"><img class="hud-portrait" src="assets/avatars/${esc(profile.avatar)}.png" alt=""><div class="hud-title"><b>${esc(profile.name)}</b><span id="rank">전투 Lv.1</span></div><div class="bar hp"><i id="hpBar" style="width:100%"></i></div><div class="bar xp"><i id="xpBar" style="width:0%"></i></div><div class="hud-stats"><span id="hpText">체력</span><span id="kills">처치 0</span></div></div><div class="hud-box timer-box"><small>${training?'장비 체험 훈련장':z.name}</small><strong id="timer">2:30</strong></div><button class="battle-help-button" data-action="playHelp">? 방법</button><button class="pause-btn" data-action="pause" aria-label="일시정지">Ⅱ 쉬기</button></div>
    <div class="companion-hud"><img src="${engine.pet.image}" alt=""><span><b>${esc(engine.pet.name)} · Lv.${engine.pet.level}</b><small id="petState">함께 싸우는 동료</small><i class="pet-meter"><i id="petCharge"></i></i></span></div><button class="pet-call" data-action="petSkill"><span>${esc(engine.pet.skillName)}</span><small id="petReady">합동 기술 충전 중</small></button><div class="boss-hud" id="bossHud" hidden><span><img class="boss-portrait" src="assets/bosses/${z.boss}.png" alt="">${BOSS_TYPES[z.boss].name}</span><div class="bar"><i id="bossBar"></i></div><small id="bossText"></small></div>
    <div class="battle-bottom"><div class="dpad" aria-label="이동 버튼"><button data-move="up" aria-label="위로 이동">↑</button><button data-move="left" aria-label="왼쪽 이동">←</button><button data-move="down" aria-label="아래로 이동">↓</button><button data-move="right" aria-label="오른쪽 이동">→</button></div><div class="battle-actions"><button class="battle-action" data-action="dash"><span class="action-glyph">»</span>돌진<small id="dashCd">Shift</small></button><button class="battle-action" data-action="skill"><img src="${gearImage(engine.weapon)}" alt="">${engine.weapon==='wand'?'별빛 폭풍':engine.weapon==='orbit'?'궤도 붕괴':'섬광 베기'}<small id="skillCd">E</small></button><button class="battle-action large" data-action="attack"><span class="action-glyph">⌁</span>공격<small>Space</small></button></div></div><div class="battle-help">이동: 방향키 / 화면 밀기 · 공격은 자동<br><span id="autoLabel">자동 공격 켜짐</span><br><span id="comboLabel"></span></div></section>`;
  const canvas=$('arena');canvas.focus();renderer=new ExpeditionRenderer(canvas,{profile,zone:z,image:img,audio,calm:calmEffects,quality:preferences.quality});
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
  const dt=Math.min(.05,(t-lastFrame)/1000);lastFrame=t;
  if(story){renderer.draw(engine,0,{stick:null});frame=requestAnimationFrame(tick);return;}
  const beat=storyDirector.due(engine);if(beat&&storyDirector.take(beat)){showStory(beat,()=>{});frame=requestAnimationFrame(tick);return;}
  engine.step(dt,movement());renderer.draw(engine,dt,{stick});audio.update(engine.phase==='playing'&&engine.entrance<=0);
  if(t-hudTime>90){hud();hudTime=t;}
  if(engine.event){const event=engine.event;engine.event=null;
    if(event==='question'){if(training){engine.continueQuestion(true);engine.upgrade('heart');}else showQuestion();}
    if(event==='end')endingRemaining=calmEffects?1:2.6;
  }
  if(endingRemaining>=0&&!document.hidden){endingRemaining-=dt;if(endingRemaining<=0){endingRemaining=-1;finish();}}
  frame=requestAnimationFrame(tick);
}
function hud(){
  if(!engine||!$('rank'))return;const h=engine.hero,b=engine.boss;$('arena').dataset.audioState=audio.ctx?.state||'unavailable';
  $('comboLabel').textContent=engine.combo>1?`${engine.combo} 연속 처치!`:'';
  $('rank').textContent=`전투 Lv.${engine.rank}`;$('hpText').textContent=`${Math.ceil(h.hp)} / ${h.maxHp}`;
  $('hpBar').style.width=`${h.hp/h.maxHp*100}%`;$('xpBar').style.width=`${engine.xp/engine.nextXp*100}%`;$('kills').textContent=`처치 ${engine.kills}`;
  if(engine.pet){const p=engine.pet;$('petCharge').style.width=p.charge+'%';$('petState').textContent='펫 피해 '+Math.round(p.dealt)+' · 기술 '+p.casts+'회'+(p.healed?' · 회복 '+Math.round(p.healed):'')+(p.blocked?' · 보호 '+Math.round(p.blocked):'');$('petReady').textContent=p.skillCd>0?Math.ceil(p.skillCd)+'초 대기':p.charge>=100?'Q · 합동 기술 준비!':Math.floor(p.charge)+'% · 함께 싸워 충전';const button=document.querySelector('[data-action=petSkill]');button.disabled=engine.phase!=='playing'||engine.entrance>0||p.charge<100||p.skillCd>0;button.classList.toggle('ready',!button.disabled);}
  const left=Math.max(0,Math.ceil(150-engine.time));$('timer').textContent=b?'BOSS':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  $('dashCd').textContent=engine.dashCd>0?`${Math.ceil(engine.dashCd)}초`:'Shift';$('skillCd').textContent=engine.skillCd>0?`${Math.ceil(engine.skillCd)}초`:'E';
  document.querySelector('[data-action="skill"]')?.style.setProperty('--cooldown',`${engine.skillCd/9*100}%`);document.querySelector('[data-action="skill"]')?.classList.toggle('ready',engine.skillCd<=0);
  for(const action of ['attack','skill','dash']){const control=document.querySelector(`[data-action="${action}"]`);if(control)control.disabled=engine.phase!=='playing'||engine.entrance>0||(action==='skill'&&engine.skillCd>0)||(action==='dash'&&engine.dashCd>0);}
  $('bossHud').hidden=!b;if(b){$('bossBar').style.width=`${Math.max(0,b.hp/b.maxHp*100)}%`;$('bossText').textContent=`${Math.max(0,Math.ceil(b.hp))} / ${b.maxHp} · 봉인 해제 ${engine.seals}회`;}
}
function pause(){if(!engine||engine.phase!=='playing')return;engine.pause();dialog(`<div class="eyebrow">TAKE YOUR TIME</div><h2>잠깐 쉬어가요.</h2><p>전투 시간과 적의 움직임이 멈췄습니다.<br>이번 원정 ${engine.kills}마리 처치 · 전투 Lv.${engine.rank}<br>내 영구 레벨 Lv.${profile.level} · 배운 문제 ${profile.mastered?.length||0}개</p>${comfortControls()}<label><input type="checkbox" id="soundSetting" ${preferences.sound?'checked':''}> 타격음과 스킬 소리</label><br><label><input type="checkbox" id="calm" ${calmEffects?'checked':''}> 화면 흔들림 · 입자 효과 줄이기</label><br><label><input type="checkbox" id="auto" ${auto?'checked':''}> 자동 공격</label><div class="dialog-actions"><button class="primary" data-action="resume">계속하기</button>${training?'<button class="secondary" data-action="trainingMenu">다른 지역 · 무기 체험</button>':''}<button class="secondary" data-action="finish">${training?'체험 마치기':'기록하고 로비로'}</button></div>`);}
async function showQuestion(afterStory=false){
  if(!afterStory&&engine?.quizReason==='seal'&&storyDirector.take('seal')){showStory('seal',()=>showQuestion(true));return;}
  keys.clear();pad={x:0,y:0};stick=null;
  try{
    if(!pending){dialog('<p>다음 문제를 불러오고 있어요.</p>');const r=await request('expeditionNext',{runId:run});pending=r.question;}
    if(!pending){if(engine){engine.continueQuestion(true);showUpgrades();}else await finish();return;}
    const q=pending,seal=engine?.quizReason==='seal';
    dialog(`<div class="dialog-tag"><span>${seal?'보스의 지식 봉인':mode==='study'?'지식 탐구':'보석을 모았어요 · 강화 퀴즈'}</span><span>${esc(({basics:'기초 지식',stories:'사건 이야기',trivia:'일반 상식',everyday:'AI·디지털 생활'})[q.category]||'퀴즈')} · ${q.number} / ${q.total} · ${q.difficulty}</span></div><h2 id="question-title">${esc(q.q)}</h2>
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
    if(r.correct)audio.play('correct');answered++;pending=null;
    dialog(`<div class="eyebrow">${r.correct?'KNOWLEDGE ACQUIRED':'LEARN AND CONTINUE'}</div><h2 class="${r.correct?'success-title':''}">${r.correct?'지식의 힘을 얻었어요!':'이 답을 기억해 두세요.'}</h2><div class="reward-emblem ${r.correct?'earned':''}">${r.correct?'+':'?'}</div><div class="explanation"><b>${esc(r.answer)}</b><br>${esc(r.explain)}</div>${r.source?`<a class="source" href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">근거 자료 읽기 ↗</a>`:''}<p class="save-note">${r.learned?'새 지식 저장 완료 · 개인 경험치 +20 · 먹이 +1 · 5P<br>우리 커뮤니티 경험치 +10':r.correct?'복습 정답! 영구 보상은 이미 받았어요. 이번 전투 강화는 그대로 받습니다.':'보상은 없지만 지식 도감의 복습 목록에 남겼어요.'}<br>내 영구 레벨 Lv.${profile.level}</p>${r.unlocked?.length?`<div class="hint"><b>새 장비 획득!</b><br>${r.unlocked.map(id=>esc(gearById(id).name)).join(' · ')}<br><small>원정을 마친 뒤 ‘내 장비’에서 착용해요.</small></div>`:''}<div class="dialog-actions"><button class="primary" data-continue="${r.correct?'correct':'skip'}">${mode==='study'?'다음 문제':r.correct?'강화 고르기':'전투로 돌아가기'}</button></div>`);
  }catch(e){if($('answerStatus'))$('answerStatus').textContent=`${e.message} 같은 답으로 다시 눌러 주세요.`;else notice(e.message);}
  finally{busy=false;document.querySelectorAll('#dialog button').forEach(b=>b.disabled=false);}
}
function showUpgrades(){dialog(`<div class="eyebrow">CHOOSE YOUR UPGRADE</div><h2>이번에는 어떤 힘을 키울까요?</h2><p class="muted">이번 원정에 적용됩니다. 퀴즈 정답으로 체력도 회복됐어요.</p><div class="upgrade-grid">${[
  ['power','⌁','날카로운 생각','공격력 +22%'],['rapid','»','빠른 실행','공격 속도 증가'],['heart','♡','튼튼한 마음','최대 체력 +25 · 회복 +45'],['magnet','∩','지식 수집가','보석 수집 범위 +40 · 이동 속도 증가'],
].map(([id,symbol,name,desc])=>`<button data-upgrade="${id}"><div class="upgrade-symbol">${symbol}</div><strong>${name}</strong><span>${desc}</span></button>`).join('')}</div>`);}
async function finish(afterStory=false){
  if(story)return;
  if(!afterStory&&storyDirector.take('ending')){showStory(engine?.phase==='won'?'win':'rest',()=>finish(true));return;}
  if(training){cancelAnimationFrame(frame);view='result';dialog(`<div class="eyebrow">TRAINING COMPLETE</div><h2>체험 전투를 마쳤어요.</h2><p>${engine.kills}마리 처치 · 최고 ${engine.bestCombo} 연속 처치<br>훈련장에서는 경험치와 보상을 저장하지 않습니다.</p><div class="dialog-actions"><button class="primary" data-action="lobby">${user?'지역 선택으로':'처음 화면으로'}</button><button class="secondary" data-action="trainingMenu">다른 무기로 체험</button><a class="primary" href="index.html?join=1">참여하고 기록 남기기</a></div>`);return;}
  if(busy)return;busy=true;if(engine&&engine.phase==='playing')engine.pause();
  const won=engine?.phase==='won',lost=engine?.phase==='lost',kills=engine?.kills||0,rank=engine?.rank||1;
  try{const r=await request('expeditionFinish',{runId:run});view='result';cancelAnimationFrame(frame);
    dialog(`<div class="eyebrow">EXPEDITION REPORT</div><h2>${won?'지식 수호자를 물리쳤어요!':lost?'잠깐 숨을 고르고, 다시.':'오늘의 원정을 기록했어요.'}</h2><p class="muted">${lost?'쓰러져도 이미 얻은 개인 경험치와 장비는 남아 있어요.':'배운 문제와 개인 경험치가 서버에 저장됐어요.'}</p><div class="result-stats"><div><b>${r.summary.learned}</b><span>새로 배운 문제</span></div><div><b>+${r.summary.xp}</b><span>개인 경험치</span></div><div><b>${mode==='study'?r.summary.correct:kills}</b><span>${mode==='study'?'정답':'처치 (이번 기기)'}</span></div></div><p class="save-note">영구 Lv.${profile.level} · 수집한 장비 ${profile.owned.length}종<br>${mode==='study'?'':`이번 전투 Lv.${rank} · `}정답 ${r.summary.correct} / 답 제출 ${r.summary.attempts}회<br>새 정답의 커뮤니티 기여는 이미 반영됐습니다.</p><div class="dialog-actions"><button class="primary" data-action="lobby">지역 선택으로</button><button class="secondary" data-action="again">같은 지역 다시</button></div>`);
  }catch(e){dialog(`<h2>원정 기록을 확인하고 있어요.</h2><p>${esc(e.message)}</p><p class="muted">이미 정답 처리된 지식 보상은 서버에 남아 있습니다.</p><div class="dialog-actions"><button class="primary" data-action="finish">기록 다시 확인</button><button class="secondary" data-action="lobby">로비로 돌아가기</button></div>`);}
  finally{busy=false;}
}

document.addEventListener('click',async e=>{
  const el=e.target.closest('button');if(!el||el.disabled)return;
  if(story){if(el.dataset.action==='storyNext'){if(story.index+1<story.pages.length){story.index++;paintStory();}else endStory();}else if(el.dataset.action==='storyBack'&&story.index>0){story.index--;paintStory();}else if(el.dataset.action==='storySkip')endStory();return;}
  if(el.dataset.storyReplay!==undefined){const r=storyRead[Number(el.dataset.storyReplay)];if(r)showStory(r.beat,storyJournal,r.zone);return;}
  if(el.dataset.training){startTraining(el.dataset.training);return;}
  if(el.dataset.zone){zone=el.dataset.zone;renderLobby();return;}
  if(el.dataset.equip){if(busy)return;busy=true;try{await request('expeditionEquip',{item:el.dataset.equip});gearDialog();}catch(err){notice(err.message);}finally{busy=false;}return;}
  if(el.dataset.library){showLibrary(el.dataset.library);return;}
  if(el.dataset.answer!==undefined){submitAnswer(Number(el.dataset.answer));return;}
  if(el.dataset.continue){if(mode==='study'){if(answered>=3&&storyDirector.take('trail'))showStory('trail',()=>showQuestion());else showQuestion();return;}engine.continueQuestion(el.dataset.continue==='correct');if(engine.phase==='upgrade')showUpgrades();else closeDialog();return;}
  if(el.dataset.upgrade){engine.upgrade(el.dataset.upgrade);closeDialog();return;}
  const action=el.dataset.action;
  if(action==='start')start();
  if(action==='guide'||action==='playHelp')playHelp();
  if(action==='helpPrev'){helpPage=Math.max(0,helpPage-1);paintHelp();}
  if(action==='helpNext'){if(helpPage<2){helpPage++;paintHelp();}else endHelp();}
  if(action==='helpDone')endHelp();
  if(action==='gear')gearDialog();
  if(action==='customize')customizeDialog();
  if(action==='settings')settingsDialog();
  if(action==='settingsDone'){closeDialog();renderLobby();}
  if(action==='trainingMenu')trainingMenu();
  if(action==='guestTraining'){profile={name:'체험 대원',avatar:'a05',level:1,charm:null,weapon:'blade'};zone='code';trainingMenu();}
  if(action==='storyJournal')storyJournal();
  if(action==='library')showLibrary();
  if(action==='close'){closeDialog();renderLobby();}
  if(action==='pause')pause();
  if(action==='resume'){closeDialog();engine.resume();}
  if(action==='attack')engine?.attack();
  if(action==='skill')engine?.skill();
  if(action==='petSkill'&&!engine?.petSkill())notice('가까운 적을 향해 합동 기술을 써보세요.');
  if(action==='dash')engine?.dash(lastMove.x,lastMove.y);
  if(action==='hint')$('hintBox').hidden=false;
  if(action==='skip')submitAnswer('',true);
  if(action==='retryQuestion')showQuestion();
  if(action==='finish')finish();
  if(action==='lobby')renderLobby();
  if(action==='again'){renderLobby();start();}
});
document.addEventListener('change',e=>{if(e.target.id==='calm'){preferences.calm=e.target.checked;savePreferences();}const setting={soundSetting:'sound',musicSetting:'music',calmSetting:'calm',qualitySetting:'quality'}[e.target.id];if(setting){preferences[setting]=e.target.type==='checkbox'?e.target.checked:e.target.value;savePreferences();if(preferences.sound)audio.unlock();}if(e.target.id==='volumeSetting'){preferences.volume=Number(e.target.value)/100;savePreferences();}if(e.target.id==='trainingZone'&&ZONES.some(z=>z.id===e.target.value))zone=e.target.value;if(e.target.id==='questionTheme')theme=e.target.value;if(e.target.id==='mode')mode=e.target.value;if(e.target.id==='battleDifficulty'){difficulty=e.target.value;gentle=difficulty!=='standard';engine?.setDifficulty(difficulty);saveComfort();}if(e.target.id==='gameSpeed'){gameSpeed=Number(e.target.value);if(engine)engine.gameSpeed=gameSpeed;saveComfort();}if(e.target.id==='autoSkills'){autoSkills=e.target.checked;if(engine)engine.autoSkills=autoSkills;saveComfort();}if(e.target.id==='questionPace'){questionGap=Number(e.target.value);saveComfort();}if(e.target.id==='auto'){auto=e.target.checked;if($('autoLabel'))$('autoLabel').textContent=auto?'자동 공격 켜짐':'직접 공격';}});
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
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' ','e','q','shift','escape'].includes(k))e.preventDefault();
  keys.add(k);if(!e.repeat){if(k==='e')engine.skill();if(k==='q')engine.petSkill();if(k==='shift')engine.dash(lastMove.x,lastMove.y);if(k==='escape')pause();}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();pad={x:0,y:0};stick=null;if(engine?.phase==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine?.phase==='playing')pause();});
window.addEventListener('beforeunload',e=>{if(run&&['battle','study'].includes(view)){e.preventDefault();e.returnValue='';}});

async function boot(){
  if(new URLSearchParams(location.search).get('demo')==='1'){
    profile={name:'체험 대원',avatar:'a05',level:1,charm:null,weapon:'blade'};zone='code';
    document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
    document.addEventListener('keydown',()=>audio.unlock(),{once:true});
    await startTraining('blade',true);return;
  }
  try{state=await API.fetchState();user=state.users?.[state.me];if(!user){login();return;}const r=await request('expeditionLibrary');profile=r.profile;renderLobby();}
  catch(e){$('expedition').innerHTML=header()+`<section class="login-card"><h1>연결을 확인해 주세요.</h1><p>${esc(e.message)}</p><button class="primary" id="retryBoot">다시 연결</button><p><a href="index.html#/home">공동 원정으로</a></p></section>`;$('retryBoot').onclick=boot;}
}
boot();


