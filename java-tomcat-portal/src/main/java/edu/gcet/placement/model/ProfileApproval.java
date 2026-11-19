package edu.gcet.placement.model;

import java.sql.Timestamp;

/**
 * Audit history entry and field-level comparison diff item for Faculty Profile Approval Workflow.
 */
public class ProfileApproval implements Identifiable {
    private int historyId;
    private int submissionId;
    private String submissionCode;
    private int studentId;
    private Integer facultyUserId;
    private String facultyName;
    private String action; // DRAFT_SAVED, SUBMITTED, RESUBMITTED, APPROVED, REJECTED, CORRECTION_REQUESTED
    private String remarks;
    private Timestamp actionAt;

    public static class DiffDetail {
        private int detailId;
        private int submissionId;
        private String sectionName;
        private String fieldKey;
        private String fieldLabel;
        private String previousValue;
        private String newValue;
        private boolean changed = true;

        public int getDetailId() { return detailId; }
        public void setDetailId(int detailId) { this.detailId = detailId; }
        public int getSubmissionId() { return submissionId; }
        public void setSubmissionId(int submissionId) { this.submissionId = submissionId; }
        public String getSectionName() { return sectionName; }
        public void setSectionName(String sectionName) { this.sectionName = sectionName; }
        public String getFieldKey() { return fieldKey; }
        public void setFieldKey(String fieldKey) { this.fieldKey = fieldKey; }
        public String getFieldLabel() { return fieldLabel; }
        public void setFieldLabel(String fieldLabel) { this.fieldLabel = fieldLabel; }
        public String getPreviousValue() { return previousValue; }
        public void setPreviousValue(String previousValue) { this.previousValue = previousValue; }
        public String getNewValue() { return newValue; }
        public void setNewValue(String newValue) { this.newValue = newValue; }
        public boolean isChanged() { return changed; }
        public void setChanged(boolean changed) { this.changed = changed; }
    }

    @Override public int getId() { return historyId; }
    @Override public void setId(int id) { this.historyId = id; }

    public int getHistoryId() { return historyId; }
    public void setHistoryId(int historyId) { this.historyId = historyId; }
    public int getSubmissionId() { return submissionId; }
    public void setSubmissionId(int submissionId) { this.submissionId = submissionId; }
    public String getSubmissionCode() { return submissionCode; }
    public void setSubmissionCode(String submissionCode) { this.submissionCode = submissionCode; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public Integer getFacultyUserId() { return facultyUserId; }
    public void setFacultyUserId(Integer facultyUserId) { this.facultyUserId = facultyUserId; }
    public String getFacultyName() { return facultyName; }
    public void setFacultyName(String facultyName) { this.facultyName = facultyName; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public Timestamp getActionAt() { return actionAt; }
    public void setActionAt(Timestamp actionAt) { this.actionAt = actionAt; }
}
