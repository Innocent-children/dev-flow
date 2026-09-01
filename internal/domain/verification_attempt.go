package domain

import "time"

// VerificationAttempt stores the facts Core uses to recognize a repeated TEST
// loop. ProcessTask retains the three most recent attempts.
type VerificationAttempt struct {
	TaskRevision           uint64    `json:"task_revision"`
	TaskPlanRevision       uint32    `json:"task_plan_revision"`
	ImplementationRevision uint32    `json:"implementation_revision"`
	DestinationNode        NodeID    `json:"destination_node"`
	EvidenceIDs            []ID      `json:"evidence_ids"`
	ResultDigest           Digest    `json:"result_digest"`
	FailureDigest          Digest    `json:"failure_digest"`
	Failed                 bool      `json:"failed"`
	ChangedPaths           []string  `json:"changed_paths"`
	RecordedAt             time.Time `json:"recorded_at"`
}

func (a VerificationAttempt) Validate() error {
	if a.TaskRevision == 0 || a.TaskPlanRevision == 0 || a.ImplementationRevision == 0 ||
		!a.DestinationNode.Normal() || validateDigest(a.ResultDigest) != nil ||
		len(a.EvidenceIDs) > MaxEvidencePerAction || len(a.ChangedPaths) > MaxFingerprintPaths ||
		validateUTC(a.RecordedAt) != nil {
		return ErrInvalidArgument
	}
	if a.Failed {
		if validateDigest(a.FailureDigest) != nil {
			return ErrInvalidArgument
		}
	} else if a.FailureDigest != "" {
		return ErrInvalidArgument
	}
	evidenceIDs := make(map[ID]struct{}, len(a.EvidenceIDs))
	for _, id := range a.EvidenceIDs {
		if validateID(id) != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceIDs[id]; duplicate {
			return ErrInvalidArgument
		}
		evidenceIDs[id] = struct{}{}
	}
	paths := make(map[string]struct{}, len(a.ChangedPaths))
	for index, path := range a.ChangedPaths {
		if _, duplicate := paths[path]; duplicate {
			return ErrInvalidArgument
		}
		if index > 0 && a.ChangedPaths[index-1] >= path {
			return ErrInvalidArgument
		}
		paths[path] = struct{}{}
	}
	return nil
}
