package webui

import (
	"encoding/json"
	"time"
)

type Readiness string

const (
	ReadinessReady        Readiness = "ready"
	ReadinessReadOnly     Readiness = "read_only"
	ReadinessIncompatible Readiness = "incompatible"
	ReadinessUnavailable  Readiness = "unavailable"
)

type Lifecycle string

const (
	LifecycleActive    Lifecycle = "active"
	LifecycleBlocked   Lifecycle = "blocked"
	LifecycleDone      Lifecycle = "done"
	LifecycleCancelled Lifecycle = "cancelled"
)

type TaskSummary struct {
	TaskID            string    `json:"task_id"`
	RequestSummary    string    `json:"request_summary"`
	OriginHost        string    `json:"origin_host"`
	ExecutionHost     string    `json:"execution_host"`
	CurrentNode       string    `json:"current_node"`
	Lifecycle         Lifecycle `json:"lifecycle"`
	Revision          uint64    `json:"revision"`
	UpdatedAt         time.Time `json:"updated_at"`
	Archived          bool      `json:"archived"`
	RepositoryKeys    []string  `json:"repository_keys"`
	RepositoryGroupID string    `json:"repository_group_id"`
	WorktreePath      string    `json:"worktree_path"`
	Blocker           *string   `json:"blocker"`
	Outcome           *string   `json:"outcome"`
}

type Fact struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Value string `json:"value"`
}

type DashboardCount struct {
	Lifecycle Lifecycle `json:"lifecycle"`
	Count     int       `json:"count"`
}

type DashboardResponse struct {
	OK        bool             `json:"ok"`
	RequestID string           `json:"request_id"`
	Readiness Readiness        `json:"readiness"`
	Counts    []DashboardCount `json:"counts"`
	Recent    []TaskSummary    `json:"recent"`
}

type TaskListResponse struct {
	OK        bool          `json:"ok"`
	RequestID string        `json:"request_id"`
	Readiness Readiness     `json:"readiness"`
	Page      int           `json:"page"`
	HasNext   bool          `json:"has_next"`
	Items     []TaskSummary `json:"items"`
}

type TaskEventView struct {
	Revision             uint64    `json:"revision"`
	EventType            string    `json:"event_type"`
	SourceNode           string    `json:"source_node"`
	DestinationNode      string    `json:"destination_node"`
	TransitionID         *string   `json:"transition_id"`
	Reason               *string   `json:"reason"`
	RepositoryDeltaPaths []string  `json:"repository_delta_paths"`
	CreatedAt            time.Time `json:"created_at"`
}

type GraphNode struct {
	NodeID  string `json:"node_id"`
	Kind    string `json:"kind"`
	Purpose string `json:"purpose"`
}

type GraphTransition struct {
	TransitionID string `json:"transition_id"`
	Source       string `json:"source"`
	Destination  string `json:"destination"`
}

type GraphView struct {
	ProcessID                 string            `json:"process_id"`
	DefinitionDigest          string            `json:"definition_digest"`
	CurrentNode               string            `json:"current_node"`
	ResumeNode                *string           `json:"resume_node"`
	Nodes                     []GraphNode       `json:"nodes"`
	Transitions               []GraphTransition `json:"transitions"`
	ActualTransitionIDs       []string          `json:"actual_transition_ids"`
	CurrentLegalTransitionIDs []string          `json:"current_legal_transition_ids"`
	FutureNodeIDs             []string          `json:"future_node_ids"`
	FutureTransitionIDs       []string          `json:"future_transition_ids"`
}

type ActionView struct {
	ActionID                string          `json:"action_id"`
	ActionKind              string          `json:"action_kind"`
	ProcessID               string          `json:"process_id"`
	ProcessDefinitionDigest string          `json:"process_definition_digest"`
	SourceNode              string          `json:"source_node"`
	RepositoryBindingDigest string          `json:"repository_binding_digest"`
	IssuanceIdentityDigest  string          `json:"issuance_identity_digest"`
	IssuanceHistoryDigest   string          `json:"issuance_history_digest"`
	IssuanceContentDigest   string          `json:"issuance_content_digest"`
	Purpose                 string          `json:"purpose"`
	Conditions              []string        `json:"conditions"`
	AllowedEffects          []string        `json:"allowed_effects"`
	RequiredEvidence        []string        `json:"required_evidence"`
	MethodSteps             []string        `json:"method_steps"`
	LegalTransitionIDs      []string        `json:"legal_transition_ids"`
	PayloadSchema           json.RawMessage `json:"payload_schema"`
}

type RepositoryView struct {
	Key               string                   `json:"key"`
	Path              string                   `json:"path"`
	Role              string                   `json:"role"`
	RepositoryGroupID string                   `json:"repository_group_id"`
	Origin            WorkspaceOriginView      `json:"workspace_origin"`
	Observation       WorkspaceObservationView `json:"workspace_observation"`
}

