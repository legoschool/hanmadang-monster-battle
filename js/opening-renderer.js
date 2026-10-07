const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),ease=x=>1-Math.pow(1-clamp(x),3);
export class OpeningRenderer{
 constructor(canvas,art){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.art=art;this.lastClock=0;}
 actor(im,x,y,size,angle=0,alpha=1){const c=this.c;if(!im.naturalWidth)return;c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;c.imageSmoothingEnabled=false;const w=size*im.naturalWidth/im.naturalHeight;c.drawImage(im,-w/2,-size,w,size);c.restore();}
 glow(x,y,r,color,strength=.6){const c=this.c;c.save();c.globalCompositeOperation='lighter';const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#00000000');c.globalAlpha=strength;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
 ring(x,y,r,color,width=3){const c=this.c;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(1,r),0,TAU);c.stroke();}
 draw(scene,time,duration,clock,{calm=false,paused=false}={}){
  if(paused)clock=this.lastClock;else this.lastClock=clock;
  const c=this.c,box=this.canvas.getBoundingClientRect(),w=box.width,h=box.height,dpr=Math.min(devicePixelRatio||1,1.5);
  if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}
  c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#071422';c.fillRect(0,0,w,h);
  const small=w<650,p=clamp(time/duration),t=calm?2:time,bob=calm?0:Math.sin(clock*2)*4,ground=h*(small?.59:.68),size=Math.min(h*.36,small?230:355),cx=w/2,cy=h*.39;
  const {background,hero,pet,boss}=this.art;
  if(background.naturalWidth){const sw=background.naturalWidth/3,source=scene===5?0:2,sh=background.naturalHeight,scale=Math.max(w/sw,h/sh)*(calm?1.04:1.05+p*.12),dw=sw*scale,dh=sh*scale;c.drawImage(background,source*sw,0,sw,sh,(w-dw)/2+(calm?0:Math.sin(clock*.3)*12),(h-dh)/2,dw,dh);}
  c.fillStyle=scene===1?'#130719aa':scene===3?'#170c1baa':'#06142477';c.fillRect(0,0,w,h);
  const active=scene<0?1:scene,color=active===1?'#d96eff':active===5?'#8dffd1':'#68d8ff';
  this.glow(cx,cy,Math.min(w*.55,h*.5),color,.27);c.save();c.translate(cx,cy);c.rotate(calm?0:clock*.12);
  for(let k=0;k<3;k++){c.setLineDash(k===1?[18,13]:[]);this.ring(0,0,size*(.57+k*.14),color+(k===1?'aa':'44'),k===1?3:1);}c.restore();
  if(active===0||active===1||scene<0)for(let i=0;i<(small?12:22);i++){const a=i*2.399+(calm?0:clock*.09),r=size*(.5+(i%5)*.13)*(active===1?1-clamp(p*.65):1),x=cx+Math.cos(a)*r*(small?.9:1.6),y=cy+Math.sin(a)*r*.65;c.save();c.translate(x,y);c.rotate(calm?0:a*.3);c.fillStyle=active===1?'#bc6de888':'#72cebc99';c.strokeStyle=active===1?'#f096ff':'#b6fff1';c.lineWidth=1;c.fillRect(-12,-16,24,32);c.strokeRect(-12,-16,24,32);c.fillStyle='#ffffffaa';c.fillRect(-7,-7,14,2);c.fillRect(-7,0,10,2);c.restore();}
  if(scene<0){this.actor(boss,w*.68,ground-size*.04,size*1.1,0,.75);this.actor(hero,w*.3,ground,size*.79);this.actor(pet,w*.48,ground+10+bob,size*.5);}
  if(scene===0){this.actor(hero,w*.38,ground,size*.76);this.actor(pet,w*.62,ground+bob,size*.48);const sweep=calm?cy:((time*.25)%1)*h;c.fillStyle='#70ffc31c';c.fillRect(0,sweep,w,2);}
  if(scene===1){this.actor(boss,cx,ground+size*.07,size*(.95+ease(t/1.5)*.24));if(!calm)for(let i=0;i<11;i++){const y=(i*97+clock*35)%h;c.fillStyle=i%2?'#d861ee22':'#ef779622';c.fillRect(Math.sin(i+clock)*w*.15,y,w,2+i%3);}this.glow(cx,ground-size*.55,size*.38,'#ec83ff',.5);}
  if(scene===2){this.actor(hero,w*.29,ground,size*.73);this.actor(pet,w*(.95-(calm?1:ease(t/1.2))*.34),ground-size*.06+bob,size*.8);const px=w*.61,py=ground-size*.4;this.glow(px,py,size*.58,'#70ffe0',.25);this.ring(px,py,size*.5,'#b0fff6aa',3);for(let i=0;i<7;i++){const a=i*TAU/7+(calm?0:clock*.6);this.glow(px+Math.cos(a)*size*.5,py+Math.sin(a)*size*.5,14,'#dcfff4',.8);}}
  if(scene===3){const cycle=calm?.58:(time%3.2)/3.2,dash=ease(clamp((cycle-.12)/.22)),back=ease(clamp((cycle-.6)/.3)),hx=w*(.22+dash*.28-back*.28),hy=ground;this.actor(boss,w*.74,ground,size*1.02,calm?0:Math.sin(cycle*TAU)*.015);this.actor(pet,w*.2,ground-size*.02+bob,size*.43);if(!calm&&dash>0&&back<.2)for(let i=1;i<5;i++)this.actor(hero,hx-i*w*.055,hy,size*.8,-.06,.12*(5-i));this.actor(hero,hx,hy,size*.8,calm?0:-.06*dash);
   if(cycle>.3&&cycle<.7){const alpha=Math.sin((cycle-.3)/.4*Math.PI);c.save();c.globalCompositeOperation='lighter';c.translate(w*.63,ground-size*.48);c.rotate(-.55);c.globalAlpha=alpha;c.fillStyle='#fff3ba';c.beginPath();c.ellipse(0,0,size*.75,size*.035,0,0,TAU);c.fill();c.fillStyle='#ffc35f';c.beginPath();c.ellipse(0,0,size*.035,size*.48,0,0,TAU);c.fill();c.restore();this.glow(w*.65,ground-size*.48,size*.6,'#ffda7e',alpha*.65);}for(let i=0;i<9;i++){const a=i*TAU/9,r=size*(calm?.3:((cycle+.2)%1)*.8);this.glow(w*.66+Math.cos(a)*r,ground-size*.46+Math.sin(a)*r*.6,6,'#ffd385',.9);}}
  if(scene===4){this.actor(hero,w*.28,ground,size*.72);this.actor(pet,w*.72,ground+bob,size*.5);const py=cy+size*.12;c.save();c.translate(cx,py);c.rotate(calm?0:Math.sin(clock)*.04);c.fillStyle='#f1e5ba';c.fillRect(-size*.23,-size*.28,size*.46,size*.5);c.strokeStyle='#83e8c4';c.lineWidth=4;c.strokeRect(-size*.23,-size*.28,size*.46,size*.5);c.fillStyle='#34765f';c.font=`900 ${size*.23}px system-ui`;c.textAlign='center';c.fillText('?',0,size*.04);c.restore();this.glow(cx,py,size*.53,'#93ffcf',.17);}
  if(scene===5){const fly=calm?0:clamp((p-.55)/.45),s=size*(1-fly*.45);this.glow(cx,cy,size*1.1,'#77e8b6',.65);this.ring(cx,cy,size*.78,'#e4ffdb',5);this.actor(hero,w*(.38+fly*.1),ground-fly*size*.5,s*.8,-fly*.1);this.actor(pet,w*(.65-fly*.1),ground-fly*size*.48+bob,s*.5);if(!calm)for(let i=0;i<26;i++){const a=i*TAU/26,r=size*(.8+(clock*.6+i*.07)%1);c.strokeStyle='#b5ffe955';c.lineWidth=2;c.beginPath();c.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);c.lineTo(cx+Math.cos(a)*(r+40),cy+Math.sin(a)*(r+40));c.stroke();}}
  const shade=c.createLinearGradient(0,h*.35,0,h);shade.addColorStop(0,'#04101800');shade.addColorStop(.48,'#04101866');shade.addColorStop(1,'#041018');c.fillStyle=shade;c.fillRect(0,0,w,h);
  if(scene>=0&&!calm&&time<.5){c.fillStyle=`rgba(3,9,18,${(1-time/.5)*.8})`;c.fillRect(0,0,w,h);}
 }
}
