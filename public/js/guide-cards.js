const pages = [
  ['잘하지 못해도 괜찮아요', 'G-DEAL 선생님들과 조금씩 배우고 펫을 키우는 활동이에요. 오늘은 구경만 해도 좋아요. 천천히 재미로 시작해 보세요.', '둘러보기 · 바로 게임 체험', 'expedition.html?demo=1'],
  ['나만의 대원으로 출발!', '커뮤니티와 아바타를 고르고 닉네임과 나만 아는 힌트를 입력해요. 기존 대원은 이어하기로 돌아오세요.', '참여 / 이어하기', 'index.html?join=1'],
  ['매일 조금씩 배우고 성장해요', 'AI 카드 읽기, 출석과 원정 미션에 참여해요. 동료와 함께 몬스터를 키우고 보스에 도전하세요.', '원정 미션으로', 'index.html#/mission'],
  ['이동만 해도, 펫이 도와줘요', '처음에는 입문·느린 속도·자동 기술로 시작해요. PC는 방향키, 휴대폰은 화면을 밀어 이동해요. 어려우면 ‘쉬기’에서 더 천천히 바꿀 수 있어요.', '펫과 전투 체험', 'expedition.html?demo=1'],
  ['모은 포인트로 선물에 응모!', '선물 수량과 응모 현황을 살펴보고 포인트를 배정해요. 더 많이 배정할수록 추첨에 유리해져요. 응모는 운영진이 열면 시작됩니다.', '선물 응모 둘러보기', 'lounge.html#gifts'],
  ['12월 19일, 최종 결전', '배우고 플레이하며 쌓아온 힘을 한자리에! 우리 커뮤니티와 함께 마지막 보스에 도전해요.', '원정대 참여하기', 'index.html?join=1'],
];
const saved = new Map();
class GuideCards extends HTMLElement {
  connectedCallback() {
    this.key=this.dataset.key||'default';
    this.state=saved.get(this.key)||{index:0,paused:this.classList.contains('hub-guide')?true:matchMedia('(prefers-reduced-motion: reduce)').matches};
    saved.set(this.key,this.state);
    this.innerHTML=`<section class="gc" aria-label="활동 가이드 카드뉴스" aria-roledescription="캐러셀">
      <div class="gc-head"><div><small>참여 안내</small><h2>활동 가이드</h2></div><button type="button" class="gc-pause"></button></div>
      <div class="gc-card"><button type="button" class="gc-image" aria-label="현재 안내 카드 크게 보기"><img width="833" height="1179" alt=""></button><div class="gc-copy"><span class="gc-number"></span><h3></h3><p></p><a class="gc-cta"></a><button type="button" class="gc-expand">안내 카드 크게 보기</button></div></div>
      <div class="gc-controls"><button type="button" class="gc-prev" aria-label="이전 안내 카드">←</button><div class="gc-dots" role="group" aria-label="안내 카드 선택">${pages.map((_,i)=>`<button type="button" data-page="${i}" aria-label="${i+1}번 안내 카드"></button>`).join('')}</div><button type="button" class="gc-next" aria-label="다음 안내 카드">→</button></div>
      <div class="gc-foot"><span>좌우로 넘겨보기</span><a href="assets/promo/gdeal-guide.pdf?v=pet1" target="_blank" rel="noopener">가이드북 PDF</a></div><span class="gc-sr" aria-live="polite"></span>
      <dialog class="gc-dialog" aria-label="활동 가이드 확대 보기"><form method="dialog"><button type="submit" autofocus>닫기 ×</button></form><img alt=""><div><button type="button" class="gc-big-prev">← 이전</button><span class="gc-big-count"></span><button type="button" class="gc-big-next">다음 →</button></div></dialog>
    </section>`;
    this.dialog=this.querySelector('dialog');
    this.onclick=e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.matches('.gc-prev,.gc-big-prev'))this.step(-1,true);
      if(b.matches('.gc-next,.gc-big-next'))this.step(1,true);
      if(b.hasAttribute('data-page'))this.setPage(+b.dataset.page,true);
      if(b.matches('.gc-pause')){this.state.paused=!this.state.paused;this.allowFocusedPlayback=!this.state.paused;this.paint();this.restart();}else{this.allowFocusedPlayback=false;}
      if(b.matches('.gc-image,.gc-expand')){this.opener=b;this.dialog.showModal();}
    };
    this.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.step(e.key==='ArrowLeft'?-1:1,true);}};
    this.dialog.addEventListener('close',()=>{this.opener?.focus();this.restart();});
    const card=this.querySelector('.gc-card');
    card.addEventListener('touchstart',e=>{this.touch=[e.touches[0].clientX,e.touches[0].clientY];},{passive:true});
    card.addEventListener('touchend',e=>{if(!this.touch)return;const dx=e.changedTouches[0].clientX-this.touch[0],dy=e.changedTouches[0].clientY-this.touch[1];if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){this.step(dx<0?1:-1,true);}this.touch=null;},{passive:true});
    this.hover=false;
    this.onpointerenter=e=>{if(e.pointerType==='mouse')this.hover=true;};
    this.onpointerleave=()=>{this.hover=false;this.restart();};
    this.onfocusout=()=>{this.allowFocusedPlayback=false;this.restart();};
    this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.restart();},{threshold:0.15});
    this.observer.observe(this);this.paint();
  }
  disconnectedCallback(){clearInterval(this.timer);this.observer?.disconnect();if(this.dialog?.open)this.dialog.close();}
  restart(){clearInterval(this.timer);if(!this.isConnected||!this.visible||this.state.paused)return;this.timer=setInterval(()=>{if(!document.hidden&&!this.hover&&(!this.contains(document.activeElement)||this.allowFocusedPlayback)&&!this.dialog.open)this.step(1,false);},5000);}
  step(n,manual){this.setPage((this.state.index+n+pages.length)%pages.length,manual);}
  setPage(i,manual){this.state.index=i;this.paint();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)this.querySelector('.gc-card').animate([{opacity:.45,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'}],{duration:300,easing:'ease-out'});if(manual){this.querySelector('.gc-sr').textContent=`${i+1} / 6. ${pages[i][0]}`;this.restart();}}
  paint(){
    const i=this.state.index,[title,copy,label,href]=pages[i],src=`assets/promo/guide-${String(i+1).padStart(2,'0')}.jpg`;
    const img=this.querySelector('.gc-image img');img.src=src;img.alt=`활동 안내 ${i+1}쪽: ${title}`;
    this.querySelector('.gc-number').textContent=`GUIDE ${String(i+1).padStart(2,'0')} / 06`;
    this.querySelector('h3').textContent=title;this.querySelector('.gc-copy p').textContent=copy;
    const a=this.querySelector('.gc-cta');a.textContent=label+' →';a.href=href;
    const pause=this.querySelector('.gc-pause');pause.textContent=this.state.paused?'▶ 자동 넘김 시작':'Ⅱ 자동 넘김 정지';pause.setAttribute('aria-pressed',String(this.state.paused));
    this.querySelectorAll('[data-page]').forEach((b,j)=>{b.setAttribute('aria-current',String(i===j));});
    this.dialog.querySelector('img').src=src;this.dialog.querySelector('img').alt=img.alt;this.querySelector('.gc-big-count').textContent=`${i+1} / 6`;
  }
}
customElements.define('guide-cards',GuideCards);
