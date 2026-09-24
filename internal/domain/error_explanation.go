package domain

import "errors"

/**
 * WithExplanation records a public explanation authored at the failing check.
 * Callers must use Core-owned text, never err.Error(), submitted values, paths
 * or driver output. It preserves the error category and existing write proof;
 * adding an explanation cannot grant permission to retry.
 */
func WithExplanation(err error, explanation string) *Error {
	var source *Error
	if !errors.As(err, &source) || source == nil {
		source = ErrInternal
	}
	copy := *source
	if copy.explanation == "" {
		copy.explanation = explanation
	}
	return &copy
}

func (e *Error) PublicExplanation() string {
	if e == nil {
		return ""
	}
	return e.explanation
}

/**
 * ExplainedViolation adds requirements from a Core-owned schema or validation
 * rule. The separate private copy prevents arbitrary Error.Message or decoded
 * violation text from being published as trusted diagnostics.
 */
func ExplainedViolation(path string, rule ViolationRule, explanation string) ContractViolation {
	v := Violation(path, rule)
	if v.Path != "" {
		v.explanation = explanation
		v.Message = explanation
	}
	return v
}

func (v ContractViolation) PublicMessage() string {
	if v.explanation != "" {
		return v.explanation
	}
	if v.Rule.IsValid() {
		return v.Rule.Message()
	}
	return GuardRule(v.Rule).Message()
}

/**
 * AtField attaches a pure validation failure to its containing request member.
 * Nested validators keep their precise paths and explanations. This helper is
 * only for validation before writes, not for storage or operation failures.
 */
func AtField(path string, err error) error {
	if err == nil {
		return nil
	}
	var failure *Error
	if errors.As(err, &failure) && failure != nil {
		if len(failure.Violations) != 0 {
			entries := append([]ContractViolation(nil), failure.Violations...)
			for index := range entries {
				entries[index].Path = path + "." + entries[index].Path
			}
			return InvalidArgumentViolations(entries...)
		}
		if failure.PublicExplanation() != "" {
			return InvalidArgumentViolations(ExplainedViolation(path, RuleValueFormat, failure.PublicExplanation()))
		}
	}
	return WithExplanation(err, "The field validator did not provide a specific failure condition.")
}
