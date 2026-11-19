package edu.gcet.placement.model;

/**
 * Student Internship & Industry Experience model (Section F).
 */
public class Internship implements Identifiable {
    private int internshipId;
    private int studentId;
    private String companyName;
    private String role;
    private String duration;
    private String startDate;
    private String endDate;
    private String description;
    private String technologiesUsed;
    private String certificateName;
    private String certificateData;

    @Override public int getId() { return internshipId; }
    @Override public void setId(int id) { this.internshipId = id; }

    public int getInternshipId() { return internshipId; }
    public void setInternshipId(int internshipId) { this.internshipId = internshipId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTechnologiesUsed() { return technologiesUsed; }
    public void setTechnologiesUsed(String technologiesUsed) { this.technologiesUsed = technologiesUsed; }
    public String getCertificateName() { return certificateName; }
    public void setCertificateName(String certificateName) { this.certificateName = certificateName; }
    public String getCertificateData() { return certificateData; }
    public void setCertificateData(String certificateData) { this.certificateData = certificateData; }
}
