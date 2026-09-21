// 게임 규칙. 모든 함수는 state를 직접 바꾸고 결과 객체를 돌려준다.
// 판정은 서버(worker/game-room.js)가 이 파일로 한다. 브라우저는 순위 계산과 화면 표시에만 쓴다.
import { EVENT, TEAMS, RULES, LUCKY_BOX, GACHA, ITEMS, STAGES, expForLevel } from './config.js';

const MIN = 60 * 1000;
export const HANDS = { rock: '✊', scissors: '✌️', paper: '✋' };
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export const teamById = (id) => TEAMS.find((t) => t.id === id);

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

// ---------------------------------------------------------------- 팀과 사용자
export function newTeam(id, day = 1) {
  return { id, exp: 0, expAtDayStart: { [day]: 0 }, boosterUntil: 0, wetUntil: 0, wetBy: null, crownDay: 0 };
}

export function newGameState() {
  const state = { version: 1, seq: 0, day: 1, users: {}, teams: {}, feed: [], awards: {}, coffeeStock: RULES.coffeeStock, tournament: null };
  for (const t of TEAMS) state.teams[t.id] = newTeam(t.id);
  pushFeed(state, 'crown', `${EVENT.name} 몬스터 육성 배틀이 시작됐어요!`);
  return state;
}

export function newUser({ id, name, teamId }) {
  return {
    id, name, teamId,
    food: 0, premium: 0, points: 0, totalPoints: 0,
    items: { booster: 0, balloon: 0, coffee: 0 },
    coupons: [], attendedDays: [],
    daily: freshDaily(0),
  };
}

function freshDaily(day) {
  return { day, quiz: [null, null, null], quizDoneAt: 0, lucky: null, rps: null, points: 0 };
}

export function daily(state, user) {
  if (user.daily.day !== state.day) user.daily = freshDaily(state.day);
  return user.daily;
}

function addPoints(state, user, n) {
  user.points += n;
  user.totalPoints += n;
  daily(state, user).points += n;
}

export const teammates = (state, user) =>
  Object.values(state.users).filter((u) => u.teamId === user.teamId && u.id !== user.id);

// ---------------------------------------------------------------- 출석
export function checkIn(state, userId) {
  const u = state.users[userId];
  daily(state, u);
  if (u.attendedDays.includes(state.day)) return { ok: false };
  u.attendedDays.push(state.day);
  u.food += RULES.attendanceFood;
  return { ok: true, food: RULES.attendanceFood };
}

// ---------------------------------------------------------------- 먹이
export function expMultiplier(team, now = Date.now()) {
  let m = 1;
  if (team.boosterUntil > now) m *= RULES.booster.multiplier;
  if (team.wetUntil > now) m *= RULES.balloon.multiplier;
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
  const gained = Math.max(1, Math.round(n * RULES.exp[kind] * expMultiplier(team)));
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
// questions: 그날의 문제 3개 (정답이 들어 있어서 서버에서만 넘겨준다)
export function answerQuiz(state, userId, qi, choice, questions) {
  const u = state.users[userId];
  const d = daily(state, u);
  const q = questions[qi];
  if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false, reason: '잘못된 답이에요' };
  if (d.quiz[qi]) return { ok: false, reason: '이미 푼 문제예요' };
  const correct = choice === q.answer;
  d.quiz[qi] = { choice, correct };
  if (correct) addPoints(state, u, RULES.quizPoints);

  const done = d.quiz.every(Boolean);
  const perfect = done && d.quiz.every((a) => a.correct);
  if (done) {
    d.quizDoneAt = Date.now();
    if (perfect) {
      u.premium += RULES.quizPerfectPremium;
      pushFeed(state, 'premium', `${u.name}님이 오늘의 AI 퀴즈를 모두 맞혔어요!`, u.teamId);
    }
  }
  return { ok: true, correct, done, perfect };
}

// ---------------------------------------------------------------- 럭키박스
export function openLuckyBox(state, userId, rand = Math.random) {
  const u = state.users[userId];
  const d = daily(state, u);
  if (d.lucky) return { ok: false, reason: '오늘은 이미 열었어요' };
  const row = pickWeighted(LUCKY_BOX, rand);
  if (row.reward.food) u.food += row.reward.food;
  if (row.reward.premium) u.premium += row.reward.premium;
  if (row.reward.points) addPoints(state, u, row.reward.points);
  d.lucky = row.label;
  if (row.jackpot) pushFeed(state, 'luckybox', `${u.name}님이 럭키박스 잭팟을 터뜨렸어요! 먹이 100개!`, u.teamId);
  return { ok: true, row };
}

