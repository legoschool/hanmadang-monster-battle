// 페이지 화면 (HTML 문자열을 만든다)
import {
  EVENT, TEAMS, RULES, LUCKY_BOX, GACHA, ITEMS, BOSSES, FINAL_BOSS, AVATARS, PRIZE_AWARDS, PACES, MODES, MODE_INFO, LEVELS, STORY, SKILL_LEVEL, SAMPLE_MARK,
  eggOf,
  spriteOf, bossImgOf, avatarOf,
} from './config.js';
import {
  teamById, bossOf, levelInfo, weekly, daily, allianceList, crewRanking, knowledgeKing, weeklyAce, hasCrown,
  bossInfo, finalPreview, cheerOpen, canOpenPrize, prizeWinnerName, teamMembers, HANDS, GIFT_KINDS, josa,
  FINAL_WEEK, isPlayWeek, weekDates, eventDateLabel, untilEventLabel, eventStart, roundStart,
  scheduleOf, paceOf, roundLength, paceKeyFor, eventDefaultMs, killLabel, bossPower, roundDays, byDay, cardFor, cardThemeFor, teamSkill, isFree,
} from './game.js';
import { cardsForWeek, CARD_SETS, CARDS_TOTAL, cardAt } from './cards.js';
import { esc, num, icon, monsterImg, timeLeft, timeAgo, now as clockNow } from './ui.js';

const me = (state) => state.users[state.me];
// 운영자 일정 칸에서 쓰는 도우미 (한국 시간 입력칸 ↔ 시각, 간격 이름 찾기)
const fromKstInputView = (v) => (v ? Date.parse(`${v}:00+09:00`) : NaN);
const whenText = (ms) => new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);

const SVG = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  mission: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  play: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 13h18M12 8S10.5 3 7.5 4 9 8 12 8zm0 0s1.5-5 4.5-4S15 8 12 8z"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  crew: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 15.4a4.5 4.5 0 0 1 6 4.6"/>',
  final: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5 14 11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
export const svg = (name) =>
  `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name]}</svg>`;

export const NAV = [
  { route: 'home', label: '홈', short: '홈' },
  { route: 'mission', label: '원정 미션', short: '미션' },
  { route: 'play', label: '도전 · 뽑기', short: '도전' },
  { route: 'bag', label: '가방', short: '가방' },
  { route: 'crew', label: '원정대', short: '원정대' },
  { route: 'final', label: '최종 결전', short: '결전' },
];

const secHead = (title, extra = '') => `<div class="sec-head"><h2>${title}</h2>${extra}</div>`;
const eventDateLabelDefault = () => eventDateLabel({ end: eventDefaultMs() });
const pillLink = (href, label = '더보기') => `<a class="pill-link" href="${href}">${label} <span aria-hidden="true">→</span></a>`;
const pageHead = (title, sub) => `<header class="page-head"><h1>${title}</h1><p>${sub}</p></header>`;
// 결전까지 남은 시간: 실제 일정은 D-88, 미리 해 보기는 1초마다 줄어드는 시계
const DAY_MS = 24 * 3600 * 1000;
const eventCountdown = (S) => (eventStart(S) - clockNow() >= DAY_MS ? untilEventLabel(S, clockNow())
  : `<time data-until="${eventStart(S)}">${timeLeft(eventStart(S))}</time> 뒤`);
// 날짜 입력칸 값 (한국 시간): '2026-09-22T21:47'
const kstInput = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 16);
const teamChip = (t) => `<span class="team-chip"><i style="background:${t.color}"></i>${esc(t.community)}</span>`;

export const avatarImg = (id, size = 40, cls = '') =>
  `<img class="px avatar-img ${cls}" src="${avatarOf(id)}" width="${size}" height="${size}" alt="" onerror="this.style.visibility='hidden'">`;
export const bossImg = (id, size = 64, cls = '') =>
  `<img class="px boss-img ${cls}" src="${bossImgOf(id)}" width="${size}" height="${size}" alt="" onerror="this.style.visibility='hidden'">`;
// 대원 얼굴: 아바타 + 팀 색 테두리
const face = (u, size = 36) => `<span class="face" style="--team:${teamById(u.teamId).color}">${avatarImg(u.avatar, size)}</span>`;

function feedIcon(item) {
  if (item.avatar) return avatarImg(item.avatar, 32);
  if (item.boss) return bossImg(item.boss, 32);
  if (item.icon === 'team' && item.teamId) return `<img class="px" src="${spriteOf(item.teamId)}" width="32" height="32" alt="">`;
  return icon(item.icon, 32);
}

// ================================================================ 공통 틀
export function renderShellParts(state) {
  const u = me(state);
  const t = teamById(u.teamId);
  const S = scheduleOf(state);
  const P = paceOf(state);
  let day;
  if (state.week < 1) day = `<b>원정대 모집 중</b><span class="day-chip__mid"> · ${weekDates(S, 1).start} 출발</span>`;
  else if (state.week >= FINAL_WEEK) day = `<b>결전의 날</b><span class="day-chip__mid"> · 대마왕 글리치</span>`;
  else if (isFree(state)) day = `<b>프리 모드</b><span class="day-chip__mid"> · ${bossOf(state.week).name}</span> · ${state.lap || 1}바퀴`;
  else day = `<b>${state.week}${P.round}</b><span class="day-chip__mid"> · ${bossOf(state.week).name}</span> · <span class="day-chip__mid">결전 </span>${eventCountdown(S)}`;
  return {
    day,
    wallet: `
      <span class="mini-chip" title="먹이">${icon('food', 20)}<b>${num(u.food)}</b></span>
      <span class="mini-chip" title="고급 먹이">${icon('premium', 20)}<b>${num(u.premium)}</b></span>
      <span class="mini-chip" title="포인트">${icon('point', 20)}<b>${num(u.points)}</b></span>`,
    profile: `
      <div class="profile-card">
        ${face(u, 44)}
        <div>
          <strong>${esc(u.name)}</strong>
          ${teamChip(t)}
        </div>
      </div>`,
  };
}

// ================================================================ 시작 화면
export function renderAvatarGrid(selected, action) {
  return `
    <div class="avatar-pick" role="radiogroup" aria-label="아바타">
      ${AVATARS.map((a) => `
        <button class="avatar-pick__item ${selected === a.id ? 'is-selected' : ''}" role="radio" aria-checked="${selected === a.id}"
          data-action="${action}" data-avatar="${a.id}" title="${esc(a.name)}">
          ${avatarImg(a.id, 48)}
        </button>`).join('')}
    </div>`;
}

