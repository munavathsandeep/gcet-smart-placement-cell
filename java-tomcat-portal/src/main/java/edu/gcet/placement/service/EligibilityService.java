package edu.gcet.placement.service;

import edu.gcet.placement.model.EligibilityResult;
import edu.gcet.placement.model.PlacementDrive;
import edu.gcet.placement.model.Student;
import edu.gcet.placement.model.StudentSkill;

import java.util.*;

/**
 * Deterministic Java eligibility verification engine checking CGPA, branch,
 * graduation year, and mandatory drive skill requirements.
 */
public class EligibilityService {

    public EligibilityResult evaluate(Student student, PlacementDrive drive) {
        EligibilityResult result = new EligibilityResult();
        result.setStudentId(student.getStudentId());
        result.setStudentName(student.getFullName());
        result.setRollNumber(student.getRollNumber());
        result.setDriveId(drive.getDriveId());
        result.setCompanyName(drive.getCompanyName());
        result.setJobRole(drive.getJobRole());

        List<String> rejections = new ArrayList<>();
        List<String> met = new ArrayList<>();
        List<String> missingSkills = new ArrayList<>();

        // 1. CGPA Check
        if (student.getCgpa() >= drive.getMinCgpa()) {
            met.add(String.format("CGPA %.2f meets minimum %.2f", student.getCgpa(), drive.getMinCgpa()));
        } else {
            rejections.add(String.format("CGPA %.2f is below required %.2f", student.getCgpa(), drive.getMinCgpa()));
        }

        // 2. Branch Eligibility Check
        Set<String> allowedBranches = new HashSet<>();
        if (drive.getEligibleBranches() != null) {
            for (String b : drive.getEligibleBranches().split(",")) {
                allowedBranches.add(b.trim().toUpperCase());
            }
        }
        if (allowedBranches.contains(student.getBranch().toUpperCase())) {
            met.add("Branch " + student.getBranch() + " is eligible");
        } else {
            rejections.add("Branch " + student.getBranch() + " not in eligible list (" + drive.getEligibleBranches() + ")");
        }

        // 3. Graduation Year Check
        if (student.getGraduationYear() == drive.getGraduationYear()) {
            met.add("Graduation batch " + student.getGraduationYear() + " matches");
        } else {
            rejections.add("Graduation year " + student.getGraduationYear() + " does not match target batch " + drive.getGraduationYear());
        }

        // 4. Active Backlogs Check
        if (student.getActiveBacklogs() <= drive.getMaxBacklogs()) {
            met.add("Active backlogs (" + student.getActiveBacklogs() + ") within limit (" + drive.getMaxBacklogs() + ")");
        } else {
            rejections.add("Active backlogs (" + student.getActiveBacklogs() + ") exceed maximum allowed (" + drive.getMaxBacklogs() + ")");
        }

        // 5. Required Skills Check
        Map<Integer, Integer> studentSkillMap = new HashMap<>();
        for (StudentSkill ss : student.getSkills()) {
            studentSkillMap.put(ss.getSkillId(), ss.getProficiencyLevel());
        }
        for (PlacementDrive.RequiredSkill req : drive.getRequiredSkills()) {
            int level = studentSkillMap.getOrDefault(req.getSkillId(), 0);
            if (level == 0) {
                missingSkills.add(req.getSkillName() + " (Required: " + req.getRequiredLevel() + "/5)");
                rejections.add("Missing required skill: " + req.getSkillName());
            } else if (level < req.getRequiredLevel()) {
                missingSkills.add(req.getSkillName() + " (Current: " + level + "/5, Required: " + req.getRequiredLevel() + "/5)");
                rejections.add(req.getSkillName() + " proficiency " + level + "/5 below required " + req.getRequiredLevel() + "/5");
            } else {
                met.add(req.getSkillName() + " (" + level + "/5 >= " + req.getRequiredLevel() + "/5)");
            }
        }

        result.setEligible(rejections.isEmpty());
        result.setRejectionReasons(rejections);
        result.setMissingSkills(missingSkills);
        result.setMetCriteria(met);
        return result;
    }
}
