package edu.gcet.placement.model;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Student domain model extending User and implementing Evaluatable.
 * Supports college-wide branch tracking, academic year, semester, section, and backlogs.
 */
public class Student extends User implements Evaluatable {
    private int studentId;
    private String rollNumber;
    private String phone;
    private int deptId;
    private int branchId;
    private String branch; // branch_code e.g. CSE, CSE-AIML, ECE
    private String academicYear;
    private int yearOfStudy;
    private int semester;
    private String section;
    private int graduationYear;
    private double cgpa;
    private int activeBacklogs;
    private String gender;
    private String address;
    private String resumeUrl;
    private String profilePhotoUrl;
    private String placementStatus;
    private List<StudentSkill> skills = new ArrayList<>();
    private List<Project> projects = new ArrayList<>();
    private List<Certification> certifications = new ArrayList<>();

    public Student() {
        super();
        setRole(Role.STUDENT);
        this.placementStatus = "Unplaced";
        this.academicYear = "2026-27";
        this.yearOfStudy = 4;
        this.semester = 7;
        this.section = "A";
    }

    public Student(int studentId, int userId, String rollNumber, String fullName, String email,
                   String phone, int deptId, int branchId, String branch, int graduationYear, double cgpa) {
        super(userId, rollNumber.toLowerCase(), email, Role.STUDENT, fullName);
        this.studentId = studentId;
        this.rollNumber = rollNumber;
        this.phone = phone;
        this.deptId = deptId;
        this.branchId = branchId;
        this.branch = branch;
        this.graduationYear = graduationYear;
        this.cgpa = cgpa;
        this.placementStatus = "Unplaced";
        this.academicYear = "2026-27";
        this.yearOfStudy = 4;
        this.semester = 7;
        this.section = "A";
    }

    @Override
    public List<String> getDashboardPermissions() {
        return Arrays.asList(
            "DASHBOARD", "ANNOUNCEMENTS", "DEPARTMENT_NOTICES", "STUDENT_PROFILES",
            "SKILL_MATRIX", "COMPANIES", "PLACEMENT_DRIVES", "SAVED_JOBS",
            "ELIGIBILITY_CHECKER", "SKILL_GAP_ANALYSIS", "COMPANY_MATCHING",
            "APPLICATIONS", "SETTINGS"
        );
    }

    @Override
    public double computeReadinessScore() {
        double cgpaComponent = Math.min(cgpa / 10.0, 1.0) * 50.0;
        double avgSkill = skills.isEmpty() ? 0.0
                : skills.stream().mapToInt(StudentSkill::getProficiencyLevel).average().orElse(0.0);
        double skillComponent = (avgSkill / 5.0) * 50.0;
        return Math.round((cgpaComponent + skillComponent) * 10.0) / 10.0;
    }

    @Override
    public String getEvaluationSummary() {
        return String.format("%s (%s · %s) — CGPA %.2f, %d backlogs, %d tracked skills, Readiness %.1f%%",
                getFullName(), rollNumber, branch, cgpa, activeBacklogs, skills.size(), computeReadinessScore());
    }

    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public int getDeptId() { return deptId; }
    public void setDeptId(int deptId) { this.deptId = deptId; }
    public int getBranchId() { return branchId; }
    public void setBranchId(int branchId) { this.branchId = branchId; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getAcademicYear() { return academicYear; }
    public void setAcademicYear(String academicYear) { this.academicYear = academicYear; }
    public int getYearOfStudy() { return yearOfStudy; }
    public void setYearOfStudy(int yearOfStudy) { this.yearOfStudy = yearOfStudy; }
    public int getSemester() { return semester; }
    public void setSemester(int semester) { this.semester = semester; }
    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }
    public int getGraduationYear() { return graduationYear; }
    public void setGraduationYear(int graduationYear) { this.graduationYear = graduationYear; }
    public double getCgpa() { return cgpa; }
    public void setCgpa(double cgpa) { this.cgpa = cgpa; }
    public int getActiveBacklogs() { return activeBacklogs; }
    public void setActiveBacklogs(int activeBacklogs) { this.activeBacklogs = activeBacklogs; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getResumeUrl() { return resumeUrl; }
    public void setResumeUrl(String resumeUrl) { this.resumeUrl = resumeUrl; }
    public String getProfilePhotoUrl() { return profilePhotoUrl; }
    public void setProfilePhotoUrl(String profilePhotoUrl) { this.profilePhotoUrl = profilePhotoUrl; }
    public String getPlacementStatus() { return placementStatus; }
    public void setPlacementStatus(String placementStatus) { this.placementStatus = placementStatus; }
    public List<StudentSkill> getSkills() { return skills; }
    public void setSkills(List<StudentSkill> skills) { this.skills = skills; }
    public List<Project> getProjects() { return projects; }
    public void setProjects(List<Project> projects) { this.projects = projects; }
    public List<Certification> getCertifications() { return certifications; }
    public void setCertifications(List<Certification> certifications) { this.certifications = certifications; }
}
