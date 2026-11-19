package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * Chairman executive governance account (Ravinder Reddy) with top-level institutional governance.
 */
public class Chairman extends User {
    public Chairman() {
        super();
        setRole(Role.CHAIRMAN);
    }

    public Chairman(int userId, String username, String email, String fullName) {
        super(userId, username, email, Role.CHAIRMAN, fullName);
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