type WorkspaceOriginView struct {
	Mode                  string `json:"mode"`
	RemoteName            string `json:"remote_name"`
	BaseBranch            string `json:"base_branch"`
	BaseCommit            string `json:"base_commit"`
	TaskBranch            string `json:"task_branch"`
	ProvisioningReceiptID string `json:"provisioning_receipt_id"`
}

type ChangedEntryView struct {
	Path          string `json:"path"`
	ChangeType    string `json:"change_type"`
	FileMode      string `json:"file_mode"`
	Gitlink       bool   `json:"gitlink"`
	ContentDigest string `json:"content_digest"`
}

type WorkspaceObservationView struct {
	WorktreeInstanceDigest string             `json:"worktree_instance_digest"`
	IdentityDigest         string             `json:"identity_digest"`
	HistoryDigest          string             `json:"history_digest"`
	ContentDigest          string             `json:"content_digest"`
	CurrentBranch          *string            `json:"current_branch"`
	Detached               bool               `json:"detached"`
	CurrentHead            string             `json:"current_head"`
	HeadTree               string             `json:"head_tree"`
	HistoryRelation        string             `json:"history_relation"`
	BaseCommitAncestor     bool               `json:"base_commit_ancestor"`
	ChangedEntries         []ChangedEntryView `json:"changed_entries"`
	TaskSurface            []ChangedEntryView `json:"task_surface"`
	ObservedAt             time.Time          `json:"observed_at"`
	BindingDigest          string             `json:"binding_digest"`
}

type RelocationView struct {
	Pending      bool    `json:"pending"`
	RelocationID *string `json:"relocation_id"`
	ResumeNode   *string `json:"resume_node"`
}

type CleanupView struct {
	Automatic                 bool `json:"automatic"`
	HostActionRequired        bool `json:"host_action_required"`
	SeparateWorktreeAndBranch bool `json:"separate_worktree_and_branch"`
	Terminal                  bool `json:"terminal"`
}

type WorkspaceView struct {
	ProvisioningStatus  string         `json:"provisioning_status"`
	CurrentChangedPaths []string       `json:"current_changed_paths"`
	HistoryConflict     bool           `json:"history_conflict"`
	Relocation          RelocationView `json:"relocation"`
	Cleanup             CleanupView    `json:"cleanup"`
}

type TaskDetailResponse struct {
	OK                 bool             `json:"ok"`
	RequestID          string           `json:"request_id"`
	Readiness          Readiness        `json:"readiness"`
	Summary            TaskSummary      `json:"summary"`
	Intent             string           `json:"intent"`
	AcceptanceCriteria []string         `json:"acceptance_criteria"`
	VerificationBudget string           `json:"verification_budget"`
	MethodProfile      string           `json:"method_profile"`
	Repositories       []RepositoryView `json:"repositories"`
	Baselines          []Fact           `json:"baselines"`
	Records            []Fact           `json:"records"`
	Evidence           []Fact           `json:"evidence"`
	Blocker            *Fact            `json:"blocker"`
	Outcome            *Fact            `json:"outcome"`
	Events             []TaskEventView  `json:"events"`
	Graph              GraphView        `json:"graph"`
	CurrentAction      *ActionView      `json:"current_action"`
	FileScope          FileScopeView    `json:"file_scope"`
	Workspace          WorkspaceView    `json:"workspace"`
}

type FileScopeView struct {
	ExpectedPaths       []string `json:"expected_paths"`
	CurrentChangedPaths []string `json:"current_changed_paths"`
	UnexplainedPaths    []string `json:"unexplained_paths"`
	CoveredHostTools    []string `json:"covered_host_tools"`
	DecisionCount       int      `json:"decision_count"`
	FinalCheckEnabled   bool     `json:"final_check_enabled"`
}

type SystemStatusResponse struct {
	OK             bool      `json:"ok"`
	RequestID      string    `json:"request_id"`
	Readiness      Readiness `json:"readiness"`
	CoreIdentity   string    `json:"core_identity"`
	DataRootDigest string    `json:"data_root_digest"`
	URL            string    `json:"url"`
}

type FilterOptionsResponse struct {
	OK        bool     `json:"ok"`
	RequestID string   `json:"request_id"`
	NodeIDs   []string `json:"node_ids"`
}

type RecoveryAction string

const (
	RecoveryNone                   RecoveryAction = "none"
	RecoveryCorrectCurrentAction   RecoveryAction = "correct_current_action"
	RecoveryRetryCurrentAction     RecoveryAction = "retry_current_action"
	RecoverySubmitRecoveryApply    RecoveryAction = "submit_recovery_apply"
	RecoveryReadNextAction         RecoveryAction = "read_next_action"
	RecoveryResolveBlocker         RecoveryAction = "resolve_blocker"
	RecoveryStopForRepositoryDrift RecoveryAction = "stop_for_repository_drift"
)

