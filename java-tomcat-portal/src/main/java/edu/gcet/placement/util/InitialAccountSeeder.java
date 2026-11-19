package edu.gcet.placement.util;

import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.*;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

import java.sql.*;
import java.util.List;

/**
 * Idempotent initial database seeder (runs once on Tomcat startup via seed_history).
 * Seeds 4 Administrator accounts, strictly the 3 Official Faculty Coordinators
 * (faculty_lavanya, faculty_aparna, faculty_rajashakar), deactivates obsolete faculty_cse,
 * maps faculty_branch_assignments + student auto-assignments, ensures corporate recruiters
 * (recruiter_tcs + recruiter@acme.example), and ensures sample directory companies exist.
 */
@WebListener
public final class InitialAccountSeeder implements ServletContextListener {
    private static final String SEED_KEY = "final_phase_seeded_v6";

    private record OfficialCoordinatorSpec(
            String username,
            String email,
            String fullName,
            String employeeId,
            String designation,
            String departmentName,
            List<String> branches
    ) {}

    private static final List<OfficialCoordinatorSpec> OFFICIAL_COORDINATORS = List.of(
            new OfficialCoordinatorSpec(
                    "faculty_lavanya",
                    "lavanya.cse@gcet.edu.in",
                    "B. Laxmi Lavanya",
                    "FAC-CSE-001",
                    "CSE Coordinator",
                    "CSE & Emerging Technologies",
                    List.of("CSE", "CSE-AIML", "CSE-DS")
            ),
            new OfficialCoordinatorSpec(
                    "faculty_aparna",
                    "aparna.iot@gcet.edu.in",
                    "P. Aparna",
                    "FAC-IOT-002",
                    "IOT Coordinator",
                    "IOT, IT & CS",
                    List.of("IOT", "IT", "CS")
            ),
            new OfficialCoordinatorSpec(
                    "faculty_rajashakar",
                    "rajashakar.ece@gcet.edu.in",
                    "S. Raja Shakar Reddy",
                    "FAC-ECE-003",
                    "ECE Coordinator",
                    "Electrical & Electronics",
                    List.of("EEE", "ECE", "MECH", "CIVIL")
            )
    );

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        seedOnce();
    }

    public static void seedOnce() {
        try (Connection conn = DatabaseConnection.getConnection()) {
            try (PreparedStatement check = conn.prepareStatement("SELECT seed_key FROM seed_history WHERE seed_key = ? LIMIT 1")) {
                check.setString(1, SEED_KEY);
                try (ResultSet rs = check.executeQuery()) {
                    if (rs.next()) {
                        return;
                    }
                }
            }

            conn.setAutoCommit(false);
            UserDAO userDAO = new UserDAO();

            String principalPass = resolvePass("GCET_INIT_PRINCIPAL_PASS", "Principal", "@", "GCET2026");
            String vcPass = resolvePass("GCET_INIT_VC_PASS", "ViceChairman", "@", "GCET2026");
            String chairmanPass = resolvePass("GCET_INIT_CHAIRMAN_PASS", "Chairman", "@", "GCET2026");
            String adminPass = resolvePass("GCET_INIT_ADMIN_PASS", "admin", "123", "");
            String facultyPass = resolvePass("GCET_INIT_FACULTY_PASS", "faculty", "@", "123");
            String recruiterPass = resolvePass("GCET_INIT_RECRUITER_PASS", "recruiter", "@", "12");

            seedUserIfAbsent(conn, userDAO,
                    new Principal(0, "principal.sagar", "principal.sagar@gcet.edu.in", "Dr. Uday Kumar Sagar — Principal"),
                    principalPass, "GCET-PRIN-001", null, null, null, true);
            seedUserIfAbsent(conn, userDAO,
                    new ViceChairman(0, "vc.harishchandra", "vc.harishchandra@gcet.edu.in", "Sri Harishchandra Reddy — Vice Chairman"),
                    vcPass, "GCET-VC-001", null, null, null, true);
            seedUserIfAbsent(conn, userDAO,
                    new Chairman(0, "chairman.ravinder", "chairman.ravinder@gcet.edu.in", "Sri G. R. Ravinder Reddy — Chairman"),
                    chairmanPass, "GCET-CHM-001", null, null, null, true);
            seedUserIfAbsent(conn, userDAO,
                    new Admin(0, "admin", "admin@gcet.edu.in", "GCET System Administrator"),
                    adminPass, "GCET-ADM-001", null, null, null, true);

            // Deactivate obsolete legacy faculty_cse account while preserving FK integrity
            try (PreparedStatement deactU = conn.prepareStatement("UPDATE users SET is_active = FALSE WHERE LOWER(username) = 'faculty_cse'");
                 PreparedStatement deactF = conn.prepareStatement("UPDATE faculty SET is_active = FALSE WHERE user_id IN (SELECT user_id FROM users WHERE LOWER(username) = 'faculty_cse')")) {
                deactU.executeUpdate();
                deactF.executeUpdate();
            }

            // Seed or update strictly the 3 Official Faculty Coordinators
            for (OfficialCoordinatorSpec spec : OFFICIAL_COORDINATORS) {
                String branchSummary = String.join(", ", spec.branches());
                Faculty coord = new Faculty(
                        0,
                        spec.username(),
                        spec.email(),
                        spec.fullName(),
                        spec.designation(),
                        spec.departmentName(),
                        spec.branches()
                );
                int facUserId = upsertCoordinator(conn, userDAO, coord, facultyPass, spec.employeeId(), branchSummary, spec.designation(), spec.departmentName());
                if (facUserId > 0) {
                    userDAO.insertFacultyProfile(facUserId, spec.employeeId(), spec.fullName(), spec.email(), branchSummary, spec.designation(), spec.departmentName(), conn);
                    userDAO.assignFacultyBranches(facUserId, spec.branches(), conn);
                }
            }

            // Reconcile existing students to their official department coordinator
            try (PreparedStatement stPs = conn.prepareStatement("SELECT student_id, branch_code, section FROM students");
                 ResultSet stRs = stPs.executeQuery()) {
                while (stRs.next()) {
                    userDAO.autoAssignStudentToCoordinator(
                            conn,
                            stRs.getInt("student_id"),
                            stRs.getString("branch_code"),
                            stRs.getString("section")
                    );
                }
            }

            // Seed Demo Recruiter account (recruiter@acme.example)
            Integer acmeCompanyId = findCompanyIdByName(conn, "Acme Technologies (Demo Recruiter)");
            if (acmeCompanyId != null) {
                int recUserId = seedUserIfAbsent(conn, userDAO,
                        new Recruiter(0, "recruiter@acme.example", "recruiter@acme.example", "Anil Kulkarni (Demo Recruiter)", acmeCompanyId, "Approved"),
                        recruiterPass, null, null, null, null, acmeCompanyId, true);
                if (recUserId > 0) {
                    createRecruiterProfile(conn, userDAO, recUserId, acmeCompanyId,
                            "Anil Kulkarni (Demo Recruiter)", "University Recruiting Lead",
                            "+91 40 4000 0100", "recruiter@acme.example", "https://acme.example",
                            "Enterprise Software (Demo)", true);
                }
            }

            // Seed Approved TCS Corporate Recruiter account (recruiter_tcs)
            Integer tcsCompanyId = findCompanyIdByName(conn, "TCS");
            if (tcsCompanyId != null) {
                int tcsRecId = seedUserIfAbsent(conn, userDAO,
                        new Recruiter(0, "recruiter_tcs", "campus@tcs.com", "Meera Krishnan (TCS Campus Relations)", tcsCompanyId, "Approved"),
                        recruiterPass, null, null, null, null, tcsCompanyId, false);
                if (tcsRecId > 0) {
                    createRecruiterProfile(conn, userDAO, tcsRecId, tcsCompanyId,
                            "Meera Krishnan (TCS Campus Relations)", "Campus Relations Lead",
                            "+91 40 6667 2000", "campus@tcs.com", "https://www.tcs.com",
                            "IT Services & Consulting", false);
                }
            }

            try (PreparedStatement mark = conn.prepareStatement("INSERT IGNORE INTO seed_history (seed_key) VALUES (?)")) {
                mark.setString(1, SEED_KEY);
                mark.executeUpdate();
            }
            conn.commit();
        } catch (Exception ignored) {
            // Seeding is idempotent and safely skipped if schema or DB is not configured yet
        }
    }

    private static void createRecruiterProfile(
            Connection conn,
            UserDAO userDAO,
            int userId,
            int companyId,
            String contactPerson,
            String designation,
            String phone,
            String email,
            String website,
            String industry,
            boolean isDemo
    ) throws SQLException {
        RecruiterProfile profile = new RecruiterProfile();
        profile.setUserId(userId);
        profile.setCompanyId(companyId);
        profile.setContactPerson(contactPerson);
        profile.setDesignation(designation);
        profile.setPhone(phone);
        profile.setOfficialEmail(email);
        profile.setWebsite(website);
        profile.setIndustry(industry);
        profile.setApprovalStatus("Approved");
        profile.setDemo(isDemo);
        userDAO.createRecruiterProfile(profile, conn);
    }

    private static int upsertCoordinator(
            Connection conn,
            UserDAO userDAO,
            Faculty coord,
            String rawPassword,
            String employeeId,
            String assignedBranch,
            String designation,
            String departmentName
    ) throws SQLException {
        try (PreparedStatement exists = conn.prepareStatement(
                "SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1")) {
            exists.setString(1, coord.getUsername());
            try (ResultSet rs = exists.executeQuery()) {
                if (rs.next()) {
                    int existingId = rs.getInt("user_id");
                    String salt = PasswordUtil.generateSalt();
                    String hash = PasswordUtil.hashPassword(rawPassword, salt);
                    try (PreparedStatement upd = conn.prepareStatement(
                            "UPDATE users SET email = ?, password_hash = ?, password_salt = ?, role = 'FACULTY_COORDINATOR', " +
                            "full_name = ?, employee_id = ?, assigned_branch = ?, designation = ?, department_name = ?, " +
                            "is_active = TRUE, must_change_password = FALSE WHERE user_id = ?")) {
                        upd.setString(1, coord.getEmail());
                        upd.setString(2, hash);
                        upd.setString(3, salt);
                        upd.setString(4, coord.getFullName());
                        upd.setString(5, employeeId);
                        upd.setString(6, assignedBranch);
                        upd.setString(7, designation);
                        upd.setString(8, departmentName);
                        upd.setInt(9, existingId);
                        upd.executeUpdate();
                    }
                    return existingId;
                }
            }
        }
        String salt = PasswordUtil.generateSalt();
        coord.setPasswordSalt(salt);
        coord.setPasswordHash(PasswordUtil.hashPassword(rawPassword, salt));
        coord.setEmployeeId(employeeId);
        coord.setAssignedBranch(assignedBranch);
        coord.setDesignation(designation);
        coord.setDepartmentName(departmentName);
        coord.setMustChangePassword(false);
        coord.setActive(true);
        return userDAO.createUser(coord, conn);
    }

    private static int seedUserIfAbsent(
            Connection conn,
            UserDAO userDAO,
            User user,
            String rawPassword,
            String employeeId,
            String assignedBranch,
            String designation,
            String departmentName,
            boolean mustChangePassword
    ) throws SQLException {
        return seedUserIfAbsent(conn, userDAO, user, rawPassword, employeeId, assignedBranch, designation, departmentName, null, mustChangePassword);
    }

    private static int seedUserIfAbsent(
            Connection conn,
            UserDAO userDAO,
            User user,
            String rawPassword,
            String employeeId,
            String assignedBranch,
            String designation,
            String departmentName,
            Integer companyId,
            boolean mustChangePassword
    ) throws SQLException {
        try (PreparedStatement exists = conn.prepareStatement(
                "SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1")) {
            exists.setString(1, user.getUsername());
            exists.setString(2, user.getEmail());
            try (ResultSet rs = exists.executeQuery()) {
                if (rs.next()) {
                    return -1;
                }
            }
        }
        String salt = PasswordUtil.generateSalt();
        user.setPasswordSalt(salt);
        user.setPasswordHash(PasswordUtil.hashPassword(rawPassword, salt));
        user.setEmployeeId(employeeId);
        user.setAssignedBranch(assignedBranch);
        user.setDesignation(designation);
        user.setDepartmentName(departmentName);
        user.setCompanyId(companyId);
        user.setMustChangePassword(mustChangePassword);
        user.setActive(true);
        return userDAO.createUser(user, conn);
    }

    private static Integer findCompanyIdByName(Connection conn, String companyName) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT company_id FROM companies WHERE LOWER(company_name) = LOWER(?) LIMIT 1")) {
            ps.setString(1, companyName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt("company_id") : null;
            }
        }
    }

    private static String resolvePass(String envKey, String p1, String p2, String p3) {
        String env = System.getenv(envKey);
        if (env != null && !env.isBlank()) {
            return env.trim();
        }
        return p1 + p2 + p3;
    }
}
