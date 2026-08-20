package contract_test

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

var (
	feature008RequirementPattern = regexp.MustCompile(`^- \*\*((?:FR-\d{3})|(?:FR-S\d{3})|(?:SC-\d{3}))\*\*:`)
	feature008ChecklistPattern   = regexp.MustCompile(`^- \[[xX ]\] (CHK\d{3})\b`)
	feature008TaskPattern        = regexp.MustCompile(`^- \[[xX ]\] (T\d{3})\b`)
	feature008TransitionPattern  = regexp.MustCompile(`^\| (\d+) \| ` + "`" + `([a-z][a-z0-9_]*)` + "`" + ` \|`)
	feature008TemplatePattern    = regexp.MustCompile(`(?i)(?:\[NEEDS CLARIFICATION(?::[^\]]+)?\]|\b(?:TODO|TBD|TKTK)\b|\?\?\?|\{\{[^}]+\}\})`)
)

func TestFeature008DocumentContract(t *testing.T) {
	t.Parallel()

	root := markdownRepositoryRoot(t)
	featureDir := filepath.Join(root, "specs", "008-refactor-to-development-process-graph")
	requiredFiles := []string{
		"README.md",
		"spec.md",
		"plan.md",
		"research.md",
		"data-model.md",
		"quickstart.md",
		"tasks.md",
		filepath.Join("checklists", "requirements.md"),
		filepath.Join("contracts", "README.md"),
		filepath.Join("contracts", "process-graph.md"),
		filepath.Join("contracts", "method-profiles.md"),
		filepath.Join("contracts", "mcp-tools-0.2.md"),
		filepath.Join("contracts", "storage-generation-2.md"),
	}

	for _, relative := range requiredFiles {
		path := filepath.Join(featureDir, relative)
		info, err := os.Stat(path)
		if err != nil {
			t.Errorf("required Feature 008 file %s: %v", relative, err)
			continue
		}
		if info.IsDir() {
			t.Errorf("required Feature 008 file %s is a directory", relative)
		}
	}

	markdownFiles := feature008MarkdownFiles(t, featureDir)
	for _, path := range markdownFiles {
		checkMarkdownLinks(t, root, path)
		checkFeature008TemplateMarkers(t, root, path)
	}

	assertFeature008Identifiers(t, filepath.Join(featureDir, "spec.md"), feature008RequirementPattern, map[string]int{
		"FR":   48,
		"FR-S": 11,
		"SC":   25,
	})
	assertFeature008Sequence(t, filepath.Join(featureDir, "checklists", "requirements.md"), feature008ChecklistPattern, "CHK", 60)
	assertFeature008Sequence(t, filepath.Join(featureDir, "tasks.md"), feature008TaskPattern, "T", 112)
	assertFeature008Transitions(t, filepath.Join(featureDir, "contracts", "process-graph.md"))
}

func feature008MarkdownFiles(t *testing.T, featureDir string) []string {
	t.Helper()

	var paths []string
	err := filepath.WalkDir(featureDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() && strings.EqualFold(filepath.Ext(entry.Name()), ".md") {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk Feature 008 Markdown files: %v", err)
	}
	return paths
}

func checkFeature008TemplateMarkers(t *testing.T, root, path string) {
	t.Helper()

	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", relativePath(root, path), err)
	}
	if marker := feature008TemplatePattern.Find(contents); marker != nil {
		t.Errorf("%s contains unresolved template marker %q", relativePath(root, path), marker)
	}
}

func assertFeature008Identifiers(t *testing.T, path string, pattern *regexp.Regexp, expected map[string]int) {
	t.Helper()

	identifiers := feature008Identifiers(t, path, pattern)
	counts := map[string]int{}
	for _, identifier := range identifiers {
		prefix := strings.Split(identifier, "-")[0]
		if strings.HasPrefix(identifier, "FR-S") {
			prefix = "FR-S"
		}
		counts[prefix]++
	}
	for prefix, count := range expected {
		if counts[prefix] != count {
			t.Errorf("%s defines %d %s identifiers, want %d", filepath.Base(path), counts[prefix], prefix, count)
		}
	}
}

func assertFeature008Sequence(t *testing.T, path string, pattern *regexp.Regexp, prefix string, count int) {
	t.Helper()

	identifiers := feature008Identifiers(t, path, pattern)
	if len(identifiers) != count {
		t.Fatalf("%s defines %d %s identifiers, want %d", filepath.Base(path), len(identifiers), prefix, count)
	}
	for index, identifier := range identifiers {
		want := fmt.Sprintf("%s%03d", prefix, index+1)
		if identifier != want {
			t.Errorf("%s identifier %d is %s, want %s", filepath.Base(path), index+1, identifier, want)
		}
	}
}

func feature008Identifiers(t *testing.T, path string, pattern *regexp.Regexp) []string {
	t.Helper()

	file, err := os.Open(path)
	if err != nil {
		t.Fatalf("open %s: %v", path, err)
	}
	defer file.Close()

	seen := map[string]bool{}
	var identifiers []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		match := pattern.FindStringSubmatch(scanner.Text())
		if len(match) == 0 {
			continue
		}
		identifier := match[len(match)-1]
		if seen[identifier] {
			t.Errorf("%s defines duplicate identifier %s", filepath.Base(path), identifier)
			continue
		}
		seen[identifier] = true
		identifiers = append(identifiers, identifier)
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan %s: %v", path, err)
	}
	return identifiers
}

func assertFeature008Transitions(t *testing.T, path string) {
	t.Helper()

	file, err := os.Open(path)
	if err != nil {
		t.Fatalf("open %s: %v", path, err)
	}
	defer file.Close()

	seen := map[string]bool{}
	count := 0
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		match := feature008TransitionPattern.FindStringSubmatch(scanner.Text())
		if len(match) == 0 {
			continue
		}
		count++
		ordinal, conversionErr := strconv.Atoi(match[1])
		if conversionErr != nil || ordinal != count {
			t.Errorf("transition row %d has ordinal %s", count, match[1])
		}
		if seen[match[2]] {
			t.Errorf("duplicate transition identifier %s", match[2])
		}
		seen[match[2]] = true
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan %s: %v", path, err)
	}
	if count != 29 {
		t.Errorf("process graph defines %d normal transitions, want 29", count)
	}
}
