export const BOSS_ART=[{id:'glitch',src:'assets/bosses/glitch.png'},{id:'doppel',src:'assets/bosses/doppel.png'},{id:'archive-wraith',src:'assets/bosses/archive-wraith.svg'}];
export const bossSprite=run=>run.boss?BOSS_ART[run.region].id:run.enemy?.image;
