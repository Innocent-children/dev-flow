package store

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func encodeTask(task domain.Task) ([]byte, error) {
	if err := workflow.ValidateTask(task); err != nil {
		return nil, ErrInvalidArgument
	}
	encoded, err := encodeCompactJSON(taskToDTO(task))
	if err != nil || len(encoded) > domain.MaxPersistedTaskSnapshotBytes {
		return nil, ErrInvalidArgument
	}
	return encoded, nil
}

func encodeCompactJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	encoded := buffer.Bytes()
	if len(encoded) == 0 || encoded[len(encoded)-1] != '\n' {
		return nil, ErrInvalidArgument
	}
	return append([]byte(nil), encoded[:len(encoded)-1]...), nil
}

func decodeTask(encoded []byte) (domain.Task, error) {
	var task domain.Task
	if len(encoded) == 0 || len(encoded) > domain.MaxPersistedTaskSnapshotBytes {
		return task, ErrStorageUnavailable
	}

	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	var persisted persistedTask
	if err := decoder.Decode(&persisted); err != nil {
		return domain.Task{}, ErrStorageUnavailable
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		return domain.Task{}, ErrStorageUnavailable
	}
	contract, err := domain.NewContract(
		persisted.Contract.Goal,
		persisted.Contract.Scope,
		persisted.Contract.OutOfScope,
		persisted.Contract.AcceptanceCriteria,
		persisted.Contract.VerificationBudget,
	)
	if err != nil {
		return domain.Task{}, ErrStorageUnavailable
	}
	task = domain.Task{
		TaskID:        persisted.TaskID,
		OriginHost:    persisted.OriginHost,
		Contract:      contract,
		Repository:    persisted.Repository,
		Phase:         persisted.Phase,
		ResumePhase:   persisted.ResumePhase,
		CurrentAction: persisted.CurrentAction,
		Blocker:       persisted.Blocker,
		LastOperation: persisted.LastOperation,
		Evidence:      persisted.Evidence,
		Outcome:       persisted.Outcome,
		Revision:      persisted.Revision,
		CreatedAt:     persisted.CreatedAt,
		UpdatedAt:     persisted.UpdatedAt,
		CompletedAt:   persisted.CompletedAt,
	}
	if err := workflow.ValidateTask(task); err != nil {
		return domain.Task{}, ErrStorageUnavailable
	}
	return task, nil
}

type persistedTask struct {
	TaskID        domain.ID                `json:"task_id"`
	OriginHost    domain.Host              `json:"origin_host"`
	Contract      persistedContract        `json:"contract"`
	Repository    domain.RepositoryBinding `json:"repository"`
	Phase         domain.Phase             `json:"phase"`
	ResumePhase   *domain.Phase            `json:"resume_phase"`
	CurrentAction *domain.Action           `json:"current_action"`
	Blocker       *domain.Blocker          `json:"blocker"`
	LastOperation *domain.LastOperation    `json:"last_operation"`
	Evidence      []domain.EvidenceSummary `json:"evidence"`
	Outcome       *domain.Outcome          `json:"outcome"`
	Revision      uint64                   `json:"revision"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
	CompletedAt   *time.Time               `json:"completed_at"`
}

type persistedContract struct {
	Goal               string                    `json:"goal"`
	Scope              []string                  `json:"scope"`
	OutOfScope         []string                  `json:"out_of_scope"`
	AcceptanceCriteria []string                  `json:"acceptance_criteria"`
	VerificationBudget domain.VerificationBudget `json:"verification_budget"`
}

func taskToDTO(task domain.Task) persistedTask {
	return persistedTask{
		TaskID:     task.TaskID,
		OriginHost: task.OriginHost,
		Contract: persistedContract{
			Goal:               task.Contract.Goal(),
			Scope:              task.Contract.Scope(),
			OutOfScope:         task.Contract.OutOfScope(),
			AcceptanceCriteria: task.Contract.AcceptanceCriteria(),
			VerificationBudget: task.Contract.VerificationBudget(),
		},
		Repository:    task.Repository,
		Phase:         task.Phase,
		ResumePhase:   task.ResumePhase,
		CurrentAction: task.CurrentAction,
		Blocker:       task.Blocker,
		LastOperation: task.LastOperation,
		Evidence:      task.Evidence,
		Outcome:       task.Outcome,
		Revision:      task.Revision,
		CreatedAt:     task.CreatedAt,
		UpdatedAt:     task.UpdatedAt,
		CompletedAt:   task.CompletedAt,
	}
}
