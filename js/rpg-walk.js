// Alternate planted and lifted feet while keeping the avatar silhouette connected.
export function drawWalker(c,a,x,y,h,{phase=0,walking=false,facing=1,calm=false}={}){
 const w=a.w/a.h*h;
 c.save();c.translate(x,y);c.scale(facing,1);c.imageSmoothingEnabled=false;
 if(!walking||calm){c.drawImage(a.base,-w/2,-h,w,h);c.restore();return;}
 const step=Math.sin(phase),bob=Math.abs(Math.sin(phase*2))*h*.012;
 const hip=Math.floor(a.h*.79),half=Math.floor(a.w/2),legH=h*(a.h-hip)/a.h;
 // Draw legs behind the intact upper body; overlap at the hips prevents seams.
 for(const side of [-1,1]){
  const stride=step*side,lift=Math.max(0,stride)*h*.065;
  const sx=side<0?0:half,sw=side<0?half:a.w-half;
  c.drawImage(a.base,sx,hip,sw,a.h-hip,-w/2+w*sx/a.w+stride*h*.022,-legH-bob-2,w*sw/a.w,legH-lift+2);
 }
 c.drawImage(a.base,0,0,a.w,hip+1,-w/2,-h-bob,w,h*(hip+1)/a.h);
 c.restore();
}
