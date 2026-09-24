# Gyulim Kim — personal archive

사용자의 미리캔버스 시안을 바탕으로 만든 개인 홈페이지입니다. 실제 기록·서재·이력은 사용자가 직접 입력합니다. Vercel은 GitHub main 변경을 자동 배포합니다. 운영 저장소는 Supabase를 사용합니다.

## 화면과 기능

- `/`: 원본 토끼·아이콘을 활용한 메인. 링의 모양은 고정하고 메뉴만 드래그, 터치, 휠, 좌우 버튼과 방향키로 이동합니다. 검은 곡선의 길이를 따라 같은 간격과 속도를 유지하고, 곡선의 끝에서 반대편 끝으로 이어집니다. 원래 DEV가 있던 왼쪽 구간에서는 현재 메뉴의 글자를 왼쪽 위에 표시합니다. 클릭과 드래그를 구분합니다.
- 메인 오른쪽에는 기본 **최신순 5개**를 표시합니다. RECENT / OLDEST / TITLE에서 최신순·오래된순·제목순을 선택할 수 있고 선택한 순서를 브라우저에 기억합니다. 전체 기록을 정렬한 뒤 최대 다섯 개를 보여 줍니다. 같은 날짜는 생성 시각으로 정렬합니다. 고정 높이 영역 안에서 스크롤하며 검색은 전체 아카이브에서 찾습니다.
- 토끼를 누르거나 누른 채 쓰다듬으면 토끼 그림은 고정된 채 검은 윤곽선 꽃잎이 위로 날립니다. **누르는 동안만 횟수가 표시**됩니다. 횟수는 해당 브라우저의 localStorage에 저장하며 사이트 전체 합산은 아닙니다. 키보드 Space/Enter도 지원합니다.
- `/about`: 자기소개, 소속, 프로필 사진 주소 편집.
- `/library`: 책장 UI. Paper / Article / Book 및 Study / Leisure 분류, 제목·저자·감상평·태그 검색. 책을 클릭하면 짧은 감상평, 원문 링크, 연결된 아카이브 글이 열립니다.
- `/interests`: 계층형 마인드맵. 관심사·상위 관심사·설명·연결된 아카이브 글을 편집합니다. 연결된 글에서도 서재와 관심사로 돌아갈 수 있습니다.
- `/dev`: 만든 사이트 링크 추가·수정·삭제.
- `/cv`: Education / Research / Experience / Awards / Skills 이력 항목, 기간, 역할, 설명, 순서, 관련 링크. 참여 논문 기록도 연결됩니다. 인쇄·PDF 저장용 스타일이 있습니다.
- `/archive`: 공부, 읽기 기록, 참여 논문, 생각, 일상을 날짜순으로 보여 주는 블로그 목록. 기록 작성·읽기·수정·삭제, 날짜·태그·참고 링크 지원.
- 관리자 키 로그인, 서명된 HttpOnly 세션, 변경 충돌 감지, 저장 실패 시 입력 보존.
- 방문자는 읽기만 가능하며 변경과 AI 웹 검색은 관리자만 가능합니다.

기존 데이터에는 새 컬렉션을 자동으로 보완합니다. 예전 `reading` 기록은 서재에서도 접근할 수 있습니다. 아카이브 글 삭제 시 서재·관심사의 연결을 정리하며, 관심사 삭제 시 하위 항목은 한 단계 위로 옮깁니다.

## 로컬 실행

Node.js 22.22.2 또는 24.15.0 이상의 지원 버전에서 실행합니다.

```sh
npm ci
npm run dev
```

