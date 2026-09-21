// 페이지 화면 (HTML 문자열을 만든다)
import { EVENT, TEAMS, RULES, LUCKY_BOX, GACHA, ITEMS, spriteOf } from './config.js';
import {
  teamById, levelInfo, daily, teamRanking, userRanking, knowledgeKing, hasCrown,
  teammates, buildBracket, slotTeam, HANDS, GIFT_KINDS, josa,
} from './game.js';
import { esc, num, icon, monsterImg, timeLeft, timeAgo, now as clockNow } from './ui.js';

const me = (state) => state.users[state.me];

const SVG = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  mission: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  play: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 13h18M12 8S10.5 3 7.5 4 9 8 12 8zm0 0s1.5-5 4.5-4S15 8 12 8z"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  rank: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  tournament: '<path d="M4 5h5v6H4zM4 13h5v6H4zM15 9h5v6h-5z"/><path d="M9 8h3v8H9M12 12h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  tools: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
export const svg = (name) =>
  `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name]}</svg>`;

export const NAV = [
  { route: 'home', label: '홈', short: '홈' },
  { route: 'mission', label: '오늘의 미션', short: '미션' },
  { route: 'play', label: '도전 · 뽑기', short: '도전' },
  { route: 'bag', label: '가방', short: '가방' },
  { route: 'rank', label: '랭킹', short: '랭킹' },
  { route: 'tournament', label: '최종 토너먼트', short: '토너먼트' },
];

const secHead = (title, extra = '') => `<div class="sec-head"><h2>${title}</h2>${extra}</div>`;
const pillLink = (href, label = '더보기') => `<a class="pill-link" href="${href}">${label} <span aria-hidden="true">→</span></a>`;
const pageHead = (title, sub) => `<header class="page-head"><h1>${title}</h1><p>${sub}</p></header>`;

const teamChip = (t) => `<span class="team-chip"><i style="background:${t.color}"></i>${esc(t.community)}</span>`;

function feedIcon(item) {
  if (item.icon === 'team' && item.teamId) return `<img class="px" src="${spriteOf(item.teamId)}" width="32" height="32" alt="">`;
  return icon(item.icon, 32);
}

// ================================================================ 공통 틀
export function renderShellParts(state) {
  const u = me(state);
  const t = teamById(u.teamId);
  const final = state.day === EVENT.totalDays;
  return {
    day: final ? `<b>마지막 날</b> 토너먼트` : `<b>${state.day}일차</b> / ${EVENT.totalDays}일`,
    wallet: `
      <span class="mini-chip" title="먹이">${icon('food', 20)}<b>${num(u.food)}</b></span>
      <span class="mini-chip" title="고급 먹이">${icon('premium', 20)}<b>${num(u.premium)}</b></span>
      <span class="mini-chip" title="포인트">${icon('point', 20)}<b>${num(u.points)}</b></span>`,
    profile: `
      <div class="profile-card">
        <img class="px" src="${spriteOf(t.id)}" width="48" height="48" alt="">
        <div>
          <strong>${esc(u.name)}</strong>
          ${teamChip(t)}
        </div>
      </div>`,
  };
}

// ================================================================ 시작 화면
export function renderOnboarding(state, ui) {
  return `
  <div class="onboard">
    <section class="onboard__hero">
      <span class="eyebrow">${EVENT.name}</span>
      <h1>커뮤니티 몬스터<br><em>육성 배틀</em></h1>
      <p>매일 미션으로 먹이를 모아 우리 커뮤니티의 알을 부화시키고,<br class="br-desktop"> 마지막 날 토너먼트에서 최강 몬스터를 가려요.</p>
      <div class="parade" aria-hidden="true">
        ${TEAMS.map((t, i) => `<img class="px" src="${spriteOf(t.id)}" width="64" height="64" alt="" style="animation-delay:${i * 0.12}s">`).join('')}
      </div>
    </section>

    <section class="card onboard__form">
      <h2><span class="step">1</span>내 커뮤니티 고르기</h2>
      <div class="team-pick" role="radiogroup" aria-label="커뮤니티">
        ${TEAMS.map((t) => `
          <button class="team-pick__item ${ui.pickTeam === t.id ? 'is-selected' : ''}" role="radio" aria-checked="${ui.pickTeam === t.id}"
            data-action="pick-team" data-team="${t.id}" style="--team:${t.color}">
            <img class="px" src="${spriteOf(t.id)}" width="64" height="64" alt="">
            <strong>${esc(t.community)}</strong>
            <span>${esc(t.monster)}</span>
          </button>`).join('')}
      </div>
      <h2><span class="step">2</span>활동 이름 정하기</h2>
      <label class="field">
        <input id="nickname" type="text" maxlength="12" placeholder="예: 반짝쌤" autocomplete="nickname" value="${esc(ui.nickname || '')}">
        <small>랭킹과 소식에 보이는 이름이에요. 실명 대신 별명을 추천해요.</small>
      </label>
      ${state.joinCodeRequired ? `
      <h2><span class="step">3</span>참가 코드</h2>
      <label class="field">
        <input id="joinCode" type="text" maxlength="40" placeholder="커뮤니티 안내에 있는 참가 코드" autocomplete="off">
      </label>` : ''}
      <p class="form-error" id="joinError" role="alert"></p>
      <button class="btn btn--primary btn--lg btn--block" data-action="join">몬스터 만나러 가기</button>
    </section>

    <section class="card onboard__resume">
      <h2>이미 참여했나요?</h2>
      <p>다른 기기에서 받은 <b>연결 코드</b>를 넣으면 내 몬스터와 기록을 그대로 이어서 할 수 있어요.</p>
      <div class="resume-row">
        <input id="resumeCode" type="text" maxlength="17" placeholder="XXXXX-XXXXX-XXXXX" autocomplete="off" autocapitalize="characters">
        <button class="btn btn--soft" data-action="resume">이어하기</button>
      </div>
      <p class="form-error" id="resumeError" role="alert"></p>
    </section>

    <section class="how">
      ${[
        ['food', '매일 미션', '출석하고 AI 퀴즈를 풀면 먹이와 포인트가 쌓여요.'],
        ['luckybox', '운빨과 도전', '럭키박스, AI 보스 가위바위보, 쿠폰 뽑기로 역전을 노려요.'],
        ['crown', '최종 토너먼트', '마지막 날, 가장 크게 키운 몬스터끼리 붙어요.'],
      ].map(([ic, title, text], i) => `
        <div class="how__item">
          ${icon(ic, 48)}
          <div><b>STEP ${i + 1} · ${title}</b><p>${text}</p></div>
        </div>`).join('')}
    </section>
  </div>`;
}

