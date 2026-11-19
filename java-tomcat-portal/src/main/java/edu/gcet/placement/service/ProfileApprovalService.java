package edu.gcet.placement.service;

import com.google.gson.reflect.TypeToken;
import edu.gcet.placement.dao.ProfileApprovalDAO;
import edu.gcet.placement.dao.ProfileSubmissionDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.dao.StudentProfileDAO;
import edu.gcet.placement.model.ProfileApproval;
import edu.gcet.placement.model.ProfileSubmission;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;

import java.lang.reflect.Type;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Faculty & Placement Officer review service for verifying, approving, rejecting,
 * or requesting corrections on student profile submissions.
 */
public class ProfileApprovalService {
    private static final Type MAP_TYPE = new TypeToken<Map<String, Object>>() {}.getType();

    private final ProfileSubmissionDAO submissionDAO = new ProfileSubmissionDAO();
    private final StudentProfileDAO studentProfileDAO = new StudentProfileDAO();
    private final StudentDAO studentDAO = new StudentDAO();
    private final ProfileApprovalDAO approvalDAO = new ProfileApprovalDAO();
    private final NotificationService notificationService = new NotificationService();

    public List<ProfileSubmission> listApprovalQueue(User actor, String statusFilter) throws PortalException {
        ensureReviewerRole(actor);
        return submissionDAO.findQueueForFaculty(
                actor.getUserId(),
                actor.getAssignedBranch(),
                actor.isPlacementAdmin(),
                statusFilter
        );
    }

    public Map<String, Object> getSubmissionComparison(int submissionId, User actor) throws PortalException {
        ensureReviewerRole(actor);
        ProfileSubmission sub = submissionDAO.findById(submissionId)
                .orElseThrow(() -> new PortalException("Profile submission not found.", 404));
        ensureStudentInScope(actor, sub.getStudentId());

        List<ProfileApproval> history = approvalDAO.findHistoryByStudent(sub.getStudentId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("submission", sub);
        result.put("approvalHistory", history);
        return result;
    }

    public ProfileSubmission processDecision(int submissionId, User actor, String decision, String remarks) throws PortalException {
        ensureReviewerRole(actor);
        if (decision == null || decision.isBlank()) {
            throw new PortalException("Decision must be APPROVE, REJECT, or REQUEST_CORRECTION.", 400);
        }
        String cleanDecision = decision.trim().toUpperCase();
        String cleanRemarks = remarks == null ? "" : remarks.trim();

        ProfileSubmission sub = submissionDAO.findById(submissionId)
                .orElseThrow(() -> new PortalException("Profile submission not found.", 404));
        ensureStudentInScope(actor, sub.getStudentId());

        if (sub.getStatus() != ProfileSubmission.Status.WAITING_FOR_APPROVAL) {
            throw new PortalException("Only submissions waiting for approval can be reviewed.", 400);
        }

        Student student = studentDAO.findById(sub.getStudentId())
                .orElseThrow(() -> new PortalException("Associated student record not found.", 404));

        switch (cleanDecision) {
            case "APPROVE" -> {
                Map<String, Object> payload = JsonUtil.gson().fromJson(sub.getDraftPayloadJson(), MAP_TYPE);
                String finalRemarks = cleanRemarks.isEmpty()
                        ? "Verified against institutional academic records and approved."
                        : cleanRemarks;
                studentProfileDAO.applyApprovedPayloadTransaction(
                        submissionId,
                        sub.getStudentId(),
                        actor.getUserId(),
                        actor.getFullName(),
                        finalRemarks,
                        payload
                );
                notificationService.notifyUser(
                        student.getUserId(),
                        "Student Profile Approved",
                        "Your submitted profile updates (" + sub.getSubmissionCode() + ") were approved by " + actor.getFullName() + ". Official profile updated.",
                        "Placement Updates",
                        "profile"
                );
            }
            case "REJECT" -> {
                if (cleanRemarks.isEmpty()) {
                    throw new PortalException("Rejection reason is mandatory.", 400);
                }
                submissionDAO.updateDecision(submissionId, ProfileSubmission.Status.REJECTED, actor.getUserId(), cleanRemarks);
                approvalDAO.recordAction(submissionId, sub.getStudentId(), actor.getUserId(), actor.getFullName(), "REJECTED", cleanRemarks);
                notificationService.notifyUser(
                        student.getUserId(),
                        "Profile Revision Rejected",
                        "Your submission (" + sub.getSubmissionCode() + ") was rejected by " + actor.getFullName() + ": " + cleanRemarks,
                        "System Alerts",
                        "profile"
                );
            }
            case "REQUEST_CORRECTION" -> {
                if (cleanRemarks.isEmpty()) {
                    throw new PortalException("Correction instructions are mandatory.", 400);
                }
                submissionDAO.updateDecision(submissionId, ProfileSubmission.Status.CORRECTION_REQUESTED, actor.getUserId(), cleanRemarks);
                approvalDAO.recordAction(submissionId, sub.getStudentId(), actor.getUserId(), actor.getFullName(), "CORRECTION_REQUESTED", cleanRemarks);
                notificationService.notifyUser(
                        student.getUserId(),
                        "Profile Corrections Requested",
                        actor.getFullName() + " requested updates on " + sub.getSubmissionCode() + ": " + cleanRemarks,
                        "System Alerts",
                        "profile"
                );
            }
            default -> throw new PortalException("Unsupported decision: " + cleanDecision, 400);
        }

        return submissionDAO.findById(submissionId).orElse(sub);
    }

    private void ensureReviewerRole(User actor) throws PortalException {
        if (!actor.isFacultyRole() && !actor.isPlacementAdmin()) {
            throw new PortalException("Faculty coordinator or Placement Admin privileges required.", 403);
        }
    }

    private void ensureStudentInScope(User actor, int studentId) throws PortalException {
        if (actor.isPlacementAdmin()) return;
        boolean inScope = submissionDAO.isStudentInFacultyScope(actor.getUserId(), actor.getAssignedBranch(), studentId);
        if (!inScope) {
            throw new PortalException("Access denied: you are not authorized for this student's department/branch.", 403);
        }
    }
}
