package edu.gcet.placement.controller;

import edu.gcet.placement.model.User;
import edu.gcet.placement.service.NotificationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/notifications/*")
public class NotificationServlet extends HttpServlet {
    private final NotificationService notificationService = new NotificationService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        User user = session != null ? (User) session.getAttribute("authUser") : null;
        if (user == null) {
            JsonUtil.sendError(resp, 401, "Authentication required.");
            return;
        }
        try {
            JsonUtil.sendSuccess(resp, 200, notificationService.listNotificationsForUser(user.getUserId()));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        User user = session != null ? (User) session.getAttribute("authUser") : null;
        if (user == null) {
            JsonUtil.sendError(resp, 401, "Authentication required.");
            return;
        }
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        try {
            if ("/mark-all-read".equalsIgnoreCase(path)) {
                notificationService.markAllRead(user.getUserId());
                JsonUtil.sendSuccess(resp, 200, Map.of("updated", true));
                return;
            }
            String clean = path.replace("/read", "").replace("/", "");
            int id = Integer.parseInt(clean);
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            boolean read = body == null || !body.containsKey("isRead") || Boolean.TRUE.equals(body.get("isRead"));
            notificationService.markRead(id, read);
            JsonUtil.sendSuccess(resp, 200, Map.of("updated", true));
        } catch (NumberFormatException e) {
            JsonUtil.sendError(resp, 400, "Invalid notification ID.");
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