// ================================================================ 홈
// 빗방울·반짝이 위치를 고르게 흩뿌린다 (다시 그려도 같은 자리)
const scatter = (n, maxDelay) =>
  Array.from({ length: n }, (_, i) =>
    `<i style="left:${((i * 37) % 97) + 1}%;animation-delay:${((i * 13) % 10) / 10 * maxDelay}s"></i>`).join('');

function monsterStage(state, teamId, size = 'lg') {
  const ts = state.teams[teamId];
  const info = levelInfo(ts.exp);
  const now = clockNow();
  const wet = ts.wetUntil > now;
  const boosted = ts.boosterUntil > now;
  return `
    <div class="stage stage--${size} stage--${info.stage.key} ${wet ? 'is-wet' : ''} ${boosted ? 'is-boosted' : ''}"
      style="--team:${teamById(teamId).color}" id="stage">
      ${hasCrown(state, teamId) ? `<img class="px stage__crown" src="assets/icons/crown.png" alt="왕관">` : ''}
      <div class="stage__mon" id="mon">${monsterImg(teamId, ts.exp, 64)}</div>
      <div class="stage__shadow"></div>
      ${wet ? `<div class="stage__rain" aria-hidden="true">${scatter(16, 0.9)}</div>` : ''}
      ${boosted ? `<div class="stage__spark" aria-hidden="true">${scatter(10, 1.6)}</div>` : ''}
    </div>`;
}

function effectChips(state, teamId) {
  const ts = state.teams[teamId];
  const now = clockNow();
  const chips = [];
  if (hasCrown(state, teamId)) chips.push(`<span class="fx-chip fx-chip--crown">${icon('crown', 16)}오늘의 폭풍성장 팀</span>`);
  if (ts.boosterUntil > now) chips.push(`<span class="fx-chip fx-chip--boost">${icon('booster', 16)}부스터 ×${RULES.booster.multiplier} · <time data-until="${ts.boosterUntil}">${timeLeft(ts.boosterUntil)}</time></span>`);
  if (ts.wetUntil > now) chips.push(`<span class="fx-chip fx-chip--wet">${icon('balloon', 16)}물풍선 맞음 ×${RULES.balloon.multiplier} · <time data-until="${ts.wetUntil}">${timeLeft(ts.wetUntil)}</time></span>`);
  return chips.join('');
}

