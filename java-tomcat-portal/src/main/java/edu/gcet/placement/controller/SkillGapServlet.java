package edu.gcet.placement.controller;

import edu.gcet.placement.dao.PlacementDriveDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.service.SkillGapService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/skill-gap")
public class SkillGapServlet extends HttpServlet {
    private final StudentDAO studentDAO = new StudentDAO();
    private final PlacementDriveDAO driveDAO = new PlacementDriveDAO();
    private final SkillGapService skillGapService = new SkillGapService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int studentId = Integer.parseInt(req.getParameter("studentId"));
            int driveId = Integer.parseInt(req.getParameter("driveId"));
            Student s = studentDAO.findById(studentId)
                    .orElseThrow(() -> new PortalException("Student not found.", 404));
            PlacementDrive d = driveDAO.findById(driveId)
                    .orElseThrow(() -> new PortalException("Drive not found.", 404));
            JsonUtil.sendSuccess(resp, 200, skillGapService.analyze(s, d));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Valid studentId and driveId query parameters are required.");
        }
    }
}
