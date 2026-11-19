package edu.gcet.placement.dao;

import edu.gcet.placement.model.Skill;
import edu.gcet.placement.model.StudentSkill;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class SkillDAO {

    public List<Skill> findAllSkills() throws PortalException {
        String sql = "SELECT skill_id, skill_name, category, description FROM skills ORDER BY category, skill_name";
        List<Skill> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(new Skill(
                        rs.getInt("skill_id"),
                        rs.getString("skill_name"),
                        rs.getString("category"),
                        rs.getString("description")));
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Failed to fetch skill catalog.", 500, e);
        }
    }

    public List<StudentSkill> findSkillsByStudent(int studentId) throws PortalException {
        String sql = "SELECT ss.student_skill_id, ss.student_id, ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified " +
                     "FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ? ORDER BY s.category, s.skill_name";
        List<StudentSkill> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    StudentSkill ss = new StudentSkill(
                            rs.getInt("student_id"),
                            rs.getInt("skill_id"),
                            rs.getString("skill_name"),
                            rs.getString("category"),
                            rs.getInt("proficiency_level"),
                            rs.getBoolean("verified"));
                    ss.setStudentSkillId(rs.getInt("student_skill_id"));
                    list.add(ss);
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Failed to load student skill matrix.", 500, e);
        }
    }

    public void upsertStudentSkill(int studentId, int skillId, int proficiencyLevel) throws PortalException {
        String sql = "INSERT INTO student_skills (student_id, skill_id, proficiency_level) VALUES (?, ?, ?) " +
                     "ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level), updated_at = CURRENT_TIMESTAMP";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            ps.setInt(2, skillId);
            ps.setInt(3, proficiencyLevel);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new PortalException("Failed to save student skill proficiency.", 500, e);
        }
    }

    public boolean deleteStudentSkill(int studentId, int skillId) throws PortalException {
        String sql = "DELETE FROM student_skills WHERE student_id = ? AND skill_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            ps.setInt(2, skillId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Failed to remove skill from matrix.", 500, e);
        }
    }
}
