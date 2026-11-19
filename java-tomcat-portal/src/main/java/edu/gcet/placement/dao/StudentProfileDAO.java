package edu.gcet.placement.dao;

import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * JDBC DAO for reading and transactionally updating the Official Student Profile (Sections A-I).
 */
public class StudentProfileDAO {

    public Optional<StudentProfile> findOfficialExtendedProfile(int studentId) throws PortalException {
        String sql = "SELECT sp.*, ssl.linkedin_url, ssl.github_url, ssl.portfolio_url, ssl.personal_website_url, " +
                     "ssl.leetcode_url, ssl.hackerrank_url, ssl.codechef_url, ssl.geeksforgeeks_url, " +
                     "sr.file_name AS resume_file_name, sr.file_size AS resume_file_size, sr.file_data_url AS resume_data_url " +
                     "FROM student_profiles sp " +
                     "LEFT JOIN student_social_links ssl ON sp.student_id = ssl.student_id " +
                     "LEFT JOIN student_resumes sr ON sp.student_id = sr.student_id " +
                     "WHERE sp.student_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();
                StudentProfile sp = new StudentProfile();
                sp.setProfileId(rs.getInt("profile_id"));
                sp.setStudentId(rs.getInt("student_id"));
                sp.setPhotoDataUrl(rs.getString("photo_data_url"));
                sp.setDateOfBirth(rs.getString("date_of_birth"));
                sp.setPersonalEmail(rs.getString("personal_email"));
                sp.setAlternatePhone(rs.getString("alternate_phone"));
                sp.setCity(rs.getString("city"));
                sp.setState(rs.getString("state"));
                sp.setPinCode(rs.getString("pin_code"));
                sp.setCollegeName(rs.getString("college_name"));
                sp.setRegistrationNumber(rs.getString("registration_number"));
                sp.setAdmissionYear(rs.getInt("admission_year"));
                sp.setPercentage(rs.getDouble("percentage"));
                sp.setHistoryOfBacklogs(rs.getInt("history_of_backlogs"));
                sp.setTenthMarks(rs.getString("tenth_marks"));
                sp.setInterDiplomaMarks(rs.getString("inter_diploma_marks"));
                sp.setUniversityName(rs.getString("university_name"));
                sp.setLinkedinUrl(rs.getString("linkedin_url"));
                sp.setGithubUrl(rs.getString("github_url"));
                sp.setPortfolioUrl(rs.getString("portfolio_url"));
                sp.setPersonalWebsiteUrl(rs.getString("personal_website_url"));
                sp.setLeetcodeUrl(rs.getString("leetcode_url"));
                sp.setHackerrankUrl(rs.getString("hackerrank_url"));
                sp.setCodechefUrl(rs.getString("codechef_url"));
                sp.setGeeksforgeeksUrl(rs.getString("geeksforgeeks_url"));
                sp.setResumeFileName(rs.getString("resume_file_name"));
                sp.setResumeFileSize(rs.getInt("resume_file_size"));
                sp.setResumeDataUrl(rs.getString("resume_data_url"));
                return Optional.of(sp);
            }
        } catch (SQLException e) {
            throw new PortalException("Unable to load extended official student profile.", 500, e);
        }
    }

    public List<Internship> findInternshipsByStudent(int studentId) throws PortalException {
        String sql = "SELECT * FROM student_internships WHERE student_id = ? ORDER BY start_date DESC";
        List<Internship> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Internship i = new Internship();
                    i.setInternshipId(rs.getInt("internship_id"));
                    i.setStudentId(rs.getInt("student_id"));
                    i.setCompanyName(rs.getString("company_name"));
                    i.setRole(rs.getString("role"));
                    i.setDuration(rs.getString("duration"));
                    i.setStartDate(rs.getString("start_date"));
                    i.setEndDate(rs.getString("end_date"));
                    i.setDescription(rs.getString("description"));
                    i.setTechnologiesUsed(rs.getString("technologies_used"));
                    i.setCertificateName(rs.getString("certificate_name"));
                    i.setCertificateData(rs.getString("certificate_data"));
                    list.add(i);
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error loading student internships.", 500, e);
        }
    }

    /**
     * Atomically promotes an approved ProfileSubmission payload into all Official Student Profile tables.
     */
    @SuppressWarnings("unchecked")
    public void applyApprovedPayloadTransaction(
            int submissionId,
            int studentId,
            int facultyUserId,
            String facultyName,
            String remarks,
            Map<String, Object> payload) throws PortalException {

        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);

            Map<String, Object> personal = (Map<String, Object>) payload.get("personal");
            Map<String, Object> academic = (Map<String, Object>) payload.get("academic");
            Map<String, Object> social = (Map<String, Object>) payload.get("socialLinks");

            String updateStudentSql = "UPDATE students SET full_name=?, phone=?, branch_code=?, academic_year=?, year_of_study=?, " +
                    "semester=?, section=?, graduation_year=?, cgpa=?, active_backlogs=?, gender=?, address=? WHERE student_id=?";
            try (PreparedStatement ps = conn.prepareStatement(updateStudentSql)) {
                ps.setString(1, str(personal, "full_name"));
                ps.setString(2, str(personal, "phone"));
                ps.setString(3, str(academic, "branch"));
                ps.setString(4, str(academic, "academic_year"));
                ps.setInt(5, numInt(academic, "year_of_study", 4));
                ps.setInt(6, numInt(academic, "semester", 7));
                ps.setString(7, str(academic, "section"));
                ps.setInt(8, numInt(academic, "graduation_year", 2027));
                ps.setDouble(9, numDouble(academic, "cgpa", 0.0));
                ps.setInt(10, numInt(academic, "active_backlogs", 0));
                ps.setString(11, str(personal, "gender"));
                ps.setString(12, str(personal, "address"));
                ps.setInt(13, studentId);
                ps.executeUpdate();
            }

            String upsertProfileSql = "INSERT INTO student_profiles (student_id, photo_data_url, date_of_birth, personal_email, alternate_phone, " +
                    "city, state, pin_code, college_name, registration_number, admission_year, percentage, history_of_backlogs, " +
                    "tenth_marks, inter_diploma_marks, university_name, last_approved_at, last_approved_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) " +
                    "ON DUPLICATE KEY UPDATE photo_data_url=VALUES(photo_data_url), date_of_birth=VALUES(date_of_birth), " +
                    "personal_email=VALUES(personal_email), alternate_phone=VALUES(alternate_phone), city=VALUES(city), " +
                    "state=VALUES(state), pin_code=VALUES(pin_code), college_name=VALUES(college_name), " +
                    "registration_number=VALUES(registration_number), admission_year=VALUES(admission_year), " +
                    "percentage=VALUES(percentage), history_of_backlogs=VALUES(history_of_backlogs), " +
                    "tenth_marks=VALUES(tenth_marks), inter_diploma_marks=VALUES(inter_diploma_marks), " +
                    "university_name=VALUES(university_name), last_approved_at=CURRENT_TIMESTAMP, last_approved_by=VALUES(last_approved_by)";
            try (PreparedStatement ps = conn.prepareStatement(upsertProfileSql)) {
                ps.setInt(1, studentId);
                ps.setString(2, str(personal, "photo_data_url"));
                String dob = str(personal, "date_of_birth");
                if (dob == null || dob.isBlank()) ps.setNull(3, Types.DATE); else ps.setString(3, dob);
                ps.setString(4, str(personal, "personal_email"));
                ps.setString(5, str(personal, "alternate_phone"));
                ps.setString(6, str(personal, "city"));
                ps.setString(7, str(personal, "state"));
                ps.setString(8, str(personal, "pin_code"));
                ps.setString(9, str(academic, "college_name"));
                ps.setString(10, str(academic, "registration_number"));
                ps.setInt(11, numInt(academic, "admission_year", 2023));
                ps.setDouble(12, numDouble(academic, "percentage", 0.0));
                ps.setInt(13, numInt(academic, "history_of_backlogs", 0));
                ps.setString(14, str(academic, "tenth_marks"));
                ps.setString(15, str(academic, "inter_diploma_marks"));
                ps.setString(16, str(academic, "university_name"));
                ps.setInt(17, facultyUserId);
                ps.executeUpdate();
            }

            if (social != null) {
                String upsertSocialSql = "INSERT INTO student_social_links (student_id, linkedin_url, github_url, portfolio_url, " +
                        "personal_website_url, leetcode_url, hackerrank_url, codechef_url, geeksforgeeks_url) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE " +
                        "linkedin_url=VALUES(linkedin_url), github_url=VALUES(github_url), portfolio_url=VALUES(portfolio_url), " +
                        "personal_website_url=VALUES(personal_website_url), leetcode_url=VALUES(leetcode_url), " +
                        "hackerrank_url=VALUES(hackerrank_url), codechef_url=VALUES(codechef_url), geeksforgeeks_url=VALUES(geeksforgeeks_url)";
                try (PreparedStatement ps = conn.prepareStatement(upsertSocialSql)) {
                    ps.setInt(1, studentId);
                    ps.setString(2, str(social, "linkedin_url"));
                    ps.setString(3, str(social, "github_url"));
                    ps.setString(4, str(social, "portfolio_url"));
                    ps.setString(5, str(social, "personal_website_url"));
                    ps.setString(6, str(social, "leetcode_url"));
                    ps.setString(7, str(social, "hackerrank_url"));
                    ps.setString(8, str(social, "codechef_url"));
                    ps.setString(9, str(social, "geeksforgeeks_url"));
                    ps.executeUpdate();
                }
            }

            // Update submission status & insert audit history inside same transaction
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE profile_submissions SET status='APPROVED', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, faculty_remarks=? WHERE submission_id=?")) {
                ps.setInt(1, facultyUserId);
                ps.setString(2, remarks);
                ps.setInt(3, submissionId);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO profile_approval_history (submission_id, student_id, faculty_user_id, faculty_name, action, remarks) VALUES (?, ?, ?, ?, 'APPROVED', ?)")) {
                ps.setInt(1, submissionId);
                ps.setInt(2, studentId);
                ps.setInt(3, facultyUserId);
                ps.setString(4, facultyName);
                ps.setString(5, remarks);
                ps.executeUpdate();
            }

            conn.commit();
        } catch (SQLException e) {
            if (conn != null) {
                try { conn.rollback(); } catch (SQLException ignored) {}
            }
            throw new PortalException("Failed to commit approved student profile transaction.", 500, e);
        } finally {
            if (conn != null) {
                try { conn.setAutoCommit(true); conn.close(); } catch (SQLException ignored) {}
            }
        }
    }

    private String str(Map<String, Object> m, String key) {
        if (m == null || m.get(key) == null) return null;
        return String.valueOf(m.get(key));
    }

    private int numInt(Map<String, Object> m, String key, int def) {
        if (m == null || m.get(key) == null) return def;
        return (int) Math.round(Double.parseDouble(String.valueOf(m.get(key))));
    }

    private double numDouble(Map<String, Object> m, String key, double def) {
        if (m == null || m.get(key) == null) return def;
        return Double.parseDouble(String.valueOf(m.get(key)));
    }
}
