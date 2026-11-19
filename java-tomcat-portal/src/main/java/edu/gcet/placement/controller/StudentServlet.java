package edu.gcet.placement.controller;

import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import edu.gcet.placement.util.ValidationUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@WebServlet("/api/students/*")
public class StudentServlet extends HttpServlet {
    private final StudentDAO studentDAO = new StudentDAO();

    private User requireSessionUser(HttpServletRequest req) throws PortalException {
        HttpSession session = req.getSession(false);
        User actor = session != null ? (User) session.getAttribute("authUser") : null;
        if (actor == null) {
            throw new PortalException("Authentication required.", 401);
        }
        return actor;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = requireSessionUser(req);
            String pathInfo = req.getPathInfo();
            if (pathInfo != null && pathInfo.length() > 1) {
                int id = Integer.parseInt(pathInfo.substring(1));
                Student s = studentDAO.findById(id)
                        .orElseThrow(() -> new PortalException("Student not found.", 404));
                if (actor.getRole() == User.Role.STUDENT && s.getUserId() != actor.getUserId()) {
                    throw new PortalException("Access denied.", 403);
                }
                if (actor.isFacultyRole() && !UserDAO.branchMatchesScope(s.getBranch(), actor.getAssignedBranches())) {
                    throw new PortalException("Access denied: student belongs outside your assigned department scope.", 403);
                }
                JsonUtil.sendSuccess(resp, 200, s);
                return;
            }
            String q = req.getParameter("q");
            String branch = req.getParameter("branch");
            String deptId = req.getParameter("deptId");
            Integer gradYear = parseIntOrNull(req.getParameter("gradYear"));
            Double minCgpa = parseDoubleOrNull(req.getParameter("minCgpa"));
            String academicYear = req.getParameter("academicYear");
            Integer semester = parseIntOrNull(req.getParameter("semester"));
            String section = req.getParameter("section");

            List<Student> students;
            if (actor.isFacultyRole()) {
                students = studentDAO.searchAndFilterForFaculty(
                        q, branch, deptId, gradYear, minCgpa, academicYear, semester, section, actor.getAssignedBranches()
                );
            } else {
                students = studentDAO.searchAndFilter(q, branch, deptId, gradYear, minCgpa, academicYear, semester, section);
            }
            JsonUtil.sendSuccess(resp, 200, students);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 400, "Invalid student query parameters.");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = requireSessionUser(req);
            if (!actor.isPlacementAdmin() && !actor.isFacultyRole()) {
                throw new PortalException("Staff privileges required.", 403);
            }
            Student s = JsonUtil.readBody(req, Student.class);
            if (actor.isFacultyRole() && !UserDAO.branchMatchesScope(s.getBranch(), actor.getAssignedBranches())) {
                throw new PortalException("Access denied: cannot create student outside your assigned department branches.", 403);
            }
            ValidationUtil.validateRollNumber(s.getRollNumber());
            ValidationUtil.requireNonEmpty(s.getFullName(), "Full Name");
            ValidationUtil.validateEmail(s.getEmail());
            ValidationUtil.validatePhone(s.getPhone());
            ValidationUtil.validateCgpa(s.getCgpa());
            JsonUtil.sendSuccess(resp, 201, studentDAO.save(s));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = requireSessionUser(req);
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            Student existing = studentDAO.findById(id)
                    .orElseThrow(() -> new PortalException("Student not found.", 404));
            if (actor.getRole() == User.Role.STUDENT && existing.getUserId() != actor.getUserId()) {
                throw new PortalException("Access denied.", 403);
            }
            if (actor.isFacultyRole() && !UserDAO.branchMatchesScope(existing.getBranch(), actor.getAssignedBranches())) {
                throw new PortalException("Access denied: student belongs outside your assigned department scope.", 403);
            }
            Student s = JsonUtil.readBody(req, Student.class);
            if (actor.isFacultyRole() && s.getBranch() != null && !UserDAO.branchMatchesScope(s.getBranch(), actor.getAssignedBranches())) {
                throw new PortalException("Access denied: cannot reassign student outside your assigned department branches.", 403);
            }
            s.setStudentId(id);
            ValidationUtil.validateCgpa(s.getCgpa());
            if (!studentDAO.update(s)) {
                throw new PortalException("Student not found.", 404);
            }
            JsonUtil.sendSuccess(resp, 200, studentDAO.findById(id).orElse(s));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            User actor = requireSessionUser(req);
            if (!actor.isPlacementAdmin() && !actor.isFacultyRole()) {
                throw new PortalException("Staff privileges required.", 403);
            }
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            Student existing = studentDAO.findById(id)
                    .orElseThrow(() -> new PortalException("Student not found.", 404));
            if (actor.isFacultyRole() && !UserDAO.branchMatchesScope(existing.getBranch(), actor.getAssignedBranches())) {
                throw new PortalException("Access denied: cannot delete student outside your assigned department scope.", 403);
            }
            if (!studentDAO.deleteById(id)) {
                throw new PortalException("Student not found.", 404);
            }
            JsonUtil.sendSuccess(resp, 200, Map.of("deleted", true));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    private Integer parseIntOrNull(String v) {
        return (v != null && !v.isBlank()) ? Integer.parseInt(v.trim()) : null;
    }

    private Double parseDoubleOrNull(String v) {
        return (v != null && !v.isBlank()) ? Double.parseDouble(v.trim()) : null;
    }
}
