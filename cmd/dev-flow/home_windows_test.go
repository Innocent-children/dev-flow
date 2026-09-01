//go:build windows

package main

import "testing"

func TestRunMCPHomeDirectoryUsesUserProfileOnWindows(t *testing.T) {
	getenv := func(name string) string {
		switch name {
		case "USERPROFILE":
			return `C:\Users\ordinary`
		case "HOME":
			return `C:\git-home`
		default:
			return ""
		}
	}
	if got := userHomeDirectory(getenv); got != `C:\Users\ordinary` {
		t.Fatalf("home directory = %q", got)
	}
}
