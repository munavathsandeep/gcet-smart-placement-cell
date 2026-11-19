package edu.gcet.placement.controller;

import edu.gcet.placement.dao.SkillDAO;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import edu.gcet.placement.util.ValidationUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/skills/*")
public class SkillServlet extends HttpServlet {
    private final SkillDAO skillDAO = new SkillDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String studentIdParam = req.getParameter("studentId");
            if (studentIdParam != null && !studentIdParam.isBlank()) {
                JsonUtil.sendSuccess(resp, 200, skillDAO.findSkillsByStudent(Integer.parseInt(studentIdParam)));
            } else {
                JsonUtil.sendSuccess(resp, 200, skillDAO.findAllSkills());
            }
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            Map<?, ?> body = JsonUtil.readBody(req, Map.class);
            int studentId = ((Number) body.get("studentId")).intValue();
            int skillId = ((Number) body.get("skillId")).intValue();
            int level = ((Number) body.get("proficiencyLevel")).intValue();
            ValidationUtil.validateProficiency(level);
            skillDAO.upsertStudentSkill(studentId, skillId, level);
            JsonUtil.sendSuccess(resp, 200, skillDAO.findSkillsByStudent(studentId));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int studentId = Integer.parseInt(req.getParameter("studentId"));
            int skillId = Integer.parseInt(req.getParameter("skillId"));
            skillDAO.deleteStudentSkill(studentId, skillId);
            JsonUtil.sendSuccess(resp, 200, Map.of("removed", true));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
