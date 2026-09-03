//go:build !windows

package repository

import (
	"fmt"
	"os"
	"reflect"
)

// gitDirectoryIdentity returns the filesystem identity of a Git directory.
// Device and inode distinguish replacement; Darwin birth time prevents
// immediate inode reuse from preserving identity.
func gitDirectoryIdentity(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return "", ErrGitObservation
	}
	value := reflect.Indirect(reflect.ValueOf(info.Sys()))
	if !value.IsValid() {
		return "", ErrGitObservation
	}
	field := func(name string) uint64 {
		candidate := value.FieldByName(name)
		if !candidate.IsValid() {
			return 0
		}
		switch candidate.Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			return uint64(candidate.Int())
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			return candidate.Uint()
		default:
			return 0
		}
	}
	device, inode := field("Dev"), field("Ino")
	if device == 0 && inode == 0 {
		return "", ErrGitObservation
	}
	birth := value.FieldByName("Birthtimespec")
	birthSecond, birthNano := int64(0), int64(0)
	if birth.IsValid() {
		if candidate := birth.FieldByName("Sec"); candidate.IsValid() {
			birthSecond = candidate.Int()
		}
		if candidate := birth.FieldByName("Nsec"); candidate.IsValid() {
			birthNano = candidate.Int()
		}
	}
	return fmt.Sprintf("%d:%d:%d:%d", device, inode, birthSecond, birthNano), nil
}
