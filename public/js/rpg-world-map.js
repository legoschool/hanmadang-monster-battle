import {BOSS_ART} from './rpg-art.js?v=walk7';
import {drawWalker} from './rpg-walk.js?v=art8';
const W=512,H=1024,background=new Image();background.src='assets/rpg/regions.png?v=art8';
const routes=[
 [[350,966],[270,916],[160,850],[150,795],[195,740],[265,660],[310,590],[315,520],[360,450],[360,390],[330,310],[357,235],[355,145],[355,80]],
 [[330,953],[310,880],[305,795],[300,710],[320,640],[350,575],[330,520],[305,440],[320,360],[320,290],[355,215],[355,140]],
 [[305,964],[295,885],[320,805],[320,710],[345,620],[345,535],[345,450],[320,375],[315,290],[280,225],[280,145]]
];
const stops=[[0,3,5,7,9,11,13],[0,2,4,6,8,10,11],[0,2,3,5,6,8,10]];
const labels=['안내소','기록 중계기','차단된 길','보급 지점','오염 구역','원본 기록석','중앙 관문'];
const types=['home','relay','enemy','supply','enemy','archive','boss'];
export const placesFor=region=>stops[region].map((n,i)=>({x:routes[region][n][0],y:routes[region][n][1],name:labels[i],type:types[i]}));
export const PLACES=placesFor(0);
function projection(x,y,route){let best={distance:Infinity};for(let i=0;i<route.length-1;i++){const a=route[i],b=route[i+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))),px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(px-x,py-y);if(d<best.distance)best={x:px,y:py,distance:d,index:i+t};}return best;}
export function worldMap(canvas,{sprites,region,cleared,target,start,onArrive,onMove}){
 const c=canvas.getContext('2d'),route=routes[region],places=placesFor(region),keys=new Set();
 const initial=start?projection(start.x,start.y,route):{x:places[0].x,y:places[0].y};
 const p={x:initial.x,y:initial.y},pet={x:p.x-20,y:p.y+13},trail=[];
 let raf,last=0,ended=false,arrived=false,distance=0,direction='up',moving=false,queue=[],camera={x:0,y:0,w:W,h:600};
 const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function navigate(x,y){const from=projection(p.x,p.y,route),to=projection(x,y,route);queue=[];if(to.index>from.index){for(let n=Math.floor(from.index)+1;n<=Math.floor(to.index);n++)queue.push({x:route[n][0],y:route[n][1]});}else{for(let n=Math.ceil(from.index)-1;n>=Math.ceil(to.index);n--)queue.push({x:route[n][0],y:route[n][1]});}queue.push(to);}
 function actor(name,x,y,h){const a=sprites.get(name);c.fillStyle='#060e19a0';c.beginPath();c.ellipse(x,y+1,h*.22,5,0,0,7);c.fill();if(name==='hero'){drawWalker(c,a,x,y,h,{distance,walking:moving,direction});return;}if(!a)return;c.save();c.translate(x,y);if(name==='pet'&&direction==='left')c.scale(-1,1);c.imageSmoothingEnabled=false;const bob=name==='pet'&&moving&&!calm?-Math.abs(Math.sin(distance/9))*3:0;c.drawImage(a.base,-a.w/a.h*h/2,-h+bob,a.w/a.h*h,h);c.restore();}
 function marker(a,i,now){const done=cleared||i<target.index,hot=i===target.index;if((a.type==='enemy'||a.type==='boss')&&!done)actor(a.type==='boss'?BOSS_ART[region].id:['bugbug','bubble','halluci'][region],a.x,a.y,a.type==='boss'?75:49);
 if(!done&&['relay','archive','supply'].includes(a.type)){
  const col=a.type==='archive'?'#bb9aff':a.type==='supply'?'#ffe0a0':'#8feaff';
  c.fillStyle='#171b30aa';c.beginPath();c.ellipse(a.x,a.y+2,19,8,0,0,7);c.fill();
  c.fillStyle='#465575';c.fillRect(a.x-15,a.y-9,30,9);c.fillStyle='#90a0b7';c.fillRect(a.x-17,a.y-12,34,4);
  c.save();c.shadowColor=col;c.shadowBlur=12;c.fillStyle=col;c.beginPath();c.moveTo(a.x,a.y-42);c.lineTo(a.x+10,a.y-25);c.lineTo(a.x,a.y-13);c.lineTo(a.x-10,a.y-25);c.closePath();c.fill();c.restore();c.fillStyle='#fff9';c.beginPath();c.moveTo(a.x,a.y-40);c.lineTo(a.x,a.y-15);c.lineTo(a.x-7,a.y-25);c.fill();
 }
 if(hot&&!cleared){c.strokeStyle='#ffdf8d';c.lineWidth=2;c.beginPath();c.ellipse(a.x,a.y+3,25+(calm?0:Math.sin(now/350)*2),10,0,0,7);c.stroke();c.fillStyle='#ffe0a0';c.beginPath();c.moveTo(a.x,a.y-64);c.lineTo(a.x-5,a.y-72);c.lineTo(a.x+5,a.y-72);c.fill();}
 if(done&&i>0){c.fillStyle='#9ee9c4';c.font='bold 16px sans-serif';c.textAlign='center';c.fillText('✓',a.x,a.y-10);}
 }
 function render(now){if(ended)return;raf=requestAnimationFrame(render);if(now-last<16)return;const dt=Math.min((now-last)/1000,.035);last=now;if(document.hidden)return;
 let dx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),dy=(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0),manual=!!(dx||dy);if(manual)queue=[];else if(queue.length){dx=queue[0].x-p.x;dy=queue[0].y-p.y;if(Math.hypot(dx,dy)<2){p.x=queue[0].x;p.y=queue[0].y;queue.shift();dx=dy=0;}}
 const len=Math.hypot(dx,dy),old={...p};if(len){const amount=Math.min(68*dt,manual?Infinity:len),nx=p.x+dx/len*amount,ny=p.y+dy/len*amount;if(projection(nx,ny,route).distance<23){p.x=nx;p.y=ny;}direction=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';}
 const travelled=Math.hypot(p.x-old.x,p.y-old.y);moving=travelled>.01;distance+=travelled;if(moving){trail.push({...p});if(trail.length>24)trail.shift();}const tail=trail[0]||{x:p.x-20,y:p.y+13};pet.x+=(tail.x-pet.x)*Math.min(1,dt*8);pet.y+=(tail.y+9-pet.y)*Math.min(1,dt*8);
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),cw=Math.round(rect.width*dpr),ch=Math.round(rect.height*dpr);if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 camera.w=rect.width<650?360:512;camera.h=Math.min(H,camera.w*rect.height/rect.width);camera.x=Math.max(0,Math.min(W-camera.w,p.x-camera.w*.5));camera.y=Math.max(0,Math.min(H-camera.h,p.y-camera.h*.68));
 c.setTransform(cw/camera.w,0,0,ch/camera.h,-camera.x*cw/camera.w,-camera.y*ch/camera.h);c.imageSmoothingEnabled=false;c.fillStyle='#142c35';c.fillRect(0,0,W,H);
 if(background.complete&&background.naturalWidth)c.drawImage(background,region*background.naturalWidth/3,0,background.naturalWidth/3,background.naturalHeight,0,0,W,H);
 // Actors are depth sorted at their feet instead of floating over one another.
 const entities=places.map((a,i)=>({y:a.y,draw:()=>marker(a,i,now)}));entities.push({y:p.y,draw:()=>actor('hero',p.x,p.y,66)},{y:pet.y,draw:()=>actor('pet',pet.x,pet.y,34)});entities.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
 if(!calm){for(let i=0;i<9;i++){const x=80+(i*137)%360,y=(now*.012+i*139)%H;c.globalAlpha=.25+.2*Math.sin(now/600+i);c.fillStyle=region===1?'#ffd490':'#b8ebdf';c.fillRect(x,y,2,2);}c.globalAlpha=1;}
 c.setTransform(1,0,0,1,0,0);onMove?.(Math.round(Math.hypot(target.x-p.x,target.y-p.y)));
 if(!arrived&&Math.hypot(target.x-p.x,target.y-p.y)<25){arrived=true;queue=[];onArrive();}
 }
 const click=e=>{const r=canvas.getBoundingClientRect();navigate(camera.x+(e.clientX-r.left)/r.width*camera.w,camera.y+(e.clientY-r.top)/r.height*camera.h);};
 const down=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)&&!e.target.closest('button,input,select')){e.preventDefault();keys.add(e.key.toLowerCase());}};const up=e=>keys.delete(e.key.toLowerCase());const blur=()=>keys.clear();canvas.addEventListener('pointerdown',click);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);raf=requestAnimationFrame(render);
 return {go:()=>navigate(target.x,target.y),position:()=>({...p}),stop:()=>{ended=true;cancelAnimationFrame(raf);canvas.removeEventListener('pointerdown',click);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);}};
}
