package student;

import edu.gcet.placement.model.EligibilityResult;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.StudentSkill;
import edu.gcet.placement.service.EligibilityService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StudentEligibilityTest {

    private final EligibilityService eligibilityService = new EligibilityService();

    private PlacementDrive buildSampleDrive() {
        PlacementDrive drive = new PlacementDrive();
        drive.setDriveId(101);
        drive.setCompanyName("TCS");
        drive.setJobRole("Ninja & Digital Software Engineer");
        drive.setMinCgpa(7.50);
        drive.setEligibleBranches("CSE, CSE-AIML, IT");
        drive.setGraduationYear(2027);
        drive.setMaxBacklogs(0);
        drive.setRequiredSkills(List.of(
                new PlacementDrive.RequiredSkill(1, "Java", 4, 1.5),
                new PlacementDrive.RequiredSkill(9, "MySQL", 3, 1.0)
        ));
        return drive;
    }

    private Student buildBaseStudent() {
        Student s = new Student(1, 10, "23r11a0501", "Aarav Sharma", "23r11a0501@gcet.edu.in",
                "9876543210", 1, 1, "CSE", 2027, 8.60);
        s.setActiveBacklogs(0);
        s.setSkills(List.of(
                new StudentSkill(1, 1, "Java", "Programming", 4, true),
                new StudentSkill(1, 9, "MySQL", "Database", 4, true)
        ));
        return s;
    }

    @Test
    void evaluatesStudentAsEligibleWhenAllCriteriaAndSkillsPass() {
        EligibilityResult result = eligibilityService.evaluate(buildBaseStudent(), buildSampleDrive());
        assertTrue(result.isEligible());
        assertTrue(result.getRejectionReasons().isEmpty());
        assertTrue(result.getMissingSkills().isEmpty());
    }

    @Test
    void rejectsWhenCgpaOrBacklogsFail() {
        Student student = buildBaseStudent();
        student.setCgpa(6.95);
        student.setActiveBacklogs(2);

        EligibilityResult result = eligibilityService.evaluate(student, buildSampleDrive());
        assertFalse(result.isEligible());
        assertTrue(result.getRejectionReasons().stream().anyMatch(r -> r.contains("CGPA")));
        assertTrue(result.getRejectionReasons().stream().anyMatch(r -> r.contains("Active backlogs")));
    }

    @Test
    void rejectsWhenBranchOrRequiredSkillProficiencyInsufficient() {
        Student student = buildBaseStudent();
        student.setBranch("MECH");
        student.setSkills(List.of(new StudentSkill(1, 1, "Java", "Programming", 2, false)));

        EligibilityResult result = eligibilityService.evaluate(student, buildSampleDrive());
        assertFalse(result.isEligible());
        assertTrue(result.getRejectionReasons().stream().anyMatch(r -> r.contains("Branch")));
        assertEquals(2, result.getMissingSkills().size());
    }
}
