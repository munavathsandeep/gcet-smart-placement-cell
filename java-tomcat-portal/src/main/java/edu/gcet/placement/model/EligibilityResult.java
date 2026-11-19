package edu.gcet.placement.model;

import java.util.ArrayList;
import java.util.List;

public class EligibilityResult {
    private int studentId;
    private String studentName;
    private String rollNumber;
    private int driveId;
    private String companyName;
    private String jobRole;
    private boolean eligible;
    private List<String> rejectionReasons = new ArrayList<>();
    private List<String> missingSkills = new ArrayList<>();
    private List<String> metCriteria = new ArrayList<>();

    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public int getDriveId() { return driveId; }
    public void setDriveId(int driveId) { this.driveId = driveId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getJobRole() { return jobRole; }
    public void setJobRole(String jobRole) { this.jobRole = jobRole; }
    public boolean isEligible() { return eligible; }
    public void setEligible(boolean eligible) { this.eligible = eligible; }
    public List<String> getRejectionReasons() { return rejectionReasons; }
    public void setRejectionReasons(List<String> rejectionReasons) { this.rejectionReasons = rejectionReasons; }
    public List<String> getMissingSkills() { return missingSkills; }
    public void setMissingSkills(List<String> missingSkills) { this.missingSkills = missingSkills; }
    public List<String> getMetCriteria() { return metCriteria; }
    public void setMetCriteria(List<String> metCriteria) { this.metCriteria = metCriteria; }
}
