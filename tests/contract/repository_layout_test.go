package contract_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

const (
	requiredPathContract    = "required root path"
	singleSpecifyContract   = "single root .specify"
	singleGoModuleContract  = "single root go.mod"
	executableRootContract  = "only cmd/dev-flow may be an executable source root"
	hostPackageContract     = "host packages contain only package.json and README.md"
	codexFakeImportContract = "Codex production sources cannot import test fakes"
	rootScriptContract      = "root scripts use the reviewed exact allowlist"
)

var rootScriptFiles = []string{
	"README.md",
	"build-codex-local.sh",
	"build-codex-release.sh",
	"publish-codex-release.mjs",
	"run-codex-real-journey.sh",
	"validate-codex-journey-evidence.mjs",
	"verify-codex-release.mjs",
	"validate-repository.sh",
	"write-codex-journey-evidence.mjs",
}

var codexSourceFiles = []string{
	".agents/plugins/marketplace.json",
	"LICENSE",
	"README.md",
	"bin/dev-flow-codex.mjs",
	"lib/lifecycle.mjs",
	"lib/paths.mjs",
	"package.json",
	"plugin/.codex-plugin/plugin.json",
	"plugin/.mcp.json",
	"plugin/skills/dev-flow/SKILL.md",
	"plugin/skills/dev-flow/agents/openai.yaml",
	"tests/fake-core-contract.test.mjs",
	"tests/fixtures/fake-codex.mjs",
	"tests/fixtures/fake-core.mjs",
	"tests/fixtures/fake-native-tool.mjs",
	"tests/fixtures/fake-release-gh.mjs",
	"tests/fixtures/fake-release-npm.mjs",
	"tests/journey-evidence.test.mjs",
	"tests/journey-harness.test.mjs",
	"tests/launcher.test.mjs",
	"tests/lifecycle.test.mjs",
	"tests/package-contract.test.mjs",
	"tests/paths.test.mjs",
	"tests/removal-retention.test.mjs",
	"tests/release-package.test.mjs",
	"tests/release-publication.test.mjs",
	"tests/skill-contract.test.mjs",
}

var deepseekSkeletonFiles = []string{
	"README.md",
	"package.json",
}

var requiredRootPaths = []string{
	".github/workflows",
	".specify/memory",
	".agents/skills",
	"cmd/dev-flow",
	"internal",
	"packages/codex",
	"packages/deepseek",
	"protocol/fixtures",
	"tests/contract",
	"release",
	"scripts",
	"docs",
	"specs",
}

type layoutViolation struct {
	path     string
	contract string
	detail   string
}

type layoutFixture struct {
	Name             string `json:"name"`
	Path             string `json:"path"`
	Contents         string `json:"contents"`
	ExpectedPath     string `json:"expectedPath"`
	ExpectedContract string `json:"expectedContract"`
}

func (v layoutViolation) Error() string {
	return fmt.Sprintf("%s violates %q: %s", v.path, v.contract, v.detail)
}

func TestRepositoryLayout(t *testing.T) {
	root := repositoryRoot(t)
	violations := validateRepositoryLayout(root)
	if len(violations) == 0 {
		return
	}

	for _, violation := range violations {
		t.Errorf("%s", violation.Error())
	}
}

func TestRepositoryLayoutAcceptsValidFixture(t *testing.T) {
	t.Parallel()

	root := newValidRepository(t)
	writeFixtureFile(t, root, "packages/codex/tests/fixtures/fake-codex.mjs", "export const fakeCodex = true;\n")
	writeFixtureFile(t, root, "packages/codex/tests/fixtures/fake-core.mjs", "export const fakeCore = true;\n")
	if violations := validateRepositoryLayout(root); len(violations) != 0 {
		t.Fatalf("valid repository fixture has layout violations: %v", violations)
	}
}

