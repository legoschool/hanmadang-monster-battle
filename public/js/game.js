// 게임 규칙. 모든 함수는 state를 직접 바꾸고 결과 객체를 돌려준다.
// 판정은 서버(server/api.js)가 이 파일로 한다. 브라우저는 계산된 값을 화면에 보여 줄 때만 쓴다.
//
// 일정은 '주' 단위다. week 0 = 시즌 시작 전, 1~4 = 사전 원정 주, FINAL_WEEK = 현장 모임(최종 결전).
// 협력형: 모든 커뮤니티가 한 원정대다. 원래 하던 활동(먹이·퀴즈·가위바위보)이 그대로 그 주 보스 공격이 되고,
// 모두 함께 보스를 쓰러뜨리면 참여자 전원이 보상을 받는다. 현장 모임 날에는 다 함께 대마왕 글리치와 싸운다.
import {
  EVENT, TEAMS, RULES, LUCKY_BOX, GACHA, ITEMS, STAGES, BOSSES, FINAL_BOSS, AVATARS, PRIZE_AWARDS, DEFAULT_PRIZES, PACES, LEVELS, SKILL_LEVEL, expForLevel,
} from './config.js';
import { cardsForWeek, CARDS_PER_ROUND } from './cards.js';
import { kidCardsForWeek } from './cards-kid.js';

export const SCHEMA = 6; // 저장 데이터 모양이 바뀌면 올린다 (예전 모양은 새로 시작). 6: 날마다 열리는 문제·AI 카드 도감
export const FINAL_WEEK = EVENT.weeks + 1;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const HITS_LIMIT = 24;      // 보스 전투 장면에 보여 줄 최근 공격 수
const CHEER_GRACE = 3000;   // 응원 타임이 끝난 뒤에도 늦게 도착한 응원을 받아 주는 시간
export const HANDS = { rock: '✊', scissors: '✌️', paper: '✋' };
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export const teamById = (id) => TEAMS.find((t) => t.id === id);
export const bossOf = (week) => BOSSES.find((b) => b.week === week) ?? null;
export const isAvatar = (id) => AVATARS.some((a) => a.id === id);

// ---------------------------------------------------------------- 일정
// 일정(schedule)은 게임 상태에 저장된다: { start, end, quick }
//   start: 1주차(1회차)가 열리는 시각, end: 현장 결전이 시작되는 시각. 그 사이를 4번으로 똑같이 나눈다.
//   기본값: 게임을 만든(초기화한) 순간 바로 시작 → 12월 19일(토) 0시 결전. 운영자 화면에서 두 날짜를 고친다.
//   quick: 운영자가 고른 "빠른 미리 해 보기"(10분·30분·1시간·1일). 혼자서도 해 볼 수 있게 보스 체력을 낮춘다.
const EVENT_MS = Date.parse(`${EVENT.eventDate}T00:00:00+09:00`);
export const eventDefaultMs = () => EVENT_MS;
const LEGACY_MS = { week: 7 * DAY, day: DAY, hour: HOUR, min30: 30 * MIN, min10: 10 * MIN };

export function defaultSchedule(now = Date.now()) {
  const end = EVENT_MS > now + EVENT.weeks * MIN ? EVENT_MS : now + EVENT.weeks * 7 * DAY;
  return { start: Math.floor(now / MIN) * MIN, end, quick: false };
}

// 예전 모양({ pace, start, real })도 읽어 준다
export function normalizeSchedule(sch) {
  if (!sch) return { start: EVENT_MS - EVENT.weeks * 7 * DAY, end: EVENT_MS, quick: false };
  if (sch.end) return sch;
  const ms = LEGACY_MS[sch.pace] || LEGACY_MS.week;
  return { start: sch.start, end: sch.start + EVENT.weeks * ms, quick: !sch.real };
}
export const scheduleOf = (state) => normalizeSchedule(state?.schedule);
export const roundLength = (sch) => (sch.end - sch.start) / EVENT.weeks;
// 지금 회차 길이에 가장 가까운 간격 이름 (운영자 화면에서 고른 버튼을 표시할 때 쓴다)
export function paceKeyFor(sch) {
  const len = roundLength(sch);
  let best = 'week';
  let gap = Infinity;
  for (const [k, q] of Object.entries(PACES)) { const d = Math.abs(q.ms - len); if (d < gap) { gap = d; best = k; } }
  return best;
}
export const roundStart = (sch, week) => Math.round(sch.start + (week - 1) * roundLength(sch));
export const eventStart = (sch) => sch.end;

// 회차 길이에 맞는 말: 1주일 → 주차·이번 주, 하루 → 일차·오늘, 그 밖 → 회차·이번 회차
const WORDS = {
  week:  { round: '주차', now: '이번 주', next: '다음 주', prev: '지난주', per: '한 주에', once: '1주일에 한 번', series: '주간', every: '매주' },
  day:   { round: '일차', now: '오늘', next: '내일', prev: '어제', per: '하루에', once: '하루에 한 번', series: '편', every: '매일' },
  round: { round: '회차', now: '이번 회차', next: '다음 회차', prev: '지난 회차', per: '한 회차에', once: '한 회차에 한 번', series: '편' },
};
export function periodLabel(ms) {
  const exact = (unit) => Math.abs(ms / unit - Math.round(ms / unit)) < 0.01;
  if (exact(7 * DAY) && Math.round(ms / (7 * DAY)) === 1) return '1주일';
  if (ms >= DAY) return exact(DAY) ? `${Math.round(ms / DAY)}일` : `약 ${Math.round(ms / DAY)}일`;
  if (ms >= HOUR) return exact(HOUR) ? `${Math.round(ms / HOUR)}시간` : `약 ${Math.round(ms / HOUR)}시간`;
  return exact(MIN) ? `${Math.round(ms / MIN)}분` : `약 ${Math.max(1, Math.round(ms / MIN))}분`;
}
export function paceFor(sch) {
  const len = roundLength(sch);
  const kind = len >= 6 * DAY && len <= 8 * DAY ? 'week' : len >= 20 * HOUR && len <= 28 * HOUR ? 'day' : 'round';
  const label = periodLabel(len);
  const w = WORDS[kind];
  return {
    ...w, kind, label,
    every: w.every || `${label}마다`,
    once: kind === 'round' && !label.startsWith('약') ? `${label}에 한 번` : w.once,
  };
}
export const paceOf = (state) => paceFor(scheduleOf(state));

