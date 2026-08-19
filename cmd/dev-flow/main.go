package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/Innocent-children/dev-flow/internal/application"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/version"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	dataDirectoryEnvironment   = "DEV_FLOW_DATA_DIR"
	mcpInstructionsEnvironment = "DEV_FLOW_CODEX_MCP_INSTRUCTIONS"
	databaseFileName           = "dev-flow.db"
)

const helpText = `dev-flow exposes the governed Core Contract 0.2 over local STDIO MCP.

Usage:
  dev-flow [help|-h|--help]
  dev-flow version
  dev-flow mcp --stdio

Set DEV_FLOW_DATA_DIR to an existing local data directory before starting MCP.
Host product integration, installation, publication, and remote transports are not included.
`

type mcpServeFunc func(context.Context, *application.Service, string, *coremcp.Diagnostics, string) error

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr, os.Getenv, serveStandardIO))
}

func run(
	args []string,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
	getenv func(string) string,
	serve mcpServeFunc,
) int {
	if len(args) == 0 || len(args) == 1 && isHelp(args[0]) {
		_, _ = io.WriteString(stdout, helpText)
		return 0
	}

	if len(args) == 1 && args[0] == "version" {
		current, err := version.Current()
		if err != nil {
			_, _ = io.WriteString(stderr, "dev-flow: version is unavailable\n")
			return 1
		}
		_, _ = fmt.Fprintf(stdout, "dev-flow %s\n", current)
		return 0
	}

	if len(args) == 2 && args[0] == "mcp" && args[1] == "--stdio" {
		return runMCP(stdin, stdout, stderr, getenv, serve)
	}

	_, _ = io.WriteString(stderr, "dev-flow: invalid arguments; use \"dev-flow help\"\n")
	return 2
}

func runMCP(
	_ io.Reader,
	_ io.Writer,
	stderr io.Writer,
	getenv func(string) string,
	serve mcpServeFunc,
) int {
	if getenv == nil || serve == nil {
		_, _ = io.WriteString(stderr, "dev-flow: MCP startup configuration is unavailable\n")
		return 1
	}
	dataDirectory := getenv(dataDirectoryEnvironment)
	if dataDirectory == "" {
		_, _ = io.WriteString(stderr, "dev-flow: DEV_FLOW_DATA_DIR must name an existing usable directory\n")
		return 1
	}
	info, err := os.Stat(dataDirectory)
	if err != nil || !info.IsDir() {
		_, _ = io.WriteString(stderr, "dev-flow: DEV_FLOW_DATA_DIR must name an existing usable directory\n")
		return 1
	}

	ctx := context.Background()
	taskStore, err := store.Open(ctx, filepath.Join(dataDirectory, databaseFileName))
	if err != nil {
		_, _ = io.WriteString(stderr, "dev-flow: MCP storage startup failed\n")
		return 1
	}
	closed := false
	defer func() {
		if !closed {
			_ = taskStore.Close()
		}
	}()

	service, err := application.NewService(taskStore, repository.NewGitObserver())
	if err != nil {
		_, _ = io.WriteString(stderr, "dev-flow: MCP Core startup failed\n")
		return 1
	}
	currentVersion, err := version.Current()
	if err != nil {
		_, _ = io.WriteString(stderr, "dev-flow: MCP version startup failed\n")
		return 1
	}
	diagnostics := coremcp.NewDiagnostics(stderr)
	serveErr := serve(ctx, service, currentVersion, diagnostics, getenv(mcpInstructionsEnvironment))
	closeErr := taskStore.Close()
	closed = true
	if serveErr != nil && !errors.Is(serveErr, io.EOF) {
		_, _ = io.WriteString(stderr, "dev-flow: MCP STDIO session failed\n")
		return 1
	}
	if closeErr != nil {
		_, _ = io.WriteString(stderr, "dev-flow: MCP storage shutdown failed\n")
		return 1
	}
	return 0
}

func serveStandardIO(
	ctx context.Context,
	service *application.Service,
	currentVersion string,
	diagnostics *coremcp.Diagnostics,
	instructions string,
) error {
	server, err := coremcp.NewServer(service, currentVersion, &coremcp.ServerOptions{
		Diagnostics:  diagnostics,
		Instructions: instructions,
	})
	if err != nil {
		return err
	}
	return server.Run(ctx, &sdkmcp.StdioTransport{})
}

func isHelp(argument string) bool {
	return argument == "help" || argument == "-h" || argument == "--help"
}
