package contract_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"
)

const (
	releaseManifestSchemaID   = "https://dev-flow.local/schemas/release-manifest.schema.json"
	publicationRecordSchemaID = "https://dev-flow.local/schemas/publication-record.schema.json"
	releaseSchemaDraft        = "https://json-schema.org/draft/2020-12/schema"
)

var (
	releaseGitSHAPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
	releaseSHA256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	releasePathPattern   = regexp.MustCompile(`^[A-Za-z0-9._@+,-]+(?:/[A-Za-z0-9._@+,-]+)*$`)
	releaseSemVerPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)
)

type releaseIdentityFixture struct {
	Version           string `json:"version"`
	Tag               string `json:"tag"`
	SourceCommit      string `json:"source_commit"`
	SourceTree        string `json:"source_tree"`
	CoreFixtureDigest string `json:"core_fixture_digest"`
	Feature003Commit  string `json:"feature_003_commit"`
	Feature005Commit  string `json:"feature_005_commit"`
	BuildProfile      string `json:"build_profile"`
	CreatedAt         string `json:"created_at"`
}

type releaseToolchainsFixture struct {
	Go   string `json:"go"`
	Node string `json:"node"`
	PNPM string `json:"pnpm"`
	NPM  string `json:"npm"`
	Git  string `json:"git"`
	GH   string `json:"gh"`
}

type releaseArtifactFixture struct {
	Name         string  `json:"name"`
	Kind         string  `json:"kind"`
	RelativePath string  `json:"relative_path"`
	SizeBytes    int64   `json:"size_bytes"`
	SHA256       string  `json:"sha256"`
	Mode         string  `json:"mode"`
	NPMIntegrity *string `json:"npm_integrity"`
	SourceCommit string  `json:"source_commit"`
	CoreVersion  *string `json:"core_version"`
}

type releasePackageFileFixture struct {
	Path      string `json:"path"`
	SizeBytes int64  `json:"size_bytes"`
	SHA256    string `json:"sha256"`
	Mode      string `json:"mode"`
}

type releaseSupportFixture struct {
	OS                   string  `json:"os"`
	Arch                 string  `json:"arch"`
	ActualCodexVersion   string  `json:"actual_codex_version"`
	CompatibleCodexRange string  `json:"compatible_codex_range"`
	PackageSHA256        string  `json:"package_sha256"`
	CoreSHA256           string  `json:"core_sha256"`
	JourneyResult        string  `json:"journey_result"`
	JourneyObservedAt    *string `json:"journey_observed_at"`
	Notes                string  `json:"notes"`
}

type releaseValidationFixture struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Summary string `json:"summary"`
}

type releaseManifestFixture struct {
	SchemaVersion int                         `json:"schema_version"`
	Release       releaseIdentityFixture      `json:"release"`
	Toolchains    releaseToolchainsFixture    `json:"toolchains"`
	Artifacts     []releaseArtifactFixture    `json:"artifacts"`
	PackageFiles  []releasePackageFileFixture `json:"package_files"`
	Support       []releaseSupportFixture     `json:"support"`
	Validations   []releaseValidationFixture  `json:"validations"`
}

type publicationIdentityFixture struct {
	Version      string `json:"version"`
	Tag          string `json:"tag"`
	SourceCommit string `json:"source_commit"`
	SourceTree   string `json:"source_tree"`
}

type publicationStepFixture struct {
	Name           string  `json:"name"`
	Status         string  `json:"status"`
	StartedAt      *string `json:"started_at"`
	CompletedAt    *string `json:"completed_at"`
	RemoteID       *string `json:"remote_id"`
	ExpectedSHA256 *string `json:"expected_sha256"`
	ObservedSHA256 *string `json:"observed_sha256"`
	ErrorCode      *string `json:"error_code"`
	Summary        string  `json:"summary"`
	SafeNextAction string  `json:"safe_next_action"`
}

type publicationNPMFixture struct {
	Name          string  `json:"name"`
	Version       string  `json:"version"`
	Published     bool    `json:"published"`
	Integrity     *string `json:"integrity"`
	TarballSHA256 *string `json:"tarball_sha256"`
	Verified      bool    `json:"verified"`
}

type publicationAssetFixture struct {
	Name     string `json:"name"`
	AssetID  *int64 `json:"asset_id"`
	SHA256   string `json:"sha256"`
	Verified bool   `json:"verified"`
}

type publicationGitHubFixture struct {
	Tag       string                    `json:"tag"`
	TagTarget *string                   `json:"tag_target"`
	ReleaseID *int64                    `json:"release_id"`
	Draft     bool                      `json:"draft"`
	Published bool                      `json:"published"`
	Assets    []publicationAssetFixture `json:"assets"`
}

type publicationJourneyFixture struct {
	Status             string  `json:"status"`
	ActualCodexVersion *string `json:"actual_codex_version"`
	ObservedAt         *string `json:"observed_at"`
	Summary            string  `json:"summary"`
}

