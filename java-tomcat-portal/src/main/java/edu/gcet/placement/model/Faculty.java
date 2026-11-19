package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * Faculty Coordinator role for strict department-level placement mentoring and student profile approvals.
 */
public class Faculty extends User {
    private String departmentCode;

    public Faculty() {
        super();
        setRole(Role.FACULTY_COORDINATOR);
    }

    public Faculty(int userId, String username, String email, String fullName, String departmentCode) {
        super(userId, username, email, Role.FACULTY_COORDINATOR, fullName);
        this.departmentCode = departmentCode;
        setAssignedBranch(departmentCode);
    }

    public Faculty(
            int userId,
            String username,
            String email,
            String fullName,
            String designation,
            String departmentName,
            List<String> assignedBranches
    ) {
        super(userId, username, email, Role.FACULTY_COORDINATOR, fullName);
        setDesignation(designation);
        setDepartmentName(departmentName);
        setAssignedBranches(assignedBranches);
        String summary = String.join(", ", assignedBranches);
        setAssignedBranch(summary);
        this.departmentCode = departmentName;
    }

    @Override
    public List<String> getDashboardPermissions() {
        return Arrays.asList(
                "DASHBOARD", "ASSIGNED_STUDENTS", "STUDENT_PROFILES", "PROFILE_APPROVALS",
                "SKILL_MATRIX", "DEPARTMENT_REPORTS", "ANNOUNCEMENTS", "NOTIFICATIONS", "SETTINGS"
        );
    }

    public String getDepartmentCode() { return departmentCode; }
    public void setDepartmentCode(String departmentCode) { this.departmentCode = departmentCode; }
}
