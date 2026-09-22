// 게임 규칙. 모든 함수는 state를 직접 바꾸고 결과 객체를 돌려준다.
// 판정은 서버(server/api.js)가 이 파일로 한다. 브라우저는 계산된 값을 화면에 보여 줄 때만 쓴다.
//
// 일정은 '주' 단위다. week 0 = 시즌 시작 전, 1~4 = 사전 원정 주, FINAL_WEEK = 현장 모임(최종 결전).
// 협력형: 9개 커뮤니티가 한 원정대다. 원래 하던 활동(먹이·퀴즈·가위바위보)이 그대로 그 주 보스 공격이 되고,
// 모두 함께 보스를 쓰러뜨리면 참여자 전원이 보상을 받는다. 현장 모임 날에는 다 함께 대마왕 글리치와 싸운다.
import {
  EVENT, TEAMS, RULES, LUCKY_BOX, GACHA, ITEMS, STAGES, BOSSES, AVATARS, PRIZE_AWARDS, DEFAULT_PRIZES, PACES, expForLevel,
} from './config.js';

export const SCHEMA = 3; // 저장 데이터 모양이 바뀌면 올린다 (예전 모양은 새로 시작)
export const FINAL_WEEK = EVENT.weeks + 1;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const HITS_LIMIT = 24;      // 보스 전투 장면에 보여 줄 최근 공격 수
const CHEER_GRACE = 3000;   // 응원 타임이 끝난 뒤에도 늦게 도착한 응원을 받아 주는 시간
export const HANDS = { rock: '✊', scissors: '✌️', paper: '✋' };
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export const teamById = (id) => TEAMS.find((t) => t.id === id);
export const bossOf = (week) => BOSSES.find((b) => b.week === week) ?? null;
export const isAvatar = (id) => AVATARS.some((a) => a.id === id);

// ---------------------------------------------------------------- 일정
// 일정(schedule)은 게임 상태에 저장된다: { pace, start, real }
//   실제 일정: 1주일 속도, 11월 21일(토) 0시 시작 (현장 모임 12월 19일 - 4주)
//   미리 해 보기: 운영자가 고른 속도(1일·1시간·30분·10분)로, 고른 순간부터 시작
const EVENT_MS = Date.parse(`${EVENT.eventDate}T00:00:00+09:00`);
const SEASON_START_MS = EVENT_MS - EVENT.weeks * 7 * DAY;

export const realSchedule = () => ({ pace: 'week', start: SEASON_START_MS, real: true });
export const scheduleOf = (state) => state?.schedule || realSchedule();
export const paceOf = (state) => PACES[scheduleOf(state).pace] || PACES.week;
const periodMs = (sch) => (PACES[sch.pace] || PACES.week).ms;
export const roundStart = (sch, week) => sch.start + (week - 1) * periodMs(sch);
export const eventStart = (sch) => roundStart(sch, FINAL_WEEK);