type publicationRecordFixture struct {
	SchemaVersion  int                        `json:"schema_version"`
	Release        publicationIdentityFixture `json:"release"`
	OverallStatus  string                     `json:"overall_status"`
	ManifestSHA256 string                     `json:"manifest_sha256"`
	Steps          []publicationStepFixture   `json:"steps"`
	NPM            publicationNPMFixture      `json:"npm"`
	GitHub         publicationGitHubFixture   `json:"github"`
	FinalJourney   publicationJourneyFixture  `json:"final_journey"`
	LastObservedAt string                     `json:"last_observed_at"`
	SafeNextAction string                     `json:"safe_next_action"`
}

type releaseNegativeSuite struct {
	SchemaVersion int                   `json:"schema_version"`
	Cases         []releaseNegativeCase `json:"cases"`
}

type releaseNegativeCase struct {
	Name          string `json:"name"`
	Target        string `json:"target"`
	Operation     string `json:"operation"`
	Path          []any  `json:"path"`
	Value         any    `json:"value"`
	Count         int    `json:"count,omitempty"`
	ExpectedError string `json:"expected_error"`
}

func TestCurrentReleaseSchemasRemainClosed(t *testing.T) {
	t.Parallel()

	root := contractRepositoryRoot(t)
	tests := []struct {
		name           string
		implementation string
		id             string
		rootRequired   []string
	}{
		{
			name:           "publication record",
			implementation: "release/schemas/publication-record.schema.json",
			id:             publicationRecordSchemaID,
			rootRequired:   []string{"release", "overall_status", "manifest_sha256", "steps", "npm", "github", "final_journey", "last_observed_at", "safe_next_action"},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			implementationBytes := releaseReadFile(t, root, test.implementation)
			var schema map[string]any
			if err := json.Unmarshal(implementationBytes, &schema); err != nil {
				t.Fatalf("parse %s: %v", test.implementation, err)
			}
			if schema["$schema"] != releaseSchemaDraft || schema["$id"] != test.id || schema["type"] != "object" {
				t.Fatalf("unexpected schema identity: draft=%v id=%v type=%v", schema["$schema"], schema["$id"], schema["type"])
			}
			releaseAssertClosedSchemaObject(t, schema, test.rootRequired)
			releaseAssertNoForbiddenSchemaFields(t, schema)
		})
	}

	manifest := releaseReadSchema(t, root, "release/schemas/release-manifest.schema.json")
	if manifest["$schema"] != releaseSchemaDraft || manifest["$id"] != releaseManifestSchemaID || manifest["type"] != "object" {
		t.Fatal("current standalone release manifest schema identity is invalid")
	}
	releaseAssertClosedSchemaObject(t, manifest, []string{"release", "toolchains", "artifacts", "package_files", "support", "validations"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, manifest, "properties", "release"), []string{
		"product", "version", "core_version", "tag", "source_commit", "source_tree",
		"verification_mode", "based_on_release", "created_at",
	})
	releaseProperties := releaseSchemaAt(t, manifest, "properties", "release", "properties")
	if releaseSchemaAt(t, releaseProperties, "product")["const"] != "codex" {
		t.Fatal("current release manifest does not bind the Codex product")
	}
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, manifest, "properties", "toolchains"), []string{"go", "node", "pnpm", "npm", "git", "gh"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, manifest, "properties", "artifacts", "items"), []string{"name", "kind", "relative_path", "size_bytes", "sha256", "mode", "source_commit"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, manifest, "properties", "package_files", "items"), []string{"path", "size_bytes", "sha256", "mode"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, manifest, "properties", "support", "items"), []string{
		"os", "arch", "actual_codex_version", "compatible_codex_range", "package_sha256", "core_sha256", "journey_result", "journey_observed_at", "verification_mode", "based_on_release", "notes",
	})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, manifest, "properties", "validations", "items"), []string{"name", "status", "summary"})
	support := releaseSchemaAt(t, manifest, "properties", "support")
	if support["minItems"] != float64(1) || support["maxItems"] != float64(1) {
		t.Fatal("release support schema must require exactly one platform entry")
	}
	if releaseSchemaAt(t, support, "items", "properties", "os")["const"] != "darwin" || releaseSchemaAt(t, support, "items", "properties", "arch")["const"] != "arm64" {
		t.Fatal("release support schema must remain darwin-arm64 only")
	}

	publication := releaseReadSchema(t, root, "release/schemas/publication-record.schema.json")
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, publication, "properties", "release"), []string{"product", "version", "core_version", "tag", "source_commit", "source_tree", "verification_mode", "based_on_release"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, publication, "properties", "npm"), []string{"name", "version", "published", "integrity", "tarball_sha256", "verified"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, publication, "properties", "github"), []string{"tag", "tag_target", "release_id", "draft", "published", "assets"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, publication, "properties", "github", "properties", "assets", "items"), []string{"name", "asset_id", "sha256", "verified"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, publication, "properties", "final_journey"), []string{"status", "actual_codex_version", "observed_at", "summary"})
	releaseAssertClosedSchemaObject(t, releaseSchemaAt(t, publication, "$defs", "publicationStep"), []string{
		"name", "status", "started_at", "completed_at", "remote_id", "expected_sha256", "observed_sha256", "error_code", "summary", "safe_next_action",
	})

	manifestProperties := releaseSchemaAt(t, manifest, "properties")
	for _, mutable := range []string{"overall_status", "steps", "last_observed_at", "safe_next_action"} {
		if _, ok := manifestProperties[mutable]; ok {
			t.Fatalf("immutable release manifest contains mutable publication field %s", mutable)
		}
	}
	publicationProperties := releaseSchemaAt(t, publication, "properties")
	for _, immutable := range []string{"artifacts", "package_files", "support", "toolchains", "validations"} {
		if _, ok := publicationProperties[immutable]; ok {
			t.Fatalf("mutable publication record duplicates immutable manifest field %s", immutable)
		}
	}
}

