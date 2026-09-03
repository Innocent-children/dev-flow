<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 아이콘" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>오래 실행되는 AI 코딩 작업을 정한 변경 범위와 테스트 한도 안에 유지합니다.</strong></p>

<p align="center">Codex와 DeepSeek를 위한 로컬 가드레일, 지속되는 진행 상태, 안전한 복구.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="안정 플랫폼: macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#빠른-시작">빠른 시작</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#문서">문서</a>
</p>

## 승인한 범위 안에서 작업 유지

긴 코딩 작업은 한순간에 실패하기보다 조금씩 벗어납니다. 계획 밖 파일 하나가 세 개로 늘고, 대상 확인이
끝없는 테스트가 되며, 같은 실패가 비슷한 수정으로 이어지거나 재시작한 세션이 불완전한 채팅 기록에서
진행 상황을 다시 만들어야 합니다.

Dev Flow는 합의한 요청, 예정 경로, 검증 예산, 현재 단계, 결과를 로컬 Task에 저장합니다. Codex 또는
DeepSeek가 계속 코드를 읽고 파일을 수정하고 명령을 실행하며, Dev Flow는 범위 변경, 반복 시도, 복구,
전달을 눈에 보이는 명시적 결정으로 만듭니다.

## 통제하는 항목

| 항목 | Dev Flow의 동작 |
| --- | --- |
| **변경 범위** | 예정 경로를 기록하고, 지원되는 계획 밖 쓰기를 멈추며, 테스트와 완료 전에 누적 변경 경로를 다시 확인합니다. |
| **검증 비용** | 명령 예산을 보관하고, 전체 스위트에 사전 허용을 요구하며, 같은 실패나 변화 없는 결과가 세 번째 정확히 반복되면 멈춥니다. |
| **지속되는 진행 상태** | Task를 채팅 밖에 저장해 새 세션에서도 같은 단계, 제한, 기록, Blocker를 이어갑니다. |
| **현재도 유효한 결과** | 요청, 계획, 구현 또는 repository가 바뀌면 더 이상 맞지 않는 테스트와 이해 확인을 무효화합니다. |
| **개발자 확인** | 전달 전에 실제 변경, 불필요한 복잡성, 유지보수 위험을 개발자가 확인하도록 합니다. |

## 빠른 시작

> 안정 npm `@latest`는 현재 macOS arm64에서 검증되었습니다. Host Adapter에는 Node.js `>=24`가
> 필요합니다. 다른 환경에 설치하기 전에 [Support Matrix](docs/SUPPORT-MATRIX_en.md)를 확인하세요.

### 1. 설치하고 Host 연결하기

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

대화형 설정에서 Codex, DeepSeek 또는 둘 다에 Dev Flow를 설치할 수 있습니다. 이후에도 같은 진입점에서
상태 확인, 진단, 업그레이드, 복구, 제거를 실행할 수 있습니다.

### 2. 범위가 정해진 Task 시작하기

**Codex**에서는 다음 내용을 사용자 메시지로 보냅니다.

```text
$dev-flow-codex:dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

**DeepSeek Harness**에서는 다음을 보냅니다.

```text
/dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

이는 shell 명령이 아니라 대화 selector입니다. 목표, 인수 조건, 파일 범위, 테스트 한도를 최대한 구체적으로
작성하세요.

### 3. 이어서 하거나 확인하기

세션이 재시작되면 Task에 참여하는 repository로 돌아가 같은 Host selector를 다시 사용하세요. Dev Flow는
저장된 Task를 읽고 채팅에서 진행 상황을 재구성하지 않고 현재 단계부터 이어갑니다.

```bash
# Adapter 상태를 읽기 전용으로 확인
dev-flow status --host all

# 로컬 Control Center 열기
dev-flow webui start
```

Control Center에는 현재 단계, 예정/실제 경로, 확인 기록, Blocker, 복구 안내, 다음 결정이 표시됩니다.
Codex, DeepSeek, 화면은 모두 같은 로컬 Task 데이터를 읽습니다.

비대화형 설정, Host 기본 명령, 사용자 지정 DeepSeek Profile, 업그레이드, 제거는
[Command Reference](docs/COMMANDS_en.md)를 참고하세요.

## Task 진행 중 동작

1. **범위를 정합니다.** Task에 요청, 참여 repository, 예정 경로, 작업 항목, 검증 예산을 저장합니다.
2. **Host가 작업합니다.** Codex 또는 DeepSeek가 코드를 변경하고, 지원되는 구조화 파일 도구는 계획 밖 경로에 쓰기 전에 묻습니다.
3. **실제 변경을 확인합니다.** 테스트와 완료 전에 Core가 쓰기 전 확인을 거치지 않은 변경까지 포함해 Task의 누적 변경 경로를 다시 대조합니다.
4. **무의미한 반복을 멈춥니다.** 세 번째 정확한 반복에서 Task를 멈추고 다른 방법이나 명시적인 계속 허용을 요구합니다.
5. **현재 결과만 전달합니다.** 나중의 코드 변경은 오래된 확인을 무효화합니다. 테스트와 개발자 이해 확인은 최종 구현과 일치해야 합니다.

작업이 명확한 응답 없이 끝나면, 통합은 재시도가 안전한지 결정하기 전에 저장된 Action과 현재
repository를 읽습니다.

## 언제 사용하면 좋은가

| Dev Flow가 적합한 경우 | Host를 직접 쓰는 편이 간단한 경우 |
| --- | --- |
| 작업이 여러 세션, 재시작, 여러 날에 걸칠 수 있음 | 일회성 질문이나 코드 설명 |
| 변경 파일과 테스트 비용에 명확한 한도가 필요함 | 진행 상태 저장이 필요 없는 작은 기계적 변경 |
| 재작업에서 오래된 결과를 재사용하면 안 됨 | 상태 확인이나 설계 논의만 필요함 |
| 전달 전에 개발자의 명확한 검토가 필요함 | 지속되는 Task나 복구 상태가 필요 없음 |

## 지원

| 안정 npm `@latest` 제품 | 검증된 환경 |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

현재 소스에는 로컬 WebUI와 정확한 `win32-x64` runtime도 포함되지만 Windows에는 아직 안정
`@latest` Host Journey가 없습니다. 안정 플랫폼 범위는 [Support Matrix](docs/SUPPORT-MATRIX_en.md)를
따르며, 안정 릴리스, 소스 전용 기능, 공개 Journey, 현재 부족한 부분은
[Project Status](docs/PROJECT-STATUS_en.md)에 정리되어 있습니다.

## 경계

- Dev Flow는 제어 계층이며 코딩 Agent가 아닙니다. 사용자가 허용한 Codex 또는 DeepSeek가 파일 변경과 명령을 실행합니다.
- Go Core는 Git을 읽기 전용으로 관찰하며 commit, push, merge, rebase, tag, publish를 실행하지 않습니다.
- 쓰기 전 확인은 나열된 Host 구조화 도구만 다룹니다. Bash와 외부 도구가 먼저 쓸 수 있으므로 shell 또는 파일 시스템 sandbox가 아닙니다.
- Control Center는 로컬 loopback에서 한 사용자만을 위해 실행되며 원격 접속, 클라우드 동기화, 팀 권한을 제공하지 않습니다.

## 문서

- **제품 이해:** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **사용 방법:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **시스템 이해:** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **보안과 기여:** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## 라이선스

[Apache License 2.0](LICENSE)
