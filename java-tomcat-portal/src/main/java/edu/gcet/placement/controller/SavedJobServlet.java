package edu.gcet.placement.controller;

import edu.gcet.placement.model.User;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.*;
import java.util.*;

@WebServlet("/api/saved-jobs/*")
public class SavedJobServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        User user = (User) req.getSession(false).getAttribute("authUser");
        String sql = "SELECT sj.drive_id, sj.saved_at FROM saved_jobs sj WHERE sj.user_id = ?";
        List<Integer> driveIds = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, user.getUserId());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) driveIds.add(rs.getInt("drive_id"));
            }
            JsonUtil.sendSuccess(resp, 200, driveIds);
        } catch (SQLException e) {
            JsonUtil.sendError(resp, 500, "Unable to load saved jobs.");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        User user = (User) req.getSession(false).getAttribute("authUser");
        Map<?, ?> body = JsonUtil.readBody(req, Map.class);
        int driveId = ((Number) body.get("driveId")).intValue();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("INSERT IGNORE INTO saved_jobs (user_id, drive_id) VALUES (?, ?)")) {
            ps.setInt(1, user.getUserId());
            ps.setInt(2, driveId);
            ps.executeUpdate();
            JsonUtil.sendSuccess(resp, 200, Map.of("saved", true));
        } catch (SQLException e) {
            JsonUtil.sendError(resp, 500, "Unable to save opportunity.");
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        User user = (User) req.getSession(false).getAttribute("authUser");
        int driveId = Integer.parseInt(req.getPathInfo().substring(1));
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM saved_jobs WHERE user_id = ? AND drive_id = ?")) {
            ps.setInt(1, user.getUserId());
            ps.setInt(2, driveId);
            ps.executeUpdate();
            JsonUtil.sendSuccess(resp, 200, Map.of("removed", true));
        } catch (SQLException e) {
            JsonUtil.sendError(resp, 500, "Unable to remove saved opportunity.");
        }
    }
}
