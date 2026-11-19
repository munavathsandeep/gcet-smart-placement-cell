package edu.gcet.placement.dao;

import edu.gcet.placement.model.Announcement;
import edu.gcet.placement.model.AnnouncementSource;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class AnnouncementDAO {

    public List<Announcement> findFiltered(String branch, String category, String priority,
                                           String query, boolean includeArchived) throws PortalException {
        StringBuilder sql = new StringBuilder(
                "SELECT a.*, c.category_name FROM announcements a " +
                "JOIN announcement_categories c ON a.category_id = c.category_id WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (!includeArchived) {
            sql.append("AND a.is_archived = FALSE ");
        }
        if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
            sql.append("AND (a.relevant_branches = 'ALL' OR FIND_IN_SET(?, a.relevant_branches) > 0 OR a.department_code = ?) ");
            params.add(branch.trim());
            params.add(branch.trim());
        }
        if (category != null && !category.isBlank()) {
            sql.append("AND c.category_name = ? ");
            params.add(category.trim());
        }
        if (priority != null && !priority.isBlank()) {
            sql.append("AND a.priority = ? ");
            params.add(priority.trim());
        }
        if (query != null && !query.isBlank()) {
            sql.append("AND (a.title LIKE ? OR a.description LIKE ? OR a.source_name LIKE ?) ");
            String like = "%" + query.trim() + "%";
            params.add(like);
            params.add(like);
            params.add(like);
        }
        sql.append("ORDER BY a.is_pinned DESC, a.published_date DESC, a.announcement_id DESC");

        List<Announcement> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapAnnouncement(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Unable to load announcements.", 500, e);
        }
    }

    public boolean existsBySourceUrl(String sourceUrl) throws PortalException {
        String sql = "SELECT 1 FROM announcements WHERE source_url = ? LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sourceUrl);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            throw new PortalException("Error checking announcement uniqueness.", 500, e);
        }
    }

    public Announcement save(Announcement a) throws PortalException {
        String sql = "INSERT INTO announcements (title, category_id, source_id, source_name, source_url, published_date, " +
                     "updated_date, description, relevant_branches, department_code, academic_year, deadline_date, " +
                     "has_attachment, attachment_url, priority, is_pinned, is_archived, is_verified_source) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, a.getTitle());
            ps.setInt(2, a.getCategoryId());
            if (a.getSourceId() != null) ps.setInt(3, a.getSourceId()); else ps.setNull(3, Types.INTEGER);
            ps.setString(4, a.getSourceName());
            ps.setString(5, a.getSourceUrl());
            ps.setDate(6, a.getPublishedDate());
            ps.setDate(7, a.getUpdatedDate());
            ps.setString(8, a.getDescription());
            ps.setString(9, a.getRelevantBranches() == null ? "ALL" : a.getRelevantBranches());
            ps.setString(10, a.getDepartmentCode());
            ps.setString(11, a.getAcademicYear() == null ? "2026-27" : a.getAcademicYear());
            ps.setDate(12, a.getDeadlineDate());
            ps.setBoolean(13, a.isHasAttachment());
            ps.setString(14, a.getAttachmentUrl());
            ps.setString(15, a.getPriority() == null ? "Normal" : a.getPriority());
            ps.setBoolean(16, a.isPinned());
            ps.setBoolean(17, a.isArchived());
            ps.setBoolean(18, a.isVerifiedSource());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) a.setAnnouncementId(keys.getInt(1));
            }
            return a;
        } catch (SQLException e) {
            throw new PortalException("Unable to save announcement.", 500, e);
        }
    }

    public List<AnnouncementSource> findAllSources() throws PortalException {
        String sql = "SELECT * FROM announcement_sources ORDER BY source_id ASC";
        List<AnnouncementSource> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                AnnouncementSource s = new AnnouncementSource();
                s.setSourceId(rs.getInt("source_id"));
                s.setSourceName(rs.getString("source_name"));
                s.setBaseUrl(rs.getString("base_url"));
                s.setFeedUrl(rs.getString("feed_url"));
                s.setSyncMode(rs.getString("sync_mode"));
                s.setEnabled(rs.getBoolean("is_enabled"));
                s.setSyncIntervalMinutes(rs.getInt("sync_interval_minutes"));
                s.setLastSyncedAt(rs.getTimestamp("last_synced_at"));
                s.setLastSyncStatus(rs.getString("last_sync_status"));
                list.add(s);
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error loading announcement sources.", 500, e);
        }
    }

    public void updateSourceSyncStatus(int sourceId, String status) throws PortalException {
        String sql = "UPDATE announcement_sources SET last_synced_at = CURRENT_TIMESTAMP, last_sync_status = ? WHERE source_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setInt(2, sourceId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to record sync status.", 500, e);
        }
    }

    public void recordSyncLog(Integer sourceId, String sourceName, String syncStatus,
                              int discoveredCount, int insertedCount, String message) throws PortalException {
        String sql = "INSERT INTO announcement_sync_logs " +
                     "(source_id, source_name, sync_status, discovered_count, inserted_count, message) " +
                     "VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (sourceId != null) ps.setInt(1, sourceId); else ps.setNull(1, Types.INTEGER);
            ps.setString(2, sourceName);
            ps.setString(3, syncStatus);
            ps.setInt(4, discoveredCount);
            ps.setInt(5, insertedCount);
            ps.setString(6, message);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to write announcement sync log.", 500, e);
        }
    }

    public int getConfiguredSyncIntervalMinutes() throws PortalException {
        String sql = "SELECT setting_value FROM app_settings WHERE setting_key = 'sync_interval_minutes' LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                try {
                    return Math.max(15, Integer.parseInt(rs.getString("setting_value")));
                } catch (NumberFormatException ignored) {}
            }
            return 60;
        } catch (SQLException e) {
            return 60;
        }
    }

    public void updateConfiguredSyncInterval(int minutes) throws PortalException {
        String upsert = "INSERT INTO app_settings (setting_key, setting_value) VALUES ('sync_interval_minutes', ?) " +
                        "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(upsert);
             PreparedStatement updSrc = conn.prepareStatement("UPDATE announcement_sources SET sync_interval_minutes = ?")) {
            ps.setString(1, String.valueOf(minutes));
            ps.executeUpdate();
            updSrc.setInt(1, minutes);
            updSrc.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to update sync interval.", 500, e);
        }
    }

    public java.util.Map<String, Object> getSyncHealthSummary() throws PortalException {
        java.util.Map<String, Object> health = new java.util.LinkedHashMap<>();
        String lastSuccessfulSync = null;
        java.util.List<java.util.Map<String, Object>> recentLogs = new java.util.ArrayList<>();
        java.util.List<java.util.Map<String, Object>> unreachable = new java.util.ArrayList<>();

        try (Connection conn = DatabaseConnection.getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT synced_at FROM announcement_sync_logs WHERE sync_status = 'SUCCESS' ORDER BY log_id DESC LIMIT 1");
                 ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    lastSuccessfulSync = String.valueOf(rs.getTimestamp("synced_at"));
                }
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT log_id, source_id, source_name, sync_status, discovered_count, inserted_count, message, synced_at " +
                    "FROM announcement_sync_logs ORDER BY log_id DESC LIMIT 20");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("log_id", rs.getInt("log_id"));
                    row.put("source_id", rs.getObject("source_id"));
                    row.put("source_name", rs.getString("source_name"));
                    row.put("sync_status", rs.getString("sync_status"));
                    row.put("discovered_count", rs.getInt("discovered_count"));
                    row.put("inserted_count", rs.getInt("inserted_count"));
                    row.put("message", rs.getString("message"));
                    row.put("synced_at", String.valueOf(rs.getTimestamp("synced_at")));
                    recentLogs.add(row);
                }
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT l.source_id, l.source_name, l.sync_status, l.message, l.synced_at " +
                    "FROM announcement_sync_logs l " +
                    "INNER JOIN (SELECT source_id, MAX(log_id) AS max_id FROM announcement_sync_logs WHERE source_id IS NOT NULL GROUP BY source_id) m " +
                    "ON l.log_id = m.max_id WHERE l.sync_status = 'FAILED' ORDER BY l.source_id ASC");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("source_id", rs.getInt("source_id"));
                    row.put("source_name", rs.getString("source_name"));
                    row.put("sync_status", rs.getString("sync_status"));
                    row.put("message", rs.getString("message"));
                    row.put("synced_at", String.valueOf(rs.getTimestamp("synced_at")));
                    unreachable.add(row);
                }
            }
        } catch (SQLException e) {
            throw new PortalException("Error reading announcement sync health.", 500, e);
        }

        health.put("lastSuccessfulSync", lastSuccessfulSync);
        health.put("hasUnreachableSources", !unreachable.isEmpty());
        health.put("unreachableSources", unreachable);
        health.put("syncIntervalMinutes", getConfiguredSyncIntervalMinutes());
        health.put("recentLogs", recentLogs);
        return health;
    }

    private Announcement mapAnnouncement(ResultSet rs) throws SQLException {
        Announcement a = new Announcement();
        a.setAnnouncementId(rs.getInt("announcement_id"));
        a.setTitle(rs.getString("title"));
        a.setCategoryId(rs.getInt("category_id"));
        a.setCategoryName(rs.getString("category_name"));
        int sid = rs.getInt("source_id");
        a.setSourceId(rs.wasNull() ? null : sid);
        a.setSourceName(rs.getString("source_name"));
        a.setSourceUrl(rs.getString("source_url"));
        a.setPublishedDate(rs.getDate("published_date"));
        a.setUpdatedDate(rs.getDate("updated_date"));
        a.setDescription(rs.getString("description"));
        a.setRelevantBranches(rs.getString("relevant_branches"));
        a.setDepartmentCode(rs.getString("department_code"));
        a.setAcademicYear(rs.getString("academic_year"));
        a.setDeadlineDate(rs.getDate("deadline_date"));
        a.setHasAttachment(rs.getBoolean("has_attachment"));
        a.setAttachmentUrl(rs.getString("attachment_url"));
        a.setPriority(rs.getString("priority"));
        a.setPinned(rs.getBoolean("is_pinned"));
        a.setArchived(rs.getBoolean("is_archived"));
        a.setVerifiedSource(rs.getBoolean("is_verified_source"));
        return a;
    }
}
