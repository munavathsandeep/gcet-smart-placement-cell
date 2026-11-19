package edu.gcet.placement.model;

import java.sql.Timestamp;

/**
 * Corporate recruiter profile entity tracking company onboarding and administrator approval.
 */
public class RecruiterProfile implements Identifiable {
    private int recruiterProfileId;
    private int userId;
    private int companyId;
    private String contactPerson;
    private String designation;
    private String phone;
    private String officialEmail;
    private String website;
    private String industry;
    private String approvalStatus;
    private boolean demo;
    private Timestamp createdAt;

    @Override
    public int getId() {
        return recruiterProfileId;
    }

    @Override
    public void setId(int id) {
        this.recruiterProfileId = id;
    }

    public int getRecruiterProfileId() { return recruiterProfileId; }
    public void setRecruiterProfileId(int recruiterProfileId) { this.recruiterProfileId = recruiterProfileId; }
    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }
    public int getCompanyId() { return companyId; }
    public void setCompanyId(int companyId) { this.companyId = companyId; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getOfficialEmail() { return officialEmail; }
    public void setOfficialEmail(String officialEmail) { this.officialEmail = officialEmail; }
    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
    public String getIndustry() { return industry; }
    public void setIndustry(String industry) { this.industry = industry; }
    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }
    public boolean isDemo() { return demo; }
    public void setDemo(boolean demo) { this.demo = demo; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
