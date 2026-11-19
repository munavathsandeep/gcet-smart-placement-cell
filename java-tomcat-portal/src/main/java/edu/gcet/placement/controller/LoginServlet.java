package edu.gcet.placement.controller;

import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.User;
import edu.gcet.placement.service.AuthenticationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Handles role-scoped login authentication for ADMIN (Principal, Vice Chairman, Chairman, Admin, TPO),
 * FACULTY, STUDENT, and RECRUITER portals.
 */
@WebServlet("/api/auth/login")
public class LoginServlet extends HttpServlet {
    private final AuthenticationService authenticationService = new AuthenticationService();
    private final StudentDAO studentDAO = new StudentDAO();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            String identifier = body.get("identifier") != null ? body.get("identifier").toString() : "";
            String password = body.get("password") != null ? body.get("password").toString() : "";
            String role = body.get("role") != null ? body.get("role").toString() : "";

            User user = authenticationService.login(identifier, password, role, req.getRemoteAddr());

            // Prevent session fixation by invalidating any prior anonymous session before issuing authenticated session
            HttpSession existing = req.getSession(false);
            if (existing != null) {
                existing.invalidate();
            }
            HttpSession session = req.getSession(true);
            session.setAttribute("authUser", user);
            session.setAttribute("authRole", user.getRole().name());
            session.setAttribute("dashboardRoute", user.getDashboardRoute());
            session.setMaxInactiveInterval(60 * 60 * 6);

            JsonUtil.sendSuccess(resp, 200, buildUserPayload(user));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 500, "Authentication service error.");
        }
    }

    private Map<String, Object> buildUserPayload(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("userId", user.getUserId());
        map.put("username", user.getUsername());
        map.put("email", user.getEmail());
        map.put("fullName", user.getFullName());
        map.put("role", user.getRole().name());
        map.put("employeeId", user.getEmployeeId());
        map.put("assignedBranch", user.getAssignedBranch());
        map.put("designation", user.getDesignation());
        map.put("departmentName", user.getDepartmentName());
        map.put("assignedBranches", user.getAssignedBranches());
        map.put("companyId", user.getCompanyId());
        map.put("approvalStatus", user.getApprovalStatus());
        map.put("mustChangePassword", user.isMustChangePassword());
        map.put("passwordChangeDismissed", user.isPasswordChangeDismissed());
        map.put("dashboardRoute", user.getDashboardRoute());
        map.put("dashboardPath", user.getDashboardPath());
        map.put("permissions", user.getDashboardPermissions());
        if (user.getRole() == User.Role.STUDENT) {
            try {
                studentDAO.findByUserId(user.getUserId()).ifPresent(st -> map.put("studentId", st.getStudentId()));
            } catch (PortalException ignored) {}
        }
        return map;
    }
}
