//go:build windows

package store

import (
	"os"

	"golang.org/x/sys/windows"
)

func resetFileIdentity(path string, _ os.FileInfo) (uint64, uint64, bool) {
	name, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, 0, false
	}
	handle, err := windows.CreateFile(
		name,
		windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_FLAG_OPEN_REPARSE_POINT,
		0,
	)
	if err != nil {
		return 0, 0, false
	}
	defer windows.CloseHandle(handle)
	var identity windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(handle, &identity); err != nil {
		return 0, 0, false
	}
	if identity.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
		return 0, 0, false
	}
	fileIndex := uint64(identity.FileIndexHigh)<<32 | uint64(identity.FileIndexLow)
	return uint64(identity.VolumeSerialNumber), fileIndex, true
}
