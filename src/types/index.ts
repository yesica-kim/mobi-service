// ── 서버 ──
export const SERVERS = [
  "몰리", "알리사", "메이븐", "라사", "칼릭스", "데이안", "아이라", "던컨",
] as const;
export type ServerName = (typeof SERVERS)[number];

export const MAX_CHARS_PER_SERVER = 6;

// ── 클래스 계열 ──
export const CLASS_TREE: Record<string, string[]> = {
  "전사 계열": ["기사", "전사", "대검전사", "검술사"],
  "궁수 계열": ["궁수", "석궁사수", "장궁병"],
  "마법사 계열": ["전격술사", "마법사", "화염술사", "빙결술사"],
  "힐러 계열": ["암흑술사", "힐러", "사제", "수도사"],
  "음유시인": ["음유시인", "댄서", "악사"],
  "도적": ["도적", "격투가", "듀얼블레이드"],
};
export const MAIN_CLASSES = Object.keys(CLASS_TREE);

// ── 캐릭터 ──
export interface Character {
  id: string;
  server: ServerName;
  name: string;
  mainClass: string;
  subClass: string;
}

// ── 숙제 ──
export type PeriodType = "daily" | "weekly";
export type TabType = "all" | "daily" | "weekly" | "purchase" | "trade" | "scroll" | "event";
export type ScopeType = "character" | "server";

export interface HomeworkItem {
  id: string;
  title: string;
  reward: string;
  period: PeriodType;
  totalCount: number;
  completedCount: number;
  isFavorite: boolean;
  scope?: ScopeType;
  tags?: string[];
}

export function isFullyCompleted(item: HomeworkItem): boolean {
  return item.completedCount >= item.totalCount;
}

// ── 지역 ──
export const REGIONS = [
  "콜헨", "티르코네일", "두갈드아일", "던바튼", "가이레흐 언덕", "반호르", "이멘마하", "캐시샵",
] as const;
export type RegionName = (typeof REGIONS)[number];

// ── 구매 / 물물교환 아이템 ──
export interface ShopItem {
  id: string;
  itemName: string;
  region: RegionName;
  npcName: string;
  completed: boolean;
  isFavorite: boolean;
  scope?: ScopeType;
  tags?: string[];
}

// ── 임무게시판 스크롤 ──
export const SCROLL_TYPES = ["제작", "채집", "요리", "토벌"] as const;
export type ScrollType = (typeof SCROLL_TYPES)[number];

export interface ScrollItem {
  id: string;
  title: string;
  scrollType: ScrollType;
  totalCount: number;
  completedCount: number;
  isFavorite: boolean;
  scope?: ScopeType;
  materials: string[];
  tags?: string[];
}

// ── 기본 숙제 템플릿 ──
// scope: "on" = 서버 범위 (같은 서버 캐릭터 전체 체크), "off" = 캐릭터 범위 (기본값)
export const DEFAULT_HOMEWORK: { title: string; reward: string; period: PeriodType; scope?: string }[] = [
  // 일일
  { title: "우편함 확인", reward: "보상 없음", period: "daily", scope: "off" },
  { title: "빛나는 동굴 클리어", reward: "성수 1개, 하트 토큰 1개, 아르바이트 120", period: "daily", scope: "off" },
  { title: "심매", reward: "하트 토큰 2개, 성수 1개", period: "daily", scope: "off" },
  { title: "은동전 30개 사용", reward: "-", period: "daily", scope: "off" },
  { title: "보석 승급하기", reward: "-", period: "daily", scope: "off" },
  { title: "일일 미션 보상 확인", reward: "-", period: "daily", scope: "off" },
  { title: "모험가 패스 확인", reward: "-", period: "daily", scope: "off" },
  { title: "이벤트 보상 확인", reward: "-", period: "daily", scope: "off" },
  { title: "가공하기", reward: "-", period: "daily", scope: "off" },
  // 주간
  { title: "모험가 길드 정기 의뢰", reward: "엘리트 연금술 재연소 촉매, 미스틱 다이스(3594)", period: "weekly", scope: "off" },
  { title: "뱅가드 브리치 3회", reward: "주인 없는 소환 결계 전리품, 2만 골드, 성수 1개", period: "weekly", scope: "off" },
  { title: "어비스 3종 매우어려움", reward: "심연의 마석 100개", period: "weekly", scope: "off" },
  { title: "어비스 지하대공동 매우어려움", reward: "심연의 마석 120개", period: "weekly", scope: "off" },
  { title: "타바르타스 매우어려움", reward: "원정의 증거 30개, 인챈트 스크롤, 아티팩트, 미스틱 던전 차원의 열쇠 조각 350개", period: "weekly", scope: "off" },
  { title: "에이렐 어려움", reward: "인챈트 스크롤, 아티팩트, 초월의 정수 조각 30개, 10만 골드", period: "weekly", scope: "off" },
  { title: "화이트 서큐버스 매우어려움", reward: "초월의 정수 조각 50개, 10만 골드, 미스틱 던전 열쇠 2개, 빛의 흔적 100개, 인챈트 스크롤", period: "weekly", scope: "off" },
  { title: "글라스기브넨 매우어려움", reward: "원정의 증거 30개, 30만 골드, 인챈트 스크롤", period: "weekly", scope: "off" },
  { title: "주간 어비스 3회", reward: "심연의 화석 15개", period: "weekly", scope: "off" },
  { title: "주간 레이드", reward: "원정의 증거2개", period: "weekly", scope: "off" },
  { title: "불길한 소환의 결계 7회", reward: "미스틱 다이스 열쇠 상자", period: "weekly", scope: "off" },
  { title: "검은 구멍 14회", reward: "-", period: "weekly", scope: "off" },
];

