package edu.gcet.placement.dao;

import edu.gcet.placement.model.Company;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class CompanyDAO implements GenericDAO<Company, Integer> {

    @Override
    public Optional<Company> findById(Integer id) throws PortalException {
        String sql = "SELECT c.*, cc.contact_person, cc.contact_email, cc.contact_phone " +
                     "FROM companies c LEFT JOIN company_contacts cc ON c.company_id = cc.company_id AND cc.is_primary = TRUE " +
                     "WHERE c.company_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapCompany(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PortalException("Unable to load company record.", 500, e);
        }
    }

    @Override
    public List<Company> findAll() throws PortalException {
        return search("");
    }

    public List<Company> search(String query) throws PortalException {
        String sql = "SELECT c.*, cc.contact_person, cc.contact_email, cc.contact_phone " +
                     "FROM companies c LEFT JOIN company_contacts cc ON c.company_id = cc.company_id AND cc.is_primary = TRUE " +
                     "WHERE c.company_name LIKE ? OR c.industry LIKE ? OR c.headquarters LIKE ? ORDER BY c.company_name ASC";
        String like = "%" + (query == null ? "" : query.trim()) + "%";
        List<Company> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, like);
            ps.setString(2, like);
            ps.setString(3, like);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapCompany(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Unable to search companies.", 500, e);
        }
    }

    @Override
    public Company save(Company c) throws PortalException {
        Connection conn = null;
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);
            String sql = "INSERT INTO companies (company_name, logo_url, industry, official_website, career_page_url, headquarters, description, is_directory_reference) " +
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, c.getCompanyName());
                ps.setString(2, c.getLogoUrl());
                ps.setString(3, c.getIndustry());
                ps.setString(4, c.getOfficialWebsite());
                ps.setString(5, c.getCareerPageUrl());
                ps.setString(6, c.getHeadquarters());
                ps.setString(7, c.getDescription());
                ps.setBoolean(8, c.isDirectoryReference());
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) c.setCompanyId(keys.getInt(1));
                }
            }
            if (c.getContactPerson() != null && !c.getContactPerson().isBlank()) {
                String cSql = "INSERT INTO company_contacts (company_id, contact_person, contact_email, contact_phone, is_primary) VALUES (?, ?, ?, ?, TRUE)";
                try (PreparedStatement ps = conn.prepareStatement(cSql)) {
                    ps.setInt(1, c.getCompanyId());
                    ps.setString(2, c.getContactPerson());
                    ps.setString(3, c.getContactEmail());
                    ps.setString(4, c.getContactPhone());
                    ps.executeUpdate();
                }
            }
            conn.commit();
            return c;
        } catch (SQLIntegrityConstraintViolationException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Company with this name is already registered.", 409, e);
        } catch (SQLException e) {
            DatabaseConnection.rollbackQuietly(conn);
            throw new PortalException("Unable to register company.", 500, e);
        } finally {
            DatabaseConnection.closeQuietly(conn);
        }
    }

    @Override
    public boolean update(Company c) throws PortalException {
        String sql = "UPDATE companies SET company_name=?, logo_url=?, industry=?, official_website=?, career_page_url=?, headquarters=?, description=? WHERE company_id=?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, c.getCompanyName());
            ps.setString(2, c.getLogoUrl());
            ps.setString(3, c.getIndustry());
            ps.setString(4, c.getOfficialWebsite());
            ps.setString(5, c.getCareerPageUrl());
            ps.setString(6, c.getHeadquarters());
            ps.setString(7, c.getDescription());
            ps.setInt(8, c.getCompanyId());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Unable to update company details.", 500, e);
        }
    }

    @Override
    public boolean deleteById(Integer id) throws PortalException {
        String sql = "DELETE FROM companies WHERE company_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Unable to delete company record.", 500, e);
        }
    }

    private Company mapCompany(ResultSet rs) throws SQLException {
        Company c = new Company();
        c.setCompanyId(rs.getInt("company_id"));
        c.setCompanyName(rs.getString("company_name"));
        c.setLogoUrl(rs.getString("logo_url"));
        c.setIndustry(rs.getString("industry"));
        c.setOfficialWebsite(rs.getString("official_website"));
        c.setCareerPageUrl(rs.getString("career_page_url"));
        c.setHeadquarters(rs.getString("headquarters"));
        c.setDescription(rs.getString("description"));
        c.setDirectoryReference(rs.getBoolean("is_directory_reference"));
        c.setContactPerson(rs.getString("contact_person"));
        c.setContactEmail(rs.getString("contact_email"));
        c.setContactPhone(rs.getString("contact_phone"));
        c.setCreatedAt(rs.getTimestamp("created_at"));
        return c;
    }
}
