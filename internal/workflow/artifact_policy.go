package workflow

import "github.com/Innocent-children/dev-flow/internal/domain"

func PrimaryArtifactRoleForNode(node domain.NodeID) (domain.ArtifactRole, bool) {
	switch node {
	case domain.NodeRequirements:
		return domain.ArtifactRequirements, true
	case domain.NodeDesign:
		return domain.ArtifactDesign, true
	case domain.NodeTasks:
		return domain.ArtifactTaskPlan, true
	case domain.NodeTest:
		return domain.ArtifactTest, true
	case domain.NodeComprehensionReview:
		return domain.ArtifactComprehension, true
	case domain.NodeDelivery:
		return domain.ArtifactDelivery, true
	default:
		return "", false
	}
}

func ArtifactRoleAllowed(node domain.NodeID, role domain.ArtifactRole) bool {
	if role == domain.ArtifactOtherProcess {
		return true
	}
	primary, ok := PrimaryArtifactRoleForNode(node)
	return ok && role == primary
}
