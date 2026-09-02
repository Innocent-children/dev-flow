package webui

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type readHandlers struct {
	reader ControlCenterReader
	status SystemStatusProvider
}

func (h *readHandlers) dashboard(w http.ResponseWriter, r *http.Request) {
	requestID := readRequestID()
	dashboard, err := h.reader.Dashboard(r.Context())
	if err != nil {
		writeReadError(w, requestID, err)
		return
	}
	counts := []DashboardCount{
		{Lifecycle: LifecycleActive, Count: dashboard.Counts["active"]},
		{Lifecycle: LifecycleBlocked, Count: dashboard.Counts["blocked"]},
		{Lifecycle: LifecycleDone, Count: dashboard.Counts["done"]},
		{Lifecycle: LifecycleCancelled, Count: dashboard.Counts["cancelled"]},
	}
	_ = WriteJSON(w, http.StatusOK, DashboardResponse{OK: true, RequestID: requestID, Readiness: ReadinessReady, Counts: counts, Recent: projectSummaries(dashboard.Recent)})
}

func (h *readHandlers) taskList(w http.ResponseWriter, r *http.Request) {
	requestID := readRequestID()
	filter, err := parseTaskListFilter(r.URL.Query())
	if err != nil {
		writeReadError(w, requestID, err)
		return
	}
	result, err := h.reader.ListTasks(r.Context(), application.ListControlCenterTasksRequest{Filter: filter})
	if err != nil {
		writeReadError(w, requestID, err)
		return
	}
	_ = WriteJSON(w, http.StatusOK, TaskListResponse{OK: true, RequestID: requestID, Readiness: ReadinessReady, Page: result.Page, HasNext: result.HasNext, Items: projectSummaries(result.Items)})
}

func (h *readHandlers) taskDetail(w http.ResponseWriter, r *http.Request) {
	requestID := readRequestID()
	taskID := domain.ID(r.PathValue("task_id"))
	result, err := h.reader.GetTaskDetail(r.Context(), application.GetControlCenterTaskRequest{TaskID: taskID})
	if err != nil {
		writeReadError(w, requestID, err)
		return
	}
	response, err := projectTaskDetail(requestID, result)
	if err != nil {
		writeReadError(w, requestID, domain.ErrInternal)
		return
	}
	_ = WriteJSON(w, http.StatusOK, response)
}

func (h *readHandlers) systemStatus(w http.ResponseWriter, _ *http.Request) {
	status := h.status()
	status.OK = true
	status.RequestID = readRequestID()
	_ = WriteJSON(w, http.StatusOK, status)
}

func (h *readHandlers) filterOptions(w http.ResponseWriter, _ *http.Request) {
	definition := workflow.StandardProcess()
	nodeIDs := make([]string, len(definition.Nodes))
	for index, node := range definition.Nodes {
		nodeIDs[index] = string(node.NodeID)
	}
	_ = WriteJSON(w, http.StatusOK, FilterOptionsResponse{OK: true, RequestID: readRequestID(), NodeIDs: nodeIDs})
}

func parseTaskListFilter(values url.Values) (application.TaskListFilter, error) {
	allowed := map[string]bool{"text": true, "host": true, "repository": true, "node": true, "lifecycle": true, "updated_from": true, "updated_to": true, "page": true}
	for key, entries := range values {
		if !allowed[key] || len(entries) != 1 {
			return application.TaskListFilter{}, domain.ErrInvalidArgument
		}
	}
	filter := application.TaskListFilter{Text: values.Get("text"), Host: domain.Host(values.Get("host")), Repository: values.Get("repository"), Node: domain.NodeID(values.Get("node")), Lifecycle: values.Get("lifecycle"), Page: 1}
	if raw := values.Get("page"); raw != "" {
		page, err := strconv.Atoi(raw)
		if err != nil || page < 1 {
			return application.TaskListFilter{}, domain.ErrInvalidArgument
		}
		filter.Page = page
	}
	for raw, target := range map[string]**time.Time{"updated_from": &filter.UpdatedFrom, "updated_to": &filter.UpdatedTo} {
		if value := values.Get(raw); value != "" {
			parsed, err := time.Parse(time.RFC3339, value)
			if err != nil {
				return application.TaskListFilter{}, domain.ErrInvalidArgument
			}
			parsed = parsed.UTC()
			*target = &parsed
		}
	}
	return filter, nil
}

