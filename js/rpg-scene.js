import {makeEnvironment} from './expedition-environment.js?v=pet1';
const backgrounds=new Map();
const clamp=n=>Math.max(0,Math.min(1,n));
export function mountScene(canvas,{sprites,region,run,enemyImage=run.enemy?.image,weapon,getEffect,onFrame}){
 canvas.width=1100;canvas.height=688;const c=canvas.getContext('2d');let raf,last=0,stopped=false;
 const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!backgrounds.has(region.biome))backgrounds.set(region.biome,makeEnvironment({id:region.biome}));
 function sprite(name,x,y,h,{alpha=1,angle=0,flash=false,scale=1}={}){const e=sprites.get(name);if(!e)return;c.save();c.globalAlpha=alpha;c.translate(x,y);c.fillStyle='#00152270';c.beginPath();c.ellipse(0,7,h*.3,16,0,0,7);c.fill();c.rotate(angle);c.scale(scale,scale);c.imageSmoothingEnabled=false;c.drawImage(flash?e.white:e.base,-e.w/e.h*h/2,-h,e.w/e.h*h,h);c.restore();}
 function ring(x,y,size,color,alpha=1){c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=7;c.shadowColor=color;c.shadowBlur=18;c.beginPath();c.ellipse(x,y,size,size*.63,0,0,7);c.stroke();c.restore();}
 function sparks(x,y,t,color,count=22){c.save();c.fillStyle=color;c.shadowColor=color;c.shadowBlur=10;for(let i=0;i<count;i++){const a=i*2.399,dist=(35+i%5*13)*t*2;c.globalAlpha=1-t;c.fillRect(x+Math.cos(a)*dist,y+Math.sin(a)*dist-t*55,5+i%3*3,5+i%3*3);}c.restore();}
 function label(text,x,y,color='#fff2b6',size=56){c.save();c.font=`900 ${size}px system-ui`;c.textAlign='center';c.lineWidth=9;c.strokeStyle='#13252e';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);c.restore();}
 function beam(x,y,toX,toY,t,color){c.save();c.strokeStyle=color;c.lineWidth=12;c.shadowColor=color;c.shadowBlur=20;c.beginPath();c.moveTo(x,y);c.lineTo(x+(toX-x)*clamp(t*2.5),y+(toY-y)*clamp(t*2.5));c.stroke();c.lineWidth=4;c.strokeStyle='#fff';c.stroke();c.restore();}
 function frame(now){if(stopped)return;raf=requestAnimationFrame(frame);if(document.hidden||now-last<25)return;last=now;onFrame?.(now);const fx=getEffect(),t=fx?clamp((now-fx.at)/fx.duration):0,impact=fx&&t>.34&&t<.9,hitEnemy=fx&&['attack','beam','burst','assist'].includes(fx.kind),hitHero=fx?.kind==='counter';
 c.save();c.drawImage(backgrounds.get(region.biome),0,0,1100,800,0,0,1100,688);const shade=c.createLinearGradient(0,0,0,688);shade.addColorStop(0,'#02142688');shade.addColorStop(.5,'#04182011');shade.addColorStop(1,'#061b2cbc');c.fillStyle=shade;c.fillRect(0,0,1100,688);
 // Slow environmental motes keep the scenery alive between turns.
 for(let i=0;i<24;i++){const x=(i*173+now*.012)%1100,y=115+(i*71)%390+Math.sin(now/1100+i)*12;c.globalAlpha=.2+(.5+.5*Math.sin(now/750+i))*.4;c.fillStyle=region.id==='harbor'?'#a3e6ff':'#deefab';c.fillRect(x,y,i%3+2,i%3+2);}c.globalAlpha=1;
 const phase=run.phase,portal=['intro','shrine','complete','review'].includes(phase),boss=run.boss&&phase==='battle';
 if(portal){const open=phase==='complete';c.save();c.shadowColor=open?'#fff0a4':'#8ddce5';c.shadowBlur=35;c.fillStyle=open?'#c9f4db99':'#26485dcc';c.fillRect(740,210,155,235);ring(818,329,95,open?'#ffe9a0':'#93d1ee',.8);c.restore();}
 if(phase==='fork'){ring(825,450,96,'#88e6f4',.65);c.fillStyle='#665035';c.fillRect(710,368,92,62);c.fillStyle='#e5bc60';c.fillRect(710,380,92,13);c.fillRect(750,370,15,56);}
 const motion=calm?0:Math.sin(t*Math.PI),idle=calm?0:Math.sin(now/650)*3;
 if(!calm&&impact&&(hitEnemy||hitHero))c.translate(Math.sin(now*.12)*4*(1-t),0);
 const dead=fx?.kind==='vanish';
 sprite('hero',270+(fx?.kind==='attack'?motion*190:hitHero?-motion*20:0),490,222,{angle:fx?.kind==='attack'?motion*.12:0,flash:!calm&&hitHero&&impact&&t<.5});
 sprite('pet',450+(fx?.kind==='burst'?motion*290:0),482+idle-(fx&&['assist','beam','burst'].includes(fx.kind)?motion*38:0),155,{angle:fx?.kind==='burst'?motion*.22:0});
 if(phase==='battle'){if(boss)ring(835,482,125,'#dc85dc',.35);sprite(enemyImage,835+(hitEnemy&&impact?Math.sin(now*.08)*12:hitHero?-motion*255:0),480,run.boss?295:235,{flash:!calm&&hitEnemy&&impact&&t<.48,alpha:dead?1-t:1,scale:dead?1-t*.25:1});}
 if(fx){const k=fx.kind;
 if(k==='attack'){
   if(weapon==='wand'||weapon==='orbit'){beam(390,325,825,355,t,'#c5afff');if(impact)ring(825,350,80*t,'#e0bdff',1-t);}
   else {c.save();c.translate(360+motion*190,340);c.rotate(-1+t*2.5);c.fillStyle='#e8f5ff';c.shadowColor='#fff4bd';c.shadowBlur=18;c.fillRect(-6,-100,13,133);c.fillStyle='#ffc766';c.fillRect(-24,30,48,10);c.restore();if(impact){c.strokeStyle='#fff4ca';c.lineWidth=16;c.beginPath();c.arc(800,330,100,-1.6+t,1.2+t);c.stroke();}}
 }
 if(k==='beam'||k==='assist'){beam(450,375,830,350,t,k==='beam'?'#aee9ff':'#ffe3a1');if(impact)ring(830,350,110*t,k==='beam'?'#aee9ff':'#ffe3a1',1-t);}
 if(k==='burst'&&impact){ring(830,370,150*t,'#ffbd77',1-t);sparks(830,360,t,'#ffdf95',32);}
 if(['guard','shield','block'].includes(k)){c.save();c.fillStyle='#93dfff35';c.strokeStyle='#b5ebff';c.lineWidth=7;c.beginPath();c.moveTo(220,275);c.lineTo(340,275);c.lineTo(350,420);c.lineTo(280,490);c.lineTo(210,420);c.closePath();c.fill();c.stroke();c.restore();}
 if(k==='heal'){ring(285,475,105,'#9effc9',1-t*.5);for(let i=0;i<7;i++){const x=205+i*27,y=470-t*180+Math.sin(i)*35;c.fillStyle='#b2ffd3';c.fillRect(x-4,y-14,8,28);c.fillRect(x-14,y-4,28,8);}}
 if(k==='counter'&&impact){c.strokeStyle='#ffa187';c.lineWidth=12;c.beginPath();c.moveTo(205,295);c.lineTo(355,450);c.moveTo(330,290);c.lineTo(220,450);c.stroke();sparks(280,365,t,'#ffb19c');}
 if(hitEnemy&&impact)sparks(830,350,t,k==='assist'?'#ffedb0':'#d2edff');
 if(k==='vanish')sparks(835,345,t,'#ffe1a0',36);
 if(fx.amount!==undefined&&t>.3)label((k==='heal'?'+':'−')+fx.amount,hitEnemy?830:285,370-t*65,k==='heal'?'#a5ffca':hitHero?'#ffb1a5':'#fff3bd');
 }
 if(run.guard)ring(270,440,110,'#9ccfff',.32);
 c.restore();
 }
 raf=requestAnimationFrame(frame);return ()=>{stopped=true;cancelAnimationFrame(raf);};
}
