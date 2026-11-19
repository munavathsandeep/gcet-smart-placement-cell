package edu.gcet.placement.controller;

import edu.gcet.placement.dao.ApplicationDAO;
import edu.gcet.placement.service.ApplicationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/applications/*")
public class ApplicationServlet extends HttpServlet {
    private final ApplicationDAO applicationDAO = new ApplicationDAO();
    private final ApplicationService applicationService = new ApplicationService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String studentId = req.getParameter("studentId");
            Integer filterId = (studentId != null && !studentId.isBlank()) ? Integer.parseInt(studentId) : null;
            JsonUtil.sendSuccess(resp, 200, applicationDAO.findAll(filterId));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            int studentId = ((Number) body.get("studentId")).intValue();
            int driveId = ((Number) body.get("driveId")).intValue();
            JsonUtil.sendSuccess(resp, 201, applicationService.applyToDrive(studentId, driveId));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int appId = Integer.parseInt(req.getPathInfo().substring(1));
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            String status = String.valueOf(body.get("status"));
            String remarks = body.get("remarks") != null ? String.valueOf(body.get("remarks")) : "";
            applicationService.updateApplicationStatus(appId, status, remarks);
            JsonUtil.sendSuccess(resp, 200, Map.of("updated", true));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
