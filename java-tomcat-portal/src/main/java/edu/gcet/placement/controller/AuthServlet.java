package edu.gcet.placement.controller;

import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.User;
import edu.gcet.placement.service.AuthenticationService;
import edu.gcet.placement.service.PasswordService;
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
 * Handles active session inspection (/api/auth/session) and password lifecycle endpoints
 * (/api/auth/change-password, /api/auth/forgot-password).
 * Login, Logout, and Registration are handled by dedicated servlets without overlapping URL mappings.
 */
@WebServlet(urlPatterns = {"/api/auth/session", "/api/auth/change-password", "/api/auth/forgot-password", "/api/auth/dismiss-password-prompt"})
public class AuthServlet extends HttpServlet {
    private final AuthenticationService authenticationService = new AuthenticationService();
    private final PasswordService passwordService = new PasswordService();
    private final StudentDAO studentDAO = new StudentDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        User sessionUser = (session != null) ? (User) session.getAttribute("authUser") : null;
        if (sessionUser == null) {
            JsonUtil.sendSuccess(resp, 200, null);
            return;
        }
        try {
            User fresh = authenticationService.reloadUser(sessionUser.getUserId());
            if (!fresh.isActive() || !"Approved".equalsIgnoreCase(fresh.getApprovalStatus())) {
                session.invalidate();
                JsonUtil.sendSuccess(resp, 200, null);
                return;
            }
            session.setAttribute("authUser", fresh);
            JsonUtil.sendSuccess(resp, 200, buildUserPayload(fresh));
        } catch (PortalException e) {
            JsonUtil.sendSuccess(resp, 200, null);
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String servletPath = req.getServletPath();
        try {
            switch (servletPath) {
                case "/api/auth/change-password" -> handleChangePassword(req, resp);
                case "/api/auth/forgot-password" -> handleForgotPassword(req, resp);
                case "/api/auth/dismiss-password-prompt" -> handleDismissPasswordPrompt(req, resp);
                default -> JsonUtil.sendError(resp, 404, "Unknown auth endpoint.");
            }
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 500, "Authentication service error.");
        }
    }

    private void handleDismissPasswordPrompt(HttpServletRequest req, HttpServletResponse resp) throws IOException, PortalException {
        HttpSession session = req.getSession(false);
        User user = (session != null) ? (User) session.getAttribute("authUser") : null;
        if (user == null) {
            throw new PortalException("Authentication required.", 401);
        }
        passwordService.dismissPasswordPrompt(user.getUserId());
        user.setPasswordChangeDismissed(true);
        session.setAttribute("authUser", user);
        Map<String, Object> payload = buildUserPayload(user);
        payload.put("message", "Password prompt dismissed. Your temporary password remains active until changed in Settings.");
        JsonUtil.sendSuccess(resp, 200, payload);
    }

    private void handleChangePassword(HttpServletRequest req, HttpServletResponse resp) throws IOException, PortalException {
        HttpSession session = req.getSession(false);
        User user = (session != null) ? (User) session.getAttribute("authUser") : null;
        if (user == null) {
            throw new PortalException("Authentication required.", 401);
        }
        Map<?, ?> body = JsonUtil.readBody(req, Map.class);
        passwordService.changePassword(user.getUserId(), str(body.get("currentPassword")), str(body.get("newPassword")));
        user.setMustChangePassword(false);
        user.setPasswordChangeDismissed(false);
        session.setAttribute("authUser", user);
        Map<String, Object> payload = buildUserPayload(user);
        payload.put("message", "Password updated securely.");
        JsonUtil.sendSuccess(resp, 200, payload);
    }

    private void handleForgotPassword(HttpServletRequest req, HttpServletResponse resp) throws IOException, PortalException {
        Map<?, ?> body = JsonUtil.readBody(req, Map.class);
        passwordService.resetForgottenPassword(str(body.get("email")), str(body.get("newPassword")));
        JsonUtil.sendSuccess(resp, 200, Map.of("message", "Password updated successfully."));
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
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
