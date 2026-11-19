package edu.gcet.placement.controller;

import edu.gcet.placement.model.ProfileSubmission;
import edu.gcet.placement.model.User;
import edu.gcet.placement.service.ProfileApprovalService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * REST Servlet exposing Faculty & Placement Officer Student Profile Approvals queue,
 * comparison view, and Approve / Reject / Request Corrections actions.
 */
@WebServlet("/api/faculty/profile-approvals/*")
public class FacultyApprovalServlet extends HttpServlet {
    private final ProfileApprovalService approvalService = new ProfileApprovalService();

    public static class DecisionRequest {
        public String decision;
        public String remarks;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = (User) req.getSession(false).getAttribute("authUser");
            String pathInfo = req.getPathInfo();
            if (pathInfo == null || pathInfo.equals("/") || pathInfo.isBlank()) {
                String statusFilter = req.getParameter("status");
                List<ProfileSubmission> queue = approvalService.listApprovalQueue(actor, statusFilter);
                JsonUtil.sendSuccess(resp, 200, queue);
                return;
            }
            int submissionId = Integer.parseInt(pathInfo.substring(1).split("/")[0]);
            Map<String, Object> detail = approvalService.getSubmissionComparison(submissionId, actor);
            JsonUtil.sendSuccess(resp, 200, detail);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Invalid faculty approval request.");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = (User) req.getSession(false).getAttribute("authUser");
            String pathInfo = req.getPathInfo();
            if (pathInfo == null || pathInfo.length() < 2) {
                throw new PortalException("Submission ID is required.", 400);
            }
            int submissionId = Integer.parseInt(pathInfo.substring(1).split("/")[0]);
            DecisionRequest body = JsonUtil.readBody(req, DecisionRequest.class);
            if (body == null) {
                throw new PortalException("Decision body is required.", 400);
            }
            ProfileSubmission updated = approvalService.processDecision(submissionId, actor, body.decision, body.remarks);
            JsonUtil.sendSuccess(resp, 200, updated);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Invalid decision payload.");
        }
    }
}
