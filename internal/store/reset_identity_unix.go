//go:build !windows

package store

import (
	"os"
	"syscall"
)

func resetFileIdentity(_ string, info os.FileInfo) (uint64, uint64, bool) {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, 0, false
	}
	return uint64(stat.Dev), uint64(stat.Ino), true
}
