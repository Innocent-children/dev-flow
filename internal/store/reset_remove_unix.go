//go:build !windows

package store

import (
	"context"
	"database/sql"
	"os"
)

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
	defer func() {
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
	for _, target := range plan.Targets {
		if err := os.Remove(target.Path); err != nil {
			return ErrStorageUnavailable
		}
	}
	_, _ = connection.ExecContext(context.Background(), "ROLLBACK")
	locked = false
	_ = connection.Close()
	_ = db.Close()
	return nil
}
