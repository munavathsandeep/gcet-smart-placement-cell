package edu.gcet.placement.controller;

import edu.gcet.placement.config.DatabaseConfig;
import edu.gcet.placement.dao.AnnouncementDAO;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@WebServlet("/api/admin/system-status/*")
public class SystemStatusServlet extends HttpServlet {
    private final AnnouncementDAO announcementDAO = new AnnouncementDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        User auth = getAuthenticatedAdmin(req, resp);
        if (auth == null) return;

        boolean dbConnected = DatabaseConfig.testConnection();
        Map<String, Object> counts = new LinkedHashMap<>();
        if (dbConnected) {
            try (Connection conn = DatabaseConnection.getConnection()) {
                counts.put("students", countRows(conn, "SELECT COUNT(*) FROM students"));
                counts.put("faculty", countRows(conn, "SELECT COUNT(*) FROM faculty WHERE is_active = TRUE"));
                counts.put("companies", countRows(conn, "SELECT COUNT(*) FROM companies"));
                counts.put("drives", countRows(conn, "SELECT COUNT(*) FROM placement_drives"));
                counts.put("applications", countRows(conn, "SELECT COUNT(*) FROM applications"));
                counts.put("placements", countRows(conn, "SELECT COUNT(*) FROM placements"));
                counts.put("announcements", countRows(conn, "SELECT COUNT(*) FROM announcements WHERE is_archived = FALSE"));
                counts.put("notifications", countRows(conn, "SELECT COUNT(*) FROM notifications"));
                counts.put("unreadNotifications", countRows(conn, "SELECT COUNT(*) FROM notifications WHERE is_read = FALSE"));
            } catch (SQLException e) {
                dbConnected = false;
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("databaseConnected", dbConnected);
        payload.put("placeholderCredentialsDetected", DatabaseConfig.hasPlaceholderCredentials());
        payload.put("databaseEngine", "MySQL 8.0 + HikariCP Connection Pool (JDBC PreparedStatement)");
        payload.put("checkedAt", Instant.now().toString());
        payload.put("counts", counts);
        try {
            payload.put("syncHealth", announcementDAO.getSyncHealthSummary());
        } catch (PortalException e) {
            payload.put("syncHealth", Map.of("error", e.getMessage()));
        }

        JsonUtil.sendSuccess(resp, 200, payload);
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        User auth = getAuthenticatedAdmin(req, resp);
        if (auth == null) return;

        try {
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            int minutes = body != null && body.get("syncIntervalMinutes") instanceof Number
                    ? ((Number) body.get("syncIntervalMinutes")).intValue() : 60;
            if (minutes < 15 || minutes > 1440) {
                JsonUtil.sendError(resp, 400, "Sync interval must be between 15 and 1440 minutes.");
                return;
            }
            announcementDAO.updateConfiguredSyncInterval(minutes);
            JsonUtil.sendSuccess(resp, 200, Map.of(
                    "syncIntervalMinutes", minutes,
                    "syncHealth", announcementDAO.getSyncHealthSummary()
            ));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    private User getAuthenticatedAdmin(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        User user = session != null ? (User) session.getAttribute("authUser") : null;
        if (user == null) {
            JsonUtil.sendError(resp, 401, "Authentication required.");
            return null;
        }
        if (!user.isPlacementAdmin()) {
            JsonUtil.sendError(resp, 403, "Administrator or Placement Officer privileges required.");
            return null;
        }
        return user;
    }

    private int countRows(Connection conn, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }
}
