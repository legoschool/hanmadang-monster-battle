// The hub master token remains on science-hub-one.vercel.app.
// This wrapper exposes only this game's short-lived scoped token.
const GAME = 'gdeal';
const HUB_LOGIN_ENABLED = true;
export const HUB_URL = 'https://science-hub-one.vercel.app';
let sdk = null;
let hadHubIdentity = false;
let lostHubIdentity = false;
let hubRequested = false;
let lastError = null;
let legacySelected = false;

async function initialize() {
  if (typeof document === 'undefined') return null;
  const entry = new URL(location.href);
  hubRequested = entry.searchParams.get('hub_login') === '1' || new URLSearchParams(entry.hash.slice(1)).has('hub_ticket');
  legacySelected = !hubRequested && entry.searchParams.get('legacy') === '1';
  if (!HUB_LOGIN_ENABLED) {
    if (hubRequested) lastError = '통합 허브 연결 전입니다. 지딜 계정으로 로그인해 주세요.';
    return null;
  }
  window.addEventListener('hubidentity:lost', () => {
    if (hadHubIdentity) lostHubIdentity = true;
    if (!legacySelected) window.dispatchEvent(new CustomEvent('learningidentity:lost'));
  });
  window.addEventListener('hubidentity:error', event => { lastError = event.detail?.message || '통합 로그인 연결을 확인해 주세요.'; });
  window.addEventListener('hubidentity:update', event => {
    if (legacySelected || lostHubIdentity) return;
    hadHubIdentity = true;
    lastError = null;
    window.dispatchEvent(new CustomEvent('learningidentity:update', { detail: event.detail }));
  });
  if (!window.SCIENCE_IDENTITY) {
    await new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = new URL('../identity/game-identity.js?v=20261117stars', import.meta.url).href;
      tag.dataset.game = GAME;
      tag.onload = resolve;
      tag.onerror = () => reject(Error('통합 로그인 연결을 불러오지 못했어요. 새로고침해 주세요.'));
      document.head.append(tag);
    });
  }
  sdk = window.SCIENCE_IDENTITY;
  if (!sdk || sdk.game !== GAME) throw Error('이 게임의 통합 로그인 연결을 확인하지 못했어요.');
  const student = await sdk.ready;
  if (student) { hadHubIdentity = true; lostHubIdentity = false; }
  return student;
}

export const identityReady = initialize().catch(error => {
  lastError = error.message;
  return null;
});

export function getLearningCredentials(legacyToken) {
  if (legacySelected) return legacyToken ? {token:legacyToken} : {};
  // Never silently switch to another account left on a shared classroom browser.
  if (lostHubIdentity) throw Error('통합 로그인이 끝났어요. 다시 로그인해 주세요.');
  if (sdk?.token && sdk?.student) return { hubGameToken: sdk.token };
  if (hubRequested) throw Error(lastError || '통합 계정을 연결하고 있어요. 잠시 후 다시 확인해 주세요.');
  return {};
}

export const learningIdentity = {
  ready: identityReady,
  get enabled() { return HUB_LOGIN_ENABLED; },
  get legacy() { return legacySelected; },
  get student() { return legacySelected || lostHubIdentity ? null : sdk?.student || null; },
  get token() { return legacySelected || lostHubIdentity ? '' : sdk?.token || ''; },
  get error() { return lastError; },
  credentials: getLearningCredentials,
  async connect() {
    if (!HUB_LOGIN_ENABLED) throw Error('통합 허브 연결 전입니다. 지딜 계정으로 로그인해 주세요.');
    legacySelected = false;
    const entry = new URL(location.href);
    entry.searchParams.delete('legacy');
    history.replaceState(null, '', entry.href);
    await identityReady;
    if (!sdk) throw Error(lastError || '통합 로그인 연결을 불러오지 못했어요.');
    return sdk.connect();
  },
  playing(value) { sdk?.setPlaying(!legacySelected && value === true); },
  async refresh() { if (!legacySelected && !lostHubIdentity && sdk?.token) return sdk.refresh(); return null; },
  async disconnect() {
    lostHubIdentity = true;
    if (sdk) await sdk.disconnect();
  },
  // Explicit UI action only, after the user selects their existing G-DEAL account.
  useLegacy() {
    legacySelected = true;
    sdk?.setPlaying(false);
    hadHubIdentity = false;
    lostHubIdentity = false;
    hubRequested = false;
    const entry = new URL(location.href);
    entry.searchParams.delete('hub_login');
    entry.searchParams.set('legacy', '1');
    history.replaceState(null, '', entry.href);
  }
};
