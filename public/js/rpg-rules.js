export const REGIONS=[
 {id:'forest',name:'안개 숲길',biome:'code',enemy:'bugbug',boss:'glitch',color:'#9ed3a5',intro:'한마당으로 향하는 길이 끊겼다. 안내소에서 보낸 지도 조각을 찾아 숲의 관문을 열어야 한다.',goal:'숲의 관문 열기',ending:'관문이 열렸다. 지도 조각이 가리키는 다음 장소는 배가 멈춘 항구다.',loot:'wand'},
 {id:'harbor',name:'잠든 항구',biome:'web',enemy:'bubble',boss:'doppel',color:'#96cde5',intro:'항구의 등대가 꺼졌다. 부두를 지나는 적을 물리치고 등대의 기록을 찾아야 한다.',goal:'등대 기록 회수',ending:'등대가 다시 켜졌다. 마지막 기록을 실은 배가 성채로 향했던 흔적이 드러났다.',loot:'shield'},
 {id:'citadel',name:'기록의 성채',biome:'safety',enemy:'halluci',boss:'glitch',color:'#d6b3e8',intro:'성채의 파수꾼이 기록실을 봉인했다. 동행 펫과 함께 마지막 관문을 돌파해야 한다.',goal:'기록실 봉인 해제',ending:'세 지역의 기록이 한곳에 모였다. 한마당으로 돌아가는 길이 열렸다. 다른 장비로 지역을 다시 탐험할 수 있다.',loot:'orbit'}
];
export const EQUIPMENT={blade:{name:'탐험 검',slot:'weapon',attack:3,defense:0,image:'blade'},wand:{name:'항로 지팡이',slot:'weapon',attack:7,defense:0,image:'wand'},shield:{name:'기록 방패',slot:'armor',attack:0,defense:3,image:'shield'},orbit:{name:'수호의 고리',slot:'weapon',attack:11,defense:0,image:'orbit'}};
export const PET_ROLES={koalbot:'beam',antro:'burst',monggeul:'heal',digibugi:'guard',pickling:'burst',droni:'burst',owllab:'burst',hongaengi:'guard',maninyang:'beam',h2o:'heal'};
export const PET_NAMES={beam:'집중 공격',burst:'강타',heal:'회복',guard:'보호막'};
export const levelOf=xp=>Math.min(20,1+Math.floor(xp/80));
export function fresh(){return {revision:0,xp:0,bond:0,owned:['blade'],weapon:'blade',armor:null,cleared:[],run:null};}
export function stats(p){const level=levelOf(p.xp);return {level,hp:100+level*10,attack:14+level*2+EQUIPMENT[p.weapon].attack,defense:2+(p.armor?EQUIPMENT[p.armor].defense:0),pet:5+Math.min(5,Math.floor(p.bond/3))};}
export function startAdventure(p,region,pet){if(!Number.isInteger(region)||region<0||region>=REGIONS.length||region>0&&!p.cleared.includes(region-1))throw Error('앞 지역을 먼저 완료해주세요.');const st=stats(p);p.run={region,phase:'intro',node:0,hp:st.hp,maxHp:st.hp,potions:3,charge:50,pet:PET_ROLES[pet]?pet:'koalbot',turn:0,log:[],guard:0,paid:0,bonus:0};}
const log=(r,t)=>{r.log.push(t);r.log=r.log.slice(-6);};
function battle(p,boss=false){const r=p.run,region=REGIONS[r.region];r.phase='battle';r.boss=boss;r.turn=0;r.enemy={name:boss?['숲의 문지기','등대 파수꾼','기록 수호자'][r.region]:['길 잃은 버그','항구의 그림자','환영 정찰병'][r.region],image:boss?region.boss:region.enemy,hp:(boss?112:53)+r.region*24+levelOf(p.xp)*4,maxHp:(boss?112:53)+r.region*24+levelOf(p.xp)*4,intent:'attack'};r.log=[];log(r,boss?'보스 전투 시작':'전투 시작');}
export function travel(p,action){const r=p.run;if(!r)throw Error('지역을 선택해주세요.');
 if(r.phase==='intro'&&action==='go'){r.node=1;battle(p);return;}
 if(r.phase==='victory'&&action==='go'){if(r.node===1){r.node=2;r.phase='fork';}else if(r.node===3){r.node=4;r.phase='shrine';}return;}
 if(r.phase==='fork'&&['rest','chest'].includes(action)){if(action==='rest'){r.hp=r.maxHp;r.choice='샘에서 체력을 모두 회복했다.';}else{r.potions=Math.min(5,r.potions+2);r.choice='상자에서 회복약 2개를 얻었다.';}r.node=3;battle(p);log(r,r.choice);return;}
 if(['shrine','review'].includes(r.phase)&&action==='go'){r.node=5;battle(p,true);return;}
 throw Error('현재 화면의 선택지를 눌러주세요.');}
