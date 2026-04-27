function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

const BASE_SITE_CONFIGS = [
  {
    key: 'mmca',
    name: '국립현대미술관',
    listUrl: 'https://www.mmca.go.kr/exhibitions/progressList.do',
    detailUrlHint: 'https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do',
    difficulty: 'easy',
    blocked: false,
    notes: '목록 페이지에서 전시명/기간/상세 링크 추출',
  },
  {
    key: 'sac',
    name: '예술의전당',
    listUrl: 'https://www.sac.or.kr/site/main/program/schedule?tab=3',
    detailUrlHint: 'https://www.sac.or.kr/site/main/show/show_view',
    difficulty: 'easy',
    blocked: false,
    notes: 'schedule?tab=3 + getProgramCalList(CATEGORY_PRIMARY=6) 조합 사용',
  },
  {
    key: 'warmemo',
    name: '전쟁기념관 기획/특별전',
    listUrl: 'https://www.warmemo.or.kr:8443/Home/H20000/H20200/boardList',
    detailUrlHint: 'https://www.warmemo.or.kr:8443/Home/H20000/H20200/boardView',
    difficulty: 'hard',
    blocked: false,
    allowInsecureTls: true,
    notes: '기획/특별전 게시판만 수집 대상으로 제한',
  },
  {
    key: 'sema',
    name: '서울시립미술관',
    listUrl:
      'https://sema.seoul.go.kr/kr/whatson/landing?whatsonMenuDivList=EX&whatChoice2=N&whatChoice3=N&whatChoice4=N&whatChoice5=N&whenType=FROM_TODAY',
    detailUrlHint: 'https://sema.seoul.go.kr/kr/whatson/exhibition/detail',
    difficulty: 'medium',
    blocked: false,
    notes: '전시 landing(현재/예정)에서 카드 데이터-idx 기반으로 상세 URL 조합',
  },
  {
    key: 'museum',
    name: '국립중앙박물관',
    listUrl: 'https://www.museum.go.kr/MUSEUM/contents/M0202010000.do?menuId=current',
    detailUrlHint: 'https://www.museum.go.kr/MUSEUM/contents/M0202010000.do',
    difficulty: 'easy',
    blocked: false,
    notes: '현재/예정 전시(M020201, M020202) 전용 파서 사용',
  },
  {
    key: 'busan-art',
    name: '부산시립미술관',
    listUrl: 'https://art.busan.go.kr/tblTsite07Display/listNowClient.nm',
    detailUrlHint: 'https://art.busan.go.kr/index.nm?menuCd=',
    difficulty: 'medium',
    blocked: false,
    notes: '현재/예정 전시 목록 페이지를 병행 수집',
  },
  {
    key: 'leeum',
    name: '리움미술관',
    listUrl: 'https://www.leeumhoam.org/leeum/exhibition',
    detailUrlHint: 'https://www.leeumhoam.org/exhibitions',
    difficulty: 'medium',
    blocked: false,
    notes: '공식 목록 API(/leeum/exhibition/list) 사용',
  },
  {
    key: 'apma',
    name: '아모레퍼시픽미술관',
    listUrl: 'https://apma.amorepacific.com/contents/exhibition/index.do',
    detailUrlHint: 'https://apma.amorepacific.com/exhibitions',
    difficulty: 'medium',
    blocked: false,
    notes: '전시 인덱스의 pages JSON에서 기간/상세 링크 추출',
  },
  {
    key: 'kukje',
    name: '국제갤러리',
    listUrl: 'https://www.kukjegallery.com/exhibitions',
    detailUrlHint: 'https://www.kukjegallery.com/exhibitions',
    difficulty: 'medium',
    blocked: false,
    notes: '민간 갤러리 전시 목록 확장 대상, 전시 상세 링크 중심 수집',
  },
  {
    key: 'ddp',
    name: 'DDP',
    listUrl: 'https://ddp.or.kr/?menuno=240',
    detailUrlHint: 'https://ddp.or.kr/',
    difficulty: 'medium',
    blocked: false,
    notes: '전시 전용 menuno=240 목록 파싱',
  },
  {
    key: 'sejong',
    name: '세종문화회관 전시',
    listUrl: 'https://www.sejongpac.or.kr/portal/performance/exhibit/performList.do?menuNo=200558',
    detailUrlHint: 'https://www.sejongpac.or.kr/portal/program/exhibition',
    difficulty: 'medium',
    blocked: false,
    notes: '전시일정 list + performListData AJAX 엔드포인트 사용',
  },
];

const DAEGU_ART_CONFIG = {
  key: 'daegu-art',
  name: '대구미술관',
  listUrl: 'https://daeguartmuseum.or.kr/index.do?menu_id=00000729',
  detailUrlHint: 'https://daeguartmuseum.or.kr/index.do?menu_id=00000729&menu_link=/front/ehi/ehiViewFront.do',
  difficulty: 'medium',
  blocked: false,
  notes: '전시 > 현재전시(menu_id=00000729) 카드 파서 사용, 기본 비활성 + 옵션 활성',
};

const includeDaeguArt = parseBooleanEnv(process.env.INGESTION_ENABLE_DAEGU_ART, false);
const SITE_CONFIGS = includeDaeguArt ? [...BASE_SITE_CONFIGS, DAEGU_ART_CONFIG] : [...BASE_SITE_CONFIGS];

const SITE_CONFIG_MAP = new Map(SITE_CONFIGS.map((config) => [config.key, config]));
const SITE_CONFIG_NAME_MAP = new Map(SITE_CONFIGS.map((config) => [config.name, config]));

function getSiteConfigs(keys) {
  if (!keys || keys.length === 0) return [...SITE_CONFIGS];
  const normalized = new Set(
    keys
      .map((value) => String(value || '').trim().toLowerCase())
      .filter((value) => value.length > 0),
  );

  const lookupConfigs = includeDaeguArt ? SITE_CONFIGS : [...SITE_CONFIGS, DAEGU_ART_CONFIG];
  return lookupConfigs.filter((config) => normalized.has(config.key.toLowerCase()));
}

function findSiteConfigByName(name) {
  if (!name) return null;
  return SITE_CONFIG_NAME_MAP.get(String(name).trim()) ?? null;
}

module.exports = {
  SITE_CONFIGS,
  SITE_CONFIG_MAP,
  getSiteConfigs,
  findSiteConfigByName,
};
