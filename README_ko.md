<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 아이콘" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>긴 AI 코딩 작업의 변경 범위, 검증 한도, 현재 진행 상황을 세션이 바뀌어도 그대로 유지합니다.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 긴 작업이 조용히 범위를 벗어나지 않도록

코딩 작업이 길어질수록 조금씩 다른 모습으로 변하기 쉽습니다. 변경 파일이 늘어나고, 대상 확인이
끝없는 테스트가 되며, 같은 실패에 비슷한 시도를 반복하거나 세션 재시작 후 채팅 기록에서 진행 상황을
다시 조립해야 합니다.

Dev Flow는 합의한 요청, 예정 경로, 분석 후 만든 검증 계획, 현재 단계, 결과를 하나의 로컬 작업으로 저장합니다.
코드 변경은 계속 Codex 또는 DeepSeek가 수행합니다.

모든 새 요청은 Dev Flow를 선택하기 전에 읽기 전용으로 평가됩니다. 사용하기로 선택하면 remote,
base branch, 새 task branch를 확인하고, Host가 해당 원격 기준에서 깨끗한 전용 worktree를 만든 뒤에야
Core가 Task를 생성합니다. 원본 checkout의 기존 변경은 복사되지 않습니다.

- **범위를 명확하게 유지합니다.** 예정 경로를 기록하고, 지원되는 구조화 도구가 계획 밖 파일에 쓰기
  전에 확인하며, 테스트와 전달 전에 실제 변경을 다시 대조합니다.
- **worktree마다 변경 소유자가 하나입니다.** Core는 전용 worktree의 Git 상태에서 현재 Task surface를
  계산합니다. 정상적인 선형 commit은 계속할 수 있지만 branch rewrite나 worktree 교체는 작업을 멈춥니다.
- **검증량을 작업에 맞춥니다.** TASKS에서 확인 항목, 이유, 초기 투입량, 전체 스위트와 테스트 코드
  예상을 저장합니다. 구체적인 새 영향, 위험, 실패 또는 검증 공백이 있을 때만 예산을 늘립니다.
- **검토를 현재 변경에 한정합니다.** 변경 후에는 diff, 인과 영향, 인수 조건만 확인하고 수정 후에는
  관련 항목만 다시 확인합니다. 명시적 code review는 읽기 전용입니다.
- **재시작 후에도 이어갑니다.** 새 세션에서 같은 작업, 남은 확인, 현재 결정을 복원하므로 채팅에서
  진행 상황을 다시 만들 필요가 없습니다.
- **현재도 유효한 결과만 사용합니다.** 요청, 계획, 구현 또는 저장소가 바뀌면 오래된 확인을 무효화하고,
  전달 전에 개발자가 실제 결과를 검토합니다.

## 빠른 시작

> npm의 `@latest`로 공개된 안정 버전은 현재 macOS arm64에서 검증되었습니다. Node.js `>=24`와 지원되는 Codex 또는
> DeepSeek Harness를 먼저 설치하세요. 정확한 버전과 다른 환경의 상태는
> [Support Matrix](docs/SUPPORT-MATRIX_en.md)를 확인하세요.

### 1. Dev Flow 설치하기

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

대화형 설정에서 Codex, DeepSeek 또는 둘 다 선택합니다. 첫 작업을 시작하기 전에 설치 프로그램이
안내하는 마무리 단계도 완료하세요.

- **Codex:** `/hooks`를 열어 Dev Flow에 포함된 hook을 검토하고 신뢰하세요. 신뢰하기 전에는 지원되는
  `apply_patch` 쓰기 전 확인이 동작하지 않습니다.
- **DeepSeek Harness:** 설치 후 선택한 DSH Profile을 다시 시작하세요.

### 2. 작업 시작하기

**Codex**에서는 다음 내용을 사용자 메시지로 보냅니다.

```text
$dev-flow-codex:dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

**DeepSeek Harness**에서는 다음을 보냅니다.

```text
/dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

이는 shell 명령이 아니라 대화 selector입니다. 목표, 인수 조건, 파일 범위, 테스트 한도를 최대한
구체적으로 작성하세요. 첫 응답은 영향 범위를 평가하고 직접 개발할지 Dev Flow를 사용할지 묻습니다.
명시적 selector도 이 선택을 건너뛰지 않습니다. Dev Flow를 선택하면 remote, base, target branch를
확인합니다. Codex는 Host가 지원할 때 managed worktree를 열고, DeepSeek는 현재 세션의 Workspace Root가
고정되어 있으므로 새 worktree에서 다시 시작하는 방법을 제공합니다.

### 3. 이어서 진행하고 상태 확인하기

세션이 재시작되면 Task에 연결된 원래 worktree로 돌아가 명시적으로 재개를 요청하세요. 재개는 진입
평가를 반복하거나 대체 worktree를 고르지 않습니다. 원래 인스턴스가 없어지거나 교체되면 복원하거나
명시적으로 abandon할 때까지 Task가 중지됩니다.

```bash
# 설치된 연동 상태 확인
dev-flow status --host all

# 로컬 작업 화면 열기
dev-flow webui start
```

비대화형 설치, 사용자 지정 DSH Profile, 업그레이드, 복구, 제거는
[Command Reference](docs/COMMANDS_en.md)를 참고하세요.

## 적합한 작업

Dev Flow는 여러 세션에 걸치거나, 파일 범위와 테스트 양을 명확히 제한해야 하거나, 재작업 때 오래된
결과를 다시 사용하면 안 되는 저장소 작업에 적합합니다.

일회성 질문, 코드 설명, 상태 확인, 진행 상황을 저장할 필요가 없는 작은 기계적 변경은 Codex나
DeepSeek를 직접 사용하는 편이 더 간단합니다.

## 문서

- **사용 방법:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **프로젝트:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## 라이선스

[Apache License 2.0](LICENSE)
