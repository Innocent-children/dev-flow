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

모든 새 요청은 Dev Flow를 선택하기 전에 읽기 전용으로 평가됩니다. 선택하면 Host가 로컬 또는 원격
소스, 시작 브랜치와 새 작업 브랜치 이름을 묻습니다. 로컬 소스라면 스테이징된 변경, 스테이징되지 않은
변경과 Git이 무시하지 않는 미추적 파일을 복사할지도 묻습니다. 원본 작업 공간과 스테이징 상태는
보존됩니다. 로컬 생성은 네트워크 없이 수행하며 원격 소스만 fetch합니다. 변경 적용 중 충돌이 발생하면
Task 생성을 중지하고 확인할 수 있도록 대상 작업 트리를 보존합니다.

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
- **완료 결과와 복구 상태를 확인할 수 있습니다.** Core는 계획된 모든 작업의 완료와 각 인수 조건에 연결된 현재 유효한 검증을 확인합니다. WebUI가 중단되어도 Core에 저장된 제출 내용을 복구할 수 있습니다. Codex는 거부 응답 전체를 보존하고 Core의 지시에 따라 다음 작업을 결정합니다.

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

현재 소스의 Adapter에는 DSH `>=0.1.2-rc.1`이 필요합니다. 각 Dev Flow 작업은 현재 사용자가 직접 입력한 승인을 확인합니다.

### 2. 작업 시작하기

**Codex**에서는 다음 내용을 사용자 메시지로 보냅니다.

```text
$dev-flow-codex:dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

Codex는 기존의 유효한 선택과 승인을 유지하며, 단순히 계속 진행할지 확인하기 위해 멈추지 않습니다. 아직 결정하지 않은 사항이나 필수 입력이 있으면 구체적으로 질문합니다.

**DeepSeek Harness**에서는 다음을 보냅니다.

```text
/dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

이는 shell 명령이 아니라 대화 selector입니다. 목표, 인수 조건, 파일 범위, 테스트 한도를 최대한
구체적으로 작성하세요. 첫 응답은 영향 범위를 평가하고 직접 개발할지 Dev Flow를 사용할지 묻습니다.
명시적 selector도 이 선택을 건너뛰지 않습니다. Dev Flow를 선택하면 위의 소스, 브랜치 및 변경 복사 여부를
확인합니다. Codex는 Host가 지원할 때 managed worktree를 열고, DeepSeek는 현재 세션의 Workspace Root가
고정되어 있으므로 새 worktree에서 다시 시작하는 방법을 제공합니다.

새 Codex 세션을 시작하기 전에 원래 세션은 이번 요구 사항에 관한 논의 원문과 구조화된 인계 자료를 저장하고, 확정된 요구 사항, 채택되지 않은 제안, 미해결 질문을 구분합니다. 데스크톱 새 작업과 CLI 재시작은 같은 저장 자료를 사용하며, 긴 내용은 잘라내지 않고 전체 파일로 전달합니다. [아키텍처](docs/ARCHITECTURE_en.md#codex-requirements-handoff)를 참고하세요.

인계 자료에는 세션별 지시와 권한을 보존합니다. 적용되는 전역 및 저장소의 `AGENTS.md`는 Codex가 정상적으로 불러오므로 본문을 인계 자료에 중복해서 넣지 않습니다. 대상 세션에서 자동으로 찾을 수 없는 규칙을 필요한 만큼 보완할 때는 출처와 적용 범위를 명시합니다.

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

## 데스크톱 작업 진입점

`@imotong/dev-flow` npm 패키지는 macOS arm64와 Windows 10/11 x64용 데스크톱 펫을 포함하며, 기본 동작 9종과 SVG 프레임 312개를 제공합니다. 선택한 Task의 저장 상태를 표시하고 WebUI를 열며, 작업 선택, 사용자 외형, 애니메이션 제어, 크기 조절, 독립적인 시작과 종료를 지원합니다. Core는 설정된 Codex 또는 DeepSeek Adapter가 제공합니다.

npm 패키지를 설치한 뒤 `dev-flow install`로 Adapter를 설정합니다. `install`, `upgrade`, `repair`, `reinstall`은 설정과 외형을 보존하면서 앱 사본을 갱신합니다. [펫 가이드](docs/DESKTOP-PETS_en.md)를 참고하세요. macOS는 ad-hoc 서명을 사용하며 Developer ID, 공증, Windows 배포 서명은 검증되지 않았습니다. 로컬 검사는 [안정 지원 범위](docs/SUPPORT-MATRIX_en.md)를 확대하지 않습니다.

```bash
dev-flow pet start
dev-flow pet stop
```

## 문서

- **사용 방법:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **프로젝트:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## 라이선스

[Apache License 2.0](LICENSE)


## Host 상호작용 안내

[Codex Skill](packages/codex/plugin/skills/dev-flow/SKILL.md)과 [DeepSeek Skill](packages/deepseek/skills/dev-flow/SKILL.md)의 Core 규칙과 예제는 하나의 공유 소스에서 생성됩니다. 각 패키지는 실제 권한 확인, 작업 트리와 도구 인터페이스를 따로 유지합니다. 양쪽 모두 현재 노드 전환, 응답 처리와 복구를 다룹니다. 프로세스 문서는 최종 검증 전에 업데이트하며, 화면 표시가 잘려도 보관된 전체 응답의 결과는 바뀌지 않습니다.