export function renderHome(state) {
  const u = me(state);
  const t = teamById(u.teamId);
  const ts = state.teams[t.id];
  const info = levelInfo(ts.exp);
  const ranking = teamRanking(state);
  const mine = ranking.find((r) => r.id === t.id);
  const d = daily(state, u);
  const quizCount = d.quiz.filter(Boolean).length;
  const top = ranking[0].exp || 1;
  const prevAward = state.awards[state.day - 1];
  const liveKing = knowledgeKing(state);
  const dDay = EVENT.totalDays - state.day;

  const todo = [
    { done: u.attendedDays.includes(state.day), icon: 'food', title: '출석 체크', desc: `먹이 ${RULES.attendanceFood}개`, href: '#/mission', state: u.attendedDays.includes(state.day) ? '완료' : '받기' },
    { done: quizCount === 3, icon: 'premium', title: '오늘의 AI 퀴즈', desc: `오늘 주제: ${state.today.theme}`, href: '#/mission', state: `${quizCount}/3` },
    { done: !!d.lucky, icon: 'luckybox', title: '럭키박스', desc: d.lucky ? d.lucky : '잭팟 먹이 100개', href: '#/play', state: d.lucky ? '완료' : '열기' },
    { done: !!d.rps, icon: 'point', title: 'AI 보스 가위바위보', desc: '이기면 먹이 2배', href: '#/play', state: d.rps === 'win' ? '승리' : d.rps === 'lose' ? '패배' : '도전' },
  ];

  return `
  <div class="home">
    <section class="card monster-card" style="--team:${t.color}">
      <div class="monster-card__top">
        ${teamChip(t)}
        <span class="rank-chip">팀 순위 <b>${mine.rank}</b>위</span>
      </div>
      ${monsterStage(state, t.id)}
      <div class="monster-card__meta">
        <div class="monster-name">
          <h1>${esc(t.monster)}</h1>
          <span class="lv">Lv.${info.level}</span>
          <span class="stage-badge">${info.stage.name}</span>
        </div>
        <p>${esc(t.desc)}</p>
      </div>
      <div class="exp">
        <div class="exp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(info.progress * 100)}">
          <span style="width:${Math.max(2, info.progress * 100)}%"></span>
        </div>
        <div class="exp__nums"><span>EXP ${num(ts.exp - info.cur)} / ${num(info.next - info.cur)}</span><span>다음 레벨까지 ${num(info.next - ts.exp)}</span></div>
      </div>
      <div class="fx-row">${effectChips(state, t.id)}</div>
      <div class="feed-actions">
        <button class="btn btn--primary" data-action="feed" data-kind="food" data-n="1" ${u.food ? '' : 'disabled'}>${icon('food', 24)}먹이 주기</button>
        <button class="btn btn--soft" data-action="feed" data-kind="food" data-n="all" ${u.food ? '' : 'disabled'}>모두 주기 <b>${num(u.food)}</b></button>
        <button class="btn btn--gold" data-action="feed" data-kind="premium" data-n="1" ${u.premium ? '' : 'disabled'}>${icon('premium', 24)}고급 먹이 <b>${num(u.premium)}</b></button>
      </div>
    </section>

    <div class="home__side">
      <section class="card wallet">
        <div class="wallet__item">${icon('food', 36)}<b>${num(u.food)}</b><span>먹이</span></div>
        <div class="wallet__item">${icon('premium', 36)}<b>${num(u.premium)}</b><span>고급 먹이</span></div>
        <div class="wallet__item">${icon('point', 36)}<b>${num(u.points)}</b><span>포인트</span></div>
      </section>

      <section class="card">
        ${secHead('오늘 할 일', pillLink('#/mission', '미션'))}
        <ul class="todo">
          ${todo.map((it) => `
            <li class="todo__item ${it.done ? 'is-done' : ''}">
              <a href="${it.href}">
                ${icon(it.icon, 32)}
                <div><b>${it.title}</b><span>${esc(it.desc)}</span></div>
                <em>${it.state}</em>
              </a>
            </li>`).join('')}
        </ul>
      </section>

      <section class="card honor">
        ${secHead('명예의 전당', pillLink('#/rank?tab=hall'))}
        <div class="honor__grid">
          <div class="honor__item">
            <span class="honor__label">${icon('point', 20)}어제의 지식왕</span>
            ${prevAward?.kingId && state.users[prevAward.kingId]
              ? `<b>${esc(state.users[prevAward.kingId].name)}</b><small>${esc(teamById(state.users[prevAward.kingId].teamId).community)}</small>`
              : '<b class="muted">첫날이라 아직 없어요</b>'}
          </div>
          <div class="honor__item">
            <span class="honor__label">${icon('crown', 20)}오늘의 폭풍성장</span>
            ${prevAward
              ? `<b>${esc(teamById(prevAward.stormTeam).community)}</b><small>어제 +${num(prevAward.stormGain)} EXP</small>`
              : '<b class="muted">내일 첫 발표</b>'}
          </div>
          <div class="honor__item honor__item--wide">
            <span class="honor__label">지금 지식왕 후보</span>
            ${liveKing
              ? `<b>${esc(liveKing.user.name)}</b><small>${esc(teamById(liveKing.user.teamId).community)} · ${liveKing.perfect ? '퀴즈 전부 정답 1등' : `오늘 ${liveKing.user.daily.points}P`}</small>`
              : '<b class="muted">아직 없어요. 첫 주인공이 되어 보세요!</b>'}
          </div>
        </div>
      </section>
    </div>

    <section class="card home__rank">
      ${secHead('실시간 팀 순위', pillLink('#/rank'))}
      <ol class="mini-rank">
        ${ranking.map((r) => `
          <li class="${r.id === t.id ? 'is-mine' : ''}">
            <span class="mini-rank__no">${r.rank}</span>
            <img class="px" src="${spriteOf(r.id)}" width="40" height="40" alt="">
            <div class="mini-rank__body">
              <div><b>${esc(r.community)}</b>${hasCrown(state, r.id) ? icon('crown', 16, '왕관') : ''}<small>Lv.${r.info.level}</small></div>
              <div class="bar"><span style="width:${Math.max(2, (r.exp / top) * 100)}%;background:${r.color}"></span></div>
            </div>
            <span class="mini-rank__exp">${num(r.exp)}</span>
          </li>`).join('')}
      </ol>
    </section>

    <section class="card home__feed">
      ${secHead('실시간 소식')}
      <ul class="feed">
        ${state.feed.slice(0, 12).map((f) => `
          <li>
            <span class="feed__icon">${feedIcon(f)}</span>
            <p>${esc(f.text)}</p>
            <time>${timeAgo(f.ts)}</time>
          </li>`).join('')}
      </ul>
    </section>

    <a class="card t-banner" href="#/tournament">
      <div class="t-banner__text">
        <span class="eyebrow">${dDay > 0 ? `D-${dDay}` : 'TODAY'}</span>
        <h2>최종 토너먼트</h2>
        <p>${dDay > 0 ? `${EVENT.totalDays}일차 아침 순위로 대진표가 확정돼요. 지금 우리 팀은 ${mine.rank}위!` : '오늘 최강 몬스터가 가려져요. 대진표를 확인하세요!'}</p>
      </div>
      <div class="t-banner__mons" aria-hidden="true">
        ${ranking.slice(0, 4).map((r) => `<img class="px" src="${spriteOf(r.id)}" width="64" height="64" alt="">`).join('')}
      </div>
    </a>
  </div>`;
}

// ================================================================ 오늘의 미션
export function renderMission(state, ui) {
  const u = me(state);
  const d = daily(state, u);
  const qs = state.quiz;
  const attended = u.attendedDays.includes(state.day);

  const stamps = Array.from({ length: EVENT.totalDays }, (_, i) => {
    const day = i + 1;
    const done = u.attendedDays.includes(day);
    const cls = [done ? 'is-done' : '', day === state.day ? 'is-today' : '', day > state.day ? 'is-future' : ''].join(' ');
    return `<li class="stamp ${cls}">
      <span class="stamp__circle">${done ? icon('food', 28) : day === EVENT.totalDays ? icon('crown', 24) : day}</span>
      <small>${day === EVENT.totalDays ? '토너먼트' : `${day}일차`}</small>
    </li>`;
  }).join('');

  return `
  ${pageHead('오늘의 미션', '매일 출석하고 AI 퀴즈를 풀어 몬스터 먹이를 모아요.')}
  <div class="mission">
    <section class="card attend">
      ${secHead('출석 체크')}
      <ol class="stamps">${stamps}</ol>
      <p class="attend__msg">${attended
        ? `${icon('food', 24)} ${state.day}일차 출석 완료! 먹이 ${RULES.attendanceFood}개를 받았어요.`
        : '오늘 출석하고 먹이를 받아요.'}</p>
      ${attended ? '' : `<button class="btn btn--primary" data-action="checkin">출석하고 먹이 받기</button>`}
    </section>

    <section class="card quiz-card">
      ${secHead('오늘의 AI 퀴즈', `<span class="sec-note">1문제 ${RULES.quizPoints}P · 모두 맞히면 고급 먹이 · 문제마다 힌트 2개</span>`)}
      <p class="quiz-theme"><span class="tag">${state.day}일차 주제</span><b>${esc(state.today.theme)}</b></p>
      ${renderQuiz(state, ui, u, d, qs)}
    </section>

    <section class="card tip-card">
      <span class="tip-card__badge" aria-hidden="true">TIP</span>
      <div>
        <span class="eyebrow">오늘의 AI 꿀팁</span>
        <h3>${esc(state.today.tip.title)}</h3>
        <p>${esc(state.today.tip.body)}</p>
      </div>
    </section>
  </div>`;
}

