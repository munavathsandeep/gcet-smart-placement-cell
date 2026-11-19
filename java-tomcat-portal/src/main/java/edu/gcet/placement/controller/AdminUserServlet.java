package edu.gcet.placement.controller;

import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PasswordUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.Connection;
import java.util.Map;

/**
 * Servlet for System Administrators & Executives to manage faculty/staff accounts,
 * activation status, temporary password resets, and brute-force lockouts.
 */
@WebServlet("/api/admin/users/*")
public class AdminUserServlet extends HttpServlet {
    private final UserDAO userDAO = new UserDAO();

    private User requireSystemAdmin(HttpServletRequest req) throws PortalException {
        HttpSession session = req.getSession(false);
        User user = (session != null) ? (User) session.getAttribute("authUser") : null;
        if (user == null) {
            throw new PortalException("Authentication required.", 401);
        }
        if (!(user.isExecutive() || user.getRole() == User.Role.ADMIN)) {
            throw new PortalException("System Administrator or Executive access required.", 403);
        }
        return user;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            requireSystemAdmin(req);
            JsonUtil.sendSuccess(resp, 200, userDAO.listAllUsers());
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        try {
            User admin = requireSystemAdmin(req);
            if (path.isEmpty() || "/".equals(path)) {
                Map<?, ?> body = JsonUtil.readBody(req, Map.class);
                String fullName = str(body.get("fullName"));
                String email = str(body.get("email"));
                String username = str(body.get("username"));
                String employeeId = str(body.get("employeeId"));
                String roleStr = str(body.get("role"));
                String branch = str(body.get("assignedBranch"));
                String tempPass = str(body.get("temporaryPassword"));

                if (fullName.isEmpty() || email.isEmpty() || tempPass.length() < 6) {
                    throw new PortalException("Full name, email, and temporary password (min 6 chars) are required.", 400);
                }
                User.Role targetRole = roleStr.isEmpty() ? User.Role.FACULTY_COORDINATOR : User.Role.valueOf(roleStr);
                User newUser = switch (targetRole) {
                    case ADMIN -> new Admin();
                    case PLACEMENT_OFFICER -> new PlacementOfficer();
                    case FACULTY_COORDINATOR, FACULTY -> new Faculty();
                    default -> throw new PortalException("Unsupported staff role.", 400);
                };
                newUser.setFullName(fullName);
                newUser.setEmail(email);
                newUser.setUsername(username.isEmpty() ? email.split("@")[0].toLowerCase() : username.toLowerCase());
                newUser.setEmployeeId(employeeId.isEmpty() ? null : employeeId.toUpperCase());
                newUser.setAssignedBranch(newUser.isFacultyRole() && !branch.isEmpty() ? branch : null);
                newUser.setDesignation(str(body.get("designation")).isEmpty() ? null : str(body.get("designation")));
                newUser.setDepartmentName(str(body.get("departmentName")).isEmpty() ? null : str(body.get("departmentName")));
                String salt = PasswordUtil.generateSalt();
                newUser.setPasswordSalt(salt);
                newUser.setPasswordHash(PasswordUtil.hashPassword(tempPass, salt));
                newUser.setMustChangePassword(true);
                newUser.setActive(true);
                newUser.setApprovalStatus("Approved");
                newUser.setCreatedBy(admin.getUserId());

                try (Connection conn = DatabaseConnection.getConnection()) {
                    conn.setAutoCommit(false);
                    try {
                        int userId = userDAO.createUser(newUser, conn);
                        if (newUser.isFacultyRole()) {
                            String empId = newUser.getEmployeeId() != null ? newUser.getEmployeeId() : ("FAC-" + userId);
                            userDAO.insertFacultyProfile(
                                    userId,
                                    empId,
                                    newUser.getFullName(),
                                    newUser.getEmail(),
                                    newUser.getAssignedBranch(),
                                    newUser.getDesignation(),
                                    newUser.getDepartmentName(),
                                    conn
                            );
                            if (newUser.getAssignedBranch() != null && !newUser.getAssignedBranch().isBlank()) {
                                java.util.List<String> branchList = java.util.Arrays.stream(newUser.getAssignedBranch().split(","))
                                        .map(String::trim)
                                        .filter(s -> !s.isEmpty())
                                        .toList();
                                userDAO.assignFacultyBranches(userId, branchList, conn);
                            }
                        }
                        conn.commit();
                    } catch (Exception ex) {
                        DatabaseConnection.rollbackQuietly(conn);
                        throw ex;
                    }
                }
                JsonUtil.sendSuccess(resp, 201, Map.of("userId", newUser.getUserId(), "username", newUser.getUsername()));
                return;
            }

            if (path.endsWith("/reset-password")) {
                int targetId = parseTargetId(path, "/reset-password");
                Map<?, ?> body = JsonUtil.readBody(req, Map.class);
                String newPassword = str(body.get("newPassword"));
                if (newPassword.length() < 6) {
                    throw new PortalException("Temporary password must be at least 6 characters.", 400);
                }
                User target = userDAO.findById(targetId).orElseThrow(() -> new PortalException("User not found.", 404));
                String salt = PasswordUtil.generateSalt();
                String hash = PasswordUtil.hashPassword(newPassword, salt);
                userDAO.updatePasswordByUserId(targetId, target.getEmail(), hash, salt, true);
                userDAO.clearLoginAttempts(target.getUsername().toLowerCase());
                userDAO.clearLoginAttempts(target.getEmail().toLowerCase());
                JsonUtil.sendSuccess(resp, 200, Map.of("message", "Temporary password set successfully."));
                return;
            }

            if (path.endsWith("/unlock")) {
                int targetId = parseTargetId(path, "/unlock");
                User target = userDAO.findById(targetId).orElseThrow(() -> new PortalException("User not found.", 404));
                userDAO.clearLoginAttempts(target.getUsername().toLowerCase());
                userDAO.clearLoginAttempts(target.getEmail().toLowerCase());
                if (target.getEmployeeId() != null) {
                    userDAO.clearLoginAttempts(target.getEmployeeId().toLowerCase());
                }
                JsonUtil.sendSuccess(resp, 200, Map.of("unlocked", true));
                return;
            }

            JsonUtil.sendError(resp, 404, "Unknown admin user endpoint.");
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 500, "Admin user management error.");
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        try {
            User admin = requireSystemAdmin(req);
            if (path.endsWith("/status")) {
                int targetId = parseTargetId(path, "/status");
                Map<?, ?> body = JsonUtil.readBody(req, Map.class);
                boolean active = Boolean.TRUE.equals(body.get("isActive"));
                if (targetId == admin.getUserId() && !active) {
                    throw new PortalException("Cannot deactivate your own active administrator session.", 400);
                }
                userDAO.setActiveStatus(targetId, active);
                JsonUtil.sendSuccess(resp, 200, Map.of("updated", true, "isActive", active));
                return;
            }
            JsonUtil.sendError(resp, 404, "Unknown admin user endpoint.");
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    private int parseTargetId(String path, String suffix) throws PortalException {
        try {
            String trimmed = path.substring(1, path.length() - suffix.length());
            return Integer.parseInt(trimmed);
        } catch (Exception e) {
            throw new PortalException("Invalid user ID in path.", 400);
        }
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
