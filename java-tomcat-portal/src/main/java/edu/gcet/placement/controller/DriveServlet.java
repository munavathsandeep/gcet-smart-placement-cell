package edu.gcet.placement.controller;

import edu.gcet.placement.dao.PlacementDriveDAO;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.service.NotificationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import edu.gcet.placement.util.ValidationUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/drives/*")
public class DriveServlet extends HttpServlet {
    private final PlacementDriveDAO driveDAO = new PlacementDriveDAO();
    private final NotificationService notificationService = new NotificationService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String path = req.getPathInfo();
            if (path != null && path.length() > 1) {
                int id = Integer.parseInt(path.substring(1));
                PlacementDrive d = driveDAO.findById(id)
                        .orElseThrow(() -> new PortalException("Drive not found.", 404));
                JsonUtil.sendSuccess(resp, 200, d);
                return;
            }
            JsonUtil.sendSuccess(resp, 200, driveDAO.findAll());
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            PlacementDrive d = JsonUtil.readBody(req, PlacementDrive.class);
            ValidationUtil.requireNonEmpty(d.getJobRole(), "Job Role");
            ValidationUtil.validateCgpa(d.getMinCgpa());
            PlacementDrive saved = driveDAO.save(d);
            if ("Pending".equalsIgnoreCase(saved.getApprovalStatus())) {
                notificationService.notifyBroadcast(
                        "Recruiter Drive Pending Approval: " + saved.getJobRole(),
                        "A new placement drive requires Placement Cell review before student publishing.",
                        "Placement Notifications",
                        "approvals"
                );
            } else {
                notificationService.notifyEligibleStudentsForDrive(saved.getDriveId());
            }
            JsonUtil.sendSuccess(resp, 201, saved);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            PlacementDrive d = JsonUtil.readBody(req, PlacementDrive.class);
            d.setDriveId(id);
            driveDAO.update(d);
            notificationService.notifyEligibleStudentsForDrive(id);
            JsonUtil.sendSuccess(resp, 200, driveDAO.findById(id).orElse(d));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            driveDAO.deleteById(id);
            JsonUtil.sendSuccess(resp, 200, Map.of("deleted", true));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