// 힌트는 한 단계씩 연다 (1단계 단서 → 2단계 초성·결정적 단서)
function renderHints(state, ui, q, qi) {
  if (!q.hints?.length) return '';
  const shown = ui.hintsShown[`${state.day}-${qi}`] || 0;
  return `
    <div class="hints">
      ${q.hints.slice(0, shown).map((h, i) => `<p class="hint"><span class="hint__badge">힌트 ${i + 1}</span><span>${esc(h)}</span></p>`).join('')}
      ${shown < q.hints.length
        ? `<button class="hint-btn" data-action="quiz-hint" data-q="${qi}"><span class="hint-btn__icon" aria-hidden="true">?</span>${shown ? '힌트 하나 더 보기' : '막혔나요? 힌트 보기'} <small>(${shown}/${q.hints.length})</small></button>`
        : ''}
    </div>`;
}

function renderQuiz(state, ui, u, d, qs) {
  const progress = `<div class="quiz__progress">${qs.map((_, i) => {
    const a = d.quiz[i];
    return `<span class="${a ? (a.correct ? 'is-correct' : 'is-wrong') : ''}"></span>`;
  }).join('')}</div>`;

  const showIndex = ui.quizReveal ?? d.quiz.findIndex((a) => !a);
  if (showIndex < 0) {
    const correct = d.quiz.filter((a) => a.correct).length;
    const perfect = correct === 3;
    return `
      ${progress}
      <div class="quiz__summary ${perfect ? 'is-perfect' : ''}">
        ${icon(perfect ? 'premium' : 'point', 64)}
        <h3>${perfect ? '3문제 모두 정답!' : `3문제 중 ${correct}문제 정답`}</h3>
        <p>포인트 <b>+${correct * RULES.quizPoints}P</b>${perfect ? ` · 고급 먹이 <b>+${RULES.quizPerfectPremium}</b>` : ''} 받았어요. 내일 새 문제가 나와요.</p>
      </div>
      <ol class="quiz__review">
        ${qs.map((q, i) => `
          <li class="${d.quiz[i].correct ? 'is-correct' : 'is-wrong'}">
            <b>${d.quiz[i].correct ? '정답' : '오답'}</b>
            <div><p>${esc(q.q)}</p><small>정답: ${esc(q.options[q.answer])} — ${esc(q.explain)}</small></div>
          </li>`).join('')}
      </ol>`;
  }

  const q = qs[showIndex];
  const answered = d.quiz[showIndex];
  const options = q.options.map((o, k) => {
    let cls = '';
    if (answered) {
      if (k === q.answer) cls = 'is-correct';
      else if (k === answered.choice) cls = 'is-wrong';
    }
    return `<button class="quiz__opt ${cls}" data-action="quiz-answer" data-q="${showIndex}" data-choice="${k}" ${answered ? 'disabled' : ''}>
      <b>${'ABCD'[k]}</b><span>${esc(o)}</span>
    </button>`;
  }).join('');

  const isLast = d.quiz.every(Boolean);
  return `
    ${progress}
    <div class="quiz">
      <div class="quiz__meta"><span class="tag">${esc(q.tag)}</span><span>문제 ${showIndex + 1} / 3</span></div>
      <h3 class="quiz__q">${esc(q.q)}</h3>
      ${answered ? '' : renderHints(state, ui, q, showIndex)}
      <div class="quiz__options">${options}</div>
      ${answered ? `
        <div class="quiz__feedback ${answered.correct ? 'is-correct' : 'is-wrong'}" role="status">
          <b>${answered.correct ? `정답이에요! +${RULES.quizPoints}P` : '아쉬워요!'}</b>
          <p>${esc(q.explain)}</p>
          ${q.classroom ? `<div class="quiz__classroom"><b>수업에서 이렇게</b><p>${esc(q.classroom)}</p></div>` : ''}
          ${q.source ? `<small class="quiz__source">근거: ${esc(q.source)}</small>` : ''}
        </div>
        <button class="btn btn--primary" data-action="quiz-next">${isLast ? '결과 보기' : '다음 문제'}</button>` : ''}
    </div>`;
}

// ================================================================ 도전 · 뽑기
const HAND_NAMES = { rock: '바위', scissors: '가위', paper: '보' };