func projectSummaries(items []application.ControlCenterTaskSummary) []TaskSummary {
	result := make([]TaskSummary, len(items))
	for index, item := range items {
		keys := make([]string, len(item.RepositoryKeys))
		for keyIndex, key := range item.RepositoryKeys {
			keys[keyIndex] = string(key)
		}
		result[index] = TaskSummary{TaskID: string(item.TaskID), RequestSummary: item.RequestSummary, OriginHost: string(item.OriginHost), ExecutionHost: string(item.ExecutionHost), CurrentNode: string(item.CurrentNode), Lifecycle: Lifecycle(item.Lifecycle), Revision: item.Revision, UpdatedAt: item.UpdatedAt, Archived: item.Archived, RepositoryKeys: keys, RepositoryGroupID: string(item.RepositoryGroupID), WorktreePath: item.WorktreePath, Blocker: item.Blocker, Outcome: item.Outcome}
	}
	return result
}

func projectTaskDetail(requestID string, detail application.ControlCenterTaskDetail) (TaskDetailResponse, error) {
	summary := projectSummaries([]application.ControlCenterTaskSummary{summarizeDetail(detail)})[0]
	repositories := []RepositoryView{{Key: string(detail.Task.EffectivePrimaryRepositoryKey()), Path: detail.Task.Repository.CanonicalRoot, Role: "primary", RepositoryGroupID: string(detail.Task.Repository.GitCommonDirDigest)}}
	for _, repository := range detail.Task.AdditionalRepositories {
		repositories = append(repositories, RepositoryView{Key: string(repository.Key), Path: repository.Binding.CanonicalRoot, Role: "additional", RepositoryGroupID: string(repository.Binding.GitCommonDirDigest)})
	}
	baselines, err := projectNamedFacts([]namedFact{{"requirements", "Requirements", detail.Task.Requirements}, {"design", "Design", detail.Task.Design}, {"task_plan", "Task plan", detail.Task.TaskPlan}, {"baseline_history", "Baseline history", detail.Task.BaselineHistory}})
	if err != nil {
		return TaskDetailResponse{}, err
	}
	records, err := projectNamedFacts([]namedFact{{"implementation", "Implementation", detail.Task.Implementation}, {"test", "Test", detail.Task.Test}, {"comprehension", "Comprehension", detail.Task.Comprehension}, {"verification_attempts", "Recent verification attempts", detail.Task.VerificationAttempts}, {"file_scope_records", "File scope decisions", detail.Task.FileScopeRecords}, {"last_operation", "Last operation", detail.Task.LastOperation}})
	if err != nil {
		return TaskDetailResponse{}, err
	}
	evidence := make([]Fact, 0, len(detail.Task.Evidence))
	for _, item := range detail.Task.Evidence {
		fact, factErr := projectFact("evidence", item.Name, item)
		if factErr != nil {
			return TaskDetailResponse{}, factErr
		}
		evidence = append(evidence, fact)
	}
	var blocker, outcome *Fact
	if detail.Task.Blocker != nil {
		fact, factErr := projectFact("blocker", "Current blocker", detail.Task.Blocker)
		if factErr != nil {
			return TaskDetailResponse{}, factErr
		}
		blocker = &fact
	}
	if detail.Task.Outcome != nil {
		fact, factErr := projectFact("outcome", "Outcome", detail.Task.Outcome)
		if factErr != nil {
			return TaskDetailResponse{}, factErr
		}
		outcome = &fact
	}
	events := make([]TaskEventView, len(detail.Events))
	for index, event := range detail.Events {
		var transitionID, reason *string
		if event.TransitionID != nil {
			value := string(*event.TransitionID)
			transitionID = &value
		}
		if event.TransitionReason != "" {
			value := event.TransitionReason
			reason = &value
		}
		events[index] = TaskEventView{Revision: event.Revision, EventType: string(event.Kind), SourceNode: string(event.SourceNode), DestinationNode: string(event.DestinationNode), TransitionID: transitionID, Reason: reason, CreatedAt: event.CreatedAt}
	}
	readiness := ReadinessReady
	if detail.ReadOnly {
		readiness = ReadinessReadOnly
	}
	budget, err := json.Marshal(detail.Task.Intent.VerificationBudget)
	if err != nil {
		return TaskDetailResponse{}, err
	}
	criteria := append([]string{}, detail.Task.Intent.KnownAcceptanceCriteria...)
	currentAction, err := projectAction(detail.Task.CurrentAction)
	if err != nil {
		return TaskDetailResponse{}, err
	}
	scope := application.CurrentFileScopeStatus(detail.Task)
	fileScope := FileScopeView{
		ExpectedPaths:     append([]string{}, scope.ExpectedPaths...),
		TaskChangedPaths:  append([]string{}, scope.TaskChangedPaths...),
		UnexplainedPaths:  append([]string{}, scope.UnexplainedPaths...),
		CoveredHostTools:  append([]string{}, scope.CoveredHostTools...),
		DecisionCount:     len(scope.Records),
		FinalCheckEnabled: scope.FinalCheckEnabled,
	}
	return TaskDetailResponse{OK: true, RequestID: requestID, Readiness: readiness, Summary: summary, Intent: detail.Task.Intent.Request, AcceptanceCriteria: criteria, VerificationBudget: string(budget), MethodProfile: string(detail.Task.Intent.MethodProfile), Repositories: repositories, Baselines: baselines, Records: records, Evidence: evidence, Blocker: blocker, Outcome: outcome, Events: events, Graph: projectGraph(detail.Graph), CurrentAction: currentAction, FileScope: fileScope}, nil
}

