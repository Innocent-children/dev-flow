//go:build darwin

package repository

import "os/exec"

func configureGitCommand(_ *exec.Cmd) {}
