# mobimobi 프로젝트 컨텍스트

## 프로젝트 개요
마비노기 모바일 MMORPG 일일/주간 숙제 트래커 웹앱.
- **스택**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **인증/DB**: Firebase Auth (Google OAuth) + Cloud Firestore
- **배포**: Vercel (GitHub main 브랜치 자동배포)
- **GitHub**: https://github.com/yesica-kim/mobi-service.git
- **Production**: https://mobi-service.vercel.app
- **Dev Preview**: https://mobi-service-git-dev-yesica-kim-s-projects.vercel.app
- **현재 버전**: v1.3.0
- **후속 작업 버전**: v1.3.0 기능 확장 후보
- **로드맵**: `docs/로드맵.md`
- **현재 로컬 경로**: `/Users/yesica-mini/Documents/Codex/mobimobi`
- **이전 폴더 백업 위치**: `/Users/yesica-mini/Documents/Codex/backup/mobi-service-backup-2026-05-26`

## 핵심 규칙
- **"실섭 배포해줘"라고 명시하기 전까지 production 배포 금지**
- 로컬 작업과 dev 브랜치/dev preview 확인을 우선
- 작은 수정은 이 프로젝트 채팅에서 바로 진행하고, 변경로그(`docs/변경로그.md`)에 필요한 항목을 기록
- 큰 작업/배포 전 점검/데이터 구조 변경은 작업지시서 또는 별도 체크리스트 기준으로 진행
- dev/production 업데이트 노트는 사용자에게 보이는 화면이므로 관리자 페이지 관련 변경사항은 노출하지 않음
- 예시카를 부를 때는 `예시카`라고 부르고, assistant 이름은 `요비`

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
- `docs/로드맵.md` — ✅ 새로 생성. 버전별 완료/예정/후보 작업 로드맵
- `public/robots.txt` — ✅ 새로 생성. /ctrl-a7x9k2m 크롤러 차단
- `.env.local` — Firebase 설정 + NEXT_PUBLIC_ADMIN_EMAIL

## 최근 완료한 작업들

### v1.2.1 관리자/기본 카드 운영
- **경로**: `/ctrl-a7x9k2m` (랜덤 해시, 크롤러 차단)
- **접근 제어**: Google 계정 화이트리스트 (`NEXT_PUBLIC_ADMIN_EMAIL`, 쉼표 구분)
- **관리자 진입**: 설정/Profile 레이어의 문의하기 아래 관리자 메뉴
- **Firestore 구조**:
  - `defaultCards/published` — 실섭 유저가 읽는 데이터
  - `defaultCards/draft` — dev 저장 시 저장
  - `defaultCardsHistory/{timestamp}` — 히스토리 (14일 후 자동 삭제)
- **카드 CRUD**: 4개 탭(숙제/구매/물물교환/임무게시판), 추가/수정/삭제
- **앱 소비 로직**:
  - localhost/dev: Firestore `draft -> published -> 코드 기본값`
  - production: Firestore `published -> 코드 기본값`

### v1.3.0 자동 백업/복구 및 동기화
- 자동 백업은 최근 15개까지 보관.
- 자동 백업은 사용자 문서 본문이 아니라 `users/{uid}/automaticBackups` 하위 컬렉션에 저장.
- 백업 기준: 기본 숙제 설정 불러오기 전, 빈 리스트로 시작 전, 저장한 리스트 불러오기 전, 백업 파일 가져오기 전, 이전 데이터 복구 전, 캐릭터 삭제 전, 체크박스 초기화 전, 캐릭터 추가 전.
- 설정 모달의 `이전 데이터 복구`에서 자동 백업 목록을 확인하고 복구 가능.
- 복구 실행 전 현재 상태도 `이전 데이터 복구 전` 사유로 자동 백업.
- 계정 데이터 가져오기는 현재 상태를 먼저 자동 백업한 뒤 앱 상태와 Firestore에 즉시 반영.
- 체크, 즐겨찾기, 정렬, 캐릭터, 멤버십, 메모장, 이전 데이터 복구는 Firestore 최신 변경 기준으로 다른 기기에 반영.
- 사용자가 관리자 기본 카드를 수정하면 해당 카드는 커스텀 카드로 전환되어 이후 관리자 기본 카드 수정/정렬에 덮어쓰이지 않음.

### v1.3.0 성능/렌더링 1차
- 초기 화면에 즉시 필요하지 않은 캐릭터/카드/설정/업데이트 노트 모달을 동적 로딩으로 분리.
- 개발/로컬 환경에서만 인증/기본 카드/사용자 데이터/정규화 단계별 로딩 시간을 콘솔 로그로 확인 가능.
- 화면 밖 카드/테이블 행에 `content-visibility: auto`를 적용해 긴 리스트 렌더링 부담을 줄임.
- 체감 개선이 없던 Firestore persistent local cache 실험은 제거.

### v1.3.2 진행중: 전체 체크 1차
- 캐릭터 전체 보기 테이블의 각 숙제 행에 `전체 체크` / `전체 해제` 버튼 추가.
- 행별 전체 체크는 현재 서버의 모든 캐릭터 칸을 한 번에 완료/해제 처리.
- 캐릭터별 보기의 전체 진행도 영역에 `전체 체크` / `전체 해제` 버튼 추가.
- 현재 탭/검색/필터에 보이는 카드만 완료/해제 처리.
- 체크/해제 전 사용자 페이지 공통 확인 모달 노출.
- 캐릭터 전체 보기의 전체 진행도 기준 일괄 체크는 후속 범위로 분리.

