package edu.gcet.placement.model;

import java.util.ArrayList;
import java.util.List;

public class SkillGapReport {
    public static class SkillComparison {
        private int skillId;
        private String skillName;
        private String category;
        private int studentLevel;
        private int requiredLevel;
        private int gap; // positive means student lacks proficiency
        private String status; // Matched, Needs Improvement, Missing
        private String priority; // Low, Medium, High

        public int getSkillId() { return skillId; }
        public void setSkillId(int skillId) { this.skillId = skillId; }
        public String getSkillName() { return skillName; }
        public void setSkillName(String skillName) { this.skillName = skillName; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public int getStudentLevel() { return studentLevel; }
        public void setStudentLevel(int studentLevel) { this.studentLevel = studentLevel; }
        public int getRequiredLevel() { return requiredLevel; }
        public void setRequiredLevel(int requiredLevel) { this.requiredLevel = requiredLevel; }
        public int getGap() { return gap; }
        public void setGap(int gap) { this.gap = gap; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }
    }

    private int studentId;
    private String studentName;
    private int driveId;
    private String companyName;
    private String jobRole;
    private double readinessPercentage;
    private List<SkillComparison> comparisons = new ArrayList<>();
    private List<String> recommendedActions = new ArrayList<>();

    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public int getDriveId() { return driveId; }
    public void setDriveId(int driveId) { this.driveId = driveId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getJobRole() { return jobRole; }
    public void setJobRole(String jobRole) { this.jobRole = jobRole; }
    public double getReadinessPercentage() { return readinessPercentage; }
    public void setReadinessPercentage(double readinessPercentage) { this.readinessPercentage = readinessPercentage; }
    public List<SkillComparison> getComparisons() { return comparisons; }
    public void setComparisons(List<SkillComparison> comparisons) { this.comparisons = comparisons; }
    public List<String> getRecommendedActions() { return recommendedActions; }
    public void setRecommendedActions(List<String> recommendedActions) { this.recommendedActions = recommendedActions; }
}
