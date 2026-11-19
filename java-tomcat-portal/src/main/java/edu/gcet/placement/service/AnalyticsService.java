package edu.gcet.placement.service;

import edu.gcet.placement.dao.AnalyticsDAO;
import edu.gcet.placement.util.PortalException;
import java.util.Map;

public class AnalyticsService {
    private final AnalyticsDAO analyticsDAO = new AnalyticsDAO();

    public Map<String, Object> getDashboardAndReports() throws PortalException {
        return analyticsDAO.getDashboardMetrics();
    }

    public Map<String, Object> getInstitutionalRegistrationStats() throws PortalException {
        return analyticsDAO.getInstitutionalRegistrationStats();
    }
}