// ---------------------------------------------------------------- AI 보스 가위바위보
export function playRps(state, userId, hand, rand = Math.random) {
  const u = state.users[userId];
  const d = daily(state, u);
  if (!HANDS[hand]) return { ok: false, reason: '가위, 바위, 보 중에 골라 주세요' };
  if (d.rps) return { ok: false, reason: '오늘은 이미 도전했어요' };
  const keys = Object.keys(HANDS);
  const boss = keys[Math.floor(rand() * keys.length)];
  if (boss === hand) return { ok: true, outcome: 'draw', boss };

  const win = BEATS[hand] === boss;
  const before = u.food;
  u.food = Math.floor(before * (win ? RULES.rps.winMultiplier : RULES.rps.loseRatio));
  d.rps = win ? 'win' : 'lose';
  if (win && before >= 10) pushFeed(state, 'food', `${u.name}님이 AI 보스를 이기고 먹이를 ${u.food}개로 불렸어요!`, u.teamId);
  return { ok: true, outcome: d.rps, boss, before, after: u.food };
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
  pushFeed(state, g.icon, `${a.name}님이 ${b.name}님에게 ${josa(g.name, "을/를")} 선물했어요`, a.teamId);
  return { ok: true };
}

// ---------------------------------------------------------------- 순위와 시상
export function teamRanking(state) {
  const members = {};
  for (const u of Object.values(state.users)) members[u.teamId] = (members[u.teamId] || 0) + 1;
  return TEAMS
    .map((t) => {
      const s = state.teams[t.id];
      return { ...t, s, exp: s.exp, info: levelInfo(s.exp), members: members[t.id] || 0, todayGain: s.exp - (s.expAtDayStart[state.day] ?? 0) };
    })
    .sort((a, b) => b.exp - a.exp)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

export function userRanking(state, mode) {
  const score = (u) => (mode === 'today' ? (u.daily.day === state.day ? u.daily.points : 0) : u.totalPoints);
  return Object.values(state.users)
    .map((u) => ({ u, score: score(u) }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// 지식왕: 오늘 퀴즈를 모두 맞힌 사람 중 가장 빨리 끝낸 사람. 없으면 오늘 포인트 1위.
export function knowledgeKing(state, day = state.day) {
  const players = Object.values(state.users).filter((u) => u.daily.day === day);
  const perfect = players
    .filter((u) => u.daily.quizDoneAt && u.daily.quiz.every((a) => a && a.correct))
    .sort((a, b) => a.daily.quizDoneAt - b.daily.quizDoneAt);
  if (perfect.length) return { user: perfect[0], perfect: true, list: perfect.slice(0, 3) };
  const byPoints = players.filter((u) => u.daily.points > 0).sort((a, b) => b.daily.points - a.daily.points);
  return byPoints.length ? { user: byPoints[0], perfect: false, list: byPoints.slice(0, 3) } : null;
}

export const hasCrown = (state, teamId) => state.teams[teamId].crownDay === state.day;

// ---------------------------------------------------------------- 하루 넘기기
export function advanceDay(state) {
  if (state.day >= EVENT.totalDays) return { ok: false, reason: '마지막 날이에요' };
  const d = state.day;

  const king = knowledgeKing(state, d);
  const storm = TEAMS
    .map((t) => ({ id: t.id, gain: state.teams[t.id].exp - (state.teams[t.id].expAtDayStart[d] ?? 0) }))
    .sort((a, b) => b.gain - a.gain)[0];
  const award = { kingId: king?.user.id ?? null, kingPerfect: !!king?.perfect, stormTeam: storm.id, stormGain: storm.gain };
  state.awards[d] = award;

  state.day = d + 1;
  for (const t of TEAMS) state.teams[t.id].expAtDayStart[state.day] = state.teams[t.id].exp;
  state.teams[storm.id].crownDay = state.day;

  const st = teamById(storm.id);
  pushFeed(state, 'crown', `${d}일차 폭풍성장 팀은 ${st.community}! ${st.monster}에게 오늘 하루 왕관이 씌워졌어요`, storm.id);
  if (king) pushFeed(state, 'point', `${d}일차 지식왕은 ${teamById(king.user.teamId).community} ${king.user.name}님!`, king.user.teamId);
  if (state.day === EVENT.totalDays) {
    state.tournament = { seeds: teamRanking(state).map((t) => t.id), results: {} };
    pushFeed(state, 'crown', '마지막 날! 최종 토너먼트 대진표가 확정됐어요');
  }
  return { ok: true, day: state.day, award };
}

// 행사 시작일이 정해져 있으면 한국 시간 자정마다 자동으로 다음 날로 넘어간다.
export function syncDay(state, now = Date.now()) {
  if (!EVENT.startDate) return false;
  const start = Date.parse(`${EVENT.startDate}T00:00:00+09:00`);
  const target = Math.min(EVENT.totalDays, Math.floor((now - start) / (24 * 60 * MIN)) + 1);
  let changed = false;
  while (state.day < target && advanceDay(state).ok) changed = true;
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
