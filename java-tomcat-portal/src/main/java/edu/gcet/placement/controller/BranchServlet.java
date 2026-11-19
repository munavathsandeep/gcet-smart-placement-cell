package edu.gcet.placement.controller;

import edu.gcet.placement.dao.BranchDAO;
import edu.gcet.placement.model.Branch;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/branches/*")
public class BranchServlet extends HttpServlet {
    private final BranchDAO branchDAO = new BranchDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            JsonUtil.sendSuccess(resp, 200, branchDAO.findAll());
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            Branch b = JsonUtil.readBody(req, Branch.class);
            JsonUtil.sendSuccess(resp, 201, branchDAO.save(b));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
