// Package version reads the Dev Flow product version from the repository checkout.
package version

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// buildVersion is populated for detached release binaries with:
//
//	-ldflags "-X github.com/Innocent-children/dev-flow/internal/version.buildVersion=<version>"
//
// An empty value preserves source-checkout behavior for development and tests.
var buildVersion string

// Current returns the injected detached-build version when present, otherwise
// the SemVer value stored in the repository root CORE_VERSION file.
func Current() (string, error) {
	if buildVersion != "" {
		if err := validateSemVer(buildVersion); err != nil {
			return "", fmt.Errorf("validate injected build version %q: %w", buildVersion, err)
		}
		return buildVersion, nil
	}

	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		return "", errors.New("locate CORE_VERSION: runtime caller source path is unavailable")
	}

	versionPath := filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "..", "..", "CORE_VERSION"))
	return read(versionPath)
}

func read(path string) (string, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read CORE_VERSION %q: %w", path, err)
	}

	value := strings.TrimSpace(string(contents))
	if err := validateSemVer(value); err != nil {
		return "", fmt.Errorf("validate CORE_VERSION at %q: %w", path, err)
	}
	return value, nil
}

func validateSemVer(value string) error {
	if value == "" {
		return errors.New("version is empty")
	}

	coreAndPrerelease := value
	if plus := strings.IndexByte(value, '+'); plus >= 0 {
		coreAndPrerelease = value[:plus]
		build := value[plus+1:]
		if strings.ContainsRune(build, '+') {
			return errors.New("build metadata contains more than one '+' separator")
		}
		if err := validateIdentifiers(build, false, "build metadata"); err != nil {
			return err
		}
	}

	core := coreAndPrerelease
	if dash := strings.IndexByte(coreAndPrerelease, '-'); dash >= 0 {
		core = coreAndPrerelease[:dash]
		prerelease := coreAndPrerelease[dash+1:]
		if err := validateIdentifiers(prerelease, true, "prerelease"); err != nil {
			return err
		}
	}

	parts := strings.Split(core, ".")
	if len(parts) != 3 {
		return fmt.Errorf("core version %q must contain exactly major, minor, and patch", core)
	}
	for index, name := range []string{"major", "minor", "patch"} {
		if err := validateCoreNumber(parts[index], name); err != nil {
			return err
		}
	}
	return nil
}

func validateCoreNumber(value, name string) error {
	if value == "" {
		return fmt.Errorf("%s component is empty", name)
	}
	for _, character := range []byte(value) {
		if character < '0' || character > '9' {
			return fmt.Errorf("%s component %q is not numeric", name, value)
		}
	}
	if len(value) > 1 && value[0] == '0' {
		return fmt.Errorf("%s component %q has a leading zero", name, value)
	}
	return nil
}

func validateIdentifiers(value string, rejectNumericLeadingZero bool, kind string) error {
	if value == "" {
		return fmt.Errorf("%s is empty", kind)
	}
	for _, identifier := range strings.Split(value, ".") {
		if identifier == "" {
			return fmt.Errorf("%s contains an empty identifier", kind)
		}

		numeric := true
		for _, character := range []byte(identifier) {
			if character < '0' || character > '9' {
				numeric = false
			}
			if !isSemVerIdentifierCharacter(character) {
				return fmt.Errorf("%s identifier %q contains a non-ASCII alphanumeric or hyphen character", kind, identifier)
			}
		}
		if rejectNumericLeadingZero && numeric && len(identifier) > 1 && identifier[0] == '0' {
			return fmt.Errorf("%s numeric identifier %q has a leading zero", kind, identifier)
		}
	}
	return nil
}

func isSemVerIdentifierCharacter(character byte) bool {
	return character >= '0' && character <= '9' ||
		character >= 'A' && character <= 'Z' ||
		character >= 'a' && character <= 'z' ||
		character == '-'
}
