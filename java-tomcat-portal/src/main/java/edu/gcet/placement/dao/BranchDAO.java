package edu.gcet.placement.dao;

import edu.gcet.placement.model.Branch;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class BranchDAO {

    public List<Branch> findAll() throws PortalException {
        String sql = "SELECT b.*, d.dept_code FROM branches b JOIN departments d ON b.dept_id = d.dept_id ORDER BY b.branch_id ASC";
        List<Branch> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Branch b = new Branch();
                b.setBranchId(rs.getInt("branch_id"));
                b.setDeptId(rs.getInt("dept_id"));
                b.setDeptCode(rs.getString("dept_code"));
                b.setBranchCode(rs.getString("branch_code"));
                b.setBranchName(rs.getString("branch_name"));
                b.setDegreeLevel(rs.getString("degree_level"));
                b.setActive(rs.getBoolean("is_active"));
                list.add(b);
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error loading GCET branches.", 500, e);
        }
    }

    public Branch save(Branch b) throws PortalException {
        String sql = "INSERT INTO branches (dept_id, branch_code, branch_name, degree_level, is_active) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, b.getDeptId());
            ps.setString(2, b.getBranchCode());
            ps.setString(3, b.getBranchName());
            ps.setString(4, b.getDegreeLevel());
            ps.setBoolean(5, b.isActive());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) b.setBranchId(keys.getInt(1));
            }
            return b;
        } catch (SQLException e) {
            throw new PortalException("Unable to create branch.", 500, e);
        }
    }
}