func TestReleaseFixturesCrossIdentityAndDeterministicCollections(t *testing.T) {
	t.Parallel()

	root := contractRepositoryRoot(t)
	manifestObject := releaseReadObject(t, root, "release/testdata/valid-release-manifest.json")
	publicationObject := releaseReadObject(t, root, "release/testdata/valid-publication-record.json")
	manifest, err := releaseValidateManifest(manifestObject)
	if err != nil {
		t.Fatalf("valid release manifest: %v", err)
	}
	publication, err := releaseValidatePublication(publicationObject)
	if err != nil {
		t.Fatalf("valid publication record: %v", err)
	}
	if err := releaseValidatePair(manifest, publication); err != nil {
		t.Fatalf("cross-identity contract: %v", err)
	}

	if manifest.Release.Version != "0.1.0" {
		t.Fatalf("Feature 006 frozen release fixture version = %s, want 0.1.0", manifest.Release.Version)
	}
	if manifest.Release.CoreFixtureDigest != "sha256:"+sharedFixtureAggregateSHA256 {
		t.Fatalf("Core fixture digest = %s, want existing contract-tested aggregate sha256:%s", manifest.Release.CoreFixtureDigest, sharedFixtureAggregateSHA256)
	}
}

func TestReleaseChecksumsAndInitialPublicationStateAreNonCircular(t *testing.T) {
	t.Parallel()

	root := contractRepositoryRoot(t)
	manifestBytes := releaseReadFile(t, root, "release/testdata/valid-release-manifest.json")
	manifest := releaseReadObject(t, root, "release/testdata/valid-release-manifest.json")
	publicationObject := releaseReadObject(t, root, "release/testdata/valid-publication-record.json")
	publication, err := releaseValidatePublication(publicationObject)
	if err != nil {
		t.Fatalf("validate initial publication fixture: %v", err)
	}
	manifestDigest := sha256Hex(manifestBytes)
	if publication.ManifestSHA256 != manifestDigest {
		t.Fatalf("publication manifest digest = %s, want fixture bytes %s", publication.ManifestSHA256, manifestDigest)
	}
	if publication.Steps[0].Status != "complete" {
		t.Fatal("prepared publication preflight step must be complete")
	}
	for _, step := range publication.Steps[1:] {
		if step.Status != "pending" {
			t.Fatalf("prepared publication step %s = %s, want pending", step.Name, step.Status)
		}
	}
	if publication.NPM.Published || publication.NPM.Verified || publication.GitHub.TagTarget != nil || publication.GitHub.ReleaseID != nil || publication.GitHub.Draft || publication.GitHub.Published || len(publication.GitHub.Assets) != 0 || publication.FinalJourney.Status != "pending" {
		t.Fatal("prepared publication fixture claims remote or final-journey state")
	}

	artifacts := manifest["artifacts"].([]any)
	if len(artifacts) != 2 {
		t.Fatalf("manifest immutable artifact count = %d, want 2", len(artifacts))
	}
	artifactDigests := make(map[string]string, len(artifacts))
	for _, value := range artifacts {
		artifact := value.(map[string]any)
		name := artifact["name"].(string)
		if name == "release-manifest.json" || name == "publication-record.json" || name == "SHA256SUMS" {
			t.Fatalf("manifest inventories circular or mutable artifact %q", name)
		}
		artifactDigests[name] = artifact["sha256"].(string)
		if artifact["source_commit"] != manifest["release"].(map[string]any)["source_commit"] {
			t.Fatalf("artifact %s source differs from release identity", name)
		}
	}
	artifactDigests["release-manifest.json"] = manifestDigest

	checksumBytes := releaseReadFile(t, root, "release/testdata/valid-SHA256SUMS")
	lines := strings.Split(strings.TrimSuffix(string(checksumBytes), "\n"), "\n")
	names := make([]string, 0, len(lines))
	observed := make(map[string]string, len(lines))
	for _, line := range lines {
		parts := strings.SplitN(line, "  ", 2)
		if len(parts) != 2 || !releaseSHA256Pattern.MatchString(parts[0]) {
			t.Fatalf("invalid checksum fixture line %q", line)
		}
		if err := releaseValidateRelativePath(parts[1]); err != nil {
			t.Fatalf("checksum path: %v", err)
		}
		if _, exists := observed[parts[1]]; exists {
			t.Fatalf("duplicate checksum path %q", parts[1])
		}
		observed[parts[1]] = parts[0]
		names = append(names, parts[1])
	}
	if !slices.IsSorted(names) || len(names) != 3 {
		t.Fatalf("checksum names = %v, want three stable sorted entries", names)
	}
	if _, exists := observed["SHA256SUMS"]; exists {
		t.Fatal("checksums must not hash themselves")
	}
	if _, exists := observed["publication-record.json"]; exists {
		t.Fatal("checksums must not hash the mutable publication record")
	}
	if !mapsEqualString(observed, artifactDigests) {
		t.Fatalf("checksums = %v, want immutable payload digests %v", observed, artifactDigests)
	}
}

