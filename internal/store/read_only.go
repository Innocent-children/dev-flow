package store

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"path/filepath"
)

// OpenReadOnly reads an existing live database, including its WAL. Schema
// creation and all mutation statements are disabled by the SQLite connection.
func OpenReadOnly(ctx context.Context, path string) (*SQLite, error) {
	if path == "" {
		return nil, ErrInvalidArgument
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, ErrInvalidArgument
	}
	info, err := os.Stat(absolute)
	if err != nil || !info.Mode().IsRegular() {
		return nil, ErrStorageUnavailable
	}
	u, err := url.Parse(dataSource(absolute, false))
	if err != nil {
		return nil, ErrStorageUnavailable
	}
	query := u.Query()
	query.Set("mode", "ro")
	u.RawQuery = query.Encode()
	db, err := sql.Open("sqlite", u.String())
	if err != nil {
		return nil, ErrStorageUnavailable
	}
	db.SetMaxOpenConns(1)
	if err := verifyCurrentSchema(ctx, db); err != nil {
		db.Close()
		return nil, err
	}
	return &SQLite{db: db}, nil
}
