package edu.gcet.placement.controller;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import edu.gcet.placement.model.User;
import edu.gcet.placement.service.AnalyticsService;
import edu.gcet.placement.util.JsonUtil;
import edu.gcet.placement.util.PortalException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Provides live Institutional Registration Statistics JSON and downloadable PDF / Excel (.xlsx) / CSV reports.
 * Strictly restricted to Principal, Vice Chairman, Chairman, and authorized Faculty Coordinators.
 */
@WebServlet("/api/reports/registrations/*")
public class RegistrationReportServlet extends HttpServlet {
    private final AnalyticsService analyticsService = new AnalyticsService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        User authUser = (session != null) ? (User) session.getAttribute("authUser") : null;
        if (authUser == null) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required.");
            return;
        }
        if (!authUser.canAccessRegistrationReports()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN,
                    "Forbidden: Only Principal, Vice Chairman, Chairman, and authorized Faculty Coordinators may access institutional registration reports.");
            return;
        }

        String pathInfo = req.getPathInfo();
        try {
            Map<String, Object> report = analyticsService.getInstitutionalRegistrationStats();
            if (pathInfo == null || pathInfo.isBlank() || "/".equals(pathInfo)) {
                JsonUtil.sendSuccess(resp, 200, report);
                return;
            }
            if ("/export".equalsIgnoreCase(pathInfo)) {
                String fmt = req.getParameter("format");
                String format = fmt == null ? "csv" : fmt.trim().toLowerCase();
                String dateStamp = LocalDate.now().toString();
                switch (format) {
                    case "pdf" -> {
                        byte[] pdf = buildPdf(report);
                        resp.setContentType("application/pdf");
                        resp.setHeader("Content-Disposition",
                                "attachment; filename=\"gcet-registration-report-" + dateStamp + ".pdf\"");
                        resp.setContentLength(pdf.length);
                        resp.getOutputStream().write(pdf);
                    }
                    case "xlsx" -> {
                        byte[] xlsx = buildExcel(report);
                        resp.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                        resp.setHeader("Content-Disposition",
                                "attachment; filename=\"gcet-registration-report-" + dateStamp + ".xlsx\"");
                        resp.setContentLength(xlsx.length);
                        resp.getOutputStream().write(xlsx);
                    }
                    case "csv" -> {
                        byte[] csv = buildCsv(report);
                        resp.setContentType("text/csv; charset=UTF-8");
                        resp.setHeader("Content-Disposition",
                                "attachment; filename=\"gcet-registration-report-" + dateStamp + ".csv\"");
                        resp.setContentLength(csv.length);
                        resp.getOutputStream().write(csv);
                    }
                    default -> JsonUtil.sendError(resp, 400, "Unsupported format. Use pdf, xlsx, or csv.");
                }
                return;
            }
            JsonUtil.sendError(resp, 404, "Unknown registration report endpoint.");
        } catch (PortalException e) {
            JsonUtil.sendError(resp, e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            JsonUtil.sendError(resp, 500, "Unable to generate institutional registration report.");
        }
    }

    @SuppressWarnings("unchecked")
    private byte[] buildPdf(Map<String, Object> report) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font titleFont = new Font(Font.HELVETICA, 15, Font.BOLD, new Color(16, 26, 53));
        Font subFont = new Font(Font.HELVETICA, 10, Font.BOLD, new Color(36, 107, 253));
        Font bodyFont = new Font(Font.HELVETICA, 9, Font.NORMAL, Color.DARK_GRAY);
        Font hdrFont = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);

        Paragraph pInst = new Paragraph(String.valueOf(report.get("institutionName")), subFont);
        Paragraph pTitle = new Paragraph("Automatic Institutional Registration Report", titleFont);
        Paragraph pTime = new Paragraph("Generated UTC: " + report.get("lastUpdated"), bodyFont);
        pTime.setSpacingAfter(12f);
        doc.add(pInst);
        doc.add(pTitle);
        doc.add(pTime);

        Map<String, Object> approvals = (Map<String, Object>) report.get("approvalStatusCounts");
        PdfPTable sumTable = new PdfPTable(2);
        sumTable.setWidthPercentage(100);
        sumTable.setSpacingAfter(12f);
        addHeaderCell(sumTable, "Institutional Metric", hdrFont, new Color(16, 26, 53));
        addHeaderCell(sumTable, "Count", hdrFont, new Color(16, 26, 53));
        addRow(sumTable, bodyFont, "Total Registered Members (Deduplicated)", String.valueOf(report.get("totalRegisteredMembers")));
        addRow(sumTable, bodyFont, "Active Portal User Accounts", String.valueOf(report.get("totalActiveUsers")));
        addRow(sumTable, bodyFont, "Total Student Profiles", String.valueOf(report.get("totalStudentProfiles")));
        addRow(sumTable, bodyFont, "Active Faculty Coordinators", String.valueOf(report.get("totalFacultyMembers")));
        addRow(sumTable, bodyFont, "Executive Leadership", String.valueOf(report.get("totalExecutiveLeadership")));
        addRow(sumTable, bodyFont, "Admins & Placement Officers", String.valueOf(report.get("totalAdministrators")));
        addRow(sumTable, bodyFont, "Corporate Recruiters", String.valueOf(report.get("totalRecruiters")));
        addRow(sumTable, bodyFont, "Approval Status (Approved / Pending / Rejected)",
                approvals.get("Approved") + " / " + approvals.get("Pending") + " / " + approvals.get("Rejected"));
        doc.add(sumTable);

        Paragraph roleTitle = new Paragraph("Role-Wise Account Breakdown (All 9 Institutional Roles)", subFont);
        roleTitle.setSpacingAfter(6f);
        doc.add(roleTitle);
        PdfPTable roleTable = new PdfPTable(4);
        roleTable.setWidthPercentage(100);
        roleTable.setSpacingAfter(12f);
        addHeaderCell(roleTable, "Role Code", hdrFont, new Color(36, 107, 253));
        addHeaderCell(roleTable, "Role Designation", hdrFont, new Color(36, 107, 253));
        addHeaderCell(roleTable, "Active", hdrFont, new Color(36, 107, 253));
        addHeaderCell(roleTable, "Total", hdrFont, new Color(36, 107, 253));
        for (Map<String, Object> r : (List<Map<String, Object>>) report.get("roleCounts")) {
            roleTable.addCell(new Phrase(String.valueOf(r.get("role")), bodyFont));
            roleTable.addCell(new Phrase(String.valueOf(r.get("label")), bodyFont));
            roleTable.addCell(new Phrase(String.valueOf(r.get("activeCount")), bodyFont));
            roleTable.addCell(new Phrase(String.valueOf(r.get("totalCount")), bodyFont));
        }
        doc.add(roleTable);

        Paragraph deptTitle = new Paragraph("Department-Wise Faculty & Student Counts", subFont);
        deptTitle.setSpacingAfter(6f);
        doc.add(deptTitle);
        PdfPTable deptTable = new PdfPTable(5);
        deptTable.setWidthPercentage(100);
        addHeaderCell(deptTable, "Dept Code", hdrFont, new Color(16, 26, 53));
        addHeaderCell(deptTable, "Department Name", hdrFont, new Color(16, 26, 53));
        addHeaderCell(deptTable, "Faculty", hdrFont, new Color(16, 26, 53));
        addHeaderCell(deptTable, "Students", hdrFont, new Color(16, 26, 53));
        addHeaderCell(deptTable, "Placed", hdrFont, new Color(16, 26, 53));
        for (Map<String, Object> d : (List<Map<String, Object>>) report.get("departmentStats")) {
            deptTable.addCell(new Phrase(String.valueOf(d.get("deptCode")), bodyFont));
            deptTable.addCell(new Phrase(String.valueOf(d.get("deptName")), bodyFont));
            deptTable.addCell(new Phrase(String.valueOf(d.get("facultyCount")), bodyFont));
            deptTable.addCell(new Phrase(String.valueOf(d.get("studentCount")), bodyFont));
            deptTable.addCell(new Phrase(String.valueOf(d.get("placedCount")), bodyFont));
        }
        doc.add(deptTable);

        doc.close();
        return out.toByteArray();
    }

    private void addHeaderCell(PdfPTable table, String text, Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setPadding(6f);
        cell.setHorizontalAlignment(Element.ALIGN_LEFT);
        table.addCell(cell);
    }

    private void addRow(PdfPTable table, Font font, String label, String value) {
        table.addCell(new Phrase(label, font));
        table.addCell(new Phrase(value, font));
    }

    @SuppressWarnings("unchecked")
    private byte[] buildExcel(Map<String, Object> report) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle hdrStyle = wb.createCellStyle();
            org.apache.poi.ss.usermodel.Font hdrFont = wb.createFont();
            hdrFont.setBold(true);
            hdrFont.setColor(IndexedColors.WHITE.getIndex());
            hdrStyle.setFont(hdrFont);
            hdrStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            hdrStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Sheet s1 = wb.createSheet("Registration Summary");
            s1.createRow(0).createCell(0).setCellValue(String.valueOf(report.get("institutionName")));
            s1.createRow(1).createCell(0).setCellValue("Automatic Institutional Registration Report — " + report.get("lastUpdated"));
            Row h1 = s1.createRow(3);
            setStyledCell(h1, 0, "Metric", hdrStyle);
            setStyledCell(h1, 1, "Count", hdrStyle);
            int rIdx = 4;
            Object[][] summaryRows = {
                    {"Total Registered Members (Deduplicated)", report.get("totalRegisteredMembers")},
                    {"Active Portal User Accounts", report.get("totalActiveUsers")},
                    {"Total Student Profiles", report.get("totalStudentProfiles")},
                    {"Active Faculty Coordinators", report.get("totalFacultyMembers")},
                    {"Executive Leadership", report.get("totalExecutiveLeadership")},
                    {"Admins & Placement Officers", report.get("totalAdministrators")},
                    {"Corporate Recruiters", report.get("totalRecruiters")}
            };
            for (Object[] sr : summaryRows) {
                Row row = s1.createRow(rIdx++);
                row.createCell(0).setCellValue(String.valueOf(sr[0]));
                row.createCell(1).setCellValue(((Number) sr[1]).doubleValue());
            }
            rIdx++;
            Row rh = s1.createRow(rIdx++);
            setStyledCell(rh, 0, "Role Code", hdrStyle);
            setStyledCell(rh, 1, "Role Designation", hdrStyle);
            setStyledCell(rh, 2, "Active", hdrStyle);
            setStyledCell(rh, 3, "Total", hdrStyle);
            for (Map<String, Object> r : (List<Map<String, Object>>) report.get("roleCounts")) {
                Row row = s1.createRow(rIdx++);
                row.createCell(0).setCellValue(String.valueOf(r.get("role")));
                row.createCell(1).setCellValue(String.valueOf(r.get("label")));
                row.createCell(2).setCellValue(((Number) r.get("activeCount")).doubleValue());
                row.createCell(3).setCellValue(((Number) r.get("totalCount")).doubleValue());
            }
            for (int c = 0; c < 4; c++) s1.autoSizeColumn(c);

            Sheet s2 = wb.createSheet("Department Breakdown");
            Row dh = s2.createRow(0);
            setStyledCell(dh, 0, "Dept Code", hdrStyle);
            setStyledCell(dh, 1, "Department Name", hdrStyle);
            setStyledCell(dh, 2, "HOD", hdrStyle);
            setStyledCell(dh, 3, "Faculty", hdrStyle);
            setStyledCell(dh, 4, "Coordinators", hdrStyle);
            setStyledCell(dh, 5, "Students", hdrStyle);
            setStyledCell(dh, 6, "Placed", hdrStyle);
            int dIdx = 1;
            for (Map<String, Object> d : (List<Map<String, Object>>) report.get("departmentStats")) {
                Row row = s2.createRow(dIdx++);
                row.createCell(0).setCellValue(String.valueOf(d.get("deptCode")));
                row.createCell(1).setCellValue(String.valueOf(d.get("deptName")));
                row.createCell(2).setCellValue(String.valueOf(d.get("hodName")));
                row.createCell(3).setCellValue(((Number) d.get("facultyCount")).doubleValue());
                row.createCell(4).setCellValue(((Number) d.get("assignedCoordinatorCount")).doubleValue());
                row.createCell(5).setCellValue(((Number) d.get("studentCount")).doubleValue());
                row.createCell(6).setCellValue(((Number) d.get("placedCount")).doubleValue());
            }
            for (int c = 0; c < 7; c++) s2.autoSizeColumn(c);

            wb.write(out);
            return out.toByteArray();
        }
    }

    private void setStyledCell(Row row, int col, String text, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(text);
        cell.setCellStyle(style);
    }

    @SuppressWarnings("unchecked")
    private byte[] buildCsv(Map<String, Object> report) {
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');
        sb.append(csv(report.get("institutionName"))).append("\r\n");
        sb.append("Automatic Institutional Registration Report — GCET Smart Placement Cell\r\n");
        sb.append("Generated UTC,").append(csv(report.get("lastUpdated"))).append("\r\n\r\n");
        sb.append("Summary Metric,Count\r\n");
        sb.append("Total Registered Members (Deduplicated),").append(report.get("totalRegisteredMembers")).append("\r\n");
        sb.append("Active Portal User Accounts,").append(report.get("totalActiveUsers")).append("\r\n");
        sb.append("Total Student Profiles,").append(report.get("totalStudentProfiles")).append("\r\n");
        sb.append("Active Faculty Coordinators,").append(report.get("totalFacultyMembers")).append("\r\n\r\n");
        sb.append("Role Code,Role Designation,Active Accounts,Total Accounts\r\n");
        for (Map<String, Object> r : (List<Map<String, Object>>) report.get("roleCounts")) {
            sb.append(csv(r.get("role"))).append(',')
              .append(csv(r.get("label"))).append(',')
              .append(r.get("activeCount")).append(',')
              .append(r.get("totalCount")).append("\r\n");
        }
        sb.append("\r\nDept Code,Department Name,HOD Name,Faculty,Assigned Coordinators,Students,Placed\r\n");
        for (Map<String, Object> d : (List<Map<String, Object>>) report.get("departmentStats")) {
            sb.append(csv(d.get("deptCode"))).append(',')
              .append(csv(d.get("deptName"))).append(',')
              .append(csv(d.get("hodName"))).append(',')
              .append(d.get("facultyCount")).append(',')
              .append(d.get("assignedCoordinatorCount")).append(',')
              .append(d.get("studentCount")).append(',')
              .append(d.get("placedCount")).append("\r\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String csv(Object o) {
        String s = o == null ? "" : String.valueOf(o);
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
