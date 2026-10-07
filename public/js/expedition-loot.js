export const RUN_LOOT={
  shockwave:{name:'충격파 검',weapon:'blade',icon:'blade',before:'가까운 적을 벱니다.',after:'공격할 때 관통 충격파가 앞으로 뻗습니다.'},
  split:{name:'갈래 지팡이',weapon:'wand',icon:'wand',before:'탄환 한 발을 쏩니다.',after:'탄환 세 발을 부채꼴로 발사합니다.'},
  shards:{name:'파편 고리',weapon:'orbit',icon:'orbit',before:'주변의 적을 공격합니다.',after:'고리 공격과 함께 여섯 방향으로 파편을 쏩니다.'},
  echo:{name:'잔상 폭탄',icon:'boots',before:'회피하면 자리만 벗어납니다.',after:'회피한 자리에 폭탄을 남겨 추격하는 적을 공격합니다.'},
  chain:{name:'번개 연결',icon:'lens',before:'맞힌 적에게만 피해를 줍니다.',after:'기본 공격이 가까운 다른 적 두 마리에게 번집니다.'},
  heart:{name:'재생 방패',icon:'shield',before:'회복 아이템을 찾아야 합니다.',after:'즉시 체력 45 회복. 적을 다섯 마리 처치할 때마다 체력 12 회복.'},
};
export function lootChoices(engine){const ids=Object.keys(RUN_LOOT).filter(id=>(!RUN_LOOT[id].weapon||RUN_LOOT[id].weapon===engine.weapon)&&!engine.mods[id]);return ids.slice(0,3);}
export const encounterLabel=e=>({warmup:'공격 버튼으로 적 4마리 처치',elite:'정예 돌진을 피하고 노란 빈틈 공격',cache:'정예가 남긴 상자에 다가가기',assault:'새 장비로 적 무리 돌파',boss:'보스 공격을 피한 뒤 반격',complete:'보스 격파'}[e.encounter]||'전투');
