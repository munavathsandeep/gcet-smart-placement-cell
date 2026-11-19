package edu.gcet.placement.dao;

import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class StudentDAO implements GenericDAO<Student, Integer> {

    @Override
    public Optional<Student> findById(Integer id) throws PortalException {
        String sql = "SELECT s.*, d.dept_code FROM students s JOIN departments d ON s.dept_id = d.dept_id WHERE s.student_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Student student = mapStudent(rs);
                    student.setSkills(loadStudentSkills(conn, student.getStudentId()));
                    student.setProjects(loadProjects(conn, student.getStudentId()));
                    student.setCertifications(loadCertifications(conn, student.getStudentId()));
                    return Optional.of(student);
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new PortalException("Error retrieving student profile.", 500, e);
        }
    }

    public Optional<Student> findByUserId(int userId) throws PortalException {
        String sql = "SELECT student_id FROM students WHERE user_id = ? LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return findById(rs.getInt("student_id"));
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new PortalException("Error resolving student account.", 500, e);
        }
    }

    @Override
    public List<Student> findAll() throws PortalException {
        return searchAndFilter("", "", "", null, null, null, null, null);
    }

    public List<Student> searchAndFilter(String query, String branchCode, String deptId,
                                         Integer gradYear, Double minCgpa,
                                         String academicYear, Integer semester, String section) throws PortalException {
        StringBuilder sql = new StringBuilder(
                "SELECT s.*, d.dept_code FROM students s JOIN departments d ON s.dept_id = d.dept_id WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (query != null && !query.isBlank()) {
            sql.append("AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?) ");
            String like = "%" + query.trim() + "%";
            params.add(like);
            params.add(like);
            params.add(like);
        }
        if (branchCode != null && !branchCode.isBlank()) {
            sql.append("AND s.branch_code = ? ");
            params.add(branchCode.trim());
        }
        if (deptId != null && !deptId.isBlank()) {
            sql.append("AND s.dept_id = ? ");
            params.add(Integer.parseInt(deptId.trim()));
        }
        if (gradYear != null && gradYear > 0) {
            sql.append("AND s.graduation_year = ? ");
            params.add(gradYear);
        }
        if (minCgpa != null && minCgpa > 0) {
            sql.append("AND s.cgpa >= ? ");
            params.add(minCgpa);
        }
        if (academicYear != null && !academicYear.isBlank()) {
            sql.append("AND s.academic_year = ? ");
            params.add(academicYear.trim());
        }
        if (semester != null && semester > 0) {
            sql.append("AND s.semester = ? ");
            params.add(semester);
        }
        if (section != null && !section.isBlank()) {
            sql.append("AND s.section = ? ");
            params.add(section.trim());
        }
        sql.append("ORDER BY s.cgpa DESC, s.roll_number ASC");

        List<Student> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Student st = mapStudent(rs);
                    st.setSkills(loadStudentSkills(conn, st.getStudentId()));
                    list.add(st);
                }
            }
            return list;
        } catch (SQLException e) {
            throw new PortalException("Error querying student directory.", 500, e);
        }
    }

    public List<Student> searchAndFilterForFaculty(String query, String branchCode, String deptId,
                                                   Integer gradYear, Double minCgpa,
                                                   String academicYear, Integer semester, String section,
                                                   List<String> allowedBranches) throws PortalException {
        if (branchCode != null && !branchCode.isBlank() && !UserDAO.branchMatchesScope(branchCode, allowedBranches)) {
            throw new PortalException("Access denied: branch \"" + branchCode + "\" is outside your assigned department scope.", 403);
        }
        List<Student> all = searchAndFilter(query, "", deptId, gradYear, minCgpa, academicYear, semester, section);
        List<Student> scoped = new ArrayList<>();
        for (Student st : all) {
            if (!UserDAO.branchMatchesScope(st.getBranch(), allowedBranches)) continue;
            if (branchCode != null && !branchCode.isBlank() && !UserDAO.branchMatchesScope(st.getBranch(), List.of(branchCode))) {
                continue;
            }
            scoped.add(st);
        }
        return scoped;
    }

    @Override
    public Student save(Student s) throws PortalException {
        String sql = "INSERT INTO students (user_id, roll_number, full_name, email, phone, dept_id, branch_id, branch_code, " +
                     "academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, " +
                     "gender, address, resume_url, profile_photo_url, placement_status) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            if (s.getUserId() > 0) ps.setInt(1, s.getUserId()); else ps.setNull(1, Types.INTEGER);
            ps.setString(2, s.getRollNumber().toUpperCase());
            ps.setString(3, s.getFullName());
            ps.setString(4, s.getEmail());
            ps.setString(5, s.getPhone());
            ps.setInt(6, s.getDeptId());
            ps.setInt(7, s.getBranchId());
            ps.setString(8, s.getBranch());
            ps.setString(9, s.getAcademicYear() == null ? "2026-27" : s.getAcademicYear());
            ps.setInt(10, s.getYearOfStudy() > 0 ? s.getYearOfStudy() : 4);
            ps.setInt(11, s.getSemester() > 0 ? s.getSemester() : 7);
            ps.setString(12, s.getSection() == null ? "A" : s.getSection());
            ps.setInt(13, s.getGraduationYear());
            ps.setDouble(14, s.getCgpa());
            ps.setInt(15, s.getActiveBacklogs());
            ps.setString(16, s.getGender());
            ps.setString(17, s.getAddress());
            ps.setString(18, s.getResumeUrl());
            ps.setString(19, s.getProfilePhotoUrl());
            ps.setString(20, s.getPlacementStatus() == null ? "Unplaced" : s.getPlacementStatus());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    s.setStudentId(keys.getInt(1));
                }
            }
            if (s.getStudentId() > 0) {
                new UserDAO().autoAssignStudentToCoordinator(conn, s.getStudentId(), s.getBranch(), s.getSection());
            }
            return s;
        } catch (SQLIntegrityConstraintViolationException e) {
            throw new PortalException("A student with this roll number or email already exists.", 409, e);
        } catch (SQLException e) {
            throw new PortalException("Unable to create student record.", 500, e);
        }
    }

    @Override
    public boolean update(Student s) throws PortalException {
        String sql = "UPDATE students SET full_name=?, email=?, phone=?, dept_id=?, branch_id=?, branch_code=?, " +
                     "academic_year=?, year_of_study=?, semester=?, section=?, graduation_year=?, cgpa=?, active_backlogs=?, " +
                     "gender=?, address=?, resume_url=?, placement_status=? WHERE student_id=?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, s.getFullName());
            ps.setString(2, s.getEmail());
            ps.setString(3, s.getPhone());
            ps.setInt(4, s.getDeptId());
            ps.setInt(5, s.getBranchId());
            ps.setString(6, s.getBranch());
            ps.setString(7, s.getAcademicYear());
            ps.setInt(8, s.getYearOfStudy());
            ps.setInt(9, s.getSemester());
            ps.setString(10, s.getSection());
            ps.setInt(11, s.getGraduationYear());
            ps.setDouble(12, s.getCgpa());
            ps.setInt(13, s.getActiveBacklogs());
            ps.setString(14, s.getGender());
            ps.setString(15, s.getAddress());
            ps.setString(16, s.getResumeUrl());
            ps.setString(17, s.getPlacementStatus());
            ps.setInt(18, s.getStudentId());
            boolean updated = ps.executeUpdate() > 0;
            if (updated) {
                new UserDAO().autoAssignStudentToCoordinator(conn, s.getStudentId(), s.getBranch(), s.getSection());
            }
            return updated;
        } catch (SQLIntegrityConstraintViolationException e) {
            throw new PortalException("Email or roll number conflicts with another student.", 409, e);
        } catch (SQLException e) {
            throw new PortalException("Unable to update student record.", 500, e);
        }
    }

    @Override
    public boolean deleteById(Integer id) throws PortalException {
        String sql = "DELETE FROM students WHERE student_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new PortalException("Unable to delete student record.", 500, e);
        }
    }

    private List<StudentSkill> loadStudentSkills(Connection conn, int studentId) throws SQLException {
        String sql = "SELECT ss.student_skill_id, ss.student_id, ss.skill_id, sk.skill_name, sk.category, ss.proficiency_level, ss.verified " +
                     "FROM student_skills ss JOIN skills sk ON ss.skill_id = sk.skill_id WHERE ss.student_id = ? ORDER BY ss.proficiency_level DESC";
        List<StudentSkill> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
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
        }
        return list;
    }

    private List<Project> loadProjects(Connection conn, int studentId) throws SQLException {
        String sql = "SELECT * FROM projects WHERE student_id = ? ORDER BY created_at DESC";
        List<Project> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Project p = new Project();
                    p.setProjectId(rs.getInt("project_id"));
                    p.setStudentId(rs.getInt("student_id"));
                    p.setTitle(rs.getString("title"));
                    p.setTechStack(rs.getString("tech_stack"));
                    p.setDescription(rs.getString("description"));
                    p.setRepoUrl(rs.getString("repo_url"));
                    list.add(p);
                }
            }
        }
        return list;
    }

    private List<Certification> loadCertifications(Connection conn, int studentId) throws SQLException {
        String sql = "SELECT * FROM certifications WHERE student_id = ? ORDER BY issue_date DESC";
        List<Certification> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Certification c = new Certification();
                    c.setCertId(rs.getInt("cert_id"));
                    c.setStudentId(rs.getInt("student_id"));
                    c.setCertName(rs.getString("cert_name"));
                    c.setIssuingOrg(rs.getString("issuing_org"));
                    c.setIssueDate(rs.getDate("issue_date"));
                    c.setCredentialId(rs.getString("credential_id"));
                    list.add(c);
                }
            }
        }
        return list;
    }

    private Student mapStudent(ResultSet rs) throws SQLException {
        Student s = new Student();
        s.setStudentId(rs.getInt("student_id"));
        s.setUserId(rs.getInt("user_id"));
        s.setRollNumber(rs.getString("roll_number"));
        s.setFullName(rs.getString("full_name"));
        s.setEmail(rs.getString("email"));
        s.setPhone(rs.getString("phone"));
        s.setDeptId(rs.getInt("dept_id"));
        s.setBranchId(rs.getInt("branch_id"));
        s.setBranch(rs.getString("branch_code"));
        s.setAcademicYear(rs.getString("academic_year"));
        s.setYearOfStudy(rs.getInt("year_of_study"));
        s.setSemester(rs.getInt("semester"));
        s.setSection(rs.getString("section"));
        s.setGraduationYear(rs.getInt("graduation_year"));
        s.setCgpa(rs.getDouble("cgpa"));
        s.setActiveBacklogs(rs.getInt("active_backlogs"));
        s.setGender(rs.getString("gender"));
        s.setAddress(rs.getString("address"));
        s.setResumeUrl(rs.getString("resume_url"));
        s.setProfilePhotoUrl(rs.getString("profile_photo_url"));
        s.setPlacementStatus(rs.getString("placement_status"));
        return s;
    }
}
