package placement;

import edu.gcet.placement.model.CompanyMatch;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.StudentSkill;
import edu.gcet.placement.service.CompanyMatchingService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CompanyMatchingTest {

    private final CompanyMatchingService matchingService = new CompanyMatchingService();

    @Test
    void ranksStrongerSkillAndAcademicFitHigherAndExcludesCancelledDrives() {
        Student student = new Student(1, 20, "23r11a0501", "Aarav Sharma", "23r11a0501@gcet.edu.in",
                "9876543210", 1, 1, "CSE", 2027, 8.50);
        student.setSkills(List.of(
                new StudentSkill(1, 1, "Java", "Programming", 5, true),
                new StudentSkill(1, 9, "MySQL", "Database", 4, true)
        ));

        PlacementDrive idealDrive = new PlacementDrive();
        idealDrive.setDriveId(1);
        idealDrive.setCompanyId(1);
        idealDrive.setCompanyName("TCS");
        idealDrive.setJobRole("Backend Java Developer");
        idealDrive.setSalaryPackage(7.0);
        idealDrive.setMinCgpa(7.5);
        idealDrive.setEligibleBranches("CSE, IT");
        idealDrive.setGraduationYear(2027);
        idealDrive.setDriveStatus("Active");
        idealDrive.setRequiredSkills(List.of(
                new PlacementDrive.RequiredSkill(1, "Java", 4, 2.0),
                new PlacementDrive.RequiredSkill(9, "MySQL", 4, 1.0)
        ));

        PlacementDrive stretchDrive = new PlacementDrive();
        stretchDrive.setDriveId(2);
        stretchDrive.setCompanyId(2);
        stretchDrive.setCompanyName("Amazon");
        stretchDrive.setJobRole("ML Research Engineer");
        stretchDrive.setSalaryPackage(24.0);
        stretchDrive.setMinCgpa(9.0);
        stretchDrive.setEligibleBranches("CSE-AIML");
        stretchDrive.setGraduationYear(2027);
        stretchDrive.setDriveStatus("Active");
        stretchDrive.setRequiredSkills(List.of(
                new PlacementDrive.RequiredSkill(16, "Machine Learning", 5, 2.0)
        ));

        PlacementDrive cancelledDrive = new PlacementDrive();
        cancelledDrive.setDriveId(3);
        cancelledDrive.setCompanyId(3);
        cancelledDrive.setCompanyName("Old Corp");
        cancelledDrive.setDriveStatus("Cancelled");

        List<CompanyMatch> matches = matchingService.matchStudentToDrives(
                student, List.of(stretchDrive, cancelledDrive, idealDrive)
        );

        assertEquals(2, matches.size());
        assertEquals("TCS", matches.get(0).getCompanyName());
        assertEquals(100.0, matches.get(0).getMatchPercentage());
        assertTrue(matches.get(0).isEligible());

        assertEquals("Amazon", matches.get(1).getCompanyName());
        assertFalse(matches.get(1).isEligible());
        assertTrue(matches.get(0).getMatchPercentage() > matches.get(1).getMatchPercentage());
    }
}