func TestReleaseNegativeFixturesRejectUnsafeContentAndIdentityDrift(t *testing.T) {
	t.Parallel()

	root := contractRepositoryRoot(t)
	baseManifest := releaseReadObject(t, root, "release/testdata/valid-release-manifest.json")
	basePublication := releaseReadObject(t, root, "release/testdata/valid-publication-record.json")
	var suite releaseNegativeSuite
	releaseReadClosedJSON(t, releaseReadFile(t, root, "release/testdata/invalid-release-fixtures.json"), &suite)
	if suite.SchemaVersion != 1 || len(suite.Cases) != 17 {
		t.Fatalf("negative fixture suite identity/count = %d/%d, want 1/17", suite.SchemaVersion, len(suite.Cases))
	}

	for _, test := range suite.Cases {
		test := test
		t.Run(test.Name, func(t *testing.T) {
			document := releaseCloneObject(t, map[string]map[string]any{
				"manifest":    baseManifest,
				"publication": basePublication,
			}[test.Target])
			if document == nil {
				t.Fatalf("unknown negative fixture target %q", test.Target)
			}
			if err := releaseApplyMutation(document, test); err != nil {
				t.Fatalf("apply fixture mutation: %v", err)
			}
			var err error
			switch test.Target {
			case "manifest":
				_, err = releaseValidateManifest(document)
			case "publication":
				_, err = releaseValidatePublication(document)
			}
			if err == nil || !strings.Contains(err.Error(), test.ExpectedError) {
				t.Fatalf("validation error = %v, want substring %q", err, test.ExpectedError)
			}
		})
	}
}

func TestReleaseValidationEntrypointsRemainPreparationSafe(t *testing.T) {
	t.Parallel()

	root := contractRepositoryRoot(t)
	rootManifest := releaseReadObject(t, root, "package.json")
	scripts, ok := rootManifest["scripts"].(map[string]any)
	if !ok {
		t.Fatal("root package scripts must be an object")
	}
	expected := map[string]string{
		"release:codex":         "node ./scripts/release-codex.mjs",
		"release:codex:prepare": "./scripts/build-codex-release.sh",
		"release:codex:verify":  "node ./scripts/verify-codex-release.mjs",
		"release:codex:publish": "node ./scripts/publish-codex-release.mjs",
	}
	for name, command := range expected {
		if scripts[name] != command {
			t.Errorf("root script %s = %v, want %q", name, scripts[name], command)
		}
	}
	for _, hook := range []string{"preinstall", "install", "postinstall", "prepare", "preuninstall", "uninstall"} {
		if _, exists := scripts[hook]; exists {
			t.Errorf("root package must not define lifecycle hook %s", hook)
		}
	}

	validator := string(releaseReadFile(t, root, "scripts/validate-repository.sh"))
	workflow := string(releaseReadFile(t, root, ".github/workflows/ci.yml"))
	prepare := string(releaseReadFile(t, root, "scripts/build-codex-release.sh"))
	verifier := string(releaseReadFile(t, root, "scripts/verify-codex-release.mjs"))
	publisher := string(releaseReadFile(t, root, "scripts/publish-codex-release.mjs"))
	for _, required := range []string{
		"go test ./...",
		"node --test packages/codex/tests/package-contract.test.mjs",
		"packages/deepseek/tests/package-contract.test.mjs",
		"packages/deepseek/tests/bundle-contract.test.mjs",
		"packages/deepseek/tests/paths.test.mjs",
		"packages/deepseek/tests/authorization.test.mjs",
		"packages/deepseek/tests/integration-plugin.test.mjs",
		"packages/deepseek/tests/mcp-result-gate.test.mjs",
		"packages/deepseek/tests/skill-contract.test.mjs",
		"tests/journeys/deepseek/simulated-graph-journey.test.mjs",
		"node --test packages/codex/tests/release-command.test.mjs",
		"node --check scripts/release-codex.mjs",
	} {
		if !strings.Contains(validator, required) {
			t.Errorf("validator missing preparation-safe command %q", required)
		}
	}
	if strings.Contains(workflow, "RELEASE_BASE_SHA") || strings.Contains(validator, "RELEASE_BASE_SHA") {
		t.Error("pull-request validation must not retain the obsolete DeepSeek comparison baseline")
	}
	for _, source := range []struct {
		name string
		text string
	}{{"validator", validator}, {"pull-request workflow", workflow}} {
		for _, forbidden := range []string{"npm whoami", "npm publish", "gh auth status", "gh release create", "gh release upload", "git tag", "git push"} {
			if strings.Contains(source.text, forbidden) {
				t.Errorf("%s invokes forbidden release operation %q", source.name, forbidden)
			}
		}
	}
	for _, forbidden := range []string{"npm publish", "npm whoami", "npm view", "gh release", "git tag", "git push"} {
		if strings.Contains(strings.ToLower(prepare), forbidden) {
			t.Errorf("release prepare invokes forbidden remote/host operation %q", forbidden)
		}
	}
	for _, forbidden := range []string{"gh release", "gh api", "gh auth", "npm publish", "npm whoami", "npm view", "git tag", "git push"} {
		if strings.Contains(verifier, forbidden) {
			t.Errorf("release verifier invokes forbidden remote operation %q", forbidden)
		}
	}
	if strings.Contains(publisher, "shell: true") || !strings.Contains(publisher, "shell: false") {
		t.Error("release publisher must use argv-closed commands with shell disabled")
	}
	if strings.Contains(workflow, "publish-codex-release.mjs") || strings.Contains(workflow, "release:codex") ||
		strings.Contains(validator, "publish-codex-release.mjs --") || strings.Contains(validator, "release:codex --") {
		t.Error("CI/validator must syntax-check but never execute the publisher")
	}
}

