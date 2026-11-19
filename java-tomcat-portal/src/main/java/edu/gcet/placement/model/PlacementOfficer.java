package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * Placement Officer (TPO) role responsible for drives, recruiters, applications, and placement records.
 */
public class PlacementOfficer extends User {
    private String designation;

    public PlacementOfficer() {
        super();
        setRole(Role.PLACEMENT_OFFICER);
    }

    public PlacementOfficer(int userId, String username, String email, String fullName, String designation) {
        super(userId, username, email, Role.PLACEMENT_OFFICER, fullName);
        this.designation = designation;
    }

    @Override
    public List<String> getDashboardPermissions() {
        return Arrays.asList(
            "DASHBOARD", "STUDENT_MANAGEMENT", "STUDENT_PROFILES", "SKILL_MATRIX",
            "COMPANIES", "PLACEMENT_DRIVES", "ELIGIBILITY_CHECKER", "SKILL_GAP_ANALYSIS",
            "COMPANY_MATCHING", "APPLICATIONS", "PLACEMENT_TRACKING", "REPORTS_ANALYTICS", "SETTINGS"
        );
    }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
}
