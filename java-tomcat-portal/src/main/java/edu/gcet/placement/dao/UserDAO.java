package edu.gcet.placement.dao;

import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.*;

public class UserDAO {

    public static String normalizeBranchToken(String raw) {
        if (raw == null) return "";
        String upper = raw.trim().toUpperCase();
        return switch (upper) {
            case "CSE-IOT" -> "IOT";
            case "CSE-CS" -> "CS";
            case "ME" -> "MECH";
            case "CE" -> "CIVIL";
            default -> upper;
        };
    }

    public static boolean branchMatchesScope(String studentBranch, List<String> assignedBranches) {
        if (studentBranch == null || assignedBranches == null || assignedBranches.isEmpty()) return false;
        String normStudent = normalizeBranchToken(studentBranch);
        for (String b : assignedBranches) {
            if (normalizeBranchToken(b).equals(normStudent)) return true;
        }
        return false;
    }

    public Optional<User> findByIdentifier(String identifier) throws PortalException {
        String sql = "SELECT user_id, username, email, password_hash, password_salt, role, full_name, employee_id, assigned_branch, designation, department_name, company_id, approval_status, is_active, must_change_password, password_change_dismissed, created_by, last_login, created_at " +
                     "FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(COALESCE(employee_id, '')) = LOWER(?) LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, identifier);
            ps.setString(2, identifier);
            ps.setString(3, identifier);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    User u = mapRowToPolymorphicUser(rs);
                    if (u.isFacultyRole()) {
                        u.setAssignedBranches(loadFacultyAssignedBranches(conn, u.getUserId(), u.getAssignedBranch()));
                    }
                    return Optional.of(u);
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new PortalException("Unable to verify user credentials.", 500, e);
        }
    }

    public Optional<User> findById(int userId) throws PortalException {
        String sql = "SELECT user_id, username, email, password_hash, password_salt, role, full_name, employee_id, assigned_branch, designation, department_name, company_id, approval_status, is_active, must_change_password, password_change_dismissed, created_by, last_login, created_at " +
                     "FROM users WHERE user_id = ? LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    User u = mapRowToPolymorphicUser(rs);
                    if (u.isFacultyRole()) {
                        u.setAssignedBranches(loadFacultyAssignedBranches(conn, u.getUserId(), u.getAssignedBranch()));
                    }
                    return Optional.of(u);
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new PortalException("Unable to load user account.", 500, e);
        }
    }

    public List<Map<String, Object>> listAllUsers() throws PortalException {
        String sql = "SELECT u.user_id, u.username, u.email, u.role, u.full_name, u.employee_id, u.assigned_branch, " +
                     "u.designation, u.department_name, u.company_id, c.company_name, u.approval_status, u.is_active, " +
                     "u.must_change_password, u.password_change_dismissed, u.password_change_dismissed_at, u.last_login, u.created_at " +
                     "FROM users u LEFT JOIN companies c ON u.company_id = c.company_id " +
                     "WHERE LOWER(u.username) <> 'faculty_cse' " +
                     "ORDER BY u.user_id ASC";
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                int uid = rs.getInt("user_id");
                String roleStr = rs.getString("role");
                String assignedBranch = rs.getString("assigned_branch");
                row.put("user_id", uid);
                row.put("username", rs.getString("username"));
                row.put("email", rs.getString("email"));
                row.put("role", roleStr);
                row.put("full_name", rs.getString("full_name"));
                row.put("employee_id", rs.getString("employee_id"));
                row.put("assigned_branch", assignedBranch);
                row.put("designation", rs.getString("designation"));
                row.put("department_name", rs.getString("department_name"));
                if ("FACULTY_COORDINATOR".equals(roleStr) || "FACULTY".equals(roleStr)) {
                    row.put("assigned_branches", loadFacultyAssignedBranches(conn, uid, assignedBranch));
                }
                row.put("company_id", rs.getObject("company_id"));
                row.put("company_name", rs.getString("company_name"));
                row.put("approval_status", rs.getString("approval_status"));
                row.put("is_active", rs.getBoolean("is_active"));
                row.put("must_change_password", rs.getBoolean("must_change_password"));
                row.put("password_change_dismissed", rs.getBoolean("password_change_dismissed"));
                row.put("password_change_dismissed_at", rs.getTimestamp("password_change_dismissed_at"));
                row.put("last_login", rs.getTimestamp("last_login"));
                row.put("created_at", rs.getTimestamp("created_at"));
                result.add(row);
            }
            return result;
        } catch (SQLException e) {
            throw new PortalException("Unable to list institutional accounts.", 500, e);
        }
    }

    public int createUser(User user, Connection conn) throws SQLException {
        String sql = "INSERT INTO users (username, email, password_hash, password_salt, role, full_name, employee_id, assigned_branch, designation, department_name, company_id, approval_status, is_active, must_change_password, created_by) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, user.getUsername());
            ps.setString(2, user.getEmail());
            ps.setString(3, user.getPasswordHash());
            ps.setString(4, user.getPasswordSalt());
            ps.setString(5, user.getRole().name());
            ps.setString(6, user.getFullName());
            ps.setString(7, user.getEmployeeId());
            ps.setString(8, user.getAssignedBranch());
            ps.setString(9, user.getDesignation());
            ps.setString(10, user.getDepartmentName());
            if (user.getCompanyId() != null) ps.setInt(11, user.getCompanyId());
            else ps.setNull(11, Types.INTEGER);
            ps.setString(12, user.getApprovalStatus() != null ? user.getApprovalStatus() : "Approved");
            ps.setBoolean(13, user.isActive());
            ps.setBoolean(14, user.isMustChangePassword());
            if (user.getCreatedBy() != null) ps.setInt(15, user.getCreatedBy());
            else ps.setNull(15, Types.INTEGER);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    int id = keys.getInt(1);
                    user.setUserId(id);
                    return id;
                }
            }
        }
        throw new SQLException("Creating user failed, no ID obtained.");
    }

    public void insertFacultyProfile(int userId, String employeeId, String fullName, String email, String branchCode, String designation, String departmentName, Connection conn) throws SQLException {
        String sql = "INSERT INTO faculty (user_id, employee_id, full_name, email, branch_code, department_name, designation, is_active) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, TRUE) " +
                     "ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), email = VALUES(email), branch_code = VALUES(branch_code), department_name = VALUES(department_name), designation = VALUES(designation), is_active = TRUE";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.setString(2, employeeId);
            ps.setString(3, fullName);
            ps.setString(4, email);
            ps.setString(5, branchCode);
            ps.setString(6, departmentName);
            ps.setString(7, designation != null && !designation.isBlank() ? designation : "Faculty Coordinator");
            ps.executeUpdate();
        }
    }

    public void assignFacultyBranches(int facultyUserId, List<String> branches, Connection conn) throws SQLException {
        try (PreparedStatement del = conn.prepareStatement("DELETE FROM faculty_branch_assignments WHERE faculty_user_id = ?")) {
            del.setInt(1, facultyUserId);
            del.executeUpdate();
        }
        if (branches == null || branches.isEmpty()) return;
        String insSql = "INSERT INTO faculty_branch_assignments (faculty_user_id, branch_code, is_primary) VALUES (?, ?, ?)";
        try (PreparedStatement ins = conn.prepareStatement(insSql)) {
            for (int i = 0; i < branches.size(); i++) {
                String b = branches.get(i).trim();
                if (b.isEmpty()) continue;
                ins.setInt(1, facultyUserId);
                ins.setString(2, b);
                ins.setBoolean(3, i == 0);
                ins.addBatch();
            }
            ins.executeBatch();
        }
    }

    public List<String> loadFacultyAssignedBranches(Connection conn, int facultyUserId, String fallbackAssignedBranch) throws SQLException {
        List<String> branches = new ArrayList<>();
        String sql = "SELECT branch_code FROM faculty_branch_assignments WHERE faculty_user_id = ? ORDER BY is_primary DESC, assignment_id ASC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, facultyUserId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String b = rs.getString("branch_code");
                    if (b != null && !b.isBlank()) branches.add(b.trim());
                }
            }
        }
        if (branches.isEmpty() && fallbackAssignedBranch != null && !fallbackAssignedBranch.isBlank()) {
            for (String token : fallbackAssignedBranch.split(",")) {
                String trimmed = token.trim();
                if (!trimmed.isEmpty()) branches.add(trimmed);
            }
        }
        return branches;
    }

    public Integer resolveCoordinatorForBranch(Connection conn, String studentBranch) throws SQLException {
        if (studentBranch == null || studentBranch.isBlank()) return null;
        String sql = "SELECT u.user_id, u.assigned_branch FROM users u " +
                     "WHERE u.role IN ('FACULTY_COORDINATOR', 'FACULTY') AND u.is_active = TRUE AND LOWER(u.username) <> 'faculty_cse' " +
                     "ORDER BY u.user_id ASC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                int uid = rs.getInt("user_id");
                List<String> assigned = loadFacultyAssignedBranches(conn, uid, rs.getString("assigned_branch"));
                if (branchMatchesScope(studentBranch, assigned)) {
                    return uid;
                }
            }
        }
        return null;
    }

    public void autoAssignStudentToCoordinator(Connection conn, int studentId, String branchCode, String section) throws SQLException {
        Integer coordinatorId = resolveCoordinatorForBranch(conn, branchCode);
        try (PreparedStatement del = conn.prepareStatement("DELETE FROM faculty_student_assignments WHERE student_id = ?")) {
            del.setInt(1, studentId);
            del.executeUpdate();
        }
        if (coordinatorId != null) {
            try (PreparedStatement ins = conn.prepareStatement(
                    "INSERT IGNORE INTO faculty_student_assignments (faculty_user_id, student_id, branch_code, section) VALUES (?, ?, ?, ?)")) {
                ins.setInt(1, coordinatorId);
                ins.setInt(2, studentId);
                ins.setString(3, branchCode);
                ins.setString(4, section != null ? section : "A");
                ins.executeUpdate();
            }
        }
    }

    public void createRecruiterProfile(RecruiterProfile profile, Connection conn) throws SQLException {
        String sql = "INSERT INTO recruiter_profiles (user_id, company_id, contact_person, designation, phone, official_email, website, industry, approval_status, is_demo) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, profile.getUserId());
            ps.setInt(2, profile.getCompanyId());
            ps.setString(3, profile.getContactPerson());
            ps.setString(4, profile.getDesignation());
            ps.setString(5, profile.getPhone());
            ps.setString(6, profile.getOfficialEmail());
            ps.setString(7, profile.getWebsite());
            ps.setString(8, profile.getIndustry());
            ps.setString(9, profile.getApprovalStatus());
            ps.setBoolean(10, profile.isDemo());
            ps.executeUpdate();
        }
    }

    public void updateLastLogin(int userId) throws PortalException {
        String sql = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to update login audit.", 500, e);
        }
    }

    public boolean dismissPasswordPrompt(int userId) throws PortalException {
        String sql = "UPDATE users SET password_change_dismissed = TRUE, password_change_dismissed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Failed to persist password prompt dismissal.", 500, e);
        }
    }

    public boolean updatePasswordByUserId(int userId, String email, String newHash, String newSalt, boolean mustChange) throws PortalException {
        String sql = "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = ?, password_change_dismissed = FALSE, password_change_dismissed_at = NULL WHERE user_id = ?";
        String auditSql = "INSERT INTO password_reset_requests (user_id, email, status, completed_at) VALUES (?, ?, 'Completed', CURRENT_TIMESTAMP)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             PreparedStatement audit = conn.prepareStatement(auditSql)) {
            ps.setString(1, newHash);
            ps.setString(2, newSalt);
            ps.setBoolean(3, mustChange);
            ps.setInt(4, userId);
            boolean updated = ps.executeUpdate() > 0;
            if (updated) {
                audit.setInt(1, userId);
                audit.setString(2, email);
                audit.executeUpdate();
            }
            return updated;
        } catch (SQLException e) {
            throw new PortalException("Failed to update password.", 500, e);
        }
    }

    public boolean updatePassword(String email, String newHash, String newSalt) throws PortalException {
        String sql = "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = FALSE, password_change_dismissed = FALSE, password_change_dismissed_at = NULL WHERE LOWER(email) = LOWER(?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newHash);
            ps.setString(2, newSalt);
            ps.setString(3, email);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Failed to reset password.", 500, e);
        }
    }

    public void setActiveStatus(int userId, boolean active) throws PortalException {
        String sql = "UPDATE users SET is_active = ? WHERE user_id = ?";
        String facSql = "UPDATE faculty SET is_active = ? WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             PreparedStatement fac = conn.prepareStatement(facSql)) {
            ps.setBoolean(1, active);
            ps.setInt(2, userId);
            ps.executeUpdate();
            fac.setBoolean(1, active);
            fac.setInt(2, userId);
            fac.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to update account activation status.", 500, e);
        }
    }

    public Timestamp getLockedUntil(String normalizedIdentifier) throws PortalException {
        String sql = "SELECT locked_until FROM login_attempts WHERE identifier = ? LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, normalizedIdentifier);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getTimestamp("locked_until");
                }
                return null;
            }
        } catch (SQLException e) {
            throw new PortalException("Failed to check login attempt policy.", 500, e);
        }
    }

    public int recordFailedLoginAttempt(String normalizedIdentifier, String ipAddress) throws PortalException {
        String selectSql = "SELECT attempt_id, attempt_count FROM login_attempts WHERE identifier = ? LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement sel = conn.prepareStatement(selectSql)) {
            sel.setString(1, normalizedIdentifier);
            try (ResultSet rs = sel.executeQuery()) {
                if (rs.next()) {
                    int id = rs.getInt("attempt_id");
                    int nextCount = rs.getInt("attempt_count") + 1;
                    Timestamp lockUntil = nextCount >= 5
                            ? new Timestamp(System.currentTimeMillis() + 15L * 60L * 1000L)
                            : null;
                    try (PreparedStatement upd = conn.prepareStatement(
                            "UPDATE login_attempts SET attempt_count = ?, locked_until = ?, ip_address = ?, last_attempt_at = CURRENT_TIMESTAMP WHERE attempt_id = ?")) {
                        upd.setInt(1, nextCount);
                        upd.setTimestamp(2, lockUntil);
                        upd.setString(3, ipAddress);
                        upd.setInt(4, id);
                        upd.executeUpdate();
                    }
                    return nextCount;
                } else {
                    try (PreparedStatement ins = conn.prepareStatement(
                            "INSERT INTO login_attempts (identifier, ip_address, attempt_count, locked_until) VALUES (?, ?, 1, NULL)")) {
                        ins.setString(1, normalizedIdentifier);
                        ins.setString(2, ipAddress);
                        ins.executeUpdate();
                    }
                    return 1;
                }
            }
        } catch (SQLException e) {
            throw new PortalException("Failed to record login attempt.", 500, e);
        }
    }

    public void clearLoginAttempts(String normalizedIdentifier) throws PortalException {
        String sql = "DELETE FROM login_attempts WHERE identifier = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, normalizedIdentifier);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to clear login attempts.", 500, e);
        }
    }

    private User mapRowToPolymorphicUser(ResultSet rs) throws SQLException {
        User.Role role = User.Role.valueOf(rs.getString("role"));
        User user = switch (role) {
            case PRINCIPAL -> new Principal();
            case VICE_CHAIRMAN -> new ViceChairman();
            case CHAIRMAN -> new Chairman();
            case ADMIN -> new Admin();
            case PLACEMENT_OFFICER -> new PlacementOfficer();
            case FACULTY_COORDINATOR, FACULTY -> new Faculty();
            case RECRUITER -> new Recruiter();
            case STUDENT -> new Student();
        };
        user.setUserId(rs.getInt("user_id"));
        user.setUsername(rs.getString("username"));
        user.setEmail(rs.getString("email"));
        user.setPasswordHash(rs.getString("password_hash"));
        user.setPasswordSalt(rs.getString("password_salt"));
        user.setRole(role);
        user.setFullName(rs.getString("full_name"));
        user.setEmployeeId(rs.getString("employee_id"));
        user.setAssignedBranch(rs.getString("assigned_branch"));
        user.setDesignation(rs.getString("designation"));
        user.setDepartmentName(rs.getString("department_name"));
        Object compObj = rs.getObject("company_id");
        user.setCompanyId(compObj != null ? ((Number) compObj).intValue() : null);
        user.setApprovalStatus(rs.getString("approval_status"));
        user.setActive(rs.getBoolean("is_active"));
        user.setMustChangePassword(rs.getBoolean("must_change_password"));
        user.setPasswordChangeDismissed(rs.getBoolean("password_change_dismissed"));
        Object createdByObj = rs.getObject("created_by");
        user.setCreatedBy(createdByObj != null ? ((Number) createdByObj).intValue() : null);
        user.setLastLogin(rs.getTimestamp("last_login"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }
}
