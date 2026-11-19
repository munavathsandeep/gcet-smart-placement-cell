package edu.gcet.placement.dao;

import edu.gcet.placement.model.Application;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class ApplicationDAO {

    public List<Application> findAll(Integer studentId) throws PortalException {
        StringBuilder sql = new StringBuilder(
                "SELECT a.*, s.full_name AS student_name, s.roll_number, s.branch, c.company_name, pd.job_role, pd.salary_package " +
                "FROM applications a " +
                "JOIN students s ON a.student_id = s.student_id " +
                "JOIN placement_drives pd ON a.drive_id = pd.drive_id " +
                "JOIN companies c ON pd.company_id = c.company_id ");
        if (studentId != null) {
            sql.append("WHERE a.student_id = ? ");
        }
        sql.append("ORDER BY a.applied_at DESC");

        List<Application> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            if (studentId != null) ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Application a = new Application();
                    a.setApplicationId(rs.getInt("application_id"));
                    a.setDriveId(rs.getInt("drive_id"));
                    a.setStudentId(rs.getInt("student_id"));
                    a.setStudentName(rs.getString("student_name"));
                    a.setRollNumber(rs.getString("roll_number"));
                    a.setBranch(rs.getString("branch"));
                    a.setCompanyName(rs.getString("company_name"));
                    a.setJobRole(rs.getString("job_role"));
                    a.setSalaryPackage(rs.getDouble("salary_package"));
                    a.setAppliedAt(rs.getTimestamp("applied_at"));
                    a.setStatus(rs.getString("status"));
                    a.setRemarks(rs.getString("remarks"));
                    list.add(a);
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Unable to load applications.", 500, e);
        }
    }

    public boolean exists(int driveId, int studentId) throws PortalException {
        String sql = "SELECT 1 FROM applications WHERE drive_id = ? AND student_id = ? LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, driveId);
            ps.setInt(2, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            throw new PortalException("Error checking duplicate application.", 500, e);
        }
    }

    public Application create(int driveId, int studentId, String remarks) throws PortalException {
        String sql = "INSERT INTO applications (drive_id, student_id, status, remarks) VALUES (?, ?, 'Applied', ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, driveId);
            ps.setInt(2, studentId);
            ps.setString(3, remarks);
            ps.executeUpdate();
            Application app = new Application();
            app.setDriveId(driveId);
            app.setStudentId(studentId);
            app.setStatus("Applied");
            app.setRemarks(remarks);
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) app.setApplicationId(keys.getInt(1));
            }
            return app;
        } catch (SQLIntegrityConstraintViolationException e) {
            throw new PortalException("Student has already applied to this placement drive.", 409, e);
        } catch (SQLException e) {
            throw new PortalException("Failed to submit application.", 500, e);
        }
    }

    public boolean updateStatus(int applicationId, String newStatus, String remarks) throws PortalException {
        String sql = "UPDATE applications SET status = ?, remarks = ? WHERE application_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newStatus);
            ps.setString(2, remarks);
            ps.setInt(3, applicationId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Failed to update application status.", 500, e);
        }
    }
}
