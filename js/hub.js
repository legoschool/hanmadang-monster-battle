import { TEAMS, spriteOf } from './config.js';
import { PET_SKILLS } from './expedition-companions.js';
const hub=document.getElementById('promoLanding');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const portraits=['a05','a02','a18','a17','a01','a20','a07','a08','a09','a10'];
const tabs=document.getElementById('communityTabs'),detail=document.getElementById('communityDetail');
let selectedTeam=0,lastChoice=0;
tabs.innerHTML=TEAMS.map((t,i)=>`<button type="button" data-team-index="${i}" aria-pressed="false"><img src="${spriteOf(t.id)}" alt="" width="28" height="28">${t.community}</button>`).join('');
function communityPaint(){const t=TEAMS[selectedTeam],avatar=portraits[selectedTeam];tabs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedTeam)));detail.innerHTML=`<div class="community-pair"><img class="community-avatar" src="assets/avatars/${avatar}.png" alt="아바타 예시"><img class="community-pet" src="${spriteOf(t.id)}" alt="${t.monster}"></div><div class="community-description"><h2>${t.community} <span>동행 펫 · ${t.monster}</span></h2><p>${t.about}</p><small>${t.desc}</small></div><div class="community-skills"><b>펫 전투 기술 · ${PET_SKILLS[t.id].name}</b><span>성장 기술 · ${t.skill.name} (Lv.5)<br>${t.skill.effect}</span><small>아바타는 예시이며 가입할 때 자유롭게 골라요.</small></div>`;
 const surrounding=Array.from({length:6},(_,i)=>(selectedTeam+i)%TEAMS.length);
 hub.querySelector('.hub-avatars').innerHTML=surrounding.map((n,i)=>{const team=TEAMS[n];return `<button type="button" data-community="${n}" aria-label="${team.community}, 펫 ${team.monster} 소개 보기" style="--delay:${-i*.5}s"><span class="hub-pair"><img src="assets/avatars/${portraits[n]}.png" alt=""><img src="${spriteOf(team.id)}" alt=""></span><small>${team.community}</small></button>`}).join('');
}
function choose(n){selectedTeam=n;lastChoice=Date.now();communityPaint();}
tabs.onclick=e=>{const b=e.target.closest('button');if(b)choose(+b.dataset.teamIndex);};hub.querySelector('.hub-avatars').onclick=e=>{const b=e.target.closest('button');if(b)choose(+b.dataset.community);};
setInterval(()=>{if(!hub.hidden&&!document.hidden&&!document.querySelector('dialog[open]')&&Date.now()-lastChoice>10000){selectedTeam=(selectedTeam+1)%TEAMS.length;communityPaint();}},6000);communityPaint();
const scenes=[
 ['01 · 화면 너머의 이상 신호','어느 날, 화면 너머에서','그럴듯한 거짓말, 진짜 같은 가짜 얼굴, 보고 싶은 것만 보여주는 거품. 우리 화면에 이상한 것들이 늘어나기 시작했어요.','assets/bosses/bubble.png','필터버블'],
 ['02 · 혼란의 근원','대마왕 글리치의 등장','디지털 혼란을 즐기는 글리치가 네 부하를 풀어놓았어요. 버그벌레, 도플갱어, 할루시, 필터버블이 우리의 일상을 흔들어요.','assets/bosses/glitch.png','대마왕 글리치'],
 ['03 · 우리의 무기','아는 만큼, 강해진다!','부하들은 모르는 사람에게만 힘을 써요. 원리를 배우면 힘을 잃고, 여럿이 함께 알면 더는 버티지 못해요.','assets/avatars/a02.png','안경 박사'],
 ['04 · 열 개의 커뮤니티, 하나의 원정대','함께 배우고, 함께 물리쳐요','하루 한 조각씩 배우고, 아바타와 펫을 키우며 함께 도전해요. 12월 19일, 우리 모두의 힘으로 최종 결전에 나섭니다!','assets/monsters/koalbot/koalbot.png','코알봇'],
];
let current=0,paused=false,still=false;
const story=hub.querySelector('.hub-story'),pause=document.getElementById('storyPause'),dots=hub.querySelector('.hub-story-dots');
dots.innerHTML=scenes.map((_,i)=>`<button type="button" data-story="${i}" aria-label="프롤로그 ${i+1}장"></button>`).join('');
function paint(animate=false){const [chapter,title,text,src,alt]=scenes[current];document.getElementById('storyChapter').textContent=chapter;document.getElementById('storyTitle').textContent=title;document.getElementById('storyText').textContent=text;const img=document.getElementById('storyImage');img.src=src;img.alt=alt;dots.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',String(i===current)));pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'프롤로그 자동 넘김 시작':'프롤로그 자동 넘김 정지');pause.setAttribute('aria-pressed',String(paused));if(animate&&!still&&!reduced.matches)hub.querySelector('.hub-story-scene').animate([{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:350});}
function next(delta){current=(current+delta+scenes.length)%scenes.length;paint(true);}
document.getElementById('storyPrev').onclick=()=>next(-1);document.getElementById('storyNext').onclick=()=>next(1);pause.onclick=()=>{paused=!paused;paint();};dots.onclick=e=>{const b=e.target.closest('button');if(b){current=+b.dataset.story;paint(true);}};
let touch=null;story.addEventListener('touchstart',e=>touch=[e.touches[0].clientX,e.touches[0].clientY],{passive:true});story.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch[0],dy=e.changedTouches[0].clientY-touch[1];if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))next(dx<0?1:-1);touch=null;},{passive:true});
let visible=false,hover=false;new IntersectionObserver(entries=>visible=entries[0].isIntersecting,{threshold:.2}).observe(story);story.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')hover=true});story.addEventListener('pointerleave',()=>hover=false);
setInterval(()=>{if(visible&&!hub.hidden&&!document.hidden&&!paused&&!still&&!hover&&(!story.contains(document.activeElement)||document.activeElement===pause)&&!document.querySelector('dialog[open]'))next(1)},6000);
paint();
const adminMenu=document.getElementById('adminMenu'),adminOpen=document.getElementById('openAdminMenu');let adminVideoWasPlaying=false;
adminOpen.onclick=()=>{const video=document.getElementById('promoVideo');adminVideoWasPlaying=!video.paused;video.pause();adminMenu.showModal();};
adminMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{adminVideoWasPlaying=false;adminMenu.close();}));
adminMenu.addEventListener('close',()=>{adminOpen.focus({preventScroll:true});if(adminVideoWasPlaying&&!hub.hidden&&!document.hidden)document.getElementById('promoVideo').play().catch(()=>{});});
