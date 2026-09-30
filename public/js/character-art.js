const cache=new Map();
const pets=['koalbot','antro','monggeul','digibugi','pickling','droni','owllab','hongaengi','maninyang','h2o'];
const bosses=['bugbug','doppel','halluci','bubble','glitch','archive-wraith'];
const specs=[{file:'avatars',cols:4,rows:5,keys:Array.from({length:20},(_,i)=>'avatar:a'+String(i+1).padStart(2,'0'))},{file:'pets',cols:5,rows:2,keys:pets.map(x=>'pet:'+x)},{file:'bosses',cols:3,rows:2,keys:bosses.map(x=>'boss:'+x)}];
function keyOf(src){const path=String(src).split('?')[0];if(path.endsWith('assets/monsters/boss/boss.png'))return 'boss:glitch';let m=path.match(/assets\/avatars\/(a\d{2})\.png$/);if(m)return 'avatar:'+m[1];m=path.match(/assets\/monsters\/([^/]+)\/[^/]+\.png$/);if(m&&pets.includes(m[1]))return 'pet:'+m[1];m=path.match(/assets\/bosses\/([^/]+)\.(png|svg)$/);if(m&&bosses.includes(m[1]))return 'boss:'+m[1];return null;}
async function atlas(spec){const image=new Image();image.src=`assets/cast/${spec.file}.png?v=cast9`;await image.decode();const cw=image.naturalWidth/spec.cols,ch=image.naturalHeight/spec.rows;
 for(let i=0;i<spec.keys.length;i++){const tile=document.createElement('canvas');tile.width=Math.floor(cw);tile.height=Math.floor(ch);const c=tile.getContext('2d',{willReadFrequently:true});c.drawImage(image,Math.round(i%spec.cols*cw),Math.round(Math.floor(i/spec.cols)*ch),Math.floor(cw),Math.floor(ch),0,0,tile.width,tile.height);const d=c.getImageData(0,0,tile.width,tile.height).data;let l=tile.width,t=tile.height,r=0,b=0;for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++)if(d[(y*tile.width+x)*4+3]>40){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<l)continue;const out=document.createElement('canvas');out.width=r-l+5;out.height=b-t+5;out.getContext('2d').drawImage(tile,l,t,r-l+1,b-t+1,2,2,r-l+1,b-t+1);cache.set(spec.keys[i],out.toDataURL('image/png'));}
}
export const artReady=Promise.all(specs.map(s=>atlas(s).catch(e=>console.warn('Character artwork unavailable:',s.file,e.message))));
export const artSource=src=>cache.get(keyOf(src))||src;
export function loadArtImage(image,src){if(!keyOf(src)){image.src=src;return;}artReady.then(()=>{image.src=artSource(src);});}
export const artCount=()=>cache.size;
artReady.then(()=>{
 function update(image){const src=image.getAttribute('src'),next=artSource(src);if(src&&next!==src){image.dataset.characterSource=src;image.src=next;}}
 function scan(node){if(node.nodeType!==1)return;if(node.tagName==='IMG')update(node);node.querySelectorAll?.('img').forEach(update);}
 scan(document.documentElement);new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')update(r.target);else r.addedNodes.forEach(scan);}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
});