func TestCodexRepositoryLayoutRejectsUnreviewedFilesAndFakeImports(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		path             string
		contents         string
		expectedContract string
	}{
		{name: "committed runtime", path: "packages/codex/runtime/darwin-arm64/dev-flow", contents: "binary", expectedContract: hostPackageContract},
		{name: "committed binary", path: "packages/codex/bin/dev-flow", contents: "binary", expectedContract: hostPackageContract},
		{name: "committed tarball", path: "packages/codex/dev-flow-codex.tgz", contents: "archive", expectedContract: hostPackageContract},
		{name: "committed task data", path: "packages/codex/data/tasks.db", contents: "database", expectedContract: hostPackageContract},
		{name: "committed registration receipt", path: "packages/codex/registrations/codex.json", contents: "{}\n", expectedContract: hostPackageContract},
		{name: "fixture outside exact test path", path: "packages/codex/fixtures/fake-core.mjs", contents: "export {};\n", expectedContract: hostPackageContract},
		{
			name:             "production fake import",
			path:             "packages/codex/bin/dev-flow-codex.mjs",
			contents:         "import '../tests/fixtures/fake-core.mjs';\n",
			expectedContract: codexFakeImportContract,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			root := newValidRepository(t)
			writeFixtureFile(t, root, test.path, test.contents)
			assertLayoutViolation(t, validateRepositoryLayout(root), test.path, test.expectedContract)
		})
	}
}

func TestCodexPublicPackageSourceBoundary(t *testing.T) {
	t.Parallel()

	root := repositoryRoot(t)
	rootLicense, err := os.ReadFile(filepath.Join(root, "LICENSE"))
	if err != nil {
		t.Fatalf("read root license: %v", err)
	}
	packageLicense, err := os.ReadFile(filepath.Join(root, "packages", "codex", "LICENSE"))
	if err != nil {
		t.Fatalf("read Codex package license: %v", err)
	}
	if !bytes.Equal(rootLicense, packageLicense) {
		t.Fatal("Codex package LICENSE must remain byte-identical to the root LICENSE")
	}

	manifestPath := filepath.Join(root, "packages", "codex", "package.json")
	manifest := readManifestObject(t, manifestPath)
	var files []string
	if err := json.Unmarshal(manifest["files"], &files); err != nil {
		t.Fatalf("decode Codex files allowlist: %v", err)
	}
	if !sameStringSet(files, codexPackageFiles) {
		t.Fatalf("Codex public files = %v, want exact reviewed allowlist %v", files, codexPackageFiles)
	}

	runtimeCount := 0
	for _, path := range files {
		if path == "runtime/darwin-arm64/dev-flow" {
			runtimeCount++
		}
		lower := strings.ToLower(path)
		for _, forbidden := range []string{"deepseek", "tests/", "fixtures/", "cmd/", "internal/", "protocol/", "node_modules/", ".git/", ".db", ".sqlite", "receipt", "cache/", "tmp/"} {
			if strings.Contains(lower, forbidden) {
				t.Errorf("Codex packed path %q contains forbidden source/state marker %q", path, forbidden)
			}
		}
		if filepath.IsAbs(path) || strings.Contains(path, "..") {
			t.Errorf("Codex packed path %q is not a safe package-relative path", path)
		}
	}
	if runtimeCount != 1 {
		t.Fatalf("Codex package runtime count = %d, want exactly one darwin-arm64 runtime", runtimeCount)
	}
}

func TestRootScriptLayoutUsesReviewedExactAllowlist(t *testing.T) {
	root := repositoryRoot(t)
	if violations := validateRootScriptLayout(root); len(violations) != 0 {
		t.Fatalf("repository root script layout violations: %v", violations)
	}

	fixtureRoot := newValidRepository(t)
	for _, path := range rootScriptFiles {
		writeFixtureFile(t, fixtureRoot, "scripts/"+path, "fixture\n")
	}
	writeFixtureFile(t, fixtureRoot, "scripts/unreviewed-release.sh", "#!/bin/sh\n")
	assertLayoutViolation(
		t,
		validateRootScriptLayout(fixtureRoot),
		"scripts/unreviewed-release.sh",
		rootScriptContract,
	)
}

