// 공개 가능한 원정 규칙. 정답과 보상 판정은 server/expedition.js에 둔다.
export const ZONES = [
  { id: 'code', name: '코드의 숲', topic: '코딩 기초', color: '#83d6a5', boss: 'bugbug', desc: '변수, 조건, 반복, 함수로 버그벌레의 길을 뚫어요.' },
  { id: 'vibe', name: '메이커 공방', topic: '바이브코딩', color: '#e5c58b', boss: 'glitch', desc: '요청을 나누고, 실행하고, 고치며 도구를 만들어요.' },
  { id: 'computer', name: '회로 계곡', topic: '컴퓨터 기초', color: '#7dcde0', boss: 'bugbug', desc: 'CPU부터 파일과 저장장치까지 기기 속을 탐험해요.' },
  { id: 'web', name: '연결의 항구', topic: '웹과 인터넷', color: '#92bdf4', boss: 'bubble', desc: '주소, HTML, 서버와 브라우저의 역할을 알아봐요.' },
  { id: 'history', name: '기억의 유적', topic: '디지털 역사', color: '#d4b2e8', boss: 'doppel', desc: '웹의 탄생과 컴퓨터의 발자취를 따라가요.' },
  { id: 'ai', name: '추론의 정원', topic: 'AI와 활용', color: '#efaab6', boss: 'halluci', desc: '생성형 AI의 답을 비교하고 출처를 확인해요.' },
  { id: 'safety', name: '방패의 성채', topic: '디지털 안전', color: '#a6c4db', boss: 'doppel', desc: '사칭 메시지, 비밀 키, 공유 권한을 점검해요.' },
  { id: 'data', name: '데이터 호수', topic: '데이터와 디지털 생활', color: '#99d6cd', boss: 'bubble', desc: '표, 그래프, 파일과 접근성을 읽는 눈을 길러요.' },
];
export const GEAR = [
  { id: 'blade', name: '코드 검', slot: 'weapon', level: 1, glyph: '⌁', color: '#a2f3b1', desc: '가까운 적을 넓게 베어요.' },
  { id: 'wand', name: '데이터 완드', slot: 'weapon', level: 2, glyph: '◇', color: '#91dfff', desc: '멀리 있는 적에게 지식 탄환을 날려요.' },
  { id: 'orbit', name: '루프 링', slot: 'weapon', level: 4, glyph: '◎', color: '#dac1ff', desc: '회전하는 고리로 주변 적을 공격해요.' },
  { id: 'boots', name: '탐험가 부츠', slot: 'charm', level: 2, glyph: '»', color: '#e5c58b', desc: '이동 속도 +15%' },
  { id: 'magnet', name: '비트 자석', slot: 'charm', level: 3, glyph: '∩', color: '#99d6cd', desc: '보석을 끌어오는 거리 +60' },
  { id: 'shield', name: '검증의 방패', slot: 'charm', level: 5, glyph: '▣', color: '#92bdf4', desc: '최대 체력 +35' },
  { id: 'lens', name: '디버그 렌즈', slot: 'charm', level: 7, glyph: '⊕', color: '#efaab6', desc: '공격력 +20%' },
];
export const heroLevel = (xp = 0) => Math.floor(Math.max(0, xp) / 60) + 1;
export const gearOwned = (xp = 0) => GEAR.filter(g => g.level <= heroLevel(xp));
export const zoneById = id => ZONES.find(z => z.id === id);
export const gearById = id => GEAR.find(g => g.id === id);
export const gearImage = id => `assets/gear/${id}.svg`;
export const explorerTitle = level => level>=15?'지식의 수호자':level>=7?'숙련 탐험가':level>=3?'숲길 모험가':'새싹 탐험가';
export const BOSS_TYPES = {
  bugbug:{name:'버그 군주',pattern:'charge',color:'#b9ed83',skill:'돌진 경로에서 벗어나세요!',bg:'#28432a'},
  glitch:{name:'글리치 기사',pattern:'spiral',color:'#caafff',skill:'회전 탄막 사이로 이동하세요!',bg:'#352849'},
  bubble:{name:'네트워크 크라켄',pattern:'fan',color:'#8ee8ff',skill:'부채꼴 탄막을 피하세요!',bg:'#1a424b'},
  doppel:{name:'기억의 파수꾼',pattern:'meteor',color:'#ffb392',skill:'운석 표식 밖으로 이동하세요!',bg:'#483729'},
  halluci:{name:'환영의 마법사',pattern:'spiral',color:'#ffadda',skill:'회전 탄막 사이로 이동하세요!',bg:'#432a43'},
};
