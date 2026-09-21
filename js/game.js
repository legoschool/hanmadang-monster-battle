// 게임 규칙. 모든 함수는 state를 직접 바꾸고 결과 객체를 돌려준다.
// 판정은 서버(server/api.js)가 이 파일로 한다. 브라우저는 순위 계산과 화면 표시에만 쓴다.
//
// 일정은 '주' 단위다. week 0 = 시즌 시작 전, 1~4 = 사전 참여 주, FINAL_WEEK = 현장 모임(결전의 날).
// 한 주 안에서는 언제 몰아서 해도 되도록, 하루 제한 대신 '한 주에 몇 번' 제한을 쓴다.
import { EVENT, TEAMS, RULES, LUCKY_BOX, GACHA, ITEMS, STAGES, expForLevel } from './config.js';

export const SCHEMA = 2; // 저장 데이터 모양이 바뀌면 올린다 (예전 모양은 새로 시작)
export const FINAL_WEEK = EVENT.weeks + 1;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
export const HANDS = { rock: '✊', scissors: '✌️', paper: '✋' };
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export const teamById = (id) => TEAMS.find((t) => t.id === id);

// ---------------------------------------------------------------- 일정
const EVENT_MS = Date.parse(`${EVENT.eventDate}T00:00:00+09:00`);
const SEASON_START_MS = EVENT_MS - EVENT.weeks * 7 * DAY;

