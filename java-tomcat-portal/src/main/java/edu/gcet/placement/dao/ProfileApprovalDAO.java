package edu.gcet.placement.dao;

import edu.gcet.placement.model.ProfileApproval;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * JDBC DAO for Student Profile Approval Audit History.
 */
public class ProfileApprovalDAO {

    public void recordAction(int submissionId, int studentId, Integer facultyUserId, String facultyName, String action, String remarks)
            throws PortalException {
        String sql = "INSERT INTO profile_approval_history (submission_id, student_id, faculty_user_id, faculty_name, action, remarks) " +
                     "VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, submissionId);
            ps.setInt(2, studentId);
            if (facultyUserId != null) ps.setInt(3, facultyUserId); else ps.setNull(3, Types.INTEGER);
            ps.setString(4, facultyName);
            ps.setString(5, action);
            ps.setString(6, remarks);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Error recording profile approval audit history.", 500, e);
        }
    }

    public List<ProfileApproval> findHistoryByStudent(int studentId) throws PortalException {
        String sql = "SELECT pah.*, ps.submission_code FROM profile_approval_history pah " +
                     "LEFT JOIN profile_submissions ps ON pah.submission_id = ps.submission_id " +
                     "WHERE pah.student_id = ? ORDER BY pah.history_id DESC";
        List<ProfileApproval> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    ProfileApproval pa = new ProfileApproval();
                    pa.setHistoryId(rs.getInt("history_id"));
                    pa.setSubmissionId(rs.getInt("submission_id"));
                    pa.setSubmissionCode(rs.getString("submission_code"));
                    pa.setStudentId(rs.getInt("student_id"));
                    int fId = rs.getInt("faculty_user_id");
                    if (!rs.wasNull()) pa.setFacultyUserId(fId);
                    pa.setFacultyName(rs.getString("faculty_name"));
                    pa.setAction(rs.getString("action"));
                    pa.setRemarks(rs.getString("remarks"));
                    pa.setActionAt(rs.getTimestamp("action_at"));
                    list.add(pa);
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error retrieving profile approval history.", 500, e);
        }
    }
}