export function renderOnboarding(state, ui) {
  const S = scheduleOf(state);
  const P = paceOf(state);
  const crew = Object.values(state.users);
  return `
  <div class="onboard">
    <section class="onboard__hero">
      <span class="eyebrow">${EVENT.name}</span>
      <img class="onboard__logo" src="assets/brand/gdeal.svg" alt="G-DEAL" width="240" height="40">
      <h1>몬스터 <em>원정대</em></h1>
      <p class="onboard__slogan">${EVENT.slogan}</p>
      <p>${TEAMS.length}개 커뮤니티 몬스터가 한 팀이 되어 차례로 나타나는 보스를 함께 물리치고,<br class="br-desktop">
        ${eventDateLabel(S)} 한마당 현장에서 대마왕 글리치와 최종 결전을 벌여요.</p>
      <div class="parade parade--roll" aria-hidden="true">
        ${TEAMS.map((t, i) => `
          <figure style="--d:${(i * 0.18).toFixed(2)}s">
            <img class="px" src="${spriteOf(t.id)}" width="64" height="64" alt="">
            <figcaption>${esc(t.monster)}</figcaption>
          </figure>`).join('')}
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
      ${(() => {
        const t = teamById(ui.pickTeam);
        if (!t) return '<p class="onboard__note team-hint">커뮤니티를 누르면 어떤 곳인지, 어떤 스킬을 쓰는지 볼 수 있어요.</p>';
        return `
        <section class="team-about" style="--team:${t.color}">
          <div class="team-about__mons">
            <figure><img class="px" src="${eggOf(t.id)}" width="56" height="56" alt=""><figcaption>알</figcaption></figure>
            <span class="team-about__arrow">→</span>
            <figure><img class="px" src="${spriteOf(t.id)}" width="72" height="72" alt=""><figcaption>${esc(t.monster)}</figcaption></figure>
          </div>
          <div class="team-about__body">
            <b>${esc(t.community)}</b>
            <p class="team-about__what">${esc(t.about || '')}</p>
            <p class="team-about__desc">${esc(t.desc)}</p>
            ${t.skill ? `
            <div class="team-about__skill">
              ${icon('seal', 22)}
              <div><b>${esc(t.skill.name)}</b><span>${esc(t.skill.effect)}</span></div>
              <i>Lv.${SKILL_LEVEL} 습득</i>
            </div>` : ''}
          </div>
        </section>`;
      })()}
      <h2><span class="step">2</span>내 아바타 고르기</h2>
      <p class="onboard__note">활동할 때마다 이 아바타가 보스 전투 장면과 소식에 나타나요.</p>
      ${renderAvatarGrid(ui.pickAvatar, 'pick-avatar')}
      <h2><span class="step">3</span>닉네임 정하기</h2>
      <label class="field">
        <input id="nickname" type="text" maxlength="12" placeholder="예: 반짝이" autocomplete="nickname" value="${esc(ui.nickname || '')}">
        <small>소식과 원정대 화면에 보이는 이름이에요. 실명 대신 별명을 추천해요. 다시 들어올 때 이 닉네임을 써요.</small>
      </label>
      <h2><span class="step">4</span>나만 아는 힌트 만들기</h2>
      <p class="onboard__note">비밀번호 대신이에요. 다른 기기에서 들어오거나 새로 시작할 때, <b>닉네임 + 이 질문의 답</b>으로 로그인해요. 남이 맞히기 어려운 것으로 적어 주세요.</p>
      <div class="hint-fields">
        <label class="field"><input id="hintQ" type="text" maxlength="40" placeholder="질문 (예: 우리 반 반려식물 이름은?)" value="${esc(ui.hintQ || '')}"></label>
        <label class="field"><input id="hintA" type="text" maxlength="30" placeholder="답 (예: 방울이)" value="${esc(ui.hintA || '')}"></label>
      </div>
      <p class="onboard__note">띄어쓰기와 대소문자는 신경 쓰지 않아도 돼요. 개인정보(주민번호·전화번호)는 적지 마세요.</p>
      ${state.joinCodeRequired ? `
      <h2><span class="step">5</span>참가 코드</h2>
      <label class="field">
        <input id="joinCode" type="text" maxlength="40" placeholder="커뮤니티 안내에 있는 참가 코드" autocomplete="off" value="${esc(ui.joinCode || '')}">
      </label>` : ''}
      <p class="form-error" id="joinError" role="alert"></p>
      <button class="btn btn--primary btn--lg btn--block" data-action="join">원정대 합류하기</button>
    </section>

    ${crew.length ? `
    <section class="card onboard__crew">
      <h2>지금까지 <b>${num(crew.length)}</b>명이 원정대에 합류했어요</h2>
      <div class="crew-wall">${crew.slice(-40).reverse().map((u) => face(u, 32)).join('')}</div>
    </section>` : ''}

    <section class="card onboard__resume">
      <h2>이미 참여했나요? 로그인</h2>
      <p><b>닉네임</b>을 넣고 내가 만든 <b>힌트의 답</b>을 맞히면 이어서 할 수 있어요. 휴대폰을 바꿔도 똑같아요.</p>
      ${ui.foundHint ? `
      <div class="found-hint">
        <div class="found-hint__who">${face({ teamId: ui.foundHint.team, avatar: ui.foundHint.avatar }, 40)}
          <div><b>${esc(ui.foundHint.name)}</b><small>${esc(teamById(ui.foundHint.team)?.community || '')}</small></div>
        </div>
        <p class="found-hint__q">${icon('mystery', 24)}${esc(ui.foundHint.hint)}</p>
        <div class="resume-row">
          <input id="hintAnswer" type="text" maxlength="30" placeholder="힌트의 답" autocomplete="off">
          <button class="btn btn--primary" data-action="recover">로그인</button>
        </div>
        <button class="btn btn--soft btn--sm" data-action="find-reset">다른 닉네임으로 찾기</button>
      </div>` : `
      <div class="resume-row">
        <input id="findName" type="text" maxlength="12" placeholder="닉네임" autocomplete="username" value="${esc(ui.findName || '')}">
        <button class="btn btn--primary" data-action="find">힌트 보기</button>
      </div>`}
      <p class="form-error" id="resumeError" role="alert"></p>
    </section>

    <section class="card story">
      <span class="eyebrow">프롤로그</span>
      <h2>${esc(STORY.title)}</h2>
      ${STORY.lines.map((line) => `<p>${line}</p>`).join('')}
      <ul class="story__foes">
        ${STORY.foes.map((f) => `
          <li>
            ${bossImg(f.id, 48)}
            <div><b>${esc(f.name)}</b><span>${esc(f.why)}</span></div>
          </li>`).join('')}
      </ul>
      <p class="story__end">${EVENT.slogan} 배운 만큼 세지는 원정대에, 지금 합류하세요.</p>
    </section>

    <section class="how">
      ${[
        ['premium', isFree(state) ? 'AI 한 조각 48장, 지금 다 열려 있어요' : '날마다 새 AI 한 조각',
          isFree(state)
            ? '프리 모드예요. 카드와 퀴즈가 처음부터 모두 열려 있어서 마음껏 몰아서 볼 수 있어요.'
            : `${byDay(S) ? '날마다' : '조금씩'} AI·디지털 지식 카드와 퀴즈가 새로 열려요. 못 본 건 사라지지 않으니 웹툰처럼 몰아서 봐도 돼요.`],
        ['seal', '다 함께 보스 물리치기', '먹이·퀴즈·가위바위보가 모두 보스 공격이 돼요. 보스는 회복하며 버티니 여럿이 꾸준히 모여야 쓰러져요.'],
        ['mystery', `${eventDateLabel(S)} 최종 결전`, '모두 힘을 모아 마지막 보스 대마왕 글리치를 물리치면 보상이 있어요!'],
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
  const cheered = ts.cheerUntil > now;
  const boosted = ts.boosterUntil > now;
  return `
    <div class="stage stage--${size} stage--${info.stage.key} ${cheered ? 'is-cheered' : ''} ${boosted ? 'is-boosted' : ''}"
      style="--team:${teamById(teamId).color}" id="stage">
      ${hasCrown(state, teamId) ? `<img class="px stage__crown" src="assets/icons/crown.png" alt="왕관">` : ''}
      <div class="stage__mon" id="mon">${monsterImg(teamId, ts.exp, 64)}</div>
      <div class="stage__shadow"></div>
      ${cheered ? `<div class="stage__hearts" aria-hidden="true">${scatter(10, 1.6)}</div>` : ''}
      ${boosted ? `<div class="stage__spark" aria-hidden="true">${scatter(10, 1.6)}</div>` : ''}
    </div>`;
}

function effectChips(state, teamId) {
  const ts = state.teams[teamId];
  const now = clockNow();
  const chips = [];
  if (hasCrown(state, teamId)) chips.push(`<span class="fx-chip fx-chip--crown">${icon('crown', 16)}${paceOf(state).prev} MVP 팀</span>`);
  if (ts.boosterUntil > now) chips.push(`<span class="fx-chip fx-chip--boost">${icon('booster', 16)}부스터 ×${RULES.booster.multiplier} · <time data-until="${ts.boosterUntil}">${timeLeft(ts.boosterUntil)}</time></span>`);
  if (ts.cheerUntil > now) {
    const from = ts.cheerFrom ? teamById(ts.cheerFrom)?.community : '';
    chips.push(`<span class="fx-chip fx-chip--cheer">${icon('cheer', 16)}${from ? `${esc(from)}의 ` : ''}응원 ×${RULES.cheer.multiplier} · <time data-until="${ts.cheerUntil}">${timeLeft(ts.cheerUntil)}</time></span>`);
  }
  return chips.join('');
}

// 원정 지도: 4주 보스 + 현장 결전
export function journeyMap(state, u = null) {
  const S = scheduleOf(state);
  const P = paceOf(state);
  const nodes = BOSSES.map((b) => {
    const rec = state.bosses[b.week];
    let status = 'future';
    if (rec?.defeatedAt) status = 'win';
    else if (rec?.escaped || (b.week < state.week && state.week > 0)) status = 'lost';
    else if (b.week === state.week) status = 'now';
    const label = { win: '격파 · 봉인', lost: '놓침', now: '원정 중', future: weekDates(S, b.week).start.replace(/\(.\)/, '') }[status];
    const visited = u?.visitedWeeks.includes(b.week);
    return `
      <li class="journey__node is-${status}" style="--boss:${b.color}">
        <span class="journey__img">${bossImg(b.id, 56)}${status === 'win' ? icon('seal', 24, '봉인 조각') : ''}${visited ? '<i class="journey__me" title="내가 참여한 ${P.round}">✓</i>' : ''}</span>
        <b>${b.week}${P.round} · ${esc(b.name)}</b>
        <small>${label}</small>
      </li>`;
  }).join('');
  const seals = BOSSES.filter((b) => state.bosses[b.week]?.defeatedAt).length;
  const won = state.final?.wonAt;
  return `
    <section class="card journey">
      ${secHead('원정 지도', `<span class="sec-note">봉인 조각 <b>${seals}</b>/4</span>`)}
      <ol class="journey__path">
        ${nodes}
        <li class="journey__node journey__node--final is-${won ? 'win' : state.week >= FINAL_WEEK ? 'now' : 'future'}" style="--boss:${FINAL_BOSS.color}">
          <span class="journey__img">${bossImg(FINAL_BOSS.id, 56)}</span>
          <b>${esc(FINAL_BOSS.name)}</b>
          <small>${won ? '승리!' : eventDateLabel(S).replace(/\(.\)/, '') + ' 결전'}</small>
        </li>
      </ol>
    </section>`;
}

// 원형 무대: 가운데에 보스, 둘레에 커뮤니티 몬스터들. 각 팀이 얼마나 키웠는지 한눈에 보인다.
function arena(state, u, ui) {
  const P = paceOf(state);
  const play = isPlayWeek(state.week);
  const info = play ? bossInfo(state) : null;
  const f = state.week >= FINAL_WEEK ? finalPreview(state) : null;
  const boss = info || { ...FINAL_BOSS, maxHp: f?.maxHp || 0, hp: Math.max(0, (f?.maxHp || 0) - (f?.dmg || 0)), dmg: f?.dmg || 0, defeated: !!state.final?.wonAt };
  const list = allianceList(state);
  const my = list.find((t) => t.id === u.teamId);
  const d = weekly(state, u);
  const hits = (state.hits || []).filter((h, i, all) => all.findIndex((x) => x.uid === h.uid) === i).slice(0, 6);
  const top = Math.max(1, ...list.map((t) => (play ? t.dmg : t.exp)));

  const nodes = list.map((r, i) => {
    const ang = (-90 + i * (360 / list.length)) * (Math.PI / 180);
    const x = 50 + 41 * Math.cos(ang);
    const y = 50 + 39 * Math.sin(ang);
    const value = play ? r.dmg : r.exp;
    const pctBar = Math.max(3, (value / top) * 100);
    return `
      <li class="arena__team ${r.id === u.teamId ? 'is-mine' : ''} ${value > 0 ? '' : 'is-quiet'}"
        style="--team:${r.color};left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"
        title="${esc(r.community)} · Lv.${r.info.level} · ${play ? `${P.now} ${num(r.dmg)} 피해` : `경험치 ${num(r.exp)}`}">
        <span class="arena__mon">${monsterImg(r.id, r.exp, 48)}${hasCrown(state, r.id) ? `<img class="px arena__crown" src="assets/icons/crown.png" width="18" height="18" alt="왕관">` : ''}</span>
        <b class="arena__name">${esc(r.community)}</b>
        <span class="arena__bar"><i style="width:${pctBar}%;background:${r.color}"></i></span>
        <small>${play ? `${num(r.dmg)}` : `Lv.${r.info.level}`}</small>
      </li>`;
  }).join('');

  return `
    <section class="card arena ${boss.defeated ? 'is-defeated' : ''}" style="--boss:${boss.color}">
      <div class="arena__head">
        <div>
          <span class="eyebrow">${play ? `${state.week}${P.round} 보스` : '최종 결전'} · ${esc(boss.title)}</span>
          <h2>${esc(boss.name)}</h2>
        </div>
        <div class="boss-card__hp">${boss.defeated ? '<b>격파!</b>' : `<b>${num(boss.hp)}</b><small> / ${num(boss.maxHp)}</small>`}</div>
      </div>
      <div class="boss-hp" role="progressbar" aria-label="보스 체력" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct(boss.hp, boss.maxHp))}">
        <span style="width:${pct(boss.hp, boss.maxHp)}%"></span>
      </div>
      ${play && info && !info.defeated && isFree(state) ? `
      <p class="arena__rule">${icon('seal', 18)}<b>프리 모드</b> — 체력을 다 깎으면 바로 쓰러져요. 잡으면 다음 보스가 곧장 나와요! (지금 ${state.lap || 1}바퀴째)</p>` : ''}
      ${play && info && !info.defeated && !isFree(state) ? `
      <p class="arena__rule ${info.holding ? 'is-holding' : ''}">${info.holding
        ? `${icon('seal', 18)}<b>마지막 힘으로 버티는 중!</b> ${info.killOpen
          ? '지금 공격하면 쓰러뜨릴 수 있어요. 어서!'
          : `${killLabel(state, state.week)}부터 마지막 일격을 넣을 수 있어요.`}`
        : `${state.bossAdjust && state.bossAdjust !== 1 ? `<b>${state.bossAdjust > 1 ? `지난 회차 활약 소문에 보스가 단단해졌어요 (체력 ×${state.bossAdjust})` : `지난 회차가 힘겨워서 보스가 방심했어요 (체력 ×${state.bossAdjust})`}</b> · ` : ''}${icon('food', 18)}이 보스는 <b>하루에 체력 ${Math.round(info.regenPerDay * 100)}%</b>를 회복해요. ${info.killOpen
          ? '지금은 막판! 체력을 다 깎으면 바로 쓰러져요.'
          : `막판(${killLabel(state, state.week)})까지는 버티니 <b>꾸준히 조금씩</b> 힘을 보태 주세요.`}`}</p>` : ''}
      <div class="arena__ring" id="bossArena">
        <div class="arena__boss">${bossImg(boss.id, 64)}${boss.defeated ? `<span class="arena__seal">${icon('seal', 40, '봉인 조각')}</span>` : ''}</div>
        <ul class="arena__teams">${nodes}</ul>
      </div>
      <div class="boss-card__stats">
        <span>원정대 <b>${num(play ? info.active : Object.keys(state.users).length)}</b>명${play ? ' 참여 중' : ''}</span>
        <span>내가 준 피해 <b>${num(d.dmg)}</b></span>
        <span>원정대 누적 <b>${num(boss.dmg)}</b></span>
      </div>
      ${play ? `
      <div class="share">
        <div class="share__head"><b>우리 팀 몫</b><span>${num(my.dmg)} / ${num(my.share)}${my.dmg > my.share ? ` · <em>품앗이 +${num(my.dmg - my.share)}</em>` : ''}</span></div>
        <div class="goal__bar"><span style="width:${Math.max(3, pct(my.dmg, my.share))}%;background:${teamById(u.teamId).color}"></span></div>
      </div>` : ''}
      ${hits.length ? `
      <div class="arena__recent">
        <span class="arena__recent-label">방금 활약한 대원</span>
        <ul>${hits.map((h) => `
          <li class="${h.uid === u.id ? 'is-me' : ''} ${h.id > (ui.seenHit || 0) ? 'is-new' : ''}" style="--team:${teamById(h.teamId).color}" title="${esc(h.name)}">
            ${avatarImg(h.avatar, 34)}<b>-${num(h.dmg)}</b><small>${esc(h.name)}</small>
          </li>`).join('')}</ul>
      </div>` : ''}
      <p class="boss-card__note">${boss.defeated
        ? `원정대가 ${josa(boss.name, '을/를')} 물리쳤어요! 지금부터 주는 피해도 우리 팀 몫과 ${P.now} 시상에 그대로 쌓여요.`
        : play
          ? `먹이 주기, 퀴즈 정답, 가위바위보 승리가 모두 보스 공격이 돼요. 체력을 다 깎아도 막판까지는 버티니 자주 와서 눌러 눌러! 쓰러뜨리면 ${P.now} 참여한 모두가 고급 먹이 ${RULES.boss.defeatReward.premium}개 + ${RULES.boss.defeatReward.points}P!`
          : '오늘은 결전의 날! 최종 미션 퀴즈로 지혜를 모으고, 응원 타임에 힘을 보태 주세요.'}</p>
    </section>`;
}

export function renderHome(state, ui) {
  const u = me(state);
  const t = teamById(u.teamId);
  const ts = state.teams[t.id];
  const info = levelInfo(ts.exp);
  const d = weekly(state, u);
  const play = isPlayWeek(state.week);
  const boss = bossOf(state.week);
  const qTotal = state.quiz?.length || 0;
  const qDone = d.quiz.filter(Boolean).length;
  const prevAward = state.awards[state.week - 1];
  const liveKing = play ? knowledgeKing(state) : null;
  const liveAce = play ? weeklyAce(state) : null;
  const S = scheduleOf(state);
  const P = paceOf(state);
  const finalDay = state.week >= FINAL_WEEK || clockNow() >= eventStart(S);
  const golden = (state.goldenUntil || 0) > clockNow();
  const visited = u.visitedWeeks.includes(state.week);
  const alliance = allianceList(state);
  const mine = alliance.find((x) => x.id === t.id);
  const seals = BOSSES.filter((b) => state.bosses[b.week]?.defeatedAt).length;

  const dy = daily(state, u, clockNow());
  const qMain = Math.min(qTotal, RULES.quizMain);
  const qMainDone = d.quiz.slice(0, qMain).filter(Boolean).length;
  const cards = state.cards || { open: 0, readCount: 0, total: 0 };
  const nextBonus = RULES.visitBonus.find((b) => (d.days?.length || 0) < b.days);
  const todo = [
    { day: true, done: dy.visit, icon: 'food', title: '오늘 출석 보너스', desc: nextBonus
      ? `먹이 ${visited ? RULES.dailyVisitFood : RULES.weeklyVisitFood}개 · ${nextBonus.days}일 모으면 고급 먹이 ${nextBonus.premium}개`
      : `먹이 ${visited ? RULES.dailyVisitFood : RULES.weeklyVisitFood}개 · ${P.now} ${d.days?.length || 0}일 참여!`, href: '#/mission', state: dy.visit ? '받음' : '받기' },
    ...(cards.total ? [{ day: true, done: cards.readCount >= cards.open, icon: 'premium', title: '오늘의 AI 한 조각', desc: '3줄 읽고 하나 알아가기', href: '#/mission', state: `${cards.readCount}/${cards.open}` }] : []),
    { day: true, done: dy.lucky >= RULES.luckyPerDay, icon: 'luckybox', title: '럭키박스', desc: '잭팟 먹이 100개', href: '#/play', state: `${dy.lucky}/${RULES.luckyPerDay}` },
    { day: true, done: dy.rps >= RULES.rpsPerDay, icon: 'point', title: `${boss ? boss.name : '보스'} 가위바위보`, desc: `이기면 먹이 2배 + 보스에게 ${RULES.boss.rpsWinDamage} 피해`, href: '#/play', state: `${dy.rps}/${RULES.rpsPerDay}` },
    { done: qMain && qMainDone === qMain, icon: 'premium', title: `${P.now} AI 퀴즈`, desc: `정답마다 보스에게 ${RULES.boss.quizDamage} 피해`, href: '#/mission', state: `${qMainDone}/${qMain}` },
    ...(qTotal > qMain ? [{ done: d.quiz.filter(Boolean).length >= qTotal, icon: 'seal', title: '보너스 문제', desc: `더 풀고 싶을 때 · 정답마다 ${RULES.quizBonusPoints}P`, href: '#/mission', state: `${Math.max(0, d.quiz.filter(Boolean).length - qMain)}/${qTotal - qMain}` }] : []),
  ];

  return `
  <div class="home">
    ${weekBanner(state, t)}
    ${golden ? `
    <section class="golden-banner" role="status">
      ${icon('booster', 32)}
      <div><b>골든타임!</b> 지금 먹이를 주면 경험치와 보스 피해가 ${RULES.golden.multiplier}배예요</div>
      <time data-until="${state.goldenUntil}">${timeLeft(state.goldenUntil)}</time>
    </section>` : ''}
    ${journeyMap(state, u)}
    ${play || state.week >= FINAL_WEEK ? arena(state, u, ui) : ''}

    <section class="card monster-card" style="--team:${t.color}">
      <div class="monster-card__top">
        ${teamChip(t)}
        <span class="rank-chip">${play ? `우리 팀 몫 <b>${Math.round(mine.rate * 100)}</b>%` : `팀원 <b>${mine.members}</b>명`}</span>
      </div>
      ${monsterStage(state, t.id)}
      ${skillChip(state, t.id)}
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
      <p class="feed-note">${play
        ? `먹이로 얻은 경험치만큼 ${esc(boss.name)}에게 피해를 줘요. 레벨이 높을수록 최종 결전에서 더 세게 공격해요.`
        : '레벨이 높을수록 최종 결전에서 더 세게 공격해요.'}</p>
    </section>

    <div class="home__side">
      <section class="card wallet">
        <div class="wallet__item">${icon('food', 36)}<b>${num(u.food)}</b><span>먹이</span></div>
        <div class="wallet__item">${icon('premium', 36)}<b>${num(u.premium)}</b><span>고급 먹이</span></div>
        <div class="wallet__item">${icon('point', 36)}<b>${num(u.points)}</b><span>포인트</span></div>
      </section>

      <section class="card">
        ${secHead(`${P.now} 할 일`, pillLink('#/mission', '미션'))}
        ${play ? `
        <ul class="todo">
          ${todo.map((it) => `
            <li class="todo__item ${it.done ? 'is-done' : ''}">
              <a href="${it.href}">
                ${icon(it.icon, 32)}
                <div><b>${it.day ? '<i class="todo__tag">오늘</i>' : ''}${esc(it.title)}</b><span>${esc(it.desc)}</span></div>
                <em>${it.state}</em>
              </a>
            </li>`).join('')}
        </ul>
        <p class="todo__note"><b>오늘</b> 표시가 붙은 것은 날마다 새로 채워져요. 자주 들를수록 우리 팀이 쑥쑥 자라요. 퀴즈는 ${P.now} 안에 언제든 풀면 돼요.</p>`
        : `<p class="todo__locked">${state.week < 1
          ? `${weekDates(S, 1).start}에 1${P.round} 원정이 시작돼요. 지금은 우리 커뮤니티 친구들을 원정대로 불러 주세요!`
          : '사전 원정은 모두 끝났어요. 현장에서 다 함께 대마왕 글리치를 물리쳐요!'}</p>`}
      </section>

      <section class="card honor">
        ${secHead('명예의 전당', pillLink('#/crew?tab=hall'))}
        <div class="honor__grid">
          <div class="honor__item">
            <span class="honor__label">${icon('crown', 20)}${P.prev} MVP 팀</span>
            ${prevAward?.mvpTeam
              ? `<b>${esc(teamById(prevAward.mvpTeam).community)}</b><small>몫 달성률 ${Math.round(prevAward.mvpRate * 100)}%</small>`
              : `<b class="muted">첫 ${P.round}가 끝나면 발표해요</b>`}
          </div>
          <div class="honor__item">
            <span class="honor__label">${icon('point', 20)}${P.prev} 지식왕</span>
            ${prevAward?.kingId && state.users[prevAward.kingId]
              ? `<b>${esc(state.users[prevAward.kingId].name)}</b><small>${esc(teamById(state.users[prevAward.kingId].teamId).community)}</small>`
              : `<b class="muted">첫 ${P.round}가 끝나면 발표해요</b>`}
          </div>
          <div class="honor__item honor__item--wide">
            <span class="honor__label">${P.now} 에이스 · 지식왕 후보</span>
            ${liveAce || liveKing
              ? `<b>${liveAce ? `${esc(liveAce.user.name)} (피해 ${num(liveAce.dmg)})` : '-'}</b><small>지식왕 후보: ${liveKing ? esc(liveKing.user.name) : '아직 없어요'}</small>`
              : `<b class="muted">${play ? '아직 없어요. 첫 주인공이 되어 보세요!' : '원정이 시작되면 겨뤄요'}</b>`}
          </div>
        </div>
      </section>
    </div>

    <section class="card home__crew">
      ${secHead('원정대 현황', pillLink('#/crew'))}
      <ul class="mini-crew">
        ${alliance.map((r) => `
          <li class="${r.id === t.id ? 'is-mine' : ''}">
            <img class="px" src="${spriteOf(r.id)}" width="40" height="40" alt="">
            <div class="mini-crew__body">
              <div><b>${esc(r.community)}</b>${hasCrown(state, r.id) ? icon('crown', 16, '왕관') : ''}<small>Lv.${r.info.level} · ${play ? `${r.active}/${r.members}명 참여` : `${r.members}명`}${(() => { const sk = teamSkill(state, r.id); return sk ? ` · <b class="skill-tag ${sk.unlocked ? 'is-on' : ''}">${esc(sk.name)}${sk.unlocked ? '' : ` Lv.${sk.at}`}</b>` : ''; })()}</small></div>
              <div class="bar"><span style="width:${play ? Math.max(2, pct(r.dmg, r.share)) : Math.max(2, pct(r.info.level, 20))}%;background:${r.color}"></span></div>
            </div>
            <span class="mini-crew__num">${play ? `${Math.round(r.rate * 100)}%` : `Lv.${r.info.level}`}</span>
          </li>`).join('')}
      </ul>
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

    <a class="card t-banner" href="#/final">
      <div class="t-banner__text">
        <span class="eyebrow">${!finalDay ? eventCountdown(S) : 'TODAY'}</span>
        <h2>${eventDateLabel(S)} 대마왕 글리치와 최종 결전</h2>
        <p>${!finalDay
          ? `지금까지 봉인 조각 ${seals}/4. 현장 상품 “?” 상자 ${state.prizes.length}개가 기다리고 있어요!`
          : '오늘 한마당 현장에서 다 함께 글리치를 물리쳐요. 응원 버튼을 준비하세요!'}</p>
      </div>
      <div class="t-banner__mons" aria-hidden="true">
        ${bossImg(FINAL_BOSS.id, 72)}
        ${TEAMS.slice(0, 3).map((r) => `<img class="px" src="${spriteOf(r.id)}" width="64" height="64" alt="">`).join('')}
      </div>
    </a>
  </div>`;
}

// 이번 주 안내 띠: 원정대 모집 / N주차 / 결전의 날
function weekBanner(state, t) {
  const S = scheduleOf(state);
  const P = paceOf(state);
  const paceBadge = S.quick ? `<span class="pace-badge">미리 해 보기 · ${P.label}마다 새 ${P.round}</span>` : '';
  if (state.week < 1) {
    const crew = Object.values(state.users);
    return `
    <section class="card week-banner week-banner--pre">
      <span class="week-banner__no">GO!</span>
      <div>
        <span class="eyebrow">원정대 모집 중</span>${paceBadge}
        <h2>${weekDates(S, 1).start}, 1${P.round} 원정 출발!</h2>
        <p>보스 4마리를 한 마리씩 차례로 물리치고, ${eventDateLabel(S)} 현장에서 대마왕 글리치와 최종 결전을 해요.
          지금 원정대 <b>${num(crew.length)}명</b>, ${esc(t.community)}에서 <b>${crew.filter((u) => u.teamId === t.id).length}명</b>이 모였어요.</p>
        <div class="crew-wall crew-wall--sm">${crew.slice(-24).reverse().map((u) => face(u, 28)).join('')}</div>
      </div>
    </section>`;
  }
  if (state.week >= FINAL_WEEK) {
    return `
    <section class="card week-banner week-banner--final">
      <span class="week-banner__no">D-DAY</span>
      <div>
        <span class="eyebrow">결전의 날</span>${paceBadge}
        <h2>${eventDateLabel(S)} 대마왕 글리치와 최종 결전</h2>
        <p>한 달 동안 함께 키운 몬스터 9마리와 원정대 모두가 힘을 합쳐요. 결전 화면에서 응원 버튼을 기다려 주세요!</p>
      </div>
    </section>`;
  }
  const dates = weekDates(S, state.week);
  const next = roundStart(S, state.week + 1);
  return `
    <section class="card week-banner">
      <span class="week-banner__no">${state.week}<small>${P.round}</small></span>
      <div>
        <span class="eyebrow">${dates.start} ~ ${dates.end}</span>${paceBadge}
        <h2>「${esc(state.weekInfo?.title || '')}」 ${P.series}</h2>
        <p>${P.now} 퀴즈 주제: <b>${esc(state.weekInfo?.theme || '')}</b> · ${P.now} 안에 언제든 몰아서 해도 돼요.</p>
        ${roundLength(S) >= 3 * DAY_MS ? '' : `<p class="week-banner__next">${state.week < EVENT.weeks ? `다음 ${P.round}` : '결전'}까지 <time data-until="${next}" data-refresh>${timeLeft(next)}</time></p>`}
      </div>
    </section>`;
}

// ================================================================ 이번 주 미션
export function renderMission(state, ui) {
  const S = scheduleOf(state);
  const P = paceOf(state);
  const u = me(state);
  const d = weekly(state, u);
  const qs = state.quiz;
  const play = isPlayWeek(state.week);
  const final = state.week >= FINAL_WEEK;
  const visited = u.visitedWeeks.includes(state.week);

  let attendMsg;
  if (state.week < 1) attendMsg = `${weekDates(S, 1).start}에 1${P.round} 원정이 시작돼요. 그때 첫 방문 보너스를 받을 수 있어요.`;
  else if (state.week >= FINAL_WEEK) attendMsg = '사전 원정이 모두 끝났어요. 현장에서 만나요!';
  else attendMsg = visited
    ? `${icon('food', 24)} ${state.week}${P.round} 첫 방문 보너스로 먹이 ${RULES.weeklyVisitFood}개를 받았어요.`
    : `${P.now} 첫 방문 보너스를 받아요.`;

  return `
  ${pageHead(`${P.now} 미션`, '틈날 때 들러서 카드 한 장, 문제 하나면 충분해요. 정답마다 보스에게 지식 공격이 들어가요.')}
  <div class="mission">
    ${journeyMap(state, u)}
    <section class="card attend">
      <p class="attend__msg">${attendMsg}</p>
      ${play && !visited ? `<button class="btn btn--primary" data-action="checkin">첫 방문 보너스 받기</button>` : ''}
    </section>

    ${play ? aiCards(state, ui, u) : ''}

    <section class="card quiz-card">
      ${secHead(final ? '최종 미션 · AI 시대의 교육' : play ? `${state.week}${P.round} AI 퀴즈` : 'AI 퀴즈',
        `<span class="sec-note">${final
          ? `정답마다 ${RULES.quizPoints}P + 원정대의 지혜 ${RULES.final.wisdomPerCorrect} (글리치 공격)`
          : `정답마다 ${RULES.quizPoints}P + 보스에게 ${RULES.boss.quizDamage} 피해 · 본 문제를 모두 맞히면 고급 먹이 ${RULES.quizPerfectPremium}개`}</span>`)}
      ${(play || final) && qs
        ? `<p class="quiz-theme"><span class="tag">「${esc(state.weekInfo.title)}」</span><b>${esc(state.weekInfo.theme)}</b></p>
           ${!final && state.weekInfo.nextAt ? `<p class="quiz-open">지금까지 <b>${state.weekInfo.open}문제</b>가 열렸어요. 다음 문제는 <time data-refresh="${state.weekInfo.nextAt}">${timeLeft(state.weekInfo.nextAt)}</time> 뒤에 열려요.</p>` : ''}
           ${renderQuiz(state, ui, u, d, qs)}`
        : `<p class="todo__locked">${state.week < 1
          ? `${weekDates(S, 1).start}에 1${P.round} 문제가 열려요. 알파고부터 딥페이크까지, 누구나 한마디 거들 수 있는 AI 이야기가 기다리고 있어요.`
          : '사전 퀴즈는 모두 끝났어요. 수고 많으셨어요!'}</p>`}
    </section>

    ${(state.weekInfo?.tips || []).map((tip) => `
    <section class="card tip-card">
      <span class="tip-card__badge" aria-hidden="true">TIP</span>
      <div>
        <span class="eyebrow">${P.now} AI 꿀팁</span>
        <h3>${esc(tip.title)}</h3>
        <p>${esc(tip.body)}</p>
      </div>
    </section>`).join('')}
  </div>`;
}

// 힌트는 한 단계씩 연다 (1단계 단서 → 2단계 초성·결정적 단서)
function renderHints(state, ui, q, qi) {
  if (!q.hints?.length) return '';
  const shown = ui.hintsShown[`${state.week}-${qi}`] || 0;
  return `
    <div class="hints">
      ${q.hints.slice(0, shown).map((h, i) => `<p class="hint"><span class="hint__badge">힌트 ${i + 1}</span><span>${esc(h)}</span></p>`).join('')}
      ${shown < q.hints.length
        ? `<button class="hint-btn" data-action="quiz-hint" data-q="${qi}"><span class="hint-btn__icon" aria-hidden="true">?</span>${shown ? '힌트 하나 더 보기' : '막혔나요? 힌트 보기'} <small>(${shown}/${q.hints.length})</small></button>`
        : ''}
    </div>`;
}

// 「오늘의 AI 한 조각」 — 날마다 한 장씩 열리는 읽을거리 + 모은 카드 도감
function aiCards(state, ui, u) {
  const c = state.cards;
  const set = cardsForWeek(state.week);
  if (!set || !c || !c.total) return '';
  const P = paceOf(state);
  const every = byDay(scheduleOf(state)) ? '매일' : P.every;   // 이틀 넘는 회차면 날마다 열린다
  const read = new Set(c.read || []);
  const left = c.open - c.readCount;
  const collected = (c.read || []).length;
  const totalAll = CARD_SETS.reduce((s, x) => s + x.cards.length, 0);

  const cardLine = (rawCard, w, i, openCount) => {
    const card = cardFor(w, i, state.level) || rawCard;
    const isRead = read.has(`${w}:${i}`);
    const open = ui.cardOpen === `${w}:${i}`;
    const fresh = w === state.week && i === openCount - 1 && !isRead;
    return `
      <li class="ai-card ${isRead ? 'is-read' : ''} ${open ? 'is-open' : ''} ${fresh ? 'is-fresh' : ''}">
        <button class="ai-card__head" data-action="card-open" data-week="${w}" data-index="${i}" aria-expanded="${open}">
          <span class="ai-card__no">${i + 1}</span>
          <span class="ai-card__title"><b>${esc(card.title)}</b><small>${esc(card.tag)}</small></span>
          <span class="ai-card__flag">${isRead ? '읽음' : fresh ? `오늘 +${RULES.card.points + RULES.card.onTimePoints}P` : `+먹이 ${RULES.card.food}`}</span>
        </button>
        ${open ? `
        <div class="ai-card__body">
          <p>${esc(card.body)}</p>
          <p class="ai-card__try"><b>오늘 해 보기</b> ${esc(card.tryIt)}</p>
          <p class="ai-card__term">${icon('mystery', 18)}${esc(card.term)}</p>
        </div>` : ''}
      </li>`;
  };
  const list = set.cards.slice(0, c.open).map((card, i) => cardLine(card, state.week, i, c.open)).join('');
  const theme = cardThemeFor(state.week, state.level);

  // 지난 회차 카드는 모두 열려 있어요 (웹툰 몰아 보기)
  const past = CARD_SETS.filter((x) => x.week < state.week);
  const pastLeft = past.reduce((s, x) => s + x.cards.filter((_, i) => !read.has(`${x.week}:${i}`)).length, 0);
  const missedNow = c.open - c.readCount;

  return `
    <section class="card ai-cards">
      ${secHead('오늘의 AI 한 조각', `<span class="sec-note">${every} 한 장씩 열려요 · 읽으면 먹이 ${RULES.card.food}개 + ${RULES.card.points}P</span>`)}
      <p class="sec-desc">${esc(theme)} — 컴퓨터 기초부터 AI까지, 알아 두면 힘이 되는 이야기예요. 못 본 카드는 사라지지 않으니 <b>웹툰처럼 몰아서</b> 봐도 되고, 그날 열린 카드를 그날 보면 <b>+${RULES.card.onTimePoints}P</b>와 꾸준 점수를 더 받아요.</p>
      <div class="ai-cards__bar">
        <span class="ai-cards__count">모은 카드 <b>${num(collected)}</b> / ${num(totalAll)}장</span>
        <span class="goal__bar"><span style="width:${pct(collected, totalAll)}%"></span></span>
      </div>
      <p class="ai-cards__steady">${icon('seal', 18)}제때 읽기 <b>${num(c.onTime || 0)}</b>회 — 가장 많은 대원이 현장에서 <b>꾸준상</b>을 받아요</p>
      ${missedNow + pastLeft > 0 ? `<p class="ai-cards__new">${icon('premium', 20)}안 읽은 카드 <b>${missedNow + pastLeft}장</b>${pastLeft ? ` (지난 회차 ${pastLeft}장 포함)` : ''} — 지금 몰아 보기 좋아요!</p>` : ''}
      <ul class="ai-cards__list">${list}</ul>
      ${c.nextAt ? `<p class="ai-cards__next">다음 카드는 <time data-refresh="${c.nextAt}">${timeLeft(c.nextAt)}</time> 뒤에 열려요.</p>` : '<p class="ai-cards__next">이번 회차 카드가 모두 열렸어요.</p>'}
      ${past.length ? `
      <details class="ai-cards__past" ${pastLeft ? 'open' : ''}>
        <summary>지난 회차 몰아 보기 ${pastLeft ? `<b>(안 읽은 ${pastLeft}장)</b>` : '(다 읽었어요)'}</summary>
        ${past.map((x) => `
          <h4 class="ai-cards__past-head">${x.week}${P.round} · ${esc(x.theme)}</h4>
          <ul class="ai-cards__list">${x.cards.map((card, i) => cardLine(card, x.week, i, x.cards.length)).join('')}</ul>`).join('')}
      </details>` : ''}
    </section>`;
}

function renderQuiz(state, ui, u, d, qs) {
  const P = paceOf(state);
  const progress = `<div class="quiz__progress" style="grid-template-columns:repeat(${qs.length},minmax(0,1fr))">${qs.map((_, i) => {
    const a = d.quiz[i];
    return `<span class="${a ? (a.correct ? 'is-correct' : 'is-wrong') : ''}"></span>`;
  }).join('')}</div>`;

  const firstOpen = qs.findIndex((_, i) => !d.quiz[i]);
  const showIndex = ui.quizReveal ?? firstOpen;
  if (showIndex < 0) {
    const correct = d.quiz.filter((a) => a && a.correct).length;
    const perfect = correct === qs.length;
    return `
      ${progress}
      <div class="quiz__summary ${perfect ? 'is-perfect' : ''}">
        ${icon(perfect ? 'premium' : 'point', 64)}
        <h3>${perfect ? `${qs.length}문제 모두 정답!` : `${qs.length}문제 중 ${correct}문제 정답`}</h3>
        <p>포인트 <b>+${correct * RULES.quizPoints}P</b> · 보스에게 <b>${correct * RULES.boss.quizDamage}</b> 피해${perfect ? ` · 고급 먹이 <b>+${RULES.quizPerfectPremium}</b>` : ''}. ${state.weekInfo?.nextAt
          ? `다음 문제는 <time data-refresh="${state.weekInfo.nextAt}">${timeLeft(state.weekInfo.nextAt)}</time> 뒤에 열려요.`
          : state.week < EVENT.weeks ? `${P.next} 새 문제가 열려요.` : '사전 퀴즈를 모두 마쳤어요!'}</p>
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

  const isLast = qs.every((_, i) => d.quiz[i]);
  return `
    ${progress}
    <div class="quiz">
      <div class="quiz__meta"><span class="tag">${esc(q.tag)}</span><span>문제 ${showIndex + 1} / ${qs.length}</span></div>
      <h3 class="quiz__q">${esc(q.q)}</h3>
      ${answered ? '' : renderHints(state, ui, q, showIndex)}
      <div class="quiz__options">${options}</div>
      ${answered ? `
        <div class="quiz__feedback ${answered.correct ? 'is-correct' : 'is-wrong'}" role="status">
          <b>${answered.correct ? `정답이에요! +${RULES.quizPoints}P · 지식 공격 ${RULES.boss.quizDamage}!` : '아쉬워요!'}</b>
          <p>${esc(q.explain)}</p>
          ${q.classroom ? `<div class="quiz__classroom"><b>이렇게 써 보기</b><p>${esc(q.classroom)}</p></div>` : ''}
          ${q.source ? `<small class="quiz__source">근거: ${esc(q.source)}</small>` : ''}
        </div>
        <button class="btn btn--primary" data-action="quiz-next">${isLast ? '결과 보기' : '다음 문제'}</button>` : ''}
    </div>`;
}