func summarizeDetail(detail application.ControlCenterTaskDetail) application.ControlCenterTaskSummary {
	keys := []domain.RepositoryKey{detail.Task.EffectivePrimaryRepositoryKey()}
	for _, repository := range detail.Task.AdditionalRepositories {
		keys = append(keys, repository.Key)
	}
	var blocker, outcome *string
	if detail.Task.Blocker != nil {
		value := detail.Task.Blocker.Message
		blocker = &value
	}
	if detail.Task.Outcome != nil {
		value := detail.Task.Outcome.Summary
		outcome = &value
	}
	return application.ControlCenterTaskSummary{TaskID: detail.Task.TaskID, RequestSummary: truncateWebSummary(detail.Task.Intent.Request), OriginHost: detail.Task.OriginHost, ExecutionHost: detail.Task.OriginHost, CurrentNode: detail.Task.CurrentNode, Lifecycle: lifecycleFromNode(detail.Task.CurrentNode), Revision: detail.Task.Revision, UpdatedAt: detail.Task.UpdatedAt, Archived: detail.Archived, RepositoryKeys: keys, RepositoryGroupID: detail.Task.Repository.GitCommonDirDigest, WorktreePath: detail.Task.Repository.CanonicalRoot, Blocker: blocker, Outcome: outcome}
}

func truncateWebSummary(value string) string {
	runes := []rune(value)
	if len(runes) <= 512 {
		return value
	}
	return string(runes[:511]) + "…"
}

func lifecycleFromNode(node domain.NodeID) string {
	switch node {
	case domain.NodeBlocked:
		return "blocked"
	case domain.NodeDone:
		return "done"
	case domain.NodeCancelled:
		return "cancelled"
	default:
		return "active"
	}
}

type namedFact struct {
	kind  string
	label string
	value any
}

func projectNamedFacts(items []namedFact) ([]Fact, error) {
	result := make([]Fact, 0, len(items))
	for _, item := range items {
		if isNilFact(item.value) {
			continue
		}
		fact, err := projectFact(item.kind, item.label, item.value)
		if err != nil {
			return nil, err
		}
		result = append(result, fact)
	}
	return result, nil
}

func isNilFact(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case *domain.RequirementsBaseline:
		return typed == nil
	case *domain.DesignBaseline:
		return typed == nil
	case *domain.TaskPlanBaseline:
		return typed == nil
	case *domain.ImplementationRecord:
		return typed == nil
	case *domain.TestRecord:
		return typed == nil
	case *domain.ComprehensionAssessment:
		return typed == nil
	case *domain.LastOperation:
		return typed == nil
	case []domain.FileScopeRecord:
		return len(typed) == 0
	default:
		return false
	}
}

func projectFact(kind, label string, value any) (Fact, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return Fact{}, err
	}
	return Fact{Kind: kind, Label: label, Value: string(raw)}, nil
}

