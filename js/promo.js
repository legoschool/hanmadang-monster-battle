const landing=document.getElementById('promoLanding'),app=document.getElementById('app'),video=document.getElementById('promoVideo'),guide=document.getElementById('participationGuide');
const show=!location.hash&&!new URLSearchParams(location.search).has('mode');landing.hidden=!show;app.hidden=show;
const toggle=document.getElementById('promoToggle'),sound=document.getElementById('promoSound'),status=document.getElementById('promoPlayback');
function labels(){toggle.textContent=video.paused?'재생':'일시정지';sound.textContent=video.muted?'소리 켜기':'소리 끄기';sound.setAttribute('aria-pressed',String(!video.muted));}
async function play(){if(landing.hidden||document.hidden||document.querySelector('dialog[open]'))return;video.playbackRate=.5;try{await video.play();status.textContent='';}catch{status.textContent='재생 버튼을 누르면 영상을 볼 수 있어요.';}labels();}
video.defaultPlaybackRate=.5;video.playbackRate=.5;video.preservesPitch=true;
if(show){video.muted=true;play();}else{video.pause();video.removeAttribute('autoplay');}
toggle.onclick=()=>video.paused?play():(video.pause(),labels());sound.onclick=()=>{video.muted=!video.muted;labels();};video.onplay=labels;video.onpause=labels;video.onerror=()=>status.textContent='영상을 불러오지 못했어요. 바로 게임 체험과 참여 안내는 사용할 수 있어요.';
document.getElementById('showGuide').onclick=()=>{video.pause();guide.showModal();};guide.addEventListener('close',()=>document.getElementById('showGuide').focus());guide.addEventListener('click',e=>{if(e.target===guide){const b=guide.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)guide.close();}});
let resume=false;document.addEventListener('visibilitychange',()=>{if(document.hidden){resume=!video.paused;video.pause();}else if(resume&&!landing.hidden&&!guide.open)play();});window.addEventListener('hashchange',()=>{landing.hidden=true;app.hidden=false;video.pause();});
document.getElementById('promoFullscreen').onclick=async()=>{try{if(video.requestFullscreen)await video.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else video.controls=true;}catch{video.controls=true;}play();};
document.addEventListener('fullscreenchange',()=>{video.controls=document.fullscreenElement===video;});

const friendlyKey='gdeal-friendly-guide-v1';
function rememberGuide(){try{localStorage.setItem(friendlyKey,'seen');}catch{}}
guide.querySelectorAll('a').forEach(a=>a.addEventListener('click',rememberGuide));
document.getElementById('friendlyExplore').onclick=()=>guide.close();
guide.addEventListener('close',()=>{rememberGuide();if(!landing.hidden&&!document.hidden)play();});
let friendlySeen=false;try{friendlySeen=localStorage.getItem(friendlyKey)==='seen';}catch{}
