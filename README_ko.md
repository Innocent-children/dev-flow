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

저장소 조사와 코드 인덱스 도구 선택은 현재 사용자 지시와 적용되는 `AGENTS.md`를 따릅니다.
해당 지시가 프로젝트 인덱스 확인을 요구하면 Host는 사용자 확인 전에 후보 저장소를 읽기 전용으로
조사한 뒤, 확인된 범위를 Task에 고정합니다. 해당 지시는 플러그인의 코드 인덱스 설정보다 우선합니다.

- **범위를 명확하게 유지합니다.** 예정 경로를 기록하고, 지원되는 구조화 도구가 계획 밖 파일에 쓰기
  전에 확인하며, 테스트와 전달 전에 실제 변경을 다시 대조합니다.
- **worktree마다 변경 소유자가 하나입니다.** Core는 전용 worktree의 Git 상태에서 Task의 실제 변경 사항을
  계산합니다. 정상적인 선형 commit은 계속할 수 있지만 branch rewrite나 worktree 교체는 작업을 멈춥니다.
- **검증량을 작업에 맞춥니다.** TASKS에서 확인 항목, 이유, 초기 투입량, 전체 스위트와 테스트 코드
  예상을 저장합니다. 구체적인 새 영향, 위험, 실패 또는 검증 공백이 있을 때만 예산을 늘립니다.
- **검토를 현재 변경에 한정합니다.** 변경 후에는 diff, 인과 영향, 인수 조건만 확인하고 수정 후에는
  관련 항목만 다시 확인합니다. 명시적 code review는 읽기 전용입니다.
- **재시작 후에도 이어갑니다.** 새 세션에서 같은 작업, 남은 확인, 현재 결정을 복원하므로 채팅에서
  진행 상황을 다시 만들 필요가 없습니다.
- **현재도 유효한 결과만 사용합니다.** 요청, 계획, 구현 또는 저장소가 바뀌면 오래된 확인을 무효화하고,
  전달 전에 개발자가 실제 결과를 검토합니다.
- **완료 결과와 복구 상태를 확인할 수 있습니다.** Core는 계획된 모든 작업의 완료와 각 인수 조건에 연결된 현재 유효한 검증을 확인합니다. WebUI가 중단되어도 Core에 저장된 제출 내용을 복구할 수 있습니다.

## 파일 제출 준비

Codex는 제출 전에 `dev-flow-codex artifacts collect`와 `dev-flow-codex artifacts prepare`를 실행합니다. Core가 현재 Action의 모든 변경을 수집하고 Codex가 각 파일을 분류하면 명령이 artifact 배열을 생성합니다. 누락된 파일에는 정확한 경로와 허용 범위가 제한된 수정 지침을 반환합니다. 작업 트리, 이력 및 노드 권한 검사는 계속 적용됩니다. [파일 수집 및 제출](docs/ARTIFACTS_en.md)을 참고하세요.

## 빠른 시작

> npm의 `@latest`로 공개된 안정 버전은 현재 macOS arm64에서 검증되었습니다. Node.js `>=24`와 지원되는 Codex 또는
> DeepSeek Harness를 먼저 설치하세요. 정확한 버전과 다른 환경의 상태는
> [Support Matrix](docs/SUPPORT-MATRIX_en.md)를 확인하세요.

### 1. Dev Flow 설치하기

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

수명 주기 메뉴는 Adapter 설치 상태를 표시하며 뒤로 가기, 종료, 잘못된 입력 재시도와 Control Center 열기를 지원합니다. 확인 전에 버전 변경과 리소스 경로를 표시합니다. `install`, `repair`, `reinstall`은 기본적으로 설치된 버전을 유지하며 `upgrade`는 `latest`를 선택합니다. 정상 설치에 대한 반복 설치/복구, 이미 대상 버전인 업데이트, 완료된 제거는 변경 없이 끝납니다. `reinstall`은 패키지를 다시 교체합니다. `doctor`는 실패한 검사와 해결 명령을 표시합니다. 옵션은 `dev-flow repair --help`를 참고하세요. JSON 모드에서는 질문하지 않습니다. 이 명령들은 Adapter를 관리하며 공통 실행기는 `npm install -g @imotong/dev-flow@latest`로 업데이트합니다.

