//go:build windows

package repository

import (
	"os/exec"
	"testing"
)

func TestWindowsGitObservationDoesNotOpenConsole(t *testing.T) {
	command := exec.Command("git", "--version")
	configureGitCommand(command)
	if command.SysProcAttr == nil || !command.SysProcAttr.HideWindow {
		t.Fatal("Git observation must hide its console for desktop hosts")
	}
	if output, err := command.Output(); err != nil || len(output) == 0 {
		t.Fatalf("native Git invocation: %s, %v", output, err)
	}
}
