package mcp

import "github.com/Innocent-children/taskbelay/internal/testpath"

func testPath(elements ...string) string {
	return testpath.Absolute(elements...)
}