func TestPullRequestCIContract(t *testing.T) {
	t.Parallel()

	root := repositoryRoot(t)
	ciPath := filepath.Join(root, ".github", "workflows", "ci.yml")
	contents, err := os.ReadFile(ciPath)
	if err != nil {
		t.Fatalf("read CI contract path %s: %v", ciPath, err)
	}
	workflow := string(contents)

	requiredFragments := []string{
		"pull_request:",
		"permissions:",
		"contents: read",
		"go-version: stable",
		"node-version: lts/*",
		"version: 11",
		"fetch-depth: 0",
		"RELEASE_BASE_SHA: ${{ github.event.pull_request.base.sha }}",
		"run: ./scripts/validate-repository.sh",
	}
	for _, fragment := range requiredFragments {
		if !strings.Contains(workflow, fragment) {
			t.Errorf("%s violates pull-request CI contract: missing %q", relativePath(root, ciPath), fragment)
		}
	}
	if count := strings.Count(workflow, "run:"); count != 1 {
		t.Errorf("%s violates bounded CI contract: found %d run commands, want exactly the shared validation entry", relativePath(root, ciPath), count)
	}

	forbiddenFragments := []string{
		"push:",
		"pull_request_target",
		"workflow_dispatch",
		"strategy:",
		"matrix:",
		"secrets.",
		"contents: write",
		"packages: write",
		"id-token: write",
		"npm publish",
		"pnpm publish",
		"gh release",
		"git tag",
		"npm_token",
		"node_auth_token",
		"codex",
		"deepseek",
		"npm config set",
		"pnpm config set",
		"git config",
		"$home",
		"~/.config",
	}
	lowerWorkflow := strings.ToLower(workflow)
	for _, fragment := range forbiddenFragments {
		if strings.Contains(lowerWorkflow, fragment) {
			t.Errorf("%s violates no-publication/no-host-side-effect CI contract: contains %q", relativePath(root, ciPath), fragment)
		}
	}
}

func TestRepositoryLayoutRejects(t *testing.T) {
	t.Run("missing required root path", func(t *testing.T) {
		root := newValidRepository(t)
		missing := filepath.Join(root, "release")
		if err := os.Remove(missing); err != nil {
			t.Fatalf("remove required fixture path: %v", err)
		}

		assertLayoutViolation(t, validateRepositoryLayout(root), "release", requiredPathContract)
	})

	for _, fixture := range loadLayoutFixtures(t) {
		fixture := fixture
		t.Run(fixture.Name, func(t *testing.T) {
			root := newValidRepository(t)
			writeFixtureFile(t, root, fixture.Path, fixture.Contents)

			assertLayoutViolation(t, validateRepositoryLayout(root), fixture.ExpectedPath, fixture.ExpectedContract)
		})
	}
}

// validateRepositoryLayout contains the repository-tree checks shared by the
// positive checkout test and isolated negative fixtures. Every returned
// violation carries both its repository-relative path and the broken contract.
func validateRepositoryLayout(root string) []layoutViolation {
	var violations []layoutViolation
	executableSources := make(map[string]string)

	for _, requiredPath := range requiredRootPaths {
		info, err := os.Stat(filepath.Join(root, filepath.FromSlash(requiredPath)))
		if err != nil {
			if os.IsNotExist(err) {
				violations = append(violations, layoutViolation{
					path:     requiredPath,
					contract: requiredPathContract,
					detail:   "path does not exist",
				})
				continue
			}
			violations = append(violations, layoutViolation{
				path:     requiredPath,
				contract: requiredPathContract,
				detail:   fmt.Sprintf("cannot inspect path: %v", err),
			})
			continue
		}
		if !info.IsDir() {
			violations = append(violations, layoutViolation{
				path:     requiredPath,
				contract: requiredPathContract,
				detail:   "path is not a directory",
			})
		}
	}

	rootGoMod := filepath.Join(root, "go.mod")
	if info, err := os.Stat(rootGoMod); err != nil || info.IsDir() {
		detail := "root module file does not exist"
		if err == nil {
			detail = "root module path is not a file"
		} else if !os.IsNotExist(err) {
			detail = fmt.Sprintf("cannot inspect root module file: %v", err)
		}
		violations = append(violations, layoutViolation{
			path:     "go.mod",
			contract: singleGoModuleContract,
			detail:   detail,
		})
	}

	walkErr := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		relativePath, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return relErr
		}
		relativePath = filepath.ToSlash(relativePath)

		if err != nil {
			violations = append(violations, layoutViolation{
				path:     relativePath,
				contract: "repository tree is inspectable",
				detail:   err.Error(),
			})
			return nil
		}

		if entry.IsDir() {
			if relativePath == ".git" || entry.Name() == "node_modules" {
				return filepath.SkipDir
			}
			if entry.Name() == ".specify" && relativePath != ".specify" {
				violations = append(violations, layoutViolation{
					path:     relativePath,
					contract: singleSpecifyContract,
					detail:   "nested Spec Kit project is forbidden",
				})
				return filepath.SkipDir
			}
			return nil
		}

		if entry.Name() == "go.mod" && relativePath != "go.mod" {
			violations = append(violations, layoutViolation{
				path:     relativePath,
				contract: singleGoModuleContract,
				detail:   "nested Go module is forbidden",
			})
		}

		if filepath.Ext(entry.Name()) != ".go" {
			return nil
		}

		parsed, parseErr := parser.ParseFile(token.NewFileSet(), path, nil, parser.PackageClauseOnly)
		if parseErr != nil || parsed.Name.Name != "main" {
			return nil
		}

		executableRoot := filepath.ToSlash(filepath.Dir(relativePath))
		if _, recorded := executableSources[executableRoot]; !recorded {
			executableSources[executableRoot] = relativePath
		}
		return nil
	})
	if walkErr != nil {
		violations = append(violations, layoutViolation{
			path:     ".",
			contract: "repository tree is inspectable",
			detail:   walkErr.Error(),
		})
	}

	executableRoots := make([]string, 0, len(executableSources))
	for executableRoot := range executableSources {
		executableRoots = append(executableRoots, executableRoot)
	}
	slices.Sort(executableRoots)
	for _, executableRoot := range executableRoots {
		if executableRoot != "cmd/dev-flow" {
			violations = append(violations, layoutViolation{
				path:     executableRoot,
				contract: executableRootContract,
				detail:   fmt.Sprintf("package main declared by %s", executableSources[executableRoot]),
			})
		}
	}
	if _, found := executableSources["cmd/dev-flow"]; !found {
		violations = append(violations, layoutViolation{
			path:     "cmd/dev-flow",
			contract: executableRootContract,
			detail:   "required executable source root does not declare package main",
		})
	}

	violations = append(violations, validateHostPackageLayout(root, "packages/codex", codexSourceFiles, true)...)
	violations = append(violations, validateHostPackageLayout(root, "packages/deepseek", deepseekSkeletonFiles, false)...)
	violations = append(violations, validateRootScriptLayout(root)...)

	return violations
}

