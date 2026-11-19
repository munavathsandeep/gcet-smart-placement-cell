package authentication;

import edu.gcet.placement.model.Admin;
import edu.gcet.placement.model.Faculty;
import edu.gcet.placement.model.Principal;
import edu.gcet.placement.model.Recruiter;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.User;
import edu.gcet.placement.util.PasswordUtil;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AuthServiceTest {

    @Test
    void bcryptPasswordHashAndVerifySucceedsForValidPassword() {
        String raw = "GCET@Secure2026";
        String salt = PasswordUtil.generateSalt();
        String hash = PasswordUtil.hashPassword(raw, salt);

        assertNotNull(hash);
        assertTrue(hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$"));
        assertTrue(PasswordUtil.verifyPassword(raw, hash, salt));
        assertFalse(PasswordUtil.verifyPassword("WrongPassword1!", hash, salt));
    }

    @Test
    void verifyPasswordRejectsNullInputsGracefully() {
        assertFalse(PasswordUtil.verifyPassword(null, "$2a$10$dummy", "salt"));
        assertFalse(PasswordUtil.verifyPassword("pass", null, "salt"));
    }

    @Test
    void polymorphicRoleHierarchyAndPermissionsAreStrictlyScoped() {
        User principal = new Principal(1, "principal.sagar", "principal@gcet.edu.in", "Dr. Sagar");
        User admin = new Admin(2, "admin", "admin@gcet.edu.in", "System Admin");
        User faculty = new Faculty(3, "faculty_lavanya", "lavanya@gcet.edu.in", "B. Laxmi Lavanya",
                "CSE Coordinator", "CSE & Emerging Technologies", List.of("CSE", "CSE-AIML", "CSE-DS"));
        User recruiter = new Recruiter(4, "recruiter_tcs", "campus@tcs.com", "TCS Campus Hiring", 1, "Approved");
        User student = new Student(10, 5, "23r11a0501", "Aarav Sharma", "23r11a0501@gcet.edu.in",
                "9876543210", 1, 1, "CSE", 2027, 8.75);

        assertTrue(principal.isExecutive());
        assertTrue(principal.isPlacementAdmin());
        assertEquals("EXECUTIVE", principal.getDashboardRoute());

        assertFalse(admin.isExecutive());
        assertTrue(admin.isPlacementAdmin());
        assertEquals("ADMIN", admin.getDashboardRoute());

        assertTrue(faculty.isFacultyRole());
        assertFalse(faculty.isPlacementAdmin());
        assertEquals("FACULTY", faculty.getDashboardRoute());

        assertFalse(recruiter.isPlacementAdmin());
        assertEquals("RECRUITER", recruiter.getDashboardRoute());

        assertFalse(student.isPlacementAdmin());
        assertFalse(student.isFacultyRole());
        assertEquals("STUDENT", student.getDashboardRoute());
        assertTrue(student.getDashboardPermissions().contains("ELIGIBILITY_CHECKER"));
    }
}