// 지금 몇 주차(회차)인지 — 시작 시각에 1주차가 열리고, 속도만큼 지나면 다음 주차
export function weekForTime(sch, now = Date.now()) {
  if (now < sch.start) return 0;
  return Math.min(FINAL_WEEK, Math.floor((now - sch.start) / periodMs(sch)) + 1);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function kst(ms) {
  const d = new Date(ms + 9 * 60 * MIN); // UTC 기준 필드로 한국 날짜·시각을 읽는다
  return { mo: d.getUTCMonth() + 1, da: d.getUTCDate(), wd: WEEKDAYS[d.getUTCDay()], h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
const dateLabel = (ms) => { const k = kst(ms); return `${k.mo}월 ${k.da}일(${k.wd})`; };
const clockLabel = (ms) => { const k = kst(ms); return `${k.h}:${String(k.mi).padStart(2, '0')}`; };
function whenLabel(sch, ms) {
  if (sch.real) return dateLabel(ms);
  return periodMs(sch) >= DAY ? `${dateLabel(ms)} ${clockLabel(ms)}` : clockLabel(ms);
}

// 주차별 기간 표시. 실제: { start: '11월 21일(토)', end: '11월 27일(금)' }, 10분 속도: { start: '14:00', end: '14:09' }
export function weekDates(sch, week) {
  const w = Math.min(Math.max(1, week), FINAL_WEEK);
  const start = roundStart(sch, w);
  if (w >= FINAL_WEEK) return { start: whenLabel(sch, start), end: whenLabel(sch, start) };
  return { start: whenLabel(sch, start), end: whenLabel(sch, start + periodMs(sch) - (sch.real ? DAY : MIN)) };
}

export const eventDateLabel = (sch) => (sch.real ? dateLabel(eventStart(sch)) : `${dateLabel(eventStart(sch))} ${clockLabel(eventStart(sch))}`);

// 현장 모임(결전)까지 남은 날 (실제 일정 기준, 당일 0)
export function daysToEvent(sch, now = Date.now()) {
  const kstToday = Math.floor((now + 9 * 60 * MIN) / DAY);
  const kstEvent = Math.floor((eventStart(sch) + 9 * 60 * MIN) / DAY);
  return kstEvent - kstToday;
}

// 결전까지 남은 시간 표시: 실제 일정은 'D-88', 미리 해 보기는 '1시간 20분 뒤' 같은 모양
export function untilEventLabel(sch, now = Date.now()) {
  if (sch.real) {
    const d = daysToEvent(sch, now);
    return d > 0 ? `D-${d}` : 'D-DAY';
  }
  const left = eventStart(sch) - now;
  if (left <= 0) return 'D-DAY';
  if (left >= DAY) return `D-${Math.ceil(left / DAY)}`;
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
    coffeeStock: RULES.coffeeStock, goldenUntil: 0, final: null, schedule: realSchedule(),
    prizes: DEFAULT_PRIZES.map(({ award, name }) => ({ name, award, winner: null, openedAt: 0 })),
  };
  for (const t of TEAMS) state.teams[t.id] = newTeam(t.id, 0);
  pushFeed(state, 'crown', `${EVENT.name} ${EVENT.title}에 오신 걸 환영해요! ${EVENT.slogan}`);
  return state;
}

export function newUser({ id, name, teamId, avatar }) {
  return {
    id, name, teamId, avatar,
    food: 0, premium: 0, points: 0, totalPoints: 0, totalDmg: 0, totalCorrect: 0,
    items: { booster: 0, cheer: 0, coffee: 0 },
    coupons: [], visitedWeeks: [], bossRewards: [],
    weekly: freshWeekly(-1),
  };
}

function freshWeekly(week) {
  return {
    week, quiz: [], quizDoneAt: 0, luckyCount: 0, luckyLog: [], rpsCount: 0, rpsLog: [],
    points: 0, dmg: 0, friend: 0, friendGifts: 0,
  };
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

// ---------------------------------------------------------------- 주간 보스
// 그 주에 한 번이라도 들어온(첫 방문 보너스를 받은) 팀원 수
export const activeCount = (state, teamId, w = state.week) =>
  Object.values(state.users).filter((u) => u.teamId === teamId && u.visitedWeeks.includes(w)).length;

// 우리 팀 몫: 보스 체력을 팀마다 팀원 수만큼 나눠 맡는다. 팀원이 모두 조금씩 힘을 보태면 채워진다.
export const teamShare = (state, teamId) => RULES.boss.perMember * teamMemberCount(state, teamId);

export function bossInfo(state, w = state.week) {
  const meta = bossOf(w);
  if (!meta) return null;
  const rec = state.bosses[w] || { dmg: 0, defeatedAt: 0, maxHpAtDefeat: 0, escaped: false };
  const teams = TEAMS.map((t) => {
    const share = teamShare(state, t.id);
    const dmg = state.teams[t.id].dmgByWeek[w] || 0;
    return { id: t.id, share, dmg, rate: share ? dmg / share : 0, active: activeCount(state, t.id, w) };
  });
  const minHp = scheduleOf(state).real ? RULES.boss.minHp : RULES.boss.minHpTest;
  const live = Math.max(minHp, teams.reduce((s, t) => s + t.share, 0));
  const maxHp = rec.defeatedAt ? rec.maxHpAtDefeat : rec.escaped ? rec.maxHpAtEnd || live : live;
  return {
    ...meta, week: w, maxHp, dmg: rec.dmg, hp: Math.max(0, maxHp - rec.dmg),
    defeated: !!rec.defeatedAt, defeatedAt: rec.defeatedAt, escaped: !!rec.escaped,
    teams, active: teams.reduce((s, t) => s + t.active, 0),
  };
}

function giveBossReward(state, u, w) {
  if (u.bossRewards.includes(w)) return false;
  u.bossRewards.push(w);
  grant(u, RULES.boss.defeatReward);
  return true;
}

// 원래 활동이 곧 보스 공격이다. 피해를 쌓고, 체력이 바닥나면 그 자리에서 격파 처리를 한다.
function dealDamage(state, u, amount, kind) {
  const w = state.week;
  if (!isPlayWeek(w) || amount <= 0) return null;
  const rec = (state.bosses[w] ||= { dmg: 0, defeatedAt: 0, maxHpAtDefeat: 0, escaped: false });
  const team = state.teams[u.teamId];
  rec.dmg += amount;
  team.dmgByWeek[w] = (team.dmgByWeek[w] || 0) + amount;
  weekly(state, u).dmg += amount;
  u.totalDmg += amount;
  state.hits.unshift({ id: ++state.seq, uid: u.id, name: u.name, avatar: u.avatar, teamId: u.teamId, dmg: amount, kind, ts: Date.now() });
  if (state.hits.length > HITS_LIMIT) state.hits.length = HITS_LIMIT;

  let defeated = false;
  if (!rec.defeatedAt) {
    const info = bossInfo(state, w);
    if (rec.dmg >= info.maxHp) {
      defeated = true;
      rec.defeatedAt = Date.now();
      rec.maxHpAtDefeat = info.maxHp;
      const rewarded = Object.values(state.users).filter((x) => x.visitedWeeks.includes(w) && giveBossReward(state, x, w)).length;
      const r = RULES.boss.defeatReward;
      pushFeed(state, 'seal', `원정대가 ${josa(info.name, '을/를')} 물리쳤어요! 마지막 일격은 ${teamById(u.teamId).community} ${u.name}님. `
        + `참여한 ${rewarded}명 모두 고급 먹이 ${r.premium}개 + ${r.points}P, 봉인 조각 1개 획득!`, { ...who(u), boss: info.id });
    }
  }
  return { dmg: amount, defeated };
}

// ---------------------------------------------------------------- 주간 첫 방문
export function checkIn(state, userId) {
  const u = state.users[userId];
  weekly(state, u);
  if (!isPlayWeek(state.week) || u.visitedWeeks.includes(state.week)) return { ok: false };
  u.visitedWeeks.push(state.week);
  u.food += RULES.weeklyVisitFood;
  // 보스를 이미 물리친 주에 처음 온 사람도 격파 보상을 받는다
  const bossReward = state.bosses[state.week]?.defeatedAt ? giveBossReward(state, u, state.week) : false;
  return { ok: true, food: RULES.weeklyVisitFood, bossReward };
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
  const gained = Math.max(1, Math.round(n * RULES.exp[kind] * expMultiplier(state, team)));
  team.exp += gained;
  if (kind === 'premium') u.premium -= n;
  else u.food -= n;
  const after = levelInfo(team.exp);
  const evolved = after.stage.key !== before.stage.key;
  const hit = dealDamage(state, u, gained, kind);

  if (after.level > before.level) {
    const what = evolved ? `${josa(after.stage.name, '으로/로')} 진화했어요!` : '로 성장했어요!';
    pushFeed(state, 'team', `${josa(t.monster, '이/가')} Lv.${after.level}${evolved ? ' ' + what : what}`, { teamId: u.teamId });
  } else if (kind === 'premium' || n >= 5) {
    pushFeed(state, kind, `${u.name}님이 ${t.monster}에게 ${kind === 'premium' ? '고급 먹이' : '먹이'} ${n}개! (+${gained} EXP${hit ? ` · 보스에게 ${gained} 피해` : ''})`, who(u));
  }
  return { ok: true, n, gained, dmg: hit?.dmg || 0, defeated: !!hit?.defeated, levelUp: after.level > before.level, evolved, after };
}

// ---------------------------------------------------------------- 퀴즈 = 지식 공격
// questions: 그 주의 문제들 (정답이 들어 있어서 서버에서만 넘겨준다)
export function answerQuiz(state, userId, qi, choice, questions) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  const q = questions[qi];
  if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false, reason: '잘못된 답이에요' };
  if (d.quiz[qi]) return { ok: false, reason: '이미 푼 문제예요' };
  const correct = choice === q.answer;
  d.quiz[qi] = { choice, correct };
  let hit = null;
  if (correct) {
    addPoints(state, u, RULES.quizPoints);
    u.totalCorrect++;
    hit = dealDamage(state, u, RULES.boss.quizDamage, 'quiz');
  }

  const done = questions.every((_, i) => d.quiz[i]);
  const perfect = done && questions.every((_, i) => d.quiz[i].correct);
  if (done) {
    d.quizDoneAt = Date.now();
    if (perfect) {
      u.premium += RULES.quizPerfectPremium;
      pushFeed(state, 'premium', `${u.name}님이 ${state.week}${paceOf(state).round} AI 퀴즈를 모두 맞혔어요!`, who(u));
    }
  }
  return { ok: true, correct, done, perfect, dmg: hit?.dmg || 0, defeated: !!hit?.defeated };
}

// ---------------------------------------------------------------- 럭키박스
export function openLuckyBox(state, userId, rand = Math.random) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  if (d.luckyCount >= RULES.luckyPerWeek) return { ok: false, reason: `${paceOf(state).now} 럭키박스를 모두 열었어요. ${paceOf(state).next} 또 만나요!` };
  const row = pickWeighted(LUCKY_BOX, rand);
  if (row.reward.food) u.food += row.reward.food;
  if (row.reward.premium) u.premium += row.reward.premium;
  if (row.reward.points) addPoints(state, u, row.reward.points);
  d.luckyCount++;
  d.luckyLog.push(row.label);
  if (row.jackpot) pushFeed(state, 'luckybox', `${u.name}님이 럭키박스 잭팟을 터뜨렸어요! 먹이 100개!`, who(u));
  return { ok: true, row, left: RULES.luckyPerWeek - d.luckyCount };
}

