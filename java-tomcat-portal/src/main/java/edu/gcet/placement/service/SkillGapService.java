package edu.gcet.placement.service;

import edu.gcet.placement.model.*;

import java.util.*;

/**
 * Compares a student's skill matrix against a placement drive's required skills
 * and generates structured proficiency gaps and learning priorities.
 */
public class SkillGapService {

    public SkillGapReport analyze(Student student, PlacementDrive drive) {
        SkillGapReport report = new SkillGapReport();
        report.setStudentId(student.getStudentId());
        report.setStudentName(student.getFullName());
        report.setDriveId(drive.getDriveId());
        report.setCompanyName(drive.getCompanyName());
        report.setJobRole(drive.getJobRole());

        Map<Integer, StudentSkill> skillMap = new HashMap<>();
        for (StudentSkill ss : student.getSkills()) {
            skillMap.put(ss.getSkillId(), ss);
        }

        List<SkillGapReport.SkillComparison> comparisons = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();
        double achievedScore = 0.0;
        double maxPossibleScore = 0.0;

        for (PlacementDrive.RequiredSkill req : drive.getRequiredSkills()) {
            StudentSkill owned = skillMap.get(req.getSkillId());
            int currentLevel = owned != null ? owned.getProficiencyLevel() : 0;
            int requiredLevel = req.getRequiredLevel();
            int gap = Math.max(0, requiredLevel - currentLevel);

            SkillGapReport.SkillComparison comp = new SkillGapReport.SkillComparison();
            comp.setSkillId(req.getSkillId());
            comp.setSkillName(req.getSkillName());
            comp.setCategory(owned != null ? owned.getCategory() : "Required Skill");
            comp.setStudentLevel(currentLevel);
            comp.setRequiredLevel(requiredLevel);
            comp.setGap(gap);

            if (currentLevel == 0) {
                comp.setStatus("Missing");
                comp.setPriority("High");
                recommendations.add("Acquire foundational competency in " + req.getSkillName() + " (target " + requiredLevel + "/5).");
            } else if (gap > 0) {
                comp.setStatus("Needs Improvement");
                comp.setPriority(gap >= 2 ? "High" : "Medium");
                recommendations.add("Upgrade " + req.getSkillName() + " from " + currentLevel + "/5 to " + requiredLevel + "/5.");
            } else {
                comp.setStatus("Matched");
                comp.setPriority("Low");
            }

            maxPossibleScore += requiredLevel;
            achievedScore += Math.min(currentLevel, requiredLevel);
            comparisons.add(comp);
        }

        double readiness = maxPossibleScore > 0 ? Math.round((achievedScore / maxPossibleScore) * 1000.0) / 10.0 : 100.0;
        report.setReadinessPercentage(readiness);
        report.setComparisons(comparisons);
        report.setRecommendedActions(recommendations);
        return report;
    }
}
