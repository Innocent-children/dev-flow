package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func runWorkspaceAvailabilityCheck(stdin io.Reader, stdout, stderr io.Writer, getenv func(string) string) int {
	var input struct {
		RepositoryPath string `json:"repository_path"`
	}
	decoder := json.NewDecoder(io.LimitReader(stdin, 64*1024))
	decoder.DisallowUnknownFields()
	var trailing any
	if decoder.Decode(&input) != nil || decoder.Decode(&trailing) != io.EOF {
		fmt.Fprintln(stderr, "dev-flow: workspace availability input is invalid")
		return 1
	}
	dataDirectory := getenv(dataDirectoryEnvironment)
	if !usableDataDirectory(dataDirectory) {
		fmt.Fprintln(stderr, "dev-flow: workspace availability data directory is unavailable")
		return 1
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	databasePath := filepath.Join(dataDirectory, databaseFileName)
	var lookup store.WorkspaceLookupStore
	if _, err := os.Stat(databasePath); err == nil {
		tasks, openErr := store.OpenReadOnly(ctx, databasePath)
		if openErr != nil {
			fmt.Fprintln(stderr, "dev-flow: workspace availability storage is unavailable")
			return 1
		}
		defer tasks.Close()
		lookup = tasks
	} else if !errors.Is(err, os.ErrNotExist) {
		fmt.Fprintln(stderr, "dev-flow: workspace availability storage is unavailable")
		return 1
	}
	result, err := application.CheckWorkspaceAvailability(ctx, repository.NewGitObserver(), lookup, input.RepositoryPath)
	if err != nil {
		fmt.Fprintln(stderr, "dev-flow: workspace availability check failed")
		return 1
	}
	if json.NewEncoder(stdout).Encode(result) != nil {
		return 1
	}
	return 0
}