// ---------------------------------------------------------------- 이번 주 보스와 가위바위보
export function playRps(state, userId, hand, rand = Math.random) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  if (!HANDS[hand]) return { ok: false, reason: '가위, 바위, 보 중에 골라 주세요' };
  if (d.rpsCount >= RULES.rpsPerWeek) return { ok: false, reason: `${paceOf(state).now} 도전을 모두 했어요. ${paceOf(state).next} 다시 도전해요!` };
  const keys = Object.keys(HANDS);
  const boss = keys[Math.floor(rand() * keys.length)];
  if (boss === hand) return { ok: true, outcome: 'draw', boss };

  const win = BEATS[hand] === boss;
  const before = u.food;
  u.food = Math.floor(before * (win ? RULES.rps.winMultiplier : RULES.rps.loseRatio));
  d.rpsCount++;
  d.rpsLog.push(win ? 'win' : 'lose');
  const hit = win ? dealDamage(state, u, RULES.boss.rpsWinDamage, 'rps') : null;
  if (win) pushFeed(state, 'food', `${u.name}님이 ${josa(bossOf(state.week).name, '과/와')}의 가위바위보에서 이겼어요! 먹이 ${u.food}개`, who(u));
  return { ok: true, outcome: win ? 'win' : 'lose', boss, before, after: u.food, left: RULES.rpsPerWeek - d.rpsCount, dmg: hit?.dmg || 0, defeated: !!hit?.defeated };
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
  target.cheerUntil = Math.max(now, target.cheerUntil) + RULES.cheer.minutes * MIN;
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
      d.friend++;
      const mine = state.teams[a.teamId];
      mine.friendByWeek[state.week] = (mine.friendByWeek[state.week] || 0) + 1;
      friend = true;
    }
  }
  pushFeed(state, g.icon, cross
    ? `${a.name}님이 ${teamById(b.teamId).community} ${b.name}님에게 ${josa(g.name, '을/를')} 선물했어요`
    : `${a.name}님이 ${b.name}님에게 ${josa(g.name, '을/를')} 선물했어요`, who(a));
  return { ok: true, friend };
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
      rec.escaped = true;
      rec.maxHpAtEnd = info.maxHp;
    }
    const list = allianceList(state, w);
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

