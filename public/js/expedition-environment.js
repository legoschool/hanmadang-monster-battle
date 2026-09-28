// Hand-authored regional environments. Scenery stays out of combat collision logic.
const TAU=Math.PI*2;
export const BIOMES={
 code:{base:'#0c2924',floor:'#254439',accent:'#9bcc89',label:'이끼 낀 돌길 · 반딧불 · 오래된 숲',kind:'forest'},
 vibe:{base:'#302319',floor:'#51402b',accent:'#e7be78',label:'메이커 작업대 · 톱니바퀴 · 증기 배관',kind:'workshop'},
 computer:{base:'#081c2b',floor:'#183e4c',accent:'#71d6e6',label:'회로 기판 · 냉각 코일 · 데이터 신호',kind:'circuit'},
 web:{base:'#082d3c',floor:'#204454',accent:'#9bd4ef',label:'목재 부두 · 등대 · 잔물결',kind:'harbor'},
 history:{base:'#282335',floor:'#464051',accent:'#cfb4da',label:'무너진 석주 · 기록의 문 · 고대 문양',kind:'ruins'},
 ai:{base:'#302238',floor:'#4b3e51',accent:'#f1b6d0',label:'꽃잎 정원 · 빛의 수정 · 생각의 나무',kind:'garden'},
 safety:{base:'#162c3a',floor:'#354b57',accent:'#b8d4e0',label:'방패 성벽 · 깃발 · 푸른 화로',kind:'fortress'},
 data:{base:'#0b3338',floor:'#285057',accent:'#a3e4d5',label:'수련 연못 · 갈대 · 빛나는 데이터 섬',kind:'lake'}
};
export function makeEnvironment(zone){const p=BIOMES[zone.id]||BIOMES.code,canvas=document.createElement('canvas');canvas.width=1100;canvas.height=800;const c=canvas.getContext('2d');const fill=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};const disk=(x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();};
 const g=c.createRadialGradient(550,420,20,550,420,720);g.addColorStop(0,p.floor);g.addColorStop(1,p.base);c.fillStyle=g;c.fillRect(0,0,1100,800);
 // A quiet central combat clearing, with worn paths reaching four entrances.
 c.strokeStyle=p.accent+'16';c.lineWidth=92;c.beginPath();c.moveTo(60,610);c.bezierCurveTo(380,680,660,50,1080,170);c.stroke();c.lineWidth=2;c.strokeStyle=p.accent+'22';for(let r of [180,195]){c.beginPath();c.ellipse(550,400,r*1.4,r,0,0,TAU);c.stroke();}
 for(let i=0;i<320;i++){const x=(i*173+59)%1100,y=(i*227+17)%800;fill(x,y,2+i%4,2,p.accent+(i%3?'12':'28'));}
 const tree=(x,y,s=1,blossom=false)=>{c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#031b1b80';c.beginPath();c.ellipse(16,22,48,14,0,0,TAU);c.fill();fill(-7,-39,14,65,'#504236');fill(-2,-35,4,56,'#746044');for(let i=0;i<5;i++){const a=i*2.4;disk(Math.cos(a)*24,-57+Math.sin(a)*20,29,blossom?['#77556d','#b57897','#d99fba'][i%3]:['#1c3930','#315640','#426d4a'][i%3]);}fill(-18,-85,10,5,blossom?'#efc6d044':'#a6c58a33');c.restore();};
 const rock=(x,y,s=1)=>{c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#16282e';c.beginPath();c.moveTo(-28,12);c.lineTo(-21,-14);c.lineTo(3,-25);c.lineTo(27,-9);c.lineTo(31,13);c.closePath();c.fill();c.strokeStyle=p.accent+'3c';c.lineWidth=3;c.beginPath();c.moveTo(-19,-12);c.lineTo(2,-21);c.lineTo(23,-8);c.stroke();c.restore();};
 const post=(x,y)=>{fill(x-6,y-22,12,44,'#6d5840');fill(x-9,y-26,18,7,'#b09267');disk(x,y-2,2,'#e0bf89');};
 const pillar=(x,y)=>{fill(x-25,y+30,50,13,'#26343c');fill(x-17,y-62,34,96,'#53606a');fill(x-11,y-57,7,85,p.accent+'50');fill(x-24,y-71,48,16,'#8e9191');fill(x-21,y+21,42,12,'#727d81');};
 if(p.kind==='forest'||p.kind==='garden'){
  for(let i=0;i<15;i++){tree(i*85,60+(i%3)*19,.85+(i%3)*.16,p.kind==='garden');tree(i*85,815+(i%2)*15,1.1,p.kind==='garden');}for(let i=1;i<8;i++){tree(15,i*98,1,p.kind==='garden');tree(1085,i*104,.95,p.kind==='garden');}
  for(let i=0;i<35;i++){const x=(i*181)%1050+25,y=(i*127)%720+50;if(x>160&&x<940&&y>160&&y<640)continue;fill(x,y,3,12,'#a6a878');disk(x+1,y,7,p.kind==='garden'?'#d7a1b8':'#bd795e');disk(x+3,y-2,2,'#ffe7bf');}
  for(let i=0;i<7;i++)rock(130+i*141,690+(i%2)*32,.65);if(p.kind==='forest'){fill(825,114,124,26,'#524539');disk(824,127,14,'#8a7455');disk(824,127,8,'#554433');}else{for(const [x,y]of [[180,130],[925,140],[140,650],[940,650]]){c.fillStyle='#86abac';c.beginPath();c.moveTo(x,y-40);c.lineTo(x-17,y);c.lineTo(x,y+12);c.lineTo(x+17,y);c.closePath();c.fill();disk(x,y-14,5,'#f3e8c2');}}
 }else if(p.kind==='workshop'){
  for(let y=55;y<780;y+=38){fill(40,y,1020,2,'#b7915520');for(let x=55;x<1060;x+=145)fill(x+(y%3)*16,y,2,37,'#241c2270');}
  for(const[x,y]of [[130,140],[940,120],[140,670],[930,670]]){fill(x-74,y+24,155,16,'#211e1b');fill(x-70,y-24,148,58,'#80664a');fill(x-65,y-21,138,7,'#c99e6855');fill(x-49,y-45,38,22,'#435258');fill(x+15,y-39,38,17,'#b99c73');for(let i=0;i<4;i++)fill(x+22+i*5,y-34,2,9,'#fff1b566');}
  for(let i=0;i<6;i++){const x=55+i*200,y=i%2?725:70;disk(x,y,30,'#93794e');disk(x,y,19,p.base);for(let k=0;k<8;k++){c.save();c.translate(x,y);c.rotate(k*TAU/8);fill(25,-5,14,10,'#b19967');c.restore();}}
  c.strokeStyle='#9a7857';c.lineWidth=12;c.strokeRect(23,22,1054,756);c.strokeStyle='#e0bf6d55';c.lineWidth=3;c.strokeRect(23,22,1054,756);
 }else if(p.kind==='circuit'){
  for(let i=0;i<18;i++){const x=40+i*62,y=70+(i*83)%650;c.strokeStyle='#63c9db35';c.lineWidth=2;c.beginPath();c.moveTo(x,20);c.lineTo(x,y);c.lineTo(x+35,y+35);c.lineTo(x+35,780);c.stroke();disk(x,y,5,'#8bced95c');}
  for(const[x,y]of [[160,110],[920,110],[150,690],[940,690]]){fill(x-55,y-38,110,76,'#091b29');c.strokeStyle='#6899ac';c.strokeRect(x-55,y-38,110,76);for(let i=0;i<10;i++){fill(x-48+i*10,y-45,4,7,'#a2a8a0');fill(x-48+i*10,y+38,4,7,'#a2a8a0');}c.font='bold 15px monospace';c.fillStyle='#88cddb';c.fillText('G-DEAL',x-28,y+5);}
 }else if(p.kind==='harbor'||p.kind==='lake'){
  for(let y=30;y<790;y+=28){c.strokeStyle=p.accent+'1e';c.lineWidth=2;for(let x=20;x<1100;x+=100){c.beginPath();c.ellipse(x+(y%4)*6,y,27,4,0,0,Math.PI);c.stroke();}}
  if(p.kind==='harbor'){for(const[x,y,w,h]of [[0,20,1100,104],[0,690,1100,110],[0,0,110,800],[990,0,110,800]]){fill(x,y,w,h,'#634f39');for(let a=x;a<x+w;a+=30)fill(a,y,2,h,'#322f31');}for(let i=0;i<9;i++){post(90+i*116,124);post(90+i*116,690);}for(const[x,y]of [[40,46],[1020,610],[875,730]]){fill(x,y,55,45,'#856c48');c.strokeStyle='#b49c67';c.strokeRect(x+4,y+4,47,37);c.beginPath();c.moveTo(x+4,y+4);c.lineTo(x+51,y+41);c.stroke();}}
  else{for(let i=0;i<24;i++){const x=(i*197)%1100,y=i%2?740+(i%3)*15:70+(i%3)*25;disk(x,y,19,'#41775a');c.strokeStyle='#193d42';c.beginPath();c.moveTo(x,y);c.lineTo(x+18,y-6);c.stroke();if(i%3===0)disk(x,y-3,6,'#e5b6bb');}for(let i=0;i<40;i++){const x=i%2?1050+(i%4)*10:20+(i%4)*10,y=(i*131)%800;c.strokeStyle='#749b70';c.beginPath();c.moveTo(x,y);c.lineTo(x-10,y-40);c.moveTo(x,y);c.lineTo(x+7,y-54);c.stroke();}}
 }else{
  for(let y=25;y<800;y+=58)for(let x=20;x<1100;x+=92){c.strokeStyle=p.accent+'13';c.strokeRect(x+(y%3)*10,y,86,52);}
  for(const[x,y]of [[125,145],[320,85],[800,85],[975,145],[125,720],[975,720]])pillar(x,y);
  if(p.kind==='fortress'){for(let x=0;x<1100;x+=55){fill(x,0,49,45,'#243747');fill(x,773,49,27,'#314956');}for(const x of [70,1015]){fill(x,225,6,230,'#7a8b90');fill(x+6,230,49,96,'#627e9d');c.fillStyle='#d3e1dc';c.beginPath();c.moveTo(x+18,255);c.lineTo(x+45,255);c.lineTo(x+45,275);c.lineTo(x+31,290);c.lineTo(x+18,275);c.closePath();c.fill();}}
  else{for(let i=0;i<18;i++)rock((i*151)%1100,i%2?720:100,.7+(i%3)*.2);c.strokeStyle='#cab4db50';c.lineWidth=6;c.beginPath();c.arc(550,82,92,Math.PI,TAU);c.stroke();for(let i=0;i<12;i++){c.font='15px monospace';c.fillStyle=p.accent+'55';c.fillText(['01','{}','<>','∑'][i%4],100+i*78,i%2?755:52);}}
 }
 // Layered surface detail, readable walkable ground and small regional props.
 const line=(x,y,x2,y2,col,w=1)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();};
 if(p.kind==='harbor'){
   c.fillStyle='#334548';c.beginPath();c.roundRect(190,145,720,510,45);c.fill();
   for(let y=160;y<644;y+=26){fill(205,y,690,24,y%3?'#675b45':'#706149');line(205,y,895,y,'#a8956830');for(let x=220;x<885;x+=120){fill(x,y+8,2,2,'#b6a783');line(x+12,y+4,x+70,y+5,'#342f2929');}}
   for(let x=190;x<920;x+=120){post(x,143);post(x,655);}for(const[x,y]of [[220,177],[875,630]]){c.strokeStyle='#b6ab80';c.lineWidth=3;c.beginPath();c.arc(x,y,18,0,TAU);c.arc(x,y,12,0,TAU);c.arc(x,y,6,0,TAU);c.stroke();}
 }else if(p.kind==='lake'){
   c.fillStyle='#476659';c.beginPath();c.ellipse(550,412,405,292,0,0,TAU);c.fill();c.strokeStyle='#93ac8044';c.lineWidth=12;c.stroke();
   for(let i=0;i<140;i++){const a=i*2.39996,r=40+((i*97)%340),x=550+Math.cos(a)*r,y=412+Math.sin(a)*r*.7;fill(x,y,4+i%8,2,'#bed3a422');}
   c.strokeStyle='#80b7b340';c.lineWidth=3;for(let i=0;i<3;i++){c.beginPath();c.ellipse(550,412,150+i*12,105+i*8,0,0,TAU);c.stroke();}
   for(let i=0;i<8;i++){const a=i*TAU/8,x=550+Math.cos(a)*366,y=412+Math.sin(a)*250;rock(x,y,.65);fill(x-9,y-17,18,6,p.accent+'77');}
 }
 if(['forest','garden','ruins','fortress'].includes(p.kind)){
   for(let i=0;i<80;i++){const x=90+(i*113)%920,y=150+(i*179)%540;if(Math.abs(y-(650-x*.5))>95)continue;c.fillStyle=p.accent+(i%3?'10':'18');c.beginPath();c.moveTo(x-20,y);c.lineTo(x-7,y-13);c.lineTo(x+20,y-8);c.lineTo(x+25,y+8);c.lineTo(x+1,y+13);c.closePath();c.fill();line(x-6,y-10,x-2,y+2,p.base+'88');}
 }
 if(['forest','garden','lake'].includes(p.kind)){
   for(let i=0;i<120;i++){const x=40+(i*83)%1020,y=60+(i*137)%700;if(x>250&&x<850&&y>200&&y<600&&i%5)continue;const color=i%3?'#6f916244':'#b2c48a44';line(x,y,x-3,y-6,color);line(x,y,x+4,y-9,color);line(x,y,x+1,y-11,color);if(i%8===0){disk(x+3,y-10,2,p.kind==='garden'?'#e5c7db':'#c9c889');}}
   for(let i=0;i<15;i++){const x=i*85,y=60+(i%3)*19;for(let j=0;j<10;j++){const a=j*2.4;disk(x+Math.cos(a)*21,y-65+Math.sin(a)*17,3,p.kind==='garden'?'#f7c5df30':'#b5d59a28');}line(x+2,y-27,x+2,y+17,'#b5a07230',2);}
 }
 if(p.kind==='workshop'){
  for(const[x,y]of [[130,140],[940,120],[140,670],[930,670]]){fill(x-58,y+40,9,19,'#3c322a');fill(x+59,y+40,9,19,'#3c322a');for(let j=0;j<4;j++){disk(x-46+j*29,y+23,2,'#d5c099');}line(x-15,y-17,x+8,y+7,'#a2a393',5);fill(x-24,y-23,24,9,'#b3b0a1');c.strokeStyle='#dcc79a55';c.strokeRect(x+31,y-12,25,19);line(x+36,y-9,x+51,y+2,'#86b5b1');}
 }else if(p.kind==='circuit'){
  for(let i=0;i<24;i++){const x=i%2?1030:60,y=80+(i*53)%650;fill(x-10,y,20,33,'#395062');fill(x-8,y+2,16,5,'#96bbbd');fill(x-7,y+9,3,19,'#648f99');line(x,y+33,x,y+43,'#c5cbbb',2);}
  c.font='12px monospace';for(let i=0;i<14;i++){c.fillStyle=p.accent+'33';c.fillText(i%2?'0101':'1010',110+i*69,90+(i%3)*17);}
 }else if(p.kind==='ruins'){
  for(const[x,y]of [[125,145],[320,85],[800,85],[975,145],[125,720],[975,720]]){line(x-8,y-55,x+3,y-23,'#26333d',2);line(x+3,y-23,x-5,y+14,'#26333d',2);disk(x-19,y+31,5,'#7e80764f');}
 }
 // Pools of lantern light at the clearing corners help frame the combat space.
 for(const[x,y]of [[220,170],[880,170],[220,640],[880,640]]){
  const glow=c.createRadialGradient(x,y,1,x,y,60);glow.addColorStop(0,p.accent+'22');glow.addColorStop(1,p.accent+'00');c.fillStyle=glow;c.fillRect(x-60,y-60,120,120);fill(x-6,y-4,12,13,p.base);fill(x-3,y-9,6,8,p.accent+'a0');fill(x-8,y-12,16,3,p.accent+'66');
 }
 return canvas;
}
export function drawAtmosphere(c,zone,clock,calm,low){if(calm)return;const p=BIOMES[zone.id]||BIOMES.code,n=low?10:25;c.save();for(let i=0;i<n;i++){const x=(i*173+clock*(p.kind==='garden'?13:5))%1100,y=(i*137+Math.sin(clock*.7+i)*18)%800;c.globalAlpha=.16+Math.sin(clock+i)*.08;c.fillStyle=p.accent;if(['harbor','lake'].includes(p.kind)){c.strokeStyle=p.accent;c.lineWidth=1;c.beginPath();c.ellipse(x,y,12+(clock+i)%4*7,3,0,0,TAU);c.stroke();}else if(p.kind==='workshop'){c.beginPath();c.arc(x,y-clock%5*8,5+(i%3),0,TAU);c.fill();}else{c.beginPath();c.ellipse(x,y,p.kind==='garden'?4:2,2,clock*.4,0,TAU);c.fill();}}c.restore();}
