//go:build windows

package main

func userHomeDirectory(getenv func(string) string) string {
	if home := getenv("USERPROFILE"); home != "" {
		return home
	}
	return getenv("HOME")
}
