package edu.gcet.placement.controller;

import edu.gcet.placement.dao.PlacementDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.Placement;
import edu.gcet.placement.service.NotificationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/placements/*")
public class PlacementServlet extends HttpServlet {
    private final PlacementDAO placementDAO = new PlacementDAO();
    private final StudentDAO studentDAO = new StudentDAO();
    private final NotificationService notificationService = new NotificationService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            JsonUtil.sendSuccess(resp, 200, placementDAO.findAll());
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            Placement p = JsonUtil.readBody(req, Placement.class);
            Placement recorded = placementDAO.recordPlacement(p);
            studentDAO.findById(p.getStudentId()).ifPresent(st -> {
                if (st.getUserId() > 0) {
                    try {
                        notificationService.notifyUser(
                                st.getUserId(),
                                "Placement Offer Recorded: " + (p.getJobRole() != null ? p.getJobRole() : "Campus Offer"),
                                String.format("Congratulations! Your %.2f LPA placement offer is recorded as %s.",
                                        p.getPackageLpa(), p.getJoiningStatus() != null ? p.getJoiningStatus() : "Offered"),
                                "Placement Notifications",
                                "placements"
                        );
                    } catch (PortalException ignored) {}
                }
            });
            JsonUtil.sendSuccess(resp, 201, recorded);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            placementDAO.updateJoiningStatus(id, String.valueOf(body.get("joiningStatus")));
            JsonUtil.sendSuccess(resp, 200, Map.of("updated", true));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
