//go:build windows

package webui

import (
	"os"
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

func configureBackgroundCommand(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: windows.CREATE_NEW_PROCESS_GROUP,
		HideWindow:    true,
	}
}

func openBrowser(url string) error {
	return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start()
}

func signalWebUIProcess(process *os.Process, pid int) error {
	if err := windows.GenerateConsoleCtrlEvent(windows.CTRL_BREAK_EVENT, uint32(pid)); err == nil {
		return nil
	}
	return process.Kill()
}

func forceStopWebUIProcess(process *os.Process) (bool, error) {
	return true, process.Kill()
}
