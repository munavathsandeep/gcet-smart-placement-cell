package edu.gcet.placement.model;

import java.sql.Date;
import java.util.ArrayList;
import java.util.List;

public class PlacementDrive implements Identifiable {
    public static class RequiredSkill {
        private int skillId;
        private String skillName;
        private int requiredLevel;
        private double weightage;

        public RequiredSkill() {}
        public RequiredSkill(int skillId, String skillName, int requiredLevel, double weightage) {
            this.skillId = skillId;
            this.skillName = skillName;
            this.requiredLevel = requiredLevel;
            this.weightage = weightage;
        }
        public int getSkillId() { return skillId; }
        public void setSkillId(int skillId) { this.skillId = skillId; }
        public String getSkillName() { return skillName; }
        public void setSkillName(String skillName) { this.skillName = skillName; }
        public int getRequiredLevel() { return requiredLevel; }
        public void setRequiredLevel(int requiredLevel) { this.requiredLevel = requiredLevel; }
        public double getWeightage() { return weightage; }
        public void setWeightage(double weightage) { this.weightage = weightage; }
    }

    private int driveId;
    private int companyId;
    private String companyName;
    private String jobRole;
    private String jobDescription;
    private String jobLocation;
    private String jobType; // On-Campus Drive, Full-Time, Internship, Internship + Full-Time, Off-Campus
    private double salaryPackage;
    private String compensationLabel;
    private String applyUrl;
    private Date postedDate;
    private Date driveDate;
    private Date applicationDeadline;
    private String driveStatus; // Planned, Active, Completed, Cancelled
    private String approvalStatus; // Approved, Pending, Rejected
    private double minCgpa;
    private String eligibleBranches;
    private int graduationYear;
    private int maxBacklogs;
    private String otherCriteria;
    private List<RequiredSkill> requiredSkills = new ArrayList<>();

    public PlacementDrive() {
        this.jobLocation = "Hyderabad";
        this.jobType = "On-Campus Drive";
        this.approvalStatus = "Approved";
    }

    @Override public int getId() { return driveId; }
    @Override public void setId(int id) { this.driveId = id; }

    public int getDriveId() { return driveId; }
    public void setDriveId(int driveId) { this.driveId = driveId; }
    public int getCompanyId() { return companyId; }
    public void setCompanyId(int companyId) { this.companyId = companyId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getJobRole() { return jobRole; }
    public void setJobRole(String jobRole) { this.jobRole = jobRole; }
    public String getJobDescription() { return jobDescription; }
    public void setJobDescription(String jobDescription) { this.jobDescription = jobDescription; }
    public String getJobLocation() { return jobLocation; }
    public void setJobLocation(String jobLocation) { this.jobLocation = jobLocation; }
    public String getJobType() { return jobType; }
    public void setJobType(String jobType) { this.jobType = jobType; }
    public double getSalaryPackage() { return salaryPackage; }
    public void setSalaryPackage(double salaryPackage) { this.salaryPackage = salaryPackage; }
    public String getCompensationLabel() { return compensationLabel; }
    public void setCompensationLabel(String compensationLabel) { this.compensationLabel = compensationLabel; }
    public String getApplyUrl() { return applyUrl; }
    public void setApplyUrl(String applyUrl) { this.applyUrl = applyUrl; }
    public Date getPostedDate() { return postedDate; }
    public void setPostedDate(Date postedDate) { this.postedDate = postedDate; }
    public Date getDriveDate() { return driveDate; }
    public void setDriveDate(Date driveDate) { this.driveDate = driveDate; }
    public Date getApplicationDeadline() { return applicationDeadline; }
    public void setApplicationDeadline(Date applicationDeadline) { this.applicationDeadline = applicationDeadline; }
    public String getDriveStatus() { return driveStatus; }
    public void setDriveStatus(String driveStatus) { this.driveStatus = driveStatus; }
    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }
    public double getMinCgpa() { return minCgpa; }
    public void setMinCgpa(double minCgpa) { this.minCgpa = minCgpa; }
    public String getEligibleBranches() { return eligibleBranches; }
    public void setEligibleBranches(String eligibleBranches) { this.eligibleBranches = eligibleBranches; }
    public int getGraduationYear() { return graduationYear; }
    public void setGraduationYear(int graduationYear) { this.graduationYear = graduationYear; }
    public int getMaxBacklogs() { return maxBacklogs; }
    public void setMaxBacklogs(int maxBacklogs) { this.maxBacklogs = maxBacklogs; }
    public String getOtherCriteria() { return otherCriteria; }
    public void setOtherCriteria(String otherCriteria) { this.otherCriteria = otherCriteria; }
    public List<RequiredSkill> getRequiredSkills() { return requiredSkills; }
    public void setRequiredSkills(List<RequiredSkill> requiredSkills) { this.requiredSkills = requiredSkills; }
}
