<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>장시간 AI 코딩 작업을 채팅 기록의 추측이 아니라 영구 Task 상태에서 이어갑니다.</strong></p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> 이 페이지는 안정 문서 스냅샷입니다. 계속 동기화되는 최신 설명은
> [简体中文](README.md) 또는 [English](README_en.md)를 확인하세요.

Dev Flow는 장시간 AI 코딩 작업을 위한 로컬 프로세스 제어 및 복구 계층입니다. 채팅 기록 밖에 목표,
범위, 현재 단계, 검증 예산, 완료된 검증, Blocker와 Recovery 상태를 저장하여 컨텍스트 압축, Host
재시작, 결과가 불확실한 작업 뒤에도 같은 Task를 계속할 수 있습니다.

## 가장 먼저 해결하는 문제

장시간 작업이 중단되면 새 세션은 불완전한 채팅과 현재 repository를 보고 진행 상황을 다시 추측합니다.
그 결과 변경을 반복하거나 남은 검증을 건너뛰고, 오래된 테스트 결과를 현재 결과로 사용할 수 있습니다.
Dev Flow는 로컬 Task를 먼저 읽고 저장된 단계와 다음 작업에서 이어갑니다.

## 30초 요약

| Agent를 직접 사용할 때 | Dev Flow가 추가하는 기능 |
| --- | --- |
| 세션 중단 후 진행 상황을 다시 추측 | 같은 로컬 Task 복구 |
| 작은 작업의 범위가 점차 확대 | 최초 목표와 명확한 경계 저장 |
| 대상 테스트가 계속 확대 | verification budget 저장 |
| 응답 유실 후 즉시 재시도 | 현재 Task와 Recovery 상태를 먼저 읽기 |
| 테스트 결과가 이후 코드 변경과 혼합 | 현재 단계와 해당 기록 저장 |

## 적합한 작업과 적합하지 않은 작업

Dev Flow는 여러 세션이나 날짜, Host 재시작을 거치는 실제 repository 작업에 적합합니다. 특히 범위,
대상 검증, 재작업 경로, 전달 전 이해 확인이 필요한 변경에 유용합니다.

일회성 질문, 코드 설명, 상태 조회, 진행 상태를 보존할 필요가 없는 기계적인 작은 변경은 Codex 또는
DeepSeek를 직접 사용하는 편이 간단합니다. Dev Flow는 범용 작업 오케스트레이터, 원격 실행 플랫폼,
보안 sandbox가 아닙니다.

## 다른 도구와의 관계

| 도구 | 역할 |
| --- | --- |
| Codex / DeepSeek | repository 읽기, 코드 변경, 명령 실행 |
| OpenSpec / Spec Kit | 요구사항, 설계, 작업 정리 지원 |
| Dev Flow | Task 단계, 범위, 검증 예산, 복구 상태, 합법적인 다음 단계 저장 |

현재 OpenSpec / Spec Kit artifact importer는 없습니다. 더 얇은 연동은 향후 방향입니다.

## 설치 및 시작

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Codex 명시적 진입점:

```text
$dev-flow-codex:dev-flow 로그인 실패 횟수 제한을 수정하고 대상 테스트만 실행하세요.
```

DeepSeek Harness 명시적 진입점:

```text
/dev-flow 로그인 실패 횟수 제한을 수정하고 대상 테스트만 실행하세요.
```

## 현재 안정 지원 및 경계

| 제품 | 검증된 환경 |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

- Core는 Git을 읽기 전용으로 관찰하며 commit, push, merge, rebase, tag, publish를 실행하지 않습니다.
- 파일 변경과 명령 실행은 사용자가 승인한 Codex 또는 DeepSeek가 담당합니다.
- Core는 Host의 모든 파일 작업을 차단하지 않으며 shell 또는 파일 시스템 sandbox가 아닙니다.
- WebUI는 로컬 loopback의 단일 사용자 보기 및 진단 진입점입니다.
- 프로젝트는 아직 초기 단계이며 외부 도입이 제한적입니다. 안정 범위는 Support Matrix를 따릅니다.

## 최신 문서

- [English README](README_en.md)
- [Product Definition](docs/PRODUCT_en.md)
- [중단 후 재개 Demo](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) / [Threat Model](docs/THREAT-MODEL_en.md)

## License

[Apache License 2.0](LICENSE)
