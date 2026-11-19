package edu.gcet.placement.model;

import java.util.Arrays;
import java.util.List;

/**
 * Corporate Recruiter role with company-scoped drive posting and candidate shortlisting permissions.
 */
public class Recruiter extends User {
    public Recruiter() {
        super();
        setRole(Role.RECRUITER);
    }

    public Recruiter(int userId, String username, String email, String fullName, Integer companyId, String approvalStatus) {
        super(userId, username, email, Role.RECRUITER, fullName);
        setCompanyId(companyId);
        setApprovalStatus(approvalStatus);
    }

    @Override
    public List<String> getDashboardPermissions() {
        return Arrays.asList(
            "DASHBOARD", "CAMPUS_CONNECT", "COMPANIES", "PLACEMENT_DRIVES",
            "APPLICATIONS", "ANNOUNCEMENTS", "NOTIFICATIONS", "SETTINGS"
        );
    }
}
