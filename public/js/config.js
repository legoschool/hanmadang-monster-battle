// 제2회 한마당 지딜 몬스터 원정대 — 설정
// 운영하면서 바꿀 값(일정, 팀, 보상 수치, 확률)은 모두 이 파일에서 고친다.

// 게임 서버(수파베이스) 주소. 수파베이스 프로젝트를 만든 뒤 Project URL을 넣는다.
// 예: 'https://abcdefghijklmnop.supabase.co'
const SUPABASE_URL = 'https://oawbzsdjkzucxlcyhgdr.supabase.co';
const isLocal = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_BASE = isLocal || !SUPABASE_URL ? '/api' : `${SUPABASE_URL}/functions/v1/api`;
export const SERVER_READY = isLocal || !!SUPABASE_URL;

// 일정: 현장 모임 전 4주 동안 1주일씩 원정을 떠나고, 현장 모임 날 다 함께 최종 결전을 한다.
// 시즌 시작일은 현장 모임일에서 거꾸로 계산한다 (12월 19일 - 4주 = 11월 21일 토요일).
// 날짜가 되면 주차가 자동으로 넘어가고, 운영자 화면에서 앞당겨 넘길 수도 있다.
export const EVENT = {
  name: '제2회 한마당',
  title: '지딜 몬스터 원정대',
  slogan: '우리는 모두 지딜!',
  eventDate: '2026-12-19', // 현장 모임 · 최종 결전
  weeks: 4,                // 사전 참여 주 수
};

// 진행 속도: 운영자 화면에서 고른다. 실제 일정은 1주일(11/21 시작, 매주 토요일 0시).
// 나머지는 미리 해 보기용 — 고른 시간마다 새 회차(퀴즈·보스·횟수 제한)가 열린다.
const HOUR = 3600 * 1000;
export const PACES = {
  week:  { label: '1주일', ms: 7 * 24 * HOUR, round: '주차', now: '이번 주', next: '다음 주', prev: '지난주', per: '한 주에', once: '1주일에 한 번', series: '주간' },
  day:   { label: '1일',   ms: 24 * HOUR, round: '일차', now: '오늘', next: '내일', prev: '어제', per: '하루에', once: '하루에 한 번', series: '편' },
  hour:  { label: '1시간', ms: HOUR, round: '회차', now: '이번 회차', next: '다음 회차', prev: '지난 회차', per: '한 회차에', once: '1시간에 한 번', series: '편' },
  min30: { label: '30분',  ms: HOUR / 2, round: '회차', now: '이번 회차', next: '다음 회차', prev: '지난 회차', per: '한 회차에', once: '30분에 한 번', series: '편' },
  min10: { label: '10분',  ms: HOUR / 6, round: '회차', now: '이번 회차', next: '다음 회차', prev: '지난 회차', per: '한 회차에', once: '10분에 한 번', series: '편' },
};

// 9개 커뮤니티는 경쟁 상대가 아니라 한 원정대다.
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

// 매주 나타나는 보스 (그 주 퀴즈 주제와 짝을 이룬다) — 물리치면 봉인 조각 1개
export const BOSSES = [
  { week: 1, id: 'bugbug',  name: '버그벌레', color: '#7cb342', title: '오류를 퍼뜨리는 벌레',
    desc: '컴퓨터 속에 숨어 오류를 일으켜요. 1947년 하버드 컴퓨터 속에서 진짜 나방이 나와 “첫 진짜 버그”로 기록됐대요.' },
  { week: 2, id: 'doppel',  name: '도플갱어', color: '#8b6fd6', title: '누구든 흉내 내는 가짜쟁이',
    desc: '딥페이크로 얼굴과 목소리를 똑같이 흉내 내요. 진짜와 가짜를 가려내는 눈에 약해요.' },
  { week: 3, id: 'halluci', name: '할루시',   color: '#f06ba8', title: '그럴듯한 거짓말 요괴',
    desc: 'AI가 없는 사실을 지어내는 “환각(할루시네이션)”의 화신이에요. 출처를 확인하는 습관에 약해요.' },
  { week: 4, id: 'bubble',  name: '필터버블', color: '#3fb6dc', title: '보고 싶은 것만 보여 주는 거품 괴물',
    desc: '알고리즘 거품 속에 사람들을 가둬요. 서로 다른 생각이 모이면 거품이 터져요.' },
];
export const FINAL_BOSS = {
  id: 'glitch', name: '대마왕 글리치', color: '#5b3fa8', title: '디지털 혼란의 근원',
  desc: '네 부하를 보내 세상을 어지럽힌 대마왕이에요. 원정대가 모은 봉인 조각이 많을수록 약해져요.',
};

