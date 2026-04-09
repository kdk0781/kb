# 아파트 시세표 PWA — GUIDE.md

> `kdk0781.github.io/kb/map/` (운영) · `kdk0781.github.io/test/` (테스트)  
> 마지막 업데이트: 2026-04-08 · v71

---

## 파일 구조

```
kb/map/  (또는 test/)
├── index.html          # 앱 HTML 진입점
├── manifest.json       # PWA 설치 설정
├── sw.js               # 서비스워커 (Cache-First + CSV no-store)
├── GUIDE.md            # 이 파일
├── css/
│   └── common.css      # 전체 스타일 (라이트/다크 자동 대응)
├── js/
│   ├── app.js          # 난독화 빌드 (실제 서비스용)
│   └── app_src.js      # 소스 원본 (이 파일만 수정)
└── excel/
    └── map.csv         # KB 주간 아파트 시세 (매주 교체)
```

---

## 빌드 방법

```
1. app_src.js 수정
2. Node.js 빌드 스크립트 실행 → app.js 생성 (난독화)
3. index.html 의 ?v= 숫자 +1 (캐시 무효화)
4. 4개 파일 GitHub push: app_src.js / app.js / common.css / index.html
```

---

## 수정 가능 상수 (app_src.js 상단)

| 상수 | 기본값 | 설명 |
|------|--------|------|
| `APP_VERSION` | `'v9.0'` | 스플래시 버전 표시 |
| `SHARE_SECRET` | `'kdk_apt_2026_!@#'` | 공유 토큰 XOR 암호화 키 (변경 시 기존 링크 전부 무효화) |
| `SHARE_PARAM` | `'k'` | URL 파라미터명 |
| `COUNT_NS` | `'kdk-apt-map'` | 투데이 카운터 네임스페이스 |
| `SHARE_EXPIRED_MSG` | 객체 | 만료 페이지 문구 |
| `SHARE_COPY_TEMPLATE` | 함수 | 카카오/문자 공유 메시지 템플릿 |

---

## 기능 목록

### 1. CSV 파싱

- 인코딩: EUC-KR → 실패 시 UTF-8 폴백
- 상태기계 파서 `parseCSVLine()` — 홀수 따옴표에도 안전
- `cache: no-store` + SW CSV bypass → 항상 최신 데이터
- 상위 15행에서 기준일 자동 추출

### 2. 화면 구성

- 스티키 헤더 (검색 · 지역칩 · 정렬 · 단위토글)
- 카드 목록 무한스크롤 (20개씩 IntersectionObserver)
- 아코디언: 면적별 하한가 / 일반가 / 상한가
- ㎡ ↔ 평 토글 (CSS class 전환, 재렌더링 없음)
- 맨위로 버튼 (300px 초과 시 우하단)

### 3. 가격 변동

두 슬롯: `apt_map_curr` / `apt_map_prev`

| 상황 | 동작 |
|------|------|
| 새 날짜 CSV | curr → prev 승격, 새 데이터 → curr |
| 같은 날짜 재로드 | curr · prev 유지, diff 계속 표시 |
| 강제 새로고침 | SW · 브라우저 캐시만 초기화, 가격 캐시 보존 |

🔺빨강(상승) / 🔽파랑(하락) / `-` 회색(변동없음)

### 4. 대출 한도

- 기준: 하한가(1층) / 일반가(일반층)
- LTV: 규제지역 40% / 기타 70%
- 정책: ≤15억→6억 / ≤25억→4억 / 초과→2억
- 최종 = min(LTV, 정책) — 100만원 단위 절사

### 5. 규제지역 (2025.10.16 기준)

| 등급 | 지역 | LTV |
|------|------|-----|
| zone-A 투기지역 | 강남·서초·송파·용산 | 40% |
| zone-B 투기과열 | 서울 나머지 + 경기 12곳 | 40% |
| 기타 | 전국 | 70% |

### 6. 즐겨찾기

