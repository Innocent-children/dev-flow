package contract_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

type manifestKind string

const (
	rootManifest    manifestKind = "root"
	codexManifest   manifestKind = "codex"
	productManifest manifestKind = "product"
)

var runtimeDependencyFields = []string{
	"dependencies",
	"optionalDependencies",
	"peerDependencies",
	"bundledDependencies",
	"bundleDependencies",
}

var rootDevelopmentScripts = map[string]string{
	"release:codex:prepare": "./scripts/build-codex-release.sh",
	"release:codex:publish": "node ./scripts/publish-codex-release.mjs",
	"release:codex:verify":  "node ./scripts/verify-codex-release.mjs",
	"validate":              "./scripts/validate-repository.sh",
	"validate:contracts":    "go test ./tests/contract",
}

var codexPackageFiles = []string{
	".agents/plugins/marketplace.json",
	"LICENSE",
	"bin/dev-flow-codex.mjs",
	"lib/lifecycle.mjs",
	"lib/paths.mjs",
	"plugin/.codex-plugin/plugin.json",
	"plugin/.mcp.json",
	"plugin/skills/dev-flow/SKILL.md",
	"plugin/skills/dev-flow/agents/openai.yaml",
	"runtime/darwin-arm64/dev-flow",
}

var codexDevelopmentScripts = map[string]string{
	"build:local":       "../../scripts/build-codex-local.sh",
	"pack:dry":          "pnpm pack --dry-run --json",
	"smoke:fixture":     "../../scripts/run-codex-real-journey.sh --fixture success",
	"test":              "node --test tests/*.test.mjs",
	"test:lifecycle":    "node --test tests/lifecycle.test.mjs",
	"test:native-smoke": "node --test tests/journey-harness.test.mjs",
	"test:package":      "node --test tests/package-contract.test.mjs",
	"test:parser":       "node --test tests/journey-evidence.test.mjs",
}

func TestProjectPackageManifests(t *testing.T) {
	t.Parallel()

	repositoryRoot := manifestRepositoryRoot(t)
	tests := []struct {
		path string
		kind manifestKind
	}{
		{path: filepath.Join(repositoryRoot, "package.json"), kind: rootManifest},
		{path: filepath.Join(repositoryRoot, "packages", "codex", "package.json"), kind: codexManifest},
		{path: filepath.Join(repositoryRoot, "packages", "deepseek", "package.json"), kind: productManifest},
	}

	for _, test := range tests {
		test := test
		t.Run(filepath.ToSlash(test.path), func(t *testing.T) {
			if _, err := os.Stat(test.path); err != nil {
				if os.IsNotExist(err) {
					// Required-path validation owns missing manifest failures. This test
					// owns the contents of manifests once their phase creates them.
					return
				}
				t.Fatalf("inspect manifest %s: %v", test.path, err)
			}

			assertNoManifestViolations(t, test.path, test.kind)
		})
	}
}

