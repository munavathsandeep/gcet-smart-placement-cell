package edu.gcet.placement.service;

import edu.gcet.placement.model.*;

import java.util.*;

/**
 * Deterministic Company Matching Algorithm.
 *
 * Match Percentage Formula (0 - 100%):
 *   1. Skill Alignment Score (60% weight): Weighted ratio of min(studentLevel, requiredLevel) / requiredLevel across all required skills.
 *   2. CGPA Margin Score     (25% weight): 25% if studentCgpa >= minCgpa, scaled linearly downward if below.
 *   3. Branch & Batch Fit    (15% weight): 10% for eligible branch + 5% for matching graduation year.
 */
public class CompanyMatchingService {
    private final EligibilityService eligibilityService = new EligibilityService();

    public List<CompanyMatch> matchStudentToDrives(Student student, List<PlacementDrive> drives) {
        Map<Integer, Integer> studentSkills = new HashMap<>();
        for (StudentSkill ss : student.getSkills()) {
            studentSkills.put(ss.getSkillId(), ss.getProficiencyLevel());
        }

        List<CompanyMatch> matches = new ArrayList<>();
        for (PlacementDrive drive : drives) {
            if ("Cancelled".equalsIgnoreCase(drive.getDriveStatus())) continue;

            EligibilityResult elig = eligibilityService.evaluate(student, drive);
            CompanyMatch match = new CompanyMatch();
            match.setDriveId(drive.getDriveId());
            match.setCompanyId(drive.getCompanyId());
            match.setCompanyName(drive.getCompanyName());
            match.setJobRole(drive.getJobRole());
            match.setSalaryPackage(drive.getSalaryPackage());
            match.setEligible(elig.isEligible());

            double weightedEarned = 0.0;
            double weightedTotal = 0.0;
            List<String> matching = new ArrayList<>();
            List<String> missing = new ArrayList<>();

            for (PlacementDrive.RequiredSkill req : drive.getRequiredSkills()) {
                double w = req.getWeightage() > 0 ? req.getWeightage() : 1.0;
                weightedTotal += w * req.getRequiredLevel();
                int own = studentSkills.getOrDefault(req.getSkillId(), 0);
                weightedEarned += w * Math.min(own, req.getRequiredLevel());

                if (own >= req.getRequiredLevel()) {
                    matching.add(req.getSkillName() + " (" + own + "/" + req.getRequiredLevel() + ")");
                } else {
                    missing.add(req.getSkillName() + " (" + own + "/" + req.getRequiredLevel() + ")");
                }
            }

            double skillScore = weightedTotal > 0 ? (weightedEarned / weightedTotal) * 60.0 : 60.0;
            double cgpaRatio = drive.getMinCgpa() > 0 ? Math.min(student.getCgpa() / drive.getMinCgpa(), 1.0) : 1.0;
            double cgpaScore = cgpaRatio * 25.0;

            boolean branchOk = drive.getEligibleBranches() != null &&
                    Arrays.stream(drive.getEligibleBranches().split(","))
                          .anyMatch(b -> b.trim().equalsIgnoreCase(student.getBranch()));
            double academicFit = (branchOk ? 10.0 : 0.0) + (student.getGraduationYear() == drive.getGraduationYear() ? 5.0 : 0.0);

            double totalMatch = Math.round((skillScore + cgpaScore + academicFit) * 10.0) / 10.0;
            match.setMatchPercentage(Math.min(100.0, totalMatch));
            match.setMatchingSkills(matching);
            match.setMissingSkills(missing);
            match.setAlgorithmBreakdown(String.format("Skills %.1f/60 + CGPA %.1f/25 + Academic Fit %.1f/15",
                    skillScore, cgpaScore, academicFit));
            matches.add(match);
        }

        matches.sort(Comparator.comparingDouble(CompanyMatch::getMatchPercentage).reversed());
        return matches;
    }
}
