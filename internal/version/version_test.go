package version

import (
	"os"
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

func TestCurrentReadsRootVersion(t *testing.T) {
	t.Parallel()

	_, testFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller did not return the test source path")
	}
	versionPath := filepath.Clean(filepath.Join(filepath.Dir(testFile), "..", "..", "VERSION"))
	contents, err := os.ReadFile(versionPath)
	if err != nil {
		t.Fatalf("read current root VERSION %q: %v", versionPath, err)
	}
	want := strings.TrimSpace(string(contents))

	got, err := Current()
	if err != nil {
		t.Fatalf("Current() returned error: %v", err)
	}
	if got != want {
		t.Fatalf("Current() = %q, want current root VERSION %q", got, want)
	}
	if err := validateSemVer(got); err != nil {
		t.Fatalf("Current() returned invalid SemVer %q: %v", got, err)
	}
}

func TestReadReportsPathAndValidationReason(t *testing.T) {
	t.Parallel()

	versionPath := filepath.Join(t.TempDir(), "VERSION")
	if err := os.WriteFile(versionPath, []byte("01.2.3\n"), 0o600); err != nil {
		t.Fatalf("write invalid VERSION fixture: %v", err)
	}

	_, err := read(versionPath)
	if err == nil {
		t.Fatal("read() unexpectedly accepted an invalid VERSION")
	}
	if !strings.Contains(err.Error(), versionPath) {
		t.Fatalf("read() error %q does not contain path %q", err, versionPath)
	}
	if !strings.Contains(err.Error(), "leading zero") {
		t.Fatalf("read() error %q does not contain the validation reason", err)
	}
}
