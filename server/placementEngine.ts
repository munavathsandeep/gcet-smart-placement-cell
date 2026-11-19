export interface StudentRecord {
  student_id: number;
  roll_number: string;
  full_name: string;
  branch: string;
  branch_id?: number;
  academic_year?: string;
  year_of_study?: number;
  semester?: number;
  section?: string;
  graduation_year: number;
  cgpa: number;
  active_backlogs: number;
  resume_url?: string | null;
  placement_status: string;
}

export interface StudentSkillRecord {
  skill_id: number;
  skill_name: string;
  category: string;
  proficiency_level: number;
  verified: number;
}

export interface DriveRequiredSkillRecord {
  skill_id: number;
  skill_name: string;
  category: string;
  required_level: number;
  weightage: number;
}

export interface DriveRecord {
  drive_id: number;
  company_id: number;
  company_name: string;
  industry?: string;
  job_role: string;
  job_description: string;
  job_location: string;
  job_type: string;
  salary_package: number;
  compensation_label?: string | null;
  apply_url?: string | null;
  posted_date: string;
  drive_date: string;
  application_deadline: string;
  drive_status: string;
  approval_status?: string;
  min_cgpa: number;
  eligible_branches: string;
  graduation_year: number;
  max_backlogs: number;
  other_criteria: string | null;
  requiredSkills: DriveRequiredSkillRecord[];
}

export interface EligibilityResult {
  studentId: number;
  studentName: string;
  rollNumber: string;
  driveId: number;
  companyName: string;
  jobRole: string;
  eligible: boolean;
  rejectionReasons: string[];
  missingSkills: string[];
  metCriteria: string[];
}

export interface SkillComparison {
  skillId: number;
  skillName: string;
  category: string;
  studentLevel: number;
  requiredLevel: number;
  gap: number;
  status: 'Matched' | 'Needs Improvement' | 'Missing';
  priority: 'Low' | 'Medium' | 'High';
}

export interface SkillGapReport {
  studentId: number;
  studentName: string;
  driveId: number;
  companyName: string;
  jobRole: string;
  readinessPercentage: number;
  comparisons: SkillComparison[];
  recommendedActions: string[];
}

export interface CompanyMatch {
  driveId: number;
  companyId: number;
  companyName: string;
  industry: string;
  jobRole: string;
  jobType: string;
  salaryPackage: number;
  driveStatus: string;
  eligible: boolean;
  matchPercentage: number;
  matchingSkills: string[];
  missingSkills: string[];
  algorithmBreakdown: string;
}

export function evaluateEligibility(
  student: StudentRecord,
  skills: StudentSkillRecord[],
  drive: DriveRecord
): EligibilityResult {
  const rejectionReasons: string[] = [];
  const metCriteria: string[] = [];
  const missingSkills: string[] = [];

  if (student.cgpa >= drive.min_cgpa) {
    metCriteria.push(`CGPA ${student.cgpa.toFixed(2)} meets minimum ${drive.min_cgpa.toFixed(2)}`);
  } else {
    rejectionReasons.push(`CGPA ${student.cgpa.toFixed(2)} is below required ${drive.min_cgpa.toFixed(2)}`);
  }

  const allowed = (drive.eligible_branches || '')
    .split(',')
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean);

  // Strict exact branch match (CSE-AIML is never merged with CSE)
  if (allowed.includes('ALL') || allowed.includes(student.branch.toUpperCase())) {
    metCriteria.push(`Branch ${student.branch} is eligible`);
  } else {
    rejectionReasons.push(`Branch ${student.branch} is not in eligible list (${drive.eligible_branches})`);
  }

  if (student.graduation_year === drive.graduation_year) {
    metCriteria.push(`Graduation batch ${student.graduation_year} matches`);
  } else {
    rejectionReasons.push(`Graduation batch ${student.graduation_year} does not match ${drive.graduation_year}`);
  }

  const studentBacklogs = Number(student.active_backlogs ?? 0);
  const maxBacklogs = Number(drive.max_backlogs ?? 0);
  if (studentBacklogs <= maxBacklogs) {
    metCriteria.push(`Active backlogs (${studentBacklogs}) within limit (${maxBacklogs})`);
  } else {
    rejectionReasons.push(`Active backlogs (${studentBacklogs}) exceed maximum allowed (${maxBacklogs})`);
  }

  const skillMap = new Map<number, number>();
  for (const s of skills) {
    skillMap.set(s.skill_id, s.proficiency_level);
  }

  for (const req of drive.requiredSkills) {
    const level = skillMap.get(req.skill_id) ?? 0;
    if (level === 0) {
      missingSkills.push(`${req.skill_name} (Required: ${req.required_level}/5)`);
      rejectionReasons.push(`Missing required skill: ${req.skill_name}`);
    } else if (level < req.required_level) {
      missingSkills.push(`${req.skill_name} (Current: ${level}/5, Required: ${req.required_level}/5)`);
      rejectionReasons.push(`${req.skill_name} proficiency ${level}/5 below required ${req.required_level}/5`);
    } else {
      metCriteria.push(`${req.skill_name} (${level}/5 >= ${req.required_level}/5)`);
    }
  }

  return {
    studentId: student.student_id,
    studentName: student.full_name,
    rollNumber: student.roll_number,
    driveId: drive.drive_id,
    companyName: drive.company_name,
    jobRole: drive.job_role,
    eligible: rejectionReasons.length === 0,
    rejectionReasons,
    missingSkills,
    metCriteria,
  };
}

