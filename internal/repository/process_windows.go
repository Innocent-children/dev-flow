//go:build windows

package repository

import (
	"os/exec"
	"syscall"
)

// Read-only observation also runs from GUI hosts without a console.
func configureGitCommand(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