대화형 설정에서 Codex, DeepSeek 또는 둘 다 선택합니다. 첫 작업을 시작하기 전에 설치 프로그램이
안내하는 마무리 단계도 완료하세요.

- **Codex:** `/hooks`를 열어 Dev Flow에 포함된 hook을 검토하고 신뢰하세요. 신뢰하기 전에는 지원되는
  `apply_patch` 쓰기 전 확인이 동작하지 않습니다.
- **DeepSeek Harness:** 설치 후 선택한 DSH Profile을 다시 시작하세요.

현재 소스의 Adapter에는 DSH `>=0.1.2-rc.1`이 필요합니다. 각 Dev Flow 작업은 현재 사용자가 직접 입력한 승인을 확인합니다.

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

새 Codex 세션을 시작하기 전에 원래 세션은 이번 요구 사항에 관한 논의 원문과 구조화된 인계 자료를 저장하고, 확정된 요구 사항, 채택되지 않은 제안, 미해결 질문을 구분합니다. 데스크톱 새 작업과 CLI 재시작은 같은 저장 자료를 사용하며, 긴 내용은 잘라내지 않고 전체 파일로 전달합니다. [아키텍처](docs/ARCHITECTURE_en.md#codex-requirements-handoff)를 참고하세요.

### 3. 이어서 진행하고 상태 확인하기

세션이 재시작되면 Task에 연결된 원래 worktree에서 해당 작업을 계속하도록 명시적으로 요청하세요.
시스템은 원래 worktree를 확인하고 저장된 작업 상태에서 처리를 이어갑니다. 요청을 다시 평가하거나
Dev Flow를 사용할지 다시 선택할 필요는 없습니다. 원래 worktree가 없어지거나 교체되면 이를 복원하거나
작업을 명시적으로 포기(abandon)할 때까지 Task가 일시 중지됩니다. 시스템은 다른 worktree로 전환하지 않습니다.

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

## 데스크톱 펫（macOS arm64）

로컬 펫 패키지는 기본 외형을 유지합니다. 고래 소녀 등 사용자 지정 외형은 별도 리소스 패키지로 가져오며, 앱을 업데이트해도 가져온 리소스는 유지됩니다.

데스크톱 펫은 `DevFlowPet.app`을 포함한 macOS arm64용 로컬 개발 패키지로 사용할 수 있습니다. 일반 npm 파일 목록과 정식 릴리스 준비에는 네이티브 앱이 포함되지 않습니다. 빌드된 패키지를 실행할 때 Swift/Xcode는 필요하지 않으며, 설정된 Codex 또는 DeepSeek Adapter가 Core를 제공합니다. 펫은 한 Task의 저장된 상태와 해당 WebUI를 보여 주며 Host의 실시간 활동이나 완료율을 추정하지 않습니다. 종료해도 Task와 WebUI는 유지됩니다.

정적 PNG/SVG, PNG/SVG 네이티브 애니메이션 팩, Codex 표준 형식 1/2 아틀라스를 가져올 수 있습니다. 네이티브 팩에는 5가지 작업 동작이 필요하며 4가지 동작을 추가할 수 있습니다. Codex 아틀라스는 9가지 동작과 57프레임을 추출합니다. Dev Flow 자체 고해상도 확장을 Codex에서도 사용하려면 표준 크기 아틀라스를 따로 준비해야 합니다. 제공된 소재에 따라 대기 중 걷기, 손 흔들기, 생각하기가 동작합니다. 대기 활동은 따로 끌 수 있으며 작업 알림이 우선합니다. 프로그램 업데이트와 소재 다시 가져오기는 별도 작업입니다.

메뉴 막대에는 Dev Flow의 곡선 로고를 사용한 단색 아이콘이 표시되며, 시스템 모양에 맞춰 색상이 바뀝니다. 펫 크기는 50%~200%의 6단계로 조절할 수 있고 말풍선 글자 크기는 유지됩니다. 기본 모습은 9가지 동작, 312개의 SVG 프레임을 담은 별도 소재 팩으로 포함됩니다.

선택된 작업이 없으면 펫은 새 작업을 계속 찾습니다. 가장 최근에 업데이트된 차단된 작업을 우선 선택하고, 없으면 가장 최근에 업데이트된 진행 중인 작업을 선택합니다. 선택 후에는 사용자가 직접 변경할 때까지 같은 작업을 표시합니다.

앱 받기, 설치와 업데이트, 동작 조건, 제한 및 문제 해결은 [데스크톱 펫 안내](docs/DESKTOP-PETS_en.md)를 참고하세요. 공개 지원 범위는 지원 표를 따릅니다.

```bash
dev-flow pet start
dev-flow pet stop
```

## 문서

- **사용 방법:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **프로젝트:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## 라이선스

[Apache License 2.0](LICENSE)

## Windows 데스크톱 지원

Windows 10/11 x64는 Intel 또는 AMD 64비트 프로세서를 사용하는 일반 데스크톱 PC를 대상으로 합니다. Host의 경로, 권한, 명령 및 정리 규칙은 `platform/windows/`와 `platform/macos/`로 분리하며, Core는 플랫폼에 독립적인 작업 의미 규칙을 공유합니다. Windows 명령 실행기는 UTF-8을 사용하고 Core의 Git 관찰은 콘솔 창을 숨깁니다. Windows 실기기 검증 결과와 한계는 [적용 보고서](docs/WINDOWS-ADAPTATION_en.md)를 참조하세요. 이 결과로 안정 패키지의 지원 범위를 확대하지 않습니다.

Windows에서도 데스크톱 펫을 제공합니다. 작업 선택과 상태 말풍선, 트레이 메뉴, PNG/SVG 외형, 네이티브 애니메이션, Codex PNG/WebP 아틀라스, 9가지 동작, 드래그, 6단계 크기, 숨기기와 복원, 개별 시작과 종료를 지원합니다. `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"`로 Windows 로컬 패키지를 빌드합니다. 의존성 준비와 설치는 [데스크톱 펫 가이드](docs/DESKTOP-PETS_en.md)를 참조하세요. Windows와 macOS 데스크톱 구현은 서로 독립적입니다.
Windows에서 크기를 변경하면 현재 대기 동작을 종료하고 정상적인 동작 스케줄로 돌아갑니다.

Windows에서는 패키지형 데스크톱 호스트가 제공하는 디렉터리 별칭을 포함하여 기존 AppData 디렉터리의 실제 경로를 확인합니다. 심볼릭 링크는 계속 거부합니다.

현재 Windows 개발 패키지에는 두 Adapter 패키지와 데스크톱 앱이 포함됩니다. 실행기 패키지를 설치한 뒤 `dev-flow install --host all --yes`와 `dev-flow pet start`를 사용합니다. 복구와 재설치도 같은 진입점에서 수행하며, 내장 패키지 해시를 검증하고 앱을 갱신하면서 Task 데이터, 설정, 외형을 보존합니다.

`dev-flow-codex host-launch <operation>`은 stdin 스트림에서 최대 1 MiB의 UTF-8 JSON 객체를 읽으며, 청크 입력과 청크 경계에 걸친 멀티바이트 문자를 지원합니다. 읽기 실패, 잘못된 UTF-8, 중복 멤버, 잘못된 JSON, 배열 및 null은 작업 실행 전에 거부됩니다. 오류는 stderr로, 성공한 JSON 결과는 stdout으로 출력됩니다.

## 명령어 도움말과 작업 재개

Codex 명령어 도움말에서 작업 트리 작업의 매개변수, 반환 필드, 다음 단계를 확인할 수 있습니다. 모든 저장소 준비가 끝나면 Host가 저장된 작업 트리 범위를 취합합니다. MCP 결과 Schema는 Task와 Action을 읽을 위치를 설명하며, 세션을 재개할 때는 미완료 제출을 먼저 처리합니다.

```bash
dev-flow-codex --help
dev-flow-codex host-launch prepare --help
```

매개변수와 복구 규칙은 [명령어 참조](docs/COMMANDS_en.md)를 확인하세요.