func releaseValidateManifest(document map[string]any) (releaseManifestFixture, error) {
	if err := releaseValidateForbiddenContent(document); err != nil {
		return releaseManifestFixture{}, err
	}
	var manifest releaseManifestFixture
	if err := releaseDecodeClosed(document, &manifest); err != nil {
		return manifest, err
	}
	if manifest.SchemaVersion != 1 {
		return manifest, fmt.Errorf("schema_version must equal 1")
	}
	if !releaseSemVerPattern.MatchString(manifest.Release.Version) || manifest.Release.Tag != "v"+manifest.Release.Version {
		return manifest, fmt.Errorf("release version/tag mismatch")
	}
	for name, value := range map[string]string{
		"source_commit":      manifest.Release.SourceCommit,
		"source_tree":        manifest.Release.SourceTree,
		"feature_003_commit": manifest.Release.Feature003Commit,
		"feature_005_commit": manifest.Release.Feature005Commit,
	} {
		if !releaseGitSHAPattern.MatchString(value) {
			return manifest, fmt.Errorf("%s must be a Git SHA", name)
		}
	}
	if manifest.Release.CoreFixtureDigest != "sha256:"+sharedFixtureAggregateSHA256 {
		return manifest, fmt.Errorf("core fixture digest must use the existing contract-tested aggregate")
	}
	if manifest.Release.BuildProfile != "codex-darwin-arm64-v1" {
		return manifest, fmt.Errorf("build profile must remain codex-darwin-arm64-v1")
	}
	if _, err := time.Parse(time.RFC3339, manifest.Release.CreatedAt); err != nil {
		return manifest, fmt.Errorf("release created_at must be RFC 3339: %w", err)
	}
	for name, value := range map[string]string{
		"go": manifest.Toolchains.Go, "node": manifest.Toolchains.Node, "pnpm": manifest.Toolchains.PNPM,
		"npm": manifest.Toolchains.NPM, "git": manifest.Toolchains.Git, "gh": manifest.Toolchains.GH,
	} {
		if value == "" {
			return manifest, fmt.Errorf("toolchain %s must be bounded and nonempty", name)
		}
	}
	if len(manifest.Artifacts) != 2 {
		return manifest, fmt.Errorf("manifest must inventory exactly two immutable artifacts")
	}
	if err := releaseRequireSorted(manifest.Artifacts, func(value releaseArtifactFixture) string { return value.Name }, "artifacts"); err != nil {
		return manifest, err
	}
	artifactDigests := map[string]string{}
	for _, artifact := range manifest.Artifacts {
		if artifact.Kind != "npm_tarball" && artifact.Kind != "core_binary" {
			return manifest, fmt.Errorf("unexpected artifact kind %q", artifact.Kind)
		}
		if _, exists := artifactDigests[artifact.Kind]; exists {
			return manifest, fmt.Errorf("duplicate artifact kind %q", artifact.Kind)
		}
		if err := releaseValidateRelativePath(artifact.RelativePath); err != nil {
			return manifest, err
		}
		if !releaseSHA256Pattern.MatchString(artifact.SHA256) {
			return manifest, fmt.Errorf("artifact %s has invalid SHA-256", artifact.Name)
		}
		if artifact.SourceCommit != manifest.Release.SourceCommit || artifact.CoreVersion == nil || *artifact.CoreVersion != manifest.Release.Version {
			return manifest, fmt.Errorf("artifact %s identity differs from the release", artifact.Name)
		}
		artifactDigests[artifact.Kind] = artifact.SHA256
	}
	if err := releaseRequireSorted(manifest.PackageFiles, func(value releasePackageFileFixture) string { return value.Path }, "package_files"); err != nil {
		return manifest, err
	}
	var packagedCoreDigest string
	for _, file := range manifest.PackageFiles {
		if err := releaseValidateRelativePath(file.Path); err != nil {
			return manifest, err
		}
		if !releaseSHA256Pattern.MatchString(file.SHA256) {
			return manifest, fmt.Errorf("package file %s has invalid SHA-256", file.Path)
		}
		if file.Path == "runtime/darwin-arm64/dev-flow" {
			packagedCoreDigest = file.SHA256
		}
	}
	if packagedCoreDigest == "" || packagedCoreDigest != artifactDigests["core_binary"] {
		return manifest, fmt.Errorf("bundled and standalone Core digests must match")
	}
	if len(manifest.Support) != 1 {
		return manifest, fmt.Errorf("manifest must contain exactly one support entry")
	}
	support := manifest.Support[0]
	if support.OS != "darwin" || support.Arch != "arm64" {
		return manifest, fmt.Errorf("support entry must remain darwin-arm64")
	}
	if support.CompatibleCodexRange != ">=0.147.0 <0.148.0" {
		return manifest, fmt.Errorf("support entry has the wrong Codex compatibility range")
	}
	if support.PackageSHA256 != artifactDigests["npm_tarball"] {
		return manifest, fmt.Errorf("support package digest does not match the npm tarball")
	}
	if support.CoreSHA256 != artifactDigests["core_binary"] {
		return manifest, fmt.Errorf("support Core digest does not match the Core binary")
	}
	if err := releaseRequireSorted(manifest.Validations, func(value releaseValidationFixture) string { return value.Name }, "validations"); err != nil {
		return manifest, err
	}
	return manifest, nil
}

