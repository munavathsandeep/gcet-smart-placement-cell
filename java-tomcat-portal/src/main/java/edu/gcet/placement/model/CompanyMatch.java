package edu.gcet.placement.model;

import java.util.ArrayList;
import java.util.List;

public class CompanyMatch {
    private int driveId;
    private int companyId;
    private String companyName;
    private String industry;
    private String jobRole;
    private double salaryPackage;
    private boolean eligible;
    private double matchPercentage;
    private List<String> matchingSkills = new ArrayList<>();
    private List<String> missingSkills = new ArrayList<>();
    private String algorithmBreakdown;

    public int getDriveId() { return driveId; }
    public void setDriveId(int driveId) { this.driveId = driveId; }
    public int getCompanyId() { return companyId; }
    public void setCompanyId(int companyId) { this.companyId = companyId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getIndustry() { return industry; }
    public void setIndustry(String industry) { this.industry = industry; }
    public String getJobRole() { return jobRole; }
    public void setJobRole(String jobRole) { this.jobRole = jobRole; }
    public double getSalaryPackage() { return salaryPackage; }
    public void setSalaryPackage(double salaryPackage) { this.salaryPackage = salaryPackage; }
    public boolean isEligible() { return eligible; }
    public void setEligible(boolean eligible) { this.eligible = eligible; }
    public double getMatchPercentage() { return matchPercentage; }
    public void setMatchPercentage(double matchPercentage) { this.matchPercentage = matchPercentage; }
    public List<String> getMatchingSkills() { return matchingSkills; }
    public void setMatchingSkills(List<String> matchingSkills) { this.matchingSkills = matchingSkills; }
    public List<String> getMissingSkills() { return missingSkills; }
    public void setMissingSkills(List<String> missingSkills) { this.missingSkills = missingSkills; }
    public String getAlgorithmBreakdown() { return algorithmBreakdown; }
    public void setAlgorithmBreakdown(String algorithmBreakdown) { this.algorithmBreakdown = algorithmBreakdown; }
}
