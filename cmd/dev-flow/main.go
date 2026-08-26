package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/userconfig"
	"github.com/Innocent-children/dev-flow/internal/version"
	"github.com/Innocent-children/dev-flow/internal/webui"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	dataDirectoryEnvironment   = "DEV_FLOW_DATA_DIR"
	mcpInstructionsEnvironment = "DEV_FLOW_CODEX_MCP_INSTRUCTIONS"
	databaseFileName           = "dev-flow.db"
)

const helpText = `dev-flow exposes the governed Core over local STDIO MCP and a shared local WebUI.

Usage:
  dev-flow [help|-h|--help]
  dev-flow version
  dev-flow mcp --stdio
  dev-flow webui start [--no-open] [--plain|--json]
  dev-flow webui open [--plain|--json]
  dev-flow webui status [--plain|--json]
  dev-flow webui stop [--plain|--json]
  dev-flow webui reset [--confirm TOKEN] [--plain|--json]

Set DEV_FLOW_DATA_DIR to an existing local data directory before starting MCP or WebUI.
Host product integration, installation, publication, and remote transports are not included.
`

type mcpServeFunc func(context.Context, *application.Service, string, *coremcp.Diagnostics, string, userconfig.Preferences) error

var (
	startWebUI       = webui.Start
	statusWebUI      = webui.Status
	openWebUIBrowser = webui.OpenBrowser
	stopWebUI        = webui.Stop
)

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
	if len(args) >= 2 && args[0] == "webui" {
		return runWebUI(args[1:], stdout, stderr, getenv)
	}

	_, _ = io.WriteString(stderr, "dev-flow: invalid arguments; use \"dev-flow help\"\n")
	return 2
}

func runWebUI(args []string, stdout, stderr io.Writer, getenv func(string) string) int {
	if getenv == nil || len(args) == 0 {
		_, _ = io.WriteString(stderr, "dev-flow: invalid WebUI arguments; use \"dev-flow help\"\n")
		return 2
	}
	dataDirectory := getenv(dataDirectoryEnvironment)
	if !usableDataDirectory(dataDirectory) {
		_, _ = io.WriteString(stderr, "dev-flow: DEV_FLOW_DATA_DIR must name an existing usable directory\n")
		return 1
	}
	currentVersion, err := version.Current()
	if err != nil {
		_, _ = io.WriteString(stderr, "dev-flow: WebUI version startup failed\n")
		return 1
	}
	coreIdentity := "dev-flow/" + currentVersion
	command := args[0]
	if command == "serve" {
		if len(args) != 1 {
			_, _ = io.WriteString(stderr, "dev-flow: invalid WebUI serve arguments\n")
			return 2
		}
		ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
		defer cancel()
		if err := webui.Serve(ctx, dataDirectory, coreIdentity); err != nil {
			_, _ = io.WriteString(stderr, "dev-flow: WebUI serve failed\n")
			return 1
		}
		return 0
	}
	options, err := parseWebUIOptions(command, args[1:])
	if err != nil {
		_, _ = io.WriteString(stderr, "dev-flow: invalid WebUI arguments; use \"dev-flow help\"\n")
		return 2
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
	defer cancel()
	var state webui.RuntimeState
	switch command {
	case "start":
		state, err = startWebUI(ctx, dataDirectory, coreIdentity, options.noOpen)
	case "status":
		state, err = statusWebUI(ctx, dataDirectory, coreIdentity)
	case "open":
		state, err = statusWebUI(ctx, dataDirectory, coreIdentity)
		if err == nil && state.Readiness == webui.ReadinessReady {
			err = openWebUIBrowser(state.URL)
		} else if err == nil {
			err = fmt.Errorf("WebUI is %s", state.Readiness)
		}
	case "stop":
		state, err = stopWebUI(ctx, dataDirectory, coreIdentity)
	case "reset":
		return runWebUIReset(ctx, dataDirectory, options.confirmToken, options.json, stdout, stderr)
	default:
		_, _ = io.WriteString(stderr, "dev-flow: invalid WebUI arguments; use \"dev-flow help\"\n")
		return 2
	}
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "dev-flow: WebUI %s failed: %v\n", command, err)
		return 1
	}
	writeRuntimeState(stdout, command, state, options.json)
	return 0
}

