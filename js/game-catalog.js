export const GAMES = [
 {id:'action',name:'보스 돌파',category:'action',tag:'액션',image:'action.png',description:'검·지팡이·궤도를 골라 펫과 보스에 맞서세요.',controls:'방향키 / 화면 밀기 · 자동 공격',length:'보스 전투',url:'expedition.html?demo=1',member:'expedition.html'},
 {id:'rpg',name:'아카이브 원정',category:'adventure',tag:'탐험 RPG',image:'rpg.png',description:'지도를 탐험하고 상황을 판단해 적을 물리치세요.',controls:'목적지 터치 · 선택지로 전투',length:'시간 제한 없음',url:'rpg.html?demo=1',member:'rpg.html'},
 {id:'bubble',name:'버블 정원',category:'arcade',tag:'점프 액션',image:'bubble.png',description:'방울에 갇힌 적을 터뜨리며 세 구간을 통과하세요.',controls:'좌우 이동 · 점프 · 자동 공격',length:'3구간',url:'arcade.html?demo=1&game=bubble',member:'arcade.html?game=bubble'},
 {id:'space',name:'별빛 비행대',category:'arcade',tag:'슈팅',image:'space.png',description:'적의 탄을 피하고 강화 아이템을 모으세요.',controls:'방향키 / 드래그 · 자동 발사',length:'3구간',url:'arcade.html?demo=1&game=space',member:'arcade.html?game=space'},
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mount=document.getElementById('gameCatalog');
if(mount){
 let filter='all',query='',last='';try{last=localStorage.getItem('gdeal-last-game')||'';}catch{}
 let signed=false;try{signed=!!localStorage.getItem('hanmadang-monster-token');}catch{}
 mount.innerHTML=`<div class="catalog-heading"><div><h2>게임 선택</h2><p>로그인 없이 플레이 · 체험 기록과 포인트는 저장되지 않습니다.</p></div><label class="game-search"><span>게임 찾기</span><input type="search" id="gameSearch" placeholder="게임 이름" autocomplete="off"></label></div><div class="catalog-filters" aria-label="게임 종류">${[['all','전체'],['action','액션'],['adventure','탐험'],['arcade','아케이드']].map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}<span id="gameCount" role="status"></span></div><div class="game-grid" id="gameGrid"></div><div class="catalog-services"><div><b>내 기록 · 포인트 · 선물</b><p>계정으로 플레이하면 기록을 남기고 라운지에서 포인트를 사용할 수 있습니다.</p></div><a href="${signed?'index.html?join=1#/home':'index.html?join=1&mode=resume'}">${signed?'내 원정대':'로그인'}</a><a href="index.html?join=1&mode=join">새 대원 등록</a></div>`;
 function paint(){const games=GAMES.filter(g=>(filter==='all'||g.category===filter)&&(`${g.name} ${g.tag} ${g.description}`.includes(query)));
  document.getElementById('gameCount').textContent=`${games.length}개`;
  document.getElementById('gameGrid').innerHTML=games.length?games.map(g=>`<article class="catalog-card game-${g.id}"><a class="catalog-cover" style="--cover:url(assets/portal/${g.image})" data-launch="${g.id}" href="${g.url}" aria-label="${g.name} 플레이"><img src="assets/portal/${g.image}" alt="${g.name} 실제 게임 화면" width="640" height="400"><span class="game-kind">${g.tag}</span>${last===g.id?'<span class="last-game">최근 플레이</span>':''}<span class="cover-play" aria-hidden="true">▶</span></a><div class="catalog-copy"><div class="game-meta"><span>${g.tag}</span><span>${g.length}</span></div><h3>${g.name}</h3><p>${g.description}</p><div class="game-controls">${g.controls}</div><div class="game-card-actions"><a class="game-play" data-launch="${g.id}" href="${g.url}">플레이 <span aria-hidden="true">→</span></a><a class="game-save" href="${signed?g.member:'index.html?join=1&mode=resume&next='+g.id}">기록하며 플레이</a></div></div></article>`).join(''):'<div class="catalog-empty"><p>찾는 게임이 없습니다.</p><button id="clearSearch">전체 게임 보기</button></div>';
  mount.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
 }
 mount.addEventListener('click',e=>{const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;paint();}if(e.target.closest('#clearSearch')){filter='all';query='';document.getElementById('gameSearch').value='';paint();}const a=e.target.closest('[data-launch]');if(a)try{localStorage.setItem('gdeal-last-game',a.dataset.launch);}catch{}});
 document.getElementById('gameSearch').addEventListener('input',e=>{query=e.target.value.trim();paint();});paint();
 window.addEventListener('pageshow',()=>{try{last=localStorage.getItem('gdeal-last-game')||'';}catch{}paint();});
}