func TestProjectManifestBootstrapMetadata(t *testing.T) {
	t.Parallel()

	root := manifestRepositoryRoot(t)
	versionBytes, err := os.ReadFile(filepath.Join(root, "VERSION"))
	if err != nil {
		t.Fatalf("read root VERSION: %v", err)
	}
	wantVersion := strings.TrimSpace(string(versionBytes))
	if wantVersion != "0.3.0" {
		t.Fatalf("Feature 007 current version = %q, want 0.3.0", wantVersion)
	}

	tests := []struct {
		path             string
		wantName         string
		wantRootMetadata bool
	}{
		{path: filepath.Join(root, "package.json"), wantName: "dev-flow", wantRootMetadata: true},
		{path: filepath.Join(root, "packages", "codex", "package.json"), wantName: "dev-flow-codex"},
		{path: filepath.Join(root, "packages", "deepseek", "package.json"), wantName: "dev-flow-deepseek"},
	}

	for _, test := range tests {
		test := test
		t.Run(filepath.ToSlash(test.path), func(t *testing.T) {
			t.Parallel()

			manifest := readManifestObject(t, test.path)
			assertManifestString(t, test.path, manifest, "name", test.wantName)
			assertManifestString(t, test.path, manifest, "version", wantVersion)

			if !test.wantRootMetadata {
				return
			}
			if _, present := manifest["packageManager"]; present {
				t.Errorf("manifest %s field %q: exact packageManager patch is forbidden", test.path, "packageManager")
			}
			if _, present := manifest["bin"]; present {
				t.Errorf("manifest %s field %q: root executable entry is forbidden", test.path, "bin")
			}

			var engines map[string]string
			if err := json.Unmarshal(manifest["engines"], &engines); err != nil {
				t.Fatalf("manifest %s field %q: must be an object: %v", test.path, "engines", err)
			}
			if engines["node"] != ">=24" {
				t.Errorf("manifest %s field %q = %q, want %q", test.path, "engines.node", engines["node"], ">=24")
			}
			if engines["pnpm"] != ">=11 <12" {
				t.Errorf("manifest %s field %q = %q, want %q", test.path, "engines.pnpm", engines["pnpm"], ">=11 <12")
			}

			var scripts map[string]string
			if err := json.Unmarshal(manifest["scripts"], &scripts); err != nil {
				t.Fatalf("manifest %s field %q: must be an object: %v", test.path, "scripts", err)
			}
			if scripts["validate"] != "./scripts/validate-repository.sh" {
				t.Errorf("manifest %s field %q = %q, want shared validation entry", test.path, "scripts.validate", scripts["validate"])
			}
		})
	}
}

func TestPackageManifestAcceptsBootstrapManifests(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		kind     manifestKind
		manifest string
	}{
		{
			name: "root",
			kind: rootManifest,
			manifest: `{
				"name": "dev-flow",
				"version": "1.2.3",
				"private": true,
				"scripts": {"validate": "./scripts/validate-repository.sh"},
				"devDependencies": {"example-development-tool": "1.0.0"}
			}`,
		},
		{
			name: "skeleton product",
			kind: productManifest,
			manifest: `{
				"name": "dev-flow-codex",
				"version": "1.2.3",
				"private": true,
				"devDependencies": {"example-development-tool": "1.0.0"}
			}`,
		},
		{
			name: "codex product",
			kind: codexManifest,
			manifest: `{
				"name": "dev-flow-codex",
				"version": "1.2.3",
				"private": false,
				"license": "Apache-2.0",
				"repository": {
					"type": "git",
					"url": "git+https://github.com/Innocent-children/dev-flow.git",
					"directory": "packages/codex"
				},
				"os": ["darwin"],
				"cpu": ["arm64"],
				"publishConfig": {
					"access": "public",
					"registry": "https://registry.npmjs.org/"
				},
				"engines": {"node": ">=24"},
				"bin": {"dev-flow-codex": "bin/dev-flow-codex.mjs"},
				"files": [
					".agents/plugins/marketplace.json",
					"LICENSE",
					"bin/dev-flow-codex.mjs",
					"lib/lifecycle.mjs",
					"lib/paths.mjs",
					"plugin/.codex-plugin/plugin.json",
					"plugin/.mcp.json",
					"plugin/skills/dev-flow/SKILL.md",
					"plugin/skills/dev-flow/agents/openai.yaml",
					"runtime/darwin-arm64/dev-flow"
				],
				"scripts": {
					"test": "node --test tests/*.test.mjs",
					"test:package": "node --test tests/package-contract.test.mjs",
					"test:lifecycle": "node --test tests/lifecycle.test.mjs",
					"test:parser": "node --test tests/journey-evidence.test.mjs",
					"test:native-smoke": "node --test tests/journey-harness.test.mjs",
					"pack:dry": "pnpm pack --dry-run --json",
					"build:local": "../../scripts/build-codex-local.sh",
					"smoke:fixture": "../../scripts/run-codex-real-journey.sh --fixture success"
				}
			}`,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			path := writeManifestFixture(t, test.manifest)
			assertNoManifestViolations(t, path, test.kind)
		})
	}
}

func TestPackageManifestRejectsForbiddenFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		kind          manifestKind
		manifest      string
		violatedField string
	}{
		{
			name:          "publishable root",
			kind:          rootManifest,
			manifest:      `{"private": false}`,
			violatedField: "private",
		},
		{
			name:          "root runtime dependency",
			kind:          rootManifest,
			manifest:      `{"private": true, "dependencies": {"example": "1.0.0"}}`,
			violatedField: "dependencies",
		},
		{
			name:          "root publication configuration",
			kind:          rootManifest,
			manifest:      `{"private": true, "publishConfig": {"access": "public"}}`,
			violatedField: "publishConfig",
		},
		{
			name:          "root lifecycle script",
			kind:          rootManifest,
			manifest:      `{"private": true, "scripts": {"postinstall": "node setup.js"}}`,
			violatedField: "scripts.postinstall",
		},
		{
			name:          "root publication script",
			kind:          rootManifest,
			manifest:      `{"private": true, "scripts": {"publish": "pnpm publish"}}`,
			violatedField: "scripts.publish",
		},
		{
			name:          "non-private product",
			kind:          productManifest,
			manifest:      `{"private": false}`,
			violatedField: "private",
		},
		{
			name:          "product executable",
			kind:          productManifest,
			manifest:      `{"private": true, "bin": {"dev-flow-codex": "index.js"}}`,
			violatedField: "bin",
		},
		{
			name:          "product build script",
			kind:          productManifest,
			manifest:      `{"private": true, "scripts": {"build": "node build.js"}}`,
			violatedField: "scripts",
		},
		{
			name:          "product lifecycle script",
			kind:          productManifest,
			manifest:      `{"private": true, "scripts": {"postinstall": "node setup.js"}}`,
			violatedField: "scripts",
		},
		{
			name:          "product custom script",
			kind:          productManifest,
			manifest:      `{"private": true, "scripts": {"custom": "node custom.js"}}`,
			violatedField: "scripts",
		},
		{
			name:          "product publication configuration",
			kind:          productManifest,
			manifest:      `{"private": true, "publishConfig": {"access": "public"}}`,
			violatedField: "publishConfig",
		},
		{
			name:          "product optional runtime dependency",
			kind:          productManifest,
			manifest:      `{"private": true, "optionalDependencies": {"example": "1.0.0"}}`,
			violatedField: "optionalDependencies",
		},
		{
			name:          "product peer runtime dependency",
			kind:          productManifest,
			manifest:      `{"private": true, "peerDependencies": {"example": "1.0.0"}}`,
			violatedField: "peerDependencies",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			path := writeManifestFixture(t, test.manifest)
			violations := validatePackageManifest(path, test.kind)
			if len(violations) == 0 {
				t.Fatalf("expected %s violation for %s", test.violatedField, path)
			}

			for _, violation := range violations {
				message := violation.Error()
				if !strings.Contains(message, path) {
					t.Errorf("violation does not name manifest path %q: %s", path, message)
				}
			}

			if !violationsContainField(violations, test.violatedField) {
				t.Fatalf("violations for %s do not name field %q: %v", path, test.violatedField, violations)
			}
		})
	}
}

