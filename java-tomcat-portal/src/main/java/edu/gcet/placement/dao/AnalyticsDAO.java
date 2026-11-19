package edu.gcet.placement.dao;

import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.time.Instant;
import java.util.*;

public class AnalyticsDAO {

    private static final List<Map.Entry<String, String>> ALL_ROLES = List.of(
            Map.entry("PRINCIPAL", "Principal"),
            Map.entry("VICE_CHAIRMAN", "Vice Chairman"),
            Map.entry("CHAIRMAN", "Chairman"),
            Map.entry("ADMIN", "System Administrator"),
            Map.entry("PLACEMENT_OFFICER", "Placement Officer"),
            Map.entry("FACULTY_COORDINATOR", "Faculty Coordinator"),
            Map.entry("FACULTY", "Faculty"),
            Map.entry("STUDENT", "Student"),
            Map.entry("RECRUITER", "Recruiter")
    );

    public Map<String, Object> getDashboardMetrics() throws PortalException {
        Map<String, Object> metrics = new LinkedHashMap<>();
        try (Connection conn = DatabaseConnection.getConnection()) {
            metrics.put("totalStudents", queryInt(conn, "SELECT COUNT(*) FROM students"));
            metrics.put("registeredCompanies", queryInt(conn, "SELECT COUNT(*) FROM companies"));
            metrics.put("activeDrives", queryInt(conn, "SELECT COUNT(*) FROM placement_drives WHERE drive_status = 'Active'"));
            metrics.put("studentsPlaced", queryInt(conn, "SELECT COUNT(DISTINCT student_id) FROM placements"));
            metrics.put("totalApplications", queryInt(conn, "SELECT COUNT(*) FROM applications"));
            metrics.put("eligibleStudents", queryInt(conn, "SELECT COUNT(*) FROM students WHERE cgpa >= 7.0 AND active_backlogs = 0"));
            metrics.put("totalAnnouncements", queryInt(conn, "SELECT COUNT(*) FROM announcements WHERE is_archived = FALSE"));
            metrics.put("totalBranches", queryInt(conn, "SELECT COUNT(*) FROM branches WHERE is_active = TRUE"));

            metrics.put("branchDistribution", queryKeyValueList(conn,
                    "SELECT branch_code AS label, COUNT(*) AS count, SUM(CASE WHEN placement_status='Placed' THEN 1 ELSE 0 END) AS placed FROM students GROUP BY branch_code ORDER BY count DESC"));
            metrics.put("skillDistribution", queryKeyValueList(conn,
                    "SELECT s.skill_name AS label, s.category, COUNT(ss.student_id) AS count, ROUND(COALESCE(AVG(ss.proficiency_level), 0), 2) AS avgLevel " +
                    "FROM skills s LEFT JOIN student_skills ss ON s.skill_id = ss.skill_id GROUP BY s.skill_id, s.skill_name, s.category ORDER BY count DESC"));
            metrics.put("applicationOutcomes", queryKeyValueList(conn,
                    "SELECT status AS label, COUNT(*) AS count FROM applications GROUP BY status"));
            metrics.put("companyPlacements", queryKeyValueList(conn,
                    "SELECT c.company_name AS label, COUNT(p.placement_id) AS count, ROUND(COALESCE(AVG(p.package_lpa), 0), 2) AS avgPackage " +
                    "FROM companies c LEFT JOIN placements p ON c.company_id = p.company_id GROUP BY c.company_id, c.company_name ORDER BY count DESC"));
            return metrics;
        } catch (SQLException e) {
            throw new PortalException("Error computing placement analytics.", 500, e);
        }
    }

    /**
     * Queries live MySQL tables dynamically for deduplicated Institutional Registration Statistics.
     * Never exposes password hashes, salts, or personal credentials.
     */
    public Map<String, Object> getInstitutionalRegistrationStats() throws PortalException {
        Map<String, Object> report = new LinkedHashMap<>();
        try (Connection conn = DatabaseConnection.getConnection()) {
            Map<String, int[]> roleMap = new HashMap<>();
            String roleSql = "SELECT role, COUNT(DISTINCT user_id) AS totalCount, " +
                    "COUNT(DISTINCT CASE WHEN is_active = TRUE THEN user_id END) AS activeCount " +
                    "FROM users GROUP BY role";
            try (PreparedStatement ps = conn.prepareStatement(roleSql);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    roleMap.put(rs.getString("role"), new int[]{rs.getInt("activeCount"), rs.getInt("totalCount")});
                }
            }

            List<Map<String, Object>> roleCounts = new ArrayList<>();
            for (Map.Entry<String, String> entry : ALL_ROLES) {
                int[] counts = roleMap.getOrDefault(entry.getKey(), new int[]{0, 0});
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("role", entry.getKey());
                item.put("label", entry.getValue());
                item.put("activeCount", counts[0]);
                item.put("totalCount", counts[1]);
                roleCounts.add(item);
            }

            int totalActiveUsers = queryInt(conn, "SELECT COUNT(DISTINCT user_id) FROM users WHERE is_active = TRUE");
            int totalStudentProfiles = queryInt(conn, "SELECT COUNT(DISTINCT student_id) FROM students");
            int unlinkedStudents = queryInt(conn, "SELECT COUNT(DISTINCT student_id) FROM students WHERE user_id IS NULL");
            int totalRegisteredMembers = totalActiveUsers + unlinkedStudents;
            int totalFacultyMembers = queryInt(conn,
                    "SELECT COUNT(DISTINCT user_id) FROM users WHERE is_active = TRUE AND role IN ('FACULTY_COORDINATOR', 'FACULTY')");

            int adminCount = roleMap.getOrDefault("ADMIN", new int[]{0, 0})[0]
                    + roleMap.getOrDefault("PLACEMENT_OFFICER", new int[]{0, 0})[0];
            int execCount = roleMap.getOrDefault("PRINCIPAL", new int[]{0, 0})[0]
                    + roleMap.getOrDefault("VICE_CHAIRMAN", new int[]{0, 0})[0]
                    + roleMap.getOrDefault("CHAIRMAN", new int[]{0, 0})[0];
            int recruiterCount = roleMap.getOrDefault("RECRUITER", new int[]{0, 0})[0];

            Map<String, Integer> approvalStatusCounts = new LinkedHashMap<>();
            approvalStatusCounts.put("Approved", 0);
            approvalStatusCounts.put("Pending", 0);
            approvalStatusCounts.put("Rejected", 0);
            String appSql = "SELECT approval_status, COUNT(DISTINCT user_id) AS c FROM users WHERE is_active = TRUE GROUP BY approval_status";
            try (PreparedStatement ps = conn.prepareStatement(appSql);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    approvalStatusCounts.put(rs.getString("approval_status"), rs.getInt("c"));
                }
            }