### v1.2.1 사용자 화면/UX
- 캐릭터 전체 보기 / 캐릭터별로 보기 전환 추가
- 캐릭터 전체 보기 PC 표형 + 모바일 카드형 UI 추가
- 카드 완료/미완료 컬러, 체크박스 컬러, 즐겨찾기 진행도 계산 개선
- 카드 수정은 브라우저 prompt가 아니라 공통 카드 수정 레이어 사용
- 기본 카드와 개인 카드 모두 수정/삭제 가능
- 신규 비로그인/최초 로그인 사용자는 빈 숙제 리스트로 시작
- 빈 상태에서 `기본 숙제 설정 불러오기` 버튼 제공
- 숙제 설정을 `현재 리스트 저장`, `저장한 리스트`, `백업/복원`, `빈 리스트로 시작`으로 정리
- 체크박스 초기화는 전체 진행도 영역으로 이동
- 구글 로그인/데이터 로딩 화면 개선
- Vercel Toolbar 프로젝트 설정 Off 처리

### 문서/배포
- `docs/현재_기획서.md`, `docs/현재_기능정의서.md`, `docs/작업현황.md`, `docs/변경로그.md` 업데이트 완료
- `docs/versions/v1.2.1/` 스냅샷 업데이트 완료
- dev와 production 업데이트 노트 레이어에 v1.2.1 내용 추가 완료
- 최신 dev 커밋: `ff51875 fix: enable admin card sorting`
- v1.2.1은 2026-05-28 기준 완료.
- v1.2.2 핫픽스는 2026-05-28 기준 완료 및 production 배포 완료.
- `docs/현재_기획서.md`, `docs/현재_기능정의서.md`, `docs/versions/v1.2.2/` 스냅샷 업데이트 완료.
- v1.2.3은 Google 계정 데이터 덮어쓰기 방지 긴급 핫픽스로 production 배포 완료.
- v1.3.0 자동 백업/복구, 동기화 보강, 성능 1차 개선은 2026-05-29 기준 production 배포 완료.
- v1.3.1 QA 안정화 및 운영 점검은 2026-06-06 기준 별도 코드 릴리즈 없이 완료 처리. 앱 표기 버전은 v1.3.0 유지.
- 이후 기능 확장은 v1.3.0 후보로 진행

### v1.2.1 후속 보정
- 캐릭터별 PC 숙제 카드 컨트롤을 한 줄 흐름으로 복원하고 세로 가운데 정렬을 보정.
- 숙제 설정 버튼 스타일, 백업/복원 아이콘, 저장한 리스트 아이콘, 진행도 영역 버튼 배치를 조정.
- 주요 모달에 `Esc` 닫기 공통 훅(`src/hooks/useEscapeClose.ts`) 적용.
- 설정 모달의 관리자 버튼을 새 창으로 열도록 변경.
- 사용자/관리자 카드 수정 아이콘 형태를 통일하고 관리자 카드 Row의 수정/삭제 아이콘을 기본 노출.
- 관리자 카드 목록에 실제 드래그 정렬을 연결하고 일간/주간, 범위, 지역, 스크롤 타입, 보상/NPC/재료 메타 표시를 사용자 화면과 유사한 배지/태그 스타일로 보정.
- 숙제/구매/물물교환/임무게시판 카드 리스트와 즐겨찾기를 모든 서버/캐릭터 공통 기준으로 동기화하고, 캐릭터/서버 탭 이동 시 현재 리스트 기준으로 재동기화.

## savedItemStates 시스템
체크 상태와 프리셋 복원용 상태를 저장한다. 즐겨찾기는 모든 서버/캐릭터 공통으로 동기화한다.
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
- **v1.3.0 후보**: 관리자 등록 기본/추천 리스트를 사용자가 선택해서 현재 리스트로 불러오는 기능
- **v1.3.2 진행중**: 캐릭터별 보기에서 현재 화면 기준 전체 체크/해제 기능
- **v1.3.0 후보**: 캐릭터 전체 보기에서 캐릭터 숙제 전체 체크 기능
- **v1.3.0 후보**: 캐릭터 전체 보기에서 카드 전체 체크 시 모든 캐릭터의 해당 카드 체크 기능
- **v1.3.0 후보**: 체크박스 완료 횟수(`1/10`) 대신 잔여 횟수 중심 표기 방식 검토
- **v1.3.0 후보**: `현재 리스트 저장` 시 즐겨찾기/체크 상태까지 저장하고 기본 카드/사용자 추가 카드의 저장-불러오기 상태 복원 정합성 개선
- **v1.3.0 후보**: 카드 보상 태그가 3개 이상이면 접어서 표시하고 펼침/접음으로 전체 태그를 확인하는 기능
- **v1.3.0 후보**: 관리자 기본 카드 실섭 반영 후 자동 추가하지 않고, 새로고침/로그인 시 신규 카드 선택 추가 모달을 제공
- **v1.3.0 후보**: `기본 숙제 카드 보기`에서 전체 기본 카드 목록을 보여주고 체크/해제로 기본 카드 노출 여부를 관리하는 기능
- **성능 후보**: 카드/테이블 리스트 가상 스크롤 적용 및 대량 카드 렌더링 최적화
- **v1.3.0+**: NPC 드롭다운 데이터, 아이템 계층/깊이, 검색-선택 UI
- **v1.4.0+**: 재료 자동 계산 (레시피 기반)