// 지금 몇 주차인지 (한국 시간 기준, 시즌 시작일 00시에 1주차가 열린다)
export function weekForTime(now = Date.now()) {
  if (now < SEASON_START_MS) return 0;
  return Math.min(FINAL_WEEK, Math.floor((now - SEASON_START_MS) / (7 * DAY)) + 1);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function kstLabel(ms) {
  const d = new Date(ms + 9 * 60 * MIN); // UTC 기준 필드로 한국 날짜를 읽는다
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAYS[d.getUTCDay()]})`;
}

// 주차별 기간 표시: { start: '11월 21일(토)', end: '11월 27일(금)' }
export function weekDates(week) {
  if (week >= FINAL_WEEK) return { start: kstLabel(EVENT_MS), end: kstLabel(EVENT_MS) };
  const w = Math.max(1, week);
  const start = SEASON_START_MS + (w - 1) * 7 * DAY;
  return { start: kstLabel(start), end: kstLabel(start + 6 * DAY) };
}

export const eventDateLabel = () => kstLabel(EVENT_MS);

// 현장 모임까지 남은 날 (당일 0)
export function daysToEvent(now = Date.now()) {
  const kstToday = Math.floor((now + 9 * 60 * MIN) / DAY);
  const kstEvent = Math.floor((EVENT_MS + 9 * 60 * MIN) / DAY);
  return kstEvent - kstToday;
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

export function pushFeed(state, icon, text, teamId = null) {
  state.feed.unshift({ id: ++state.seq, ts: Date.now(), icon, text, teamId });
  if (state.feed.length > 80) state.feed.length = 80;
}

const notOpen = (state) => (state.week < 1
  ? { ok: false, reason: `${weekDates(1).start}에 1주차가 열려요. 조금만 기다려 주세요!` }
  : { ok: false, reason: '사전 참여 기간이 끝났어요. 현장에서 만나요!' });

// ---------------------------------------------------------------- 팀과 사용자
export function newTeam(id, week = 0) {
  return { id, exp: 0, expAtWeekStart: { [week]: 0 }, boosterUntil: 0, wetUntil: 0, wetBy: null, crownWeek: 0 };
}

export function newGameState() {
  const state = {
    schema: SCHEMA, version: 1, seq: 0, week: 0,
    users: {}, teams: {}, feed: [], awards: {},
    coffeeStock: RULES.coffeeStock, tournament: null, goldenUntil: 0,
  };
  for (const t of TEAMS) state.teams[t.id] = newTeam(t.id, 0);
  pushFeed(state, 'crown', `${EVENT.name} 몬스터 육성 배틀에 오신 걸 환영해요!`);
  return state;
}

export function newUser({ id, name, teamId }) {
  return {
    id, name, teamId,
    food: 0, premium: 0, points: 0, totalPoints: 0,
    items: { booster: 0, balloon: 0, coffee: 0 },
    coupons: [], visitedWeeks: [],
    weekly: freshWeekly(-1),
  };
}

function freshWeekly(week) {
  return { week, quiz: [], quizDoneAt: 0, luckyCount: 0, luckyLog: [], rpsCount: 0, rpsLog: [], points: 0 };
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

export const teammates = (state, user) =>
  Object.values(state.users).filter((u) => u.teamId === user.teamId && u.id !== user.id);

export const teamMemberCount = (state, teamId) =>
  Object.values(state.users).filter((u) => u.teamId === teamId).length;

// ---------------------------------------------------------------- 주간 첫 방문
export function checkIn(state, userId) {
  const u = state.users[userId];
  weekly(state, u);
  if (state.week < 1 || u.visitedWeeks.includes(state.week)) return { ok: false };
  u.visitedWeeks.push(state.week);
  u.food += RULES.weeklyVisitFood;
  return { ok: true, food: RULES.weeklyVisitFood };
}

// ---------------------------------------------------------------- 먹이
export function expMultiplier(state, team, now = Date.now()) {
  let m = 1;
  if (team.boosterUntil > now) m *= RULES.booster.multiplier;
  if (team.wetUntil > now) m *= RULES.balloon.multiplier;
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

  if (after.level > before.level) {
    const what = evolved ? `${josa(after.stage.name, '으로/로')} 진화했어요!` : '로 성장했어요!';
    pushFeed(state, 'team', `${josa(t.monster, '이/가')} Lv.${after.level}${evolved ? ' ' + what : what}`, u.teamId);
  } else if (kind === 'premium' || n >= 5) {
    pushFeed(state, kind, `${u.name}님이 ${t.monster}에게 ${kind === 'premium' ? '고급 먹이' : '먹이'} ${n}개를 줬어요 (+${gained} EXP)`, u.teamId);
  }
  return { ok: true, n, gained, levelUp: after.level > before.level, evolved, after };
}

// ---------------------------------------------------------------- 퀴즈
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
  if (correct) addPoints(state, u, RULES.quizPoints);

  const done = questions.every((_, i) => d.quiz[i]);
  const perfect = done && questions.every((_, i) => d.quiz[i].correct);
  if (done) {
    d.quizDoneAt = Date.now();
    if (perfect) {
      u.premium += RULES.quizPerfectPremium;
      pushFeed(state, 'premium', `${u.name}님이 ${state.week}주차 AI 퀴즈를 모두 맞혔어요!`, u.teamId);
    }
  }
  return { ok: true, correct, done, perfect };
}

// ---------------------------------------------------------------- 럭키박스
export function openLuckyBox(state, userId, rand = Math.random) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  if (d.luckyCount >= RULES.luckyPerWeek) return { ok: false, reason: '이번 주 럭키박스를 모두 열었어요. 다음 주에 또 만나요!' };
  const row = pickWeighted(LUCKY_BOX, rand);
  if (row.reward.food) u.food += row.reward.food;
  if (row.reward.premium) u.premium += row.reward.premium;
  if (row.reward.points) addPoints(state, u, row.reward.points);
  d.luckyCount++;
  d.luckyLog.push(row.label);
  if (row.jackpot) pushFeed(state, 'luckybox', `${u.name}님이 럭키박스 잭팟을 터뜨렸어요! 먹이 100개!`, u.teamId);
  return { ok: true, row, left: RULES.luckyPerWeek - d.luckyCount };
}

// ---------------------------------------------------------------- AI 보스 가위바위보
export function playRps(state, userId, hand, rand = Math.random) {
  if (!isPlayWeek(state.week)) return notOpen(state);
  const u = state.users[userId];
  const d = weekly(state, u);
  if (!HANDS[hand]) return { ok: false, reason: '가위, 바위, 보 중에 골라 주세요' };
  if (d.rpsCount >= RULES.rpsPerWeek) return { ok: false, reason: '이번 주 도전을 모두 했어요. 다음 주에 다시 도전해요!' };
  const keys = Object.keys(HANDS);
  const boss = keys[Math.floor(rand() * keys.length)];
  if (boss === hand) return { ok: true, outcome: 'draw', boss };

  const win = BEATS[hand] === boss;
  const before = u.food;
  u.food = Math.floor(before * (win ? RULES.rps.winMultiplier : RULES.rps.loseRatio));
  d.rpsCount++;
  d.rpsLog.push(win ? 'win' : 'lose');
  if (win && before >= 10) pushFeed(state, 'food', `${u.name}님이 AI 보스를 이기고 먹이를 ${u.food}개로 불렸어요!`, u.teamId);
  return { ok: true, outcome: win ? 'win' : 'lose', boss, before, after: u.food, left: RULES.rpsPerWeek - d.rpsCount };
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
  if (item === 'coffee') pushFeed(state, 'coffee', `${u.name}님이 쿠폰 뽑기에서 커피 교환권을 뽑았어요!`, u.teamId);
  return { ok: true, item };
}

export function useBooster(state, userId) {
  const u = state.users[userId];
  if (!u.items.booster) return { ok: false, reason: '부스터가 없어요' };
  const team = state.teams[u.teamId];
  const now = Date.now();
  u.items.booster--;
  team.boosterUntil = Math.max(now, team.boosterUntil) + RULES.booster.minutes * MIN;
  pushFeed(state, 'booster', `${u.name}님이 ${teamById(u.teamId).community}에 경험치 부스터를 켰어요!`, u.teamId);
  return { ok: true, until: team.boosterUntil };
}

export function throwBalloon(state, userId, targetId) {
  const u = state.users[userId];
  if (!u.items.balloon) return { ok: false, reason: '물풍선 공격권이 없어요' };
  if (targetId === u.teamId || !state.teams[targetId]) return { ok: false, reason: '다른 팀을 골라 주세요' };
  u.items.balloon--;
  const target = state.teams[targetId];
  target.wetUntil = Date.now() + RULES.balloon.minutes * MIN; // 겹쳐 맞아도 시간은 늘어나지 않고 새로 시작
  target.wetBy = u.teamId;
  pushFeed(state, 'balloon', `${teamById(u.teamId).community} ${u.name}님이 ${teamById(targetId).monster}에게 물풍선을 던졌어요!`, targetId);
  return { ok: true };
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

export function gift(state, fromId, toId, kind) {
  const a = state.users[fromId];
  const b = state.users[toId];
  const g = GIFT_KINDS[kind];
  if (!b || b.teamId !== a.teamId || a.id === b.id) return { ok: false, reason: '같은 커뮤니티 멤버에게만 줄 수 있어요' };
  if (!g || !g.has(a)) return { ok: false, reason: '줄 수 있는 아이템이 없어요' };
  g.move(a, b);
  pushFeed(state, g.icon, `${a.name}님이 ${b.name}님에게 ${josa(g.name, '을/를')} 선물했어요`, a.teamId);
  return { ok: true };
}

// ---------------------------------------------------------------- 골든타임 (운영자)
export function startGolden(state, minutes = RULES.golden.minutes) {
  const m = Math.max(5, Math.min(180, Number(minutes) || RULES.golden.minutes));
  state.goldenUntil = Date.now() + m * MIN;
  pushFeed(state, 'booster', `골든타임 시작! ${m}분 동안 모든 팀의 먹이 경험치가 ${RULES.golden.multiplier}배예요`);
  return { ok: true, until: state.goldenUntil, minutes: m };
}

export function stopGolden(state) {
  state.goldenUntil = 0;
  return { ok: true };
}

// ---------------------------------------------------------------- 순위와 시상
export function teamGoal(state, teamId, week = state.week) {
  const s = state.teams[teamId];
  const target = RULES.teamGoal.base + RULES.teamGoal.perMember * teamMemberCount(state, teamId);
  const gain = s.exp - (s.expAtWeekStart[week] ?? s.exp);
  return { target, gain, progress: Math.min(1, gain / target), done: gain >= target };
}

export function teamRanking(state) {
  const members = {};
  for (const u of Object.values(state.users)) members[u.teamId] = (members[u.teamId] || 0) + 1;
  return TEAMS
    .map((t) => {
      const s = state.teams[t.id];
      return { ...t, s, exp: s.exp, info: levelInfo(s.exp), members: members[t.id] || 0, weekGain: s.exp - (s.expAtWeekStart[state.week] ?? s.exp) };
    })
    .sort((a, b) => b.exp - a.exp)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

export function userRanking(state, mode) {
  const score = (u) => (mode === 'week' ? (u.weekly.week === state.week ? u.weekly.points : 0) : u.totalPoints);
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

export const hasCrown = (state, teamId) => state.teams[teamId].crownWeek === state.week && state.week > 0;

// ---------------------------------------------------------------- 한 주 마무리
export function advanceWeek(state) {
  if (state.week >= FINAL_WEEK) return { ok: false, reason: '이미 현장 모임 날이에요' };
  const w = state.week;
  let award = null;

  if (isPlayWeek(w)) {
    const king = knowledgeKing(state, w);
    const storm = TEAMS
      .map((t) => ({ id: t.id, gain: state.teams[t.id].exp - (state.teams[t.id].expAtWeekStart[w] ?? 0) }))
      .sort((a, b) => b.gain - a.gain)[0];

    // 팀 목표를 이룬 팀은 그 주에 들어온 팀원 모두에게 보상
    const teamGoals = [];
    for (const t of TEAMS) {
      const goal = teamGoal(state, t.id, w);
      if (!goal.done) continue;
      const active = Object.values(state.users).filter((u) => u.teamId === t.id && u.visitedWeeks.includes(w));
      for (const u of active) {
        u.premium += RULES.teamGoal.rewardPremium;
        u.points += RULES.teamGoal.rewardPoints;
        u.totalPoints += RULES.teamGoal.rewardPoints;
      }
      teamGoals.push({ teamId: t.id, gain: goal.gain, target: goal.target, rewarded: active.length });
    }

    award = { kingId: king?.user.id ?? null, kingPerfect: !!king?.perfect, stormTeam: storm.id, stormGain: storm.gain, teamGoals };
    state.awards[w] = award;
    if (storm.gain > 0) state.teams[storm.id].crownWeek = w + 1;

    const st = teamById(storm.id);
    if (storm.gain > 0) pushFeed(state, 'crown', `${w}주차 폭풍성장 팀은 ${st.community}! ${st.monster}에게 한 주 동안 왕관이 씌워졌어요`, storm.id);
    if (king) pushFeed(state, 'point', `${w}주차 지식왕은 ${teamById(king.user.teamId).community} ${king.user.name}님!`, king.user.teamId);
    for (const g of teamGoals) pushFeed(state, 'premium', `${teamById(g.teamId).community} 팀 목표 달성! 참여한 ${g.rewarded}명에게 고급 먹이를 드렸어요`, g.teamId);
  }

  state.week = w + 1;
  for (const t of TEAMS) state.teams[t.id].expAtWeekStart[state.week] = state.teams[t.id].exp;

  if (state.week === FINAL_WEEK) {
    state.tournament = { seeds: teamRanking(state).map((t) => t.id), results: {} };
    pushFeed(state, 'crown', `사전 참여 끝! ${eventDateLabel()} 현장 최종 토너먼트 대진표가 확정됐어요`);
  } else {
    pushFeed(state, 'luckybox', `${state.week}주차가 열렸어요! 새 퀴즈와 럭키박스가 기다리고 있어요`);
  }
  return { ok: true, week: state.week, award };
}

// 날짜가 되면 자동으로 주차를 넘긴다 (앞으로만 간다. 운영자가 미리 넘긴 주차는 그대로 둔다)
export function syncWeek(state, now = Date.now()) {
  const target = weekForTime(now);
  let changed = false;
  while (state.week < target && advanceWeek(state).ok) changed = true;
  return changed;
}

// ---------------------------------------------------------------- 최종 토너먼트
function seedOrder(n) {
  if (n <= 2) return [1, 2].slice(0, n);
  return seedOrder(n / 2).flatMap((s) => [s, n + 1 - s]);
}

const roundName = (teams) => (teams === 2 ? '결승' : `${teams}강`);

// 참가 팀이 2의 거듭제곱이 아니면 하위 순위끼리 예선전을 치른다 (9팀: 8위 vs 9위).
export function buildBracket(seeds) {
  const n = seeds.length;
  const size = 2 ** Math.floor(Math.log2(n));
  const extra = n - size;
  const rounds = [];
  const slotSource = {};

  if (extra > 0) {
    const matches = [];
    for (let i = 0; i < extra; i++) {
      const hi = size - extra + 1 + i;
      const lo = size + extra - i;
      const id = `p${i}`;
      matches.push({ id, a: { team: seeds[hi - 1], seed: hi }, b: { team: seeds[lo - 1], seed: lo } });
      slotSource[hi] = { from: id, seed: hi };
    }
    rounds.push({ name: '예선', matches });
  }

  let prev = seedOrder(size).map((s) => slotSource[s] || { team: seeds[s - 1], seed: s });
  let r = 0;
  while (prev.length > 1) {
    const matches = [];
    for (let i = 0; i < prev.length; i += 2) {
      matches.push({ id: `r${r}m${i / 2}`, a: prev[i], b: prev[i + 1] });
    }
    rounds.push({ name: roundName(prev.length), matches });
    prev = matches.map((m) => ({ from: m.id }));
    r++;
  }
  return rounds;
}

export function slotTeam(slot, results) {
  if (slot.team) return slot.team;
  return results[slot.from]?.winner ?? null;
}

export function simulateBattle(state, aId, bId, rand = Math.random) {
  const B = RULES.battle;
  const make = (id) => {
    const lv = levelInfo(state.teams[id].exp).level;
    const hp = B.hp + lv * B.hpPerLevel;
    return { id, lv, hp, maxHp: hp, atk: B.atk + lv * B.atkPerLevel };
  };
  const A = make(aId);
  const C = make(bId);
  const turns = [];
  let attacker = rand() < 0.5 ? A : C;
  while (A.hp > 0 && C.hp > 0 && turns.length < 60) {
    const defender = attacker === A ? C : A;
    const miss = rand() < 0.08;
    const crit = !miss && rand() < 0.12;
    const dmg = miss ? 0 : Math.round(attacker.atk * (0.75 + rand() * 0.5) * (crit ? 1.8 : 1));
    defender.hp = Math.max(0, defender.hp - dmg);
    turns.push({ attacker: attacker.id, dmg, miss, crit, hpA: A.hp, hpB: C.hp });
    attacker = defender;
  }
  const winner = C.hp <= 0 || (A.hp > 0 && A.hp / A.maxHp >= C.hp / C.maxHp) ? aId : bId;
  return { a: A, b: C, winner, turns };
}

// 토너먼트 한 경기를 치르고 결과(다시 보기용 턴 기록 포함)를 저장한다.
export function playMatch(state, matchId, rand = Math.random) {
  const t = state.tournament;
  if (!t) return { ok: false, reason: '아직 토너먼트 날이 아니에요' };
  const match = buildBracket(t.seeds).flatMap((r) => r.matches.map((m) => ({ ...m, round: r.name }))).find((m) => m.id === matchId);
  if (!match) return { ok: false, reason: '없는 경기예요' };
  if (t.results[matchId]) return { ok: false, reason: '이미 끝난 경기예요' };
  const aId = slotTeam(match.a, t.results);
  const bId = slotTeam(match.b, t.results);
  if (!aId || !bId) return { ok: false, reason: '앞 경기가 먼저 끝나야 해요' };

  const battle = simulateBattle(state, aId, bId, rand);
  t.results[matchId] = { winner: battle.winner, round: match.round, battle, at: Date.now() };
  const w = teamById(battle.winner);
  const rounds = buildBracket(t.seeds);
  const isFinal = rounds[rounds.length - 1].matches[0].id === matchId;
  pushFeed(state, 'crown', isFinal
    ? `최종 우승! ${w.community} ${josa(w.monster, '이/가')} ${EVENT.name} 최강 몬스터가 됐어요!`
    : `${match.round}: ${w.community} ${josa(w.monster, '이/가')} 이겼어요!`, w.id);
  return { ok: true, matchId, round: match.round, battle };
}