// ================================================================ 도전 · 뽑기
const HAND_NAMES = { rock: '바위', scissors: '가위', paper: '보' };

export function renderPlay(state, ui) {
  const S = scheduleOf(state);
  const P = paceOf(state);
  const u = me(state);
  const d = weekly(state, u);
  const play = isPlayWeek(state.week);
  const boss = bossOf(state.week) || { id: FINAL_BOSS.id, name: '보스' };
  const dy = daily(state, u, clockNow());
  const luckyLeft = play ? RULES.luckyPerDay - dy.lucky : 0;
  const rpsLeft = play ? RULES.rpsPerDay - dy.rps : 0;
  const lastRps = d.rpsLog[d.rpsLog.length - 1];
  const odds = (rows) => `
    <details class="odds"><summary>확률 보기</summary>
      <ul>${rows.map(([label, w]) => `<li><span>${label}</span><b>${w}%</b></li>`).join('')}</ul>
    </details>`;
  const locked = state.week < 1 ? `${weekDates(S, 1).start}에 열려요` : '사전 원정이 끝났어요';

  let bossLine = '내 손을 읽을 수 있을까?';
  if (lastRps === 'win') bossLine = rpsLeft ? '크윽… 한 판 더 붙자!' : '크윽… 내일 보자!';
  if (lastRps === 'lose') bossLine = rpsLeft ? '후후, 또 덤벼 보겠나?' : '후후, 내일 또 와라!';

  return `
  ${pageHead('도전 · 뽑기', `운과 배짱으로 원정을 도와요. 럭키박스는 하루에 ${RULES.luckyPerDay}번, 보스 가위바위보는 ${RULES.rpsPerDay}번! 날마다 다시 채워져요.`)}
  <div class="play">
    <section class="card play-card">
      ${secHead('럭키박스', play ? `<span class="sec-note">오늘 남은 횟수 <b>${luckyLeft}</b>/${RULES.luckyPerDay}</span>` : '')}
      <div class="lucky" id="lucky">
        <div class="lucky__box ${play && !luckyLeft ? 'is-open' : ''}" id="luckyBox">${icon('luckybox', 96, '럭키박스')}</div>
        <p class="play-desc">누구나 하루에 ${RULES.luckyPerDay}번! 아주 낮은 확률로 <b>먹이 100개 잭팟</b>이 나와요.</p>
      </div>
      ${d.luckyLog.length ? `<p class="play-result is-win">${P.now} 결과: <b>${d.luckyLog.map(esc).join(' · ')}</b></p>` : ''}
      ${!play
        ? `<button class="btn btn--soft btn--block" disabled>${locked}</button>`
        : luckyLeft
          ? `<button class="btn btn--primary btn--block" data-action="lucky-open">럭키박스 열기 (${luckyLeft}번 남음)</button>`
          : `<button class="btn btn--soft btn--block" disabled>내일 다시 열 수 있어요</button>`}
      ${odds(LUCKY_BOX.map((r) => [r.label, r.w]))}
    </section>

    <section class="card play-card rps">
      ${secHead(`${esc(boss.name)} 도전장`, play ? `<span class="sec-note">오늘 남은 도전 <b>${rpsLeft}</b>/${RULES.rpsPerDay}</span>` : '')}
      <div class="rps__arena">
        <div class="rps__boss">
          ${bossImg(boss.id, 64)}
          <div class="bubble">${bossLine}</div>
        </div>
        <div class="rps__vs">
          <figure><span class="rps__hand" id="myHand">${ui.rpsLast ? HANDS[ui.rpsLast.hand] : '❔'}</span><figcaption>나</figcaption></figure>
          <small>VS</small>
          <figure><span class="rps__hand" id="bossHand">${ui.rpsLast ? HANDS[ui.rpsLast.boss] : '❔'}</span><figcaption>${esc(boss.name)}</figcaption></figure>
        </div>
      </div>
      <p class="play-desc">이기면 보유 먹이 <b>${RULES.rps.winMultiplier}배</b> + 보스에게 <b>${RULES.boss.rpsWinDamage}</b> 피해, 지면 먹이 <b>절반</b>. 비기면 한 번 더! 지금 내 먹이 <b>${num(u.food)}</b>개</p>
      ${lastRps ? `<p class="play-result ${lastRps === 'win' ? 'is-win' : 'is-lose'}">${lastRps === 'win' ? `지난 도전에서 ${josa(boss.name, '을/를')} 이겼어요!` : `지난 도전에서는 ${boss.name}에게 졌어요.`}</p>` : ''}
      ${!play
        ? `<button class="btn btn--soft btn--block" disabled>${locked}</button>`
        : rpsLeft
          ? `<div class="rps__pick">
              ${Object.entries(HANDS).map(([k, e]) => `
                <button class="hand-btn" data-action="rps" data-hand="${k}"><span>${e}</span>${HAND_NAMES[k]}</button>`).join('')}
            </div>`
          : `<button class="btn btn--soft btn--block" disabled>내일 다시 도전할 수 있어요</button>`}
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
// 커뮤니티 시그니처 스킬 한 줄 (습득했는지 보여 준다)
function skillChip(state, teamId) {
  const sk = teamSkill(state, teamId);
  if (!sk) return '';
  return `
    <div class="skill-chip ${sk.unlocked ? 'is-on' : ''}">
      ${icon('seal', 20)}
      <div><b>${esc(sk.name)}</b><span>${esc(sk.effect)}</span></div>
      <i>${sk.unlocked ? '습득!' : `Lv.${sk.at}에 습득 (지금 Lv.${sk.level})`}</i>
    </div>`;
}

// ================================================================ 내가 알게 된 것 (아는 만큼 힘이 된다)
function knowledge(state, u) {
  const read = new Set(state.cards?.read || []);
  const got = [];
  for (const set of CARD_SETS) {
    for (let i = 0; i < set.cards.length; i++) if (read.has(`${set.week}:${i}`)) got.push({ w: set.week, i, card: set.cards[i] });
  }
  const P = paceOf(state);
  const rate = pct(got.length, CARDS_TOTAL);
  const byWeek = CARD_SETS.map((set) => {
    const n = set.cards.filter((_, i) => read.has(`${set.week}:${i}`)).length;
    return `<li class="know__row ${n === set.cards.length ? 'is-full' : ''}">
      <b>${set.week}${P.round}</b><span>${esc(set.theme.replace(/^.*· /, ''))}</span>
      <i>${n}/${set.cards.length}</i>
    </li>`;
  }).join('');

  return `
    <section class="card know">
      ${secHead('내가 알게 된 것', '<span class="sec-note">아는 만큼 힘이 된다</span>')}
      <p class="sec-desc">읽은 「AI 한 조각」에서 알게 된 낱말이 여기 쌓여요. 컴퓨터가 일하는 법부터 AI·보안·알고리즘까지 ${num(CARDS_TOTAL)}장이 준비돼 있어요.</p>
      <div class="know__top">
        <div class="know__num"><b>${num(got.length)}</b><span>/ ${num(CARDS_TOTAL)}장</span></div>
        <div class="know__bar"><span class="goal__bar"><span style="width:${rate}%"></span></span>
          <small>맞힌 퀴즈 <b>${num(u.totalCorrect)}</b>개 · 제때 읽기 <b>${num(state.cards?.onTime || 0)}</b>회</small>
        </div>
      </div>
      <ul class="know__rows">${byWeek}</ul>
      ${got.length ? `
      <h4 class="know__head">모은 낱말 ${num(got.length)}개</h4>
      <ul class="know__terms">${got.slice().reverse().map(({ card }) => `
        <li><b>${esc(card.term.split(' — ')[0])}</b><span>${esc(card.term.split(' — ')[1] || '')}</span></li>`).join('')}
      </ul>` : `<p class="know__empty">아직 모은 낱말이 없어요. 미션 화면에서 오늘의 카드를 한 장 읽어 보세요.</p>`}
      <a class="btn btn--soft btn--sm" href="#/mission">AI 한 조각 읽으러 가기</a>
    </section>`;
}

export function renderBag(state, ui) {
  const u = me(state);
  const ts = state.teams[u.teamId];
  const kind = ui.giftKind || 'food';
  const g = GIFT_KINDS[kind];
  const giftTeam = teamById(ui.giftTeam) ? ui.giftTeam : u.teamId;
  const members = teamMembers(state, giftTeam).filter((m) => m.id !== u.id);
  const now = clockNow();
  const cross = giftTeam !== u.teamId;

  const itemCard = (key) => {
    const it = ITEMS[key];
    const count = u.items[key];
    let action = '';
    if (key === 'booster') action = `<button class="btn btn--primary btn--sm" data-action="use-booster" ${count ? '' : 'disabled'}>우리 팀에 사용</button>`;
    if (key === 'cheer') action = `<button class="btn btn--primary btn--sm" data-action="cheer-pick" ${count ? '' : 'disabled'}>응원할 팀 고르기</button>`;
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
  ${pageHead('가방', '모은 먹이와 아이템을 쓰거나, 원정대 누구에게나 선물해요.')}
  <div class="bag">
    ${knowledge(state, u)}
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
      ${secHead('선물하기', `<span class="sec-note">다른 커뮤니티에게 주면 우리 팀 우정 점수 +1 (${paceOf(state).per} ${RULES.friend.giftCapPerWeek}번까지)</span>`)}
      <div class="gift-kinds" role="radiogroup" aria-label="선물할 것">
        ${Object.entries(GIFT_KINDS).map(([k, gk]) => `
          <button class="gift-kind ${k === kind ? 'is-selected' : ''}" role="radio" aria-checked="${k === kind}" data-action="gift-kind" data-kind="${k}">
            ${icon(gk.icon, 24)}<span>${gk.name}</span><b>${gk.has(u)}</b>
          </button>`).join('')}
      </div>
      <div class="gift-teams" role="radiogroup" aria-label="받을 커뮤니티">
        ${TEAMS.map((t) => `
          <button class="gift-team ${t.id === giftTeam ? 'is-selected' : ''}" role="radio" aria-checked="${t.id === giftTeam}" data-action="gift-team" data-team="${t.id}" style="--team:${t.color}">
            <img class="px" src="${spriteOf(t.id)}" width="28" height="28" alt="">${esc(t.community)}${t.id === u.teamId ? ' (우리)' : ''}
          </button>`).join('')}
      </div>
      <ul class="members">
        ${members.map((m) => `
          <li>
            ${face(m, 36)}
            <b>${esc(m.name)}</b>
            <small>${esc(teamById(m.teamId).community)} · 누적 피해 ${num(m.totalDmg || 0)}</small>
            <button class="btn btn--soft btn--sm" data-action="gift" data-to="${m.id}" data-kind="${kind}" ${g.has(u) ? '' : 'disabled'}>${g.name} 1개${cross ? ' · 우정' : ''}</button>
          </li>`).join('') || '<li class="muted">아직 이 커뮤니티에 다른 대원이 없어요.</li>'}
      </ul>
    </section>
  </div>`;
}