- 카드 좌측 `☆/⭐` 별표 → `apt_map_favs` localStorage 영구 저장
- ⭐즐겨찾기 칩 → 즐겨찾기 단지만 필터링
- 모바일: 별표만 표시, 텍스트 숨김

### 7. 최근 검색어

- 검색창 포커스 아웃(blur) 또는 Enter 확정 시 저장
- 2글자 이상일 때만 저장 (타이핑 중 중간 단어 제외)
- 최대 5개 (`apt_map_recent`)
- 검색창 빌 때만 칩 표시 / ✕ 개별 삭제
- 새로고침해도 유지

### 8. 투데이 방문자 카운터

- 페이지 로드 시 `countapi.dev` API로 오늘 날짜 키 카운트 +1
- 같은 브라우저 당일 중복 방지 (`localStorage['_today_hit_d-YYYYMMDD']`)
- 공유 수신자는 카운트 제외 (오너만 집계)
- 30일 이전 hit 키 자동 정리

**사용 방법**: 검색창에 `투데이` 입력 → Enter  
→ 팝업으로 오늘 방문자 수 표시

---

## 임시 공유 링크 시스템

### 전체 흐름

```
PWA 오너 (A)
  → [공유] 버튼 클릭 → 모달 열기
  → 기간 설정 (분/시간/일)
  → 즐겨찾기 기능 허용 토글 (기본: OFF)
  → [링크 생성] → TinyURL 단축 → 카카오/문자로 공유

수신자 B (링크 클릭)
  → 토큰 복호화 + 만료 검증
  → 유효: URL 정리(토큰 숨김) + 앱 실행
  → 즐겨찾기 허용 OFF: 별표·칩 UI 완전 숨김
  → 즐겨찾기 허용 ON:  별표·칩 표시, 자신의 즐겨찾기 사용
  → 최근검색: 빈 상태 시작 (세션 내 검색은 sessionStorage에만 저장)
  → [공유] 버튼 클릭 → 원본 URL 복사 (토큰 불변)

C, D, E ... (B가 공유한 링크)
  → 동일 토큰 → exp 불변 (A가 설정한 날짜에 동시 만료)
  → includeFavs 불변 (A가 설정한 기능 허용 여부)
```

### 토큰 구조

```json
{
  "exp": 1234567890123,
  "includeFavs": false
}
```

암호화: **XOR cipher + URL-safe Base64** → TinyURL 단축

### 즐겨찾기 허용 ON/OFF 비교

| 항목 | 허용 OFF (기본) | 허용 ON |
|------|---------------|---------|
| 별표 버튼 | **숨김** | 표시 |
| 즐겨찾기 칩 | **숨김** | 표시 |
| 즐겨찾기 데이터 | 없음 | 수신자 자신의 localStorage |
| 최근 검색어 | sessionStorage만 (탭 격리) | sessionStorage만 (탭 격리) |
| PWA 설치 | **차단** | **차단** |

> 오너의 즐겨찾기 · 검색어 데이터는 어떤 경우에도 수신자에게 전달되지 않습니다.

### 만료 처리 (7단계 방어)

| 단계 | 조건 | 처리 |
|------|------|------|
| 1 | `_shr_exp` LS 플래그 + 공유 세션 | 만료 페이지 |
| 2 | `_shr_blocked` SS 플래그 | 만료 페이지 |
| 3 | URL 유효 토큰 | URL 정리 + SS/LS 이중 저장 → 앱 실행 |
| 4 | URL 없음 → SS/LS 백업 복원 | 설정 복원 → 앱 실행 |
| 5 | 복호화 실패 / 만료 | URL 난독화 + 이중 차단 플래그 → 만료 페이지 |
| 6 | 새로고침 (공유 세션 유지) | 플래그 복원 → 만료 페이지 유지 |
| 7 | 오너 새 탭 접속 | `_shr_exp` 무시 (공유 세션 아님) → 정상 실행 |

**만료 후 URL 처리**:
```
만료 전: kdk0781.github.io/test/index.html?k=EEYOJxF...
만료 후: kdk0781.github.io/test/#3f7a9b2e  (index.html 숨김 + 난독화 해시)
```