export function analyzeSkillGap(
  student: StudentRecord,
  skills: StudentSkillRecord[],
  drive: DriveRecord
): SkillGapReport {
  const skillMap = new Map<number, StudentSkillRecord>();
  for (const s of skills) {
    skillMap.set(s.skill_id, s);
  }

  const comparisons: SkillComparison[] = [];
  const recommendedActions: string[] = [];
  let achieved = 0;
  let total = 0;

  for (const req of drive.requiredSkills) {
    const owned = skillMap.get(req.skill_id);
    const currentLevel = owned ? owned.proficiency_level : 0;
    const gap = Math.max(0, req.required_level - currentLevel);

    let status: SkillComparison['status'] = 'Matched';
    let priority: SkillComparison['priority'] = 'Low';

    if (currentLevel === 0) {
      status = 'Missing';
      priority = 'High';
      recommendedActions.push(`Acquire foundational competency in ${req.skill_name} (target ${req.required_level}/5).`);
    } else if (gap > 0) {
      status = 'Needs Improvement';
      priority = gap >= 2 ? 'High' : 'Medium';
      recommendedActions.push(`Upgrade ${req.skill_name} from ${currentLevel}/5 to ${req.required_level}/5.`);
    }

    total += req.required_level;
    achieved += Math.min(currentLevel, req.required_level);

    comparisons.push({
      skillId: req.skill_id,
      skillName: req.skill_name,
      category: req.category || owned?.category || 'Core Skills',
      studentLevel: currentLevel,
      requiredLevel: req.required_level,
      gap,
      status,
      priority,
    });
  }

  const readinessPercentage = total > 0 ? Math.round((achieved / total) * 1000) / 10 : 100;

  return {
    studentId: student.student_id,
    studentName: student.full_name,
    driveId: drive.drive_id,
    companyName: drive.company_name,
    jobRole: drive.job_role,
    readinessPercentage,
    comparisons,
    recommendedActions,
  };
}

export function matchStudentToDrives(
  student: StudentRecord,
  skills: StudentSkillRecord[],
  drives: DriveRecord[]
): CompanyMatch[] {
  const skillMap = new Map<number, number>();
  for (const s of skills) {
    skillMap.set(s.skill_id, s.proficiency_level);
  }

  const matches: CompanyMatch[] = [];
  for (const drive of drives) {
    if (drive.drive_status === 'Cancelled') continue;

    const elig = evaluateEligibility(student, skills, drive);
    let weightedEarned = 0;
    let weightedTotal = 0;
    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const req of drive.requiredSkills) {
      const w = req.weightage > 0 ? req.weightage : 1.0;
      weightedTotal += w * req.required_level;
      const own = skillMap.get(req.skill_id) ?? 0;
      weightedEarned += w * Math.min(own, req.required_level);

      if (own >= req.required_level) {
        matchingSkills.push(`${req.skill_name} (${own}/${req.required_level})`);
      } else {
        missingSkills.push(`${req.skill_name} (${own}/${req.required_level})`);
      }
    }

    const skillScore = weightedTotal > 0 ? (weightedEarned / weightedTotal) * 60.0 : 60.0;
    const cgpaRatio = drive.min_cgpa > 0 ? Math.min(student.cgpa / drive.min_cgpa, 1.0) : 1.0;
    const cgpaScore = cgpaRatio * 25.0;

    const allowedBranches = (drive.eligible_branches || '')
      .split(',')
      .map((b) => b.trim().toUpperCase());
    const branchOk = allowedBranches.includes('ALL') || allowedBranches.includes(student.branch.toUpperCase());
    const academicFit = (branchOk ? 10.0 : 0.0) + (student.graduation_year === drive.graduation_year ? 5.0 : 0.0);

    const totalMatch = Math.min(100, Math.round((skillScore + cgpaScore + academicFit) * 10) / 10);

    matches.push({
      driveId: drive.drive_id,
      companyId: drive.company_id,
      companyName: drive.company_name,
      industry: drive.industry || 'Technology',
      jobRole: drive.job_role,
      jobType: drive.job_type,
      salaryPackage: drive.salary_package,
      driveStatus: drive.drive_status,
      eligible: elig.eligible,
      matchPercentage: totalMatch,
      matchingSkills,
      missingSkills,
      algorithmBreakdown: `Skills ${skillScore.toFixed(1)}/60 + CGPA ${cgpaScore.toFixed(1)}/25 + Academic Fit ${academicFit.toFixed(1)}/15`,
    });
  }

  return matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
}