// 참가자가 고르는 아바타 (활동하면 보스 전투 장면과 소식에 이 아바타가 나온다)
export const AVATARS = [
  { id: 'a01', name: '단발 탐험가' }, { id: 'a02', name: '안경 박사' }, { id: 'a03', name: '포니테일' },
  { id: 'a04', name: '곱슬머리' }, { id: 'a05', name: '빨간 모자' }, { id: 'a06', name: '털모자' },
  { id: 'a07', name: '수염 선생님' }, { id: 'a08', name: '양갈래' }, { id: 'a09', name: '헤드셋' },
  { id: 'a10', name: '긴 머리' }, { id: 'a11', name: '올림머리' }, { id: 'a12', name: '머리띠' },
  { id: 'a13', name: '밀짚모자' }, { id: 'a14', name: '은발 선생님' }, { id: 'a15', name: '뽀글 파마' },
  { id: 'a16', name: '넥타이' }, { id: 'a17', name: '로봇 대원' }, { id: 'a18', name: '고양이 후드' },
  { id: 'a19', name: '공룡 후드' }, { id: 'a20', name: '우주 비행사' },
];

export const RULES = {
  weeklyVisitFood: 5,             // 그 주에 처음 들어오면 먹이
  quizPoints: 10,                 // 퀴즈 1문제 맞힐 때마다 포인트
  quizPerfectPremium: 2,          // 그 주 문제를 모두 맞히면 고급 먹이
  luckyPerWeek: 3,                // 럭키박스: 한 주에 몇 번
  rpsPerWeek: 2,                  // 보스 가위바위보: 한 주에 몇 번 (비기면 안 셈)
  golden: { multiplier: 2, minutes: 30 },  // 운영자가 켜는 골든타임: 먹이 경험치(=보스 피해) 2배
  exp: { food: 10, premium: 60 }, // 먹이 1개당 팀 경험치 (얻은 경험치만큼 보스에게 피해)
  booster: { multiplier: 1.5, minutes: 60 },  // 우리 팀에 쓰는 부스터
  cheer: { multiplier: 1.3, minutes: 60 },    // 다른 팀에 보내는 응원 풍선
  rps: { winMultiplier: 2, loseRatio: 0.5 },
  gachaCost: 30,
  coffeeStock: 20,                // 실물 커피 교환권 전체 수량

  // 주간 보스: 체력 = 팀 몫의 합. 팀 몫 = perMember × 팀원 수 (원정대 전체 인원에 맞춰 커진다)
  // 한 사람이 한 주에 보통 300~450 피해를 주므로, 팀원 40% 정도가 참여하면 쓰러지는 수준이다.
  boss: {
    perMember: 150, minHp: 1000,
    minHpTest: 200,               // 미리 해 보기 속도에서는 혼자서도 쓰러뜨려 볼 수 있게 낮춘다
    quizDamage: 30,               // 퀴즈 정답 1개 = 지식 공격
    rpsWinDamage: 50,             // 보스 가위바위보 승리
    defeatReward: { premium: 1, points: 30 },   // 격파하면 그 주 참여자 모두
  },
  teamShare: { rewardPremium: 1, rewardPoints: 20 }, // 우리 팀 몫을 채우면 그 주 참여 팀원 모두 (주가 끝날 때)
  friend: { giftCapPerWeek: 5 },  // 다른 팀에게 준 선물을 우정 점수로 세는 한도 (한 사람, 한 주)
  awards: { mvpPremium: 1, friendPoints: 20, joinPoints: 20, joinMinMembers: 3 },

  // 12/19 현장 최종 결전
  // 글리치 최대 체력은 결전 날 0시에 정한다: (9마리 한 라운드 공격 + 예상 응원) ÷ roundShare
  // 한 라운드에 체력의 40%쯤 깎이도록 해서, 봉인 4개면 2라운드, 봉인이 적으면 3라운드쯤 걸린다.
  final: {
    roundShare: 0.4,
    cheerExpectPerUser: 30,       // 참가자 1명당 예상 응원 수 (절반쯤 현장에 와서 60번씩)
    sealCut: 0.1,                 // 봉인 조각 1개 = 첫 라운드에 최대 체력의 10% 피해
    escapeAdd: 0.1,               // 놓친 보스 1마리 = 글리치 체력 10% 증가
    atk: 30, atkPerLevel: 10, hitsPerRound: 3, critRate: 0.12, critMul: 1.5,
    cheerDamage: 0.5,             // 응원 1번 = 피해 0.5
    cheerSendMax: 60,             // 한 번에 보낼 수 있는 응원 수 (폰은 6초마다 모아서 보낸다)
    cheerUserMax: 300,            // 한 사람이 응원 타임 한 번에 낼 수 있는 응원 수
    cheerSeconds: 30,
  },
};

