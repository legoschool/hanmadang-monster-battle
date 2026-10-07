// Titles are fixed application strings, never user-supplied markup.
export function gameHeader(title, guest=false) {
  return `<header class="service-header"><a class="service-brand" href="games.html" aria-label="G-DEAL 게임 목록"><img src="assets/brand/gdeal.svg" alt="G-DEAL"><span>${title}</span></a><nav aria-label="게임 메뉴">${guest?'<span>체험 · 저장 안 됨</span>':''}<a href="games.html">게임 선택</a></nav></header>`;
}