type webUIOptions struct {
	json         bool
	noOpen       bool
	confirmToken string
}

func parseWebUIOptions(command string, args []string) (webUIOptions, error) {
	var result webUIOptions
	formatSeen := false
	for index := 0; index < len(args); index++ {
		switch args[index] {
		case "--json", "--plain":
			if formatSeen {
				return webUIOptions{}, errors.New("duplicate output mode")
			}
			formatSeen = true
			result.json = args[index] == "--json"
		case "--no-open":
			if command != "start" || result.noOpen {
				return webUIOptions{}, errors.New("invalid no-open option")
			}
			result.noOpen = true
		case "--confirm":
			if command != "reset" || result.confirmToken != "" || index+1 >= len(args) || strings.TrimSpace(args[index+1]) == "" {
				return webUIOptions{}, errors.New("invalid confirmation option")
			}
			index++
			result.confirmToken = args[index]
		default:
			return webUIOptions{}, errors.New("unknown WebUI option")
		}
	}
	return result, nil
}

func runWebUIReset(ctx context.Context, dataDirectory, confirmation string, jsonOutput bool, stdout, stderr io.Writer) int {
	databasePath := filepath.Join(dataDirectory, databaseFileName)
	plan, err := store.PlanReset(databasePath)
	if err != nil {
		_, _ = io.WriteString(stderr, "dev-flow: WebUI reset plan failed\n")
		return 1
	}
	if confirmation == "" {
		if jsonOutput {
			_ = json.NewEncoder(stdout).Encode(map[string]any{"operation": "reset", "status": "confirmation_required", "targets": plan.Targets, "confirm_token": plan.Token, "permanent": true})
		} else {
			_, _ = io.WriteString(stdout, "WebUI reset permanently deletes only these Task-data targets:\n")
			if len(plan.Targets) == 0 {
				_, _ = io.WriteString(stdout, "  (no existing Task-data files)\n")
			}
			for _, target := range plan.Targets {
				_, _ = fmt.Fprintf(stdout, "  %s\n", target.Path)
			}
			_, _ = fmt.Fprintf(stdout, "Confirm with: dev-flow webui reset --confirm %s\n", plan.Token)
		}
		return 0
	}
	if err := store.ConfirmReset(ctx, databasePath, confirmation); err != nil {
		_, _ = fmt.Fprintf(stderr, "dev-flow: WebUI reset failed: %v\n", err)
		return 1
	}
	if jsonOutput {
		_ = json.NewEncoder(stdout).Encode(map[string]any{"operation": "reset", "status": "completed", "deleted_targets": plan.Targets})
	} else {
		_, _ = io.WriteString(stdout, "WebUI Task data reset completed. Adapter packages, registrations, configuration, and unrelated files were preserved.\n")
	}
	return 0
}

func writeRuntimeState(output io.Writer, operation string, state webui.RuntimeState, jsonOutput bool) {
	if jsonOutput {
		_ = json.NewEncoder(output).Encode(map[string]any{"operation": operation, "readiness": state.Readiness, "core_identity": state.CoreIdentity, "data_root_digest": state.DataRootDigest, "url": state.URL, "pid": state.PID})
		return
	}
	_, _ = fmt.Fprintf(output, "WebUI %s: %s\n", operation, state.Readiness)
	if state.URL != "" {
		_, _ = fmt.Fprintf(output, "URL: %s\n", state.URL)
	}
}

func usableDataDirectory(dataDirectory string) bool {
	if dataDirectory == "" {
		return false
	}
	info, err := os.Stat(dataDirectory)
	return err == nil && info.IsDir()
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
	preferences, err := userconfig.Load(getenv("HOME"))
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "dev-flow: %v\n", err)
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
	serveErr := serve(ctx, service, currentVersion, diagnostics, getenv(mcpInstructionsEnvironment), preferences)
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
	preferences userconfig.Preferences,
) error {
	server, err := coremcp.NewServer(service, currentVersion, &coremcp.ServerOptions{
		Diagnostics:     diagnostics,
		Instructions:    instructions,
		HostPreferences: preferences,
	})
	if err != nil {
		return err
	}
	return server.Run(ctx, &sdkmcp.StdioTransport{})
}

func isHelp(argument string) bool {
	return argument == "help" || argument == "-h" || argument == "--help"
}