[로컬 미리보기](http://127.0.0.1:4173/)는 해당 PC에서만 접근할 수 있으며 자동 편집 모드입니다. 콘텐츠는 `.local/content.json`에 저장됩니다. `.local`, `.env.local`, 관리자 키는 Git에 포함되지 않습니다. 기본 서버는 AI 키가 없는 상태로도 나머지 기능을 사용할 수 있습니다.

```sh
npm test
npm run build
```

## AI 웹 추천 연결

서재 하단의 `AI로 새로운 읽을거리 찾기`는 OpenAI Responses API의 웹 검색 도구를 사용합니다. 추천에 출처를 표시하고, 웹 검색에서 반환된 출처 URL과 일치하는 결과만 노출합니다. 추천 결과의 제목·저자·링크를 서재 입력 폼으로 가져올 수 있으며 **감상평은 사용자가 직접 씁니다**.

기본값은 비활성화입니다. 현재 저장소에 API 키가 없으므로 실제 유료 요청은 실행하지 않았습니다. 연결 시 모델·웹 검색 사용료가 별도로 발생합니다. [공식 웹 검색 문서](https://developers.openai.com/api/docs/guides/tools-web-search), [공식 요금 안내](https://developers.openai.com/api/docs/pricing)를 참고하세요.

서버 환경변수 또는 로컬의 무시되는 `.env.local`에 다음 값을 설정합니다. 키를 HTML, 브라우저 코드, Git 저장소에 넣지 않습니다.

```dotenv
OPENAI_API_KEY=본인의_API_키
AI_SEARCH_ENABLED=true
OPENAI_SEARCH_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=20
```

기본 하루 20회(UTC 기준), 요청 간 10초, 요청당 최대 2회 도구 호출·2,500 출력 토큰을 제한합니다. 사용 횟수는 저장소에서 원자적으로 예약하여 여러 서버에서도 제한을 공유합니다. 실패한 검색도 예약 횟수에 포함됩니다. 횟수 제한은 금액 한도가 아니므로 API 계정의 사용 한도도 별도로 설정합니다. 웹 검색 결과는 자동으로 게시하거나 저장하지 않습니다.

실제 운영 API 호출은 키 연결 후 검증해야 합니다. 현재는 모의 응답으로 인증·미설정·출처 검사·일일 제한·결과 표시를 검증합니다.

## Vercel · Supabase 운영 연결

[운영 사이트](https://gyulimkim2005.vercel.app/)는 GitHub main 브랜치와 연결되어 자동 배포됩니다.

1. Supabase SQL Editor에서 `supabase/migrations/202609250001_personal_archive.sql`을 실행합니다.
2. Vercel 서버 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`에 프로젝트 URL과 기존 secret key를 연결합니다. 이 키는 브라우저나 Git에 넣지 않습니다.
3. `npm run setup:admin`으로 관리자 키를 생성합니다. 무시되는 `.local/admin-credentials.json`에만 저장됩니다.
4. 그 파일의 `ADMIN_KEY_HASH`, `SESSION_SECRET`을 Vercel 서버 환경변수에 추가하고 재배포합니다. `loginKey`로 사이트 하단에서 로그인합니다.
5. AI 검색은 사용자가 유료 API 연결을 정한 뒤 별도로 켭니다.

운영 콘텐츠는 RLS가 켜진 `public.personal_archive`의 단일 JSON 행에 저장합니다. 익명/일반 인증 사용자의 직접 접근은 차단하고 서버의 service_role만 읽기·삽입·수정을 허용합니다. revision 조건부 UPDATE와 PK 제약으로 동시 저장 충돌을 감지합니다. 공개 API에서는 AI 사용량을 제외하고 표시용 콘텐츠만 반환합니다.

메인은 원본 16:9 캔버스의 좌표로 배치하고 화면에 맞춰 균일하게 축소합니다. 최근 기록은 최대 다섯 개이며, 빈칸·로딩·오류 상태에도 다섯 프레임을 유지합니다. 모바일은 세로 배치와 별도 스크롤 영역을 사용합니다.

## 코드와 데이터

- `public/index.html`, `styles.css`: 메인과 내부 페이지. 메인에 쓰인 `assets/miricanvas-home.png`는 사용자가 제공한 원본입니다. SVG viewBox와 브라우저 필터로 필요한 그림을 보여 줍니다.
- `public/app.js`: 경로 이동, 로그인, 공통 글쓰기와 읽기, 최근 글.
- `public/orbit.js`, `rabbit.js`: 궤도 조작과 쓰다듬기.
- `public/spaces.js`: 서재, 마인드맵, 이력서, AI 검색 UI.
- `src/api.mjs`, `auth.mjs`, `store.mjs`: 인증, 검증, 영속 저장.
- `src/discovery.mjs`: 관리자 전용 웹 추천, 출처 검사와 사용량 제한.

| 요청 | 역할 |
| --- | --- |
| GET /api/content | 소개·기록·사이트·서재·관심사·이력 |
| GET /api/session | 관리자 상태와 AI 준비 여부 |
| POST /api/login, /api/logout | 로그인·로그아웃 |
| PUT /api/profile | 소개 수정 |
| PUT, DELETE /api/entries/:id | 아카이브 글 |
| PUT, DELETE /api/projects/:id | 만든 사이트 |
| PUT, DELETE /api/library/:id | 서재 |
| PUT, DELETE /api/topics/:id | 마인드맵 관심사 |
| PUT, DELETE /api/cvitems/:id | 이력서 항목 |
| POST /api/discover | AI 웹 검색 추천 |

변경 요청은 JSON과 `X-Archive-Request: 1` 헤더를 사용합니다. 수정·삭제는 읽어 온 `revision`을 전달하고, 충돌은 409로 거절합니다. 본문은 일반 텍스트이며 사용자 HTML을 실행하지 않습니다.

현재 검증: API·인증·저장·편집·연결·AI 제어·토끼·궤도 자동 테스트, JS 구문 검사, PC·모바일 브라우저 점검. 운영 Vercel/Blob 및 실제 AI 호출 검증은 연결 후 진행해야 합니다.
