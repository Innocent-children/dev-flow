//go:build windows

package main

import (
	"os"
	"syscall"
)

func webUISignals() []os.Signal {
	const signalBreak syscall.Signal = 21
	return []os.Signal{os.Interrupt, signalBreak}
}
