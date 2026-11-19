package edu.gcet.placement.model;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * Staged Student Profile Revision Submission awaiting Faculty Coordinator review.
 */
public class ProfileSubmission implements Identifiable {
    public enum Status {
        DRAFT, WAITING_FOR_APPROVAL, APPROVED, REJECTED, CORRECTION_REQUESTED
    }

    private int submissionId;
    private String submissionCode;
    private int studentId;
    private String studentName;
    private String rollNumber;
    private String branch;
    private String section;
    private Integer assignedFacultyId;
    private String assignedFacultyName;
    private Status status = Status.DRAFT;
    private String draftPayloadJson;
    private String previousSnapshotJson;
    private String changedFieldsJson;
    private Timestamp submittedAt;
    private Integer reviewedBy;
    private String reviewedByName;
    private Timestamp reviewedAt;
    private String facultyRemarks;
    private List<ProfileApproval.DiffDetail> diffDetails = new ArrayList<>();

    @Override public int getId() { return submissionId; }
    @Override public void setId(int id) { this.submissionId = id; }

    public int getSubmissionId() { return submissionId; }
    public void setSubmissionId(int submissionId) { this.submissionId = submissionId; }
    public String getSubmissionCode() { return submissionCode; }
    public void setSubmissionCode(String submissionCode) { this.submissionCode = submissionCode; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }
    public Integer getAssignedFacultyId() { return assignedFacultyId; }
    public void setAssignedFacultyId(Integer assignedFacultyId) { this.assignedFacultyId = assignedFacultyId; }
    public String getAssignedFacultyName() { return assignedFacultyName; }
    public void setAssignedFacultyName(String assignedFacultyName) { this.assignedFacultyName = assignedFacultyName; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getDraftPayloadJson() { return draftPayloadJson; }
    public void setDraftPayloadJson(String draftPayloadJson) { this.draftPayloadJson = draftPayloadJson; }
    public String getPreviousSnapshotJson() { return previousSnapshotJson; }
    public void setPreviousSnapshotJson(String previousSnapshotJson) { this.previousSnapshotJson = previousSnapshotJson; }
    public String getChangedFieldsJson() { return changedFieldsJson; }
    public void setChangedFieldsJson(String changedFieldsJson) { this.changedFieldsJson = changedFieldsJson; }
    public Timestamp getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Timestamp submittedAt) { this.submittedAt = submittedAt; }
    public Integer getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Integer reviewedBy) { this.reviewedBy = reviewedBy; }
    public String getReviewedByName() { return reviewedByName; }
    public void setReviewedByName(String reviewedByName) { this.reviewedByName = reviewedByName; }
    public Timestamp getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Timestamp reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getFacultyRemarks() { return facultyRemarks; }
    public void setFacultyRemarks(String facultyRemarks) { this.facultyRemarks = facultyRemarks; }
    public List<ProfileApproval.DiffDetail> getDiffDetails() { return diffDetails; }
    public void setDiffDetails(List<ProfileApproval.DiffDetail> diffDetails) { this.diffDetails = diffDetails; }
}