func projectGraph(graph workflow.ControlCenterGraph) GraphView {
	nodes := make([]GraphNode, len(graph.Nodes))
	for index, node := range graph.Nodes {
		nodes[index] = GraphNode{NodeID: string(node.NodeID), Kind: node.Kind, Purpose: node.Purpose}
	}
	transitions := make([]GraphTransition, len(graph.Transitions))
	for index, transition := range graph.Transitions {
		transitions[index] = GraphTransition{TransitionID: string(transition.TransitionID), Source: string(transition.Source), Destination: string(transition.Destination)}
	}
	actual := make([]string, 0, len(graph.Traversals))
	for _, traversal := range graph.Traversals {
		if traversal.TransitionID != nil {
			actual = append(actual, string(*traversal.TransitionID))
		}
	}
	return GraphView{ProcessID: string(graph.Process.ID), DefinitionDigest: string(graph.Process.DefinitionDigest), CurrentNode: string(graph.CurrentNode), ResumeNode: optionalNode(graph.ResumeNode), Nodes: nodes, Transitions: transitions, ActualTransitionIDs: actual, CurrentLegalTransitionIDs: transitionStrings(graph.CurrentLegalTransitionIDs), FutureNodeIDs: nodeStrings(graph.FutureNodeIDs), FutureTransitionIDs: transitionStrings(graph.FutureTransitionIDs)}
}

func projectAction(action *domain.ProcessAction) (*ActionView, error) {
	if action == nil {
		return nil, nil
	}
	payloadSchema, err := workflow.ActionPayloadSchemaFor(*action)
	if err != nil {
		return nil, err
	}
	conditions := append([]string(nil), action.NodeContract.EntryConditions...)
	conditions = append(conditions, action.NodeContract.CompletionConditions...)
	effects := make([]string, len(action.AllowedEffects))
	for index, effect := range action.AllowedEffects {
		effects[index] = string(effect)
	}
	evidence := make([]string, len(action.RequiredEvidence))
	for index, requirement := range action.RequiredEvidence {
		evidence[index] = string(requirement.Kind)
	}
	steps := make([]string, len(action.SemanticMethodSteps))
	for index, step := range action.SemanticMethodSteps {
		steps[index] = step.Purpose
	}
	legal := make([]string, len(action.AvailableTransitions))
	for index, transition := range action.AvailableTransitions {
		legal[index] = string(transition.TransitionID)
	}
	return &ActionView{ActionID: string(action.ActionID), ActionKind: string(action.Kind), ProcessID: string(action.Process.ID), ProcessDefinitionDigest: string(action.Process.DefinitionDigest), SourceNode: string(action.NodeID), RepositoryBindingDigest: string(action.RepositoryBindingDigest), Purpose: action.NodeContract.Purpose, Conditions: conditions, AllowedEffects: effects, RequiredEvidence: evidence, MethodSteps: steps, LegalTransitionIDs: legal, PayloadSchema: payloadSchema}, nil
}

func writeReadError(w http.ResponseWriter, requestID string, err error) {
	status := http.StatusInternalServerError
	code := domain.ErrorInternal
	message := domain.ErrInternal.Message
	var typed *domain.Error
	if errors.As(err, &typed) {
		code, message = typed.Code, typed.Message
		switch typed.Code {
		case domain.ErrorInvalidArgument:
			status = http.StatusBadRequest
		case domain.ErrorTaskNotFound:
			status = http.StatusNotFound
		case domain.ErrorSchemaUnsupported, domain.ErrorProcessUnsupported:
			status = http.StatusConflict
		}
	}
	_ = WriteFailure(w, status, requestID, "not_committed", ErrorResponse{Code: string(code), Message: message, FieldPaths: domain.ViolationPaths(err)}, RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Refresh the current local WebUI state before continuing."})
}

func readRequestID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "read-unavailable"
	}
	return "read-" + hex.EncodeToString(raw[:])
}

func optionalNode(value *domain.NodeID) *string {
	if value == nil {
		return nil
	}
	result := string(*value)
	return &result
}

func transitionStrings(values []domain.TransitionID) []string {
	result := make([]string, len(values))
	for index, value := range values {
		result[index] = string(value)
	}
	return result
}

func nodeStrings(values []domain.NodeID) []string {
	result := make([]string, len(values))
	for index, value := range values {
		result[index] = string(value)
	}
	return result
}
