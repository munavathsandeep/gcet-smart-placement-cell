package edu.gcet.placement.controller;

import edu.gcet.placement.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.Map;

/**
 * Invalidates the active Tomcat HttpSession and clears JSESSIONID on sign-out.
 */
@WebServlet("/api/auth/logout")
public class LogoutServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        performLogout(req, resp);
        JsonUtil.sendSuccess(resp, 200, Map.of("message", "Signed out successfully."));
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        performLogout(req, resp);
        String ctx = req.getContextPath();
        resp.sendRedirect((ctx == null || ctx.isEmpty() ? "" : ctx) + "/");
    }

    private void performLogout(HttpServletRequest req, HttpServletResponse resp) {
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        String ctx = req.getContextPath();
        for (String path : new String[]{"/", (ctx == null || ctx.isEmpty()) ? "/" : ctx}) {
            Cookie clearSessionCookie = new Cookie("JSESSIONID", "");
            clearSessionCookie.setMaxAge(0);
            clearSessionCookie.setPath(path);
            clearSessionCookie.setHttpOnly(true);
            resp.addCookie(clearSessionCookie);
        }
    }
}