func TestCodexManifestRejectsUnreviewedPackageSurface(t *testing.T) {
	t.Parallel()

	validManifest := map[string]any{
		"name":    "dev-flow-codex",
		"version": "1.2.3",
		"private": false,
		"license": "Apache-2.0",
		"repository": map[string]string{
			"type":      "git",
			"url":       "git+https://github.com/Innocent-children/dev-flow.git",
			"directory": "packages/codex",
		},
		"os":            []string{"darwin"},
		"cpu":           []string{"arm64"},
		"publishConfig": map[string]string{"access": "public", "registry": "https://registry.npmjs.org/"},
		"engines":       map[string]string{"node": ">=24"},
		"bin":           map[string]string{"dev-flow-codex": "bin/dev-flow-codex.mjs"},
		"files":         codexPackageFiles,
		"scripts":       codexDevelopmentScripts,
	}

	tests := []struct {
		name          string
		violatedField string
		mutate        func(map[string]any)
	}{
		{
			name:          "private package",
			violatedField: "private",
			mutate:        func(manifest map[string]any) { manifest["private"] = true },
		},
		{
			name:          "wrong identity",
			violatedField: "name",
			mutate:        func(manifest map[string]any) { manifest["name"] = "other-product" },
		},
		{
			name:          "second executable",
			violatedField: "bin",
			mutate: func(manifest map[string]any) {
				manifest["bin"] = map[string]string{
					"dev-flow-codex": "bin/dev-flow-codex.mjs",
					"other":          "bin/other.mjs",
				}
			},
		},
		{
			name:          "unreviewed packed file",
			violatedField: "files",
			mutate: func(manifest map[string]any) {
				manifest["files"] = append(slices.Clone(codexPackageFiles), "tests/fixtures/fake-core.mjs")
			},
		},
		{
			name:          "install hook",
			violatedField: "scripts.postinstall",
			mutate: func(manifest map[string]any) {
				scripts := cloneStringMap(codexDevelopmentScripts)
				scripts["postinstall"] = "node setup.mjs"
				manifest["scripts"] = scripts
			},
		},
		{
			name:          "publication script",
			violatedField: "scripts.publish",
			mutate: func(manifest map[string]any) {
				scripts := cloneStringMap(codexDevelopmentScripts)
				scripts["publish"] = "pnpm publish"
				manifest["scripts"] = scripts
			},
		},
		{
			name:          "second platform",
			violatedField: "os",
			mutate:        func(manifest map[string]any) { manifest["os"] = []string{"darwin", "linux"} },
		},
		{
			name:          "wrong architecture",
			violatedField: "cpu",
			mutate:        func(manifest map[string]any) { manifest["cpu"] = []string{"x64"} },
		},
		{
			name:          "wrong public registry",
			violatedField: "publishConfig",
			mutate: func(manifest map[string]any) {
				manifest["publishConfig"] = map[string]string{"access": "public", "registry": "https://registry.example.invalid/"}
			},
		},
		{
			name:          "production dependency",
			violatedField: "dependencies",
			mutate: func(manifest map[string]any) {
				manifest["dependencies"] = map[string]string{"example": "1.0.0"}
			},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			manifest := cloneManifest(t, validManifest)
			test.mutate(manifest)
			contents, err := json.Marshal(manifest)
			if err != nil {
				t.Fatalf("encode Codex manifest fixture: %v", err)
			}
			path := writeManifestFixture(t, string(contents))
			violations := validatePackageManifest(path, codexManifest)
			if !violationsContainField(violations, test.violatedField) {
				t.Fatalf("Codex manifest violation does not name field %q: %v", test.violatedField, violations)
			}
		})
	}
}

func TestProductManifestFixtures(t *testing.T) {
	t.Parallel()

	root := manifestRepositoryRoot(t)
	tests := []struct {
		name          string
		fixture       string
		violatedField string
	}{
		{name: "valid product", fixture: "valid-product.json"},
		{name: "postinstall script", fixture: "postinstall.json", violatedField: "scripts"},
		{name: "prepack script", fixture: "prepack.json", violatedField: "scripts"},
		{name: "postpack script", fixture: "postpack.json", violatedField: "scripts"},
		{name: "custom script", fixture: "custom-script.json", violatedField: "scripts"},
		{name: "runtime dependency", fixture: "runtime-dependency.json", violatedField: "dependencies"},
		{name: "executable entry", fixture: "bin.json", violatedField: "bin"},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			path := filepath.Join(root, "tests", "contract", "testdata", "package-manifest", test.fixture)
			violations := validatePackageManifest(path, productManifest)
			if test.violatedField == "" {
				if len(violations) != 0 {
					t.Fatalf("valid product manifest fixture has violations: %v", violations)
				}
				return
			}

			if !violationsContainField(violations, test.violatedField) {
				t.Fatalf("fixture %s does not report field %q: %v", path, test.violatedField, violations)
			}
			for _, violation := range violations {
				if !strings.Contains(violation.Error(), path) {
					t.Errorf("fixture violation does not name manifest path %q: %s", path, violation)
				}
			}
		})
	}
}

