package faculty;

import edu.gcet.placement.dao.UserDAO;
import edu.gcet.placement.model.Faculty;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FacultyIsolationTest {

    @Test
    void cseCoordinatorOnlyMatchesCseAndEmergingBranches() {
        Faculty lavanya = new Faculty(
                10, "faculty_lavanya", "lavanya@gcet.edu.in", "B. Laxmi Lavanya",
                "CSE Coordinator", "CSE & Emerging Technologies",
                List.of("CSE", "CSE-AIML", "CSE-DS")
        );

        assertTrue(UserDAO.branchMatchesScope("CSE", lavanya.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("CSE-AIML", lavanya.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("CSE-DS", lavanya.getAssignedBranches()));

        assertFalse(UserDAO.branchMatchesScope("IT", lavanya.getAssignedBranches()));
        assertFalse(UserDAO.branchMatchesScope("ECE", lavanya.getAssignedBranches()));
        assertFalse(UserDAO.branchMatchesScope("MECH", lavanya.getAssignedBranches()));
    }

    @Test
    void iotCoordinatorHandlesAliasesAcrossIotItAndCs() {
        Faculty aparna = new Faculty(
                11, "faculty_aparna", "aparna@gcet.edu.in", "P. Aparna",
                "IOT Coordinator", "IOT, IT & CS",
                List.of("IOT", "IT", "CS")
        );

        assertTrue(UserDAO.branchMatchesScope("IOT", aparna.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("CSE-IoT", aparna.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("IT", aparna.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("CSE-CS", aparna.getAssignedBranches()));

        assertFalse(UserDAO.branchMatchesScope("CSE", aparna.getAssignedBranches()));
        assertFalse(UserDAO.branchMatchesScope("EEE", aparna.getAssignedBranches()));
    }

    @Test
    void eceCoordinatorHandlesCoreEngineeringBranchAliases() {
        Faculty rajashakar = new Faculty(
                12, "faculty_rajashakar", "rajashakar@gcet.edu.in", "S. Raja Shakar Reddy",
                "ECE Coordinator", "Electrical & Electronics",
                List.of("EEE", "ECE", "MECH", "CIVIL")
        );

        assertTrue(UserDAO.branchMatchesScope("EEE", rajashakar.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("ECE", rajashakar.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("ME", rajashakar.getAssignedBranches()));
        assertTrue(UserDAO.branchMatchesScope("CE", rajashakar.getAssignedBranches()));

        assertFalse(UserDAO.branchMatchesScope("CSE-AIML", rajashakar.getAssignedBranches()));
        assertFalse(UserDAO.branchMatchesScope("IT", rajashakar.getAssignedBranches()));
    }
}
