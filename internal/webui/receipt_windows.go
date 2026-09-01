//go:build windows

package webui

import (
	"fmt"
	"os"
	"strconv"

	"golang.org/x/sys/windows"
)

func validRuntimeReceiptFile(info os.FileInfo) bool {
	return info.Mode().IsRegular()
}

func processStartIdentity(pid int) (string, error) {
	if pid <= 0 {
		return "", fmt.Errorf("invalid process identity")
	}
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(handle)
	var creation, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(handle, &creation, &exit, &kernel, &user); err != nil {
		return "", err
	}
	if exit.HighDateTime != 0 || exit.LowDateTime != 0 {
		return "", fmt.Errorf("process is unavailable")
	}
	identity := uint64(uint32(creation.HighDateTime))<<32 | uint64(creation.LowDateTime)
	if identity == 0 {
		return "", fmt.Errorf("process is unavailable")
	}
	return strconv.FormatUint(identity, 10), nil
}
