# Gyulim Kim — personal archive

개인 소개, 공부 노트, 읽은 논문, 참여 논문, 직접 만든 사이트를 관리하는 기능 기반입니다.
현재 화면은 기능 확인용이며, 최종 디자인은 사용자의 미리캔버스 시안에 맞춰 교체할 예정입니다.
사용자의 실제 기록이나 연구 실적은 임의로 채우지 않았습니다.

## 기능

- 소개·소속·관심 분야 수정
- 공부 노트 / 읽은 논문 / 참여 논문 분류
- 기록 작성·읽기·수정·삭제, 제목·본문·날짜·태그·참고 링크
- 웹사이트 링크 추가·수정·삭제
- 관리자 키 로그인, 서명된 HttpOnly 세션 쿠키, 로그아웃
- 변경 충돌 감지, 잘못된 주소·날짜 차단, 저장 실패 시 입력 보존
- 외부 로그인 없이 방문자는 글을 읽을 수 있고 수정은 관리자만 가능

## 로컬 실행

Node.js 22.22.2 또는 24.15.0 이상의 지원 LTS 버전에서 실행합니다.

```sh
npm ci
npm run dev
```

http://127.0.0.1:4173 에서 기능을 확인합니다. 이 로컬 서버는 해당 PC에서만 접근할 수 있고 편집 모드로 열립니다. 기록은 `.local/content.json`에 저장되어 서버를 재시작해도 유지됩니다. 브라우저 저장소를 사용하지 않습니다. 로컬 파일은 Git에 포함되지 않습니다.

```sh
npm test
npm run build
```

## 디자인을 바꿀 때

`public/index.html`과 `public/styles.css`가 화면, `public/app.js`가 편집 인터페이스입니다. `src/api.mjs`는 화면과 독립적인 기능 API입니다. HTML의 ID를 유지하거나 새 UI에서 아래 API를 호출하면 디자인을 교체할 수 있습니다. 본문은 일반 텍스트이며 사용자 HTML을 실행하지 않습니다.

| 요청 | 역할 |
| --- | --- |
| GET /api/content | 소개·기록·사이트 목록 |
| GET /api/session | 관리자 로그인 상태 |
| POST /api/login | 로그인 키로 관리자 세션 시작 |
| POST /api/logout | 관리자 세션 종료 |
| PUT /api/profile | 소개 수정 |
| PUT /api/entries/:id | 기록 작성 또는 수정 |
| DELETE /api/entries/:id | 기록 삭제 |
| PUT /api/projects/:id | 사이트 링크 작성 또는 수정 |
| DELETE /api/projects/:id | 사이트 링크 삭제 |

변경 요청은 JSON과 `X-Archive-Request: 1` 헤더를 사용합니다. 수정·삭제에는 읽어 온 항목의 `revision`을 그대로 전달합니다. 새 항목은 클라이언트가 UUID를 생성합니다. 다른 기기의 변경과 충돌하면 409로 거절하여 내용을 덮어쓰지 않습니다.

## Vercel 배포 연결 — 아직 배포하지 않음

기능 준비 단계입니다. 실제 운영 저장소와 관리자 비밀값은 배포 시 연결해야 합니다.

1. Vercel에서 이 GitHub 저장소를 가져옵니다. Framework는 Other이고 `vercel.json` 설정을 사용합니다.
2. 해당 프로젝트에 **Private Vercel Blob** 저장소를 연결합니다. `BLOB_READ_WRITE_TOKEN` 환경변수가 필요합니다.
3. `npm run setup:admin`으로 강한 무작위 관리자 키를 생성합니다. `.local/admin-credentials.json`에만 저장되고 Git에는 올라가지 않습니다. 기존 파일을 덮어쓰지 않습니다.
4. 그 파일의 `ADMIN_KEY_HASH`, `SESSION_SECRET`을 Vercel의 비밀 환경변수로 추가합니다. `loginKey`는 사이트 하단 관리자 로그인에서 본인만 사용합니다.
5. 배포합니다. 비밀값이 없으면 관리자 기능은 잠긴 상태로 유지됩니다. 운영 코드에서는 로컬 편집 우회가 활성화되지 않습니다.

운영 데이터는 Private Blob의 `personal-archive/content.json`에 저장됩니다. 서버에서 읽기·쓰기하고 ETag 조건부 저장으로 동시 수정 충돌을 막습니다. Vercel 함수의 임시 파일시스템에는 사용자 기록을 저장하지 않습니다. 서버 전용 키는 클라이언트에 제공되지 않습니다.

현재 검증 범위: 로컬 파일 영속성, API·인증·편집 폼 DOM 통합 테스트 9개, 클라이언트 구문 검사. 실제 브라우저 시각 검증은 최종 디자인 반영 시 진행합니다. 실제 Vercel/Blob 연결 검증은 배포 시 진행합니다.
