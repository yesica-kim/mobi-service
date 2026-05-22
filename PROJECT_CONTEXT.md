# mobimobi 프로젝트 컨텍스트

## 프로젝트 개요
마비노기 모바일 MMORPG 일일/주간 숙제 트래커 웹앱.
- **스택**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **인증/DB**: Firebase Auth (Google OAuth) + Cloud Firestore
- **배포**: Vercel (GitHub main 브랜치 자동배포)
- **GitHub**: https://github.com/yesica-kim/mobi-service.git
- **Production**: https://mobi-service.vercel.app
- **현재 버전**: v1.2.0

## 핵심 규칙
- **"실섭 배포 해달라"고 하기 전까지 로컬호스트에만 작업할 것**
- 배포 시 package.json 버전 범프 필요
- Vercel 환경변수에 `NEXT_PUBLIC_ADMIN_EMAIL=inchu594@gmail.com` 추가 필요 (아직 안 함)

## 주요 파일 구조

### 타입/스키마 정의
- `src/types/index.ts` — 모든 타입 + DEFAULT_HOMEWORK, DEFAULT_PURCHASE_ITEMS, DEFAULT_TRADE_ITEMS, DEFAULT_SCROLL_ITEMS (기본 카드 데이터)

### 핵심 로직
- `src/hooks/useAppState.ts` — 전체 상태 관리 (캐릭터, 숙제, 구매, 물물교환, 임무게시판, 프리셋, 즐겨찾기/체크 보존)
- `src/lib/storage.ts` — localStorage 저장, 데이터 마이그레이션(migrateRenames, migrateNewDefaults, migrateIsDefault), 일일/주간 리셋
- `src/lib/firebase.ts` — Firebase 초기화
- `src/lib/firestore.ts` — Firestore 유저 데이터 읽기/쓰기
- `src/lib/adminFirestore.ts` — ✅ 새로 생성. 관리자 페이지용 Firestore 유틸 (published/draft/history CRUD, 변경사항 자동비교)
- `src/hooks/useAuth.ts` — Firebase Auth 훅

### 페이지
- `src/app/page.tsx` — 메인 페이지
- `src/app/ctrl-a7x9k2m/page.tsx` — ✅ 새로 생성. 관리자 페이지 (Google 화이트리스트: inchu594@gmail.com)

### 컴포넌트
- `src/components/HomeworkCard.tsx` — 숙제 카드 (showPeriodLabel로 일일/주간 배지)
- `src/components/ShopCard.tsx` — 구매/물물교환 카드 (trade schema UI 포함)
- `src/components/ScrollCard.tsx` — 임무게시판 카드
- `src/components/MemoSection.tsx` — 메모장 (체크박스/블릿, 전체선택, 전체체크)
- `src/components/CharacterTabs.tsx` — 캐릭터 탭 (수정 아이콘 분리)
- `src/components/SearchFilterBar.tsx` — 검색/필터 (스크롤타입 필터 포함)
- `src/components/MembershipBanner.tsx` — 멤버십 타이머
- `src/components/UpdateNotesModal.tsx` — 업데이트 노트

### 기타
- `public/robots.txt` — ✅ 새로 생성. /ctrl-a7x9k2m 크롤러 차단
- `.env.local` — Firebase 설정 + NEXT_PUBLIC_ADMIN_EMAIL

## 최근 완료한 작업들 (이번 세션)

### 1. export/import 즐겨찾기/체크 보존
- **계정 데이터 내보내기/가져오기**: savedItemStates 포함 ✅ (이미 정상이었음)
- **숙제 리스트 내보내기**: isFavorite, completedCount/completed 제거 ✅ (이미 정상)
- **숙제 리스트 가져오기(importPreset)**: loadPreset과 동일하게 savedItemStates 보존/복원 로직 추가 ✅ 수정됨

### 2. "필드 보스 3회" 주간 숙제 추가
- `types/index.ts` DEFAULT_HOMEWORK에 추가
- 보상: 골드 5만, 미스틱 다이스 열쇠 상자 2개, 마물 퇴치 증표 790개
- `storage.ts`에 `migrateNewDefaults()` 함수 추가 — 기존 캐릭터에 새 기본 숙제 자동 삽입

### 3. 일간/주간 배지 표시
- 모든 HomeworkCard에 `showPeriodLabel` prop 추가
- 일일=주황, 주간=초록 배지

### 4. 구매 텍스트 수정
- "성수 5개(서버)" → "성수 5개"로 변경
- `migrateRenames`에 purchaseRenames 추가

