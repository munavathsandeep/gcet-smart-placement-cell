package edu.gcet.placement.util;

import java.util.regex.Pattern;

/**
 * Server-side input sanitization and domain validation rules.
 */
public final class ValidationUtil {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^[+]?[0-9\\s-]{10,18}$");
    private static final Pattern ROLL_PATTERN = Pattern.compile("^[A-Za-z0-9]{6,20}$");

    private ValidationUtil() {}

    public static String sanitize(String value) {
        if (value == null) return "";
        return value.trim()
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    public static void requireNonEmpty(String value, String fieldName) throws PortalException {
        if (value == null || value.trim().isEmpty()) {
            throw new PortalException(fieldName + " is required.", 400);
        }
    }

    public static void validateEmail(String email) throws PortalException {
        requireNonEmpty(email, "Email");
        if (!EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw new PortalException("Invalid email format.", 400);
        }
    }

    public static void validatePhone(String phone) throws PortalException {
        requireNonEmpty(phone, "Phone number");
        if (!PHONE_PATTERN.matcher(phone.trim()).matches()) {
            throw new PortalException("Invalid phone number format.", 400);
        }
    }

    public static void validateRollNumber(String roll) throws PortalException {
        requireNonEmpty(roll, "Roll number");
        if (!ROLL_PATTERN.matcher(roll.trim()).matches()) {
            throw new PortalException("Roll number must be 6-20 alphanumeric characters.", 400);
        }
    }

    public static void validateCgpa(double cgpa) throws PortalException {
        if (cgpa < 0.0 || cgpa > 10.0) {
            throw new PortalException("CGPA must be between 0.00 and 10.00.", 400);
        }
    }

    public static void validateProficiency(int level) throws PortalException {
        if (level < 1 || level > 5) {
            throw new PortalException("Skill proficiency level must be between 1 and 5.", 400);
        }
    }
}