// ── 기본 구매 / 물물교환 템플릿 ──
// scope: "on" = 서버 범위, "off" = 캐릭터 범위 (기본값)
export const DEFAULT_PURCHASE_ITEMS: { itemName: string; region: RegionName; npcName: string; scope?: string }[] = [
  { itemName: "보석 보물 상자 구매 10개(서버)", region: "캐시샵", npcName: "골드", scope: "on" },
  { itemName: "매일 무료 상품 구매 1개(서버)", region: "캐시샵", npcName: "추천픽", scope: "on" },
  { itemName: "성수 5개(서버)", region: "던바튼", npcName: "크리스텔(봉헌소)", scope: "on" },
  { itemName: "우유10 -> 케이틴 특제 통밀빵3", region: "티르코네일", npcName: "케이틴(식료품점)", scope: "off" },
  { itemName: "케이틴 특제 통밀빵10 -> 성수10(서버)", region: "티르코네일", npcName: "엔델리온(봉헌소)", scope: "off" },
];

export const DEFAULT_TRADE_ITEMS: { itemName: string; region: RegionName; npcName: string; scope?: string }[] = [
  { itemName: "호박 수프4 -> 최상급 가죽+2", region: "이멘마하", npcName: "델렌(잡화점)", scope: "off" },
  { itemName: "호박 수프4 -> 최상급 목재+2", region: "이멘마하", npcName: "델렌(잡화점)", scope: "off" },
  { itemName: "카레라이스4 -> 운철괴2", region: "이멘마하", npcName: "오슬라(무기점)", scope: "off" },
  { itemName: "농어 매운탕1 -> 은합금괴10", region: "반호르", npcName: "아이데른(대장간)", scope: "off" },
];

/** scope 문자열을 ScopeType으로 변환 */
export function toScope(s?: string): ScopeType {
  return s === "on" ? "server" : "character";
}

/** 타이틀에서 "N회" 또는 "N종" 패턴 추출 (없으면 1) */
export function parseTotalCount(title: string): number {
  const match = title.match(/(\d+)(?:회|종)/);
  return match ? parseInt(match[1], 10) : 1;
}

// ── 숙제 프리셋 ──
export interface HomeworkPreset {
  id: string;
  name: string;
  createdAt: string;
  homework: Omit<HomeworkItem, "id" | "completedCount">[];
  purchaseItems: Omit<ShopItem, "id" | "completed">[];
  tradeItems: Omit<ShopItem, "id" | "completed">[];
}

// ── 저장 데이터 형태 ──
export interface AppData {
  characters: Character[];
  homework: Record<string, HomeworkItem[]>;
  /** charId -> ShopItem[] */
  purchaseItems: Record<string, ShopItem[]>;
  tradeItems: Record<string, ShopItem[]>;
  /** charId -> ScrollItem[] */
  scrollItems?: Record<string, ScrollItem[]>;
  lastDailyReset: string;
  lastWeeklyReset: string;
  presets?: HomeworkPreset[];
}
