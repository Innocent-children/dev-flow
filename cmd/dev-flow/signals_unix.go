//go:build !windows

package main

import (
	"os"
	"syscall"
)

func webUISignals() []os.Signal {
	return []os.Signal{os.Interrupt, syscall.SIGTERM, syscall.SIGHUP}
}
