package edu.gcet.placement.dao;

import edu.gcet.placement.model.Placement;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class PlacementDAO {

    public List<Placement> findAll() throws PortalException {
        String sql = "SELECT p.*, s.full_name AS student_name, s.roll_number, s.branch, c.company_name " +
                     "FROM placements p " +
                     "JOIN students s ON p.student_id = s.student_id " +
                     "JOIN companies c ON p.company_id = c.company_id " +
                     "ORDER BY p.offer_date DESC";
        List<Placement> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Placement p = new Placement();
                p.setPlacementId(rs.getInt("placement_id"));
                p.setStudentId(rs.getInt("student_id"));
                p.setStudentName(rs.getString("student_name"));
                p.setRollNumber(rs.getString("roll_number"));
                p.setBranch(rs.getString("branch"));
                p.setDriveId(rs.getInt("drive_id"));
                p.setCompanyId(rs.getInt("company_id"));
                p.setCompanyName(rs.getString("company_name"));
                p.setJobRole(rs.getString("job_role"));
                p.setPackageLpa(rs.getDouble("package_lpa"));
                p.setOfferDate(rs.getDate("offer_date"));
                p.setJoiningStatus(rs.getString("joining_status"));
                list.add(p);
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error fetching placement records.", 500, e);
        }
    }

    public Placement recordPlacement(Placement p) throws PortalException {
        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);

            String insertSql = "INSERT INTO placements (student_id, drive_id, company_id, job_role, package_lpa, offer_date, joining_status) " +
                               "VALUES (?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, p.getStudentId());
                ps.setInt(2, p.getDriveId());
                ps.setInt(3, p.getCompanyId());
                ps.setString(4, p.getJobRole());
                ps.setDouble(5, p.getPackageLpa());
                ps.setDate(6, p.getOfferDate());
                ps.setString(7, p.getJoiningStatus());
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) p.setPlacementId(keys.getInt(1));
                }
            }

            try (PreparedStatement upd = conn.prepareStatement("UPDATE students SET placement_status = 'Placed' WHERE student_id = ?")) {
                upd.setInt(1, p.getStudentId());
                upd.executeUpdate();
            }

            conn.commit();
            return p;
        } catch (SQLIntegrityConstraintViolationException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Placement offer already recorded for this student and drive.", 409, e);
        } catch (SQLException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Unable to record placement.", 500, e);
        } finally {
            DatabaseConnection.closeQuietly(conn);
        }
    }

    public boolean updateJoiningStatus(int placementId, String joiningStatus) throws PortalException {
        String sql = "UPDATE placements SET joining_status = ? WHERE placement_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, joiningStatus);
            ps.setInt(2, placementId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Failed to update joining status.", 500, e);
        }
    }
}
