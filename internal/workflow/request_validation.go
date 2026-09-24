package workflow

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

/**
 * ValidateRequestJSON rejects ambiguous input before decoding can discard its
 * original structure. Diagnostics retain member locations, never member values.
 */
func ValidateRequestJSON(path string, raw []byte) error {
	if !utf8.Valid(raw) {
		return domain.InvalidArgumentViolations(domain.Violation(path, domain.RuleUTF8Required))
	}
	if !json.Valid(raw) {
		return domain.InvalidArgumentViolations(domain.Violation(path, domain.RuleJSONMalformed))
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	var walk func(string) error
	walk = func(current string) error {
		token, err := d.Token()
		if err != nil {
			return err
		}
		switch token {
		case json.Delim('{'):
			seen := map[string]bool{}
			for d.More() {
				key, err := d.Token()
				if err != nil {
					return err
				}
				name := key.(string)
				child := requestMemberPath(current, name)
				if seen[name] {
					return domain.InvalidArgumentViolations(domain.Violation(child, domain.RuleDuplicateMember))
				}
				seen[name] = true
				if err := walk(child); err != nil {
					return err
				}
			}
			_, err = d.Token()
			return err
		case json.Delim('['):
			for index := 0; d.More(); index++ {
				if err := walk(requestIndexPath(current, index)); err != nil {
					return err
				}
			}
			_, err = d.Token()
			return err
		}
		return nil
	}
	if err := walk(path); err != nil && err != io.EOF {
		return err
	}
	return nil
}

/**
 * RequestStructureViolations checks the structure that closed decoding needs.
 * Value rules remain with their semantic validators so evidence, transition and
 * permission failures retain their specific categories and correction rules.
 */
func RequestStructureViolations(path string, raw []byte, schema map[string]any) []domain.ContractViolation {
	if len(schema) == 0 {
		return nil
	}
	for _, keyword := range []string{"anyOf", "oneOf"} {
		if alternatives := schemaAlternatives(schema, keyword); len(alternatives) != 0 {
			var best []domain.ContractViolation
			var types []string
			for _, alternative := range alternatives {
				candidate, _ := alternative.(map[string]any)
				types = append(types, requestSchemaTypes(candidate)...)
				if !requestTypeMatches(raw, requestSchemaTypes(candidate)) {
					continue
				}
				violations := RequestStructureViolations(path, raw, candidate)
				if len(violations) == 0 {
					return nil
				}
				if best == nil || len(violations) < len(best) {
					best = violations
				}
			}
			if best != nil {
				return best
			}
			return []domain.ContractViolation{requestTypeViolation(path, types)}
		}
	}
	types := requestSchemaTypes(schema)
	if !requestTypeMatches(raw, types) {
		return []domain.ContractViolation{requestTypeViolation(path, types)}
	}
	if isJSONNull(raw) {
		return nil
	}
	if rawJSONType(raw) == "array" {
		var items []json.RawMessage
		_ = json.Unmarshal(raw, &items)
		itemSchema, _ := schema["items"].(map[string]any)
		var out []domain.ContractViolation
		for index, item := range items {
			out = append(out, RequestStructureViolations(requestIndexPath(path, index), item, itemSchema)...)
		}
		return out
	}
	members, object := jsonObjectMembers(raw)
	if !object {
		return nil
	}
	properties, _ := schema["properties"].(map[string]any)
	var out []domain.ContractViolation
	for _, name := range schemaRequiredNames(schema) {
		if _, present := members[name]; !present {
			out = append(out, domain.Violation(requestMemberPath(path, name), domain.RuleRequiredMemberMissing))
		}
	}
	names := make([]string, 0, len(members))
	for name := range members {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		child := requestMemberPath(path, name)
		member, known := properties[name].(map[string]any)
		if !known {
			if closed, ok := schema["additionalProperties"].(bool); ok && !closed {
				out = append(out, unknownRequestViolation(path, name))
			}
			continue
		}
		out = append(out, RequestStructureViolations(child, members[name], member)...)
	}
	return out
}

func requestSchemaTypes(schema map[string]any) []string {
	switch types := schema["type"].(type) {
	case string:
		return []string{types}
	case []string:
		return types
	case []any:
		var out []string
		for _, value := range types {
			if text, ok := value.(string); ok {
				out = append(out, text)
			}
		}
		return out
	}
	if _, ok := schema["properties"]; ok {
		return []string{"object"}
	}
	if _, ok := schema["items"]; ok {
		return []string{"array"}
	}
	if _, ok := schema["enum"]; ok {
		return []string{"string"}
	}
	if value, ok := schema["const"]; ok {
		raw, _ := json.Marshal(value)
		return []string{rawJSONType(raw)}
	}
	return nil
}

func requestTypeMatches(raw []byte, types []string) bool {
	if len(types) == 0 {
		return true
	}
	actual := rawJSONType(raw)
	for _, expected := range types {
		if actual == expected || actual == "integer" && expected == "number" {
			return true
		}
	}
	return false
}

func requestTypeViolation(path string, types []string) domain.ContractViolation {
	if path == "" {
		path = "arguments"
	}
	seen := map[string]bool{}
	var names []string
	for _, name := range types {
		if !seen[name] {
			names = append(names, name)
			seen[name] = true
		}
	}
	return domain.ExplainedViolation(path, domain.RuleValueType, "value must have JSON type "+strings.Join(names, " or "))
}

func requestMemberPath(path, name string) string {
	child := name
	if path != "" && path != "arguments" {
		child = path + "." + name
	}
	if domain.ValidViolationPath(child) {
		return child
	}
	if path == "" {
		return "arguments"
	}
	return path
}

func requestIndexPath(path string, index int) string {
	child := fmt.Sprintf("%s[%d]", path, index)
	if domain.ValidViolationPath(child) {
		return child
	}
	return path
}

func payloadDecodeFailure(path string, raw []byte, schema map[string]any, cause error) error {
	if violations := RequestStructureViolations(path, raw, schema); len(violations) != 0 {
		return domain.InvalidArgumentViolations(violations...)
	}
	var mismatch *json.UnmarshalTypeError
	if errors.As(cause, &mismatch) {
		member := requestMemberPath(path, mismatch.Field)
		return domain.InvalidArgumentViolations(domain.ExplainedViolation(member, domain.RuleValueType, "value cannot be decoded as "+mismatch.Type.String()))
	}
	return domain.WithExplanation(domain.ErrInvalidArgument, "The payload could not be decoded against its closed node contract; no safe member diagnostic is available.")
}

func unknownRequestViolation(path, name string) domain.ContractViolation {
	fullPath := name
	if path != "" && path != "arguments" {
		fullPath = path + "." + name
	}
	rule := domain.RuleUnknownMember
	if !domain.ValidViolationPath(fullPath) {
		rule = domain.RuleUnsafeMemberName
	}
	return domain.Violation(requestMemberPath(path, name), rule)
}
