package contract_test

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestCoreSemanticPackagesContainNoOperatingSystemDecision(t *testing.T) {
	root := currentStorageRepositoryRoot(t)
	for _, directory := range []string{"internal/domain", "internal/workflow", "internal/application", "internal/recovery"} {
		err := filepath.WalkDir(filepath.Join(root, directory), func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() || filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			raw, readErr := os.ReadFile(path)
			if readErr != nil {
				return readErr
			}
			if regexp.MustCompile(`runtime\.GOOS|//go:build|golang\.org/x/sys/windows|syscall\.`).Match(raw) {
				t.Errorf("Core semantic source contains an operating-system decision: %s", filepath.ToSlash(strings.TrimPrefix(path, root+string(filepath.Separator))))
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestNodeConsumersUseClosedPlatformImplementations(t *testing.T) {
	root := currentStorageRepositoryRoot(t)
	for _, relative := range []string{
		"packages/codex/lib/platform.mjs",
		"packages/deepseek/lib/platform.mjs",
		"packages/dev-flow/lib/platform.mjs",
	} {
		raw, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(relative)))
		if err != nil {
			t.Fatal(err)
		}
		for _, runtimeKey := range []string{"darwin-arm64", "win32-x64"} {
			if !strings.Contains(string(raw), `"`+runtimeKey+`"`) {
				t.Errorf("%s is missing %s", relative, runtimeKey)
			}
		}
	}

	for _, relative := range []string{
		"packages/codex/lib/paths.mjs",
		"packages/codex/lib/install-experience.mjs",
		"packages/codex/lib/lifecycle.mjs",
		"packages/codex/bin/dev-flow-codex.mjs",
		"packages/codex/plugin/hooks/pre-tool-use.mjs",
		"packages/deepseek/lib/index.mjs",
		"packages/deepseek/lib/paths.mjs",
		"packages/deepseek/lib/runtime.mjs",
		"packages/dev-flow/lib/ownership.mjs",
		"packages/dev-flow/lib/plan.mjs",
		"packages/dev-flow/lib/runtime.mjs",
	} {
		raw, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(relative)))
		if err != nil {
			t.Fatal(err)
		}
		if regexp.MustCompile(`platform\s*(?:===|!==)\s*["'](?:win32|darwin)["']`).Match(raw) {
			t.Errorf("%s branches on a concrete platform outside a platform implementation", relative)
		}
	}
}

func TestRuntimeBuildHasOneClosedTargetCatalog(t *testing.T) {
	root := currentStorageRepositoryRoot(t)
	raw, err := os.ReadFile(filepath.Join(root, "scripts", "build-core-runtimes.mjs"))
	if err != nil {
		t.Fatal(err)
	}
	source := string(raw)
	if !strings.Contains(source, "export const CORE_RUNTIME_TARGETS") {
		t.Error("runtime builder does not expose its closed target catalog")
	}
	for _, value := range []string{`runtimeKey: "darwin-arm64"`, `runtimeKey: "win32-x64"`} {
		if strings.Count(source, value) != 1 {
			t.Errorf("runtime builder must contain exactly one %q", value)
		}
	}
	if !strings.Contains(source, `CGO_ENABLED: "0"`) {
		t.Error("runtime builder does not disable CGo")
	}
	for _, relative := range []string{"scripts/dev-flow-local.mjs", "tests/journeys/deepseek/multi-repository-runner.mjs"} {
		consumer, readErr := os.ReadFile(filepath.Join(root, filepath.FromSlash(relative)))
		if readErr != nil {
			t.Fatal(readErr)
		}
		if !strings.Contains(string(consumer), "buildCoreRuntimes") {
			t.Errorf("%s does not consume the shared runtime builder", relative)
		}
	}
}
