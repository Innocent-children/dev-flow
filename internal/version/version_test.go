package version

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestValidateSemVer(t *testing.T) {
	t.Parallel()

	valid := []string{
		"0.0.0",
		"1.2.3",
		"10.20.30",
		"1.0.0-alpha",
		"1.0.0-alpha.1",
		"1.0.0-0.3.7",
		"1.0.0-x.7.z.92",
		"1.0.0+20130313144700",
		"1.0.0-beta+exp.sha.5114f85",
	}

	for _, value := range valid {
		value := value
		t.Run(value, func(t *testing.T) {
			t.Parallel()
			if err := validateSemVer(value); err != nil {
				t.Fatalf("validateSemVer(%q) returned error: %v", value, err)
			}
		})
	}
}

func TestValidateSemVerRejectsInvalidValues(t *testing.T) {
	t.Parallel()

	invalid := []string{
		"",
		"1",
		"1.2",
		"1.2.3.4",
		"v1.2.3",
		"01.2.3",
		"1.02.3",
		"1.2.03",
		"1.0.0-",
		"1.0.0-alpha..1",
		"1.0.0-01",
		"1.0.0+",
		"1.0.0+build..1",
		"1.0.0+build+more",
		"1.0.0 alpha",
		"1.0.0-ä",
	}

	for _, value := range invalid {
		value := value
		t.Run(value, func(t *testing.T) {
			t.Parallel()
			if err := validateSemVer(value); err == nil {
				t.Fatalf("validateSemVer(%q) unexpectedly succeeded", value)
			}
		})
	}
}

func rootVersion(t *testing.T) string {
	t.Helper()
	_, testFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller did not return the test source path")
	}
	versionPath := filepath.Clean(filepath.Join(filepath.Dir(testFile), "..", "..", "CORE_VERSION"))
	contents, err := os.ReadFile(versionPath)
	if err != nil {
		t.Fatalf("read current root CORE_VERSION %q: %v", versionPath, err)
	}
	return strings.TrimSpace(string(contents))
}

func TestCurrentReadsRootVersion(t *testing.T) {
	previous := buildVersion
	buildVersion = ""
	t.Cleanup(func() { buildVersion = previous })
	want := rootVersion(t)

	got, err := Current()
	if err != nil {
		t.Fatalf("Current() returned error: %v", err)
	}
	if got != want {
		t.Fatalf("Current() = %q, want current root CORE_VERSION %q", got, want)
	}
	if err := validateSemVer(got); err != nil {
		t.Fatalf("Current() returned invalid SemVer %q: %v", got, err)
	}
}

func TestCurrentPrefersInjectedBuildVersion(t *testing.T) {
	previous := buildVersion
	buildVersion = "9.8.7-rc.1+detached"
	t.Cleanup(func() { buildVersion = previous })

	got, err := Current()
	if err != nil {
		t.Fatalf("Current() returned error for injected version: %v", err)
	}
	if got != buildVersion {
		t.Fatalf("Current() = %q, want injected version %q", got, buildVersion)
	}
}

func TestCurrentRejectsInvalidInjectedBuildVersion(t *testing.T) {
	previous := buildVersion
	buildVersion = "v9.8.7"
	t.Cleanup(func() { buildVersion = previous })

	if _, err := Current(); err == nil {
		t.Fatal("Current() unexpectedly accepted invalid injected version")
	} else if !strings.Contains(err.Error(), "injected build version") || !strings.Contains(err.Error(), "not numeric") {
		t.Fatalf("Current() error = %q, want injected-version validation reason", err)
	}
}

func TestDetachedBinaryReportsInjectedVersionAfterMove(t *testing.T) {
	if testing.Short() {
		t.Skip("building the detached command is an integration check")
	}

	buildDirectory := t.TempDir()
	binaryPath := filepath.Join(buildDirectory, "staging", "dev-flow")
	if err := os.MkdirAll(filepath.Dir(binaryPath), 0o700); err != nil {
		t.Fatalf("create build directory: %v", err)
	}
	moduleRoot := filepath.Clean(filepath.Join(mustTestFileDirectory(t), "..", ".."))
	ldflag := "-X github.com/Innocent-children/dev-flow/internal/version.buildVersion=9.8.7"
	command := exec.Command("go", "build", "-trimpath", "-ldflags", ldflag, "-o", binaryPath, "./cmd/dev-flow")
	command.Dir = moduleRoot
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build injected binary: %v\n%s", err, output)
	}

	movedDirectory := filepath.Join(t.TempDir(), "moved binary")
	if err := os.MkdirAll(movedDirectory, 0o700); err != nil {
		t.Fatalf("create moved directory: %v", err)
	}
	movedPath := filepath.Join(movedDirectory, "dev-flow")
	if err := os.Rename(binaryPath, movedPath); err != nil {
		t.Fatalf("move detached binary: %v", err)
	}
	output, err := exec.Command(movedPath, "version").CombinedOutput()
	if err != nil {
		t.Fatalf("run moved detached binary: %v\n%s", err, output)
	}
	if got, want := string(output), "dev-flow 9.8.7\n"; got != want {
		t.Fatalf("moved binary version output = %q, want unchanged public output %q", got, want)
	}
}

func mustTestFileDirectory(t *testing.T) string {
	t.Helper()
	_, testFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller did not return the test source path")
	}
	return filepath.Dir(testFile)
}

func TestReadReportsPathAndValidationReason(t *testing.T) {
	t.Parallel()

	versionPath := filepath.Join(t.TempDir(), "CORE_VERSION")
	if err := os.WriteFile(versionPath, []byte("01.2.3\n"), 0o600); err != nil {
		t.Fatalf("write invalid CORE_VERSION fixture: %v", err)
	}

	_, err := read(versionPath)
	if err == nil {
		t.Fatal("read() unexpectedly accepted an invalid CORE_VERSION")
	}
	if !strings.Contains(err.Error(), versionPath) {
		t.Fatalf("read() error %q does not contain path %q", err, versionPath)
	}
	if !strings.Contains(err.Error(), "leading zero") {
		t.Fatalf("read() error %q does not contain the validation reason", err)
	}
}
