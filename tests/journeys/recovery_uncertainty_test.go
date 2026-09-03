package journeys

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

func TestRecoveryUncertaintyFiveClassJourney(t *testing.T) {
	t.Run("not_started", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toRefactor()
		observer := j.installCountingObserver()
		payload := json.RawMessage("null")
		operationID := domain.ID("recovery-not-started")
		probe := recoveryProbe(j.task, operationID, payload)
		read := assertProbedReads(t, j, observer, probe)
		assessment := read.RecoveryAssessment
		if assessment.Classification != domain.RecoveryNotStarted || assessment.ActionRetrySafe || assessment.NextAdvice != recovery.AdviceReadNextAction || assessment.CommittedProof != nil || assessment.UnblockCondition != nil || assessment.OperationPayloadDigest != nil {
			t.Fatalf("assessment=%+v", assessment)
		}
		before := j.state()
		beforeCalls := observer.calls
		result, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(j.task, operationID, payload))
		if err != nil || !reflect.DeepEqual(result.Task, j.task) || observer.calls != beforeCalls+1 {
			t.Fatalf("result=%+v err=%v observations=%d", result, err, observer.calls-beforeCalls)
		}
		j.assertStateUnchanged(before)
	})

	t.Run("completed_and_recorded", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toRefactor()
		observer := j.installCountingObserver()
		source := j.task
		payload := refactorRecoveryPayload(t, source)
		operationID := domain.ID("recovery-recorded")
		writeFeatureFile(t, j.repo, "refactor committed")
		before := j.state()
		_, err := j.service.ApplyAction(context.Background(), journeyApplyRequest(source, operationID, payload))
		if err != nil {
			t.Fatal(err)
		}
		j.task, err = j.store.LoadTask(context.Background(), source.TaskID)
		if err != nil {
			t.Fatal(err)
		}
		if j.task.CurrentNode != domain.NodeTest || j.task.Revision != before.revision+1 || j.eventCount() != before.events+1 || j.task.LastOperation.OperationID != operationID {
			t.Fatal("ordinary uncertain operation did not commit exactly once")
		}
		probe := recoveryProbe(source, operationID, payload)
		read := assertProbedReads(t, j, observer, probe)
		assessment := read.RecoveryAssessment
		if assessment.Classification != domain.RecoveryCompletedAndRecorded || assessment.ActionRetrySafe || assessment.CommittedProof == nil || assessment.LastOperationRelation != recovery.LastOperationExact {
			t.Fatalf("assessment=%+v", assessment)
		}
		before = j.state()
		beforeCalls := observer.calls
		result, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(source, operationID, payload))
		if err != nil || !reflect.DeepEqual(result.Task, j.task) || observer.calls != beforeCalls+1 {
			t.Fatalf("duplicate recovery result=%+v err=%v", result, err)
		}
		j.assertStateUnchanged(before)
	})

	t.Run("completed_but_unrecorded", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toRefactor()
		observer := j.installCountingObserver()
		source := j.task
		implementationRevision := source.Implementation.Revision
		payload := refactorRecoveryPayload(t, source)
		operationID := domain.ID("recovery-unrecorded")
		writeFeatureFile(t, j.repo, "refactor completed outside Core")
		read := assertProbedReads(t, j, observer, recoveryProbe(source, operationID, payload))
		assessment := read.RecoveryAssessment
		if assessment.Classification != domain.RecoveryCompletedButUnrecorded || assessment.OperationEvidence != recovery.OperationEvidenceComplete || assessment.ActionRetrySafe || assessment.NextAdvice != recovery.AdviceSubmitRecoveryApply {
			t.Fatalf("assessment=%+v", assessment)
		}
		before := j.state()
		beforeCalls := observer.calls
		result, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(source, operationID, payload))
		if err != nil || observer.calls != beforeCalls+1 {
			t.Fatal(err)
		}
		j.task = result.Task
		if j.task.CurrentNode != domain.NodeTest || j.task.Revision != before.revision+1 || j.eventCount() != before.events+1 || j.claimCount() != 1 || j.task.Implementation.Revision != implementationRevision+1 || j.task.Test != nil || j.task.Comprehension != nil || j.task.LastOperation.OperationID != operationID || j.task.CurrentAction == nil || j.task.CurrentAction.NodeID != domain.NodeTest {
			t.Fatal("completed-but-unrecorded adoption did not commit exact graph authority")
		}
		before = j.state()
		beforeCalls = observer.calls
		duplicate, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(source, operationID, payload))
		if err != nil || !reflect.DeepEqual(duplicate.Task, j.task) || observer.calls != beforeCalls+1 {
			t.Fatalf("duplicate=%+v err=%v", duplicate, err)
		}
		j.assertStateUnchanged(before)
	})

	t.Run("partially_completed_and_resolved", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toRefactor()
		observer := j.installCountingObserver()
		source := j.task
		implementation := *source.Implementation
		operationID := domain.ID("recovery-partial")
		writeFeatureFile(t, j.repo, "partial refactor")
		nullPayload := json.RawMessage("null")
		read := assertProbedReads(t, j, observer, recoveryProbe(source, operationID, nullPayload))
		assessment := read.RecoveryAssessment
		if assessment.Classification != domain.RecoveryPartiallyCompleted || assessment.ActionRetrySafe || assessment.OperationEvidence != recovery.OperationEvidenceNone || assessment.NextAdvice != recovery.AdviceSubmitRecoveryApply || assessment.UnblockCondition == nil || assessment.OperationPayloadDigest != nil {
			t.Fatalf("assessment=%+v", assessment)
		}
		before := j.state()
		beforeCalls := observer.calls
		blocked, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(source, operationID, nullPayload))
		if err != nil || observer.calls != beforeCalls+1 {
			t.Fatal(err)
		}
		j.task = blocked.Task
		if j.task.CurrentNode != domain.NodeBlocked || j.task.Revision != before.revision+1 || j.eventCount() != before.events+1 || j.claimCount() != 1 || j.task.Blocker == nil || j.task.ResumeNode == nil || *j.task.ResumeNode != domain.NodeRefactor || j.task.CurrentAction == nil || j.task.CurrentAction.Kind != domain.ActionResolveBlocker || !reflect.DeepEqual(*j.task.Implementation, implementation) || j.task.Test != nil || j.task.Repository.BindingDigest != source.Repository.BindingDigest || j.task.Blocker.ObservedBindingDigest == source.Repository.BindingDigest {
			t.Fatal("partial recovery did not create exact blocked authority")
		}
		blockerID, actionID := j.task.Blocker.BlockerID, j.task.CurrentAction.ActionID
		before = j.state()
		beforeCalls = observer.calls
		duplicate, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(source, operationID, nullPayload))
		if err != nil || duplicate.Task.Blocker.BlockerID != blockerID || duplicate.Task.CurrentAction.ActionID != actionID || observer.calls != beforeCalls+1 {
			t.Fatalf("duplicate blocker=%+v err=%v", duplicate, err)
		}
		j.assertStateUnchanged(before)

		writeFeatureFile(t, j.repo, "implementation")
		resolutionPayload, err := json.Marshal(map[string]any{"blocker_id": blockerID, "condition": j.task.Blocker.Condition, "observed_binding_digest": j.task.Repository.BindingDigest})
		if err != nil {
			t.Fatal(err)
		}
		before = j.state()
		resolved, err := j.service.ApplyAction(context.Background(), journeyApplyRequest(j.task, "resolve-partial", resolutionPayload))
		if err != nil {
			t.Fatal(err)
		}
		j.task = resolved.Task
		if j.task.CurrentNode != domain.NodeRefactor || j.task.Blocker != nil || j.task.ResumeNode != nil || j.task.Revision != before.revision+1 || j.eventCount() != before.events+1 || j.claimCount() != 1 || j.task.CurrentAction == nil || j.task.CurrentAction.ActionID == actionID {
			t.Fatal("blocker did not resume exact REFACTOR authority")
		}
	})

	t.Run("conflicting_payload_effect_and_forbidden_repository", func(t *testing.T) {
		t.Run("unplanned_surface_conflicts_before_recovery_apply", func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toRefactor()
			observer := j.installCountingObserver()
			source := j.task
			implementation := *source.Implementation
			payload := refactorRecoveryPayload(t, source)
			operationID := domain.ID("recovery-conflict-effect")
			if err := os.WriteFile(filepath.Join(j.repo, "other.txt"), []byte("unexpected\n"), 0o644); err != nil {
				t.Fatal(err)
			}
			probe := recoveryProbe(source, operationID, payload)
			read := assertProbedReads(t, j, observer, probe)
			assessment := read.RecoveryAssessment
			if assessment.Classification != domain.RecoveryConflicting || assessment.RepositoryRelation != recovery.RepositoryWorktreeOnlyChanged || assessment.OperationEvidence != recovery.OperationEvidenceContradictory || assessment.NextAdvice != recovery.AdviceSubmitRecoveryApply || assessment.ActionRetrySafe || assessment.UnblockCondition == nil || assessment.UnblockCondition.Kind != domain.BlockerConditionRestoreIssuanceBinding {
				t.Fatalf("assessment=%+v", read.RecoveryAssessment)
			}
			before := j.state()
			beforeCalls := observer.calls
			next, err := j.service.GetNextAction(context.Background(), application.GetNextActionRequest{Host: domain.HostCodex, TaskID: source.TaskID, OperationProbe: &probe})
			if err != nil {
				t.Fatal(err)
			}
			if observer.calls != beforeCalls+1 || next.CurrentNode != domain.NodeRefactor || next.Revision != source.Revision || next.RecoveryAssessment == nil || next.RecoveryAssessment.Classification != domain.RecoveryConflicting || next.RecoveryAssessment.NextAdvice != recovery.AdviceSubmitRecoveryApply {
				t.Fatalf("next=%+v observations=%d", next, observer.calls-beforeCalls)
			}
			j.assertStateUnchanged(before)

			beforeCalls = observer.calls
			blocked, err := j.service.ApplyAction(context.Background(), recoveryApplyRequest(source, operationID, payload))
			if err != nil || observer.calls != beforeCalls+1 {
				t.Fatalf("blocked=%+v err=%v observations=%d", blocked, err, observer.calls-beforeCalls)
			}
			j.task = blocked.Task
			if j.task.CurrentNode != domain.NodeBlocked || j.task.Revision != before.revision+1 || j.eventCount() != before.events+1 || j.claimCount() != 1 || j.task.Blocker == nil || j.task.Blocker.Cause != domain.BlockerCauseRecoveryConflicting || j.task.ResumeNode == nil || *j.task.ResumeNode != domain.NodeRefactor || j.task.CurrentAction == nil || j.task.CurrentAction.Kind != domain.ActionResolveBlocker || !reflect.DeepEqual(*j.task.Implementation, implementation) || j.task.Repository.BindingDigest != source.Repository.BindingDigest || j.task.Blocker.ObservedBindingDigest == source.Repository.BindingDigest || j.task.LastOperation == nil || j.task.LastOperation.OperationID != operationID {
				t.Fatal("conflicting recovery did not retain source authority behind an exact restoration blocker")
			}
		})

		t.Run("branch_drift", func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toRefactor()
			observer := j.installCountingObserver()
			source := j.task
			runJourneyGit(t, j.repo, "switch", "-q", "-c", "recovery-drift")
			read := assertProbedReads(t, j, observer, recoveryProbe(source, "recovery-conflict-branch", refactorRecoveryPayload(t, source)))
			if read.RecoveryAssessment.Classification != domain.RecoveryConflicting || read.RecoveryAssessment.RepositoryRelation != recovery.RepositoryForbiddenChange || read.RecoveryAssessment.ActionRetrySafe {
				t.Fatalf("assessment=%+v", read.RecoveryAssessment)
			}
		})
	})
}