### 5. 관리자 페이지 구현 (진행 중)
- **경로**: `/ctrl-a7x9k2m` (랜덤 해시, 크롤러 차단)
- **접근 제어**: Google 계정 화이트리스트 (inchu594@gmail.com만)
- **헤더 아이콘**: UserCog (사람+톱니바퀴) — 관리자 로그인 시만 표시, 업데이트 노트 우측
- **Firestore 구조**:
  - `defaultCards/published` — 실섭 유저가 읽는 데이터
  - `defaultCards/draft` — 로컬 업로드 시 저장
  - `defaultCardsHistory/{timestamp}` — 히스토리 (14일 후 자동 삭제)
- **버튼 로직**:
  - 수정사항 없음 → 초기화/로컬업로드/실섭업로드 모두 비활성
  - 카드 수정 → 초기화+로컬업로드 활성
  - 로컬 업로드 완료 후 → 실섭 업로드 활성
- **카드 CRUD**: 4개 탭(숙제/구매/물물교환/임무게시판), 추가/수정/삭제
- **히스토리**: 날짜+변경사항 요약 자동생성, 클릭 시 롤백 확인 모달

#### ⚠️ 관리자 페이지 남은 작업
1. **앱 쪽 Firestore 소비 로직** — 아직 미구현. 현재 앱은 여전히 types/index.ts의 하드코딩 데이터만 사용. 다음 단계:
   - localhost → Firestore `draft` 우선, 없으면 `published`, 없으면 코드 폴백
   - production → Firestore `published` 우선, 없으면 코드 폴백
   - `createHomeworkForChar`, `createPurchaseForChar` 등이 Firestore defaults를 사용하도록 수정
   - `migrateNewDefaults`도 Firestore defaults 기준으로 동작하도록 수정
2. **Vercel 환경변수**: `NEXT_PUBLIC_ADMIN_EMAIL=inchu594@gmail.com` 추가 필요
3. **실섭 배포**: 아직 안 함. 사용자 확인 후 배포

## savedItemStates 시스템
캐릭터별 즐겨찾기/체크 상태를 영구 저장. 프리셋 전환/카드 삭제 시에도 보존.
```typescript
savedItemStates?: Record<string, {
  homework: Record<string, { completedCount: number; isFavorite: boolean }>;  // key: title
  purchase: Record<string, { completed: boolean; isFavorite: boolean }>;      // key: itemName
  trade: Record<string, { completed: boolean; isFavorite: boolean }>;         // key: itemName
}>;
```
- `loadPreset` / `importPreset`: 현재 상태를 savedItemStates에 저장 후, 새 프리셋 적용 시 매칭 복원
- `deleteHomework` / `deleteShopItem`: 삭제 전 savedItemStates에 저장
- `resetHomework`: savedItemStates[charId] 삭제 (완전 초기화)
- 일간/주간 리셋으로 자연 클리어

## 마이그레이션 시스템 (storage.ts)
기존 유저 데이터에 변경사항 반영:
1. `migrateShopItems` — server → region 필드 변환
2. `migrateRenames` — 숙제 타이틀 변경 + 구매 아이템명 변경 + 물물교환 스키마 파싱
3. `migrateNewDefaults` — ✅ 새 기본 숙제가 추가되었을 때 기존 캐릭터에 자동 삽입
4. `migrateIsDefault` — isDefault 플래그 ID 패턴 판별
- 호출 순서: migrateRenames → migrateNewDefaults → migrateIsDefault (loadData, applyResets 둘 다)

## 물물교환 스키마
`ShopItem`에 `fromItem`, `fromCount`, `toItem`, `toCount` 필드 추가.
- `parseTradeItemName("우유(10) -> 케이틴 특제 통밀빵(3)")` → `{ fromItem: "우유", fromCount: 10, toItem: "케이틴 특제 통밀빵", toCount: 3 }`
- UI에서 구조화된 렌더링 (ShopCard.tsx)

## 핫픽스 리스트 (사용자가 추적 요청)
1. 빛나는 동굴 클리어 → 요일 던전
2. 초기 로드 시 SERVERS 순서 기준 첫 서버 선택
3. 캐릭터 탭 수정 아이콘 분리
4. 주간 어비스 3회 → 주간 어비스 (체크박스 1개)
5. 스크롤 타입 필터 추가
6. 물물교환 스키마 + UI + 마이그레이션
7. 프리셋 즐겨찾기/체크 영구 보존 (savedItemStates)
8. 메모장 전체체크 버튼
9. 카드 삭제 시 상태 보존 + 숙제 초기화 시 클리어
10. 필드 보스 3회 주간 숙제 추가
11. 일간/주간 배지 표시
12. 성수 5개(서버) → 성수 5개

## 향후 계획
- **관리자 페이지 완성**: 앱 쪽 Firestore 소비 로직
- **v1.3.0+**: NPC 드롭다운 데이터, 아이템 계층/깊이, 검색-선택 UI
- **v1.4.0+**: 재료 자동 계산 (레시피 기반)