// 운영자가 진행 속도를 고른다. 지금 주차는 이 순간 새로 시작하고, 그 뒤로 고른 시간마다 다음 주차가 열린다.
// 'real'은 실제 일정(11/21 시작, 1주일)으로 되돌린다. 이미 실제 일정보다 앞서 있으면 초기화가 먼저 필요하다.
export function setPace(state, pace, now = Date.now()) {
  if (pace === 'real') {
    if (state.week > weekForTime(realSchedule(), now)) {
      return { ok: false, reason: '실제 일정보다 앞서 진행돼 있어요. "전체 초기화"를 하면 실제 일정으로 돌아가요.' };
    }
    state.schedule = realSchedule();
    pushFeed(state, 'booster', `운영진이 실제 일정으로 되돌렸어요. ${weekDates(state.schedule, 1).start}에 1주차 원정이 시작돼요.`);
    return { ok: true, pace: 'real' };
  }
  const P = PACES[pace];
  if (!P || pace === 'week') return { ok: false, reason: '속도를 골라 주세요' };
  const w = Math.max(1, Math.min(state.week, FINAL_WEEK));
  state.schedule = { pace, start: now - (w - 1) * P.ms, real: false };
  pushFeed(state, 'booster', `미리 해 보기! 지금부터 ${P.label}마다 새 ${P.round}가 열려요. 퀴즈·보스·럭키박스 횟수도 그때마다 새로 바뀌어요.`);
  return { ok: true, pace };
}

