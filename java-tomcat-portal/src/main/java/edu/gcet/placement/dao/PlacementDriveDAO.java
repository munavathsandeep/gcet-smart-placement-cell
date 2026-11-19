package edu.gcet.placement.dao;

import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class PlacementDriveDAO implements GenericDAO<PlacementDrive, Integer> {

    @Override
    public Optional<PlacementDrive> findById(Integer id) throws PortalException {
        String sql = "SELECT pd.*, c.company_name, de.min_cgpa, de.eligible_branches, de.graduation_year, de.max_backlogs, de.other_criteria " +
                     "FROM placement_drives pd " +
                     "JOIN companies c ON pd.company_id = c.company_id " +
                     "LEFT JOIN drive_eligibility de ON pd.drive_id = de.drive_id " +
                     "WHERE pd.drive_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    PlacementDrive d = mapDrive(rs);
                    d.setRequiredSkills(loadRequiredSkills(conn, d.getDriveId()));
                    return Optional.of(d);
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new PortalException("Error loading placement drive.", 500, e);
        }
    }

    @Override
    public List<PlacementDrive> findAll() throws PortalException {
        String sql = "SELECT pd.*, c.company_name, de.min_cgpa, de.eligible_branches, de.graduation_year, de.max_backlogs, de.other_criteria " +
                     "FROM placement_drives pd " +
                     "JOIN companies c ON pd.company_id = c.company_id " +
                     "LEFT JOIN drive_eligibility de ON pd.drive_id = de.drive_id " +
                     "ORDER BY pd.drive_date DESC";
        List<PlacementDrive> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                PlacementDrive d = mapDrive(rs);
                d.setRequiredSkills(loadRequiredSkills(conn, d.getDriveId()));
                list.add(d);
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error loading placement drives.", 500, e);
        }
    }

    @Override
    public PlacementDrive save(PlacementDrive d) throws PortalException {
        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);

            String insertDrive = "INSERT INTO placement_drives (company_id, job_role, job_description, job_location, job_type, " +
                                 "salary_package, compensation_label, apply_url, posted_date, drive_date, application_deadline, drive_status) " +
                                 "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(insertDrive, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, d.getCompanyId());
                ps.setString(2, d.getJobRole());
                ps.setString(3, d.getJobDescription());
                ps.setString(4, d.getJobLocation() == null ? "Hyderabad" : d.getJobLocation());
                ps.setString(5, d.getJobType() == null ? "On-Campus Drive" : d.getJobType());
                ps.setDouble(6, d.getSalaryPackage());
                ps.setString(7, d.getCompensationLabel());
                ps.setString(8, d.getApplyUrl());
                ps.setDate(9, d.getPostedDate() == null ? new Date(System.currentTimeMillis()) : d.getPostedDate());
                ps.setDate(10, d.getDriveDate());
                ps.setDate(11, d.getApplicationDeadline());
                ps.setString(12, d.getDriveStatus());
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) d.setDriveId(keys.getInt(1));
                }
            }

            String insertElig = "INSERT INTO drive_eligibility (drive_id, min_cgpa, eligible_branches, graduation_year, max_backlogs, other_criteria) VALUES (?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(insertElig)) {
                ps.setInt(1, d.getDriveId());
                ps.setDouble(2, d.getMinCgpa());
                ps.setString(3, d.getEligibleBranches());
                ps.setInt(4, d.getGraduationYear());
                ps.setInt(5, d.getMaxBacklogs());
                ps.setString(6, d.getOtherCriteria());
                ps.executeUpdate();
            }

            saveRequiredSkills(conn, d);
            conn.commit();
            return d;
        } catch (SQLException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Failed to create placement drive.", 500, e);
        } finally {
            DatabaseConnection.closeQuietly(conn);
        }
    }

    @Override
    public boolean update(PlacementDrive d) throws PortalException {
        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);

            String updDrive = "UPDATE placement_drives SET company_id=?, job_role=?, job_description=?, job_location=?, job_type=?, " +
                              "salary_package=?, compensation_label=?, apply_url=?, drive_date=?, application_deadline=?, drive_status=? WHERE drive_id=?";
            try (PreparedStatement ps = conn.prepareStatement(updDrive)) {
                ps.setInt(1, d.getCompanyId());
                ps.setString(2, d.getJobRole());
                ps.setString(3, d.getJobDescription());
                ps.setString(4, d.getJobLocation());
                ps.setString(5, d.getJobType());
                ps.setDouble(6, d.getSalaryPackage());
                ps.setString(7, d.getCompensationLabel());
                ps.setString(8, d.getApplyUrl());
                ps.setDate(9, d.getDriveDate());
                ps.setDate(10, d.getApplicationDeadline());
                ps.setString(11, d.getDriveStatus());
                ps.setInt(12, d.getDriveId());
                ps.executeUpdate();
            }

            String updElig = "UPDATE drive_eligibility SET min_cgpa=?, eligible_branches=?, graduation_year=?, max_backlogs=?, other_criteria=? WHERE drive_id=?";
            try (PreparedStatement ps = conn.prepareStatement(updElig)) {
                ps.setDouble(1, d.getMinCgpa());
                ps.setString(2, d.getEligibleBranches());
                ps.setInt(3, d.getGraduationYear());
                ps.setInt(4, d.getMaxBacklogs());
                ps.setString(5, d.getOtherCriteria());
                ps.setInt(6, d.getDriveId());
                ps.executeUpdate();
            }

            try (PreparedStatement del = conn.prepareStatement("DELETE FROM drive_required_skills WHERE drive_id = ?")) {
                del.setInt(1, d.getDriveId());
                del.executeUpdate();
            }
            saveRequiredSkills(conn, d);
            conn.commit();
            return true;
        } catch (SQLException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Failed to update placement drive.", 500, e);
        } finally {
            DatabaseConnection.closeQuietly(conn);
        }
    }

    @Override
    public boolean deleteById(Integer id) throws PortalException {
        String sql = "DELETE FROM placement_drives WHERE drive_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Failed to delete placement drive.", 500, e);
        }
    }

    private void saveRequiredSkills(Connection conn, PlacementDrive d) throws SQLException {
        if (d.getRequiredSkills() == null || d.getRequiredSkills().isEmpty()) return;
        String sql = "INSERT INTO drive_required_skills (drive_id, skill_id, required_level, weightage) VALUES (?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (PlacementDrive.RequiredSkill rs : d.getRequiredSkills()) {
                ps.setInt(1, d.getDriveId());
                ps.setInt(2, rs.getSkillId());
                ps.setInt(3, rs.getRequiredLevel());
                ps.setDouble(4, rs.getWeightage() > 0 ? rs.getWeightage() : 1.0);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private List<PlacementDrive.RequiredSkill> loadRequiredSkills(Connection conn, int driveId) throws SQLException {
        String sql = "SELECT drs.skill_id, s.skill_name, drs.required_level, drs.weightage " +
                     "FROM drive_required_skills drs JOIN skills s ON drs.skill_id = s.skill_id WHERE drs.drive_id = ?";
        List<PlacementDrive.RequiredSkill> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, driveId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new PlacementDrive.RequiredSkill(
                            rs.getInt("skill_id"),
                            rs.getString("skill_name"),
                            rs.getInt("required_level"),
                            rs.getDouble("weightage")));
                }
            }
        }
        return list;
    }

    private PlacementDrive mapDrive(ResultSet rs) throws SQLException {
        PlacementDrive d = new PlacementDrive();
        d.setDriveId(rs.getInt("drive_id"));
        d.setCompanyId(rs.getInt("company_id"));
        d.setCompanyName(rs.getString("company_name"));
        d.setJobRole(rs.getString("job_role"));
        d.setJobDescription(rs.getString("job_description"));
        d.setJobLocation(rs.getString("job_location"));
        d.setJobType(rs.getString("job_type"));
        d.setSalaryPackage(rs.getDouble("salary_package"));
        d.setCompensationLabel(rs.getString("compensation_label"));
        d.setApplyUrl(rs.getString("apply_url"));
        d.setPostedDate(rs.getDate("posted_date"));
        d.setDriveDate(rs.getDate("drive_date"));
        d.setApplicationDeadline(rs.getDate("application_deadline"));
        d.setDriveStatus(rs.getString("drive_status"));
        d.setMinCgpa(rs.getDouble("min_cgpa"));
        d.setEligibleBranches(rs.getString("eligible_branches"));
        d.setGraduationYear(rs.getInt("graduation_year"));
        d.setMaxBacklogs(rs.getInt("max_backlogs"));
        d.setOtherCriteria(rs.getString("other_criteria"));
        return d;
    }
}