### PWA 설치 차단 (공유 수신자)

- `beforeinstallprompt` 이벤트 캡처 단계 차단
- `sw.js` 등록 생략

---

## 상태 저장 키 전체 목록

| 키 | 저장소 | 오너 | 수신자 | 설명 |
|----|--------|------|--------|------|
| `apt_map_curr` | localStorage | ✅ | - | 가격 캐시 현재 |
| `apt_map_prev` | localStorage | ✅ | - | 가격 캐시 이전 |
| `apt_map_favs` | localStorage | ✅ | ✅(허용시) | 즐겨찾기 목록 |
| `apt_map_recent` | localStorage | ✅ | ❌ | 최근 검색어 |
| `_today_hit_d-YYYYMMDD` | localStorage | ✅ | ❌ | 투데이 중복 방지 |
| `_shr_ls` | localStorage | - | ✅ | 공유 토큰 백업 |
| `_shr_exp` | localStorage | - | ✅ | 만료 확정 플래그 |
| `_shr_t` | sessionStorage | - | ✅ | 공유 토큰 |
| `_shr_u` | sessionStorage | - | ✅ | 원본 공유 URL |
| `_shr_blocked` | sessionStorage | - | ✅ | 만료 차단 플래그 |
| `_shr_sess_alive` | sessionStorage | - | ✅ | 탭 생존 확인 |
| `_shr_rc_cleared` | sessionStorage | - | ✅ | 최근검색 초기화 완료 |
| `_shr_recent` | sessionStorage | - | ✅ | 수신자 최근 검색어 |

### 새로고침(버튼) 시 보존 키

**localStorage**: `apt_map_curr`, `apt_map_prev`, `apt_map_favs`, `apt_map_recent`, `_shr_ls`, `_shr_exp`  
**sessionStorage**: `_shr_t`, `_shr_u`, `_shr_blocked`, `_shr_sess_alive`, `_shr_recent`, `_shr_rc_cleared`

---

## 최근 검색어 저장 시점

타이핑 중에는 저장하지 않음:
- **Enter 키** 입력 시
- **검색창 포커스 아웃** (blur) 시
- **2글자 이상** 일 때만 저장

---

## CSV 교체 방법

```
1. KB 시스템에서 최신 시세 CSV 다운로드
2. 파일명 map.csv 저장
3. excel/map.csv 교체 후 GitHub push
4. 앱에서 새로고침 버튼 클릭
```

공유 링크 수신자도 CSV 교체 즉시 최신 데이터 자동 반영 (`no-store` fetch)

---

## 서비스워커 전략

| 대상 | 전략 |
|------|------|
| HTML / CSS / JS | Cache-First |
| `map.csv` | Network-Only (no-store) |
| 외부 도메인 | 무시 |

캐시명: `apt-price-v9` — 변경 시 구버전 자동 삭제

---

## 모바일 대응 (≤768px)

| 항목 | 처리 |
|------|------|
| 지역 칩 | 전체·서울·경기·인천만 표시 |
| 즐겨찾기 칩 | 별표만, 텍스트 숨김 |
| 공유 버튼 | 아이콘만, 텍스트 숨김 |
| 가격 범위 배지 | 숨김 |
| 카드 내부 | 면적 상단, 가격 3컬럼 풀폭 |

---

## 다크모드

`prefers-color-scheme: dark` 자동 감지. 주요 CSS 변수:

```css
--bg-color, --card-bg, --border-color
--text-main, --text-muted
--primary-color, --primary-dark
--price-color, --hover-bg
```

---

## 버전 히스토리 요약

| 버전 | 주요 변경 |
|------|---------|
| v6 | 상태기계 CSV 파서, 가격 변동 표시 |
| v7 | LTV 대출 한도 계산, 하락 이모티콘 🔽 |
| v8 | 규제지역 배지 + LTV칩, 대출 풀폭 행 |
| v9 | 즐겨찾기, 최근 검색어, 임시 공유 링크 |
| v9+ | 공유 수신자 격리, 만료 방어, 투데이 카운터 |
