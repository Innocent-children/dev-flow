package webui

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestRuntimeReceiptReuseAndServeLifecycle(t *testing.T) {
	dataDirectory := t.TempDir()
	coreIdentity := "dev-flow/test"
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- Serve(ctx, dataDirectory, coreIdentity) }()

	var state RuntimeState
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		state, _ = Status(context.Background(), dataDirectory, coreIdentity)
		if state.Readiness == ReadinessReady {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if state.Readiness != ReadinessReady || state.URL == "" || state.PID != os.Getpid() {
		t.Fatalf("runtime state = %#v", state)
	}
	receipt, err := ReadReceipt(dataDirectory)
	if err != nil {
		t.Fatal(err)
	}
	if receipt.URL != state.URL || receipt.DataRootDigest != state.DataRootDigest {
		t.Fatalf("receipt/state mismatch: %#v / %#v", receipt, state)
	}
	info, err := os.Stat(ReceiptPath(dataDirectory))
	if err != nil || !validRuntimeReceiptFile(info) {
		t.Fatalf("receipt file validation failed: mode = %v, err = %v", info.Mode(), err)
	}
	reused, err := Start(context.Background(), dataDirectory, coreIdentity, true)
	if err != nil || reused.PID != state.PID || reused.URL != state.URL {
		t.Fatalf("reused state = %#v, err = %v", reused, err)
	}

	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(ReceiptPath(dataDirectory)); !os.IsNotExist(err) {
		t.Fatalf("receipt remains after shutdown: %v", err)
	}
}

func TestStatusRejectsMismatchedLiveCoreIdentity(t *testing.T) {
	dataDirectory := t.TempDir()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- Serve(ctx, dataDirectory, "dev-flow/one") }()
	t.Cleanup(func() { cancel(); <-done })

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		state, _ := Status(context.Background(), dataDirectory, "dev-flow/two")
		if state.Readiness == ReadinessIncompatible {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("mismatched live Core did not become incompatible")
}
