//go:build windows

package store

import (
	"context"
	"database/sql"
	"unsafe"

	"golang.org/x/sys/windows"
)

const windowsDeleteAccess = 0x00010000

type windowsResetHandle struct {
	handle windows.Handle
	target ResetTarget
	marked bool
}

func removeResetTargets(ctx context.Context, canonical, token string, plan ResetPlan) error {
	db, openErr := sql.Open("sqlite", dataSource(canonical, false))
	if openErr != nil {
		return ErrStorageUnavailable
	}
	db.SetMaxOpenConns(1)
	connection, connectionErr := db.Conn(ctx)
	if connectionErr != nil {
		_ = db.Close()
		return ErrStorageUnavailable
	}
	locked := false
	closed := false
	defer func() {
		if closed {
			return
		}
		if locked {
			_, _ = connection.ExecContext(context.Background(), "ROLLBACK")
		}
		_ = connection.Close()
		_ = db.Close()
	}()
	if _, err := connection.ExecContext(ctx, "PRAGMA locking_mode=EXCLUSIVE"); err != nil {
		return ErrStorageUnavailable
	}
	if _, err := connection.ExecContext(ctx, "BEGIN EXCLUSIVE"); err != nil {
		return ErrStorageUnavailable
	}
	locked = true
	current, planErr := PlanReset(canonical)
	if planErr != nil || current.Token != token {
		return ErrRevisionConflict
	}
	if _, err := connection.ExecContext(context.Background(), "ROLLBACK"); err != nil {
		return ErrStorageUnavailable
	}
	locked = false
	if err := connection.Close(); err != nil {
		return ErrStorageUnavailable
	}
	if err := db.Close(); err != nil {
		return ErrStorageUnavailable
	}
	closed = true
	return deleteWindowsResetTargets(plan)
}

func deleteWindowsResetTargets(plan ResetPlan) error {
	handles := make([]windowsResetHandle, 0, len(plan.Targets))
	defer func() {
		for i := range handles {
			if handles[i].handle != windows.InvalidHandle {
				_ = windows.CloseHandle(handles[i].handle)
			}
		}
	}()
	for _, target := range plan.Targets {
		name, err := windows.UTF16PtrFromString(target.Path)
		if err != nil {
			return ErrStorageUnavailable
		}
		handle, err := windows.CreateFile(
			name,
			windowsDeleteAccess|windows.FILE_READ_ATTRIBUTES,
			0,
			nil,
			windows.OPEN_EXISTING,
			windows.FILE_FLAG_OPEN_REPARSE_POINT,
			0,
		)
		if err != nil {
			return ErrStorageUnavailable
		}
		entry := windowsResetHandle{handle: handle, target: target}
		handles = append(handles, entry)
		if !windowsResetHandleMatches(handles[len(handles)-1]) {
			return ErrRevisionConflict
		}
	}
	deleteFile := byte(1)
	keepFile := byte(0)
	for i := range handles {
		if err := windows.SetFileInformationByHandle(
			handles[i].handle,
			windows.FileDispositionInfo,
			&deleteFile,
			uint32(unsafe.Sizeof(deleteFile)),
		); err != nil {
			for j := 0; j < i; j++ {
				if handles[j].marked {
					_ = windows.SetFileInformationByHandle(handles[j].handle, windows.FileDispositionInfo, &keepFile, uint32(unsafe.Sizeof(keepFile)))
					handles[j].marked = false
				}
			}
			return ErrStorageUnavailable
		}
		handles[i].marked = true
	}
	for i := range handles {
		if err := windows.CloseHandle(handles[i].handle); err != nil {
			return ErrStorageUnavailable
		}
		handles[i].handle = windows.InvalidHandle
	}
	return nil
}

func windowsResetHandleMatches(entry windowsResetHandle) bool {
	var info windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(entry.handle, &info); err != nil {
		return false
	}
	if info.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
		return false
	}
	device := uint64(info.VolumeSerialNumber)
	inode := uint64(info.FileIndexHigh)<<32 | uint64(info.FileIndexLow)
	size := int64(uint64(info.FileSizeHigh)<<32 | uint64(info.FileSizeLow))
	modified := info.LastWriteTime.Nanoseconds()
	return device == entry.target.Device && inode == entry.target.Inode && size == entry.target.Size && modified == entry.target.ModifiedNS
}
