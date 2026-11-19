package edu.gcet.placement.controller;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Forwards authorized role dashboard paths (e.g., /principal/dashboard, /admin/dashboard,
 * /faculty-coordinator/dashboard) cleanly to /index.jsp so browser reloads keep active HttpSession state.
 */
@WebServlet(urlPatterns = {
        "/principal/*",
        "/vice-chairman/*",
        "/chairman/*",
        "/executive/*",
        "/admin/*",
        "/placement-officer/*",
        "/faculty-coordinator/*",
        "/faculty/*",
        "/student/*",
        "/recruiter/*"
})
public class PortalPageServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        req.getRequestDispatcher("/index.jsp").forward(req, resp);
    }
}