func validateRootScriptLayout(root string) []layoutViolation {
	scriptRoot := filepath.Join(root, "scripts")
	entries, err := os.ReadDir(scriptRoot)
	if err != nil {
		return []layoutViolation{{
			path:     "scripts",
			contract: rootScriptContract,
			detail:   fmt.Sprintf("cannot inspect root scripts: %v", err),
		}}
	}

	allowed := make(map[string]struct{}, len(rootScriptFiles))
	for _, name := range rootScriptFiles {
		allowed[name] = struct{}{}
	}
	seen := make(map[string]struct{}, len(rootScriptFiles))
	var violations []layoutViolation
	for _, entry := range entries {
		path := "scripts/" + entry.Name()
		if entry.IsDir() {
			violations = append(violations, layoutViolation{
				path:     path,
				contract: rootScriptContract,
				detail:   "nested root script directories are not reviewed",
			})
			continue
		}
		if _, ok := allowed[entry.Name()]; !ok {
			violations = append(violations, layoutViolation{
				path:     path,
				contract: rootScriptContract,
				detail:   "unexpected root script or generated artifact",
			})
			continue
		}
		seen[entry.Name()] = struct{}{}
	}
	for _, required := range rootScriptFiles {
		if _, ok := seen[required]; !ok {
			violations = append(violations, layoutViolation{
				path:     "scripts/" + required,
				contract: rootScriptContract,
				detail:   "required reviewed root script is missing",
			})
		}
	}
	return violations
}

