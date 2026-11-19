package edu.gcet.placement.service;

import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.PasswordUtil;
import edu.gcet.placement.util.PortalException;
import edu.gcet.placement.util.ValidationUtil;

/**
 * Password lifecycle service enforcing strong BCrypt hashing, first-login mandatory updates,
 * temporary resets, and audit logging.
 */
public class PasswordService {
    private final UserDAO userDAO = new UserDAO();

    public void changePassword(int userId, String currentPassword, String newPassword) throws PortalException {
        ValidationUtil.requireNonEmpty(currentPassword, "Current Password");
        ValidationUtil.requireNonEmpty(newPassword, "New Password");
        if (newPassword.trim().length() < 6) {
            throw new PortalException("New password must be at least 6 characters.", 400);
        }
        if (newPassword.equals(currentPassword)) {
            throw new PortalException("New password must differ from your current password.", 400);
        }
        User user = userDAO.findById(userId)
                .orElseThrow(() -> new PortalException("Account not found.", 404));
        if (!PasswordUtil.verifyPassword(currentPassword, user.getPasswordHash(), user.getPasswordSalt())) {
            throw new PortalException("Current password is incorrect.", 401);
        }
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(newPassword, salt);
        userDAO.updatePasswordByUserId(userId, user.getEmail(), hash, salt, false);
    }

    public void adminResetTemporaryPassword(int targetUserId, String tempPassword) throws PortalException {
        ValidationUtil.requireNonEmpty(tempPassword, "Temporary Password");
        if (tempPassword.trim().length() < 6) {
            throw new PortalException("Temporary password must be at least 6 characters.", 400);
        }
        User target = userDAO.findById(targetUserId)
                .orElseThrow(() -> new PortalException("Target user not found.", 404));
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(tempPassword, salt);
        userDAO.updatePasswordByUserId(targetUserId, target.getEmail(), hash, salt, true);
        userDAO.clearLoginAttempts(target.getUsername().toLowerCase());
        userDAO.clearLoginAttempts(target.getEmail().toLowerCase());
    }

    public void resetForgottenPassword(String email, String newPassword) throws PortalException {
        ValidationUtil.validateEmail(email);
        ValidationUtil.requireNonEmpty(newPassword, "New Password");
        if (newPassword.trim().length() < 6) {
            throw new PortalException("New password must be at least 6 characters.", 400);
        }
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(newPassword, salt);
        if (!userDAO.updatePassword(email.trim(), hash, salt)) {
            throw new PortalException("No account registered with that email address.", 404);
        }
    }

    public void dismissPasswordPrompt(int userId) throws PortalException {
        if (!userDAO.dismissPasswordPrompt(userId)) {
            throw new PortalException("Account not found.", 404);
        }
    }
}
