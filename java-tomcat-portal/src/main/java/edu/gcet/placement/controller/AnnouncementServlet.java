package edu.gcet.placement.controller;

import edu.gcet.placement.dao.AnnouncementDAO;
import edu.gcet.placement.model.Announcement;
import edu.gcet.placement.service.AnnouncementSyncService;
import edu.gcet.placement.service.NotificationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/announcements/*")
public class AnnouncementServlet extends HttpServlet {
    private final AnnouncementDAO announcementDAO = new AnnouncementDAO();
    private final AnnouncementSyncService syncService = new AnnouncementSyncService();
    private final NotificationService notificationService = new NotificationService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String path = req.getPathInfo() == null ? "" : req.getPathInfo();
            if ("/sources".equals(path)) {
                JsonUtil.sendSuccess(resp, 200, announcementDAO.findAllSources());
                return;
            }
            if ("/sync-status".equals(path)) {
                JsonUtil.sendSuccess(resp, 200, announcementDAO.getSyncHealthSummary());
                return;
            }
            String branch = req.getParameter("branch");
            String category = req.getParameter("category");
            String priority = req.getParameter("priority");
            String q = req.getParameter("q");
            boolean archived = "true".equalsIgnoreCase(req.getParameter("archived"));
            JsonUtil.sendSuccess(resp, 200, announcementDAO.findFiltered(branch, category, priority, q, archived));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String path = req.getPathInfo() == null ? "" : req.getPathInfo();
            if ("/sync".equals(path)) {
                var result = syncService.syncAllEnabledSources();
                notificationService.checkUpcomingDriveDeadlines();
                JsonUtil.sendSuccess(resp, 200, result);
                return;
            }
            Announcement a = JsonUtil.readBody(req, Announcement.class);
            a.setVerifiedSource(false); // Manual admin/TPO notice
            JsonUtil.sendSuccess(resp, 201, announcementDAO.save(a));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
