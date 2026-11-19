package edu.gcet.placement.model;

import java.sql.Date;

public class Placement implements Identifiable {
    private int placementId;
    private int studentId;
    private String studentName;
    private String rollNumber;
    private String branch;
    private int driveId;
    private int companyId;
    private String companyName;
    private String jobRole;
    private double packageLpa;
    private Date offerDate;
    private String joiningStatus; // Offered, Accepted, Joined, Declined

    public Placement() {}

    @Override public int getId() { return placementId; }
    @Override public void setId(int id) { this.placementId = id; }

    public int getPlacementId() { return placementId; }
    public void setPlacementId(int placementId) { this.placementId = placementId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public int getDriveId() { return driveId; }
    public void setDriveId(int driveId) { this.driveId = driveId; }
    public int getCompanyId() { return companyId; }
    public void setCompanyId(int companyId) { this.companyId = companyId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getJobRole() { return jobRole; }
    public void setJobRole(String jobRole) { this.jobRole = jobRole; }
    public double getPackageLpa() { return packageLpa; }
    public void setPackageLpa(double packageLpa) { this.packageLpa = packageLpa; }
    public Date getOfferDate() { return offerDate; }
    public void setOfferDate(Date offerDate) { this.offerDate = offerDate; }
    public String getJoiningStatus() { return joiningStatus; }
    public void setJoiningStatus(String joiningStatus) { this.joiningStatus = joiningStatus; }
}