export function renderPlay(state, ui) {
  const u = me(state);
  const d = daily(state, u);
  const odds = (rows) => `
    <details class="odds"><summary>확률 보기</summary>
      <ul>${rows.map(([label, w]) => `<li><span>${label}</span><b>${w}%</b></li>`).join('')}</ul>
    </details>`;

  const rpsResult = d.rps
    ? `<p class="play-result ${d.rps === 'win' ? 'is-win' : 'is-lose'}">${d.rps === 'win' ? '오늘은 AI 보스를 이겼어요! 먹이가 2배가 됐어요.' : '오늘은 AI 보스에게 졌어요. 내일 다시 도전해요!'}</p>`
    : '';

  return `
  ${pageHead('도전 · 뽑기', '운과 배짱으로 역전을 노려요. 럭키박스와 AI 보스는 하루 한 번!')}
  <div class="play">
    <section class="card play-card">
      ${secHead('럭키박스')}
      <div class="lucky" id="lucky">
        <div class="lucky__box ${d.lucky ? 'is-open' : ''}" id="luckyBox">${icon('luckybox', 96, '럭키박스')}</div>
        <p class="play-desc">누구나 하루 한 번! 아주 낮은 확률로 <b>먹이 100개 잭팟</b>이 나와요.</p>
      </div>
      ${d.lucky
        ? `<p class="play-result is-win">오늘의 결과: <b>${esc(d.lucky)}</b></p><button class="btn btn--soft btn--block" disabled>내일 다시 열 수 있어요</button>`
        : `<button class="btn btn--primary btn--block" data-action="lucky-open">럭키박스 열기</button>`}
      ${odds(LUCKY_BOX.map((r) => [r.label, r.w]))}
    </section>

    <section class="card play-card rps">
      ${secHead('AI 보스 도전장')}
      <div class="rps__arena">
        <div class="rps__boss">
          <img class="px" src="assets/monsters/boss/boss.png" width="64" height="64" alt="AI 보스" onerror="this.style.visibility='hidden'">
          <div class="bubble">${d.rps === 'win' ? '크윽… 내일 보자!' : d.rps === 'lose' ? '후후, 내일 또 와라!' : '내 손을 읽을 수 있을까?'}</div>
        </div>
        <div class="rps__vs">
          <figure><span class="rps__hand" id="myHand">${ui.rpsLast ? HANDS[ui.rpsLast.hand] : '❔'}</span><figcaption>나</figcaption></figure>
          <small>VS</small>
          <figure><span class="rps__hand" id="bossHand">${ui.rpsLast ? HANDS[ui.rpsLast.boss] : '❔'}</span><figcaption>AI 보스</figcaption></figure>
        </div>
      </div>
      <p class="play-desc">이기면 보유 먹이 <b>${RULES.rps.winMultiplier}배</b>, 지면 <b>절반</b>. 비기면 한 번 더! 지금 내 먹이 <b>${num(u.food)}</b>개</p>
      ${d.rps ? rpsResult : `
        <div class="rps__pick">
          ${Object.entries(HANDS).map(([k, e]) => `
            <button class="hand-btn" data-action="rps" data-hand="${k}"><span>${e}</span>${HAND_NAMES[k]}</button>`).join('')}
        </div>`}
    </section>

    <section class="card play-card gacha">
      ${secHead('쿠폰 뽑기')}
      <div class="gacha-machine" id="gachaMachine" aria-hidden="true">
        <div class="gacha-machine__dome">
          ${['#f06b7a', '#4ecdc4', '#f5b82e', '#8b6fd6', '#66ae7d', '#3fb6dc', '#f06b7a', '#f5b82e'].map((c) => `<i style="--c:${c}"></i>`).join('')}
        </div>
        <div class="gacha-machine__body">
          <span class="gacha-machine__knob"></span>
          <span class="gacha-machine__slot"></span>
        </div>
      </div>
      <p class="play-desc">1회 <b>${RULES.gachaCost}P</b> · 내 포인트 <b>${num(u.points)}P</b><br>커피 교환권 남은 수량 <b>${state.coffeeStock}</b>개</p>
      <button class="btn btn--primary btn--block" data-action="gacha" ${u.points < RULES.gachaCost ? 'disabled' : ''}>
        ${u.points < RULES.gachaCost ? `포인트가 ${RULES.gachaCost - u.points} 부족해요` : `${RULES.gachaCost}P로 뽑기`}
      </button>
      ${odds(GACHA.map((r) => [ITEMS[r.item].name, r.w]))}
    </section>
  </div>`;
}

// ================================================================ 가방
export function renderBag(state, ui) {
  const u = me(state);
  const ts = state.teams[u.teamId];
  const mates = teammates(state, u);
  const kind = ui.giftKind || 'food';
  const g = GIFT_KINDS[kind];
  const now = clockNow();

  const itemCard = (key) => {
    const it = ITEMS[key];
    const count = u.items[key];
    let action = '';
    if (key === 'booster') action = `<button class="btn btn--primary btn--sm" data-action="use-booster" ${count ? '' : 'disabled'}>우리 팀에 사용</button>`;
    if (key === 'balloon') action = `<button class="btn btn--primary btn--sm" data-action="balloon-pick" ${count ? '' : 'disabled'}>던질 팀 고르기</button>`;
    if (key === 'coffee') action = `<button class="btn btn--primary btn--sm" data-action="redeem-coffee" ${count ? '' : 'disabled'}>교환 코드 받기</button>`;
    return `
      <article class="item-card ${count ? '' : 'is-empty'}">
        <div class="item-card__icon">${icon(it.icon, 48)}<span class="count">×${count}</span></div>
        <div class="item-card__body">
          <b>${it.name}</b>
          <p>${it.desc}</p>
          ${key === 'booster' && ts.boosterUntil > now ? `<small class="live">우리 팀 부스터 작동 중 · <time data-until="${ts.boosterUntil}">${timeLeft(ts.boosterUntil)}</time></small>` : ''}
          ${action}
        </div>
      </article>`;
  };

  return `
  ${pageHead('가방', '모은 먹이와 아이템을 쓰거나, 같은 커뮤니티 멤버에게 선물해요.')}
  <div class="bag">
    <section class="card wallet wallet--row">
      <div class="wallet__item">${icon('food', 36)}<b>${num(u.food)}</b><span>먹이</span></div>
      <div class="wallet__item">${icon('premium', 36)}<b>${num(u.premium)}</b><span>고급 먹이</span></div>
      <div class="wallet__item">${icon('point', 36)}<b>${num(u.points)}</b><span>포인트</span></div>
      <a class="btn btn--soft btn--sm" href="#/home">몬스터에게 먹이 주기</a>
    </section>

    <section class="card">
      ${secHead('아이템', pillLink('#/play', '쿠폰 뽑기'))}
      <div class="item-grid">${Object.keys(ITEMS).map(itemCard).join('')}</div>
    </section>

    ${u.coupons.length ? `
    <section class="card">
      ${secHead('내 커피 교환 코드')}
      <p class="sec-desc">운영사무국에 코드를 보여 주면 커피 기프티콘으로 바꿔 드려요.</p>
      <ul class="coupons">${u.coupons.map((c) => `<li><code>${c.code}</code><time>${new Date(c.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></li>`).join('')}</ul>
    </section>` : ''}

    <section class="card">
      ${secHead('멤버에게 선물하기', `<span class="sec-note">${esc(teamById(u.teamId).community)} 멤버끼리만</span>`)}
      <div class="gift-kinds" role="radiogroup" aria-label="선물할 것">
        ${Object.entries(GIFT_KINDS).map(([k, gk]) => `
          <button class="gift-kind ${k === kind ? 'is-selected' : ''}" role="radio" aria-checked="${k === kind}" data-action="gift-kind" data-kind="${k}">
            ${icon(gk.icon, 24)}<span>${gk.name}</span><b>${gk.has(u)}</b>
          </button>`).join('')}
      </div>
      <ul class="members">
        ${mates.map((m) => `
          <li>
            <span class="avatar" style="--team:${teamById(m.teamId).color}">${esc(m.name.slice(0, 1))}</span>
            <b>${esc(m.name)}</b>
            <small>총 ${num(m.totalPoints)}P</small>
            <button class="btn btn--soft btn--sm" data-action="gift" data-to="${m.id}" data-kind="${kind}" ${g.has(u) ? '' : 'disabled'}>${g.name} 1개 선물</button>
          </li>`).join('') || '<li class="muted">아직 다른 멤버가 없어요.</li>'}
      </ul>
    </section>
  </div>`;
}

