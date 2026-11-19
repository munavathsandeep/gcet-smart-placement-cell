package edu.gcet.placement.service;

import edu.gcet.placement.dao.PlacementDriveDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.EligibilityResult;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.time.LocalDate;
import java.util.*;

/**
 * Institutional Notification Service managing MySQL notification persistence,
 * event-driven eligibility alerts, broadcast alerts, and deadline reminders.
 */
public class NotificationService {

    public void notifyUser(Integer userId, String title, String message, String category, String relatedModule) throws PortalException {
        if (userId == null || userId <= 0) return;
        insertNotification(userId, title, message, category, relatedModule);
    }

    public void notifyBroadcast(String title, String message, String category, String relatedModule) throws PortalException {
        insertNotification(null, title, message, category, relatedModule);
    }

    private void insertNotification(Integer userId, String title, String message, String category, String relatedModule) throws PortalException {
        String sql = "INSERT INTO notifications (user_id, title, message, category, related_module) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (userId == null) {
                ps.setNull(1, Types.INTEGER);
            } else {
                ps.setInt(1, userId);
            }
            ps.setString(2, title);
            ps.setString(3, message);
            ps.setString(4, category == null ? "General" : category);
            ps.setString(5, relatedModule);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Unable to persist notification.", 500, e);
        }
    }

    public int notifyEligibleStudentsForDrive(int driveId) throws PortalException {
        PlacementDriveDAO driveDAO = new PlacementDriveDAO();
        StudentDAO studentDAO = new StudentDAO();
        EligibilityService eligibilityService = new EligibilityService();

        PlacementDrive drive = driveDAO.findById(driveId).orElse(null);
        if (drive == null) return 0;
        if (!"Approved".equalsIgnoreCase(drive.getApprovalStatus())
                || (!"Active".equalsIgnoreCase(drive.getDriveStatus()) && !"Planned".equalsIgnoreCase(drive.getDriveStatus()))) {
            return 0;
        }

        String title = "New Eligible Opportunity: " + drive.getCompanyName() + " — " + drive.getJobRole();
        String msg = String.format("You meet the eligibility criteria for %s (%.2f LPA). Deadline: %s.",
                drive.getCompanyName(), drive.getSalaryPackage(), String.valueOf(drive.getApplicationDeadline()));

        int count = 0;
        for (Student st : studentDAO.findAll()) {
            if (st.getUserId() <= 0) continue;
            EligibilityResult elig = eligibilityService.evaluate(st, drive);
            if (!elig.isEligible()) continue;
            if (!notificationExists(st.getUserId(), title)) {
                insertNotification(st.getUserId(), title, msg, "Placement Notifications", "drives");
                count++;
            }
        }
        return count;
    }

    public int checkUpcomingDriveDeadlines() throws PortalException {
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(14);
        String sql = "SELECT pd.drive_id, c.company_name, pd.job_role, pd.application_deadline, " +
                     "de.min_cgpa, de.eligible_branches, de.max_backlogs " +
                     "FROM placement_drives pd " +
                     "JOIN companies c ON pd.company_id = c.company_id " +
                     "JOIN drive_eligibility de ON pd.drive_id = de.drive_id " +
                     "WHERE pd.approval_status = 'Approved' " +
                     "AND pd.drive_status IN ('Active', 'Planned') " +
                     "AND pd.application_deadline >= ? AND pd.application_deadline <= ?";

        int created = 0;
        StudentDAO studentDAO = new StudentDAO();
        List<Student> students = studentDAO.findAll();

        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(today));
            ps.setDate(2, java.sql.Date.valueOf(horizon));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int driveId = rs.getInt("drive_id");
                    String companyName = rs.getString("company_name");
                    String jobRole = rs.getString("job_role");
                    String deadline = String.valueOf(rs.getDate("application_deadline"));
                    double minCgpa = rs.getDouble("min_cgpa");
                    String branches = rs.getString("eligible_branches");
                    int maxBacklogs = rs.getInt("max_backlogs");

                    String title = "Deadline Approaching: " + companyName + " (" + deadline + ")";
                    String message = String.format("Reminder: Apply for %s — %s before %s.", companyName, jobRole, deadline);

                    for (Student st : students) {
                        if (st.getUserId() <= 0) continue;
                        if (st.getCgpa() < minCgpa || st.getActiveBacklogs() > maxBacklogs) continue;
                        if (!branchMatches(st.getBranch(), branches)) continue;
                        if (hasStudentApplied(conn, driveId, st.getStudentId())) continue;
                        if (!notificationExists(st.getUserId(), title)) {
                            insertNotification(st.getUserId(), title, message, "Placement Notifications", "drives");
                            created++;
                        }
                    }
                }
            }
            return created;
        } catch (SQLException e) {
            throw new PortalException("Error scanning upcoming drive deadlines.", 500, e);
        }
    }

    public Map<String, Object> listNotificationsForUser(int userId) throws PortalException {
        String sql = "SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 35";
        List<Map<String, Object>> notifications = new ArrayList<>();
        int unreadCount = 0;

        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    boolean read = rs.getBoolean("is_read");
                    if (!read) unreadCount++;
                    Map<String, Object> n = new LinkedHashMap<>();
                    n.put("notification_id", rs.getInt("notification_id"));
                    n.put("user_id", rs.getObject("user_id"));
                    n.put("title", rs.getString("title"));
                    n.put("message", rs.getString("message"));
                    n.put("category", rs.getString("category"));
                    n.put("link_url", rs.getString("link_url"));
                    n.put("related_module", rs.getString("related_module"));
                    n.put("is_read", read ? 1 : 0);
                    n.put("created_at", String.valueOf(rs.getTimestamp("created_at")));
                    notifications.add(n);
                }
            }
            return Map.of("notifications", notifications, "unreadCount", unreadCount);
        } catch (SQLException e) {
            throw new PortalException("Failed to fetch notifications.", 500, e);
        }
    }

    public void markRead(int notificationId, boolean isRead) throws PortalException {
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("UPDATE notifications SET is_read = ? WHERE notification_id = ?")) {
            ps.setBoolean(1, isRead);
            ps.setInt(2, notificationId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to update notification read status.", 500, e);
        }
    }

    public void markAllRead(int userId) throws PortalException {
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("UPDATE notifications SET is_read = TRUE WHERE user_id IS NULL OR user_id = ?")) {
            ps.setInt(1, userId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to mark all notifications as read.", 500, e);
        }
    }

    private boolean notificationExists(int userId, String title) throws SQLException {
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT 1 FROM notifications WHERE user_id = ? AND title = ? LIMIT 1")) {
            ps.setInt(1, userId);
            ps.setString(2, title);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private boolean hasStudentApplied(Connection conn, int driveId, int studentId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM applications WHERE drive_id = ? AND student_id = ? LIMIT 1")) {
            ps.setInt(1, driveId);
            ps.setInt(2, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private boolean branchMatches(String studentBranch, String allowedCsv) {
        if (allowedCsv == null || allowedCsv.isBlank()) return true;
        String upper = studentBranch == null ? "" : studentBranch.trim().toUpperCase();
        for (String token : allowedCsv.split(",")) {
            String t = token.trim().toUpperCase();
            if ("ALL".equals(t) || t.equals(upper)) return true;
        }
        return false;
    }
}
