package edu.gcet.placement.controller;

import com.google.gson.reflect.TypeToken;
import edu.gcet.placement.model.ProfileSubmission;
import edu.gcet.placement.model.User;
import edu.gcet.placement.service.StudentProfileService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.BufferedReader;
import java.io.IOException;
import java.lang.reflect.Type;
import java.util.Map;

/**
 * REST Servlet handling Official Student Profile dossier reads, Draft saves, and Approval submissions.
 */
@WebServlet("/api/student-profile/*")
public class StudentProfileServlet extends HttpServlet {
    private static final Type MAP_TYPE = new TypeToken<Map<String, Object>>() {}.getType();
    private final StudentProfileService profileService = new StudentProfileService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = (User) req.getSession(false).getAttribute("authUser");
            int studentId = parseLeadingId(req.getPathInfo());
            Map<String, Object> dossier = profileService.getProfileDossier(studentId, actor);
            JsonUtil.sendSuccess(resp, 200, dossier);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Invalid student profile request path.");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = (User) req.getSession(false).getAttribute("authUser");
            String pathInfo = req.getPathInfo();
            if (pathInfo == null || pathInfo.length() < 2) {
                throw new PortalException("Missing student profile target path.", 400);
            }
            String[] parts = pathInfo.substring(1).split("/");
            int studentId = Integer.parseInt(parts[0]);
            String action = parts.length > 1 ? parts[1] : "draft";

            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = req.getReader()) {
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
            }
            Map<String, Object> payload = JsonUtil.gson().fromJson(sb.toString(), MAP_TYPE);

            ProfileSubmission result = switch (action.toLowerCase()) {
                case "draft" -> profileService.saveDraft(studentId, actor, payload);
                case "submit" -> profileService.submitForApproval(studentId, actor, payload);
                default -> throw new PortalException("Unsupported profile action: " + action, 400);
            };
            JsonUtil.sendSuccess(resp, 200, result);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Invalid profile submission payload.");
        }
    }

    private int parseLeadingId(String pathInfo) throws PortalException {
        if (pathInfo == null || pathInfo.length() < 2) {
            throw new PortalException("Student ID is required.", 400);
        }
        String[] parts = pathInfo.substring(1).split("/");
        return Integer.parseInt(parts[0]);
    }
}
