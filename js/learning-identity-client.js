// The hub master token remains on science-hub-one.vercel.app.
// This wrapper exposes only this game's short-lived scoped token.
const GAME = 'gdeal';
// Enable after gdeal is deployed to the hub catalog and registered in its identity registry.
const HUB_LOGIN_ENABLED = false;
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
  if (!HUB_LOGIN_ENABLED) {
    if (hubRequested) lastError = '통합 허브 연결 전입니다. 지딜 계정으로 로그인해 주세요.';
    return null;
  }
  window.addEventListener('hubidentity:lost', () => {
    if (hadHubIdentity) lostHubIdentity = true;
    window.dispatchEvent(new CustomEvent('learningidentity:lost'));
  });
  window.addEventListener('hubidentity:error', event => { lastError = event.detail?.message || '통합 로그인 연결을 확인해 주세요.'; });
  if (!window.SCIENCE_IDENTITY) {
    await new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = new URL('../identity/game-identity.js?v=20261117learning', import.meta.url).href;
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
  if (sdk?.token && sdk?.student) return { hubGameToken: sdk.token };
  // Never silently switch to another account left on a shared classroom browser.
  if (lostHubIdentity) throw Error('통합 로그인이 끝났어요. 다시 로그인해 주세요.');
  if (hubRequested) throw Error(lastError || '통합 계정을 연결하고 있어요. 잠시 후 다시 확인해 주세요.');
  return legacyToken ? { token: legacyToken } : {};
}

export const learningIdentity = {
  ready: identityReady,
  get enabled() { return HUB_LOGIN_ENABLED; },
  get student() { return legacySelected ? null : sdk?.student || null; },
  get token() { return legacySelected ? '' : sdk?.token || ''; },
  get error() { return lastError; },
  credentials: getLearningCredentials,
  async connect() {
    if (!HUB_LOGIN_ENABLED) throw Error('통합 허브 연결 전입니다. 지딜 계정으로 로그인해 주세요.');
    legacySelected = false;
    await identityReady;
    if (!sdk) throw Error(lastError || '통합 로그인 연결을 불러오지 못했어요.');
    return sdk.connect();
  },
  playing(value) { sdk?.setPlaying(!legacySelected && value === true); },
  async disconnect() {
    if (sdk) await sdk.disconnect();
    if (hadHubIdentity) lostHubIdentity = true;
  },
  // Explicit UI action only, after the user selects their existing G-DEAL account.
  useLegacy() { legacySelected = true; sdk?.setPlaying(false); hadHubIdentity = false; lostHubIdentity = false; hubRequested = false; }
};
