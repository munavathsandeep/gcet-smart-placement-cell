package edu.gcet.placement.model;

import java.sql.Timestamp;

public class Company implements Identifiable {
    private int companyId;
    private String companyName;
    private String logoUrl;
    private String industry;
    private String officialWebsite;
    private String careerPageUrl;
    private String headquarters;
    private String description;
    private boolean directoryReference;
    private String contactPerson;
    private String contactEmail;
    private String contactPhone;
    private Timestamp createdAt;

    public Company() {}

    @Override public int getId() { return companyId; }
    @Override public void setId(int id) { this.companyId = id; }

    public int getCompanyId() { return companyId; }
    public void setCompanyId(int companyId) { this.companyId = companyId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getIndustry() { return industry; }
    public void setIndustry(String industry) { this.industry = industry; }
    public String getOfficialWebsite() { return officialWebsite; }
    public void setOfficialWebsite(String officialWebsite) { this.officialWebsite = officialWebsite; }
    public String getCareerPageUrl() { return careerPageUrl; }
    public void setCareerPageUrl(String careerPageUrl) { this.careerPageUrl = careerPageUrl; }
    public String getHeadquarters() { return headquarters; }
    public void setHeadquarters(String headquarters) { this.headquarters = headquarters; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isDirectoryReference() { return directoryReference; }
    public void setDirectoryReference(boolean directoryReference) { this.directoryReference = directoryReference; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
