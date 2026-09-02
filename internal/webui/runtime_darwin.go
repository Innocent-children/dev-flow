//go:build darwin

package webui

import (
	"os"
	"os/exec"
	"syscall"
)

func configureBackgroundCommand(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func openBrowser(url string) error {
	return exec.Command("open", url).Start()
}

func signalWebUIProcess(process *os.Process, _ int) error {
	return process.Signal(os.Interrupt)
}

func forceStopWebUIProcess(_ *os.Process) (bool, error) {
	return false, nil
}
