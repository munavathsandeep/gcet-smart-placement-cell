package edu.gcet.placement.service;

import edu.gcet.placement.dao.ApplicationDAO;
import edu.gcet.placement.dao.PlacementDriveDAO;
import edu.gcet.placement.dao.StudentDAO;
import edu.gcet.placement.model.*;
import edu.gcet.placement.util.DatabaseConnection;
import edu.gcet.placement.util.PortalException;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Set;

public class ApplicationService {
    private static final Set<String> VALID_STATUSES = Set.of(
            "Applied", "Shortlisted", "Assessment", "Interview", "Selected", "Rejected"
    );

    private final ApplicationDAO applicationDAO = new ApplicationDAO();
    private final StudentDAO studentDAO = new StudentDAO();
    private final PlacementDriveDAO driveDAO = new PlacementDriveDAO();
    private final EligibilityService eligibilityService = new EligibilityService();
    private final NotificationService notificationService = new NotificationService();

    public Application applyToDrive(int studentId, int driveId) throws PortalException {
        Student student = studentDAO.findById(studentId)
                .orElseThrow(() -> new PortalException("Student not found.", 404));
        PlacementDrive drive = driveDAO.findById(driveId)
                .orElseThrow(() -> new PortalException("Placement drive not found.", 404));

        if (!"Active".equalsIgnoreCase(drive.getDriveStatus())) {
            throw new PortalException("Applications are only open for Active drives.", 400);
        }
        Date today = Date.valueOf(LocalDate.now());
        if (drive.getApplicationDeadline() != null && today.after(drive.getApplicationDeadline())) {
            throw new PortalException("Application deadline has passed.", 400);
        }
        if (applicationDAO.exists(driveId, studentId)) {
            throw new PortalException("Duplicate application prevented: already applied to this drive.", 409);
        }

        EligibilityResult elig = eligibilityService.evaluate(student, drive);
        if (!elig.isEligible()) {
            throw new PortalException("Not eligible: " + String.join("; ", elig.getRejectionReasons()), 400);
        }

        return applicationDAO.create(driveId, studentId, "Applied via GCET Portal");
    }

    public void updateApplicationStatus(int applicationId, String status, String remarks) throws PortalException {
        if (!VALID_STATUSES.contains(status)) {
            throw new PortalException("Invalid application status.", 400);
        }
        if (!applicationDAO.updateStatus(applicationId, status, remarks)) {
            throw new PortalException("Application record not found.", 404);
        }

        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT s.user_id, c.company_name, pd.job_role " +
                     "FROM applications a " +
                     "JOIN students s ON a.student_id = s.student_id " +
                     "JOIN placement_drives pd ON a.drive_id = pd.drive_id " +
                     "JOIN companies c ON pd.company_id = c.company_id " +
                     "WHERE a.application_id = ? LIMIT 1")) {
            ps.setInt(1, applicationId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int userId = rs.getInt("user_id");
                    if (userId > 0) {
                        String companyName = rs.getString("company_name");
                        String jobRole = rs.getString("job_role");
                        String msg = "Your application status for " + jobRole + " at " + companyName + " is now " + status + ".";
                        if (remarks != null && !remarks.isBlank()) {
                            msg += " Remarks: " + remarks;
                        }
                        notificationService.notifyUser(
                                userId,
                                "Application Updated: " + companyName + " (" + status + ")",
                                msg,
                                "Placement Notifications",
                                "applications"
                        );
                    }
                }
            }
        } catch (SQLException ignored) {}
    }
}
