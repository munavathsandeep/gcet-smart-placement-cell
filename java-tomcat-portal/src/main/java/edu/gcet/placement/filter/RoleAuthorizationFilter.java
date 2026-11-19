package edu.gcet.placement.filter;

import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.Set;

/**
 * Enforces Role-Based Access Control (RBAC), active user validation,
 * and cross-role dashboard URL protection across all 9 institutional roles.
 */
@WebFilter(urlPatterns = {
        "/api/*",
        "/principal/*",
        "/vice-chairman/*",
        "/chairman/*",
        "/executive/*",
        "/admin/*",
        "/placement-officer/*",
        "/faculty-coordinator/*",
        "/faculty/*",
        "/student/*",
        "/recruiter/*"
})
public class RoleAuthorizationFilter implements Filter {
    private static final Set<String> PUBLIC_API_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/logout",
            "/api/auth/register",
            "/api/auth/register-recruiter",
            "/api/auth/forgot-password",
            "/api/auth/session",
            "/api/branches",
            "/api/public-branches",
            "/api/public-stats",
            "/api/health"
    );

    private final UserDAO userDAO = new UserDAO();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;
        String path = normalizeRequestPath(req);

        if (PUBLIC_API_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        HttpSession session = req.getSession(false);
        User sessionUser = (session != null) ? (User) session.getAttribute("authUser") : null;
        if (sessionUser == null) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required.");
            return;
        }

        // Re-verify live DB account status so deactivated/unapproved accounts are rejected immediately
        User liveUser;
        try {
            liveUser = userDAO.findById(sessionUser.getUserId()).orElse(null);
        } catch (PortalException e) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_UNAUTHORIZED, "Unable to verify session.");
            return;
        }

        if (liveUser == null || !liveUser.isActive() || !"Approved".equalsIgnoreCase(liveUser.getApprovalStatus())) {
            if (session != null) session.invalidate();
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Account is deactivated or awaiting approval.");
            return;
        }
        session.setAttribute("authUser", liveUser);

        boolean isApiRequest = path.startsWith("/api/");

        // Block non-auth API calls when password rotation is mandatory and not yet dismissed, but allow HTML/JSP page views to load the modal
        if (isApiRequest
                && liveUser.isMustChangePassword()
                && !liveUser.isPasswordChangeDismissed()
                && !path.equals("/api/auth/change-password")
                && !path.equals("/api/auth/dismiss-password-prompt")
                && !path.equals("/api/auth/logout")
                && !path.equals("/api/auth/session")) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN,
                    "Password update required on first sign-in before accessing portal resources.");
            return;
        }

        // Enforce role-based dashboard URL protection across all 9 roles
        if (path.startsWith("/principal/") && liveUser.getRole() != User.Role.PRINCIPAL) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Principal privileges required.");
            return;
        }
        if (path.startsWith("/vice-chairman/") && liveUser.getRole() != User.Role.VICE_CHAIRMAN) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Vice Chairman privileges required.");
            return;
        }
        if (path.startsWith("/chairman/") && liveUser.getRole() != User.Role.CHAIRMAN) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Chairman privileges required.");
            return;
        }
        if (path.startsWith("/executive/") && !liveUser.isExecutive()) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Executive leadership privileges required.");
            return;
        }
        if (path.startsWith("/admin/") && !(liveUser.isExecutive() || liveUser.getRole() == User.Role.ADMIN)) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Administrator privileges required.");
            return;
        }
        if (path.startsWith("/placement-officer/") && !liveUser.isPlacementAdmin()) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Placement Officer privileges required.");
            return;
        }
        if ((path.startsWith("/faculty-coordinator/") || path.startsWith("/faculty/"))
                && !liveUser.isFacultyRole() && !liveUser.isPlacementAdmin()) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Faculty coordinator privileges required.");
            return;
        }
        if (path.startsWith("/recruiter/") && liveUser.getRole() != User.Role.RECRUITER && !liveUser.isPlacementAdmin()) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Recruiter privileges required.");
            return;
        }
        if (path.startsWith("/student/") && liveUser.getRole() != User.Role.STUDENT && !liveUser.isPlacementAdmin()) {
            denyUnauthorized(req, resp, path, HttpServletResponse.SC_FORBIDDEN, "Student privileges required.");
            return;
        }

        // Enforce API endpoint role access
        if (path.startsWith("/api/admin/") && !(liveUser.isExecutive() || liveUser.getRole() == User.Role.ADMIN)) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN, "System Administrator or Executive access required.");
            return;
        }
        if (path.startsWith("/api/reports/registrations") && !liveUser.canAccessRegistrationReports()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN,
                    "Forbidden: Only Principal, Vice Chairman, Chairman, and authorized Faculty Coordinators may access institutional registration reports.");
            return;
        }

        chain.doFilter(request, response);
    }

    private String normalizeRequestPath(HttpServletRequest req) {
        String ctx = req.getContextPath() != null ? req.getContextPath() : "";
        String uri = req.getRequestURI() != null ? req.getRequestURI() : "/";
        String path = uri.startsWith(ctx) ? uri.substring(ctx.length()) : uri;
        int semi = path.indexOf(';');
        if (semi >= 0) {
            path = path.substring(0, semi);
        }
        if (path.isEmpty()) {
            return "/";
        }
        return path;
    }

    private void denyUnauthorized(HttpServletRequest req, HttpServletResponse resp, String path, int status, String message) throws IOException {
        if (path.startsWith("/api/")) {
            JsonUtil.sendError(resp, status, message);
        } else {
            resp.sendRedirect(req.getContextPath() + "/?authError=" + status);
        }
    }
}
