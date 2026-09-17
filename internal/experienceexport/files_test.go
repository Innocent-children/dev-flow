package experienceexport

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestCompleteReplacementAndRepositoryBoundary(t *testing.T) {
	data := t.TempDir()
	repo := t.TempDir()
	w := Writer{Directory: data}
	path, err := w.Write("project", "task", []byte("first"), []string{repo})
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err = w.Write("project", "task", []byte("second"), []string{repo}); err != nil {
			t.Fatal(err)
		}
	}
	raw, _ := os.ReadFile(path)
	if !bytes.Equal(raw, []byte("second")) {
		t.Fatal("partial or appended export")
	}
	entries, _ := os.ReadDir(filepath.Dir(path))
	if len(entries) != 1 {
		t.Fatal("temporary file leaked")
	}
	if _, err = (Writer{Directory: repo}).Write("project", "task", []byte("bad"), []string{repo}); err == nil {
		t.Fatal("repository export allowed")
	}
	entries, _ = os.ReadDir(repo)
	if len(entries) != 0 {
		t.Fatal("repository changed")
	}
	if err = os.MkdirAll(filepath.Join(data, "unsafe"), 0700); err != nil {
		t.Fatal(err)
	}
	if err = os.Symlink(repo, filepath.Join(data, "unsafe", "experiences")); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	if _, err = (Writer{Directory: filepath.Join(data, "unsafe")}).Write("project", "task", []byte("bad"), []string{repo}); err == nil {
		t.Fatal("symlink directory allowed")
	}
}
func TestExportLeavesNativeGitStatusUnchanged(t *testing.T) {
	repo := t.TempDir()
	run := func(args ...string) []byte {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", repo}, args...)...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git: %s %v", out, err)
		}
		return out
	}
	run("init", "-q")
	if err := os.WriteFile(filepath.Join(repo, "tracked.txt"), []byte("content"), 0600); err != nil {
		t.Fatal(err)
	}
	run("add", "tracked.txt")
	before := run("status", "--porcelain=v1", "--untracked-files=all")
	w := Writer{Directory: t.TempDir()}
	if _, err := w.Write("project", "task", []byte("experience"), []string{repo}); err != nil {
		t.Fatal(err)
	}
	after := run("status", "--porcelain=v1", "--untracked-files=all")
	if !bytes.Equal(before, after) {
		t.Fatal("export changed Git status")
	}
	raw, _ := os.ReadFile(filepath.Join(repo, "tracked.txt"))
	if string(raw) != "content" {
		t.Fatal("repository bytes changed")
	}
}

func TestFailedReplacementRetainsExistingTarget(t *testing.T) {
	w := Writer{Directory: t.TempDir()}
	path, err := w.Write("project", "task", []byte("saved"), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err = os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(path, "keep"), []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = w.Write("project", "task", []byte("new"), nil); err == nil {
		t.Fatal("replace directory accepted")
	}
	entries, _ := os.ReadDir(filepath.Dir(path))
	if len(entries) != 1 {
		t.Fatal("half export remains")
	}
	raw, _ := os.ReadFile(filepath.Join(path, "keep"))
	if string(raw) != "keep" {
		t.Fatal("target changed on failure")
	}
}
