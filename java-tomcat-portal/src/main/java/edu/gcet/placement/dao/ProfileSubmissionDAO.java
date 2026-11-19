package edu.gcet.placement.dao;

import edu.gcet.placement.model.ProfileApproval;
import edu.gcet.placement.model.ProfileSubmission;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * JDBC DAO for staged student profile drafts, pending submissions, and faculty-scoped review queues.
 */
public class ProfileSubmissionDAO {

    public Optional<ProfileSubmission> findLatestByStudent(int studentId) throws PortalException {
        String sql = "SELECT ps.*, s.full_name AS student_name, s.roll_number, s.branch_code, s.section, " +
                     "af.full_name AS assigned_faculty_name, rv.full_name AS reviewed_by_name " +
                     "FROM profile_submissions ps " +
                     "JOIN students s ON ps.student_id = s.student_id " +
                     "LEFT JOIN users af ON ps.assigned_faculty_id = af.user_id " +
                     "LEFT JOIN users rv ON ps.reviewed_by = rv.user_id " +
                     "WHERE ps.student_id = ? ORDER BY ps.submission_id DESC LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();
                ProfileSubmission sub = mapRow(rs);
                sub.setDiffDetails(loadDiffDetails(conn, sub.getSubmissionId()));
                return Optional.of(sub);
            }
        } catch (SQLException e) {
            throw new PortalException("Error retrieving latest profile submission.", 500, e);
        }
    }

    public Optional<ProfileSubmission> findById(int submissionId) throws PortalException {
        String sql = "SELECT ps.*, s.full_name AS student_name, s.roll_number, s.branch_code, s.section, " +
                     "af.full_name AS assigned_faculty_name, rv.full_name AS reviewed_by_name " +
                     "FROM profile_submissions ps " +
                     "JOIN students s ON ps.student_id = s.student_id " +
                     "LEFT JOIN users af ON ps.assigned_faculty_id = af.user_id " +
                     "LEFT JOIN users rv ON ps.reviewed_by = rv.user_id " +
                     "WHERE ps.submission_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, submissionId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();
                ProfileSubmission sub = mapRow(rs);
                sub.setDiffDetails(loadDiffDetails(conn, sub.getSubmissionId()));
                return Optional.of(sub);
            }
        } catch (SQLException e) {
            throw new PortalException("Error retrieving submission detail.", 500, e);
        }
    }

    public List<ProfileSubmission> findQueueForFaculty(Integer facultyUserId, String assignedBranch, boolean isPlacementAdmin, String statusFilter)
            throws PortalException {
        StringBuilder sql = new StringBuilder(
                "SELECT ps.*, s.full_name AS student_name, s.roll_number, s.branch_code, s.section, " +
                "af.full_name AS assigned_faculty_name, rv.full_name AS reviewed_by_name " +
                "FROM profile_submissions ps " +
                "JOIN students s ON ps.student_id = s.student_id " +
                "LEFT JOIN users af ON ps.assigned_faculty_id = af.user_id " +
                "LEFT JOIN users rv ON ps.reviewed_by = rv.user_id " +
                "WHERE ps.status != 'DRAFT' ");
        List<Object> params = new ArrayList<>();
        if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
            sql.append("AND ps.status = ? ");
            params.add(statusFilter);
        }
        sql.append("ORDER BY CASE ps.status WHEN 'WAITING_FOR_APPROVAL' THEN 0 ELSE 1 END, ps.updated_at DESC");

        List<ProfileSubmission> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            List<String> allowedBranches = isPlacementAdmin
                    ? List.of()
                    : new UserDAO().loadFacultyAssignedBranches(conn, facultyUserId != null ? facultyUserId : 0, assignedBranch);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    ProfileSubmission row = mapRow(rs);
                    if (isPlacementAdmin || UserDAO.branchMatchesScope(row.getBranch(), allowedBranches)) {
                        list.add(row);
                    }
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error querying faculty approval queue.", 500, e);
        }
    }

    public boolean isStudentInFacultyScope(int facultyUserId, String assignedBranch, int studentId) throws PortalException {
        String sql = "SELECT s.branch_code FROM students s WHERE s.student_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return false;
                String studentBranch = rs.getString("branch_code");
                List<String> allowedBranches = new UserDAO().loadFacultyAssignedBranches(conn, facultyUserId, assignedBranch);
                return UserDAO.branchMatchesScope(studentBranch, allowedBranches);
            }
        } catch (SQLException e) {
            throw new PortalException("Error verifying faculty authorization scope.", 500, e);
        }
    }

    public int saveOrSubmitSubmission(ProfileSubmission sub, List<ProfileApproval.DiffDetail> diffs) throws PortalException {
        String insertSql = "INSERT INTO profile_submissions (submission_code, student_id, assigned_faculty_id, status, " +
                           "draft_payload_json, previous_snapshot_json, changed_fields_json, submitted_at) " +
                           "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, sub.getSubmissionCode());
            ps.setInt(2, sub.getStudentId());
            if (sub.getAssignedFacultyId() != null) ps.setInt(3, sub.getAssignedFacultyId()); else ps.setNull(3, Types.INTEGER);
            ps.setString(4, sub.getStatus().name());
            ps.setString(5, sub.getDraftPayloadJson());
            ps.setString(6, sub.getPreviousSnapshotJson());
            ps.setString(7, sub.getChangedFieldsJson());
            if (sub.getStatus() == ProfileSubmission.Status.WAITING_FOR_APPROVAL) {
                ps.setTimestamp(8, new Timestamp(System.currentTimeMillis()));
            } else {
                ps.setNull(8, Types.TIMESTAMP);
            }
            ps.executeUpdate();
            int submissionId = 0;
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) submissionId = keys.getInt(1);
            }
            if (submissionId > 0 && diffs != null) {
                String detSql = "INSERT INTO profile_submission_details (submission_id, section_name, field_key, field_label, previous_value, new_value, is_changed) VALUES (?, ?, ?, ?, ?, ?, TRUE)";
                try (PreparedStatement dps = conn.prepareStatement(detSql)) {
                    for (ProfileApproval.DiffDetail d : diffs) {
                        dps.setInt(1, submissionId);
                        dps.setString(2, d.getSectionName());
                        dps.setString(3, d.getFieldKey());
                        dps.setString(4, d.getFieldLabel());
                        dps.setString(5, d.getPreviousValue());
                        dps.setString(6, d.getNewValue());
                        dps.addBatch();
                    }
                    dps.executeBatch();
                }
            }
            return submissionId;
        } catch (SQLException e) {
            throw new PortalException("Failed to persist profile submission.", 500, e);
        }
    }

    public void updateDecision(int submissionId, ProfileSubmission.Status status, int reviewedBy, String remarks) throws PortalException {
        String sql = "UPDATE profile_submissions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, faculty_remarks = ? WHERE submission_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            ps.setInt(2, reviewedBy);
            ps.setString(3, remarks);
            ps.setInt(4, submissionId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to update submission decision.", 500, e);
        }
    }

    private List<ProfileApproval.DiffDetail> loadDiffDetails(Connection conn, int submissionId) throws SQLException {
        String sql = "SELECT * FROM profile_submission_details WHERE submission_id = ? ORDER BY detail_id ASC";
        List<ProfileApproval.DiffDetail> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, submissionId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    ProfileApproval.DiffDetail d = new ProfileApproval.DiffDetail();
                    d.setDetailId(rs.getInt("detail_id"));
                    d.setSubmissionId(rs.getInt("submission_id"));
                    d.setSectionName(rs.getString("section_name"));
                    d.setFieldKey(rs.getString("field_key"));
                    d.setFieldLabel(rs.getString("field_label"));
                    d.setPreviousValue(rs.getString("previous_value"));
                    d.setNewValue(rs.getString("new_value"));
                    d.setChanged(rs.getBoolean("is_changed"));
                    list.add(d);
                }
            }
        }
        return list;
    }

    private ProfileSubmission mapRow(ResultSet rs) throws SQLException {
        ProfileSubmission sub = new ProfileSubmission();
        sub.setSubmissionId(rs.getInt("submission_id"));
        sub.setSubmissionCode(rs.getString("submission_code"));
        sub.setStudentId(rs.getInt("student_id"));
        sub.setStudentName(rs.getString("student_name"));
        sub.setRollNumber(rs.getString("roll_number"));
        sub.setBranch(rs.getString("branch_code"));
        sub.setSection(rs.getString("section"));
        int afId = rs.getInt("assigned_faculty_id");
        if (!rs.wasNull()) sub.setAssignedFacultyId(afId);
        sub.setAssignedFacultyName(rs.getString("assigned_faculty_name"));
        sub.setStatus(ProfileSubmission.Status.valueOf(rs.getString("status")));
        sub.setDraftPayloadJson(rs.getString("draft_payload_json"));
        sub.setPreviousSnapshotJson(rs.getString("previous_snapshot_json"));
        sub.setChangedFieldsJson(rs.getString("changed_fields_json"));
        sub.setSubmittedAt(rs.getTimestamp("submitted_at"));
        int rvId = rs.getInt("reviewed_by");
        if (!rs.wasNull()) sub.setReviewedBy(rvId);
        sub.setReviewedByName(rs.getString("reviewed_by_name"));
        sub.setReviewedAt(rs.getTimestamp("reviewed_at"));
        sub.setFacultyRemarks(rs.getString("faculty_remarks"));
        return sub;
    }
}
