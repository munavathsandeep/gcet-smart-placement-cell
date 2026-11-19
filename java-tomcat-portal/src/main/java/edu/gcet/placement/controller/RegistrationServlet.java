package edu.gcet.placement.controller;

import edu.gcet.placement.model.Recruiter;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.User;
import edu.gcet.placement.service.AuthenticationService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Handles self-service student registration (/api/auth/register) and
 * corporate recruiter registration with Pending administrator approval (/api/auth/register-recruiter).
 */
@WebServlet(urlPatterns = {"/api/auth/register", "/api/auth/register-recruiter"})
public class RegistrationServlet extends HttpServlet {
    private final AuthenticationService authenticationService = new AuthenticationService();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String servletPath = req.getServletPath();
        try {
            if ("/api/auth/register".equals(servletPath)) {
                handleStudentRegister(req, resp);
            } else if ("/api/auth/register-recruiter".equals(servletPath)) {
                handleRecruiterRegister(req, resp);
            } else {
                JsonUtil.sendError(resp, 404, "Unknown registration endpoint.");
            }
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 500, "Registration service error.");
        }
    }

    private void handleStudentRegister(HttpServletRequest req, HttpServletResponse resp) throws IOException, PortalException {
        Map<?, ?> body = JsonUtil.readBody(req, Map.class);
        Student s = new Student();
        s.setRollNumber(str(body.get("rollNumber")));
        s.setFullName(str(body.get("fullName")));
        s.setEmail(str(body.get("email")));
        s.setPhone(str(body.get("phone")));
        s.setDeptId(intVal(body.get("deptId"), 1));
        s.setBranchId(intVal(body.get("branchId"), 0));
        s.setBranch(str(body.get("branch")));
        s.setSemester(intVal(body.get("semester"), 7));
        String section = str(body.get("section"));
        s.setSection(section.isEmpty() ? "A" : section);
        s.setGraduationYear(intVal(body.get("graduationYear"), 2027));
        s.setCgpa(doubleVal(body.get("cgpa"), 0.0));
        String password = body.get("password") != null ? String.valueOf(body.get("password")) : "";

        Student created = authenticationService.registerStudent(s, password);
        HttpSession session = req.getSession(true);
        session.setAttribute("authUser", created);
        session.setAttribute("authRole", created.getRole().name());
        session.setAttribute("dashboardRoute", created.getDashboardRoute());

        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", created.getUserId());
        payload.put("studentId", created.getStudentId());
        payload.put("username", created.getUsername());
        payload.put("email", created.getEmail());
        payload.put("fullName", created.getFullName());
        payload.put("assignedBranch", created.getBranch());
        payload.put("role", User.Role.STUDENT.name());
        payload.put("dashboardRoute", created.getDashboardRoute());
        payload.put("dashboardPath", created.getDashboardPath());
        payload.put("mustChangePassword", false);
        JsonUtil.sendSuccess(resp, 201, payload);
    }

    private int intVal(Object o, int def) {
        if (o instanceof Number n) return n.intValue();
        if (o != null) {
            try {
                return Integer.parseInt(String.valueOf(o).trim());
            } catch (NumberFormatException ignored) {}
        }
        return def;
    }

    private double doubleVal(Object o, double def) {
        if (o instanceof Number n) return n.doubleValue();
        if (o != null) {
            try {
                return Double.parseDouble(String.valueOf(o).trim());
            } catch (NumberFormatException ignored) {}
        }
        return def;
    }

    private void handleRecruiterRegister(HttpServletRequest req, HttpServletResponse resp) throws IOException, PortalException {
        Map<?, ?> body = JsonUtil.readBody(req, Map.class);
        Recruiter created = authenticationService.registerPendingRecruiter(
                str(body.get("companyName")),
                str(body.get("industry")),
                str(body.get("officialWebsite")),
                str(body.get("headquarters")),
                str(body.get("fullName")),
                str(body.get("designation")),
                str(body.get("email")),
                str(body.get("phone")),
                body.get("password") != null ? String.valueOf(body.get("password")) : ""
        );
        // No authenticated session issued — pending administrator verification
        JsonUtil.sendSuccess(resp, 201, Map.of(
                "pendingApproval", true,
                "approvalStatus", "Pending",
                "username", created.getUsername(),
                "email", created.getEmail(),
                "message", "Recruiter registration submitted and pending administrator approval."
        ));
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