func releaseValidatePublication(document map[string]any) (publicationRecordFixture, error) {
	if err := releaseValidateForbiddenContent(document); err != nil {
		return publicationRecordFixture{}, err
	}
	var publication publicationRecordFixture
	if err := releaseDecodeClosed(document, &publication); err != nil {
		return publication, err
	}
	if publication.SchemaVersion != 1 || publication.OverallStatus != "prepared" {
		return publication, fmt.Errorf("initial publication record must use schema 1 and prepared status")
	}
	if !releaseSemVerPattern.MatchString(publication.Release.Version) || publication.Release.Tag != "v"+publication.Release.Version {
		return publication, fmt.Errorf("publication release version/tag mismatch")
	}
	if !releaseGitSHAPattern.MatchString(publication.Release.SourceCommit) || !releaseGitSHAPattern.MatchString(publication.Release.SourceTree) {
		return publication, fmt.Errorf("publication source identity must use Git SHAs")
	}
	if !releaseSHA256Pattern.MatchString(publication.ManifestSHA256) {
		return publication, fmt.Errorf("publication manifest digest must be SHA-256")
	}
	expectedSteps := []string{"preflight", "tag", "github_draft", "npm_publish", "npm_readback", "final_journey", "github_upload", "github_readback", "github_finalize"}
	if len(publication.Steps) != len(expectedSteps) {
		return publication, fmt.Errorf("publication record must contain exactly nine ordered steps")
	}
	for index, step := range publication.Steps {
		if step.Name != expectedSteps[index] {
			return publication, fmt.Errorf("publication step %d = %q, want %q", index, step.Name, expectedSteps[index])
		}
		for _, digest := range []*string{step.ExpectedSHA256, step.ObservedSHA256} {
			if digest != nil && !releaseSHA256Pattern.MatchString(*digest) {
				return publication, fmt.Errorf("publication step %s has invalid digest", step.Name)
			}
		}
	}
	if publication.NPM.Name != "dev-flow-codex" || publication.NPM.Version != publication.Release.Version {
		return publication, fmt.Errorf("publication npm identity differs from release identity")
	}
	if publication.GitHub.Tag != publication.Release.Tag {
		return publication, fmt.Errorf("publication GitHub tag differs from release identity")
	}
	if err := releaseRequireSorted(publication.GitHub.Assets, func(value publicationAssetFixture) string { return value.Name }, "github assets"); err != nil {
		return publication, err
	}
	for _, asset := range publication.GitHub.Assets {
		if !releaseSHA256Pattern.MatchString(asset.SHA256) {
			return publication, fmt.Errorf("GitHub asset %s has invalid SHA-256", asset.Name)
		}
	}
	if _, err := time.Parse(time.RFC3339, publication.LastObservedAt); err != nil {
		return publication, fmt.Errorf("last_observed_at must be RFC 3339: %w", err)
	}
	return publication, nil
}