type RecoveryAdvice struct {
	Action    RecoveryAction `json:"action"`
	RetrySafe bool           `json:"retry_safe"`
	Message   string         `json:"message"`
}

type MutationResponse struct {
	OK                 bool            `json:"ok"`
	RequestID          string          `json:"request_id"`
	WorkflowWriteState string          `json:"workflow_write_state"`
	TaskRevision       *uint64         `json:"task_revision"`
	Redirect           *string         `json:"redirect"`
	Recovery           *RecoveryAdvice `json:"recovery"`
	RelocationID       *string         `json:"relocation_id"`
}

type ErrorResponse struct {
	Code       string   `json:"code"`
	Message    string   `json:"message"`
	FieldPaths []string `json:"field_paths"`
	GuardID    *string  `json:"guard_id"`
}

type FailureResponse struct {
	OK                 bool           `json:"ok"`
	RequestID          string         `json:"request_id"`
	WorkflowWriteState string         `json:"workflow_write_state"`
	Error              ErrorResponse  `json:"error"`
	Recovery           RecoveryAdvice `json:"recovery"`
}

type ResumeTaskRequest struct {
	RequestID      string `json:"request_id"`
	ExecutionHost  string `json:"execution_host"`
	RepositoryPath string `json:"repository_path"`
	CSRF           string `json:"csrf"`
}

type PrepareRelocationRequest struct {
	RequestID     string `json:"request_id"`
	ExecutionHost string `json:"execution_host"`
	TaskRevision  uint64 `json:"task_revision"`
	Confirmed     bool   `json:"confirmed"`
	CSRF          string `json:"csrf"`
}

type AbandonMutationRequest struct {
	RequestID     string `json:"request_id"`
	ExecutionHost string `json:"execution_host"`
	TaskRevision  uint64 `json:"task_revision"`
	Reason        string `json:"reason"`
	Confirmed     bool   `json:"confirmed"`
	CSRF          string `json:"csrf"`
}

type ReasonedMutationRequest struct {
	RequestID    string `json:"request_id"`
	TaskRevision uint64 `json:"task_revision"`
	Reason       string `json:"reason"`
	Confirmed    bool   `json:"confirmed"`
	CSRF         string `json:"csrf"`
}

type ArchiveMutationRequest struct {
	RequestID    string `json:"request_id"`
	TaskRevision uint64 `json:"task_revision"`
	Archived     bool   `json:"archived"`
	CSRF         string `json:"csrf"`
}

type PurgeMutationRequest struct {
	RequestID    string `json:"request_id"`
	TaskRevision uint64 `json:"task_revision"`
	TypedTaskID  string `json:"typed_task_id"`
	Reason       string `json:"reason"`
	Irreversible bool   `json:"irreversible"`
	CSRF         string `json:"csrf"`
}

type ActionSubmissionRequest struct {
	RequestID               string          `json:"request_id"`
	TaskRevision            uint64          `json:"task_revision"`
	ActionID                string          `json:"action_id"`
	ActionKind              string          `json:"action_kind"`
	ProcessID               string          `json:"process_id"`
	ProcessDefinitionDigest string          `json:"process_definition_digest"`
	SourceNode              string          `json:"source_node"`
	RepositoryBindingDigest string          `json:"repository_binding_digest"`
	IssuanceIdentityDigest  string          `json:"issuance_identity_digest"`
	IssuanceHistoryDigest   string          `json:"issuance_history_digest"`
	IssuanceContentDigest   string          `json:"issuance_content_digest"`
	Payload                 json.RawMessage `json:"payload"`
	CSRF                    string          `json:"csrf"`
}

type OperationProbe struct {
	OperationID             string          `json:"operation_id"`
	ExpectedRevision        uint64          `json:"expected_revision"`
	ActionID                string          `json:"action_id"`
	ActionKind              string          `json:"action_kind"`
	ProcessID               string          `json:"process_id"`
	ProcessDefinitionDigest string          `json:"process_definition_digest"`
	SourceNode              string          `json:"source_node"`
	RepositoryBindingDigest string          `json:"repository_binding_digest"`
	IssuanceIdentityDigest  string          `json:"issuance_identity_digest"`
	IssuanceHistoryDigest   string          `json:"issuance_history_digest"`
	IssuanceContentDigest   string          `json:"issuance_content_digest"`
	Payload                 json.RawMessage `json:"payload"`
}

type RecoveryAssessmentRequest struct {
	Operation OperationProbe `json:"operation"`
	CSRF      string         `json:"csrf"`
}

type RecoverySubmissionRequest struct {
	Operation      OperationProbe `json:"operation"`
	RecoveryAction RecoveryAction `json:"recovery_action"`
	CSRF           string         `json:"csrf"`
}
