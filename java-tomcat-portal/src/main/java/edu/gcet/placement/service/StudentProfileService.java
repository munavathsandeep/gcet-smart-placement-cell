package edu.gcet.placement.service;

import com.google.gson.reflect.TypeToken;
import edu.gcet.placement.dao.ProfileApprovalDAO;
import edu.gcet.placement.dao.ProfileSubmissionDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.dao.StudentProfileDAO;
import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;

import java.lang.reflect.Type;
import java.net.URI;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Year;
import java.util.*;

/**
 * Business service governing Student Profile Dossier retrieval, validation,
 * draft saving, diff computation, and Faculty Approval submission.
 */
public class StudentProfileService {
    private static final Type MAP_TYPE = new TypeToken<Map<String, Object>>() {}.getType();

    private final StudentDAO studentDAO = new StudentDAO();
    private final StudentProfileDAO studentProfileDAO = new StudentProfileDAO();
    private final ProfileSubmissionDAO submissionDAO = new ProfileSubmissionDAO();
    private final ProfileApprovalDAO approvalDAO = new ProfileApprovalDAO();
    private final NotificationService notificationService = new NotificationService();

    public Map<String, Object> getProfileDossier(int studentId, User actor) throws PortalException {
        Student student = studentDAO.findById(studentId)
                .orElseThrow(() -> new PortalException("Student not found.", 404));

        authorizeView(actor, student);

        StudentProfile ext = studentProfileDAO.findOfficialExtendedProfile(studentId).orElse(new StudentProfile());
        List<Internship> internships = studentProfileDAO.findInternshipsByStudent(studentId);
        Optional<ProfileSubmission> latestSub = submissionDAO.findLatestByStudent(studentId);
        List<ProfileApproval> history = approvalDAO.findHistoryByStudent(studentId);

        Map<String, Object> officialDossier = buildOfficialDossierMap(student, ext, internships);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("studentId", student.getStudentId());
        response.put("officialDossier", officialDossier);
        response.put("latestSubmission", latestSub.orElse(null));
        response.put("approvalHistory", history);
        response.put("assignedFacultyName", latestSub.map(ProfileSubmission::getAssignedFacultyName).orElse(resolveFacultyName(student)));
        return response;
    }

    public ProfileSubmission saveDraft(int studentId, User actor, Map<String, Object> rawPayload) throws PortalException {
        return persistSubmission(studentId, actor, rawPayload, ProfileSubmission.Status.DRAFT);
    }

    public ProfileSubmission submitForApproval(int studentId, User actor, Map<String, Object> rawPayload) throws PortalException {
        return persistSubmission(studentId, actor, rawPayload, ProfileSubmission.Status.WAITING_FOR_APPROVAL);
    }

    @SuppressWarnings("unchecked")
    private ProfileSubmission persistSubmission(int studentId, User actor, Map<String, Object> rawPayload, ProfileSubmission.Status targetStatus)
            throws PortalException {
        Student student = studentDAO.findById(studentId)
                .orElseThrow(() -> new PortalException("Student not found.", 404));

        if (actor.getRole() == User.Role.STUDENT) {
            if (student.getUserId() != actor.getUserId()) {
                throw new PortalException("Access denied: you may only modify your own profile.", 403);
            }
        } else if (!actor.isPlacementAdmin()) {
            throw new PortalException("Only the owning student may edit and submit their profile.", 403);
        }

        validatePayload(rawPayload);

        StudentProfile ext = studentProfileDAO.findOfficialExtendedProfile(studentId).orElse(new StudentProfile());
        List<Internship> internships = studentProfileDAO.findInternshipsByStudent(studentId);
        Map<String, Object> officialDossier = buildOfficialDossierMap(student, ext, internships);

        List<ProfileApproval.DiffDetail> diffs = computeDiffs(officialDossier, rawPayload);
        List<String> changedLabels = new ArrayList<>();
        for (ProfileApproval.DiffDetail d : diffs) {
            changedLabels.add(d.getFieldLabel());
        }

        Integer facultyUserId = resolveAssignedFacultyUserId(student);
        Optional<ProfileSubmission> previous = submissionDAO.findLatestByStudent(studentId);
        String actionType = (targetStatus == ProfileSubmission.Status.DRAFT)
                ? "DRAFT_SAVED"
                : (previous.isPresent() && (previous.get().getStatus() == ProfileSubmission.Status.REJECTED
                || previous.get().getStatus() == ProfileSubmission.Status.CORRECTION_REQUESTED)
                ? "RESUBMITTED"
                : "SUBMITTED");

        ProfileSubmission sub = new ProfileSubmission();
        sub.setSubmissionCode("SUB-" + Year.now().getValue() + "-" + String.format("%04d", new Random().nextInt(9000) + 1000));
        sub.setStudentId(studentId);
        sub.setAssignedFacultyId(facultyUserId);
        sub.setStatus(targetStatus);
        sub.setDraftPayloadJson(JsonUtil.gson().toJson(rawPayload));
        sub.setPreviousSnapshotJson(JsonUtil.gson().toJson(officialDossier));
        sub.setChangedFieldsJson(JsonUtil.gson().toJson(changedLabels));

        int submissionId = submissionDAO.saveOrSubmitSubmission(sub, diffs);
        sub.setSubmissionId(submissionId);
        sub.setDiffDetails(diffs);

        String auditRemark = (targetStatus == ProfileSubmission.Status.DRAFT)
                ? "Saved profile revision draft."
                : "Submitted " + diffs.size() + " modified field(s) for faculty verification.";
        approvalDAO.recordAction(submissionId, studentId, actor.getUserId(), actor.getFullName(), actionType, auditRemark);

        if (targetStatus == ProfileSubmission.Status.WAITING_FOR_APPROVAL) {
            notificationService.notifyUser(
                    student.getUserId(),
                    "Profile Submitted for Faculty Approval",
                    "Your profile changes (" + sub.getSubmissionCode() + ") are awaiting review. Official profile remains active until approved.",
                    "Placement Updates",
                    "profile"
            );
            notificationService.notifyUser(
                    facultyUserId,
                    "Student Profile Pending Verification: " + student.getRollNumber(),
                    student.getFullName() + " (" + student.getBranch() + ") submitted profile updates (" + diffs.size() + " changes).",
                    "System Alerts",
                    "profile-approvals"
            );
        }

        return submissionDAO.findById(submissionId).orElse(sub);
    }

