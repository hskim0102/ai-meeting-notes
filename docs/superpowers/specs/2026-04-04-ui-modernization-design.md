# AI Smart Meeting Notes - UI/UX 모던화 설계

**작성일:** 2026-04-04
**목적:** 대시보드 중심 데이터 시각화 + 모션/인터랙션 강화를 통한 전반적 디자인 시스템 레벨 개선
**접근:** 점진적 리팩토링 (디자인 토큰 → 라이브러리 → 페이지별 업그레이드)
**우선순위:** 시각적 세련됨 + 사용성/생산성 모두

---

## 1. 디자인 토큰 & 스타일 시스템 리뉴얼

### 1.1 색상 시스템

현재 단순 blue/purple 조합에서 Vercel 스타일 뉴트럴 기반 + 강조색으로 전환.

**배경:**
- Light: 순백(#fff) → warm gray (#fafaf9)
- Dark: 현재 slate-900 (#0f172a) → 더 진한 zinc-950 (#09090b)

**카드:**
- Light: white + `border-slate-200` 유��
- Dark: `bg-zinc-900/80 backdrop-blur-xl border-zinc-800` 글래스 효과

**강조색:**
- Primary: 기존 blue 유지 (#3b82f6)
- 그라데이션 활용: `from-blue-500 to-violet-500` (CTA 버튼, 배너, 차트 등)
- 통계 카드 아이콘 배경에 그라데이션 적용

### 1.2 타이포그래피

- 폰트: Pretendard 유지
- Heading: `font-bold` + `tracking-tight` (letter-spacing: -0.025em)
- 숫자/통계: `tabular-nums` (font-variant-numeric) 적용으로 정렬 개선
- 본문 크기 체계 유지 (text-sm 기본)

### 1.3 컴포넌트 공통 스타일

- 카드 radius: `rounded-xl` → `rounded-2xl`
- 그림자: 기본 `shadow-sm` → hover 시 `shadow-lg` transition
- 모든 인터랙티브 요소: `transition-all duration-200 ease-out` 통일
- 포커스 링: `ring-2 ring-blue-500/50 ring-offset-2`

### 1.4 수정 대상 파일

- `src/style.css`: @theme 블록 색상 값 업데이트, 글로벌 유틸리티 클래스 추가
- 모든 컴포넌트/뷰: 새 토큰으로 클래스 교체

---

## 2. 차트 & 데이터 시각화

### 2.1 라이브러리

- **chart.js** (^4.x): 경량, 반응형, 다크모드 대응
- **vue-chartjs** (^5.x): Vue 3 Composition API 래퍼

### 2.2 대시보드 차트 (4개)

| 차트 | 유형 | 데이터 소스 |
|------|------|------------|
| 주간 회의 빈도 | Bar chart | meetings 테이블 (created_at 기준, 최근 4주, 요일별) |
| 회의 시간 분포 | Area chart | meetings 테이블 (시간대별 회의 수) |
| 키워드 트렌드 | Line chart | meetings 테이블 keywords JSON (최근 2주, 상위 5개 키워드) |
| 화자 비율 | Doughnut chart | 최근 회의 transcript의 speaker 데이터 |

**차트 공통 스타일:**
- 그리드 라인 최소화 (x축만 표시)
- 배경 투명, 카드 안에 배치
- 색상: primary blue → violet 그라데이션
- 다크모드: 축 라벨 `zinc-400`, 그리드 `zinc-800`
- 툴팁: `rounded-lg`, 그림자, 한국어 숫자 포맷
- 반응형: 모바일에서 2x2 → 1열 스택, 범례 하단 배치

### 2.3 API 엔드포인트 추가

```
GET /api/meetings/chart-data
  Response: {
    weeklyFrequency: [{week, mon, tue, wed, thu, fri}],
    hourlyDistribution: [{hour, count}],
    keywordTrend: [{date, keyword, count}],
    speakerRatio: [{speaker, totalDuration}]
  }
```

meetings 라우트에 추가. 기존 DB 쿼리로 집계.

### 2.4 회의 상세 차트

- SpeakerTimeline 컴포넌트 내에 화자별 발화 시간 비율 mini horizontal bar chart 추가
- 감정 분석(sentiment) 결과 시각 표현 개선 (텍스트 → 색상 코드 아이콘)

### 2.5 차트 래퍼 컴포넌트

`src/components/charts/` 디렉토리:
- `BarChart.vue` — 공통 bar chart 래퍼 (옵션 prop)
- `LineChart.vue` — line/area chart 래퍼
- `DoughnutChart.vue` — doughnut chart 래퍼
- `chartConfig.js` — 공통 Chart.js 설정 (다크모드, 색상, 폰트, 툴팁)

---

## 3. 모션 & 마이크로 인터랙션

### 3.1 라이브러리

- **@vueuse/motion** (^2.x): Vue 네���티브, 선언적 `v-motion` 디렉티브, 가벼움 (~5KB)

### 3.2 페이지 전환

- 목록 → 상세: 오른쪽 슬라이드 (translateX 30px + fade)
- 뒤로가기: 왼쪽 슬라이드
- duration: 250ms, ease-out
- `App.vue`의 `<router-view>` 에 `<Transition>` 컴포넌트 적용

### 3.3 리스트 애니메이션

- 회의 목록, 액션 아이템: staggered fade-in (각 항목 50ms 간격 순차 등장)
- 필터 변경 시: `<TransitionGroup>` 으로 부드러운 재배치
- 항목 삭제: fade-out + height collapse (200ms)

### 3.4 마이크로 인터랙션

| 요소 | 애니메이션 |
|------|-----------|
| 통계 숫자 | 페이지 진입 시 0 → 실제 값 카운트업 (duration 800ms, ease-out) |
| 차트 | Chart.js 기본 draw-in animation (duration 750ms) |
| 버튼 클릭 | scale(0.97) → scale(1) (100ms) |
| 토스트 알림 | 아래 → 위 슬라이드 + 자동 사라짐 |
| 탭 인디케이터 | 활성 탭으로 underline 슬라이딩 이동 (200ms) |
| 카드 hover | translateY(-2px) + shadow-lg (200ms) |
| 체크박스 완료 | strikethrough + opacity 0.5 (300ms) |

### 3.5 접근성

- `prefers-reduced-motion` 미디어 쿼리 ���중: 모션 비활성화 시 즉시 전환
- `will-change`, `transform` 기반 GPU 가속 활용
- 애니메이션 duration 최대 300ms (사용자 체감 지연 방지)

### 3.6 수정 대상

- `src/App.vue`: 라우터 뷰 전환 애니메이션
- `src/style.css`: 전역 모션 유틸리티 클래스, prefers-reduced-motion
- 각 뷰/컴포넌트: v-motion 디렉티브 추가

---

## 4. 페이지별 UX 개선

### 4.1 대시보드 (DashboardView.vue)

**레이아웃 변경:**
- 상단: 인사 배너 ("좋은 오후입니다. 오늘 회의 2건 예정") + 오늘 요약 카드
- 중단: 2x2 차트 그리드 (주간 빈도, 시간 분포, 키워드 트렌드, 화자 비율)
- 하단: 최근 회의 → 카드/테이블 뷰 토글 (기본: 테이블)

**통계 카드 개선:**
- 전주 대비 증감 표시: 화살표 아이콘 + 퍼센트 (초록: 증가, 빨강: 감소)
- 아이콘 배경: 단색 → 그라데이션
- 숫자: 카운트업 애니메이션

### 4.2 회의 목록 (MeetingsListView.vue)

- **뷰 모드 토글:** 카드 뷰 / 컴팩트 리스트 뷰 전환
- **필터 강화:** 기간 선택기 (date range, 이번 주/이번 달/커스텀), 화자 필터
- **검색 개선:** 디바운스 (300ms), 매칭 텍스트 하이라이트
- **빈 상태:** 일러스트 + "첫 회의를 기록해보세요" CTA 버튼

### 4.3 회의 상세 (MeetingDetailView.vue)

- **탭:** 기존 구조 유지, 탭 인디케이터 슬라이딩 애니메이션 추가
- **트랜스크립트:** 화자별 색상 왼쪽 border로 강화 (현재 배경색 → border-l-4 + 배경)
- **챗봇:** 탭 내 → 오른쪽 슬라이드 패널로 분리 (버튼 클릭 시 열림, 350px 너비)
- **요약 편집:** 모달 대신 inline editing (contenteditable 또는 textarea 토글)
- **화자 차트:** SpeakerTimeline 영역에 mini bar chart (화자별 발화 비율) 추가

### 4.4 액션 아이템 (ActionItemsView.vue)

- **완료 애니메이션:** 체크 시 strikethrough + fade (opacity 0.5)
- **마감일 강조:** 임��� 항목 (3일 이내) 빨간 left-border glow
- **정렬:** 드래그 앤 드롭은 복잡도 대비 효용이 낮아 제외, 기존 정렬 옵션 유지

### 4.5 새 회의록 (NewMeetingView.vue)

- 스텝 위저드 진행 표시줄: 숫자 → 아이콘 + 체크마크 애니메이션
- 녹음 중 파형(waveform) 시각화는 복잡도가 높아 이번 범위에서 제외

---

## 5. 새로 추가되는 파일

```
src/
├── components/
│   └── charts/
│       ├── BarChart.vue          # Bar chart 래퍼
│       ├── LineChart.vue         # Line/Area chart 래퍼
│       ├── DoughnutChart.vue     # Doughnut chart 래퍼
│       └── chartConfig.js        # Chart.js ���통 설정 (색상, 폰트, 다크모드)
```

## 6. 수정되는 파일

```
src/style.css                     # 디자인 토큰 업데이트, 모션 유틸리티
src/App.vue                       # 라우터 전환 애니메이션
src/views/DashboardView.vue       # 차트 그리드, 인사 배너, 통계 개선
src/views/MeetingsListView.vue    # 뷰 토글, 필터, 검색 개선
src/views/MeetingDetailView.vue   # 챗봇 패널, 탭 애니메이션, 인라인 편집
src/views/ActionItemsView.vue     # 완료 애니메이션, 마감일 강조
src/views/NewMeetingView.vue      # 스텝 위저드 아이콘화
src/components/StatCard.vue       # 증감 표시, 카운트업, 그라데이션 아이콘
src/components/MeetingCard.vue    # hover 애니메이션, 새 토큰 적용
src/components/ActionItemRow.vue  # 완료 애니메이션, 마감일 glow
src/components/SpeakerTimeline.vue # 화자 발화 비율 mini chart
src/components/MeetingChatbot.vue  # 슬라이드 패널 형태로 변경
server/routes/meetings.js         # GET /api/meetings/chart-data 추가
```

## 7. 패키지 추가

```json
{
  "dependencies": {
    "chart.js": "^4.4.0",
    "vue-chartjs": "^5.3.0",
    "@vueuse/motion": "^2.2.0"
  }
}
```

## 8. 범위 제외 (YAGNI)

- 드래그 앤 드롭 정렬 (복잡도 대비 효용 낮음)
- 녹음 파형 시각화 (별도 라이브러리 + Web Audio API 필요)
- 외부 컴포넌트 라이브러리 도입 (Tailwind + 커스텀으로 충분)
- 테마 커스터마이징 (사용자별 색상 선택 등)
- 칸반 보드 뷰 (액션 아이템)

---

## 9. 구현 순서 (권장)

1. **디자인 토큰 & 스타일** — style.css 업데이트, 공통 클래스
2. **라이브러리 설치** — chart.js, vue-chartjs, @vueuse/motion
3. **차트 컴포넌트** — 래퍼 + 공통 설정
4. **차트 API** — /api/meetings/chart-data 엔드포인트
5. **대시보드 리뉴얼** — 차트 그리드, 통계 개선, 인사 배너
6. **모션 시스템** — 라우터 전환, 리스트 stagger, 마이크로 인터랙��
7. **회의 목록 개선** — 뷰 토글, 필터, 검색
8. **회의 상세 개선** — 탭 애니메이션, 챗봇 패널, 인라인 편집
9. **액션 아이템 & 새 회의록** — 완료 애니메이션, 위저드 개선
