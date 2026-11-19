package edu.gcet.placement.controller;

import edu.gcet.placement.dao.CompanyDAO;
import edu.gcet.placement.model.Company;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import edu.gcet.placement.util.ValidationUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/companies/*")
public class CompanyServlet extends HttpServlet {
    private final CompanyDAO companyDAO = new CompanyDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String q = req.getParameter("q");
            JsonUtil.sendSuccess(resp, 200, companyDAO.search(q));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            Company c = JsonUtil.readBody(req, Company.class);
            ValidationUtil.requireNonEmpty(c.getCompanyName(), "Company Name");
            ValidationUtil.requireNonEmpty(c.getIndustry(), "Industry");
            ValidationUtil.validateEmail(c.getContactEmail());
            JsonUtil.sendSuccess(resp, 201, companyDAO.save(c));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            Company c = JsonUtil.readBody(req, Company.class);
            c.setCompanyId(id);
            companyDAO.update(c);
            JsonUtil.sendSuccess(resp, 200, c);
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            int id = Integer.parseInt(req.getPathInfo().substring(1));
            companyDAO.deleteById(id);
            JsonUtil.sendSuccess(resp, 200, Map.of("deleted", true));
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        }
    }
}
