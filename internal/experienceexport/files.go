// Package experienceexport owns local export paths and complete-file replacement.
package experienceexport

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Writer struct{ Directory string }

func (w Writer) Write(project, task string, content []byte, repositoryRoots []string) (string, error) {
	for _, part := range []string{project, task} {
		if part == "" || part == "." || part == ".." || strings.ContainsAny(part, "/\\:") {
			return "", fmt.Errorf("invalid export identity")
		}
	}
	base, err := filepath.EvalSymlinks(w.Directory)
	if err != nil {
		return "", err
	}
	base, err = filepath.Abs(base)
	if err != nil {
		return "", err
	}
	relative := filepath.Join("experiences", project, task+".md")
	target := filepath.Join(base, relative)
	for _, repository := range repositoryRoots {
		canonical, err := filepath.EvalSymlinks(repository)
		if err != nil {
			canonical = filepath.Clean(repository)
		}
		rel, err := filepath.Rel(canonical, target)
		if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return "", fmt.Errorf("export would modify a task repository")
		}
	}
	root, err := os.OpenRoot(base)
	if err != nil {
		return "", err
	}
	defer root.Close()
	dir := ""
	for _, part := range []string{"experiences", project} {
		dir = filepath.Join(dir, part)
		if err = root.Mkdir(dir, 0700); err != nil && !os.IsExist(err) {
			return "", err
		}
		info, err := root.Lstat(dir)
		if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("unsafe export directory")
		}
	}
	var random [16]byte
	if _, err = rand.Read(random[:]); err != nil {
		return "", err
	}
	temporary := filepath.Join(dir, ".export-"+hex.EncodeToString(random[:]))
	f, err := root.OpenFile(temporary, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", err
	}
	defer root.Remove(temporary)
	if _, err = f.Write(content); err != nil {
		f.Close()
		return "", err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return "", err
	}
	if err = f.Close(); err != nil {
		return "", err
	}
	if err = root.Rename(temporary, relative); err != nil {
		return "", err
	}
	return target, nil
}