// 지금 몇 주차(회차)인지 — 시작 시각에 1주차가 열리고, 한 회차 길이만큼 지나면 다음 주차
export function weekForTime(sch, now = Date.now()) {
  if (now < sch.start) return 0;
  if (now >= sch.end) return FINAL_WEEK;
  return Math.min(EVENT.weeks, Math.floor((now - sch.start) / roundLength(sch)) + 1);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function kst(ms) {
  const d = new Date(ms + 9 * 60 * MIN); // UTC 기준 필드로 한국 날짜·시각을 읽는다
  return { mo: d.getUTCMonth() + 1, da: d.getUTCDate(), wd: WEEKDAYS[d.getUTCDay()], h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
const dateLabel = (ms) => { const k = kst(ms); return `${k.mo}월 ${k.da}일(${k.wd})`; };
const clockLabel = (ms) => { const k = kst(ms); return `${k.h}:${String(k.mi).padStart(2, '0')}`; };
const isMidnight = (ms) => { const k = kst(ms); return k.h === 0 && k.mi === 0; };
function whenLabel(sch, ms) {
  if (roundLength(sch) < DAY) return clockLabel(ms);
  return isMidnight(ms) ? dateLabel(ms) : `${dateLabel(ms)} ${clockLabel(ms)}`;
}

// 주차별 기간 표시. 예: { start: '11월 21일(토)', end: '11월 27일(금)' }, 10분씩: { start: '14:00', end: '14:09' }
export function weekDates(sch, week) {
  const w = Math.min(Math.max(1, week), FINAL_WEEK);
  const start = roundStart(sch, w);
  if (w >= FINAL_WEEK) return { start: whenLabel(sch, start), end: whenLabel(sch, start) };
  const next = roundStart(sch, w + 1);
  const dayAligned = roundLength(sch) >= DAY && isMidnight(start) && isMidnight(next);
  return { start: whenLabel(sch, start), end: whenLabel(sch, next - (dayAligned ? DAY : MIN)) };
}

export const eventDateLabel = (sch) => (isMidnight(sch.end) ? dateLabel(sch.end) : `${dateLabel(sch.end)} ${clockLabel(sch.end)}`);

// 현장 결전까지 남은 날 (달력 기준, 당일 0)
export function daysToEvent(sch, now = Date.now()) {
  const kstToday = Math.floor((now + 9 * HOUR) / DAY);
  const kstEvent = Math.floor((sch.end + 9 * HOUR) / DAY);
  return kstEvent - kstToday;
}

// 결전까지 남은 시간 표시: 하루 넘게 남으면 'D-88', 하루 안이면 '1시간 20분 뒤'
export function untilEventLabel(sch, now = Date.now()) {
  const left = sch.end - now;
  if (left <= 0) return 'D-DAY';
  if (left >= DAY) {
    const d = daysToEvent(sch, now);
    return d > 0 ? `D-${d}` : 'D-DAY';
  }
  const m = Math.ceil(left / MIN);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분 뒤` : `${m}분 뒤`;
}

export const isPlayWeek = (week) => week >= 1 && week <= EVENT.weeks;

// ---------------------------------------------------------------- 도우미
export function josa(word, pair) {
  const [withBatchim, without] = pair.split('/');
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return word + without;
  const final = code % 28;
  if (pair === '으로/로') return word + (final === 0 || final === 8 ? without : withBatchim);
  return word + (final ? withBatchim : without);
}

function pickWeighted(table, rand) {
  const total = table.reduce((s, r) => s + r.w, 0);
  let x = rand() * total;
  for (const row of table) {
    x -= row.w;
    if (x < 0) return row;
  }
  return table[table.length - 1];
}

export function levelInfo(exp) {
  let level = 1;
  while (exp >= expForLevel(level + 1)) level++;
  const cur = expForLevel(level);
  const next = expForLevel(level + 1);
  const stage = [...STAGES].reverse().find((s) => level >= s.minLevel);
  return { level, cur, next, progress: (exp - cur) / (next - cur), stage };
}

// 소식 한 줄. extra: { teamId, uid, avatar, boss } — 사람이 한 일이면 그 사람 아바타가 함께 나온다
export function pushFeed(state, icon, text, extra = {}) {
  state.feed.unshift({ id: ++state.seq, ts: Date.now(), icon, text, ...extra });
  if (state.feed.length > 80) state.feed.length = 80;
}
const who = (u) => ({ teamId: u.teamId, uid: u.id, avatar: u.avatar });

const notOpen = (state) => (state.week < 1
  ? { ok: false, reason: `${weekDates(scheduleOf(state), 1).start}에 1${paceOf(state).round} 원정이 시작돼요. 조금만 기다려 주세요!` }
  : { ok: false, reason: '사전 원정이 끝났어요. 현장 최종 결전에서 만나요!' });

// 주간 기록을 건드리지 않고 보상만 준다 (주가 끝날 때 주는 보상용)
function grant(u, { food = 0, premium = 0, points = 0 }) {
  u.food += food;
  u.premium += premium;
  u.points += points;
  u.totalPoints += points;
}

// ---------------------------------------------------------------- 팀과 사용자
export function newTeam(id, week = 0) {
  return {
    id, exp: 0, expAtWeekStart: { [week]: 0 }, dmgByWeek: {}, friendByWeek: {},
    boosterUntil: 0, cheerUntil: 0, cheerFrom: null, crownWeek: 0,
  };
}

export function newGameState() {
  const state = {
    schema: SCHEMA, version: 1, seq: 0, week: 0,
    users: {}, teams: {}, feed: [], awards: {}, bosses: {}, hits: [],
    coffeeStock: RULES.coffeeStock, goldenUntil: 0, final: null, schedule: defaultSchedule(), mode: 'free', lap: 1, seasons: [],
    prizes: DEFAULT_PRIZES.map(({ award, name }) => ({ name, award, winner: null, openedAt: 0 })),
  };
  for (const t of TEAMS) state.teams[t.id] = newTeam(t.id, 0);
  state.week = 1;                       // 프리 모드는 바로 1회차부터 (정규 시즌으로 바꾸면 날짜에 맞춰진다)
  pushFeed(state, 'crown', `${EVENT.name} ${EVENT.title}에 오신 걸 환영해요! ${EVENT.slogan}`);
  return state;
}

export function newUser({ id, name, teamId, avatar, level }) {
  return {
    id, name, teamId, avatar, level: level === 'student' ? 'student' : 'adult',
    food: 0, premium: 0, points: 0, totalPoints: 0, totalDmg: 0, totalCorrect: 0,
    items: { booster: 0, cheer: 0, coffee: 0 },
    coupons: [], visitedWeeks: [], bossRewards: [], cards: [], onTime: 0, clears: 0, laps: 0,
    weekly: freshWeekly(-1), daily: { key: '', visit: false, lucky: 0, rps: 0 },
  };
}

function freshWeekly(week) {
  return {
    week, quiz: [], quizDoneAt: 0, luckyCount: 0, luckyLog: [], rpsCount: 0, rpsLog: [],
    points: 0, dmg: 0, friend: 0, friendGifts: 0, days: [], dayBonus: 0,
  };
}

// 날마다(한국 날짜) 새로 채워지는 기록. 회차가 바뀌어도 새로 채워진다.
export const kstDay = (ms = Date.now()) => Math.floor((ms + 9 * HOUR) / DAY);
export function daily(state, user, now = Date.now()) {
  const key = `${state.week}:${kstDay(now)}`;
  if (!user.daily || user.daily.key !== key) user.daily = { key, visit: false, lucky: 0, rps: 0 };
  return user.daily;
}

export function weekly(state, user) {
  if (user.weekly.week !== state.week) user.weekly = freshWeekly(state.week);
  return user.weekly;
}

function addPoints(state, user, n) {
  user.points += n;
  user.totalPoints += n;
  weekly(state, user).points += n;
}

export const teamMembers = (state, teamId) => Object.values(state.users).filter((u) => u.teamId === teamId);
export const teamMemberCount = (state, teamId) => teamMembers(state, teamId).length;

export function setAvatar(state, userId, avatar) {
  if (!isAvatar(avatar)) return { ok: false, reason: '아바타를 골라 주세요' };
  state.users[userId].avatar = avatar;
  return { ok: true };
}

// ---------------------------------------------------------------- 진행 모드
// 프리 모드: 날짜를 보지 않고, 문제·카드가 모두 열리고, 보스를 잡으면 바로 다음 보스가 나온다
export const isFree = (state) => (state?.mode || 'free') !== 'season';   // 기본값은 프리 모드
export function setMode(state, mode) {
  const v = mode === 'season' ? 'season' : 'free';
  if ((state.mode || 'free') === v) return { ok: false, reason: '이미 그 모드예요' };
  state.mode = v;
  if (v === 'free') {
    if (!isPlayWeek(state.week)) state.week = 1;              // 모집 기간·결전이면 1회차부터
    pushFeed(state, 'booster', '프리 모드! 이제 날짜와 상관없이 문제와 카드가 모두 열리고, 보스를 잡으면 바로 다음 보스가 나와요.');
  } else {
    syncWeek(state);                                          // 정규 시즌으로 돌아오면 날짜에 맞춘다
    pushFeed(state, 'booster', `정규 시즌으로 돌아왔어요. ${paceOf(state).label}마다 새 ${paceOf(state).round}가 열려요.`);
  }
  return { ok: true, mode: v, week: state.week };
}

// 프리 모드에서 보스를 잡았을 때 다음 단계로 (마지막 보스까지 잡으면 한 바퀴 완주)
function nextStageFree(state) {
  if (state.week < EVENT.weeks) {
    state.week += 1;
    pushFeed(state, 'seal', `다음 보스 ${bossOf(state.week).name} 등장! 바로 이어서 도전해요.`, { boss: bossOf(state.week).id });
    return;
  }
  const lapNo = state.lap || 1;
  archiveSeason(state, 'free', lapNo);                                         // 이번 바퀴 기록을 남긴다
  state.lap = lapNo + 1;
  state.week = 1;
  state.bosses = {};
  for (const t of TEAMS) state.teams[t.id].dmgByWeek = {};
  for (const u of Object.values(state.users)) {
    if (u.visitedWeeks.length) u.laps = (u.laps || 0) + 1;                     // 완주 참여 기록
    u.visitedWeeks = [];
    u.bossRewards = [];
  }
  pushFeed(state, 'premium', `원정 ${state.lap - 1}바퀴 완주! 보스들이 다시 모였어요. ${state.lap}바퀴째 출발!`);
}

// ---------------------------------------------------------------- 날마다 열리는 문제와 카드
// 회차가 얼마나 지났나 (0~1)
export function roundProgress(state, now = Date.now()) {
  const sch = scheduleOf(state);
  const len = roundLength(sch);
  if (len <= 0) return 1;
  return Math.min(1, Math.max(0, (now - roundStart(sch, state.week)) / len));
}
// 시간이 지날수록 하나씩 열린다. 놓친 것은 사라지지 않고 그대로 남는다(웹툰처럼 몰아 보기).
// 회차가 이틀 이상이면 한국 날짜로 '날마다', 하루보다 짧은 미리 해 보기면 지난 비율만큼 연다.
// 날마다 열 때도 회차가 끝나기 전에는 다 열리도록, 날짜가 적으면 하루에 여러 개를 연다.
export const byDay = (sch) => roundLength(sch) >= 2 * DAY;
export function openSlots(state, total, now = Date.now()) {
  if (total <= 0) return 0;
  if (isFree(state)) return total;                       // 프리 모드는 처음부터 다 열려 있다
  if (state.week >= FINAL_WEEK) return total;            // 결전의 날은 한꺼번에 연다
  const sch = scheduleOf(state);
  let open;
  if (byDay(sch)) {
    const days = Math.max(1, Math.round(roundLength(sch) / DAY));
    const d = kstDay(now) - kstDay(roundStart(sch, state.week)) + 1;   // 이 회차의 며칠째인가
    open = Math.max(d, Math.ceil((total * d) / days));                 // 날마다 하나 이상, 마지막 날엔 전부
  } else {
    open = Math.ceil(roundProgress(state, now) * total);
  }
  return Math.max(1, Math.min(total, open));
}
// 다음 것이 열리는 시각 (다 열렸으면 0)
export function nextOpenAt(state, total, now = Date.now()) {
  const open = openSlots(state, total, now);
  if (open >= total || isFree(state) || state.week >= FINAL_WEEK) return 0;
  const sch = scheduleOf(state);
  if (byDay(sch)) {                                     // 다음 한국 날짜 0시에 또 열린다
    const d = kstDay(now) - kstDay(roundStart(sch, state.week)) + 1;
    return (kstDay(roundStart(sch, state.week)) + d) * DAY - 9 * HOUR;
  }
  return Math.round(roundStart(sch, state.week) + roundLength(sch) * (open / total));
}

// 「오늘의 AI 한 조각」 — 회차마다 CARDS_PER_ROUND장, 시간이 지날수록 한 장씩 열린다
export const cardKey = (week, i) => `${week}:${i}`;
// 수준에 맞는 카드 글 (학생이면 쉬운 말 판을 덮어쓴다. 번호·낱말은 같다)
export function cardFor(week, i, level) {
  const base = cardsForWeek(week)?.cards[i];
  if (!base) return null;
  const kid = level === 'student' ? kidCardsForWeek(week)?.cards[i] : null;
  return kid ? { ...base, ...kid } : base;
}
export const cardThemeFor = (week, level) =>
  (level === 'student' ? kidCardsForWeek(week)?.theme : null) || cardsForWeek(week)?.theme || '';

// 행사 전체의 문제 수준 (운영자만 정한다)
export const levelOf = (state) => (LEVELS[state?.quizLevel] ? state.quizLevel : 'adult');
export function setQuizLevel(state, level) {
  if (!LEVELS[level]) return { ok: false, reason: '알 수 없는 수준이에요' };
  if (levelOf(state) === level) return { ok: false, reason: '이미 그 수준이에요' };
  state.quizLevel = level;
  // 수준이 바뀌면 문제 묶음이 달라지므로, 이번 회차 답을 비우고 다시 연다 (받은 포인트는 그대로)
  for (const u of Object.values(state.users)) {
    if (u.weekly.week === state.week) { u.weekly.quiz = []; u.weekly.quizDoneAt = 0; }
  }
  pushFeed(state, 'booster', `운영진이 문제 수준을 「${LEVELS[level].label}」로 맞췄어요. 이번 ${paceOf(state).round} 문제가 새로 열렸어요!`);
  return { ok: true, level };
}

// 사람마다 문제 순서를 섞는다 (같은 회차에서는 늘 같은 순서라 기록이 어긋나지 않는다)
export function quizOrder(userId, week, total) {
  const idx = Array.from({ length: total }, (_, i) => i);
  let seed = 7;
  const key = `${userId}:${week}`;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 2147483647;
  for (let i = total - 1; i > 0; i--) {                    // 섞기 (같은 씨앗이면 늘 같은 결과)
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
export function cardState(state, user, now = Date.now()) {
  const set = cardsForWeek(state.week);
  const total = set ? set.cards.length : 0;
  const open = total ? openSlots(state, total, now) : 0;
  const read = user ? user.cards || [] : [];
  // 지난 회차 카드까지 통틀어 열린 장수 (몰아 보기용)
  let openedAll = 0;
  for (let w = 1; w <= state.week; w++) openedAll += cardOpenCount(state, w, now);
  return { total, open, openedAll, theme: set?.theme || '', nextAt: total ? nextOpenAt(state, total, now) : 0,
    readCount: read.filter((k) => k.startsWith(`${state.week}:`)).length, allRead: read.length,
    onTime: user?.onTime || 0 };
}
// 지난 회차 카드는 모두 열려 있다 (웹툰처럼 못 본 것을 몰아 볼 수 있게)
export function cardOpenCount(state, week, now = Date.now()) {
  const set = cardsForWeek(week);
  if (!set) return 0;
  if (week < state.week) return set.cards.length;
  if (week > state.week) return 0;
  return openSlots(state, set.cards.length, now);
}
export function readCard(state, userId, week, index, now = Date.now()) {
  const u = state.users[userId];
  const w = Number(week) || state.week;
  const set = cardsForWeek(w);
  const i = Number(index);
  if (!set || !Number.isInteger(i) || i < 0 || i >= set.cards.length) return { ok: false, reason: '없는 카드예요' };
  const open = cardOpenCount(state, w, now);
  if (i >= open) return { ok: false, reason: '아직 열리지 않은 카드예요' };
  u.cards ||= [];
  const key = cardKey(w, i);
  if (u.cards.includes(key)) return { ok: false, reason: '이미 읽은 카드예요' };
  u.cards.push(key);
  const R = RULES.card;
  u.food += R.food;
  // 그날 열린 카드를 그날 읽으면 꾸준 점수와 포인트를 더 준다 (몰아 보기도 그대로 인정)
  const onTime = w === state.week && i === open - 1;
  if (onTime) u.onTime = (u.onTime || 0) + 1;
  addPoints(state, u, R.points + (onTime ? R.onTimePoints : 0) + (hasSkill(state, w === state.week ? u.teamId : u.teamId, 'card') ? 5 : 0));   // 연구 노트
  const card = cardFor(w, i, u.level) || set.cards[i];
  if (u.cards.length % CARDS_PER_ROUND === 0) {
    pushFeed(state, 'premium', `${u.name}님이 AI 한 조각 ${u.cards.length}장을 모았어요! (도감 ${u.cards.length}장)`, who(u));
  }
  return { ok: true, food: R.food, points: R.points + (onTime ? R.onTimePoints : 0), onTime, steady: u.onTime || 0, title: card.title, count: u.cards.length };
}

// ---------------------------------------------------------------- 커뮤니티 시그니처 스킬
// 몬스터가 SKILL_LEVEL이 되면 그 커뮤니티의 스킬이 깨어난다
export function teamSkill(state, teamId) {
  const t = teamById(teamId);
  if (!t?.skill) return null;
  const level = levelInfo(state.teams[teamId]?.exp || 0).level;
  return { ...t.skill, at: SKILL_LEVEL, level, unlocked: level >= SKILL_LEVEL };
}
export const hasSkill = (state, teamId, key) => {
  const s = teamSkill(state, teamId);
  return !!s && s.unlocked && s.key === key;
};

// ---------------------------------------------------------------- 주간 보스
// 그 주에 한 번이라도 들어온(첫 방문 보너스를 받은) 팀원 수
export const activeCount = (state, teamId, w = state.week) =>
  Object.values(state.users).filter((u) => u.teamId === teamId && u.visitedWeeks.includes(w)).length;

// 회차가 며칠짜리인지 (체력 계산에 쓴다 · 1~maxDays일, 하루보다 짧은 미리 해 보기는 1일로 본다)
export const roundDays = (sch) => Math.max(1, Math.min(RULES.boss.maxDays, Math.round(roundLength(sch) / DAY) || 1));
// 대원 1명이 한 회차에 맡는 몫 = 회차 몫 + 하루 몫 × 회차 일수, 여기에 운영자가 고른 보스 세기를 곱한다
export const bossAdjust = (state) => (state.bossAdaptOff ? 1 : (state.bossAdjust || 1));
export const bossPower = (state) => {
  const B = RULES.boss;
  return Math.round((B.perMemberRound + B.perMemberDay * roundDays(scheduleOf(state))) * (state.bossScale || 1) * bossAdjust(state));
};

// 회차가 끝날 때, 원정대가 얼마나 몰아쳤는지 보고 다음 보스 난이도를 정한다
export function adaptBoss(state, week) {
  const A = RULES.boss.adapt;
  const info = bossInfo(state, week);
  if (!info || !info.maxHp) return null;
  const total = allianceList(state, week).reduce((s, t) => s + t.dmg, 0);   // 회차 동안 준 피해 전부(버틴 뒤 넘친 힘도 포함)
  const rate = total / info.maxHp;
  const f = rate >= A.hard ? A.up : rate >= A.good ? A.upSmall : rate >= A.weak ? 1 : rate >= A.poor ? A.downSmall : A.down;
  const before = state.bossAdjust || 1;
  const after = Math.min(A.max, Math.max(A.min, Math.round(before * f * 100) / 100));
  state.bossAdjust = after;
  if (state.bossAdaptOff || after === before) return { rate, from: before, to: after, changed: false };
  const next = bossOf(week + 1) || FINAL_BOSS;
  pushFeed(state, 'booster', after > before
    ? `원정대가 ${Math.round(rate * 100)}%나 몰아쳤어요! 소문을 들은 ${josa(next.name, '이/가')} 더 단단히 준비했어요 (체력 ×${after}).`
    : `이번 회차는 힘겨웠어요(${Math.round(rate * 100)}%). ${josa(next.name, '이/가')} 조금 방심했네요 (체력 ×${after}).`);
  return { rate, from: before, to: after, changed: true };
}

// 운영자가 자동 조절을 켜고 끈다
export function setBossAdapt(state, on) {
  state.bossAdaptOff = !on;
  if (on) pushFeed(state, 'booster', '운영진이 보스 자동 조절을 켰어요. 회차 성적에 따라 다음 보스의 세기가 달라져요.');
  return { ok: true, on: !state.bossAdaptOff, adjust: bossAdjust(state) };
}
// 우리 팀 몫: 보스 체력을 팀마다 팀원 수만큼 나눠 맡는다. 팀원이 모두 조금씩 힘을 보태면 채워진다.
export const teamShare = (state, teamId) => Math.round(bossPower(state) * teamMemberCount(state, teamId));

// 보스 최대 체력 (인원 기준, 최소 체력 보장)
export function liveMaxHp(state) {
  const minHp = (scheduleOf(state).quick || isFree(state)) ? RULES.boss.minHpTest : RULES.boss.minHp;
  return Math.max(minHp, TEAMS.reduce((s, t) => s + teamShare(state, t.id), 0));
}
// 막판(격파 가능) 시각 — 이때까지는 보스가 버틴다
export const killTime = (state, w = state.week) => {
  const sch = scheduleOf(state);
  return roundStart(sch, w) + roundLength(sch) * RULES.boss.killAfter;
};
// 막판 시각을 사람이 읽는 말로 (예: '11월 27일(금) 16:48')
export const killLabel = (state, w = state.week) => whenLabel(scheduleOf(state), killTime(state, w));
// 버티는 동안 남겨 두는 체력
const holdFloor = (maxHp) => Math.max(1, Math.round(maxHp * RULES.boss.holdHp));
// 회복을 반영한 지금의 누적 피해 (상태를 바꾸지 않는다)
function dmgNow(rec, maxHp, now, perDay = RULES.boss.regenPerDay) {
  if (!rec || rec.defeatedAt || rec.escaped || !rec.regenAt || !perDay) return rec?.dmg || 0;
  const heal = Math.floor(((now - rec.regenAt) / DAY) * perDay * maxHp);
  return Math.max(0, rec.dmg - Math.max(0, heal));
}

export function bossInfo(state, w = state.week, now = Date.now()) {
  const meta = bossOf(w);
  if (!meta) return null;
  const rec = state.bosses[w] || { dmg: 0, defeatedAt: 0, maxHpAtDefeat: 0, escaped: false };
  const teams = TEAMS.map((t) => {
    const share = teamShare(state, t.id);
    const dmg = state.teams[t.id].dmgByWeek[w] || 0;
    return { id: t.id, share, dmg, rate: share ? dmg / share : 0, active: activeCount(state, t.id, w) };
  });
  const live = liveMaxHp(state);
  const maxHp = rec.defeatedAt ? rec.maxHpAtDefeat : rec.escaped ? rec.maxHpAtEnd || live : live;
  const free = isFree(state);
  const killAt = killTime(state, w);
  const open = free || now >= killAt;                          // 프리 모드는 언제든, 정규 시즌은 막판부터
  const cap = open ? maxHp : maxHp - holdFloor(maxHp);
  const dmg = rec.defeatedAt ? rec.dmg : Math.min(dmgNow(rec, maxHp, now, free ? 0 : RULES.boss.regenPerDay), cap);
  return {
    ...meta, week: w, maxHp, dmg, hp: Math.max(0, maxHp - dmg),
    defeated: !!rec.defeatedAt, defeatedAt: rec.defeatedAt, escaped: !!rec.escaped,
    holding: !rec.defeatedAt && !rec.escaped && dmg >= cap,    // 마지막 힘으로 버티는 중
    killAt, killOpen: open, regenPerDay: free ? 0 : RULES.boss.regenPerDay, free,
    teams, active: teams.reduce((s, t) => s + t.active, 0),
  };
}

// 격파! 그 회차에 한 번이라도 온 모두에게 보상을 주고 봉인 조각을 얻는다
function markDefeat(state, w, info, byUser = null, now = Date.now()) {
  const rec = state.bosses[w];
  rec.defeatedAt = now;
  rec.maxHpAtDefeat = info.maxHp;
  rec.dmg = Math.max(rec.dmg, info.maxHp);
  const joined = Object.values(state.users).filter((x) => x.visitedWeeks.includes(w));
  for (const x of joined) x.clears = (x.clears || 0) + 1;                      // 보스 격파 참여 기록
  const rewarded = joined.filter((x) => giveBossReward(state, x, w)).length;
  const r = RULES.boss.defeatReward;
  const last = byUser ? `마지막 일격은 ${teamById(byUser.teamId).community} ${byUser.name}님. ` : '끝까지 버티던 보스가 마지막 순간에 쓰러졌어요! ';
  pushFeed(state, 'seal', `원정대가 ${josa(info.name, '을/를')} 물리쳤어요! ${last}`
    + `참여한 ${rewarded}명 모두 고급 먹이 ${r.premium}개 + ${r.points}P, 봉인 조각 1개 획득!`, { ...(byUser ? who(byUser) : {}), boss: info.id });
  return true;
}

function giveBossReward(state, u, w) {
  if (u.bossRewards.includes(w)) return false;
  u.bossRewards.push(w);
  grant(u, RULES.boss.defeatReward);
  return true;
}

// 원래 활동이 곧 보스 공격이다. 피해를 쌓고, 체력이 바닥나면 그 자리에서 격파 처리를 한다.
function dealDamage(state, u, amount, kind, now = Date.now()) {
  const w = state.week;
  if (!isPlayWeek(w) || amount <= 0) return null;
  const rec = (state.bosses[w] ||= { dmg: 0, defeatedAt: 0, maxHpAtDefeat: 0, escaped: false });
  const team = state.teams[u.teamId];
  if (hasSkill(state, u.teamId, 'dmg')) amount = Math.round(amount * 1.05);   // 운영 지원
  let applied = amount;          // 버티는 중이면 일부만 체력에 들어간다 (나머지는 팀 몫·시상에 그대로 쌓인다)
  // 지나간 시간만큼 보스가 회복한 뒤에 이번 피해를 얹는다
  const maxHp = rec.defeatedAt ? rec.maxHpAtDefeat : liveMaxHp(state);
  if (!rec.defeatedAt) {
    rec.dmg = dmgNow(rec, maxHp, now, isFree(state) ? 0 : RULES.boss.regenPerDay);
    rec.regenAt = now;
    const open = isFree(state) || now >= killTime(state, w);
    const cap = open ? maxHp : maxHp - holdFloor(maxHp);
    const before = rec.dmg;
    rec.dmg = Math.min(rec.dmg + amount, cap);
    applied = rec.dmg - before;
    // 버티기 한도에 닿으면 하루 한 번 소식으로 알린다 (넘친 힘은 커뮤니티 성장·시상에 그대로 쌓인다)
    if (!open && rec.dmg >= cap && before < cap) {
      rec.heldAt = now;
      pushFeed(state, 'glitch', `${josa(bossOf(w).name, '이/가')} 마지막 힘으로 버티고 있어요! ${killLabel(state, w)}부터 마지막 일격을 넣을 수 있어요.`, { boss: bossOf(w).id });
    }
  } else {
    rec.dmg += amount;
  }
  team.dmgByWeek[w] = (team.dmgByWeek[w] || 0) + amount;
  weekly(state, u).dmg += amount;
  u.totalDmg += amount;
  state.hits.unshift({ id: ++state.seq, uid: u.id, name: u.name, avatar: u.avatar, teamId: u.teamId, dmg: amount, kind, ts: Date.now() });
  if (state.hits.length > HITS_LIMIT) state.hits.length = HITS_LIMIT;

  let defeated = false;
  if (!rec.defeatedAt) {
    const info = bossInfo(state, w, now);
    if (info.killOpen && rec.dmg >= info.maxHp) {
      defeated = markDefeat(state, w, info, u, now);
      if (defeated && isFree(state)) nextStageFree(state);     // 프리 모드: 쉬지 않고 다음 보스로
    }
  }
  return { dmg: amount, applied, held: amount - applied, defeated };
}

// ---------------------------------------------------------------- 주간 첫 방문
export function checkIn(state, userId, now = Date.now()) {
  const u = state.users[userId];
  weekly(state, u);
  const dy = daily(state, u, now);
  if (!isPlayWeek(state.week) || dy.visit) return { ok: false };
  dy.visit = true;
  const first = !u.visitedWeeks.includes(state.week);
  if (first) u.visitedWeeks.push(state.week);
  const food = (first ? RULES.weeklyVisitFood : RULES.dailyVisitFood) + (hasSkill(state, u.teamId, 'visit') ? 2 : 0);   // 꾸준한 헤엄
  u.food += food;
  // 이번 회차에 며칠 왔는지 (연속이 아니라 누적)
  const d = weekly(state, u);
  d.days ||= [];
  const today = kstDay(now);
  if (!d.days.includes(today)) d.days.push(today);
  let bonus = null;
  for (const b of RULES.visitBonus) {
    if (d.days.length >= b.days && (d.dayBonus || 0) < b.days) {
      d.dayBonus = b.days;
      grant(u, { premium: b.premium, points: b.points });
      bonus = b;
      pushFeed(state, 'premium', `${u.name}님이 ${state.week}${paceOf(state).round}에 ${b.days}일 참여했어요! 고급 먹이 ${b.premium}개 + ${b.points}P`, who(u));
    }
  }
  // 보스를 이미 물리친 회차에 처음 온 사람도 격파 보상을 받는다
  const bossReward = state.bosses[state.week]?.defeatedAt ? giveBossReward(state, u, state.week) : false;
  return { ok: true, food, first, bossReward, bonus, days: d.days.length };
}

// ---------------------------------------------------------------- 먹이 = 보스 공격
export function expMultiplier(state, team, now = Date.now()) {
  let m = 1;
  if (team.boosterUntil > now) m *= RULES.booster.multiplier;
  if (team.cheerUntil > now) m *= RULES.cheer.multiplier;
  if ((state.goldenUntil || 0) > now) m *= RULES.golden.multiplier;
  return m;
}

export function feedMonster(state, userId, kind, amount) {
  const u = state.users[userId];
  const team = state.teams[u.teamId];
  const t = teamById(u.teamId);
  if (!RULES.exp[kind]) return { ok: false, reason: '알 수 없는 먹이예요' };
  const n = Math.min(amount, kind === 'premium' ? u.premium : u.food);
  if (n <= 0) return { ok: false, reason: kind === 'premium' ? '고급 먹이가 없어요' : '먹이가 없어요' };

  const before = levelInfo(team.exp);
  let gained = Math.max(1, Math.round(n * RULES.exp[kind] * expMultiplier(state, team)));
  if (hasSkill(state, u.teamId, 'exp')) gained = Math.round(gained * 1.1);    // 데이터 급식
  team.exp += gained;
  if (kind === 'premium') u.premium -= n;
  else u.food -= n;
  const after = levelInfo(team.exp);
  const evolved = after.stage.key !== before.stage.key;
  const hit = dealDamage(state, u, gained, kind);

  if (after.level >= SKILL_LEVEL && before.level < SKILL_LEVEL && t.skill) {
    pushFeed(state, 'premium', `${t.monster}이(가) 「${t.skill.name}」 스킬을 익혔어요! ${t.skill.effect}`, { teamId: u.teamId });
  }
  if (after.level > before.level) {
    const what = evolved ? `${josa(after.stage.name, '으로/로')} 진화했어요!` : '로 성장했어요!';
    pushFeed(state, 'team', `${josa(t.monster, '이/가')} Lv.${after.level}${evolved ? ' ' + what : what}`, { teamId: u.teamId });
  } else if (kind === 'premium' || n >= 5) {
    pushFeed(state, kind, `${u.name}님이 ${t.monster}에게 ${kind === 'premium' ? '고급 먹이' : '먹이'} ${n}개! (+${gained} EXP${hit ? ` · 보스에게 ${gained} 피해` : ''})`, who(u));
  }
  return { ok: true, n, gained, dmg: hit?.dmg || 0, held: hit?.held || 0, defeated: !!hit?.defeated, levelUp: after.level > before.level, evolved, after };
}

// ---------------------------------------------------------------- 퀴즈 = 지식 공격
// questions: 그 주의 문제들 (정답이 들어 있어서 서버에서만 넘겨준다)
export function answerQuiz(state, userId, qi, choice, questions, now = Date.now()) {
  if (!isPlayWeek(state.week) && state.week !== FINAL_WEEK) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  const q = questions[qi];
  if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false, reason: '잘못된 답이에요' };
  if (qi >= openSlots(state, questions.length, now)) return { ok: false, reason: '아직 열리지 않은 문제예요' };
  if (d.quiz[qi]) return { ok: false, reason: '이미 푼 문제예요' };
  const bonus = qi >= RULES.quizMain;                    // 본 문제 6개 뒤의 보너스 문제
  const correct = choice === q.answer;
  d.quiz[qi] = { choice, correct };
  let hit = null;
  let wisdom = 0;
  if (correct) {
    addPoints(state, u, (bonus ? RULES.quizBonusPoints : RULES.quizPoints) + (hasSkill(state, u.teamId, 'quiz') ? 3 : 0));   // 톡톡 아이디어
    u.totalCorrect++;
    if (state.week === FINAL_WEEK) wisdom = addWisdom(state, u, RULES.final.wisdomPerCorrect);
    else hit = dealDamage(state, u, bonus ? RULES.boss.quizBonusDamage : RULES.boss.quizDamage, 'quiz');
  }

  const main = questions.slice(0, RULES.quizMain);
  const done = main.every((_, i) => d.quiz[i]);
  const perfect = done && main.every((_, i) => d.quiz[i].correct);
  if (done && !d.quizDoneAt) {
    d.quizDoneAt = Date.now();
    if (perfect) {
      u.premium += RULES.quizPerfectPremium;
      pushFeed(state, 'premium', `${u.name}님이 ${state.week === FINAL_WEEK ? '최종 미션' : `${state.week}${paceOf(state).round}`} 퀴즈를 모두 맞혔어요!`, who(u));
    }
  }
  return { ok: true, correct, done, perfect, bonus, wisdom, dmg: hit?.dmg || 0, held: hit?.held || 0, defeated: !!hit?.defeated };
}

// 최종 미션 퀴즈(결전의 날): 맞힌 만큼 원정대의 '지혜'가 쌓여 글리치를 더 세게 공격한다
function addWisdom(state, u, amount) {
  const f = state.final;
  if (!f) return 0;
  f.wisdom = (f.wisdom || 0) + amount;
  f.wisdomBy = f.wisdomBy || {};
  f.wisdomBy[u.id] = (f.wisdomBy[u.id] || 0) + amount;
  u.totalCorrect += 0;
  return amount;
}

// ---------------------------------------------------------------- 럭키박스
export function openLuckyBox(state, userId, rand = Math.random) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  const dy = daily(state, u);
  if (dy.lucky >= RULES.luckyPerDay) return { ok: false, reason: '오늘 럭키박스를 모두 열었어요. 내일 또 만나요!' };
  const row = pickWeighted(LUCKY_BOX, rand);
  if (row.reward.food) u.food += hasSkill(state, u.teamId, 'lucky') ? Math.round(row.reward.food * 1.5) : row.reward.food;   // 꿈의 변신
  if (row.reward.premium) u.premium += row.reward.premium;
  if (row.reward.points) addPoints(state, u, row.reward.points);
  d.luckyCount++;
  dy.lucky++;
  d.luckyLog.push(row.label);
  if (row.jackpot) pushFeed(state, 'luckybox', `${u.name}님이 럭키박스 잭팟을 터뜨렸어요! 먹이 100개!`, who(u));
  return { ok: true, row, left: RULES.luckyPerDay - dy.lucky };
}

// ---------------------------------------------------------------- 이번 주 보스와 가위바위보
export function playRps(state, userId, hand, rand = Math.random) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  if (!HANDS[hand]) return { ok: false, reason: '가위, 바위, 보 중에 골라 주세요' };
  const dy = daily(state, u);
  if (dy.rps >= RULES.rpsPerDay) return { ok: false, reason: '오늘 도전을 모두 했어요. 내일 다시 도전해요!' };
  const keys = Object.keys(HANDS);
  const boss = keys[Math.floor(rand() * keys.length)];
  if (boss === hand) return { ok: true, outcome: 'draw', boss };

  const win = BEATS[hand] === boss;
  const before = u.food;
  u.food = Math.floor(before * (win ? RULES.rps.winMultiplier : RULES.rps.loseRatio));
  d.rpsCount++;
  dy.rps++;
  d.rpsLog.push(win ? 'win' : 'lose');
  const hit = win ? dealDamage(state, u, RULES.boss.rpsWinDamage + (hasSkill(state, u.teamId, 'rps') ? 20 : 0), 'rps') : null;   // 하늘 정찰
  if (win) pushFeed(state, 'food', `${u.name}님이 ${josa(bossOf(state.week).name, '과/와')}의 가위바위보에서 이겼어요! 먹이 ${u.food}개`, who(u));
  return { ok: true, outcome: win ? 'win' : 'lose', boss, before, after: u.food, left: RULES.rpsPerDay - dy.rps, dmg: hit?.dmg || 0, held: hit?.held || 0, defeated: !!hit?.defeated };
}

// ---------------------------------------------------------------- 쿠폰 뽑기와 아이템
export function pullGacha(state, userId, rand = Math.random) {
  const u = state.users[userId];
  if (u.points < RULES.gachaCost) return { ok: false, reason: `포인트가 ${RULES.gachaCost - u.points} 부족해요` };
  u.points -= RULES.gachaCost;
  let item = pickWeighted(GACHA, rand).item;
  if (item === 'coffee') {
    if (state.coffeeStock > 0) state.coffeeStock--;
    else item = 'booster';
  }
  u.items[item]++;
  if (item === 'coffee') pushFeed(state, 'coffee', `${u.name}님이 쿠폰 뽑기에서 커피 교환권을 뽑았어요!`, who(u));
  return { ok: true, item };
}

export function useBooster(state, userId) {
  const u = state.users[userId];
  if (!u.items.booster) return { ok: false, reason: '부스터가 없어요' };
  const team = state.teams[u.teamId];
  const now = Date.now();
  u.items.booster--;
  team.boosterUntil = Math.max(now, team.boosterUntil) + RULES.booster.minutes * MIN;
  pushFeed(state, 'booster', `${u.name}님이 ${teamById(u.teamId).community}에 경험치 부스터를 켰어요!`, who(u));
  return { ok: true, until: team.boosterUntil };
}

// 응원 풍선: 다른 팀의 먹이 경험치를 올려 주고, 보낸 팀은 우정 점수를 얻는다
export function throwCheer(state, userId, targetId) {
  const u = state.users[userId];
  if (!u.items.cheer) return { ok: false, reason: '응원 풍선이 없어요' };
  if (targetId === u.teamId || !state.teams[targetId]) return { ok: false, reason: '응원할 다른 커뮤니티를 골라 주세요' };
  u.items.cheer--;
  const target = state.teams[targetId];
  const now = Date.now();
  const waves = hasSkill(state, u.teamId, 'wave') ? 2 : 1;                       // 마음의 물결
  target.cheerUntil = Math.max(now, target.cheerUntil) + RULES.cheer.minutes * MIN * waves;
  target.cheerFrom = u.teamId;
  if (isPlayWeek(state.week)) {
    const mine = state.teams[u.teamId];
    mine.friendByWeek[state.week] = (mine.friendByWeek[state.week] || 0) + 1;
    weekly(state, u).friend++;
  }
  pushFeed(state, 'cheer', `${teamById(u.teamId).community} ${u.name}님이 ${teamById(targetId).monster}에게 응원 풍선을 보냈어요! `
    + `${RULES.cheer.minutes}분 동안 경험치 ×${RULES.cheer.multiplier}`, who(u));
  return { ok: true, until: target.cheerUntil };
}

export function redeemCoffee(state, userId) {
  const u = state.users[userId];
  if (!u.items.coffee) return { ok: false, reason: '커피 교환권이 없어요' };
  u.items.coffee--;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const code = `HMD-${part()}-${part()}`;
  u.coupons.unshift({ code, ts: Date.now(), done: false });
  return { ok: true, code };
}

export const GIFT_KINDS = {
  food: { name: '먹이', icon: 'food', has: (u) => u.food, move: (a, b) => { a.food--; b.food++; } },
  premium: { name: '고급 먹이', icon: 'premium', has: (u) => u.premium, move: (a, b) => { a.premium--; b.premium++; } },
  ...Object.fromEntries(Object.entries(ITEMS).map(([k, it]) => [k, {
    name: it.name, icon: it.icon, has: (u) => u.items[k], move: (a, b) => { a.items[k]--; b.items[k]++; },
  }])),
};

// 선물은 모든 커뮤니티에게 줄 수 있다. 다른 팀에게 준 선물은 우정 점수(한 주 한도 있음)
export function gift(state, fromId, toId, kind) {
  const a = state.users[fromId];
  const b = state.users[toId];
  const g = GIFT_KINDS[kind];
  if (!b || a.id === b.id) return { ok: false, reason: '선물 받을 사람을 골라 주세요' };
  if (!g || !g.has(a)) return { ok: false, reason: '줄 수 있는 아이템이 없어요' };
  g.move(a, b);
  const cross = a.teamId !== b.teamId;
  let friend = false;
  if (cross && isPlayWeek(state.week)) {
    const d = weekly(state, a);
    if (d.friendGifts < RULES.friend.giftCapPerWeek) {
      d.friendGifts++;
      const plus = hasSkill(state, a.teamId, 'friend') ? 2 : 1;   // 연결망
      d.friend += plus;
      const mine = state.teams[a.teamId];
      mine.friendByWeek[state.week] = (mine.friendByWeek[state.week] || 0) + plus;
      friend = true;
    }
  }
  pushFeed(state, g.icon, cross
    ? `${a.name}님이 ${teamById(b.teamId).community} ${b.name}님에게 ${josa(g.name, '을/를')} 선물했어요`
    : `${a.name}님이 ${b.name}님에게 ${josa(g.name, '을/를')} 선물했어요`, who(a));
  return { ok: true, friend };
}

// ---------------------------------------------------------------- G-DEAL 관리인의 지원 (운영자)
// 아직 힘이 부족한 커뮤니티에 먹이를 보내 준다
// 운영자가 보스 세기를 바꾼다 (참여가 적으면 약하게, 너무 쉬우면 세게)
export function setBossScale(state, scale) {
  const list = RULES.boss.scales;
  const v = Number(scale);
  if (!list.includes(v)) return { ok: false, reason: `세기는 ${list.join(', ')} 중에서 골라 주세요` };
  if ((state.bossScale || 1) === v) return { ok: false, reason: '이미 그 세기예요' };
  state.bossScale = v;
  const word = v < 1 ? '약하게' : v > 1 ? '세게' : '보통으로';
  pushFeed(state, 'booster', `운영진이 보스 세기를 ${word} 맞췄어요. 지금 보스 체력은 ${liveMaxHp(state).toLocaleString('ko-KR')}이에요.`);
  return { ok: true, scale: v, maxHp: liveMaxHp(state) };
}

export function supportTeam(state, teamId, food = RULES.support.food) {
  const t = teamById(teamId);
  if (!t) return { ok: false, reason: '커뮤니티를 골라 주세요' };
  const n = Math.max(1, Math.min(100, Math.round(Number(food) || RULES.support.food)));
  const members = teamMembers(state, teamId);
  if (!members.length) return { ok: false, reason: `${t.community}에는 아직 대원이 없어요` };
  members.forEach((u) => { u.food += n; });
  pushFeed(state, 'food', `G-DEAL 관리인이 ${t.community} 대원 ${members.length}명에게 먹이 ${n}개씩 보냈어요! 힘내요!`, { teamId });
  return { ok: true, count: members.length, food: n };
}

// 몫 달성률이 가장 높은 팀의 절반에 못 미치는 팀들을 한꺼번에 돕는다
export function supportBehind(state, food = RULES.support.food) {
  const list = allianceList(state).filter((t) => t.members > 0);
  if (!list.length) return { ok: false, reason: '아직 대원이 없어요' };
  const best = Math.max(...list.map((t) => t.rate));
  const behind = list.filter((t) => t.rate <= best / 2);
  if (!behind.length) return { ok: false, reason: '지금은 뒤처진 커뮤니티가 없어요' };
  const teams = behind.map((t) => supportTeam(state, t.id, food)).filter((r) => r.ok);
  return { ok: true, teams: behind.map((t) => t.id), count: teams.length, food };
}

// ---------------------------------------------------------------- 골든타임 (운영자)
export function startGolden(state, minutes = RULES.golden.minutes) {
  const m = Math.max(5, Math.min(180, Number(minutes) || RULES.golden.minutes));
  state.goldenUntil = Date.now() + m * MIN;
  pushFeed(state, 'booster', `골든타임 시작! ${m}분 동안 모든 원정대의 먹이 경험치(=보스 피해)가 ${RULES.golden.multiplier}배예요`);
  return { ok: true, until: state.goldenUntil, minutes: m };
}

export function stopGolden(state) {
  state.goldenUntil = 0;
  return { ok: true };
}

// ---------------------------------------------------------------- 원정대 현황과 활약
// 9팀 현황 (config 순서 그대로 — 순위가 아니라 함께 가는 모습을 보여 준다)
export function allianceList(state, w = state.week) {
  const members = {};
  for (const u of Object.values(state.users)) members[u.teamId] = (members[u.teamId] || 0) + 1;
  return TEAMS.map((t) => {
    const s = state.teams[t.id];
    const share = teamShare(state, t.id);
    const dmg = s.dmgByWeek[w] || 0;
    return {
      ...t, s, exp: s.exp, info: levelInfo(s.exp), members: members[t.id] || 0,
      active: activeCount(state, t.id, w), share, dmg, rate: share ? dmg / share : 0, friend: s.friendByWeek[w] || 0,
    };
  });
}

// 개인 활약: 보스에게 준 피해 (이번 주 / 전체)
export function crewRanking(state, mode) {
  const score = (u) => (mode === 'week' ? (u.weekly.week === state.week ? u.weekly.dmg || 0 : 0) : u.totalDmg || 0);
  return Object.values(state.users)
    .map((u) => ({ u, score: score(u) }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---------------------------------------------------------------- 랭킹 보드
// 개인 기록 랭킹 (프리 모드·정규 시즌 상관없이 계속 쌓인다)
export const RANK_KEYS = {
  dmg:    { label: '보스 피해', unit: '',   get: (u) => u.totalDmg || 0 },
  correct:{ label: '맞힌 문제', unit: '개', get: (u) => u.totalCorrect || 0 },
  cards:  { label: 'AI 한 조각', unit: '장', get: (u) => (u.cards || []).length },
  points: { label: '모은 포인트', unit: 'P', get: (u) => u.totalPoints || 0 },
  clears: { label: '보스 격파', unit: '회', get: (u) => u.clears || 0 },
};
export function personalRanking(state, key = 'dmg') {
  const g = (RANK_KEYS[key] || RANK_KEYS.dmg).get;
  return Object.values(state.users)
    .map((u) => ({ u, score: g(u) }))
    .sort((a, b) => b.score - a.score || (b.u.totalPoints || 0) - (a.u.totalPoints || 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// 시즌(또는 프리 모드 한 바퀴) 기록을 남긴다. 초기화해도 이 기록은 이어진다.
export function archiveSeason(state, mode = 'season', no = null) {
  const list = TEAMS.map((t) => {
    const team = state.teams[t.id];
    const dmg = Object.values(team.dmgByWeek || {}).reduce((s, n) => s + n, 0);
    return { id: t.id, dmg, exp: team.exp, level: levelInfo(team.exp).level, members: teamMemberCount(state, t.id) };
  }).sort((a, b) => b.dmg - a.dmg);
  const top = personalRanking(state, 'dmg').slice(0, 3).map((r) => ({ name: r.u.name, teamId: r.u.teamId, score: r.score }));
  const king = personalRanking(state, 'correct')[0];
  const seals = BOSSES.filter((b) => state.bosses[b.week]?.defeatedAt).length;
  const rec = {
    no: no ?? (state.seasons || []).filter((x) => x.mode === mode).length + 1,
    mode, at: Date.now(), weeks: state.week, seals,
    teams: list.slice(0, 3).map((t) => ({ id: t.id, dmg: t.dmg, level: t.level })),
    top, king: king && king.score ? { name: king.u.name, teamId: king.u.teamId, score: king.score } : null,
    users: Object.keys(state.users).length,
  };
  state.seasons = [rec, ...(state.seasons || [])].slice(0, 12);
  return rec;
}

// 주간 지식왕: 그 주 퀴즈를 모두 맞힌 사람 중 가장 빨리 끝낸 사람. 없으면 그 주 포인트 1위.
export function knowledgeKing(state, week = state.week) {
  const players = Object.values(state.users).filter((u) => u.weekly.week === week);
  const perfect = players
    .filter((u) => u.weekly.quizDoneAt && u.weekly.quiz.length && u.weekly.quiz.every((a) => a && a.correct))
    .sort((a, b) => a.weekly.quizDoneAt - b.weekly.quizDoneAt);
  if (perfect.length) return { user: perfect[0], perfect: true, list: perfect.slice(0, 3) };
  const byPoints = players.filter((u) => u.weekly.points > 0).sort((a, b) => b.weekly.points - a.weekly.points);
  return byPoints.length ? { user: byPoints[0], perfect: false, list: byPoints.slice(0, 3) } : null;
}

// 에이스 대원: 그 주 보스에게 가장 큰 피해를 준 사람
export function weeklyAce(state, week = state.week) {
  const best = Object.values(state.users)
    .filter((u) => u.weekly.week === week && u.weekly.dmg > 0)
    .sort((a, b) => b.weekly.dmg - a.weekly.dmg)[0];
  return best ? { user: best, dmg: best.weekly.dmg } : null;
}

export const hasCrown = (state, teamId) => state.teams[teamId].crownWeek === state.week && state.week > 0;

// ---------------------------------------------------------------- 한 주 마무리
export function advanceWeek(state) {
  if (state.week >= FINAL_WEEK) return { ok: false, reason: '이미 현장 모임 날이에요' };
  const w = state.week;
  let award = null;

  const R = paceOf(state).round;
  if (isPlayWeek(w)) {
    const boss = bossOf(w);
    const rec = (state.bosses[w] ||= { dmg: 0, defeatedAt: 0, maxHpAtDefeat: 0, escaped: false });
    const info = bossInfo(state, w);
    if (!rec.defeatedAt) {
      if (info.holding) markDefeat(state, w, info);   // 마지막까지 버티던 보스는 회차가 끝나는 순간 쓰러진다
      else {
        rec.escaped = true;
        rec.maxHpAtEnd = info.maxHp;
      }
    }
    const list = allianceList(state, w);
    adaptBoss(state, w);                     // 이번 회차 성적 → 다음 보스 난이도
    const activeOf = (teamId) => Object.values(state.users).filter((u) => u.teamId === teamId && u.visitedWeeks.includes(w));

    // 우리 팀 몫을 채운 팀은 그 주 참여 팀원 모두 보상
    const shares = list.filter((t) => t.share > 0)
      .map((t) => ({ teamId: t.id, dmg: t.dmg, share: t.share, active: t.active, members: t.members, friend: t.friend, done: t.dmg >= t.share }));
    for (const s of shares) {
      if (s.done) activeOf(s.teamId).forEach((u) => grant(u, { premium: RULES.teamShare.rewardPremium, points: RULES.teamShare.rewardPoints }));
    }

    // 개별 우수팀·개인 (팀 크기에 공평하도록 MVP는 몫 달성률로 뽑는다)
    const mvp = shares.filter((s) => s.dmg > 0).sort((a, b) => b.dmg / b.share - a.dmg / a.share || b.dmg - a.dmg)[0];
    const friend = list.filter((t) => t.friend > 0).sort((a, b) => b.friend - a.friend || b.dmg - a.dmg)[0];
    const join = list.filter((t) => t.members >= RULES.awards.joinMinMembers && t.active > 0)
      .sort((a, b) => b.active / b.members - a.active / a.members || b.active - a.active)[0];
    const king = knowledgeKing(state, w);
    const ace = weeklyAce(state, w);
    if (mvp) {
      state.teams[mvp.teamId].crownWeek = w + 1;
      activeOf(mvp.teamId).forEach((u) => grant(u, { premium: RULES.awards.mvpPremium }));
    }
    if (friend) activeOf(friend.id).forEach((u) => grant(u, { points: RULES.awards.friendPoints }));
    if (join) activeOf(join.id).forEach((u) => grant(u, { points: RULES.awards.joinPoints }));

    award = {
      boss: { id: boss.id, defeated: !!rec.defeatedAt, dmg: rec.dmg, maxHp: info.maxHp },
      mvpTeam: mvp?.teamId ?? null, mvpRate: mvp ? mvp.dmg / mvp.share : 0,
      friendTeam: friend?.id ?? null, friendScore: friend?.friend ?? 0,
      joinTeam: join?.id ?? null, joinRate: join ? join.active / join.members : 0,
      kingId: king?.user.id ?? null, kingPerfect: !!king?.perfect,
      aceId: ace?.user.id ?? null, aceDmg: ace?.dmg ?? 0,
      shares,
    };
    state.awards[w] = award;

    if (!rec.defeatedAt) pushFeed(state, 'glitch', `${josa(boss.name, '이/가')} 도망쳐 대마왕 글리치에게 힘을 보탰어요… 최종 결전에서 되갚아 줘요!`, { boss: boss.id });
    const done = shares.filter((s) => s.done).map((s) => teamById(s.teamId).community);
    if (done.length) pushFeed(state, 'premium', `${w}${R} 우리 팀 몫 완수: ${done.join(', ')}! 참여한 팀원 모두 고급 먹이를 받았어요`);
    if (mvp) pushFeed(state, 'crown', `${w}${R} MVP 팀은 ${teamById(mvp.teamId).community}! (몫 달성률 ${Math.round((mvp.dmg / mvp.share) * 100)}%) 왕관을 써요`, { teamId: mvp.teamId });
    if (friend) pushFeed(state, 'cheer', `${w}${R} 우정상은 ${teamById(friend.id).community}! 다른 팀을 ${friend.friend}번 도왔어요`, { teamId: friend.id });
    if (king) pushFeed(state, 'point', `${w}${R} 지식왕은 ${teamById(king.user.teamId).community} ${king.user.name}님!`, who(king.user));
  }

  state.week = w + 1;
  state.hits = [];
  for (const t of TEAMS) state.teams[t.id].expAtWeekStart[state.week] = state.teams[t.id].exp;

  if (state.week === FINAL_WEEK) {
    state.final = createFinal(state);
    pushFeed(state, 'glitch', `사전 원정 끝! 봉인 조각 ${state.final.seals.length}개를 모았어요. ${eventDateLabel(scheduleOf(state))} 한마당 현장에서 대마왕 글리치와 최종 결전!`, { boss: 'glitch' });
  } else {
    const next = bossOf(state.week);
    pushFeed(state, 'luckybox', `${state.week}${R} 원정 시작! ${josa(next.name, '이/가')} 나타났어요. 다 함께 물리쳐요!`, { boss: next.id });
  }
  return { ok: true, week: state.week, award };
}

// 운영자가 시작·끝 날짜를 정한다. 이미 지난 회차로 되돌아가는 일정은 받지 않는다(그럴 때는 초기화 먼저).
export function setSchedule(state, start, end, now = Date.now()) {
  const a = Math.round(Number(start));
  const b = Math.round(Number(end));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok: false, reason: '시작과 끝 날짜를 넣어 주세요' };
  if (b <= a) return { ok: false, reason: '끝 날짜는 시작 날짜보다 뒤여야 해요' };
  if ((b - a) / EVENT.weeks < MIN) return { ok: false, reason: `시작과 끝 사이가 너무 짧아요 (적어도 ${EVENT.weeks}분)` };
  const sch = { start: a, end: b, quick: (b - a) / EVENT.weeks < DAY };   // 하루보다 짧은 회차는 미리 해 보기로 본다
  const target = weekForTime(sch, now);
  if (target < state.week) {
    // 아직 보스 공격·시상·결전 기록이 없으면 앞 회차(또는 모집 기간)로 미룰 수 있다
    const played = Object.keys(state.awards).length > 0 || !!state.final || Object.values(state.bosses).some((x) => x.dmg > 0);
    if (played) {
      return { ok: false, reason: '이미 원정 기록이 쌓여서 앞 회차로 되돌릴 수 없어요. 날짜를 미루려면 "전체 초기화"를 한 뒤 다시 저장해 주세요.' };
    }
    state.week = target;
    state.hits = [];
  }
  state.schedule = sch;
  const P = paceFor(sch);
  pushFeed(state, 'booster', `운영진이 일정을 정했어요: ${weekDates(sch, 1).start} 시작 → ${eventDateLabel(sch)} 현장 결전. ${P.label}마다 새 ${P.round}가 열려요!`);
  return { ok: true };
}

// 빠른 미리 해 보기: 지금 회차가 이 순간 새로 시작하고, 고른 시간마다 다음 회차가 열린다
export function setPace(state, pace, now = Date.now()) {
  const Q = PACES[pace];
  if (!Q) return { ok: false, reason: '속도를 골라 주세요' };
  const w = Math.max(1, Math.min(state.week, FINAL_WEEK));
  const start = now - (w - 1) * Q.ms;
  state.schedule = { start, end: start + EVENT.weeks * Q.ms, quick: Q.ms < DAY };
  pushFeed(state, 'booster', `미리 해 보기! 지금부터 ${Q.label}마다 새 회차가 열려요. 퀴즈·보스·럭키박스 횟수도 그때마다 새로 바뀌어요.`);
  return { ok: true, pace };
}

// 빠른 미리 해 보기에서 운영자가 회차를 앞당기면, 새 회차가 지금 시작한 것으로 일정을 맞춘다
export function rebaseSchedule(state, now = Date.now()) {
  const sch = scheduleOf(state);
  if (!sch.quick || state.week < 1) return;
  const len = roundLength(sch);
  const start = now - (Math.min(state.week, FINAL_WEEK) - 1) * len;
  state.schedule = { start, end: start + EVENT.weeks * len, quick: true };
}

// 시간이 되면 자동으로 주차를 넘긴다 (앞으로만 간다. 운영자가 미리 넘긴 주차는 그대로 둔다)
export function syncWeek(state, now = Date.now()) {
  if (isFree(state)) return false;                       // 프리 모드는 날짜로 넘어가지 않는다
  const target = weekForTime(scheduleOf(state), now);
  let changed = false;
  while (state.week < target && advanceWeek(state).ok) changed = true;
  return changed;
}

// ---------------------------------------------------------------- 최종 결전 (12/19 현장)
// 결전 전에도 지금까지 모은 봉인과 예상 체력을 보여 준다
// 결전의 날에 실제로 움직인 사람 수 (퀴즈·먹이든 응원이든 한 번이라도 한 사람)
export const presentCount = (state) => Object.values(state.users)
  .filter((u) => u.weekly.week >= FINAL_WEEK || (state.final?.cheerTotal?.[u.id] || 0) > 0).length;

// 최종 보스 체력 = (몬스터 공격 + 예상 응원) ÷ 한 라운드 몫 + 모아 둔 지혜, 도망친 보스마다 조금 더
export function finalMaxHp(state, wisdom = 0, present = Object.keys(state.users).length) {
  const F = RULES.final;
  const escaped = BOSSES.filter((b) => b.week < state.week && !state.bosses[b.week]?.defeatedAt).map((b) => b.week);
  const monsterRound = F.hitsPerRound * TEAMS.reduce((s, t) => s + F.atk + F.atkPerLevel * levelInfo(state.teams[t.id].exp).level, 0);
  const cheerRound = F.cheerExpectPerUser * Math.max(1, present) * F.cheerDamage;
  return Math.round((((monsterRound + cheerRound) / F.roundShare) + wisdom) * (1 + F.escapeAdd * escaped.length));
}

export function finalPreview(state) {
  if (state.final) return state.final;
  const seals = BOSSES.filter((b) => state.bosses[b.week]?.defeatedAt).map((b) => b.week);
  const escaped = BOSSES.filter((b) => b.week < state.week && !state.bosses[b.week]?.defeatedAt).map((b) => b.week);
  return { maxHp: finalMaxHp(state, 0, Object.keys(state.users).length), dmg: 0, seals, escaped, rounds: [], preview: true };
}

function createFinal(state) {
  const f = finalPreview({ ...state, final: null, week: FINAL_WEEK });
  return {
    maxHp: f.maxHp, dmg: 0, seals: f.seals, escaped: f.escaped,
    cheers: {}, cheerBy: {}, cheerTotal: {}, cheerUntil: 0, cheerRound: 0, recentCheer: [], wisdom: 0, wisdomBy: {},
    rounds: [], dmgByTeam: {}, wonAt: 0, awards: null,
  };
}

export const cheerOpen = (state, now = Date.now()) => !!state.final && !state.final.wonAt && state.final.cheerUntil > now;

export function openCheer(state, seconds) {
  const f = state.final;
  if (!f) return { ok: false, reason: '최종 결전 날에만 열 수 있어요' };
  if (f.wonAt) return { ok: false, reason: '이미 글리치를 물리쳤어요' };
  const s = Math.max(10, Math.min(120, Math.round(Number(seconds) || RULES.final.cheerSeconds)));
  f.cheerUntil = Date.now() + s * 1000;
  f.cheerRound++;
  f.cheerBy = {};
  pushFeed(state, 'cheer', `응원 타임! ${s}초 동안 응원하기 버튼을 마구 눌러 주세요!`);
  return { ok: true, until: f.cheerUntil, seconds: s };
}

// 현장 응원: 폰에서 누른 횟수를 모아 몇 초마다 보낸다
export function addCheers(state, userId, n) {
  const f = state.final;
  const u = state.users[userId];
  if (!f || f.wonAt || Date.now() > f.cheerUntil + CHEER_GRACE) return { ok: false, reason: '지금은 응원 타임이 아니에요' };
  const F = RULES.final;
  const want = Math.max(0, Math.min(F.cheerSendMax, Math.floor(Number(n) || 0)));
  const used = f.cheerBy[userId] || 0;
  const add = Math.min(want, F.cheerUserMax - used);
  if (add <= 0) return { ok: false, reason: want ? '이번 응원 타임에 보낼 수 있는 응원을 모두 보냈어요' : '보낼 응원이 없어요' };
  f.cheerBy[userId] = used + add;
  f.cheerTotal[userId] = (f.cheerTotal[userId] || 0) + add;
  f.cheers[u.teamId] = (f.cheers[u.teamId] || 0) + (hasSkill(state, u.teamId, 'cheer') ? Math.round(add * 1.1) : add);   // 확성기
  f.recentCheer = [{ uid: u.id, name: u.name, avatar: u.avatar, teamId: u.teamId, n: f.cheerBy[userId], ts: Date.now() },
    ...f.recentCheer.filter((c) => c.uid !== u.id)].slice(0, 30);
  return { ok: true, added: add, mine: f.cheerBy[userId] };
}

// 인터넷이 느릴 때 대신 쓰는 현장 응원 직접 넣기 (teamId 'all'이면 모든 팀에 똑같이)
export function addManualCheers(state, teamId, n) {
  const f = state.final;
  if (!f || f.wonAt) return { ok: false, reason: '결전 중에만 넣을 수 있어요' };
  const k = Math.max(0, Math.min(100000, Math.floor(Number(n) || 0)));
  if (!k) return { ok: false, reason: '응원 수를 넣어 주세요' };
  const ids = teamId === 'all' ? TEAMS.map((t) => t.id) : [teamId];
  if (!ids.every((id) => state.teams[id])) return { ok: false, reason: '팀을 골라 주세요' };
  for (const id of ids) f.cheers[id] = (f.cheers[id] || 0) + k;
  return { ok: true };
}

// 한 라운드: (첫 라운드만) 봉인 조각 → 9마리가 차례로 공격 → 글리치 반격(연출) → 응원 에너지 폭발
// 피해는 라운드마다 쌓이므로 여러 번 하면 결국 반드시 이긴다.
export function finalAttack(state, rand = Math.random) {
  const f = state.final;
  if (!f) return { ok: false, reason: '최종 결전 날에만 공격할 수 있어요' };
  if (f.wonAt) return { ok: false, reason: '이미 글리치를 물리쳤어요' };
  if (f.cheerUntil > Date.now()) return { ok: false, reason: '응원 타임이 끝난 뒤에 공격할 수 있어요' };
  const F = RULES.final;
  // 첫 공격 직전에 실제로 온 인원으로 체력을 다시 잡는다 (그전 숫자는 '예상')
  if (!f.rounds.length) {
    const floor = Math.ceil(Object.keys(state.users).length * F.presentFloor);
    f.maxHp = finalMaxHp(state, 0, Math.max(presentCount(state), floor, 1));
  }
  let hp = f.maxHp - f.dmg;
  const hpBefore = hp;
  const events = [];
  let won = false;
  const hit = (ev) => {
    if (won) return;
    const d = Math.min(ev.dmg, hp);
    hp -= d;
    f.dmg += d;
    ev.dmg = d;
    ev.hp = hp;
    if (ev.teamId) f.dmgByTeam[ev.teamId] = (f.dmgByTeam[ev.teamId] || 0) + d;
    events.push(ev);
    if (hp <= 0) won = true;
  };

  const no = f.rounds.length + 1;
  if (no === 1) for (const w of f.seals) hit({ type: 'seal', week: w, dmg: Math.round(f.maxHp * F.sealCut) });
  for (let h = 0; h < F.hitsPerRound && !won; h++) {
    for (const t of TEAMS) {
      const lv = levelInfo(state.teams[t.id].exp).level;
      const crit = rand() < F.critRate;
      hit({ type: 'hit', teamId: t.id, lv, crit, dmg: Math.round((F.atk + F.atkPerLevel * lv) * (0.85 + rand() * 0.3) * (crit ? F.critMul : 1)) });
    }
    if (!won) events.push({ type: 'boss', teamId: TEAMS[Math.floor(rand() * TEAMS.length)].id, move: Math.floor(rand() * 4), hp });
  }
  if (f.wisdom > 0 && !won) {
    hit({ type: 'wisdom', count: Math.round(f.wisdom / F.wisdomPerCorrect), dmg: Math.min(f.wisdom, Math.round(f.maxHp * F.wisdomCut)) });
    f.wisdom = 0;
  }
  for (const t of TEAMS) {
    const c = f.cheers[t.id] || 0;
    if (c > 0) hit({ type: 'cheer', teamId: t.id, count: c, dmg: Math.max(1, Math.round(c * F.cheerDamage)) });
  }
  f.cheers = {};
  const round = { no, at: Date.now(), hpBefore, hpAfter: hp, won, events };
  f.rounds.push(round);

  if (won) {
    f.wonAt = Date.now();
    finishFinal(state);
    pushFeed(state, 'crown', `승리! 원정대가 대마왕 글리치를 물리쳤어요! ${EVENT.slogan}`, { boss: 'glitch' });
  } else {
    pushFeed(state, 'glitch', `${no}라운드 끝! 글리치 남은 체력 ${hp.toLocaleString('ko-KR')}. 한 번 더 응원해 주세요!`, { boss: 'glitch' });
  }
  return { ok: true, round, won };
}

// 결전이 끝나면 현장 상과 "?" 상품의 주인을 정한다
function finishFinal(state) {
  const f = state.final;
  const users = Object.values(state.users);
  const bestTeam = (score) => {
    const top = TEAMS.map((t) => ({ id: t.id, v: score(t.id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)[0];
    return top ? { type: 'team', id: top.id, value: top.v } : null;
  };
  const bestUser = (score) => {
    const top = users.map((u) => ({ id: u.id, v: score(u) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)[0];
    return top ? { type: 'user', id: top.id, value: top.v } : null;
  };
  const season = (teamId, key) => Object.values(state.awards).reduce((s, a) => s + (a.shares?.find((x) => x.teamId === teamId)?.[key] || 0), 0);
  const weeksPlayed = Math.max(1, Object.keys(state.awards).length);

  f.awards = {
    finalMvp: bestTeam((id) => f.dmgByTeam[id] || 0),
    seasonMvp: bestTeam((id) => { const share = season(id, 'share'); return share ? season(id, 'dmg') / share : 0; }),
    friend: bestTeam((id) => Object.values(state.teams[id].friendByWeek).reduce((s, n) => s + n, 0)),
    join: bestTeam((id) => {
      const members = teamMemberCount(state, id);
      return members >= RULES.awards.joinMinMembers ? season(id, 'active') / (members * weeksPlayed) : 0;
    }),
    king: bestUser((u) => u.totalCorrect * 1000 + u.totalPoints / 1000),
    ace: bestUser((u) => u.totalDmg),
    cheerKing: bestUser((u) => f.cheerTotal[u.id] || 0),
    steady: bestUser((u) => (u.onTime || 0) * 1000 + (u.cards?.length || 0)),
  };
  for (const p of state.prizes) if (!p.winner && f.awards[p.award]) p.winner = { type: f.awards[p.award].type, id: f.awards[p.award].id };
}

// ---------------------------------------------------------------- 현장 상품 "?" 상자
export function savePrizes(state, list) {
  if (!Array.isArray(list) || list.length > 30) return { ok: false, reason: '상품은 30개까지 넣을 수 있어요' };
  state.prizes = list.map((p, i) => {
    const award = PRIZE_AWARDS[p?.award] ? p.award : 'lucky';
    const name = String(p?.name ?? '').replace(/\p{Cc}|[<>]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const old = state.prizes[i];
    const keep = old && old.award === award;
    let winner = keep ? old.winner : null;
    if (!winner && state.final?.awards?.[award]) winner = { type: state.final.awards[award].type, id: state.final.awards[award].id };
    return { name, award, winner, openedAt: keep ? old.openedAt : 0 };
  });
  return { ok: true };
}

export function drawLucky(state, index, rand = Math.random) {
  const p = state.prizes[index];
  if (!p || p.award !== 'lucky') return { ok: false, reason: '행운 추첨 상품이 아니에요' };
  if (p.winner) return { ok: false, reason: '이미 주인이 정해졌어요' };
  const won = new Set(state.prizes.filter((x) => x.award === 'lucky' && x.winner).map((x) => x.winner.id));
  const pool = Object.values(state.users)
    .filter((u) => (u.visitedWeeks.length || state.final?.cheerTotal?.[u.id]) && !won.has(u.id));
  if (!pool.length) return { ok: false, reason: '추첨할 참가자가 없어요' };
  const u = pool[Math.floor(rand() * pool.length)];
  p.winner = { type: 'user', id: u.id };
  pushFeed(state, 'prize', `행운 추첨! 상품 ${index + 1}번 “?” 상자의 주인공은 ${teamById(u.teamId).community} ${u.name}님!`, who(u));
  return { ok: true, userId: u.id };
}

export const prizeWinnerName = (state, winner) => {
  if (!winner) return '';
  if (winner.type === 'team') return teamById(winner.id)?.community ?? '';
  const u = state.users[winner.id];
  return u ? `${u.name}님` : '';
};

export function canOpenPrize(state, userId, p) {
  if (!p?.winner || p.openedAt) return false;
  if (p.winner.type === 'user') return p.winner.id === userId;
  return state.users[userId]?.teamId === p.winner.id;
}

// 받은 사람(팀이면 팀원 누구나)이나 운영자(userId 없이)가 연다
export function openPrize(state, index, userId = null) {
  const p = state.prizes[index];
  if (!p) return { ok: false, reason: '없는 상품이에요' };
  if (!p.winner) return { ok: false, reason: '아직 주인이 정해지지 않았어요' };
  if (p.openedAt) return { ok: false, reason: '이미 열린 상자예요' };
  if (userId && !canOpenPrize(state, userId, p)) return { ok: false, reason: '상품을 받은 팀이나 사람만 열 수 있어요' };
  if (!p.name) return { ok: false, reason: '운영진이 아직 상품을 넣지 않았어요. 조금만 기다려 주세요!' };
  p.openedAt = Date.now();
  p.openedBy = userId || 'admin';
  const u = userId ? state.users[userId] : null;
  pushFeed(state, 'prize', `상품 ${index + 1}번 공개! ${prizeWinnerName(state, p.winner)}에게 「${p.name}」!`, u ? who(u) : {});
  return { ok: true, name: p.name, index };
}
