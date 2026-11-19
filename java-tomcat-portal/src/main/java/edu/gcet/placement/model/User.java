package edu.gcet.placement.model;

import java.sql.Timestamp;
import java.util.List;

/**
 * Abstract base class representing any authenticated portal user.
 * Demonstrates abstraction, encapsulation, constructors, and polymorphic role behavior.
 */
public abstract class User implements Identifiable {
    public enum Role {
        PRINCIPAL, VICE_CHAIRMAN, CHAIRMAN, ADMIN, PLACEMENT_OFFICER, FACULTY_COORDINATOR, FACULTY, STUDENT, RECRUITER
    }

    private int userId;
    private String username;
    private String email;
    private transient String passwordHash;
    private transient String passwordSalt;
    private Role role;
    private String fullName;
    private String employeeId;
    private String assignedBranch;
    private String designation;
    private String departmentName;
    private List<String> assignedBranches = List.of();
    private Integer companyId;
    private String approvalStatus;
    private boolean active;
    private boolean mustChangePassword;
    private boolean passwordChangeDismissed;
    private Integer createdBy;
    private Timestamp lastLogin;
    private Timestamp createdAt;

    protected User() {
        this.active = true;
        this.approvalStatus = "Approved";
        this.mustChangePassword = false;
        this.passwordChangeDismissed = false;
    }

    protected User(int userId, String username, String email, Role role, String fullName) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.role = role;
        this.fullName = fullName;
        this.active = true;
        this.approvalStatus = "Approved";
        this.mustChangePassword = false;
        this.passwordChangeDismissed = false;
    }

    /**
     * Polymorphic hook implemented by each concrete user role to return authorized portal modules.
     */
    public abstract List<String> getDashboardPermissions();

    public String getDashboardRoute() {
        return switch (role) {
            case PRINCIPAL, VICE_CHAIRMAN, CHAIRMAN -> "EXECUTIVE";
            case ADMIN, PLACEMENT_OFFICER -> "ADMIN";
            case FACULTY_COORDINATOR, FACULTY -> "FACULTY";
            case RECRUITER -> "RECRUITER";
            case STUDENT -> "STUDENT";
        };
    }

    public String getDashboardPath() {
        return switch (role) {
            case PRINCIPAL -> "/principal/dashboard";
            case VICE_CHAIRMAN -> "/vice-chairman/dashboard";
            case CHAIRMAN -> "/chairman/dashboard";
            case ADMIN -> "/admin/dashboard";
            case PLACEMENT_OFFICER -> "/placement-officer/dashboard";
            case FACULTY_COORDINATOR -> "/faculty-coordinator/dashboard";
            case FACULTY -> "/faculty/dashboard";
            case RECRUITER -> "/recruiter/dashboard";
            case STUDENT -> "/student/dashboard";
        };
    }

    public boolean isExecutive() {
        return role == Role.PRINCIPAL || role == Role.VICE_CHAIRMAN || role == Role.CHAIRMAN;
    }

    public boolean isPlacementAdmin() {
        return isExecutive() || role == Role.ADMIN || role == Role.PLACEMENT_OFFICER;
    }

    public boolean isFacultyRole() {
        return role == Role.FACULTY_COORDINATOR || role == Role.FACULTY;
    }

    public boolean canAccessRegistrationReports() {
        return isExecutive() || isFacultyRole();
    }

    /**
     * Polymorphic display title for portal header.
     */
    public String getDisplayBadge() {
        return fullName + " (" + role.name().replace('_', ' ') + ")";
    }

    @Override
    public int getId() {
        return userId;
    }

    @Override
    public void setId(int id) {
        this.userId = id;
    }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getPasswordSalt() { return passwordSalt; }
    public void setPasswordSalt(String passwordSalt) { this.passwordSalt = passwordSalt; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getAssignedBranch() { return assignedBranch; }
    public void setAssignedBranch(String assignedBranch) { this.assignedBranch = assignedBranch; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }
    public List<String> getAssignedBranches() { return assignedBranches; }
    public void setAssignedBranches(List<String> assignedBranches) {
        this.assignedBranches = assignedBranches == null ? List.of() : List.copyOf(assignedBranches);
    }
    public Integer getCompanyId() { return companyId; }
    public void setCompanyId(Integer companyId) { this.companyId = companyId; }
    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
    public boolean isPasswordChangeDismissed() { return passwordChangeDismissed; }
    public void setPasswordChangeDismissed(boolean passwordChangeDismissed) { this.passwordChangeDismissed = passwordChangeDismissed; }
    public Integer getCreatedBy() { return createdBy; }
    public void setCreatedBy(Integer createdBy) { this.createdBy = createdBy; }
    public Timestamp getLastLogin() { return lastLogin; }
    public void setLastLogin(Timestamp lastLogin) { this.lastLogin = lastLogin; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
