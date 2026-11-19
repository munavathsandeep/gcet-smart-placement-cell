package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * Vice Chairman executive governance account (Harishchandra) with institutional placement oversight.
 */
public class ViceChairman extends User {
    public ViceChairman() {
        super();
        setRole(Role.VICE_CHAIRMAN);
    }

    public ViceChairman(int userId, String username, String email, String fullName) {
        super(userId, username, email, Role.VICE_CHAIRMAN, fullName);
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