export function fight(p,action){const r=p.run;if(r?.phase!=='battle')throw Error('전투 중에만 사용할 수 있어요.');if(!['attack','guard','pet','potion'].includes(action))throw Error('행동을 선택해주세요.');if(action==='pet'&&r.charge<100)throw Error('펫 게이지가 부족해요.');if(action==='potion'&&r.potions<=0)throw Error('회복약이 없어요.');const st=stats(p),e=r.enemy;let dmg=0,blocked=action==='guard';r.lastAction=action;r.turn++;
 if(action==='attack'){dmg=st.attack;log(r,'공격 · '+dmg+' 피해');}
 if(action==='guard'){r.charge=Math.min(100,r.charge+16);log(r,'방어 · 이번 공격 피해 감소');}
 if(action==='potion'){r.potions--;const healed=Math.min(45,r.maxHp-r.hp);r.hp+=healed;log(r,'회복약 · 체력 +'+healed);}
 if(action==='pet'){r.charge=0;const role=PET_ROLES[r.pet];if(role==='heal'){const h=Math.min(42,r.maxHp-r.hp);r.hp+=h;log(r,'펫 회복 · 체력 +'+h);}else if(role==='guard'){r.guard=3;log(r,'펫 보호막 · 3턴 피해 감소');}else{dmg=st.attack+20;log(r,'펫 기술 · '+dmg+' 피해');}}
 if(e.intent==='guard')dmg=Math.ceil(dmg*.55);e.hp=Math.max(0,e.hp-dmg-st.pet);log(r,'펫 보조 공격 · '+st.pet+' 피해');r.charge=Math.min(100,r.charge+27);
 if(e.hp<=0){p.xp+=r.boss?40:20;p.bond++;r.phase=r.boss?'complete':'victory';r.gained=r.boss?40:20;if(r.boss){if(!p.cleared.includes(r.region))p.cleared.push(r.region);const loot=REGIONS[r.region].loot;r.newLoot=!p.owned.includes(loot);if(r.newLoot)p.owned.push(loot);r.loot=loot;}log(r,'전투 승리');return;}
 let hit=Math.max(1,(e.intent==='heavy'?27:e.intent==='guard'?0:13)+r.region*4-st.defense);if(e.intent==='guard')hit=0;if(blocked)hit=Math.ceil(hit*.25);if(r.guard>0){hit=Math.ceil(hit*.5);r.guard--;}r.hp=Math.max(0,r.hp-hit);log(r,e.intent==='guard'?'상대가 방어했다.':'상대 공격 · '+hit+' 피해');if(r.hp<=0){r.phase='defeated';log(r,'탐험 중단 · 얻은 경험치 유지');return;}e.intent=r.turn%3===1?'heavy':r.turn%3===2?'guard':'attack';}
export function equip(p,id){const item=EQUIPMENT[id];if(!item||!p.owned.includes(id))throw Error('보유하지 않은 장비예요.');if(p.run&&!['complete','defeated'].includes(p.run.phase))throw Error('탐험을 마친 뒤 장비를 바꿀 수 있어요.');p[item.slot]=id;}
