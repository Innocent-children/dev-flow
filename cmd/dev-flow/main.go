package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/version"
)

const helpText = `dev-flow is a Feature 001 engineering placeholder.

Usage:
  dev-flow [help|-h|--help]
  dev-flow version

Feature 001 task and MCP functionality are not implemented.
`

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 || len(args) == 1 && isHelp(args[0]) {
		_, _ = io.WriteString(stdout, helpText)
		return 0
	}

	if len(args) == 1 && args[0] == "version" {
		current, err := version.Current()
		if err != nil {
			_, _ = fmt.Fprintf(stderr, "dev-flow: read current VERSION: %v\n", err)
			return 1
		}

		_, _ = fmt.Fprintf(
			stdout,
			"dev-flow %s\nFeature 001 placeholder: task and MCP functionality are not implemented.\n",
			current,
		)
		return 0
	}

	_, _ = fmt.Fprintf(
		stderr,
		"dev-flow: command %q is not implemented in Feature 001; only help and version are available\n",
		strings.Join(args, " "),
	)
	return 2
}

func isHelp(argument string) bool {
	return argument == "help" || argument == "-h" || argument == "--help"
}
