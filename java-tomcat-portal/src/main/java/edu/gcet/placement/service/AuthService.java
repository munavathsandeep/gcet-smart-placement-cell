package edu.gcet.placement.service;

import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PasswordUtil;
import edu.gcet.placement.util.PortalException;
import edu.gcet.placement.util.ValidationUtil;

import java.sql.*;
import java.util.Optional;

public class AuthService {
    private final UserDAO userDAO = new UserDAO();
    private final StudentDAO studentDAO = new StudentDAO();

    public User authenticate(String identifier, String rawPassword, String expectedRole, String ipAddress) throws PortalException {
        ValidationUtil.requireNonEmpty(identifier, "Username or Email");
        ValidationUtil.requireNonEmpty(rawPassword, "Password");

        String normKey = identifier.trim().toLowerCase();
        Timestamp lockedUntil = userDAO.getLockedUntil(normKey);
        if (lockedUntil != null && lockedUntil.getTime() > System.currentTimeMillis()) {
            throw new PortalException("Too many failed sign-in attempts. Account is temporarily locked for 15 minutes.", 429);
        }

        Optional<User> opt = userDAO.findByIdentifier(identifier.trim());
        User user = opt.orElse(null);

        if (user == null || !PasswordUtil.verifyPassword(rawPassword, user.getPasswordHash(), user.getPasswordSalt())) {
            int attempts = userDAO.recordFailedLoginAttempt(normKey, ipAddress != null ? ipAddress : "unknown");
            if (attempts >= 5) {
                throw new PortalException("Too many failed sign-in attempts (5/5). Account locked for 15 minutes.", 429);
            }
            throw new PortalException("Invalid credentials.", 401);
        }

        if (!user.isActive()) {
            throw new PortalException("Account is deactivated. Contact System Administrator.", 403);
        }
        if ("Pending".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new PortalException("Recruiter account is pending administrator approval.", 403);
        }
        if ("Rejected".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new PortalException("Account registration was declined.", 403);
        }
        if (expectedRole != null && !expectedRole.isBlank()) {
            boolean adminPortalMatch = "ADMIN".equalsIgnoreCase(expectedRole) && user.isPlacementAdmin();
            boolean facultyPortalMatch = ("FACULTY".equalsIgnoreCase(expectedRole) || "FACULTY_COORDINATOR".equalsIgnoreCase(expectedRole))
                    && user.isFacultyRole();
            if (!adminPortalMatch && !facultyPortalMatch && !user.getRole().name().equalsIgnoreCase(expectedRole)) {
                throw new PortalException("Role mismatch for this login portal.", 403);
            }
        }

        userDAO.clearLoginAttempts(normKey);
        userDAO.updateLastLogin(user.getUserId());
        return user;
    }

    public Student registerStudent(Student student, String rawPassword) throws PortalException {
        ValidationUtil.validateRollNumber(student.getRollNumber());
        ValidationUtil.requireNonEmpty(student.getFullName(), "Full Name");
        ValidationUtil.validateEmail(student.getEmail());
        ValidationUtil.validatePhone(student.getPhone());
        ValidationUtil.validateCgpa(student.getCgpa());
        ValidationUtil.requireNonEmpty(rawPassword, "Password");

        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(rawPassword, salt);
        String normRoll = student.getRollNumber().trim().toUpperCase();
        String normEmail = student.getEmail().trim();
        student.setRollNumber(normRoll);
        student.setUsername(normRoll.toLowerCase());
        student.setEmail(normEmail);
        student.setPasswordSalt(salt);
        student.setPasswordHash(hash);

        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);

            // Resolve branch_id and dept_id dynamically from branches table
            String branchInput = student.getBranch() != null ? student.getBranch().trim() : "CSE";
            try (PreparedStatement brPs = conn.prepareStatement(
                    "SELECT branch_id, dept_id, branch_code FROM branches WHERE UPPER(branch_code) = UPPER(?) OR branch_id = ? LIMIT 1")) {
                brPs.setString(1, branchInput);
                brPs.setInt(2, student.getBranchId());
                try (ResultSet brRs = brPs.executeQuery()) {
                    if (brRs.next()) {
                        student.setBranchId(brRs.getInt("branch_id"));
                        student.setDeptId(brRs.getInt("dept_id"));
                        student.setBranch(brRs.getString("branch_code"));
                    } else {
                        throw new PortalException("Selected GCET branch is invalid.", 400);
                    }
                }
            }
            student.setAssignedBranch(student.getBranch());

            // Check duplicate account cleanly before insert
            try (PreparedStatement dupPs = conn.prepareStatement(
                    "SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1")) {
                dupPs.setString(1, student.getUsername());
                dupPs.setString(2, normEmail);
                try (ResultSet dupRs = dupPs.executeQuery()) {
                    if (dupRs.next()) {
                        throw new PortalException("An account with this roll number or email already exists.", 409);
                    }
                }
            }

            int userId = userDAO.createUser(student, conn);
            student.setUserId(userId);