            List<Map<String, Object>> departmentStats = queryKeyValueList(conn,
                    "SELECT d.dept_id AS deptId, d.dept_code AS deptCode, d.dept_name AS deptName, d.hod_name AS hodName, " +
                    "COUNT(DISTINCT CASE WHEN f.is_active = TRUE THEN f.faculty_id END) AS facultyCount, " +
                    "COUNT(DISTINCT CASE WHEN u.is_active = TRUE THEN fba.faculty_user_id END) AS assignedCoordinatorCount, " +
                    "COUNT(DISTINCT s.student_id) AS studentCount, " +
                    "COUNT(DISTINCT CASE WHEN s.placement_status = 'Placed' THEN s.student_id END) AS placedCount " +
                    "FROM departments d " +
                    "LEFT JOIN faculty f ON f.dept_id = d.dept_id " +
                    "LEFT JOIN branches b ON b.dept_id = d.dept_id " +
                    "LEFT JOIN faculty_branch_assignments fba ON UPPER(fba.branch_code) = UPPER(b.branch_code) " +
                    "LEFT JOIN users u ON u.user_id = fba.faculty_user_id " +
                    "LEFT JOIN students s ON s.dept_id = d.dept_id " +
                    "GROUP BY d.dept_id, d.dept_code, d.dept_name, d.hod_name " +
                    "ORDER BY d.dept_id ASC");

            List<Map<String, Object>> branchRegistrationStats = queryKeyValueList(conn,
                    "SELECT b.branch_code AS branchCode, b.branch_name AS branchName, b.degree_level AS degreeLevel, " +
                    "d.dept_code AS deptCode, COUNT(DISTINCT s.student_id) AS studentCount, " +
                    "COUNT(DISTINCT CASE WHEN s.placement_status = 'Placed' THEN s.student_id END) AS placedCount " +
                    "FROM branches b " +
                    "JOIN departments d ON b.dept_id = d.dept_id " +
                    "LEFT JOIN students s ON s.branch_id = b.branch_id OR UPPER(s.branch_code) = UPPER(b.branch_code) " +
                    "WHERE b.is_active = TRUE " +
                    "GROUP BY b.branch_id, b.branch_code, b.branch_name, b.degree_level, d.dept_code " +
                    "ORDER BY studentCount DESC, b.branch_code ASC");

            report.put("institutionName", "Geethanjali College of Engineering and Technology (GCET), Hyderabad");
            report.put("portalTitle", "GCET Smart Placement Cell & Skill Matrix Portal");
            report.put("lastUpdated", Instant.now().toString());
            report.put("totalRegisteredMembers", totalRegisteredMembers);
            report.put("totalActiveUsers", totalActiveUsers);
            report.put("totalStudentProfiles", totalStudentProfiles);
            report.put("totalFacultyMembers", totalFacultyMembers);
            report.put("totalAdministrators", adminCount);
            report.put("totalExecutiveLeadership", execCount);
            report.put("totalRecruiters", recruiterCount);
            report.put("approvalStatusCounts", approvalStatusCounts);
            report.put("roleCounts", roleCounts);
            report.put("departmentStats", departmentStats);
            report.put("branchRegistrationStats", branchRegistrationStats);
            return report;
        } catch (SQLException e) {
            throw new PortalException("Error computing institutional registration statistics.", 500, e);
        }
    }

    private int queryInt(Connection conn, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private List<Map<String, Object>> queryKeyValueList(Connection conn, String sql) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            ResultSetMetaData meta = rs.getMetaData();
            int cols = meta.getColumnCount();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= cols; i++) {
                    row.put(meta.getColumnLabel(i), rs.getObject(i));
                }
                rows.add(row);
            }
        }
        return rows;
    }
}
