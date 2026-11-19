package edu.gcet.placement.service;

import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.Recruiter;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.PortalException;

/**
 * Core authentication facade delegating credential verification, BCrypt matching,
 * lockout protection, and student/recruiter onboarding to MVC DAO and service layers.
 */
public class AuthenticationService {
    private final AuthService delegate = new AuthService();
    private final UserDAO userDAO = new UserDAO();

    public User login(String identifier, String rawPassword, String selectedRole, String ipAddress) throws PortalException {
        return delegate.authenticate(identifier, rawPassword, selectedRole, ipAddress);
    }

    public Student registerStudent(Student student, String rawPassword) throws PortalException {
        return delegate.registerStudent(student, rawPassword);
    }

    public Recruiter registerPendingRecruiter(
            String companyName,
            String industry,
            String website,
            String headquarters,
            String fullName,
            String designation,
            String email,
            String phone,
            String rawPassword
    ) throws PortalException {
        return delegate.registerPendingRecruiter(
                companyName, industry, website, headquarters, fullName, designation, email, phone, rawPassword
        );
    }

    public User reloadUser(int userId) throws PortalException {
        return userDAO.findById(userId).orElseThrow(() -> new PortalException("Session user not found.", 401));
    }
}