    private void authorizeView(User actor, Student student) throws PortalException {
        if (actor.isPlacementAdmin()) return;
        if (actor.getRole() == User.Role.STUDENT) {
            if (student.getUserId() != actor.getUserId()) {
                throw new PortalException("Access denied: students may only view their own profile dossier.", 403);
            }
            return;
        }
        if (actor.isFacultyRole()) {
            boolean allowed = submissionDAO.isStudentInFacultyScope(actor.getUserId(), actor.getAssignedBranch(), student.getStudentId());
            if (!allowed) {
                throw new PortalException("Access denied: student belongs outside your assigned department/branch.", 403);
            }
            return;
        }
        throw new PortalException("Unauthorized role for profile dossier.", 403);
    }

    @SuppressWarnings("unchecked")
    private void validatePayload(Map<String, Object> payload) throws PortalException {
        if (payload == null) throw new PortalException("Profile payload cannot be empty.", 400);

        Map<String, Object> academic = (Map<String, Object>) payload.get("academic");
        if (academic != null && academic.get("cgpa") != null) {
            double cgpa = Double.parseDouble(String.valueOf(academic.get("cgpa")));
            if (cgpa < 0 || cgpa > 10.0) {
                throw new PortalException("CGPA must be between 0.0 and 10.0.", 400);
            }
        }

        Map<String, Object> social = (Map<String, Object>) payload.get("socialLinks");
        if (social != null) {
            String[] keys = {"linkedin_url", "github_url", "portfolio_url", "personal_website_url",
                    "leetcode_url", "hackerrank_url", "codechef_url", "geeksforgeeks_url"};
            for (String k : keys) {
                Object val = social.get(k);
                if (val != null && !String.valueOf(val).isBlank()) {
                    validateHttpUrl(String.valueOf(val).trim(), k);
                }
            }
        }
    }

