package edu.gcet.placement.dao;

import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ActivityLogDAO {

    public void log(Integer userId, String actorName, String activityType, String description) {
        String sql = "INSERT INTO activity_logs (user_id, actor_name, activity_type, description) VALUES (?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (userId != null && userId > 0) ps.setInt(1, userId); else ps.setNull(1, Types.INTEGER);
            ps.setString(2, actorName);
            ps.setString(3, activityType);
            ps.setString(4, description);
            ps.executeUpdate();
        } catch (SQLException ignored) {
        }
    }

    public List<Map<String, Object>> findRecent(int limit) throws PortalException {
        String sql = "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?";
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("logId", rs.getInt("log_id"));
                    row.put("actorName", rs.getString("actor_name"));
                    row.put("activityType", rs.getString("activity_type"));
                    row.put("description", rs.getString("description"));
                    row.put("createdAt", rs.getTimestamp("created_at"));
                    rows.add(row);
                }
            }
            return rows;
        } catch (SQLException e) {
            throw new PortalException("Unable to load activity logs.", 500, e);
        }
    }
}