// 미리 해 보기 속도에서 운영자가 주차를 앞당기면, 새 주차가 지금 시작한 것으로 일정을 맞춘다
export function rebaseSchedule(state, now = Date.now()) {
  const sch = scheduleOf(state);
  if (sch.real || state.week < 1) return;
  state.schedule = { ...sch, start: now - (Math.min(state.week, FINAL_WEEK) - 1) * periodMs(sch) };
}

// 시간이 되면 자동으로 주차를 넘긴다 (앞으로만 간다. 운영자가 미리 넘긴 주차는 그대로 둔다)
export function syncWeek(state, now = Date.now()) {
  const target = weekForTime(scheduleOf(state), now);
  let changed = false;
  while (state.week < target && advanceWeek(state).ok) changed = true;
  return changed;
}

// ---------------------------------------------------------------- 최종 결전 (12/19 현장)
// 결전 전에도 지금까지 모은 봉인과 예상 체력을 보여 준다
export function finalPreview(state) {
  if (state.final) return state.final;
  const F = RULES.final;
  const seals = BOSSES.filter((b) => state.bosses[b.week]?.defeatedAt).map((b) => b.week);
  const escaped = BOSSES.filter((b) => b.week < state.week && !state.bosses[b.week]?.defeatedAt).map((b) => b.week);
  const monsterRound = F.hitsPerRound * TEAMS.reduce((s, t) => s + F.atk + F.atkPerLevel * levelInfo(state.teams[t.id].exp).level, 0);
  const cheerRound = F.cheerExpectPerUser * Object.keys(state.users).length * F.cheerDamage;
  const maxHp = Math.round(((monsterRound + cheerRound) / F.roundShare) * (1 + F.escapeAdd * escaped.length));
  return { maxHp, dmg: 0, seals, escaped, rounds: [], preview: true };
}

function createFinal(state) {
  const f = finalPreview({ ...state, final: null, week: FINAL_WEEK });
  return {
    maxHp: f.maxHp, dmg: 0, seals: f.seals, escaped: f.escaped,
    cheers: {}, cheerBy: {}, cheerTotal: {}, cheerUntil: 0, cheerRound: 0, recentCheer: [],
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
  f.cheers[u.teamId] = (f.cheers[u.teamId] || 0) + add;
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
