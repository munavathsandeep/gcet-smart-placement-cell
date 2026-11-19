package announcements;

import edu.gcet.placement.service.AnnouncementSyncService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AnnouncementClassifierTest {

    private final AnnouncementSyncService syncService = new AnnouncementSyncService();

    @Test
    void classifiesOfficialCollegeNoticesIntoExpectedCategories() {
        assertEquals("Semester Examination Timetables",
                syncService.classifyCategory("B.Tech IV Year End Semester Exam Timetable Nov 2026"));
        assertEquals("Results Notifications",
                syncService.classifyCategory("JNTUH Autonomous Revaluation Result Declared"));
        assertEquals("Placement Notifications",
                syncService.classifyCategory("On-Campus Placement Drive for 2027 Batch — TCS Digital"));
        assertEquals("Internship Opportunities",
                syncService.classifyCategory("Summer Software Internship Stipend Offer Open"));
        assertEquals("Hackathons",
                syncService.classifyCategory("Smart India Hackathon Internal Selection Round"));
        assertEquals("College Announcements",
                syncService.classifyCategory("Annual Alumni Meet Circular on Campus"));
    }
}
