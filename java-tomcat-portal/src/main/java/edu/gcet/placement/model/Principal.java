package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * Principal executive governance account (Sagar) with full institutional oversight.
 */
public class Principal extends User {
    public Principal() {
        super();
        setRole(Role.PRINCIPAL);
    }

    public Principal(int userId, String username, String email, String fullName) {
        super(userId, username, email, Role.PRINCIPAL, fullName);
    }

    @Override
    public List<String> getDashboardPermissions() {
        return Arrays.asList(
            "EXECUTIVE_DASHBOARD", "CAMPUS_CONNECT", "APPROVAL_CENTER", "USER_MANAGEMENT",
            "STUDENT_MANAGEMENT", "SKILL_MATRIX", "COMPANIES", "PLACEMENT_DRIVES",
            "ELIGIBILITY_CHECKER", "SKILL_GAP_ANALYSIS", "COMPANY_MATCHING", "APPLICATIONS",
            "PLACEMENT_TRACKING", "REPORTS_ANALYTICS", "ANNOUNCEMENTS", "SETTINGS"
        );
    }
}