func releaseValidatePair(manifest releaseManifestFixture, publication publicationRecordFixture) error {
	if manifest.Release.Version != publication.Release.Version ||
		manifest.Release.Tag != publication.Release.Tag ||
		manifest.Release.SourceCommit != publication.Release.SourceCommit ||
		manifest.Release.SourceTree != publication.Release.SourceTree {
		return fmt.Errorf("manifest and publication release identities differ")
	}
	return nil
}

func releaseValidateForbiddenContent(value any) error {
	return releaseWalkForbiddenContent(value, "")
}

func releaseWalkForbiddenContent(value any, field string) error {
	switch typed := value.(type) {
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			switch strings.ToLower(key) {
			case "token", "npm_token", "secret", "credentials", "auth_header", "auth_file", "environment", "environment_values", "raw_prompt", "raw_output", "raw_stdout", "raw_stderr", "raw_command_output", "command_output":
				return fmt.Errorf("forbidden field %s", key)
			}
		}
		for _, key := range keys {
			if err := releaseWalkForbiddenContent(typed[key], key); err != nil {
				return err
			}
		}
	case []any:
		for _, item := range typed {
			if err := releaseWalkForbiddenContent(item, field); err != nil {
				return err
			}
		}
	case string:
		lower := strings.ToLower(typed)
		if strings.Contains(lower, "dev-flow-deepseek") {
			return fmt.Errorf("forbidden DeepSeek content")
		}
		if pathpkg.Base(typed) == ".npmrc" || strings.Contains(lower, "/.npmrc") {
			return fmt.Errorf("forbidden auth file .npmrc")
		}
		if strings.Contains(lower, "example-token-marker") {
			return fmt.Errorf("forbidden credential marker")
		}
		if strings.Contains(typed, "HOME=") || strings.Contains(typed, "PATH=") {
			return fmt.Errorf("forbidden environment value")
		}
		if strings.HasPrefix(typed, "/Users/") || strings.HasPrefix(typed, "/home/") || strings.HasPrefix(typed, "/private/var/") || strings.HasPrefix(typed, "/var/folders/") {
			return fmt.Errorf("forbidden machine absolute path")
		}
		if (field == "summary" || field == "notes" || field == "safe_next_action") && len(typed) > 1000 {
			return fmt.Errorf("unbounded summary field %s", field)
		}
	}
	return nil
}

func releaseValidateRelativePath(value string) error {
	if value == "" || strings.Contains(value, "\\") || strings.HasPrefix(value, "/") || pathpkg.Clean(value) != value || !releasePathPattern.MatchString(value) {
		return fmt.Errorf("unsafe relative path %q", value)
	}
	for _, component := range strings.Split(value, "/") {
		if component == ".." {
			return fmt.Errorf("unsafe relative path %q", value)
		}
	}
	return nil
}

func releaseRequireSorted[T any](values []T, key func(T) string, label string) error {
	keys := make([]string, len(values))
	for index, value := range values {
		keys[index] = key(value)
	}
	sorted := slices.Clone(keys)
	sort.Strings(sorted)
	if !slices.Equal(keys, sorted) {
		return fmt.Errorf("%s must use stable sorted order", label)
	}
	for index := 1; index < len(keys); index++ {
		if keys[index] == keys[index-1] {
			return fmt.Errorf("%s contains duplicate key %q", label, keys[index])
		}
	}
	return nil
}

