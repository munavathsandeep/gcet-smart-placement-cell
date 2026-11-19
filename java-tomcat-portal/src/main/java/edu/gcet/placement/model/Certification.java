package edu.gcet.placement.model;

import java.sql.Date;

public class Certification implements Identifiable {
    private int certId;
    private int studentId;
    private String certName;
    private String issuingOrg;
    private Date issueDate;
    private String credentialId;

    public Certification() {}

    @Override public int getId() { return certId; }
    @Override public void setId(int id) { this.certId = id; }

    public int getCertId() { return certId; }
    public void setCertId(int certId) { this.certId = certId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getCertName() { return certName; }
    public void setCertName(String certName) { this.certName = certName; }
    public String getIssuingOrg() { return issuingOrg; }
    public void setIssuingOrg(String issuingOrg) { this.issuingOrg = issuingOrg; }
    public Date getIssueDate() { return issueDate; }
    public void setIssueDate(Date issueDate) { this.issueDate = issueDate; }
    public String getCredentialId() { return credentialId; }
    public void setCredentialId(String credentialId) { this.credentialId = credentialId; }
}