    private void validateHttpUrl(String raw, String fieldName) throws PortalException {
        try {
            URI uri = URI.create(raw);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https")) || uri.getHost() == null) {
                throw new PortalException("Invalid HTTP/HTTPS URL in field: " + fieldName, 400);
            }
        } catch (IllegalArgumentException e) {
            throw new PortalException("Malformed URL in field: " + fieldName, 400);
        }
    }

    @SuppressWarnings("unchecked")
    private List<ProfileApproval.DiffDetail> computeDiffs(Map<String, Object> official, Map<String, Object> next) {
        List<ProfileApproval.DiffDetail> diffs = new ArrayList<>();
        compareSection(diffs, "Personal Info", (Map<String, Object>) official.get("personal"), (Map<String, Object>) next.get("personal"));
        compareSection(diffs, "Academic Info", (Map<String, Object>) official.get("academic"), (Map<String, Object>) next.get("academic"));
        compareSection(diffs, "Social & Coding Links", (Map<String, Object>) official.get("socialLinks"), (Map<String, Object>) next.get("socialLinks"));
        return diffs;
    }

    private void compareSection(List<ProfileApproval.DiffDetail> diffs, String sectionName, Map<String, Object> prev, Map<String, Object> next) {
        if (next == null) return;
        for (Map.Entry<String, Object> e : next.entrySet()) {
            String k = e.getKey();
            if ("photo_data_url".equals(k)) continue;
            String oldVal = prev != null && prev.get(k) != null ? String.valueOf(prev.get(k)).trim() : "";
            String newVal = e.getValue() != null ? String.valueOf(e.getValue()).trim() : "";
            if (!oldVal.equals(newVal)) {
                ProfileApproval.DiffDetail d = new ProfileApproval.DiffDetail();
                d.setSectionName(sectionName);
                d.setFieldKey(k);
                d.setFieldLabel(k.replace('_', ' '));
                d.setPreviousValue(oldVal.isEmpty() ? "—" : oldVal);
                d.setNewValue(newVal.isEmpty() ? "—" : newVal);
                diffs.add(d);
            }
        }
    }

    private Map<String, Object> buildOfficialDossierMap(Student s, StudentProfile ext, List<Internship> internships) {
        Map<String, Object> personal = new LinkedHashMap<>();
        personal.put("full_name", s.getFullName());
        personal.put("roll_number", s.getRollNumber());
        personal.put("email", s.getEmail());
        personal.put("phone", s.getPhone());
        personal.put("gender", s.getGender());
        personal.put("address", s.getAddress());
        personal.put("photo_data_url", ext.getPhotoDataUrl());
        personal.put("date_of_birth", ext.getDateOfBirth());
        personal.put("personal_email", ext.getPersonalEmail());
        personal.put("alternate_phone", ext.getAlternatePhone());
        personal.put("city", ext.getCity());
        personal.put("state", ext.getState());
        personal.put("pin_code", ext.getPinCode());

        Map<String, Object> academic = new LinkedHashMap<>();
        academic.put("college_name", ext.getCollegeName());
        academic.put("registration_number", ext.getRegistrationNumber());
        academic.put("branch", s.getBranch());
        academic.put("academic_year", s.getAcademicYear());
        academic.put("year_of_study", s.getYearOfStudy());
        academic.put("semester", s.getSemester());
        academic.put("section", s.getSection());
        academic.put("admission_year", ext.getAdmissionYear());
        academic.put("graduation_year", s.getGraduationYear());
        academic.put("cgpa", s.getCgpa());
        academic.put("percentage", ext.getPercentage());
        academic.put("active_backlogs", s.getActiveBacklogs());
        academic.put("history_of_backlogs", ext.getHistoryOfBacklogs());
        academic.put("tenth_marks", ext.getTenthMarks());
        academic.put("inter_diploma_marks", ext.getInterDiplomaMarks());
        academic.put("university_name", ext.getUniversityName());

        Map<String, Object> social = new LinkedHashMap<>();
        social.put("linkedin_url", ext.getLinkedinUrl());
        social.put("github_url", ext.getGithubUrl());
        social.put("portfolio_url", ext.getPortfolioUrl());
        social.put("personal_website_url", ext.getPersonalWebsiteUrl());
        social.put("leetcode_url", ext.getLeetcodeUrl());
        social.put("hackerrank_url", ext.getHackerrankUrl());
        social.put("codechef_url", ext.getCodechefUrl());
        social.put("geeksforgeeks_url", ext.getGeeksforgeeksUrl());

        Map<String, Object> dossier = new LinkedHashMap<>();
        dossier.put("personal", personal);
        dossier.put("academic", academic);
        dossier.put("skills", s.getSkills());
        dossier.put("projects", s.getProjects());
        dossier.put("certifications", s.getCertifications());
        dossier.put("internships", internships);
        dossier.put("socialLinks", social);
        return dossier;
    }

    private Integer resolveAssignedFacultyUserId(Student student) {
        String sql = "SELECT fsa.faculty_user_id FROM faculty_student_assignments fsa " +
                     "JOIN users u ON fsa.faculty_user_id = u.user_id " +
                     "WHERE fsa.student_id = ? AND u.is_active = TRUE AND LOWER(u.username) <> 'faculty_cse' LIMIT 1";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, student.getStudentId());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
            return new UserDAO().resolveCoordinatorForBranch(conn, student.getBranch());
        } catch (SQLException ignored) {}
        return null;
    }

    private String resolveFacultyName(Student student) {
        Integer fid = resolveAssignedFacultyUserId(student);
        if (fid == null) return "Department Faculty Coordinator";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT full_name FROM users WHERE user_id = ?")) {
            ps.setInt(1, fid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getString(1);
            }
        } catch (SQLException ignored) {}
        return "Department Faculty Coordinator";
    }
}
