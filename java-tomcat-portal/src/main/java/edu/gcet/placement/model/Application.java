package edu.gcet.placement.model;

import java.sql.Timestamp;

public class Application implements Identifiable {
    private int applicationId;
    private int driveId;
    private int studentId;
    private String studentName;
    private String rollNumber;
    private String branch;
    private String companyName;
    private String jobRole;
    private double salaryPackage;
    private Timestamp appliedAt;
    private String status; // Applied, Shortlisted, Assessment, Interview, Selected, Rejected
    private String interviewDate;
    private String interviewMode;
    private String remarks;

    public Application() {
        this.status = "Applied";
    }

    @Override public int getId() { return applicationId; }
    @Override public void setId(int id) { this.applicationId = id; }

    public int getApplicationId() { return applicationId; }
    public void setApplicationId(int applicationId) { this.applicationId = applicationId; }
    public int getDriveId() { return driveId; }
    public void setDriveId(int driveId) { this.driveId = driveId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getJobRole() { return jobRole; }
    public void setJobRole(String jobRole) { this.jobRole = jobRole; }
    public double getSalaryPackage() { return salaryPackage; }
    public void setSalaryPackage(double salaryPackage) { this.salaryPackage = salaryPackage; }
    public Timestamp getAppliedAt() { return appliedAt; }
    public void setAppliedAt(Timestamp appliedAt) { this.appliedAt = appliedAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getInterviewDate() { return interviewDate; }
    public void setInterviewDate(String interviewDate) { this.interviewDate = interviewDate; }
    public String getInterviewMode() { return interviewMode; }
    public void setInterviewMode(String interviewMode) { this.interviewMode = interviewMode; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
