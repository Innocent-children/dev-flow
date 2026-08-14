package domain

import "time"

type EvidenceRequirement struct {
	Kind     EvidenceRequirementKind `json:"kind"`
	Required bool                    `json:"required"`
}

func (r EvidenceRequirement) Validate() error {
	if !r.Kind.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

type Action struct {
	ActionID                ID                    `json:"action_id"`
	Kind                    ActionKind            `json:"kind"`
	TaskID                  ID                    `json:"task_id"`
	Revision                uint64                `json:"revision"`
	RepositoryBindingDigest Digest                `json:"repository_binding_digest"`
	AllowedEffects          []AllowedEffect       `json:"allowed_effects"`
	RequiredEvidence        []EvidenceRequirement `json:"required_evidence"`
	PayloadContract         Phase                 `json:"payload_contract"`
	Guidance                string                `json:"guidance"`
	IssuedAt                time.Time             `json:"issued_at"`
}

func (a Action) Validate() error {
	if validateID(a.ActionID) != nil || validateID(a.TaskID) != nil || !a.Kind.IsValid() ||
		a.Revision == 0 || validateDigest(a.RepositoryBindingDigest) != nil ||
		(!a.PayloadContract.NormalNonTerminal() && a.PayloadContract != PhaseBlocked) ||
		requireNormalizedText(a.Guidance, MaxGuidanceBytes, true) != nil || validateUTC(a.IssuedAt) != nil ||
		len(a.AllowedEffects) == 0 || len(a.AllowedEffects) > MaxBoundedStringListItems ||
		len(a.RequiredEvidence) == 0 || len(a.RequiredEvidence) > MaxEvidencePerAction {
		return ErrInvalidArgument
	}
	effects := make(map[AllowedEffect]struct{}, len(a.AllowedEffects))
	for _, effect := range a.AllowedEffects {
		if !effect.IsValid() {
			return ErrInvalidArgument
		}
		if _, duplicate := effects[effect]; duplicate {
			return ErrInvalidArgument
		}
		effects[effect] = struct{}{}
	}
	requirements := make(map[EvidenceRequirementKind]struct{}, len(a.RequiredEvidence))
	for _, requirement := range a.RequiredEvidence {
		if requirement.Validate() != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := requirements[requirement.Kind]; duplicate {
			return ErrInvalidArgument
		}
		requirements[requirement.Kind] = struct{}{}
	}
	return nil
}

func (a Action) Clone() Action {
	a.AllowedEffects = append([]AllowedEffect(nil), a.AllowedEffects...)
	a.RequiredEvidence = append([]EvidenceRequirement(nil), a.RequiredEvidence...)
	return a
}
