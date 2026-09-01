//go:build !windows

package main

func userHomeDirectory(getenv func(string) string) string {
	return getenv("HOME")
}
