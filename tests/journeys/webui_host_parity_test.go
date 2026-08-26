package journeys_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

type webUIJourneyState struct {
	Readiness      string `json:"readiness"`
	CoreIdentity   string `json:"core_identity"`
	DataRootDigest string `json:"data_root_digest"`
	URL            string `json:"url"`
	PID            int    `json:"pid"`
}

func TestWebUIHostParityJourney(t *testing.T) {
	if runtime.GOOS != "darwin" || runtime.GOARCH != "arm64" {
		t.Skip("Feature 014 Host parity targets darwin-arm64")
	}
	root := journeyRepositoryRoot(t)
	buildRoot := t.TempDir()
	codexOutput := filepath.Join(buildRoot, "codex")
	extractRoot := filepath.Join(buildRoot, "installed-codex")
	if err := os.MkdirAll(codexOutput, 0o700); err != nil {
		t.Fatal(err)
	}
	command := exec.Command(filepath.Join(root, "scripts", "build-codex-local.sh"), "--output", codexOutput)
	command.Dir = root
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build Host A: %v\n%s", err, output)
	}
	archives, err := filepath.Glob(filepath.Join(codexOutput, "*.tgz"))
	if err != nil || len(archives) != 1 {
		t.Fatalf("Host A artifact = %v, err = %v", archives, err)
	}
	if err := os.MkdirAll(extractRoot, 0o700); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("tar", "-xzf", archives[0], "-C", extractRoot).CombinedOutput(); err != nil {
		t.Fatalf("install Host A: %v\n%s", err, output)
	}
	codexRuntime := filepath.Join(extractRoot, "package", "runtime", "darwin-arm64", "dev-flow")
	deepseekBuild := exec.Command(filepath.Join(root, "scripts", "build-deepseek-runtime.sh"))
	deepseekBuild.Dir = root
	output, err := deepseekBuild.Output()
	if err != nil {
		t.Fatalf("build Host B: %v", err)
	}
	deepseekRuntime := strings.TrimSpace(string(output))

	dataDirectory := filepath.Join(buildRoot, "data")
	if err := os.Mkdir(dataDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	fakeBin := filepath.Join(buildRoot, "bin")
	if err := os.Mkdir(fakeBin, 0o700); err != nil {
		t.Fatal(err)
	}
	openMarker := filepath.Join(buildRoot, "opened-url")
	openScript := filepath.Join(fakeBin, "open")
	if err := os.WriteFile(openScript, []byte("#!/bin/sh\nprintf '%s' \"$1\" >\"$DEV_FLOW_OPEN_MARKER\"\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	environment := append(os.Environ(), "DEV_FLOW_DATA_DIR="+dataDirectory, "DEV_FLOW_OPEN_MARKER="+openMarker, "PATH="+fakeBin+":"+os.Getenv("PATH"))

	start := runWebUIJourneyCommand(t, codexRuntime, environment, "start", "--no-open", "--json")
	t.Cleanup(func() {
		stop := exec.Command(codexRuntime, "webui", "stop", "--json")
		stop.Env = environment
		_ = stop.Run()
	})
	status := runWebUIJourneyCommand(t, deepseekRuntime, environment, "status", "--json")
	if start.Readiness != "ready" || status.Readiness != "ready" || start.PID != status.PID || start.URL != status.URL || start.DataRootDigest != status.DataRootDigest || start.CoreIdentity != status.CoreIdentity {
		t.Fatalf("Host A/B runtime mismatch: %#v / %#v", start, status)
	}
	opened := runWebUIJourneyCommand(t, deepseekRuntime, environment, "open", "--json")
	if opened.PID != start.PID || opened.URL != start.URL {
		t.Fatalf("Host B open started another runtime: %#v / %#v", start, opened)
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		content, readErr := os.ReadFile(openMarker)
		if readErr == nil && string(content) == start.URL {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("Host B did not open the shared Host A URL")
}

func runWebUIJourneyCommand(t *testing.T, runtimePath string, environment []string, arguments ...string) webUIJourneyState {
	t.Helper()
	command := exec.Command(runtimePath, append([]string{"webui"}, arguments...)...)
	command.Env = environment
	output, err := command.Output()
	if err != nil {
		if exit, ok := err.(*exec.ExitError); ok {
			t.Fatalf("%s %v: %v\n%s", runtimePath, arguments, err, exit.Stderr)
		}
		t.Fatal(err)
	}
	var state webUIJourneyState
	if err := json.Unmarshal(output, &state); err != nil {
		t.Fatalf("decode %s %v: %v\n%s", runtimePath, arguments, err, output)
	}
	return state
}

func journeyRepositoryRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve journey source path")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}
