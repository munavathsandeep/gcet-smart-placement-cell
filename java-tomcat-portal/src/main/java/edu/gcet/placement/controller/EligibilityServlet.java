package edu.gcet.placement.controller;

import edu.gcet.placement.dao.PlacementDriveDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.EligibilityResult;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.service.EligibilityService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@WebServlet("/api/eligibility")
public class EligibilityServlet extends HttpServlet {
    private final StudentDAO studentDAO = new StudentDAO();
    private final PlacementDriveDAO driveDAO = new PlacementDriveDAO();
    private final EligibilityService eligibilityService = new EligibilityService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String studentParam = req.getParameter("studentId");
            String driveParam = req.getParameter("driveId");

            if (studentParam != null && driveParam != null) {
                Student s = studentDAO.findById(Integer.parseInt(studentParam))
                        .orElseThrow(() -> new PortalException("Student not found.", 404));
                PlacementDrive d = driveDAO.findById(Integer.parseInt(driveParam))
                        .orElseThrow(() -> new PortalException("Placement drive not found.", 404));
                JsonUtil.sendSuccess(resp, 200, eligibilityService.evaluate(s, d));
                return;
            }
            if (studentParam != null) {
                Student s = studentDAO.findById(Integer.parseInt(studentParam))
                        .orElseThrow(() -> new PortalException("Student not found.", 404));
                List<EligibilityResult> results = new ArrayList<>();
                for (PlacementDrive d : driveDAO.findAll()) {
                    results.add(eligibilityService.evaluate(s, d));
                }
                JsonUtil.sendSuccess(resp, 200, results);
                return;
            }
            JsonUtil.sendError(resp, 400, "Provide studentId (and optional driveId).");
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
