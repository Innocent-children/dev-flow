package testpath

import (
	"os"
	"path/filepath"
)

// Absolute returns a stable absolute fixture path on the current operating system.
func Absolute(elements ...string) string {
	root := filepath.VolumeName(os.TempDir()) + string(filepath.Separator)
	parts := append([]string{root}, elements...)
	return filepath.Join(parts...)
}
