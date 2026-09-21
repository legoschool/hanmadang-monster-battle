// 제2회 한마당 커뮤니티 몬스터 육성 배틀 — 설정
// 운영하면서 바꿀 값(일정, 팀, 보상 수치, 확률)은 모두 이 파일에서 고친다.

// 게임 서버(수파베이스) 주소. 수파베이스 프로젝트를 만든 뒤 Project URL을 넣는다.
// 예: 'https://abcdefghijklmnop.supabase.co'
const SUPABASE_URL = 'https://oawbzsdjkzucxlcyhgdr.supabase.co';
const isLocal = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_BASE = isLocal || !SUPABASE_URL ? '/api' : `${SUPABASE_URL}/functions/v1/api`;
export const SERVER_READY = isLocal || !!SUPABASE_URL;

export const EVENT = {
  name: '제2회 한마당',
  title: '커뮤니티 몬스터 육성 배틀',
  totalDays: 7,        // 마지막 날(7일차)에 최종 토너먼트
  startDate: null,     // 'YYYY-MM-DD'로 정하면 날짜에 맞춰 일차가 자동으로 넘어감. null이면 운영자 화면에서 넘김
};

export const TEAMS = [
  { id: 'koalbot',   community: '코알교',          monster: '코알봇',   color: '#3fb6dc', desc: '코딩과 AI 데이터를 먹고 자라는 로봇 코알라' },
  { id: 'antro',     community: 'A.N.D (앤드)',    monster: '앤트로',   color: '#f08a3c', desc: '무한한 연결을 상징하는 똑똑한 로봇 개미' },
  { id: 'monggeul',  community: '꿈키움 특수교육', monster: '몽글이',   color: '#a58be6', desc: '다채로운 꿈을 먹고 매번 다른 모양으로 변하는 슬라임' },
  { id: 'digibugi',  community: '디기수평',        monster: '디기부기', color: '#3a88cb', desc: '넓은 디지털 바다를 수평으로 꾸준히 헤엄치는 거북이' },
  { id: 'pickling',  community: '피클',            monster: '피클링',   color: '#6cbf3f', desc: '톡톡 튀는 아이디어로 무장한 상큼한 요정 몬스터' },
  { id: 'droni',     community: '드론스쿨',        monster: '드로니',   color: '#e8b21f', desc: '하늘을 날며 최신 지식을 수집하는 꼬마 비행체' },
  { id: 'owllab',    community: '지딜연구소',      monster: '아울랩',   color: '#66ae7d', desc: '새로운 교육 실험을 멈추지 않는 부엉이 박사' },
  { id: 'hongaengi', community: '홍보팀',          monster: '홍앵이',   color: '#f06b7a', desc: '좋은 소식을 누구보다 크게 외치는 앵무새' },
  { id: 'maninyang', community: '운영사무국',      monster: '매니냥',   color: '#d9a55b', desc: '행사 구석구석을 척척 챙기는 고양이 매니저' },
];

export const RULES = {
  attendanceFood: 3,              // 출석하면 기본 먹이
  quizPoints: 10,                 // 퀴즈 1문제 맞힐 때마다 포인트
  quizPerfectPremium: 1,          // 3문제 모두 맞히면 고급 먹이
  exp: { food: 10, premium: 60 }, // 먹이 1개당 팀 경험치
  booster: { multiplier: 1.5, minutes: 60 },
  balloon: { multiplier: 0.7, minutes: 60 },
  rps: { winMultiplier: 2, loseRatio: 0.5 },
  gachaCost: 30,
  coffeeStock: 20,                // 실물 커피 교환권 전체 수량
  battle: { hp: 120, hpPerLevel: 10, atk: 14, atkPerLevel: 2 },
};

// 럭키박스: 하루 1번, w는 가중치(합계 100 = 퍼센트)
export const LUCKY_BOX = [
  { w: 40, label: '먹이 1개',    reward: { food: 1 } },
  { w: 25, label: '먹이 3개',    reward: { food: 3 } },
  { w: 20, label: '포인트 10',   reward: { points: 10 } },
  { w: 10, label: '포인트 30',   reward: { points: 30 } },
  { w: 4,  label: '고급 먹이 1개', reward: { premium: 1 } },
  { w: 1,  label: '잭팟! 먹이 100개', reward: { food: 100 }, jackpot: true },
];

// 쿠폰 뽑기: 포인트로 1회
export const GACHA = [
  { w: 50, item: 'booster' },
  { w: 42, item: 'balloon' },
  { w: 8,  item: 'coffee' },
];

export const ITEMS = {
  booster: { name: '팀 경험치 부스터', icon: 'booster', desc: `1시간 동안 우리 팀이 먹이로 얻는 경험치가 1.5배` },
  balloon: { name: '물풍선 공격권',   icon: 'balloon', desc: `다른 팀 몬스터를 1시간 동안 흠뻑 적셔요. 그동안 그 팀 경험치 0.7배` },
  coffee:  { name: '커피 교환권',     icon: 'coffee',  desc: '운영사무국 확인 후 커피 기프티콘으로 바꿔 드려요' },
};

// 몬스터 성장 단계 (레벨 기준)
export const STAGES = [
  { key: 'egg',   name: '알',     minLevel: 1 },
  { key: 'baby',  name: '아기',   minLevel: 2 },
  { key: 'teen',  name: '성장기', minLevel: 5 },
  { key: 'final', name: '완전체', minLevel: 9 },
];

// 레벨 n이 되는 데 필요한 누적 경험치: Lv2 100, Lv3 300, Lv4 600, Lv5 1000 ...
export const expForLevel = (level) => 50 * (level - 1) * level;

export const spriteOf = (teamId) => `assets/monsters/${teamId}/${teamId}.png`;
export const eggOf = (teamId) => `assets/monsters/${teamId}/${teamId}_egg.png`;
export const iconOf = (name) => `assets/icons/${name}.png`;
