package edu.gcet.placement.controller;

import edu.gcet.placement.dao.ProfileApprovalDAO;
import edu.gcet.placement.dao.ProfileSubmissionDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.ProfileApproval;
import edu.gcet.placement.model.ProfileSubmission;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST Servlet returning student profile submission status and audit history timeline.
 */
@WebServlet("/api/profile-submissions/*")
public class ProfileSubmissionServlet extends HttpServlet {
    private final StudentDAO studentDAO = new StudentDAO();
    private final ProfileSubmissionDAO submissionDAO = new ProfileSubmissionDAO();
    private final ProfileApprovalDAO approvalDAO = new ProfileApprovalDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = (User) req.getSession(false).getAttribute("authUser");
            String pathInfo = req.getPathInfo();
            if (pathInfo == null || pathInfo.length() < 2) {
                throw new PortalException("Student ID is required.", 400);
            }
            int studentId = Integer.parseInt(pathInfo.substring(1).split("/")[0]);
            Student student = studentDAO.findById(studentId)
                    .orElseThrow(() -> new PortalException("Student not found.", 404));

            if (actor.getRole() == User.Role.STUDENT && student.getUserId() != actor.getUserId()) {
                throw new PortalException("Access denied.", 403);
            } else if (actor.isFacultyRole()
                    && !submissionDAO.isStudentInFacultyScope(actor.getUserId(), actor.getAssignedBranch(), studentId)) {
                throw new PortalException("Access denied outside branch scope.", 403);
            } else if (actor.getRole() == User.Role.RECRUITER) {
                throw new PortalException("Recruiters cannot inspect pending student submission drafts.", 403);
            }

            Optional<ProfileSubmission> latest = submissionDAO.findLatestByStudent(studentId);
            List<ProfileApproval> history = approvalDAO.findHistoryByStudent(studentId);

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("studentId", studentId);
            data.put("latestSubmission", latest.orElse(null));
            data.put("approvalHistory", history);
            JsonUtil.sendSuccess(resp, 200, data);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Invalid profile submission query.");
        }
    }
}
