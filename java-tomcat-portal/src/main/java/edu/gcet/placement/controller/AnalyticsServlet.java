package edu.gcet.placement.controller;

import edu.gcet.placement.service.AnalyticsService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/analytics")
public class AnalyticsServlet extends HttpServlet {
    private final AnalyticsService analyticsService = new AnalyticsService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            JsonUtil.sendSuccess(resp, 200, analyticsService.getDashboardAndReports());
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