export function renderCheerPicker(state) {
  const u = me(state);
  const now = clockNow();
  return `
    <h2 class="modal__title">${icon('cheer', 32)}응원 풍선을 보낼 커뮤니티</h2>
    <p class="modal__desc">받은 팀은 ${RULES.cheer.minutes}분 동안 먹이 경험치(=보스 피해)가 ${RULES.cheer.multiplier}배가 되고, 우리 팀은 우정 점수 +1을 얻어요. 이미 응원 받는 팀에 보내면 시간이 늘어나요.</p>
    <div class="target-grid">
      ${allianceList(state).filter((r) => r.id !== u.teamId).map((r) => `
        <button class="target" data-action="cheer-throw" data-team="${r.id}" style="--team:${r.color}">
          <img class="px" src="${spriteOf(r.id)}" width="56" height="56" alt="">
          <b>${esc(r.community)}</b>
          <small>Lv.${r.info.level}${r.s.cheerUntil > now ? ' · 응원 받는 중' : ''}</small>
        </button>`).join('')}
    </div>`;
}

// ================================================================ 원정대
export function renderCrew(state, ui) {
  const S = scheduleOf(state);
  const P = paceOf(state);
  const u = me(state);
  const tab = ui.crewTab || 'alliance';
  const play = isPlayWeek(state.week);
  const tabs = [['alliance', '연합 현황'], ['people', '활약 대원'], ['hall', '명예의 전당']];
  let body = '';

  if (tab === 'alliance') {
    const now = clockNow();
    body = `
      <ul class="alliance">
        ${allianceList(state).map((r) => {
          const crew = teamMembers(state, r.id).sort((a, b) => Number(b.visitedWeeks.includes(state.week)) - Number(a.visitedWeeks.includes(state.week)));
          return `
          <li class="alliance__team ${r.id === u.teamId ? 'is-mine' : ''}" style="--team:${r.color}">
            <div class="alliance__mon">
              ${monsterImg(r.id, r.exp, 64)}
              ${hasCrown(state, r.id) ? `<img class="px alliance__crown" src="assets/icons/crown.png" width="24" height="24" alt="왕관">` : ''}
            </div>
            <div class="alliance__body">
              <div class="alliance__title">
                <b>${esc(r.community)}</b><span>${esc(r.monster)} · Lv.${r.info.level} ${r.info.stage.name}</span>
                ${r.s.boosterUntil > now ? `<span class="fx-dot fx-dot--boost">${icon('booster', 14)}부스터</span>` : ''}
                ${r.s.cheerUntil > now ? `<span class="fx-dot fx-dot--cheer">${icon('cheer', 14)}응원 받는 중</span>` : ''}
              </div>
              ${play ? `
              <div class="goal__bar"><span style="width:${Math.max(3, pct(r.dmg, r.share))}%;background:${r.color}"></span></div>
              <div class="alliance__meta">${P.now} 몫 ${num(r.dmg)} / ${num(r.share)} (${Math.round(r.rate * 100)}%) · 참여 ${r.active}/${r.members}명 · 우정 ${r.friend}</div>`
              : `<div class="alliance__meta">대원 ${r.members}명 · 경험치 ${num(r.exp)}</div>`}
              <div class="crew-wall crew-wall--sm">
                ${crew.slice(0, 24).map((m) => `<span class="${play && !m.visitedWeeks.includes(state.week) ? 'is-idle' : ''}" title="${esc(m.name)}">${face(m, 26)}</span>`).join('')}
                ${crew.length > 24 ? `<small>+${crew.length - 24}</small>` : ''}
              </div>
            </div>
          </li>`;
        }).join('')}
      </ul>
      <p class="sec-desc crew-note">순위가 아니라 함께 가는 모습이에요. ${P.now} 활동한 대원은 선명하게, 아직인 대원은 흐리게 보여요.</p>`;
  } else if (tab === 'people') {
    const mode = ui.crewMode || 'week';
    const list = crewRanking(state, mode);
    const mineRow = list.find((r) => r.u.id === u.id);
    const shown = list.slice(0, 20);
    const row = (r) => `
      <li class="person-row ${r.u.id === u.id ? 'is-mine' : ''}">
        <span class="rank-row__no rank-${r.rank}">${r.rank}</span>
        ${face(r.u, 36)}
        <div><b>${esc(r.u.name)}${r.u.id === u.id ? ' (나)' : ''}</b><small>${esc(teamById(r.u.teamId).community)}</small></div>
        <span class="person-row__score">${num(r.score)}</span>
      </li>`;
    body = `
      <div class="seg" role="tablist">
        <button class="${mode === 'week' ? 'is-on' : ''}" data-action="crew-mode" data-mode="week">${P.now}</button>
        <button class="${mode === 'total' ? 'is-on' : ''}" data-action="crew-mode" data-mode="total">전체</button>
      </div>
      <p class="sec-desc">보스에게 준 피해예요. 먹이·퀴즈·가위바위보가 모두 들어가요.</p>
      <ol class="person-list">
        ${shown.map(row).join('')}
        ${mineRow && mineRow.rank > 20 ? `<li class="gap">⋯</li>${row(mineRow)}` : ''}
      </ol>`;
  } else {
    const weeks = Object.keys(state.awards).map(Number).sort((a, b) => b - a);
    const liveKing = play ? knowledgeKing(state) : null;
    const liveAce = play ? weeklyAce(state) : null;
    const teamRow = (ic, label, teamId, sub) => `
      <div class="hall-card__row">${ic}<div><small>${label}</small><b>${teamId ? esc(teamById(teamId).community) : '없음'}</b>${teamId && sub ? `<small>${sub}</small>` : ''}</div></div>`;
    const userRow = (ic, label, uid, sub) => {
      const x = uid ? state.users[uid] : null;
      return `<div class="hall-card__row">${x ? face(x, 32) : ic}<div><small>${label}</small><b>${x ? esc(x.name) : '없음'}</b>${x ? `<small>${esc(teamById(x.teamId).community)}${sub ? ` · ${sub}` : ''}</small>` : ''}</div></div>`;
    };
    body = `
      <div class="hall">
        ${play ? `
        <article class="hall-card is-live">
          <span class="eyebrow">${state.week}${P.round} · 진행 중</span>
          ${userRow(icon('point', 32), '지식왕 후보', liveKing?.user.id)}
          ${userRow(icon('seal', 32), '에이스 후보', liveAce?.user.id, liveAce ? `피해 ${num(liveAce.dmg)}` : '')}
        </article>` : ''}
        ${weeks.map((w) => {
          const a = state.awards[w];
          const b = bossOf(w);
          const done = (a.shares || []).filter((s) => s.done).map((s) => esc(teamById(s.teamId).community));
          return `
            <article class="hall-card">
              <span class="eyebrow">${w}${P.round} 시상 · ${esc(b.name)} ${a.boss?.defeated ? '격파' : '놓침'}</span>
              ${teamRow(icon('crown', 32), 'MVP 팀 (몫 달성률)', a.mvpTeam, `${Math.round(a.mvpRate * 100)}%`)}
              ${teamRow(icon('cheer', 32), '우정상', a.friendTeam, `다른 팀을 ${a.friendScore}번 도움`)}
              ${teamRow(icon('food', 32), '참여왕', a.joinTeam, `참여율 ${Math.round(a.joinRate * 100)}%`)}
              ${userRow(icon('point', 32), '지식왕', a.kingId, a.kingPerfect ? '퀴즈 전부 정답 1등' : '')}
              ${userRow(icon('seal', 32), '에이스 대원', a.aceId, a.aceDmg ? `피해 ${num(a.aceDmg)}` : '')}
              <div class="hall-card__row">${icon('premium', 32)}<div><small>우리 팀 몫 완수</small><b>${done.length ? done.join(', ') : '없음'}</b></div></div>
            </article>`;
        }).join('')}
        ${weeks.length ? '' : `<p class="muted hall__empty">1${P.round}가 끝나면 첫 시상 결과가 올라와요.</p>`}
      </div>`;
  }

  return `
  ${pageHead('원정대', `${EVENT.slogan} ${TEAMS.length}개 커뮤니티가 함께 가는 모습과 활약한 대원을 확인해요.`)}
  <section class="card">
    <div class="tabs" role="tablist">
      ${tabs.map(([k, label]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'is-on' : ''}" data-action="crew-tab" data-tab="${k}">${label}</button>`).join('')}
      <a class="pill-link tabs__extra" href="#/final">최종 결전 <span aria-hidden="true">→</span></a>
    </div>
    ${body}
  </section>`;
}

// ================================================================ 최종 결전
function prizeBoard(state) {
  const u = me(state);
  return `
    <section class="card">
      ${secHead('현장 상품 “?” 상자', `<span class="sec-note">받은 팀·사람이 열면 모두에게 공개돼요</span>`)}
      <div class="prizes">
        ${state.prizes.map((p, i) => {
          const a = PRIZE_AWARDS[p.award];
          const canOpen = u && canOpenPrize(state, u.id, p);
          return `
          <article class="prize ${p.openedAt ? 'is-open' : ''} ${canOpen ? 'is-mine' : ''}">
            <span class="prize__no">${i + 1}</span>
            <div class="prize__box">${p.openedAt ? `<b class="prize__name">${esc(p.name)}</b>` : icon('mystery', 64, '물음표 상자')}</div>
            <b class="prize__award">${esc(a.label)}</b>
            ${p.winner
              ? `<p class="prize__winner">${esc(prizeWinnerName(state, p.winner))} 획득!</p>`
              : `<p class="prize__hint">${esc(a.desc)}</p>`}
            ${canOpen ? (p.ready
              ? `<button class="btn btn--primary btn--sm" data-action="prize-open" data-index="${i}">? 상자 열기</button>`
              : '<small class="prize__wait">운영진이 상품을 넣는 중이에요</small>') : ''}
          </article>`;
        }).join('')}
      </div>
    </section>`;
}

export function renderFinal(state, ui) {
  const u = me(state);
  const f = finalPreview(state);
  const onDay = state.week >= FINAL_WEEK && !!state.final;
  const hp = Math.max(0, f.maxHp - f.dmg);
  const open = cheerOpen(state, clockNow());
  const won = !!state.final?.wonAt;
  const S = scheduleOf(state);
  const P = paceOf(state);

  const seals = BOSSES.map((b) => {
    const got = f.seals.includes(b.week);
    const lost = f.escaped.includes(b.week);
    return `<li class="seal ${got ? 'is-got' : lost ? 'is-lost' : ''}" style="--boss:${b.color}" title="${b.week}${P.round} ${esc(b.name)}">
      ${got ? icon('seal', 36, '봉인 조각') : bossImg(b.id, 36)}
      <small>${b.week}${P.round} ${got ? '봉인' : lost ? '놓침' : '?'}</small>
    </li>`;
  }).join('');

  let stagePanel = '';
  if (onDay && won) {
    const aw = state.final.awards || {};
    const line = (key) => {
      const x = aw[key];
      if (!x) return '';
      const name = x.type === 'team' ? teamById(x.id).community : state.users[x.id]?.name;
      return `<li><small>${PRIZE_AWARDS[key].label}</small><b>${esc(name || '')}</b></li>`;
    };
    stagePanel = `
      <section class="card final-win">
        <span class="eyebrow">VICTORY</span>
        <h2>원정대가 대마왕 글리치를 물리쳤어요!</h2>
        <p>${EVENT.slogan} 함께한 모든 대원에게 <b>G-DEAL 원정대 승리 뱃지</b>를 드려요.</p>
        <div class="final-win__crew">${TEAMS.map((t) => `<img class="px" src="${spriteOf(t.id)}" width="56" height="56" alt="">`).join('')}</div>
        <ul class="final-awards">${Object.keys(PRIZE_AWARDS).filter((k) => k !== 'lucky').map(line).join('')}</ul>
      </section>`;
  } else if (onDay && open) {
    const cheers = state.final.cheers || {};
    const topCheer = Math.max(1, ...Object.values(cheers));
    const mine = (state.final.mine || 0) + (ui.cheerPending || 0);
    stagePanel = `
      <section class="card cheer-panel" id="cheerPanel">
        <div class="cheer-panel__head">
          <span class="eyebrow">응원 타임 ${state.final.cheerRound}</span>
          <time class="cheer-panel__time" data-until="${state.final.cheerUntil}">${timeLeft(state.final.cheerUntil)}</time>
        </div>
        <button class="cheer-btn" data-cheer style="--team:${teamById(u.teamId).color}" aria-label="응원하기">
          ${avatarImg(u.avatar, 64)}
          <b>응원하기!</b>
          <small>누를수록 ${esc(teamById(u.teamId).monster)}의 응원 에너지가 쌓여요</small>
        </button>
        <p class="cheer-panel__mine">내 응원 <b id="myCheer">${num(mine)}</b> / ${RULES.final.cheerUserMax}</p>
        <ul class="cheer-bars">
          ${TEAMS.map((t) => `<li><img class="px" src="${spriteOf(t.id)}" width="28" height="28" alt=""><div class="bar"><span style="width:${pct(cheers[t.id] || 0, topCheer)}%;background:${t.color}"></span></div><b>${num(cheers[t.id] || 0)}</b></li>`).join('')}
        </ul>
        <div class="crew-wall crew-wall--sm cheer-panel__crew">${(state.final.recentCheer || []).map((c) => `<span title="${esc(c.name)}">${face(c, 28)}</span>`).join('')}</div>
      </section>`;
  } else if (onDay) {
    stagePanel = `
      <section class="card final-wait">
        <span class="eyebrow">${state.final.rounds.length ? `${state.final.rounds.length}라운드 끝` : '결전 준비'}</span>
        <h2>${state.final.rounds.length ? '글리치가 버티고 있어요! 다음 응원 타임을 기다려요' : '사회자의 신호를 기다려 주세요'}</h2>
        <p>응원 타임이 열리면 여기에 큰 <b>응원하기</b> 버튼이 나타나요. 응원이 끝나면 운영진이 공격을 시작하고, 모두의 화면에서 전투 장면이 재생돼요.</p>
      </section>`;
  } else {
    stagePanel = `
      <section class="card final-how">
        ${secHead('결전은 이렇게 해요')}
        <ol class="final-steps">
          <li><b>1. 응원 타임</b><span>사회자가 “응원 타임!”을 외치면 30초 동안 폰의 응원 버튼을 마구 눌러요.</span></li>
          <li><b>2. 공격!</b><span>봉인 조각이 빛나고, 몬스터 9마리가 레벨만큼 세게 차례로 공격해요. 마지막에 응원 에너지가 터져요.</span></li>
          <li><b>3. 한 번 더!</b><span>한 번에 안 쓰러지면 다시 응원하고 공격해요. 피해는 계속 쌓이니 결국 반드시 이겨요.</span></li>
        </ol>
        <ul class="final-lineup">
          ${allianceList(state).map((r) => `<li style="--team:${r.color}">${monsterImg(r.id, r.exp, 48)}<small>${esc(r.monster)}</small><b>Lv.${r.info.level}</b></li>`).join('')}
        </ul>
      </section>`;
  }

  return `
  ${pageHead('최종 결전', `${eventDateLabel(S)} 한마당 현장에서, 원정대 모두가 힘을 합쳐 대마왕 글리치를 물리쳐요.`)}
  <div class="final">
    <section class="card final-hero ${won ? 'is-won' : ''}" style="--boss:${FINAL_BOSS.color}">
      <div class="final-hero__boss">${bossImg(FINAL_BOSS.id, 64)}</div>
      <div class="final-hero__body">
        <span class="eyebrow">${onDay ? (won ? '승리!' : 'TODAY · 결전 중') : `${eventCountdown(S)} · ${eventDateLabel(S)}`}</span>
        <h2>${esc(FINAL_BOSS.name)}</h2>
        <p>${esc(FINAL_BOSS.desc)}</p>
        <div class="boss-hp boss-hp--final"><span style="width:${pct(hp, f.maxHp)}%"></span></div>
        ${onDay && (state.final?.wisdom || 0) > 0 ? `<p class="final-wisdom">${icon('premium', 20)}최종 미션으로 모은 지혜 <b>${num(state.final.wisdom)}</b> — 다음 공격 때 글리치에게 쏟아져요</p>` : ''}
        <p class="final-hero__hp">${onDay ? `체력 <b>${num(hp)}</b> / ${num(f.maxHp)}` : `지금 예상 체력 <b>${num(f.maxHp)}</b> (몬스터가 자랄수록 함께 강해져요)`}</p>
        <ul class="seals">${seals}</ul>
      </div>
    </section>

    ${stagePanel}

    ${onDay && state.final.rounds.length ? `
    <section class="card">
      ${secHead('전투 다시 보기')}
      <div class="round-list">
        ${state.final.rounds.map((r) => `<button class="btn btn--soft btn--sm" data-action="round-replay" data-round="${r.no - 1}">${r.no}라운드 · ${num(r.hpBefore - r.hpAfter)} 피해${r.won ? ' · 승리!' : ''}</button>`).join('')}
      </div>
    </section>` : ''}

    ${prizeBoard(state)}
  </div>`;
}

// 라운드 재생 화면 (app.js가 장면을 하나씩 채운다)
export function renderRaid(round, maxHp) {
  return `
    <div class="raid">
      <span class="eyebrow">${round.no}라운드</span>
      <div class="raid__boss" id="raidBoss">${bossImg(FINAL_BOSS.id, 64)}</div>
      <div class="boss-hp boss-hp--final"><span id="raidHp" style="width:${pct(round.hpBefore, maxHp)}%"></span></div>
      <p class="raid__hpnum">글리치 체력 <b id="raidHpNum">${num(round.hpBefore)}</b> / ${num(maxHp)}</p>
      <div class="raid__team">${TEAMS.map((t) => `<img class="px" id="raid-${t.id}" src="${spriteOf(t.id)}" width="48" height="48" alt="${esc(t.monster)}">`).join('')}</div>
      <ol class="battle__log" id="raidLog" aria-live="polite"></ol>
      <div class="battle__actions" id="raidActions"></div>
    </div>`;
}

export const BOSS_MOVES = ['노이즈 폭풍', '가짜 뉴스 광선', '무한 스크롤 늪', '오류 코드 난사'];

// ================================================================ 내 정보
export function renderSettings(state, token, revealed) {
  const u = me(state);
  const t = teamById(u.teamId);
  return `
    <h2 class="modal__title">내 정보</h2>
    <div class="profile-card profile-card--modal">
      ${face(u, 56)}
      <div><strong>${esc(u.name)}</strong>${teamChip(t)}</div>
    </div>
    <section class="device-code">
      <h3>내 아바타 바꾸기</h3>
      ${renderAvatarGrid(u.avatar, 'avatar-set')}
    </section>
    <section class="device-code">
      <h3>로그인 힌트 (비밀번호 대신)</h3>
      <p>다른 기기에서 들어올 때 시작 화면에서 <b>닉네임 + 이 질문의 답</b>을 넣으면 돼요.</p>
      <p class="hint-now">${u.hint?.q ? `${icon('mystery', 20)}<b>${esc(u.hint.q)}</b>` : '<span class="muted">아직 힌트가 없어요</span>'}</p>
      <div class="hint-fields">
        <label class="field"><input id="myHintQ" type="text" maxlength="40" placeholder="새 질문" value=""></label>
        <label class="field"><input id="myHintA" type="text" maxlength="30" placeholder="새 답" value=""></label>
      </div>
      <button class="btn btn--soft btn--sm" data-action="hint-save">힌트 바꾸기</button>
    </section>
    <button class="btn btn--danger btn--block" data-action="logout">로그아웃</button>
    <p class="modal__hint">로그아웃해도 내 기록은 그대로 남아요. 닉네임과 힌트의 답으로 다시 들어올 수 있어요.</p>`;
}

// ================================================================ 운영자 화면
export function renderAdmin(state, ui) {
  const ov = ui.adminOverview;
  if (!ov) {
    return `
    ${pageHead('운영자 로그인', '운영진만 쓰는 화면이에요. 비밀 키를 넣으면 진행 방식, 일정, 보스 세기, 최종 결전 진행, 현장 상품을 관리할 수 있어요.')}
    <section class="card admin-login">
      <label class="field">
        <div class="key-row">
          <input id="adminKey" type="${ui.keyShown ? 'text' : 'password'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="운영자 비밀 키" value="${esc(ui.keyDraft || '')}">
          <button class="btn btn--soft btn--sm" data-action="key-show">${ui.keyShown ? '숨기기' : '보기'}</button>
        </div>
        <small>키는 이 기기에만 저장돼요. 참가자에게 알려 주지 마세요. <b>한/영 상태</b>를 확인하세요.</small>
      </label>
      <p class="form-error" id="adminError" role="alert">${esc(ui.adminError || '')}</p>
      <button class="btn btn--primary" data-action="admin-login">로그인</button>
    </section>`;
  }

  const S = scheduleOf(state);
  const P = paceOf(state);
  const weekText = ov.week < 1 ? '원정대 모집 중' : ov.week >= FINAL_WEEK ? '결전의 날(현장)' : `${ov.week}${P.round} (전체 ${ov.weeks}번)`;
  const nextText = ov.week + 1 >= FINAL_WEEK ? '결전의 날(현장)로 넘기기' : `${ov.week + 1}${P.round}로 넘기기`;
  const goldenOn = (ov.goldenUntil || 0) > clockNow();
  const fin = ov.final;
  const cheerOn = fin && !fin.wonAt && fin.cheerUntil > clockNow();
  const totalCheer = fin ? Object.values(fin.cheers || {}).reduce((s, n) => s + n, 0) : 0;
  const prizes = ui.adminPrizes || ov.prizes;

  return `
  ${pageHead('운영자', `참가자 ${num(ov.userCount)}명 · ${weekText} · 현장 모임 ${eventDateLabel(S)}${S.quick ? ` · 미리 해 보기(${P.label})` : ''}`)}
  <div class="admin">
    <section class="card">
      ${secHead('진행 관리')}
      <p class="sec-desc">${P.label}마다 자동으로 넘어가요(1${P.round} ${weekDates(S, 1).start} 시작 → ${eventDateLabel(S)} 결전). 앞당겨야 할 때만 눌러 주세요. 넘기면 ${P.prev} 시상과 팀 몫 보상이 지급되고, 못 잡은 보스는 도망가요.</p>
      <button class="btn btn--primary" data-action="admin-next-week" ${ov.week >= FINAL_WEEK ? 'disabled' : ''}>${ov.week >= FINAL_WEEK ? '이미 결전의 날이에요' : nextText}</button>
      <table class="admin-table">
        <thead><tr><th>커뮤니티</th><th>대원</th><th>${P.now} 참여</th><th>${P.now} 피해</th><th>경험치</th><th>돕기</th></tr></thead>
        <tbody>${ov.teams.map((t) => `<tr><td>${esc(t.community)}</td><td>${num(t.members)}</td><td>${num(t.active)}</td><td>${num(t.dmg)}</td><td>${num(t.exp)}</td>
          <td><button class="btn btn--soft btn--sm" data-action="admin-support" data-team="${t.id}" ${t.members ? '' : 'disabled'}>먹이 ${RULES.support.food}개</button></td></tr>`).join('')}</tbody>
      </table>
      <p class="sec-desc">G-DEAL 관리인이 힘이 부족한 커뮤니티에 먹이를 보내 줄 수 있어요. 대원 한 명당 ${RULES.support.food}개씩 들어가요.</p>
      <div class="admin-golden">
        <button class="btn btn--primary" data-action="admin-support-behind">뒤처진 커뮤니티 모두 돕기</button>
      </div>
    </section>

    <section class="card">
      ${secHead('문제 수준', `<span class="sec-note">지금 ${esc(LEVELS[ov.quizLevel || 'adult'].label)}</span>`)}
      <p class="sec-desc">행사 전체에 하나로 정해요. 참가자는 고르지 않고, 문제는 사람마다 순서가 섞여서 나가요. 바꾸면 이번 ${P.round} 문제가 모두에게 새로 열려요(받은 포인트는 그대로).</p>
      <div class="mode-pick">
        ${Object.entries(LEVELS).map(([k, v]) => `
          <button class="mode-pick__item ${(ov.quizLevel || 'adult') === k ? 'is-active' : ''}" data-action="admin-quiz-level" data-level="${k}">
            <b>${esc(v.label)}</b><span>${esc(v.desc)}</span>
          </button>`).join('')}
      </div>
    </section>

    <section class="card">
      ${secHead('보스 세기', `<span class="sec-note">지금 ${(ov.bossScale || 1) === 1 ? '보통' : (ov.bossScale || 1) < 1 ? '약하게' : '세게'}</span>`)}
      <p class="sec-desc">보스 체력은 <b>대원 1명당 ${num(ov.share || 0)}</b> × 인원이에요(회차 ${ov.roundDays || 1}일 기준). 하루에 ${Math.round((ov.regenPerDay || 0) * 100)}%씩 회복하고, 회차 막판이 되기 전에는 쓰러지지 않고 버텨요. 1${P.round}가 끝난 뒤 너무 쉽거나 너무 어려우면 여기서 맞춰 주세요.</p>
      ${ov.boss ? `
      <p class="admin-boss">${esc(ov.boss.name)} · 체력 <b>${num(ov.boss.maxHp)}</b> · 깎은 몫 <b>${Math.round(pct(ov.boss.dmg, ov.boss.maxHp))}%</b>
        · ${ov.boss.defeated ? '격파' : ov.boss.escaped ? '도망' : ov.boss.holding ? '버티는 중' : '진행 중'}
        · 마지막 일격 가능 <b>${killLabel({ schedule: ov.schedule, week: ov.week }, ov.week)}</b></p>` : ''}
      <div class="admin-golden">${(ov.bossScales || [1]).map((v) => `
        <button class="btn btn--soft btn--sm ${(ov.bossScale || 1) === v ? 'is-active' : ''}" data-action="admin-power" data-scale="${v}">${v < 1 ? '약하게' : v > 1 ? '세게' : '보통'} (×${v})</button>`).join('')}
      </div>
      <p class="sec-desc admin-adapt">지난 회차에 얼마나 몰아쳤는지에 따라 <b>다음 보스가 저절로</b> 세지거나 약해져요.
        지금 자동 조절 <b>×${ov.bossAdjust ?? 1}</b> · ${ov.bossAdaptOn ? '켜짐' : '꺼짐'}</p>
      <div class="admin-golden">
        <button class="btn btn--soft btn--sm ${ov.bossAdaptOn ? 'is-active' : ''}" data-action="admin-adapt" data-on="1">자동 조절 켜기</button>
        <button class="btn btn--soft btn--sm ${ov.bossAdaptOn ? '' : 'is-active'}" data-action="admin-adapt" data-on="">끄기</button>
      </div>
    </section>

    <section class="card">
      ${secHead('진행 모드', `<span class="sec-note">지금 ${esc(MODE_INFO[ov.mode || 'free'].label)}${(ov.mode === 'free') ? ` · ${ov.lap || 1}바퀴` : ''}</span>`)}
      <div class="mode-pick">
        ${Object.entries(MODE_INFO).map(([k, v]) => `
          <button class="mode-pick__item ${(ov.mode || 'free') === k ? 'is-active' : ''}" data-action="admin-run-mode" data-mode="${k}">
            <b>${esc(v.label)}</b><span>${esc(v.desc)}</span>
          </button>`).join('')}
      </div>
      <p class="sec-desc admin-pace__note">프리 모드에서는 날짜·회차가 멈추고 문제와 카드가 모두 열려요. 보스도 혼자 잡을 수 있게 약해지고, 마지막 보스까지 잡으면 한 바퀴를 돌아 처음부터 다시 시작해요(레벨·포인트·도감은 그대로).</p>
    </section>

    <section class="card">
      ${secHead('진행 방식', `<span class="sec-note">지금 ${S.quick ? `미리 해 보기 · 회차 ${P.label}` : `회차 ${P.label}`}</span>`)}
      <p class="sec-desc">한 번만 누르면 시작 시각과 회차 길이가 한꺼번에 맞춰져요. 수업 시간에 짧게 해 보거나, 4주 프로젝트로 길게 할 수 있어요.</p>
      <div class="mode-pick">
        ${MODES.map((m) => `
          <button class="mode-pick__item" data-action="admin-mode" data-mode="${m.key}">
            <b>${m.label}</b><span>${m.sub}</span>
          </button>`).join('')}
      </div>
      <p class="sec-desc admin-pace__note">짧은 방식은 보스 체력이 낮아져 적은 인원으로도 해 볼 수 있어요. 끝나면 맨 아래 “전체 초기화”를 누르면 기본 일정과 샘플 상품으로 돌아가요.</p>
    </section>

    <section class="card">
      ${secHead('일정 (시작 · 간격)', `<span class="sec-note">회차마다 ${P.label}${S.quick ? ' · 미리 해 보기' : ''}</span>`)}
      <p class="sec-desc">시작 시각에 1${P.round}가 열리고, 고른 <b>간격</b>마다 다음 회차로 넘어가요. ${EVENT.weeks}회차가 끝나는 시각이 곧 <b>현장 결전</b>이에요. 날짜와 시각은 한국 시간이에요.</p>
      <div class="admin-sched">
        <label class="admin-sched__field"><span>시작</span>
          <input type="datetime-local" id="schedStart" value="${ui.schedDraft?.start ?? kstInput(S.start)}">
          <button class="btn btn--soft btn--sm" data-action="admin-sched-now">지금</button>
          <button class="btn btn--soft btn--sm" data-action="admin-sched-nov">11월 21일</button>
        </label>
      </div>
      <p class="sec-desc admin-sched__quick">회차 간격 고르기</p>
      <div class="admin-golden">
        ${Object.entries(PACES).map(([k, q]) => `
          <button class="btn btn--soft ${(ui.schedGap ?? paceKeyFor(S)) === k ? 'is-active' : ''}" data-action="admin-sched-gap" data-gap="${k}">${q.label}</button>`).join('')}
      </div>
      <p class="admin-sched__sum">${(() => {
        const gap = PACES[ui.schedGap ?? paceKeyFor(S)];
        const start = ui.schedDraft?.start ? fromKstInputView(ui.schedDraft.start) : S.start;
        if (!gap || !Number.isFinite(start)) return '간격을 골라 주세요.';
        const end = start + EVENT.weeks * gap.ms;
        return `${gap.label}마다 ${EVENT.weeks}번 → <b>${whenText(start)}</b> 시작, <b>${whenText(end)}</b> 현장 결전`;
      })()}</p>
      <div class="admin-golden">
        <button class="btn btn--primary" data-action="admin-sched-save">이 일정으로 저장</button>
      </div>
      <ol class="admin-rounds">
        ${BOSSES.map((b) => `<li${state.week === b.week ? ' class="is-now"' : ''}><b>${b.week}${P.round}</b><span>${weekDates(S, b.week).start} ~ ${weekDates(S, b.week).end}</span><small>${esc(b.name)}</small></li>`).join('')}
        <li${state.week >= FINAL_WEEK ? ' class="is-now"' : ''}><b>결전</b><span>${eventDateLabel(S)}</span><small>${esc(FINAL_BOSS.name)}</small></li>
      </ol>
      <p class="sec-desc admin-sched__quick">지금 바로 시작 — 누르는 순간 이번 회차가 새로 시작되고, 그 뒤로 이 간격마다 넘어가요</p>
      <div class="admin-golden">
        ${Object.entries(PACES).map(([k, q]) => `<button class="btn btn--soft" data-action="admin-pace" data-pace="${k}">${q.label}마다</button>`).join('')}
      </div>
      <p class="sec-desc admin-pace__note">미리 해 보기가 끝나면 맨 아래 “전체 초기화”를 누르세요. “지금 바로 시작 → ${eventDateLabelDefault()} 결전” 일정과 샘플 상품으로 돌아가요.</p>
    </section>

    <section class="card">
      ${secHead('골든타임', goldenOn ? `<span class="sec-note">진행 중 · <time data-until="${ov.goldenUntil}">${timeLeft(ov.goldenUntil)}</time></span>` : '')}
      <p class="sec-desc">켜는 동안 모든 원정대의 먹이 경험치(=보스 피해)가 ${RULES.golden.multiplier}배가 돼요. 단톡방에 “지금부터 30분 골든타임! 보스를 몰아붙여요!”라고 함께 알려 주시면 효과가 커요.</p>
      <div class="admin-golden">
        <button class="btn btn--primary" data-action="admin-golden" data-minutes="30">30분 골든타임 시작</button>
        <button class="btn btn--soft" data-action="admin-golden" data-minutes="60">60분</button>
        ${goldenOn ? '<button class="btn btn--danger" data-action="admin-golden-stop">지금 끝내기</button>' : ''}
      </div>
    </section>

    <section class="card">
      ${secHead('최종 결전 진행', fin ? `<span class="sec-note">${fin.wonAt ? '승리!' : `글리치 체력 ${num(fin.maxHp - fin.dmg)} / ${num(fin.maxHp)} · ${fin.rounds}라운드 진행`}</span>` : '')}
      ${!fin
        ? `<p class="sec-desc">${eventDateLabel(S)} 결전의 날이 되면 여기서 응원 타임과 공격을 진행해요. 리허설은 진행을 결전의 날까지 넘겨서 해 보세요.</p>`
        : fin.wonAt
          ? '<p class="sec-desc">글리치를 물리쳤어요! 아래 “현장 상품”에서 상자를 열거나 행운 추첨을 진행하세요.</p>'
          : `<p class="sec-desc">① 응원 타임 열기 → ② 끝나면 공격 개시 → 체력이 남으면 ①부터 다시. 큰 화면에는 이 앱의 “최종 결전” 화면을 띄워 주세요.</p>
             <div class="admin-golden">
               <button class="btn btn--primary" data-action="admin-cheer-open" data-seconds="30" ${cheerOn ? 'disabled' : ''}>응원 타임 30초</button>
               <button class="btn btn--soft" data-action="admin-cheer-open" data-seconds="60" ${cheerOn ? 'disabled' : ''}>60초</button>
               <button class="btn btn--gold" data-action="admin-attack" ${cheerOn ? 'disabled' : ''}>공격 개시!</button>
             </div>
             <p class="sec-desc admin-final__now">${cheerOn ? `응원 중 · <time data-until="${fin.cheerUntil}">${timeLeft(fin.cheerUntil)}</time> · ` : ''}모인 응원 ${num(totalCheer)}번 · 응원한 사람 ${num(fin.cheerers)}명</p>
             <div class="admin-manual">
               <select id="manualTeam"><option value="all">모든 팀에 똑같이</option>${TEAMS.map((t) => `<option value="${t.id}">${esc(t.community)}</option>`).join('')}</select>
               <input id="manualCheer" type="number" min="1" max="100000" placeholder="응원 수">
               <button class="btn btn--soft btn--sm" data-action="admin-manual-cheer">현장 응원 직접 넣기</button>
             </div>
             <p class="sec-desc">인터넷이 느리거나 응원이 잘 안 모일 때, 사회자가 팀별 함성 크기를 보고 숫자를 넣어 대신할 수 있어요.</p>`}
    </section>

    <section class="card">
      ${secHead('현장 상품 “?” 상자', '<span class="sec-note">이름은 상자를 열 때까지 참가자에게 보이지 않아요</span>')}
      ${prizes.some((p) => p.name.startsWith(SAMPLE_MARK)) ? `<p class="admin-warn">${SAMPLE_MARK} 표시가 붙은 샘플 상품이 들어 있어요. 미리 해 보기용이에요. 행사 전에 실제 상품 이름으로 바꿔 저장해 주세요.</p>` : ''}
      <p class="sec-desc">상품 이름과 받는 상을 정하고 저장하세요. 결전에서 이기면 상의 주인이 자동으로 정해지고, 받은 팀원(또는 사람)이 자기 폰에서 “?”를 열어요. 여기서 대신 열 수도 있어요.</p>
      <table class="admin-table admin-prizes">
        <thead><tr><th>번호</th><th>상품 이름</th><th>받는 상</th><th>주인</th><th></th></tr></thead>
        <tbody>${prizes.map((p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><input class="admin-input" data-prize-name="${i}" value="${esc(p.name)}" maxlength="40" placeholder="예: 커피 머신"></td>
            <td><select data-prize-award="${i}">${Object.entries(PRIZE_AWARDS).map(([k, a]) => `<option value="${k}" ${k === p.award ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></td>
            <td>${p.winner ? esc(prizeWinnerName(state, p.winner) || (p.winner.type === 'team' ? teamById(p.winner.id)?.community : ''))
              : fin?.wonAt && p.award !== 'lucky' ? '<small>해당자 없음 · 받는 상을 “행운 추첨”으로 바꿔 저장한 뒤 추첨하세요</small>' : '-'}${p.openedAt ? '<small>열림</small>' : ''}</td>
            <td class="admin-prizes__btns">
              ${p.award === 'lucky' && !p.winner ? `<button class="btn btn--soft btn--sm" data-action="admin-prize-draw" data-index="${i}">추첨</button>` : ''}
              ${p.winner && !p.openedAt ? `<button class="btn btn--primary btn--sm" data-action="admin-prize-open" data-index="${i}">열기</button>` : ''}
              <button class="btn btn--danger btn--sm" data-action="admin-prize-remove" data-index="${i}" aria-label="${i + 1}번 상품 빼기">빼기</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
      <div class="admin-golden admin-prizes__foot">
        <button class="btn btn--soft" data-action="admin-prize-add">상품 추가</button>
        <button class="btn btn--primary" data-action="admin-prizes-save">상품 저장</button>
      </div>
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
      <p class="sec-desc">닉네임을 잊은 대원이 찾아오면 힌트 질문을 보고 본인인지 확인해 주세요. 답을 10번 틀리면 잠기는데, “잠금 풀기”로 다시 열어 줄 수 있어요.</p>
      <ul class="admin-users">${ov.users.map((x) => `
        <li data-name="${esc(x.name)}">${avatarImg(x.avatar, 28)}<b>${esc(x.name)}</b><small>${esc(teamById(x.teamId).community)} · ${num(x.totalPoints)}P · 힌트: ${esc(x.hint || '없음')}${x.fails ? ` · 답 틀림 ${x.fails}번` : ''}</small>
          ${x.fails ? `<button class="btn btn--soft btn--sm" data-action="admin-unlock" data-user="${x.id}" data-name="${esc(x.name)}">잠금 풀기</button>` : ''}
          <button class="btn btn--danger btn--sm" data-action="admin-remove" data-user="${x.id}" data-name="${esc(x.name)}">내보내기</button></li>`).join('')}
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
