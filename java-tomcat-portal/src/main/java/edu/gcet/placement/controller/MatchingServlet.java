package edu.gcet.placement.controller;

import edu.gcet.placement.dao.PlacementDriveDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.service.CompanyMatchingService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/matching")
public class MatchingServlet extends HttpServlet {
    private final StudentDAO studentDAO = new StudentDAO();
    private final PlacementDriveDAO driveDAO = new PlacementDriveDAO();
    private final CompanyMatchingService matchingService = new CompanyMatchingService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int studentId = Integer.parseInt(req.getParameter("studentId"));
            Student s = studentDAO.findById(studentId)
                    .orElseThrow(() -> new PortalException("Student not found.", 404));
            JsonUtil.sendSuccess(resp, 200, matchingService.matchStudentToDrives(s, driveDAO.findAll()));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Valid studentId parameter is required.");
        }
    }
}
