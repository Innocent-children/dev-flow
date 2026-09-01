package workflow_test

import "github.com/Innocent-children/dev-flow/internal/testpath"

func testPath(elements ...string) string {
	return testpath.Absolute(elements...)
}
