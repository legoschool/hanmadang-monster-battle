const sheet=new Image();
sheet.src='assets/rpg/explorer-walk.png?v=art8';
let frames=null;
sheet.onload=()=>{
 const canvas=document.createElement('canvas');canvas.width=sheet.naturalWidth;canvas.height=sheet.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(sheet,0,0);
 const cw=canvas.width/4,ch=canvas.height/4;
 frames=Array.from({length:16},(_,i)=>{
  const ox=Math.round(i%4*cw),oy=Math.round(Math.floor(i/4)*ch),w=Math.floor(cw),h=Math.floor(ch),data=ctx.getImageData(ox,oy,w,h).data;
  let l=w,t=h,r=0,b=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>80){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  return {x:ox+l,y:oy+t,w:r-l+1,h:b-t+1};
 });
};
// Four real poses in each direction; travel distance, not elapsed time, drives steps.
export function drawWalker(c,a,x,y,h,{distance=0,walking=false,direction='down'}={}){
 if(!frames){if(a)c.drawImage(a.base,x-a.w/a.h*h/2,y-h,a.w/a.h*h,h);return;}
 const row={down:0,left:1,right:2,up:3}[direction]??0;
 const col=walking?Math.floor(distance/9)%4:1,f=frames[row*4+col];
 const scale=h/Math.max(...frames.map(f=>f.h));
 c.imageSmoothingEnabled=false;
 c.drawImage(sheet,f.x,f.y,f.w,f.h,Math.round(x-f.w*scale/2),Math.round(y-f.h*scale),Math.round(f.w*scale),Math.round(f.h*scale));
}
