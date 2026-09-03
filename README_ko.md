<h1 align="center">Dev Flow</h1>

<p align="center"><strong>오래 실행되는 AI 코딩 작업을 정한 변경 범위와 테스트 한도 안에 유지하고, 이어가기 전에 현재 결과를 믿을 수 있는지 확인합니다.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 코딩 작업이 범위를 벗어나기 시작할 때

Agent에게 다음과 같이 요청했다고 가정해 보세요.

```text
로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

작업이 길어지면서 인접 설정 파일까지 바꾸려 하고, 같은 테스트가 계속 실패하며, 남은 확인을 끝내기 전에
세션이 재시작됩니다. 채팅만으로는 추가 파일이 정말 필요한지, 테스트를 얼마나 더 할 수 있는지, 다시
시도할 가치가 있는지, 예전 통과 결과가 지금 코드에도 맞는지 판단하기 어렵습니다.

Dev Flow는 이런 결정을 작업과 함께 보관합니다. Agent는 그대로 코드를 읽고 수정하고 명령을 실행하지만,
범위 확대, 추가 테스트, 반복 시도, 완료 여부는 조용히 바뀌지 않고 명확한 결정이 됩니다.

## Dev Flow가 만드는 차이

| Agent만 사용할 때 | Dev Flow를 사용할 때 |
| --- | --- |
| 파일 제한이 프롬프트에만 있음 | 예정 파일을 기록하고 지원되는 계획 밖 쓰기는 결정을 기다림 |
| “대상 테스트만”이 끝없이 늘어날 수 있음 | 자동 확인에 상한이 있고 전체 스위트는 사전 허용이 필요 |
| 같은 실패가 비슷한 수정으로 이어짐 | 세 번째 정확한 반복에서 멈추고 다른 방법이나 명시적 승인을 요구 |
| 재시작 후 불완전한 채팅으로 진행 상황을 복원 | 같은 작업, 제한, 남은 확인을 이어감 |
| 코드가 바뀌어도 예전 통과 결과를 사용 | 현재 코드와 맞지 않는 결과는 전달 전에 무효화 |

## 핵심 장점

### 작업이 몰래 커지지 않습니다

각 작업에는 예정 파일과 필요한 확인이 있습니다. 지원되는 도구가 계획 밖 파일에 쓰기 전에 멈추며, 한 번
허용, 계획 수정, 거부 중 하나를 선택합니다. 테스트와 완료 전에는 실제 변경 경로를 다시 확인합니다.

### 재시도는 새 정보를 만들어야 합니다

최근 세 번의 테스트를 비교하여 같은 실패, 같은 결과, 또는 같은 파일 변경과 실패가 정확히 반복될 때만
멈춥니다. 요구사항, 계획, 구현이 바뀌면 오래된 테스트와 개발자 확인은 더 이상 사용할 수 없습니다.

### 추측하거나 무작정 재실행하지 않고 이어갑니다

요청, 계획, 진행 상태, 확인 기록, 중단 이유는 로컬에 저장됩니다. 새 세션에서도 같은 작업을 이어가며,
작업 결과가 불확실하면 저장 내용과 현재 repository를 읽은 뒤 재시도를 결정합니다.

### 완료는 개발자가 결정합니다

테스트 통과만으로 끝나지 않습니다. 개발자가 실제 변경, 불필요한 복잡성, 유지보수 위험을 확인하고 결과를
설명하고 관리할 수 있다고 명시적으로 확인합니다. 이후 코드가 바뀌면 다시 테스트합니다.

### 로컬에서 전체 작업을 확인합니다

현재 소스의 로컬 Control Center에서 Codex와 DeepSeek 작업, 진행 상태, 예정/실제 경로, 테스트 기록,
반복 중단, 다음 결정을 볼 수 있습니다. 클라우드 대시보드가 아닙니다.

## 빠른 시작

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
/dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

## 적합한 작업

여러 세션에 걸치고, 파일 범위나 테스트 양을 제한해야 하며, 재작업이나 명확한 전달이 필요한 실제 repository
작업에 적합합니다. 일회성 질문, 설명, 상태 확인, 작은 기계적 변경은 Agent만 쓰는 편이 간단합니다.

## 현재 사용 가능한 범위

### 안정 npm `@latest`

| 제품 | 검증된 환경 |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

안정 기록은 설치, 준비 상태, 제거, 삭제, 대상 repository 불변성을 다룹니다. DeepSeek 안정 Journey는 명시적
실행, 재시작, 완료, 보관 데이터 다시 열기도 포함합니다.

### 현재 소스와 공개 기록

- 소스에는 로컬 WebUI, 파일 범위 결정, 자동 반복 중단, `darwin-arm64`와 `win32-x64`가 있습니다.
- Windows는 현재 소스 기능입니다. Windows 11 실기 기록은 있지만 안정 `@latest` Host Journey는 없습니다.
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8)은 재시작, 리팩터링, 재테스트, 이해 확인, 전달, 완료를 다룬 실제 Codex Journey입니다.

### 아직 검증되지 않았거나 안정적이지 않은 내용

- 테스트 비용, 결함률, 유지보수 비용 감소는 외부 사용으로 입증되지 않았고 장기 도입 기록도 제한적입니다.
- Linux, Windows Server, 32비트/ARM64 Windows, Intel Mac, Rosetta, remote MCP는 안정 지원 대상이 아닙니다.
- 팀 보기, 클라우드 동기화, Task 내보내기, 명시적 Host 간 인계는 향후 기능입니다.

## 경계와 문서

- Core는 Git을 읽기 전용으로 관찰하며 commit, push, merge, rebase, tag, publish를 실행하지 않습니다.
- 쓰기 전 확인은 나열된 구조화 도구만 다루며 shell 또는 파일 시스템 sandbox가 아닙니다.
- WebUI는 로컬 loopback의 단일 사용자용입니다.
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## License

[Apache License 2.0](LICENSE)