func validatePackageManifest(path string, kind manifestKind) []error {
	contents, err := os.ReadFile(path)
	if err != nil {
		return []error{manifestViolation(path, "$", "cannot read manifest: %v", err)}
	}

	var manifest map[string]json.RawMessage
	if err := json.Unmarshal(contents, &manifest); err != nil {
		return []error{manifestViolation(path, "$", "invalid JSON: %v", err)}
	}

	var violations []error
	privateValue, present := manifest["private"]
	if kind == codexManifest {
		if present {
			var private bool
			if err := json.Unmarshal(privateValue, &private); err != nil || private {
				violations = append(violations, manifestViolation(path, "private", "must be absent or the boolean false"))
			}
		}
	} else if !present {
		violations = append(violations, manifestViolation(path, "private", "must be true"))
	} else {
		var private bool
		if err := json.Unmarshal(privateValue, &private); err != nil || !private {
			violations = append(violations, manifestViolation(path, "private", "must be the boolean true"))
		}
	}

	for _, field := range runtimeDependencyFields {
		if _, present := manifest[field]; present {
			violations = append(violations, manifestViolation(path, field, "runtime dependency fields are forbidden"))
		}
	}

	switch kind {
	case rootManifest:
		if _, present := manifest["publishConfig"]; present {
			violations = append(violations, manifestViolation(path, "publishConfig", "publication configuration is forbidden"))
		}
		if rawScripts, present := manifest["scripts"]; present {
			var scripts map[string]string
			if err := json.Unmarshal(rawScripts, &scripts); err != nil {
				violations = append(violations, manifestViolation(path, "scripts", "must be a string-valued JSON object"))
			} else {
				for name, command := range scripts {
					expectedCommand, allowed := rootDevelopmentScripts[name]
					if !allowed {
						violations = append(violations, manifestViolation(path, "scripts."+name, "only repository-development validation scripts are allowed"))
						continue
					}
					if command != expectedCommand {
						violations = append(violations, manifestViolation(path, "scripts."+name, "must invoke %q", expectedCommand))
					}
				}
			}
		}
	case productManifest:
		if _, present := manifest["bin"]; present {
			violations = append(violations, manifestViolation(path, "bin", "product executable entries are forbidden"))
		}
		if _, present := manifest["publishConfig"]; present {
			violations = append(violations, manifestViolation(path, "publishConfig", "product publication configuration is forbidden"))
		}

		var scripts map[string]json.RawMessage
		if rawScripts, present := manifest["scripts"]; present {
			if err := json.Unmarshal(rawScripts, &scripts); err != nil || scripts == nil {
				violations = append(violations, manifestViolation(path, "scripts", "must be a JSON object"))
			} else if len(scripts) != 0 {
				violations = append(violations, manifestViolation(path, "scripts", "product scripts are forbidden"))
			}
		}
	case codexManifest:
		violations = append(violations, validateCodexManifest(path, manifest)...)
	default:
		violations = append(violations, manifestViolation(path, "$", "unknown manifest kind %q", kind))
	}

	return violations
}

func validateCodexManifest(path string, manifest map[string]json.RawMessage) []error {
	var violations []error

	var name string
	if err := json.Unmarshal(manifest["name"], &name); err != nil || name != "dev-flow-codex" {
		violations = append(violations, manifestViolation(path, "name", "must be %q", "dev-flow-codex"))
	}

	var license string
	if err := json.Unmarshal(manifest["license"], &license); err != nil || license != "Apache-2.0" {
		violations = append(violations, manifestViolation(path, "license", "must be %q", "Apache-2.0"))
	}

	var repository map[string]string
	if err := json.Unmarshal(manifest["repository"], &repository); err != nil ||
		len(repository) != 3 || repository["type"] != "git" ||
		repository["url"] != "git+https://github.com/Innocent-children/dev-flow.git" ||
		repository["directory"] != "packages/codex" {
		violations = append(violations, manifestViolation(path, "repository", "must identify the public repository and packages/codex directory"))
	}

	var supportedOS []string
	if err := json.Unmarshal(manifest["os"], &supportedOS); err != nil || !slices.Equal(supportedOS, []string{"darwin"}) {
		violations = append(violations, manifestViolation(path, "os", "must equal [darwin]"))
	}
	var supportedCPU []string
	if err := json.Unmarshal(manifest["cpu"], &supportedCPU); err != nil || !slices.Equal(supportedCPU, []string{"arm64"}) {
		violations = append(violations, manifestViolation(path, "cpu", "must equal [arm64]"))
	}

	var publishConfig map[string]string
	if err := json.Unmarshal(manifest["publishConfig"], &publishConfig); err != nil || len(publishConfig) != 2 ||
		publishConfig["access"] != "public" || publishConfig["registry"] != "https://registry.npmjs.org/" {
		violations = append(violations, manifestViolation(path, "publishConfig", "must select public access at the official npm registry"))
	}

	var engines map[string]string
	if err := json.Unmarshal(manifest["engines"], &engines); err != nil || len(engines) != 1 || engines["node"] != ">=24" {
		violations = append(violations, manifestViolation(path, "engines", "must contain only node %q", ">=24"))
	}

	var bin map[string]string
	if err := json.Unmarshal(manifest["bin"], &bin); err != nil || len(bin) != 1 || bin["dev-flow-codex"] != "bin/dev-flow-codex.mjs" {
		violations = append(violations, manifestViolation(path, "bin", "must expose exactly dev-flow-codex at bin/dev-flow-codex.mjs"))
	}

	var files []string
	if err := json.Unmarshal(manifest["files"], &files); err != nil || !sameStringSet(files, codexPackageFiles) {
		violations = append(violations, manifestViolation(path, "files", "must equal the reviewed Codex package allowlist"))
	}

	var scripts map[string]string
	if err := json.Unmarshal(manifest["scripts"], &scripts); err != nil {
		violations = append(violations, manifestViolation(path, "scripts", "must be a string-valued JSON object"))
	} else {
		for name, command := range codexDevelopmentScripts {
			if scripts[name] != command {
				violations = append(violations, manifestViolation(path, "scripts."+name, "must invoke %q", command))
			}
		}
		for name := range scripts {
			if _, allowed := codexDevelopmentScripts[name]; !allowed {
				violations = append(violations, manifestViolation(path, "scripts."+name, "unreviewed, lifecycle, and publication scripts are forbidden"))
			}
		}
	}

	return violations
}