func TestRecoveryUncertaintyCallerShapesUseOneExactProbe(t *testing.T) {
	j := newIterationJourney(t)
	defer j.close()
	j.toRefactor()
	observer := j.installCountingObserver()
	payload := refactorRecoveryPayload(t, j.task)
	operationID := domain.ID("uncertain-shape-operation")
	exactProbe := recoveryProbe(j.task, operationID, payload)
	shapes := []uncertainShape{
		{name: "missing"},
		{name: "cancelled", err: context.Canceled, cancelled: true},
		{name: "malformed", result: []byte(`{"ok":`)},
		{name: "truncated", result: []byte(`{"ok":true`)},
		{name: "transport_failed", err: errors.New("test transport failed")},
	}
	for _, shape := range shapes {
		t.Run(shape.name, func(t *testing.T) {
			if !shape.isUncertain() {
				t.Fatal("incomplete result was treated as complete")
			}
			before := j.state()
			read := assertProbedReads(t, j, observer, exactProbe)
			if read.RecoveryAssessment.Classification != domain.RecoveryCompletedButUnrecorded || read.RecoveryAssessment.NextAdvice != recovery.AdviceSubmitRecoveryApply || read.RecoveryAssessment.Operation.OperationID != operationID || !reflect.DeepEqual(read.RecoveryAssessment.Operation, exactProbe.Reference()) {
				t.Fatalf("assessment=%+v", read.RecoveryAssessment)
			}
			j.assertStateUnchanged(before)
		})
	}
	if completeDomainErrorIsUncertain([]byte(`{"ok":false,"error":{"code":"REVISION_CONFLICT"}}`)) {
		t.Fatal("complete domain error was treated as transport uncertainty")
	}
	nullProbe := exactProbe
	nullProbe.Payload = json.RawMessage("null")
	read := assertProbedReads(t, j, observer, nullProbe)
	if read.RecoveryAssessment.OperationPayloadDigest != nil || read.RecoveryAssessment.ActionRetrySafe {
		t.Fatal("missing retained payload was reconstructed or marked retry-safe")
	}
}
