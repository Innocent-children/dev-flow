package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestSkillArtifactExamplesMatchCommandDTOs(t *testing.T) {
	for _, host := range []string{"codex", "deepseek"} {
		t.Run(host, func(t *testing.T) { validateSkillArtifactExamples(t, host) })
	}
}
func validateSkillArtifactExamples(t *testing.T, host string) {
	path := filepath.Join("..", "..", "packages", "codex", "plugin", "skills", "dev-flow", "references", "artifact-contract.md")
	if host == "deepseek" {
		path = filepath.Join("..", "..", "packages", "deepseek", "skills", "dev-flow", "references", "artifact-contract.md")
	}
	text, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	pattern := regexp.MustCompile("(?s)<!-- example:artifact (collect|prepare) [a-z-]+ -->\\n```json\\n(.*?)\\n```")
	seen := map[string]bool{}
	for _, match := range pattern.FindAllSubmatch(bytes.ReplaceAll(text, []byte("\r\n"), []byte("\n")), -1) {
		command := string(match[1])
		t.Run(command, func(t *testing.T) {
			seen[command] = true
			if command == "collect" {
				var input application.CollectArtifactsRequest
				if err := decodeArtifactInput(match[2], &input); err != nil {
					t.Fatal(err)
				}
				if input.Host != domain.Host(host) || !input.TaskID.IsValid() || !input.ActionID.IsValid() {
					t.Fatal("invalid collection identity")
				}
			} else {
				var input application.PrepareArtifactsRequest
				if err := decodeArtifactInput(match[2], &input); err != nil {
					t.Fatal(err)
				}
				if input.Host != domain.Host(host) || !input.Collection.TaskID.IsValid() || !input.Collection.ActionID.IsValid() || input.Collection.Revision == 0 || !input.Collection.ObservationDigest.IsValid() {
					t.Fatal("invalid preparation identity")
				}
				for _, file := range input.Collection.Files {
					if file.Slot != "current" || (domain.ArtifactReference{Role: domain.ArtifactRequirements, Path: file.Path, Digest: file.Digest, Summary: file.Summary}).Validate() != nil {
						t.Fatal("invalid example requirements artifact")
					}
				}
			}
		})
	}
	for _, command := range []string{"collect", "prepare"} {
		if !seen[command] {
			t.Errorf("missing artifact %s example", command)
		}
	}
	outputPattern := regexp.MustCompile("(?s)<!-- example:artifact-output (collect|prepare) [a-z-]+ -->\\n```json\\n(.*?)\\n```")
	for _, match := range outputPattern.FindAllSubmatch(bytes.ReplaceAll(text, []byte("\r\n"), []byte("\n")), -1) {
		var envelope struct {
			OK     bool            `json:"ok"`
			Result json.RawMessage `json:"result"`
		}
		if err := decodeArtifactInput(match[2], &envelope); err != nil || !envelope.OK {
			t.Fatalf("invalid success envelope: %v", err)
		}
		var collection application.ArtifactCollection
		var prepared application.PreparedArtifacts
		var target any = &collection
		if string(match[1]) == "prepare" {
			target = &prepared
		}
		if err := decodeArtifactInput(envelope.Result, target); err != nil {
			t.Fatal(err)
		}
	}
}
