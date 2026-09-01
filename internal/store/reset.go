package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"

	_ "modernc.org/sqlite"
)

type ResetTarget struct {
	Path       string `json:"path"`
	Size       int64  `json:"size"`
	ModifiedNS int64  `json:"modified_ns"`
	Device     uint64 `json:"device"`
	Inode      uint64 `json:"inode"`
}

type ResetPlan struct {
	Targets []ResetTarget `json:"targets"`
	Token   string        `json:"token"`
}

func PlanReset(databasePath string) (ResetPlan, error) {
	canonical, err := canonicalDatabasePath(databasePath)
	if err != nil {
		return ResetPlan{}, ErrInvalidArgument
	}
	targets := make([]ResetTarget, 0, 4)
	for _, path := range []string{canonical, canonical + "-journal", canonical + "-shm", canonical + "-wal"} {
		info, statErr := os.Lstat(path)
		if errors.Is(statErr, os.ErrNotExist) {
			continue
		}
		if statErr != nil || !info.Mode().IsRegular() {
			return ResetPlan{}, ErrStorageUnavailable
		}
		device, inode, ok := resetFileIdentity(path, info)
		if !ok {
			return ResetPlan{}, ErrStorageUnavailable
		}
		targets = append(targets, ResetTarget{Path: path, Size: info.Size(), ModifiedNS: info.ModTime().UnixNano(), Device: device, Inode: inode})
	}
	sort.Slice(targets, func(i, j int) bool { return targets[i].Path < targets[j].Path })
	content, err := json.Marshal(targets)
	if err != nil {
		return ResetPlan{}, ErrStorageUnavailable
	}
	digest := sha256.Sum256(content)
	return ResetPlan{Targets: targets, Token: hex.EncodeToString(digest[:])}, nil
}

func ConfirmReset(ctx context.Context, databasePath, token string) error {
	if ctx == nil || token == "" {
		return ErrInvalidArgument
	}
	plan, err := PlanReset(databasePath)
	if err != nil {
		return err
	}
	if plan.Token != token {
		return ErrRevisionConflict
	}
	canonical, err := canonicalDatabasePath(databasePath)
	if err != nil {
		return ErrInvalidArgument
	}
	if len(plan.Targets) > 0 {
		if err := removeResetTargets(ctx, canonical, token, plan); err != nil {
			return err
		}
	}
	empty, err := Open(ctx, canonical)
	if err != nil {
		return err
	}
	return empty.Close()
}

func canonicalDatabasePath(databasePath string) (string, error) {
	if databasePath == "" {
		return "", ErrInvalidArgument
	}
	absolute, err := filepath.Abs(databasePath)
	if err != nil {
		return "", err
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(absolute))
	if err != nil {
		return "", err
	}
	return filepath.Join(parent, filepath.Base(absolute)), nil
}
