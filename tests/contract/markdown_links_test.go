package contract_test

import (
	"bufio"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

var markdownLinkPattern = regexp.MustCompile(`!?\[[^\]]*\]\(([^)]+)\)`)

func TestRepositoryRelativeMarkdownLinks(t *testing.T) {
	t.Parallel()

	root := markdownRepositoryRoot(t)
	markdownFiles := []string{filepath.Join(root, "README.md")}
	for _, scope := range []string{
		filepath.Join(root, "docs"),
		filepath.Join(root, "specs", "001-bootstrap-monorepo"),
	} {
		err := filepath.WalkDir(scope, func(path string, entry os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if !entry.IsDir() && strings.EqualFold(filepath.Ext(entry.Name()), ".md") {
				markdownFiles = append(markdownFiles, path)
			}
			return nil
		})
		if err != nil {
			t.Fatalf("walk Markdown scope %s: %v", scope, err)
		}
	}

	sort.Strings(markdownFiles)
	for _, markdownFile := range markdownFiles {
		checkMarkdownLinks(t, root, markdownFile)
	}
}

func checkMarkdownLinks(t *testing.T, root, markdownFile string) {
	t.Helper()

	file, err := os.Open(markdownFile)
	if err != nil {
		t.Fatalf("open %s: %v", markdownFile, err)
	}
	defer file.Close()

	inFence := false
	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}

		for _, match := range markdownLinkPattern.FindAllStringSubmatch(line, -1) {
			target := markdownLinkTarget(match[1])
			if target == "" || strings.HasPrefix(target, "#") || hasURLScheme(target) {
				continue
			}

			pathPart := strings.SplitN(target, "#", 2)[0]
			pathPart = strings.SplitN(pathPart, "?", 2)[0]
			decodedPath, decodeErr := url.PathUnescape(pathPart)
			if decodeErr != nil {
				t.Errorf("%s:%d invalid encoded link %q: %v", relativePath(root, markdownFile), lineNumber, target, decodeErr)
				continue
			}
			resolved := filepath.Clean(filepath.Join(filepath.Dir(markdownFile), filepath.FromSlash(decodedPath)))
			if _, statErr := os.Stat(resolved); statErr != nil {
				t.Errorf("%s:%d relative link %q resolves to missing path %s", relativePath(root, markdownFile), lineNumber, target, relativePath(root, resolved))
			}
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan %s: %v", markdownFile, err)
	}
}

func markdownLinkTarget(raw string) string {
	target := strings.TrimSpace(raw)
	if strings.HasPrefix(target, "<") {
		if closing := strings.Index(target, ">"); closing >= 0 {
			return target[1:closing]
		}
	}
	if fields := strings.Fields(target); len(fields) > 0 {
		return fields[0]
	}
	return ""
}

func hasURLScheme(target string) bool {
	parsed, err := url.Parse(target)
	return err == nil && (parsed.IsAbs() || parsed.Host != "")
}

func markdownRepositoryRoot(t *testing.T) string {
	t.Helper()

	current, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	for {
		if _, statErr := os.Stat(filepath.Join(current, "go.mod")); statErr == nil {
			return current
		}
		parent := filepath.Dir(current)
		if parent == current {
			t.Fatal("repository root containing go.mod not found")
		}
		current = parent
	}
}

func relativePath(root, path string) string {
	relative, err := filepath.Rel(root, path)
	if err != nil {
		return fmt.Sprintf("%s (%v)", path, err)
	}
	return filepath.ToSlash(relative)
}
