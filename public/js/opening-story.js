import {artReady,artSource} from './character-art.js?v=quest10';
import {cachedLook} from './player-look.js?v=look1';
const KEY='gdeal-opening-quest10';
export function openingSeen(){try{return sessionStorage.getItem(KEY)==='seen';}catch{return false;}}
export async function showOpening({force=false}={}){
 if(!force&&openingSeen())return;
 const look=cachedLook(),calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const scenes=[
  ['G-DEAL 기록실','한마당을 기다리던 날','커뮤니티가 함께 만든 활동과 아이디어가 한마당 기록실에 모이고 있었다.'],
  ['긴급 신호','연결이 끊겼다','출처를 확인하지 않은 파일에서 바이러스가 번졌다. 기록은 흩어지고, 연락망이 하나씩 꺼졌다.'],
  [look.petName||'동행 펫','아직 지울 수 없는 것', '“이 안에는 우리가 함께 만든 시간이 있어요. 원본 신호가 남아 있어요. 저와 같이 찾아 주세요.”'],
  ['글리치','혼란이 모습을 드러냈다','글리치는 손상된 기록에 숨어 오류를 반복시키고, 가짜 목소리와 거짓 정보를 퍼뜨렸다.'],
  [look.petName||'동행 펫','우리가 되찾을 기록','“적을 막아 길을 열고, 질문의 근거를 확인하면 기록을 복구할 수 있어요. 틀려도 다시 살펴보면 돼요.”'],
  ['첫 임무','코드의 숲에서 온 신호','“첫 기록은 버그 군주가 막고 있어요. 붉은 공격 표시를 피해 이동하세요. 저도 곁에서 싸울게요.”']
 ];
 const videos=[...document.querySelectorAll('video')].map(v=>({v,playing:!v.paused}));videos.forEach(({v})=>v.pause());
 const host=document.createElement('div');host.className='opening-story';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','G-DEAL 도입 이야기');host.innerHTML='<canvas aria-hidden="true"></canvas><div class="opening-brand">G-DEAL</div><div class="opening-tools"><button data-opening="pause">멈춤</button><button data-opening="skip">건너뛰기</button></div><section class="opening-dialogue"><span class="opening-speaker"></span><h1></h1><p></p><div class="opening-progress"></div></section>';
 const active=document.activeElement,siblings=[...document.body.children].map(el=>({el,inert:el.inert}));siblings.forEach(({el})=>el.inert=true);document.body.append(host);host.querySelector('button').focus({preventScroll:true});
 host.querySelector('.opening-speaker').textContent=scenes[0][0];host.querySelector('h1').textContent=scenes[0][1];host.querySelector('p').textContent=scenes[0][2];
 await artReady;
 const get=async src=>{const i=new Image();i.src=artSource(src);try{await i.decode();}catch{}return i;};
 const [bg,hero,pet,boss]=await Promise.all([get('assets/rpg/regions.png'),get(look.avatarSrc),get(look.petSrc),get('assets/bosses/glitch.png')]);
 return new Promise(resolve=>{let elapsed=0,last=performance.now(),raf,index=-1,paused=false,closed=false;
 function finish(){if(closed)return;closed=true;cancelAnimationFrame(raf);host.remove();siblings.forEach(({el,inert})=>el.inert=inert);document.removeEventListener('keydown',key);try{sessionStorage.setItem(KEY,'seen');}catch{}videos.forEach(({v,playing})=>{if(playing&&!document.hidden)v.play().catch(()=>{});});active?.focus?.({preventScroll:true});resolve();}
 function toggle(){paused=!paused;host.querySelector('[data-opening=pause]').textContent=paused?'계속':'멈춤';}
 const key=e=>{if(e.key==='Escape'){e.preventDefault();finish();}if(e.key==='Tab'){const buttons=[...host.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[1].focus();}else if(!e.shiftKey&&document.activeElement===buttons[1]){e.preventDefault();buttons[0].focus();}}};document.addEventListener('keydown',key);host.querySelector('[data-opening=pause]').onclick=toggle;host.querySelector('[data-opening=skip]').onclick=finish;
 const canvas=host.querySelector('canvas'),c=canvas.getContext('2d');
 function draw(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused&&!document.hidden)elapsed+=dt;const next=Math.floor(elapsed/6);if(next>=scenes.length){finish();return;}if(next!==index){index=next;host.dataset.scene=index;const [speaker,title,copy]=scenes[index];host.querySelector('.opening-speaker').textContent=speaker;host.querySelector('h1').textContent=title;host.querySelector('p').textContent=copy;host.querySelector('.opening-progress').innerHTML=scenes.map((_,i)=>`<i class="${i<=index?'passed':''}"></i>`).join('');}
 const rect=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}c.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height;c.fillStyle='#071723';c.fillRect(0,0,w,h);if(bg.naturalWidth){const region=index<2?2:index===5?0:2;const sw=bg.naturalWidth/3,sh=Math.min(bg.naturalHeight,sw*h/w),sy=(bg.naturalHeight-sh)*.42;c.drawImage(bg,region*sw,sy,sw,sh,0,0,w,h);}c.fillStyle=index===1?'#290d2c99':'#061b2855';c.fillRect(0,0,w,h);
 const small=w<650,size=Math.min(small?175:300,h*.34),ground=h*(small?.57:.66);function actor(im,x,scale=1,alpha=1){if(!im.naturalWidth)return;const hh=size*scale,ww=hh*im.naturalWidth/im.naturalHeight;c.globalAlpha=alpha;c.drawImage(im,x-ww/2,ground-hh+(calm?0:Math.sin(elapsed*1.5)*3),ww,hh);c.globalAlpha=1;}
 actor(hero,w*(small?.3:.34));actor(pet,w*(small?.62:.54),.65);if(index===1||index===3)actor(boss,w*(small?.74:.76),1.25,.9);
 if(!calm&&(index===1||index===3)){c.fillStyle='#ca7ef699';for(let i=0;i<12;i++){const x=(i*173+elapsed*20)%w,y=(i*83)%Math.max(1,ground);c.fillRect(x,y,10+i%4*8,2);}}
 const shade=c.createLinearGradient(0,h*.45,0,h);shade.addColorStop(0,'#07172300');shade.addColorStop(1,'#071723');c.fillStyle=shade;c.fillRect(0,0,w,h);raf=requestAnimationFrame(draw);}
 raf=requestAnimationFrame(draw);
 });
}
if(document.getElementById('promoLanding')&&!location.hash&&!new URLSearchParams(location.search).has('join')&&!new URLSearchParams(location.search).has('mode'))void showOpening();