export function renderBalloonPicker(state) {
  const u = me(state);
  const now = clockNow();
  return `
    <h2 class="modal__title">${icon('balloon', 32)}물풍선을 던질 팀</h2>
    <p class="modal__desc">맞은 팀은 ${RULES.balloon.minutes}분 동안 먹이 경험치가 ${RULES.balloon.multiplier}배가 돼요. 이미 젖은 팀에 던지면 시간이 처음부터 다시 시작돼요.</p>
    <div class="target-grid">
      ${teamRanking(state).filter((r) => r.id !== u.teamId).map((r) => `
        <button class="target" data-action="balloon-throw" data-team="${r.id}" style="--team:${r.color}">
          <img class="px" src="${spriteOf(r.id)}" width="56" height="56" alt="">
          <b>${esc(r.community)}</b>
          <small>${r.rank}위 · Lv.${r.info.level}${r.s.wetUntil > now ? ' · 젖음' : ''}</small>
        </button>`).join('')}
    </div>`;
}

// ================================================================ 랭킹
export function renderRank(state, ui) {
  const u = me(state);
  const tab = ui.rankTab || 'team';
  const tabs = [['team', '팀 순위'], ['person', '개인 순위'], ['hall', '명예의 전당']];
  let body = '';

  if (tab === 'team') {
    const ranking = teamRanking(state);
    const top = ranking[0].exp || 1;
    const now = clockNow();
    body = `
      <ol class="rank-list">
        ${ranking.map((r) => `
          <li class="rank-row ${r.id === u.teamId ? 'is-mine' : ''}" style="--team:${r.color}">
            <span class="rank-row__no rank-${r.rank}">${r.rank}</span>
            <div class="rank-row__mon">
              ${monsterImg(r.id, r.exp, 64)}
              ${hasCrown(state, r.id) ? `<img class="px rank-row__crown" src="assets/icons/crown.png" width="24" height="24" alt="왕관">` : ''}
            </div>
            <div class="rank-row__body">
              <div class="rank-row__title">
                <b>${esc(r.community)}</b><span>${esc(r.monster)}</span>
                ${r.s.boosterUntil > now ? `<span class="fx-dot fx-dot--boost">${icon('booster', 14)}부스터</span>` : ''}
                ${r.s.wetUntil > now ? `<span class="fx-dot fx-dot--wet">${icon('balloon', 14)}젖음</span>` : ''}
              </div>
              <div class="bar"><span style="width:${Math.max(2, (r.exp / top) * 100)}%;background:${r.color}"></span></div>
              <div class="rank-row__meta">Lv.${r.info.level} ${r.info.stage.name} · 멤버 ${r.members}명 · 오늘 +${num(r.todayGain)}</div>
            </div>
            <div class="rank-row__exp"><b>${num(r.exp)}</b><small>EXP</small></div>
          </li>`).join('')}
      </ol>`;
  } else if (tab === 'person') {
    const mode = ui.rankMode || 'today';
    const list = userRanking(state, mode);
    const mineRow = list.find((r) => r.u.id === u.id);
    const shown = list.slice(0, 20);
    const row = (r) => `
      <li class="person-row ${r.u.id === u.id ? 'is-mine' : ''}">
        <span class="rank-row__no rank-${r.rank}">${r.rank}</span>
        <span class="avatar" style="--team:${teamById(r.u.teamId).color}">${esc(r.u.name.slice(0, 1))}</span>
        <div><b>${esc(r.u.name)}${r.u.id === u.id ? ' (나)' : ''}</b><small>${esc(teamById(r.u.teamId).community)}</small></div>
        <span class="person-row__score">${num(r.score)}P</span>
      </li>`;
    body = `
      <div class="seg" role="tablist">
        <button class="${mode === 'today' ? 'is-on' : ''}" data-action="rank-mode" data-mode="today">오늘</button>
        <button class="${mode === 'total' ? 'is-on' : ''}" data-action="rank-mode" data-mode="total">전체</button>
      </div>
      <ol class="person-list">
        ${shown.map(row).join('')}
        ${mineRow && mineRow.rank > 20 ? `<li class="gap">⋯</li>${row(mineRow)}` : ''}
      </ol>`;
  } else {
    const days = Object.keys(state.awards).map(Number).sort((a, b) => b - a);
    const live = knowledgeKing(state);
    body = `
      <div class="hall">
        <article class="hall-card is-live">
          <span class="eyebrow">${state.day}일차 · 진행 중</span>
          <div class="hall-card__row">${icon('point', 32)}<div><small>지식왕 후보</small><b>${live ? esc(live.user.name) : '아직 없어요'}</b>${live ? `<small>${esc(teamById(live.user.teamId).community)}</small>` : ''}</div></div>
        </article>
        ${days.map((day) => {
          const a = state.awards[day];
          const king = a.kingId ? state.users[a.kingId] : null;
          const st = teamById(a.stormTeam);
          return `
            <article class="hall-card">
              <span class="eyebrow">${day}일차</span>
              <div class="hall-card__row">${icon('point', 32)}<div><small>오늘의 지식왕</small><b>${king ? esc(king.name) : '없음'}</b>${king ? `<small>${esc(teamById(king.teamId).community)}${a.kingPerfect ? ' · 퀴즈 전부 정답 1등' : ''}</small>` : ''}</div></div>
              <div class="hall-card__row"><img class="px" src="${spriteOf(st.id)}" width="32" height="32" alt=""><div><small>오늘의 폭풍성장</small><b>${esc(st.community)}</b><small>+${num(a.stormGain)} EXP</small></div></div>
            </article>`;
        }).join('')}
        ${days.length ? '' : '<p class="muted hall__empty">1일차가 끝나면 첫 시상 결과가 올라와요.</p>'}
      </div>`;
  }

  return `
  ${pageHead('랭킹', '팀 경험치 순위와 매일의 지식왕, 폭풍성장 팀을 확인해요.')}
  <section class="card">
    <div class="tabs" role="tablist">
      ${tabs.map(([k, label]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'is-on' : ''}" data-action="rank-tab" data-tab="${k}">${label}</button>`).join('')}
      <a class="pill-link tabs__extra" href="#/tournament">토너먼트 <span aria-hidden="true">→</span></a>
    </div>
    ${body}
  </section>`;
}

// ================================================================ 최종 토너먼트
export function tournamentData(state) {
  const final = state.day === EVENT.totalDays && state.tournament;
  const seeds = final ? state.tournament.seeds : teamRanking(state).map((t) => t.id);
  const results = final ? state.tournament.results : {};
  return { final, seeds, results, rounds: buildBracket(seeds) };
}

export function renderTournament(state) {
  const u = me(state);
  const { final, seeds, results, rounds } = tournamentData(state);
  const lastMatch = rounds[rounds.length - 1].matches[0];
  const champion = results[lastMatch.id]?.winner;
  const dDay = EVENT.totalDays - state.day;

  const slot = (s, m) => {
    const id = slotTeam(s, results);
    const res = results[m.id];
    if (!id) return `<div class="slot is-tbd"><span class="slot__seed">-</span><span>승자 대기</span></div>`;
    const t = teamById(id);
    const seed = seeds.indexOf(id) + 1;
    const cls = res ? (res.winner === id ? 'is-win' : 'is-lose') : '';
    return `
      <div class="slot ${cls} ${id === u.teamId ? 'is-mine' : ''}">
        <span class="slot__seed">${seed}</span>
        <img class="px" src="${spriteOf(id)}" width="32" height="32" alt="">
        <span class="slot__name">${esc(t.community)}</span>
        <small>Lv.${levelInfo(state.teams[id].exp).level}</small>
      </div>`;
  };

  return `
  ${pageHead('최종 토너먼트', `${EVENT.name} 마지막 날, 가장 크게 키운 몬스터끼리 겨뤄 우승 커뮤니티를 가려요.`)}
  <section class="card t-head">
    <div>
      <span class="eyebrow">${final ? 'TODAY · 대진 확정' : `D-${dDay} · 예상 대진표`}</span>
      <h2>${final ? '토너먼트가 열렸어요!' : '지금 순위라면 이렇게 붙어요'}</h2>
      <p>${final
        ? '운영진이 행사장에서 경기를 차례로 진행해요. 끝난 경기는 누구나 다시 볼 수 있어요. 레벨이 높을수록 유리하지만 역전도 나와요.'
        : `${EVENT.totalDays}일차 아침 팀 순위로 대진이 확정돼요. 상위 ${2 ** Math.floor(Math.log2(seeds.length))}팀 안에 들면 예선 없이 바로 본선이에요.`}</p>
    </div>
    <button class="btn btn--soft" data-action="practice-pick">연습 배틀 해보기</button>
  </section>

  ${champion ? `
  <section class="card champion" style="--team:${teamById(champion).color}">
    <img class="px champion__crown" src="assets/icons/crown.png" width="48" height="48" alt="">
    <img class="px" src="${spriteOf(champion)}" width="128" height="128" alt="">
    <div><span class="eyebrow">우승</span><h2>${esc(teamById(champion).community)}</h2><p>${esc(josa(teamById(champion).monster, '이/가'))} ${EVENT.name} 최강 몬스터가 됐어요!</p></div>
  </section>` : ''}

  <section class="card bracket-wrap">
    <div class="bracket">
      ${rounds.map((r) => `
        <div class="bracket__round ${r.name === '예선' ? 'bracket__round--prelim' : ''}">
          <h3>${r.name}</h3>
          <div class="bracket__matches">
            ${r.matches.map((m) => {
              const a = slotTeam(m.a, results);
              const b = slotTeam(m.b, results);
              const done = !!results[m.id];
              return `
                <div class="match ${done ? 'is-done' : ''}">
                  ${slot(m.a, m)}${slot(m.b, m)}
                  ${done ? `<button class="btn btn--soft btn--sm btn--block" data-action="replay" data-match="${m.id}">경기 다시 보기</button>` : final && a && b ? '<span class="match__wait">곧 경기가 열려요</span>' : ''}
                </div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </div>
  </section>`;
}

export function renderPracticePicker(state) {
  const u = me(state);
  return `
    <h2 class="modal__title">연습 배틀 상대 고르기</h2>
    <p class="modal__desc">연습 배틀 결과는 순위에 반영되지 않아요.</p>
    <div class="target-grid">
      ${teamRanking(state).filter((r) => r.id !== u.teamId).map((r) => `
        <button class="target" data-action="practice-start" data-team="${r.id}" style="--team:${r.color}">
          <img class="px" src="${spriteOf(r.id)}" width="56" height="56" alt="">
          <b>${esc(r.community)}</b>
          <small>${r.rank}위 · Lv.${r.info.level}</small>
        </button>`).join('')}
    </div>`;
}

export function renderBattle(battle, title) {
  const fighter = (f, side) => {
    const t = teamById(f.id);
    const { id, lv } = f;
    return `
      <div class="fighter fighter--${side}" id="fighter-${side}" style="--team:${t.color}">
        <div class="fighter__hp"><span id="hp-${side}" style="width:100%"></span></div>
        <img class="px" src="${spriteOf(id)}" width="128" height="128" alt="">
        <b>${esc(t.community)}</b>
        <small>${esc(t.monster)} · Lv.${lv}</small>
      </div>`;
  };
  return `
    <div class="battle">
      <span class="eyebrow">${esc(title)}</span>
      <div class="battle__field">
        ${fighter(battle.a, 'a')}
        <span class="battle__vs">VS</span>
        ${fighter(battle.b, 'b')}
      </div>
      <ol class="battle__log" id="battleLog" aria-live="polite"></ol>
      <div class="battle__actions" id="battleActions"></div>
    </div>`;
}

// ================================================================ 내 정보
export function renderSettings(state, token, revealed) {
  const u = me(state);
  const t = teamById(u.teamId);
  return `
    <h2 class="modal__title">내 정보</h2>
    <div class="profile-card profile-card--modal">
      <img class="px" src="${spriteOf(t.id)}" width="56" height="56" alt="">
      <div><strong>${esc(u.name)}</strong>${teamChip(t)}</div>
    </div>
    <section class="device-code">
      <h3>다른 기기에서 이어하기</h3>
      <p>휴대폰을 바꾸거나 컴퓨터에서도 하고 싶다면, 그 기기의 시작 화면에서 <b>연결 코드</b>를 넣어 주세요. 코드는 나만 알고 있어야 해요.</p>
      <div class="device-code__box">
        <code>${revealed ? esc(token) : '•••••-•••••-•••••'}</code>
        <button class="btn btn--soft btn--sm" data-action="reveal-code">${revealed ? '숨기기' : '보기'}</button>
        ${revealed ? '<button class="btn btn--primary btn--sm" data-action="copy-code">복사</button>' : ''}
      </div>
    </section>
    <button class="btn btn--danger btn--block" data-action="logout">이 기기에서 나가기</button>
    <p class="modal__hint">나가도 기록은 서버에 남아 있어요. 연결 코드로 다시 들어올 수 있어요.</p>`;
}

// ================================================================ 운영자 화면
export function renderAdmin(state, ui) {
  const ov = ui.adminOverview;
  if (!ov) {
    return `
    ${pageHead('운영자', '운영자 키를 넣으면 일차 넘기기, 토너먼트 진행, 커피 교환 처리를 할 수 있어요.')}
    <section class="card admin-login">
      <label class="field">
        <input id="adminKey" type="password" autocomplete="off" placeholder="운영자 키">
        <small>키는 이 기기에만 저장돼요.</small>
      </label>
      <p class="form-error" id="adminError" role="alert">${esc(ui.adminError || '')}</p>
      <button class="btn btn--primary" data-action="admin-login">들어가기</button>
    </section>`;
  }

  const { final, results, rounds } = tournamentData(state);
  const playable = rounds.flatMap((r) => r.matches.map((m) => ({ ...m, round: r.name })))
    .map((m) => ({ ...m, aId: slotTeam(m.a, results), bId: slotTeam(m.b, results) }))
    .filter((m) => m.aId && m.bId && !results[m.id]);

  return `
  ${pageHead('운영자', `참가자 ${num(ov.userCount)}명 · ${ov.day}일차 / ${ov.totalDays}일${ov.startDate ? ` · 시작일 ${ov.startDate} (자정마다 자동으로 넘어감)` : ' · 일차는 아래 버튼으로 넘겨요'}`)}
  <div class="admin">
    <section class="card">
      ${secHead('일차 관리')}
      <p class="sec-desc">다음 날로 넘기면 오늘의 지식왕과 폭풍성장 팀이 발표되고, 마지막 날에는 대진표가 확정돼요.</p>
      <button class="btn btn--primary" data-action="admin-next-day" ${ov.day >= ov.totalDays ? 'disabled' : ''}>${ov.day >= ov.totalDays ? '마지막 날이에요' : `${ov.day + 1}일차로 넘기기`}</button>
      <table class="admin-table">
        <thead><tr><th>커뮤니티</th><th>참가자</th><th>경험치</th></tr></thead>
        <tbody>${ov.teams.map((t) => `<tr><td>${esc(t.community)}</td><td>${num(t.members)}</td><td>${num(t.exp)}</td></tr>`).join('')}</tbody>
      </table>
    </section>

    <section class="card">
      ${secHead('토너먼트 진행')}
      ${!final
        ? '<p class="sec-desc">마지막 날이 되면 여기서 경기를 차례로 열 수 있어요.</p>'
        : playable.length
          ? `<ul class="admin-matches">${playable.map((m) => `
              <li>
                <span class="tag">${m.round}</span>
                <b>${esc(teamById(m.aId).community)}</b><span>vs</span><b>${esc(teamById(m.bId).community)}</b>
                <button class="btn btn--primary btn--sm" data-action="admin-battle" data-match="${m.id}">경기 시작</button>
              </li>`).join('')}</ul>`
          : '<p class="sec-desc">모든 경기가 끝났어요.</p>'}
    </section>

    <section class="card">
      ${secHead('커피 교환 코드', `<span class="sec-note">남은 교환권 ${ov.coffeeStock}개</span>`)}
      ${ov.coupons.length ? `
      <table class="admin-table">
        <thead><tr><th>코드</th><th>참가자</th><th>지급</th></tr></thead>
        <tbody>${ov.coupons.map((c) => `
          <tr class="${c.done ? 'is-done' : ''}">
            <td><code>${esc(c.code)}</code></td>
            <td>${esc(c.name)}<small>${esc(teamById(c.teamId).community)}</small></td>
            <td><button class="btn btn--sm ${c.done ? 'btn--soft' : 'btn--primary'}" data-action="admin-coupon" data-code="${esc(c.code)}" data-done="${c.done ? '0' : '1'}">${c.done ? '지급 완료 · 되돌리기' : '지급 완료로 표시'}</button></td>
          </tr>`).join('')}</tbody>
      </table>` : '<p class="sec-desc">아직 교환 코드를 받은 사람이 없어요.</p>'}
    </section>

    <section class="card">
      ${secHead('참가자 관리')}
      <label class="field"><input id="adminSearch" type="search" placeholder="이름으로 찾기" autocomplete="off"></label>
      <ul class="admin-users">${ov.users.map((u) => `
        <li data-name="${esc(u.name)}"><b>${esc(u.name)}</b><small>${esc(teamById(u.teamId).community)} · ${num(u.totalPoints)}P</small>
          <button class="btn btn--danger btn--sm" data-action="admin-remove" data-user="${u.id}" data-name="${esc(u.name)}">내보내기</button></li>`).join('')}
      </ul>
    </section>

    <section class="card admin-danger">
      ${secHead('전체 초기화')}
      <p class="sec-desc">모든 참가자와 기록이 지워져요. 리허설이 끝난 뒤 본 행사 전에만 쓰세요.</p>
      <button class="btn btn--danger" data-action="admin-reset">전체 초기화</button>
      <button class="btn btn--soft" data-action="admin-logout">운영자 화면 나가기</button>
    </section>
  </div>`;
}