            String stuSql = "INSERT INTO students (user_id, roll_number, full_name, email, phone, dept_id, branch_id, branch_code, " +
                    "academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, placement_status) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unplaced')";
            try (PreparedStatement stuPs = conn.prepareStatement(stuSql, Statement.RETURN_GENERATED_KEYS)) {
                stuPs.setInt(1, userId);
                stuPs.setString(2, normRoll);
                stuPs.setString(3, student.getFullName().trim());
                stuPs.setString(4, normEmail);
                stuPs.setString(5, student.getPhone().trim());
                stuPs.setInt(6, student.getDeptId());
                stuPs.setInt(7, student.getBranchId());
                stuPs.setString(8, student.getBranch());
                stuPs.setString(9, student.getAcademicYear() != null ? student.getAcademicYear() : "2026-27");
                stuPs.setInt(10, student.getYearOfStudy() > 0 ? student.getYearOfStudy() : 4);
                stuPs.setInt(11, student.getSemester() > 0 ? student.getSemester() : 7);
                stuPs.setString(12, student.getSection() != null && !student.getSection().isBlank() ? student.getSection() : "A");
                stuPs.setInt(13, student.getGraduationYear() > 0 ? student.getGraduationYear() : 2027);
                stuPs.setDouble(14, student.getCgpa());
                stuPs.setInt(15, Math.max(0, student.getActiveBacklogs()));
                stuPs.executeUpdate();
                try (ResultSet keys = stuPs.getGeneratedKeys()) {
                    if (keys.next()) {
                        student.setStudentId(keys.getInt(1));
                    }
                }
            }

            if (student.getStudentId() > 0) {
                userDAO.autoAssignStudentToCoordinator(conn, student.getStudentId(), student.getBranch(), student.getSection());
            }

            conn.commit();
            return student;
        } catch (PortalException pe) {
            DatabaseConnection.rollbackQuietly(conn);
            throw pe;
        } catch (SQLException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Registration failed due to duplicate roll number or email.", 409, e);
        } finally {
            DatabaseConnection.closeQuietly(conn);
        }
    }

    public Recruiter registerPendingRecruiter(
            String companyName,
            String industry,
            String website,
            String headquarters,
            String fullName,
            String designation,
            String email,
            String phone,
            String rawPassword
    ) throws PortalException {
        ValidationUtil.requireNonEmpty(companyName, "Company Name");
        ValidationUtil.requireNonEmpty(fullName, "Contact Person");
        ValidationUtil.validateEmail(email);
        ValidationUtil.requireNonEmpty(rawPassword, "Password");

        String loginName = email.split("@")[0].trim().toLowerCase();
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(rawPassword, salt);

        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);

            int companyId = ensureCompanyExists(conn, companyName.trim(), industry, website, headquarters);

            Recruiter recruiter = new Recruiter();
            recruiter.setUsername(loginName);
            recruiter.setEmail(email.trim());
            recruiter.setPasswordSalt(salt);
            recruiter.setPasswordHash(hash);
            recruiter.setFullName(fullName.trim());
            recruiter.setCompanyId(companyId);
            recruiter.setApprovalStatus("Pending");
            recruiter.setActive(true);
            recruiter.setMustChangePassword(false);

            int userId = userDAO.createUser(recruiter, conn);

            RecruiterProfile profile = new RecruiterProfile();
            profile.setUserId(userId);
            profile.setCompanyId(companyId);
            profile.setContactPerson(fullName.trim());
            profile.setDesignation(designation);
            profile.setPhone(phone);
            profile.setOfficialEmail(email.trim());
            profile.setWebsite(website);
            profile.setIndustry(industry);
            profile.setApprovalStatus("Pending");
            profile.setDemo(false);
            userDAO.createRecruiterProfile(profile, conn);

            conn.commit();
            return recruiter;
        } catch (SQLException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Recruiter registration failed (email/username may already exist).", 409, e);
        } finally {
            DatabaseConnection.closeQuietly(conn);
        }
    }

    private int ensureCompanyExists(Connection conn, String companyName, String industry, String website, String headquarters) throws SQLException {
        try (PreparedStatement sel = conn.prepareStatement("SELECT company_id FROM companies WHERE LOWER(company_name) = LOWER(?) LIMIT 1")) {
            sel.setString(1, companyName);
            try (ResultSet rs = sel.executeQuery()) {
                if (rs.next()) return rs.getInt("company_id");
            }
        }
        String insSql = "INSERT INTO companies (company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference) VALUES (?, ?, ?, ?, ?, ?, FALSE)";
        try (PreparedStatement ins = conn.prepareStatement(insSql, Statement.RETURN_GENERATED_KEYS)) {
            ins.setString(1, companyName);
            ins.setString(2, industry != null && !industry.isBlank() ? industry : "Technology");
            ins.setString(3, website != null && !website.isBlank() ? website : "https://gcet.edu.in/");
            ins.setString(4, website != null && !website.isBlank() ? website : "https://gcet.edu.in/");
            ins.setString(5, headquarters != null && !headquarters.isBlank() ? headquarters : "Hyderabad, India");
            ins.setString(6, "Corporate partner awaiting GCET Placement Cell verification.");
            ins.executeUpdate();
            try (ResultSet keys = ins.getGeneratedKeys()) {
                if (keys.next()) return keys.getInt(1);
            }
        }
        throw new SQLException("Unable to resolve partner company.");
    }

    public void changePassword(int userId, String currentPassword, String newPassword) throws PortalException {
        ValidationUtil.requireNonEmpty(currentPassword, "Current Password");
        ValidationUtil.requireNonEmpty(newPassword, "New Password");
        User user = userDAO.findById(userId)
                .orElseThrow(() -> new PortalException("Account not found.", 404));
        if (!PasswordUtil.verifyPassword(currentPassword, user.getPasswordHash(), user.getPasswordSalt())) {
            throw new PortalException("Current password is incorrect.", 401);
        }
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(newPassword, salt);
        userDAO.updatePasswordByUserId(userId, user.getEmail(), hash, salt, false);
    }

    public void resetPassword(String email, String newPassword) throws PortalException {
        ValidationUtil.validateEmail(email);
        ValidationUtil.requireNonEmpty(newPassword, "New Password");
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(newPassword, salt);
        if (!userDAO.updatePassword(email.trim(), hash, salt)) {
            throw new PortalException("No account registered with that email address.", 404);
        }
    }
}