// 럭키박스: 한 주에 3번, w는 가중치(합계 100 = 퍼센트)
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
  { w: 42, item: 'cheer' },
  { w: 8,  item: 'coffee' },
];

export const ITEMS = {
  booster: { name: '팀 경험치 부스터', icon: 'booster', desc: '1시간 동안 우리 팀이 먹이로 얻는 경험치(=보스 피해)가 1.5배' },
  cheer:   { name: '응원 풍선',       icon: 'cheer',   desc: '다른 커뮤니티 몬스터를 1시간 동안 응원해요. 그 팀 경험치 1.3배, 우리 팀엔 우정 점수 +1' },
  coffee:  { name: '커피 교환권',     icon: 'coffee',  desc: '운영사무국 확인 후 커피 기프티콘으로 바꿔 드려요' },
};

// 현장 상품 "?" 상자: 어떤 상으로 받는지 (상품 이름은 운영자가 넣고, 받은 사람이 열 때 공개)
export const PRIZE_AWARDS = {
  finalMvp:  { label: '최종 결전 MVP 팀', kind: 'team', desc: '12/19 결전에서 가장 큰 피해를 준 팀' },
  seasonMvp: { label: '시즌 MVP 팀',      kind: 'team', desc: '4주 동안 팀 몫 달성률이 가장 높은 팀' },
  friend:    { label: '시즌 우정상 팀',   kind: 'team', desc: '다른 팀을 가장 많이 응원하고 선물한 팀' },
  join:      { label: '시즌 참여왕 팀',   kind: 'team', desc: '팀원들이 가장 꾸준히 참여한 팀' },
  king:      { label: '시즌 지식왕',      kind: 'user', desc: '4주 동안 퀴즈를 가장 많이 맞힌 사람' },
  ace:       { label: '시즌 에이스 대원', kind: 'user', desc: '4주 동안 보스에게 가장 큰 피해를 준 사람' },
  cheerKing: { label: '현장 응원왕',      kind: 'user', desc: '12/19 결전에서 응원을 가장 많이 한 사람' },
  lucky:     { label: '행운 추첨',        kind: 'user', desc: '참여한 모든 대원 중 운영자가 추첨' },
};
// 처음(초기화 뒤)에 들어 있는 샘플 상품 — 미리 해 보기용. 행사 전에 운영자 화면에서 실제 상품으로 바꾼다.
export const SAMPLE_MARK = '[샘플]';
export const DEFAULT_PRIZES = [
  { award: 'finalMvp',  name: '[샘플] 팀 간식 파티 세트' },
  { award: 'seasonMvp', name: '[샘플] 팀 단체 기념품' },
  { award: 'friend',    name: '[샘플] 우정 머그컵 세트' },
  { award: 'king',      name: '[샘플] 무선 이어폰' },
  { award: 'ace',       name: '[샘플] 보조 배터리' },
  { award: 'cheerKing', name: '[샘플] 응원왕 트로피' },
  { award: 'lucky',     name: '[샘플] 커피 쿠폰' },
];

// 몬스터 성장 단계 (레벨 기준)
export const STAGES = [
  { key: 'egg',   name: '알',     minLevel: 1 },
  { key: 'baby',  name: '아기',   minLevel: 2 },
  { key: 'teen',  name: '성장기', minLevel: 6 },
  { key: 'final', name: '완전체', minLevel: 11 },
];

// 레벨 n이 되는 데 필요한 누적 경험치: Lv2 100, Lv3 300, Lv4 600, Lv5 1000 ...
export const expForLevel = (level) => 50 * (level - 1) * level;

export const spriteOf = (teamId) => `assets/monsters/${teamId}/${teamId}.png`;
export const eggOf = (teamId) => `assets/monsters/${teamId}/${teamId}_egg.png`;
export const iconOf = (name) => `assets/icons/${name}.png`;
export const bossImgOf = (bossId) => `assets/bosses/${bossId}.png`;
export const avatarOf = (avatarId) => `assets/avatars/${avatarId}.png`;
