<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 아이콘" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>긴 AI 코딩 작업의 변경 범위, 검증 한도, 현재 진행 상황을 세션이 바뀌어도 그대로 유지합니다.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Dev Flow로 할 수 있는 일

Dev Flow는 Codex 또는 DeepSeek에서 오래 이어지는 AI 코딩 작업을 관리하도록 돕습니다. 합의한 요구사항,
파일 범위, 검증 계획, 진행 상황과 결과를 로컬에 저장해 세션이 끝난 뒤에도 작업을 이어갈 수 있습니다.

- **변경 범위 확인:** 수정할 파일을 기록하고 실제 변경 사항을 계획과 비교합니다.
- **검증 계획 수립:** 작업에 필요한 검사를 선택하고 검증에 들일 작업량의 한도를 정합니다.
- **작업 재개:** 원래 작업 트리에서 같은 작업의 남은 내용을 이어갑니다.
- **결과 확인:** 진행 상황, 검사 결과, 처리가 필요한 문제를 확인합니다.

여러 세션에 걸치거나 파일 범위와 테스트 작업량을 명확히 정해야 하는 저장소 작업에 적합합니다.
일회성 질문, 코드 설명, 진행 상황을 저장할 필요가 없는 작은 수정은 Codex나 DeepSeek를 직접 쓰는 편이 간단합니다.

## 빠른 시작

> npm 안정 버전 `@latest`는 현재 macOS arm64에서 검증되었습니다. Node.js `>=24`와 지원되는
> Codex 또는 DeepSeek Harness를 먼저 설치하세요. 호스트 버전 요구사항과 다른 환경의 상태는
> [지원 범위](docs/SUPPORT-MATRIX_en.md)를 참고하세요.

### 1. Dev Flow 설치

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

대화형 설정에서 Codex, DeepSeek 또는 둘 다 선택한 뒤 설치 프로그램의 안내를 따르세요.

- **Codex:** `/hooks`를 열어 Dev Flow hook을 검토하고 신뢰하면 지원되는 쓰기 전 검사가 활성화됩니다.
- **DeepSeek Harness:** 설치 후 선택한 DSH Profile을 다시 시작하세요.

### 2. 작업 시작

**Codex**에서 다음 메시지를 보내세요.

```text
$dev-flow-codex:dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

**DeepSeek Harness**에서는 다음 메시지를 보내세요.

```text
/dev-flow 로그인 실패 속도 제한을 추가하세요. 인증 관련 파일만 변경하고 대상 확인을 최대 4개 실행하세요.
```

이 메시지는 터미널이 아닌 대화창에 입력합니다. 목표, 인수 조건, 파일 범위와 테스트 한도를 구체적으로 적으세요.

첫 응답은 요청을 평가하고 직접 개발할지 Dev Flow를 사용할지 묻습니다. Dev Flow를 선택하면 로컬 또는 원격
소스, 시작 브랜치, 새 작업 브랜치, 기존 로컬 변경 사항을 가져올지 확인합니다.

이후 작업은 해당 작업을 위해 준비한 독립 디렉터리인 전용 Git 작업 트리에서 진행됩니다. Codex는 호스트가
지원하면 작업 트리를 열고, DeepSeek는 새 디렉터리에서 다시 시작할 명령을 안내합니다.

구현 전에 요구 사항, 설계, 작업 항목, 변경할 파일과 검증 계획을 확인하고 논의합니다. 전체 계획을 명시적으로 승인한 뒤 개발을 시작합니다. 계획을 수정하거나 파일 범위를 넓히면 다시 승인을 받습니다. Dev Flow나 워크트리 설정을 선택하는 것은 계획 승인과 별개입니다.

### 3. 재개 및 진행 상황 확인

세션을 다시 시작한 뒤 작업의 원래 작업 트리로 돌아가 해당 작업을 계속해 달라고 명시적으로 요청하세요.
Dev Flow는 저장된 진행 상황부터 이어갑니다. 원래 작업 트리가 없어지거나 교체되었다면 이를 복구하거나
작업을 명시적으로 포기할 때까지 일시 중지됩니다.

DeepSeek Harness에서는 재개를 요청하는 메시지에도 `/dev-flow`를 포함하세요.

```bash
# 설치된 연동 확인
dev-flow status --host all

# 로컬 작업 화면 열기
dev-flow webui start
```

비대화형 설치, 사용자 지정 DSH Profile, 업그레이드, 복구와 제거는
[명령어 참고서](docs/COMMANDS_en.md)를 확인하세요.

## 데스크톱 펫

데스크톱 펫은 선택한 작업의 저장된 상태를 표시하고 WebUI를 엽니다. 작업 선택, 외형 변경, 애니메이션 제어,
크기 조절, 개별 시작과 중지를 지원합니다. 사용하기 전에 위의 설치와 Codex 또는 DeepSeek 설정을 완료하세요.

```bash
dev-flow pet start
dev-flow pet stop
```

데스크톱 앱은 macOS arm64와 Windows 10/11 x64를 대상으로 합니다. 설치와 조작은
[펫 안내서](docs/DESKTOP-PETS_en.md), 검증된 사용 가능 범위는[지원 범위](docs/SUPPORT-MATRIX_en.md)를 참고하세요.

## 사용 제한

전용 작업 트리는 코드 변경 사항을 분리합니다. 프로세스, 네트워크, 자격 증명과 외부 서비스는 현재 환경과 공유됩니다.

작업이 완료되어도 코드 커밋, 푸시 또는 작업 트리 삭제는 자동으로 실행되지 않습니다. 이 작업에는 별도의 승인이 필요합니다.

## 문서

- **사용 방법:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [명령어](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **프로젝트:** [제품 정의](docs/PRODUCT_en.md) · [지원 범위](docs/SUPPORT-MATRIX_en.md) · [보안](SECURITY.md)
- **개발 및 기여:** [문서 목록](MANIFEST_en.md) · [기여 안내](CONTRIBUTING.md)

## 라이선스

[Apache License 2.0](LICENSE)