func validateHostPackageLayout(root, packagePath string, allowedFiles []string, scanProductionFakes bool) []layoutViolation {
	packageRoot := filepath.Join(root, filepath.FromSlash(packagePath))
	if _, err := os.Stat(packageRoot); err != nil {
		return nil // Required-path validation owns a missing or unreadable package root.
	}

	allowed := make(map[string]struct{}, len(allowedFiles))
	for _, path := range allowedFiles {
		allowed[path] = struct{}{}
	}
	seen := make(map[string]struct{}, len(allowedFiles))
	var violations []layoutViolation

	err := filepath.WalkDir(packageRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Name() == "node_modules" {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.IsDir() {
			return nil
		}

		relative, relErr := filepath.Rel(packageRoot, path)
		if relErr != nil {
			return relErr
		}
		relative = filepath.ToSlash(relative)
		fullRelative := packagePath + "/" + relative
		if _, ok := allowed[relative]; !ok {
			violations = append(violations, layoutViolation{
				path:     fullRelative,
				contract: hostPackageContract,
				detail:   "unexpected host package source, test file, runtime, data, receipt, or artifact",
			})
			return nil
		}
		seen[relative] = struct{}{}

		if !scanProductionFakes || !codexProductionSource(relative) {
			return nil
		}
		contents, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if codexSourceReferencesFake(contents) {
			violations = append(violations, layoutViolation{
				path:     fullRelative,
				contract: codexFakeImportContract,
				detail:   "production launcher/lifecycle code references a test fixture",
			})
		}
		return nil
	})
	if err != nil {
		violations = append(violations, layoutViolation{
			path:     packagePath,
			contract: "host package tree is inspectable",
			detail:   err.Error(),
		})
	}

	for _, required := range []string{"README.md", "package.json"} {
		if _, ok := seen[required]; !ok {
			violations = append(violations, layoutViolation{
				path:     packagePath + "/" + required,
				contract: hostPackageContract,
				detail:   "required host package metadata is missing",
			})
		}
	}

	return violations
}

func codexProductionSource(path string) bool {
	return strings.HasPrefix(path, "bin/") || strings.HasPrefix(path, "lib/")
}

func codexSourceReferencesFake(contents []byte) bool {
	lower := strings.ToLower(string(contents))
	for _, marker := range []string{"tests/fixtures", "fake-codex", "fake-core"} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func assertLayoutViolation(t *testing.T, violations []layoutViolation, expectedPath, expectedContract string) {
	t.Helper()
	for _, violation := range violations {
		if violation.path == expectedPath && violation.contract == expectedContract {
			if !strings.Contains(violation.Error(), expectedPath) || !strings.Contains(violation.Error(), expectedContract) {
				t.Fatalf("violation does not identify its path and contract: %q", violation.Error())
			}
			return
		}
	}

	t.Fatalf("missing violation for path %q and contract %q; got: %v", expectedPath, expectedContract, violations)
}

func newValidRepository(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	for _, requiredPath := range requiredRootPaths {
		if err := os.MkdirAll(filepath.Join(root, filepath.FromSlash(requiredPath)), 0o755); err != nil {
			t.Fatalf("create fixture path %s: %v", requiredPath, err)
		}
	}
	writeFixtureFile(t, root, "go.mod", "module example.invalid/dev-flow\n\ngo 1.26\n")
	writeFixtureFile(t, root, "cmd/dev-flow/main.go", "package main\n\nfunc main() {}\n")
	for _, path := range rootScriptFiles {
		writeFixtureFile(t, root, "scripts/"+path, "fixture\n")
	}
	for _, packagePath := range []string{"packages/codex", "packages/deepseek"} {
		writeFixtureFile(t, root, packagePath+"/package.json", "{\"private\":true}\n")
		writeFixtureFile(t, root, packagePath+"/README.md", "# Bootstrap package\n")
	}
	return root
}

func writeFixtureFile(t *testing.T, root, relativePath, contents string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create fixture parent for %s: %v", relativePath, err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write fixture file %s: %v", relativePath, err)
	}
}

func loadLayoutFixtures(t *testing.T) []layoutFixture {
	t.Helper()

	pattern := filepath.Join(repositoryRoot(t), "tests", "contract", "testdata", "repository-layout", "*.json")
	paths, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatalf("resolve repository-layout fixture descriptors: %v", err)
	}
	if len(paths) != 4 {
		t.Fatalf("expected 4 repository-layout fixture descriptors, found %d", len(paths))
	}

	fixtures := make([]layoutFixture, 0, len(paths))
	for _, path := range paths {
		contents, readErr := os.ReadFile(path)
		if readErr != nil {
			t.Fatalf("read layout fixture descriptor %s: %v", path, readErr)
		}
		var fixture layoutFixture
		if unmarshalErr := json.Unmarshal(contents, &fixture); unmarshalErr != nil {
			t.Fatalf("parse layout fixture descriptor %s: %v", path, unmarshalErr)
		}
		if fixture.Name == "" || fixture.Path == "" || fixture.ExpectedPath == "" || fixture.ExpectedContract == "" {
			t.Fatalf("layout fixture descriptor %s has an empty required field", path)
		}
		fixtures = append(fixtures, fixture)
	}
	return fixtures
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate repository_layout_test.go")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "..", ".."))
}