func sameStringSet(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	got = slices.Clone(got)
	want = slices.Clone(want)
	slices.Sort(got)
	slices.Sort(want)
	return slices.Equal(got, want)
}

func cloneStringMap(source map[string]string) map[string]string {
	clone := make(map[string]string, len(source))
	for key, value := range source {
		clone[key] = value
	}
	return clone
}

func cloneManifest(t *testing.T, source map[string]any) map[string]any {
	t.Helper()
	contents, err := json.Marshal(source)
	if err != nil {
		t.Fatalf("encode manifest template: %v", err)
	}
	var clone map[string]any
	if err := json.Unmarshal(contents, &clone); err != nil {
		t.Fatalf("decode manifest template: %v", err)
	}
	return clone
}

func readManifestObject(t *testing.T, path string) map[string]json.RawMessage {
	t.Helper()

	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read manifest %s: %v", path, err)
	}
	var manifest map[string]json.RawMessage
	if err := json.Unmarshal(contents, &manifest); err != nil {
		t.Fatalf("parse manifest %s: %v", path, err)
	}
	return manifest
}

func assertManifestString(t *testing.T, path string, manifest map[string]json.RawMessage, field, want string) {
	t.Helper()

	var got string
	if err := json.Unmarshal(manifest[field], &got); err != nil {
		t.Fatalf("manifest %s field %q: must be a string: %v", path, field, err)
	}
	if got != want {
		t.Errorf("manifest %s field %q = %q, want %q", path, field, got, want)
	}
}

func manifestViolation(path, field, format string, args ...any) error {
	return fmt.Errorf("manifest %s field %q: %s", path, field, fmt.Sprintf(format, args...))
}

func assertNoManifestViolations(t *testing.T, path string, kind manifestKind) {
	t.Helper()
	if violations := validatePackageManifest(path, kind); len(violations) != 0 {
		t.Fatalf("unexpected package manifest violations: %v", violations)
	}
}

func violationsContainField(violations []error, field string) bool {
	quotedField := fmt.Sprintf("field %q", field)
	for _, violation := range violations {
		if strings.Contains(violation.Error(), quotedField) {
			return true
		}
	}
	return false
}

func writeManifestFixture(t *testing.T, manifest string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "package.json")
	if err := os.WriteFile(path, []byte(manifest), 0o600); err != nil {
		t.Fatalf("write manifest fixture %s: %v", path, err)
	}
	return path
}

func manifestRepositoryRoot(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate package manifest contract test source")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(filename), "..", ".."))
}