func releaseDecodeClosed(document map[string]any, destination any) error {
	contents, err := json.Marshal(document)
	if err != nil {
		return fmt.Errorf("encode fixture: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(contents))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("closed fixture decode: %w", err)
	}
	return nil
}

func releaseApplyMutation(document map[string]any, mutation releaseNegativeCase) error {
	if len(mutation.Path) == 0 {
		return fmt.Errorf("mutation path is empty")
	}
	var current any = document
	for _, segment := range mutation.Path[:len(mutation.Path)-1] {
		var err error
		current, err = releaseMutationChild(current, segment)
		if err != nil {
			return err
		}
	}
	last := mutation.Path[len(mutation.Path)-1]
	switch mutation.Operation {
	case "set":
		switch parent := current.(type) {
		case map[string]any:
			key, ok := last.(string)
			if !ok {
				return fmt.Errorf("object mutation key is %T", last)
			}
			parent[key] = mutation.Value
		case []any:
			index, err := releaseMutationIndex(last, len(parent))
			if err != nil {
				return err
			}
			parent[index] = mutation.Value
		default:
			return fmt.Errorf("cannot set child on %T", current)
		}
	case "append":
		parent, ok := current.(map[string]any)
		if !ok {
			return fmt.Errorf("append parent is %T", current)
		}
		key, ok := last.(string)
		if !ok {
			return fmt.Errorf("append key is %T", last)
		}
		items, ok := parent[key].([]any)
		if !ok {
			return fmt.Errorf("append target %s is %T", key, parent[key])
		}
		parent[key] = append(items, mutation.Value)
	case "repeat":
		parent, ok := current.(map[string]any)
		if !ok {
			return fmt.Errorf("repeat parent is %T", current)
		}
		key, ok := last.(string)
		value, valueOK := mutation.Value.(string)
		if !ok || !valueOK || mutation.Count < 1 || mutation.Count > 2000 {
			return fmt.Errorf("invalid repeat mutation")
		}
		parent[key] = strings.Repeat(value, mutation.Count)
	default:
		return fmt.Errorf("unknown mutation operation %q", mutation.Operation)
	}
	return nil
}

func releaseMutationChild(current any, segment any) (any, error) {
	switch parent := current.(type) {
	case map[string]any:
		key, ok := segment.(string)
		if !ok {
			return nil, fmt.Errorf("object path segment is %T", segment)
		}
		child, exists := parent[key]
		if !exists {
			return nil, fmt.Errorf("object path %q does not exist", key)
		}
		return child, nil
	case []any:
		index, err := releaseMutationIndex(segment, len(parent))
		if err != nil {
			return nil, err
		}
		return parent[index], nil
	default:
		return nil, fmt.Errorf("cannot traverse %T", current)
	}
}

func releaseMutationIndex(value any, length int) (int, error) {
	number, ok := value.(float64)
	if !ok || number != float64(int(number)) || int(number) < 0 || int(number) >= length {
		return 0, fmt.Errorf("invalid array index %v", value)
	}
	return int(number), nil
}

func releaseReadSchema(t *testing.T, root, relativePath string) map[string]any {
	t.Helper()
	return releaseReadObject(t, root, relativePath)
}

func releaseReadObject(t *testing.T, root, relativePath string) map[string]any {
	t.Helper()
	var value map[string]any
	if err := json.Unmarshal(releaseReadFile(t, root, relativePath), &value); err != nil {
		t.Fatalf("parse %s: %v", relativePath, err)
	}
	if value == nil {
		t.Fatalf("%s must contain a JSON object", relativePath)
	}
	return value
}

func releaseReadClosedJSON(t *testing.T, contents []byte, destination any) {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(contents))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		t.Fatalf("decode closed fixture: %v", err)
	}
}

func releaseReadFile(t *testing.T, root, relativePath string) []byte {
	t.Helper()
	contents, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(relativePath)))
	if err != nil {
		t.Fatalf("read %s: %v", relativePath, err)
	}
	return contents
}

func releaseCloneObject(t *testing.T, source map[string]any) map[string]any {
	t.Helper()
	if source == nil {
		return nil
	}
	contents, err := json.Marshal(source)
	if err != nil {
		t.Fatalf("encode fixture clone: %v", err)
	}
	var clone map[string]any
	if err := json.Unmarshal(contents, &clone); err != nil {
		t.Fatalf("decode fixture clone: %v", err)
	}
	return clone
}

func releaseSchemaAt(t *testing.T, value map[string]any, path ...string) map[string]any {
	t.Helper()
	var current any = value
	for _, segment := range path {
		object, ok := current.(map[string]any)
		if !ok {
			t.Fatalf("schema path %s reaches %T", strings.Join(path, "."), current)
		}
		current, ok = object[segment]
		if !ok {
			t.Fatalf("schema path %s is missing segment %s", strings.Join(path, "."), segment)
		}
	}
	object, ok := current.(map[string]any)
	if !ok {
		t.Fatalf("schema path %s is %T, want object", strings.Join(path, "."), current)
	}
	return object
}

func releaseAssertClosedSchemaObject(t *testing.T, schema map[string]any, required []string) {
	t.Helper()
	if schema["type"] != "object" || schema["additionalProperties"] != false {
		t.Fatalf("schema object must have type=object and additionalProperties=false: %#v", schema)
	}
	actualValues, ok := schema["required"].([]any)
	if !ok {
		t.Fatalf("schema object required is %T", schema["required"])
	}
	actual := make([]string, len(actualValues))
	for index, value := range actualValues {
		actual[index], ok = value.(string)
		if !ok {
			t.Fatalf("schema required entry %d is %T", index, value)
		}
	}
	if !slices.Equal(actual, required) {
		t.Fatalf("schema required = %v, want exact contract %v", actual, required)
	}
}

func releaseAssertNoForbiddenSchemaFields(t *testing.T, schema map[string]any) {
	t.Helper()
	contents, err := json.Marshal(schema)
	if err != nil {
		t.Fatalf("encode schema: %v", err)
	}
	lower := strings.ToLower(string(contents))
	for _, forbidden := range []string{"deepseek", "credential", "raw_prompt", "raw_command_output", "home_path", "environment_values"} {
		if strings.Contains(lower, forbidden) {
			t.Fatalf("release schema contains forbidden field/product marker %q", forbidden)
		}
	}
}

func mapsEqualString(left, right map[string]string) bool {
	if len(left) != len(right) {
		return false
	}
	for key, value := range left {
		if right[key] != value {
			return false
		}
	}
	return true
}
