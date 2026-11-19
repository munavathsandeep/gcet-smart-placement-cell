package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * System Administrator role with unrestricted GCET portal governance permissions.
 */
public class Admin extends User {
    public Admin() {
        super();
        setRole(Role.ADMIN);
    }

    public Admin(int userId, String username, String email, String fullName) {
        super(userId, username, email, Role.ADMIN, fullName);
    }

    @Override
    public List<String> getDashboardPermissions() {
        return Arrays.asList(
            "DASHBOARD", "STUDENT_MANAGEMENT", "STUDENT_PROFILES", "SKILL_MATRIX",
            "COMPANIES", "PLACEMENT_DRIVES", "ELIGIBILITY_CHECKER", "SKILL_GAP_ANALYSIS",
            "COMPANY_MATCHING", "APPLICATIONS", "PLACEMENT_TRACKING", "REPORTS_ANALYTICS", "SETTINGS"
        );
    }
}
