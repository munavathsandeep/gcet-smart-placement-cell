import type { Database } from 'sql.js';
import { queryAll, queryOne, saveDatabase } from './db.ts';

export type ProfileApprovalStatus =
  | 'DRAFT'
  | 'WAITING_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTION_REQUESTED';

export interface AuthContextUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  studentId?: number | null;
  assignedBranch?: string | null;
}

export interface ProfileDiffItem {
  section_name: string;
  field_key: string;
  field_label: string;
  previous_value: string;
  new_value: string;
  is_changed: number;
}

export interface ProfileDraftPayload {
  personal: {
    full_name: string;
    date_of_birth: string;
    gender: string;
    personal_email: string;
    phone: string;
    alternate_phone: string;
    address: string;
    city: string;
    state: string;
    pin_code: string;
    photo_data_url?: string | null;
  };
  academic: {
    college_name: string;
    dept_name: string;
    branch: string;
    roll_number: string;
    registration_number: string;
    admission_year: number;
    academic_year: string;
    year_of_study: number;
    semester: number;
    section: string;
    graduation_year: number;
    cgpa: number;
    percentage: number;
    active_backlogs: number;
    history_of_backlogs: number;
    tenth_marks: string;
    inter_diploma_marks: string;
    university_name: string;
  };
  skills: {
    skill_id?: number;
    skill_name: string;
    category: string;
    proficiency_level: number;
    proficiency_label: 'Beginner' | 'Intermediate' | 'Advanced';
    experience_duration: string;
    verified?: number;
  }[];
  projects: {
    project_id?: number;
    title: string;
    tech_stack: string;
    description: string;
    category?: string;
    duration?: string;
    repo_url?: string;
    live_url?: string;
    team_members?: string;
    role_in_project?: string;
  }[];
  certifications: {
    cert_id?: number;
    cert_name: string;
    issuing_org: string;
    issue_date: string;
    expiration_date?: string | null;
    credential_id?: string;
    verification_url?: string | null;
    certificate_file_name?: string | null;
    certificate_file_data?: string | null;
  }[];
  internships: {
    internship_id?: number;
    company_name: string;
    role: string;
    duration: string;
    start_date: string;
    end_date: string;
    description: string;
    technologies_used: string;
    certificate_name?: string | null;
    certificate_data?: string | null;
  }[];
  achievements: {
    achievement_id?: number;
    title: string;
    category: string;
    event_date: string;
    description: string;
  }[];
  socialLinks: {
    linkedin_url?: string | null;
    github_url?: string | null;
    portfolio_url?: string | null;
    personal_website_url?: string | null;
    leetcode_url?: string | null;
    hackerrank_url?: string | null;
    codechef_url?: string | null;
    geeksforgeeks_url?: string | null;
  };
  resume: {
    file_name: string;
    file_size: number;
    mime_type: string;
    file_data_url?: string | null;
    uploaded_at: string;
  } | null;
}

const MAX_PDF_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const b64 = dataUrl.slice(commaIdx + 1);
  return Math.floor((b64.length * 3) / 4);
}

export function isPlacementAdminRoleName(role?: string | null): boolean {
  return ['PRINCIPAL', 'VICE_CHAIRMAN', 'CHAIRMAN', 'ADMIN', 'PLACEMENT_OFFICER'].includes(String(role || ''));
}

export function isFacultyRoleName(role?: string | null): boolean {
  return role === 'FACULTY' || role === 'FACULTY_COORDINATOR';
}

const BRANCH_TO_CANONICAL: Record<string, string> = {
  CSE: 'CSE',
  'CSE-AIML': 'CSE-AIML',
  'CSE-DS': 'CSE-DS',
  IOT: 'IOT',
  'CSE-IOT': 'IOT',
  IT: 'IT',
  CS: 'CS',
  'CSE-CS': 'CS',
  EEE: 'EEE',
  ECE: 'ECE',
  ME: 'MECH',
  MECH: 'MECH',
  CE: 'CIVIL',
  CIVIL: 'CIVIL',
  MBA: 'MBA',
  'M.TECH CSE': 'M.TECH CSE',
};

const ALIAS_TO_DB_BRANCH_CODE: Record<string, string> = {
  IOT: 'CSE-IoT',
  'CSE-IOT': 'CSE-IoT',
  CS: 'CSE-CS',
  'CSE-CS': 'CSE-CS',
  MECH: 'ME',
  ME: 'ME',
  CIVIL: 'CE',
  CE: 'CE',
};

export function normalizeBranchToken(branch: string | null | undefined): string {
  const upper = String(branch || '').trim().toUpperCase();
  if (!upper) return '';
  return BRANCH_TO_CANONICAL[upper] || upper;
}

export function resolveBranchRow(
  db: Database,
  branchCodeOrName?: string | null,
  branchId?: number | null
): { branch_id: number; dept_id: number; branch_code: string; branch_name: string } | null {
  if (branchId) {
    const byId = queryOne<{ branch_id: number; dept_id: number; branch_code: string; branch_name: string }>(
      db,
      'SELECT branch_id, dept_id, branch_code, branch_name FROM branches WHERE branch_id = ?',
      [Number(branchId)]
    );
    if (byId) return byId;
  }
  const clean = String(branchCodeOrName || '').trim();
  if (!clean) return null;
  const direct = queryOne<{ branch_id: number; dept_id: number; branch_code: string; branch_name: string }>(
    db,
    'SELECT branch_id, dept_id, branch_code, branch_name FROM branches WHERE UPPER(branch_code) = UPPER(?) OR UPPER(branch_name) = UPPER(?)',
    [clean, clean]
  );
  if (direct) return direct;

  const mappedCode = ALIAS_TO_DB_BRANCH_CODE[clean.toUpperCase()];
  if (mappedCode) {
    return queryOne<{ branch_id: number; dept_id: number; branch_code: string; branch_name: string }>(
      db,
      'SELECT branch_id, dept_id, branch_code, branch_name FROM branches WHERE UPPER(branch_code) = UPPER(?)',
      [mappedCode]
    );
  }
  return null;
}

export function getFacultyAssignedBranches(
  db: Database,
  facultyUserId: number,
  fallbackAssignedBranch?: string | null
): string[] {
  const rows = queryAll<{ branch_code: string }>(
    db,
    'SELECT branch_code FROM faculty_branch_assignments WHERE faculty_user_id = ? ORDER BY is_primary DESC, assignment_id ASC',
    [facultyUserId]
  );
  if (rows.length > 0) {
    return rows.map((r) => r.branch_code.trim().toUpperCase());
  }
  if (fallbackAssignedBranch && fallbackAssignedBranch.trim()) {
    return fallbackAssignedBranch
      .split(',')
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean);
  }
  return [];
}

export function branchMatchesFacultyScope(studentBranch: string, facultyBranch: string | string[] | null | undefined): boolean {
  if (!facultyBranch) return false;
  const studentNorm = normalizeBranchToken(studentBranch);
  if (!studentNorm) return false;

  const list = Array.isArray(facultyBranch)
    ? facultyBranch
    : String(facultyBranch)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

  return list.some((fb) => normalizeBranchToken(fb) === studentNorm);
}

export function canFacultyAccessStudent(db: Database, user: AuthContextUser, studentId: number): boolean {
  if (isPlacementAdminRoleName(user.role)) return true;
  if (user.role === 'STUDENT') return user.studentId === studentId;
  if (!isFacultyRoleName(user.role)) return false;

  const st = queryOne<{ branch: string }>(db, 'SELECT branch FROM students WHERE student_id = ?', [studentId]);
  if (!st) return false;

  const assignedBranches = getFacultyAssignedBranches(db, user.userId, user.assignedBranch);
  if (assignedBranches.length > 0) {
    return branchMatchesFacultyScope(st.branch, assignedBranches);
  }

  const explicit = queryOne<{ assignment_id: number }>(
    db,
    'SELECT assignment_id FROM faculty_student_assignments WHERE faculty_user_id = ? AND student_id = ?',
    [user.userId, studentId]
  );
  return Boolean(explicit);
}

export function resolveAssignedFaculty(
  db: Database,
  studentId: number,
  branch: string,
  section?: string | null
): {
  user_id: number;
  full_name: string;
  email: string;
  employee_id: string | null;
  assigned_branch: string | null;
  designation?: string | null;
  department_name?: string | null;
} | null {
  const normBranch = normalizeBranchToken(branch);

  // 1. Check explicit student assignment ONLY if the faculty is active and owns that branch
  const explicit = queryOne<{
    user_id: number;
    full_name: string;
    email: string;
    employee_id: string | null;
    assigned_branch: string | null;
    designation: string | null;
    department_name: string | null;
  }>(
    db,
    `SELECT u.user_id, u.full_name, u.email, u.employee_id, u.assigned_branch, u.designation, u.department_name
     FROM faculty_student_assignments fsa
     JOIN users u ON fsa.faculty_user_id = u.user_id
     WHERE fsa.student_id = ? AND u.is_active = 1 AND u.role IN ('FACULTY', 'FACULTY_COORDINATOR')
     ORDER BY CASE WHEN fsa.section = ? THEN 0 ELSE 1 END, fsa.assignment_id ASC
     LIMIT 1`,
    [studentId, section || 'A']
  );
  if (explicit && branchMatchesFacultyScope(branch, getFacultyAssignedBranches(db, explicit.user_id, explicit.assigned_branch))) {
    return explicit;
  }

  // 2. Look up coordinator via faculty_branch_assignments table or users.assigned_branch
  const allFaculty = queryAll<{
    user_id: number;
    full_name: string;
    email: string;
    employee_id: string | null;
    assigned_branch: string | null;
    designation: string | null;
    department_name: string | null;
  }>(
    db,
    `SELECT user_id, full_name, email, employee_id, assigned_branch, designation, department_name
     FROM users
     WHERE role IN ('FACULTY', 'FACULTY_COORDINATOR') AND is_active = 1 AND approval_status = 'Approved'
     ORDER BY user_id ASC`
  );

  const matched =
    allFaculty.find((f) => {
      const branches = getFacultyAssignedBranches(db, f.user_id, f.assigned_branch);
      return branches.some((b) => normalizeBranchToken(b) === normBranch);
    }) || null;

  if (matched) {
    db.run('DELETE FROM faculty_student_assignments WHERE student_id = ?', [studentId]);
    db.run(
      'INSERT OR IGNORE INTO faculty_student_assignments (faculty_user_id, student_id, branch_code, section) VALUES (?, ?, ?, ?)',
      [matched.user_id, studentId, branch, section || 'A']
    );
  }
  return matched;
}

export function buildOfficialDossier(db: Database, studentId: number): {
  officialStudent: Record<string, unknown>;
  officialDossier: ProfileDraftPayload;
  completionPercentage: number;
} | null {
  const st = queryOne<Record<string, unknown>>(
    db,
    `SELECT s.*, d.dept_code, d.dept_name
     FROM students s
     JOIN departments d ON s.dept_id = d.dept_id
     WHERE s.student_id = ?`,
    [studentId]
  );
  if (!st) return null;

  const ext = queryOne<Record<string, unknown>>(
    db,
    `SELECT sp.*, u.full_name AS last_approved_by_name
     FROM student_profiles sp
     LEFT JOIN users u ON sp.last_approved_by = u.user_id
     WHERE sp.student_id = ?`,
    [studentId]
  );

  const skills = queryAll<Record<string, unknown>>(
    db,
    `SELECT ss.student_skill_id, ss.skill_id, sk.skill_name, sk.category, ss.proficiency_level,
            COALESCE(ss.proficiency_label, CASE WHEN ss.proficiency_level >= 4 THEN 'Advanced' WHEN ss.proficiency_level >= 2 THEN 'Intermediate' ELSE 'Beginner' END) AS proficiency_label,
            COALESCE(ss.experience_duration, '') AS experience_duration,
            ss.verified
     FROM student_skills ss
     JOIN skills sk ON ss.skill_id = sk.skill_id
     WHERE ss.student_id = ?
     ORDER BY ss.proficiency_level DESC, sk.skill_name ASC`,
    [studentId]
  );

  const projects = queryAll<Record<string, unknown>>(
    db,
    'SELECT * FROM projects WHERE student_id = ? ORDER BY project_id DESC',
    [studentId]
  );

  const certifications = queryAll<Record<string, unknown>>(
    db,
    'SELECT * FROM certifications WHERE student_id = ? ORDER BY issue_date DESC, cert_id DESC',
    [studentId]
  );

  const internships = queryAll<Record<string, unknown>>(
    db,
    'SELECT * FROM student_internships WHERE student_id = ? ORDER BY start_date DESC, internship_id DESC',
    [studentId]
  );

  const achievements = queryAll<Record<string, unknown>>(
    db,
    'SELECT * FROM student_achievements WHERE student_id = ? ORDER BY event_date DESC, achievement_id DESC',
    [studentId]
  );

  const socialRow = queryOne<Record<string, unknown>>(
    db,
    'SELECT * FROM student_social_links WHERE student_id = ?',
    [studentId]
  );

  const resumeRow = queryOne<{
    resume_id: number;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_data_url: string;
    uploaded_at: string;
  }>(db, 'SELECT * FROM student_resumes WHERE student_id = ?', [studentId]);

  const applications = queryAll<Record<string, unknown>>(
    db,
    `SELECT a.*, c.company_name, pd.job_role, pd.salary_package
     FROM applications a
     JOIN placement_drives pd ON a.drive_id = pd.drive_id
     JOIN companies c ON pd.company_id = c.company_id
     WHERE a.student_id = ?
     ORDER BY a.applied_at DESC`,
    [studentId]
  );

  const socialLinks = {
    linkedin_url: String(socialRow?.linkedin_url || ''),
    github_url: String(socialRow?.github_url || ''),
    portfolio_url: String(socialRow?.portfolio_url || ''),
    personal_website_url: String(socialRow?.personal_website_url || ''),
    leetcode_url: String(socialRow?.leetcode_url || ''),
    hackerrank_url: String(socialRow?.hackerrank_url || ''),
    codechef_url: String(socialRow?.codechef_url || ''),
    geeksforgeeks_url: String(socialRow?.geeksforgeeks_url || ''),
  };

  const resumeInfo = resumeRow
    ? {
        resume_id: resumeRow.resume_id,
        file_name: resumeRow.file_name,
        file_size: resumeRow.file_size,
        mime_type: resumeRow.mime_type,
        file_data_url: resumeRow.file_data_url,
        uploaded_at: resumeRow.uploaded_at,
      }
    : null;

  const dossier: ProfileDraftPayload = {
    personal: {
      full_name: String(st.full_name || ''),
      date_of_birth: String(ext?.date_of_birth || ''),
      gender: String(st.gender || ''),
      personal_email: String(ext?.personal_email || ''),
      phone: String(st.phone || ''),
      alternate_phone: String(ext?.alternate_phone || ''),
      address: String(st.address || ''),
      city: String(ext?.city || ''),
      state: String(ext?.state || ''),
      pin_code: String(ext?.pin_code || ''),
      photo_data_url: (ext?.photo_data_url as string | null) || (st.profile_photo_url as string | null) || null,
    },
    academic: {
      college_name: String(ext?.college_name || ''),
      dept_name: String(st.dept_name || ''),
      branch: String(st.branch || ''),
      roll_number: String(st.roll_number || ''),
      registration_number: String(ext?.registration_number || ''),
      admission_year: Number(ext?.admission_year || 0),
      academic_year: String(st.academic_year || ''),
      year_of_study: Number(st.year_of_study || 0),
      semester: Number(st.semester || 0),
      section: String(st.section || ''),
      graduation_year: Number(st.graduation_year || 0),
      cgpa: Number(st.cgpa || 0),
      percentage: Number(ext?.percentage ?? 0),
      active_backlogs: Number(st.active_backlogs || 0),
      history_of_backlogs: Number(ext?.history_of_backlogs || 0),
      tenth_marks: String(ext?.tenth_marks || ''),
      inter_diploma_marks: String(ext?.inter_diploma_marks || ''),
      university_name: String(ext?.university_name || ''),
    },
    skills: skills.map((sk) => ({
      skill_id: Number(sk.skill_id),
      skill_name: String(sk.skill_name),
      category: String(sk.category),
      proficiency_level: Number(sk.proficiency_level),
      proficiency_label: (sk.proficiency_label as 'Beginner' | 'Intermediate' | 'Advanced') || 'Intermediate',
      experience_duration: String(sk.experience_duration || ''),
      verified: Number(sk.verified || 0),
    })),
    projects: projects.map((p) => ({
      project_id: Number(p.project_id),
      title: String(p.title),
      tech_stack: String(p.tech_stack),
      description: String(p.description),
      category: String(p.category || ''),
      duration: String(p.duration || ''),
      repo_url: String(p.repo_url || ''),
      live_url: String(p.live_url || ''),
      team_members: String(p.team_members || ''),
      role_in_project: String(p.role_in_project || ''),
    })),
    certifications: certifications.map((c) => ({
      cert_id: Number(c.cert_id),
      cert_name: String(c.cert_name),
      issuing_org: String(c.issuing_org),
      issue_date: String(c.issue_date),
      expiration_date: String(c.expiration_date || ''),
      credential_id: String(c.credential_id || ''),
      verification_url: String(c.verification_url || ''),
      certificate_file_name: (c.certificate_file_name as string | null) || null,
      certificate_file_data: (c.certificate_file_data as string | null) || null,
    })),
    internships: internships.map((i) => ({
      internship_id: Number(i.internship_id),
      company_name: String(i.company_name),
      role: String(i.role),
      duration: String(i.duration),
      start_date: String(i.start_date),
      end_date: String(i.end_date),
      description: String(i.description),
      technologies_used: String(i.technologies_used),
      certificate_name: (i.certificate_name as string | null) || null,
      certificate_data: (i.certificate_data as string | null) || null,
    })),
    achievements: achievements.map((a) => ({
      achievement_id: Number(a.achievement_id),
      title: String(a.title),
      category: String(a.category),
      event_date: String(a.event_date),
      description: String(a.description),
    })),
    socialLinks,
    resume: resumeInfo
      ? {
          file_name: resumeInfo.file_name,
          file_size: resumeInfo.file_size,
          mime_type: resumeInfo.mime_type,
          file_data_url: resumeInfo.file_data_url,
          uploaded_at: resumeInfo.uploaded_at,
        }
      : null,
  };

  const checks = [
    Boolean(dossier.personal.full_name && dossier.personal.phone && dossier.personal.city),
    Boolean(dossier.academic.cgpa > 0 && dossier.academic.tenth_marks && dossier.academic.inter_diploma_marks),
    dossier.skills.length >= 3,
    dossier.projects.length >= 1,
    dossier.certifications.length >= 1 || dossier.internships.length >= 1,
    dossier.achievements.length >= 1,
    Boolean(dossier.socialLinks.linkedin_url && dossier.socialLinks.github_url),
    Boolean(dossier.resume || st.resume_url),
  ];
  const completionPercentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    officialStudent: {
      ...st,
      skills,
      projects,
      certifications,
      internships,
      achievements,
      socialLinks,
      resumeInfo: resumeInfo
        ? {
            resume_id: resumeInfo.resume_id,
            file_name: resumeInfo.file_name,
            file_size: resumeInfo.file_size,
            mime_type: resumeInfo.mime_type,
            uploaded_at: resumeInfo.uploaded_at,
          }
        : null,
      extendedProfile: ext || null,
      applications,
    },
    officialDossier: dossier,
    completionPercentage,
  };
}

export function normalizeAndValidateDraft(
  raw: unknown,
  officialDossier: ProfileDraftPayload,
  strictForSubmit: boolean
): { valid: true; payload: ProfileDraftPayload } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Invalid profile payload.' };
  }
  const b = raw as Partial<ProfileDraftPayload>;
  const p = b.personal ?? officialDossier.personal;
  const a = b.academic ?? officialDossier.academic;

  const fullName = String(p.full_name || '').trim();
  const phone = String(p.phone || '').trim();
  const personalEmail = String(p.personal_email || '').trim();
  if (strictForSubmit) {
    if (fullName.length < 2) return { valid: false, error: 'Full Name is required (minimum 2 characters).' };
    if (phone.length < 7) return { valid: false, error: 'Valid Mobile Number is required.' };
    if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      return { valid: false, error: 'Personal Email format is invalid.' };
    }
  }

  if (p.photo_data_url) {
    if (!String(p.photo_data_url).startsWith('data:image/')) {
      return { valid: false, error: 'Profile photo must be a valid PNG/JPG/WebP image.' };
    }
    if (estimateDataUrlBytes(String(p.photo_data_url)) > MAX_IMAGE_BYTES) {
      return { valid: false, error: 'Profile photo size must be 1.5 MB or smaller.' };
    }
  }

  const cgpa = Number(a.cgpa);
  const percentage = Number(a.percentage ?? 0);
  const activeBacklogs = Number(a.active_backlogs ?? 0);
  const historyBacklogs = Number(a.history_of_backlogs ?? 0);
  if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
    return { valid: false, error: 'CGPA must be between 0.00 and 10.00.' };
  }
  if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
    return { valid: false, error: 'Percentage must be between 0 and 100.' };
  }
  if (activeBacklogs < 0 || historyBacklogs < 0) {
    return { valid: false, error: 'Backlog counts cannot be negative.' };
  }

  // Validate Social Links (Section H) if entered
  const sl = b.socialLinks ?? officialDossier.socialLinks;
  const socialFields: [keyof ProfileDraftPayload['socialLinks'], string][] = [
    ['linkedin_url', 'LinkedIn'],
    ['github_url', 'GitHub'],
    ['portfolio_url', 'Portfolio Website'],
    ['personal_website_url', 'Personal Website'],
    ['leetcode_url', 'LeetCode'],
    ['hackerrank_url', 'HackerRank'],
    ['codechef_url', 'CodeChef'],
    ['geeksforgeeks_url', 'GeeksforGeeks'],
  ];
  const cleanSocial: ProfileDraftPayload['socialLinks'] = {};
  for (const [key, label] of socialFields) {
    const val = String(sl?.[key] || '').trim();
    if (val && !isValidHttpUrl(val)) {
      return { valid: false, error: `${label} link must be a valid HTTP/HTTPS URL (starting with http:// or https://).` };
    }
    cleanSocial[key] = val;
  }

  // Validate Projects URLs
  const cleanProjects = Array.isArray(b.projects) ? b.projects : officialDossier.projects;
  for (const proj of cleanProjects) {
    if (!String(proj.title || '').trim() || !String(proj.tech_stack || '').trim()) {
      return { valid: false, error: 'Each project must include a Title and Technologies Used.' };
    }
    if (proj.repo_url && !isValidHttpUrl(proj.repo_url)) {
      return { valid: false, error: `Invalid GitHub Repository URL for project "${proj.title}".` };
    }
    if (proj.live_url && !isValidHttpUrl(proj.live_url)) {
      return { valid: false, error: `Invalid Live Link URL for project "${proj.title}".` };
    }
  }

  // Validate Certifications URLs & files
  const cleanCerts = Array.isArray(b.certifications) ? b.certifications : officialDossier.certifications;
  for (const cert of cleanCerts) {
    if (!String(cert.cert_name || '').trim() || !String(cert.issuing_org || '').trim()) {
      return { valid: false, error: 'Each certification must include Name and Issuing Organization.' };
    }
    if (cert.verification_url && !isValidHttpUrl(cert.verification_url)) {
      return { valid: false, error: `Invalid Verification URL for certification "${cert.cert_name}".` };
    }
    if (cert.certificate_file_data && estimateDataUrlBytes(cert.certificate_file_data) > MAX_PDF_BYTES) {
      return { valid: false, error: `Certificate file for "${cert.cert_name}" exceeds 2 MB limit.` };
    }
  }

  // Validate Internships
  const cleanInternships = Array.isArray(b.internships) ? b.internships : officialDossier.internships;
  for (const intern of cleanInternships) {
    if (!String(intern.company_name || '').trim() || !String(intern.role || '').trim()) {
      return { valid: false, error: 'Each internship entry must include Company Name and Role.' };
    }
    if (intern.certificate_data && estimateDataUrlBytes(intern.certificate_data) > MAX_PDF_BYTES) {
      return { valid: false, error: `Internship certificate for "${intern.company_name}" exceeds 2 MB limit.` };
    }
  }

  // Validate Achievements
  const cleanAchievements = Array.isArray(b.achievements) ? b.achievements : officialDossier.achievements;
  for (const ach of cleanAchievements) {
    if (!String(ach.title || '').trim()) {
      return { valid: false, error: 'Each achievement entry must include a Title.' };
    }
  }

  // Validate Skills
  const cleanSkills = Array.isArray(b.skills) ? b.skills : officialDossier.skills;
  for (const sk of cleanSkills) {
    const lvl = Number(sk.proficiency_level);
    if (!String(sk.skill_name || '').trim() || Number.isNaN(lvl) || lvl < 1 || lvl > 5) {
      return { valid: false, error: 'Each technical skill requires a Skill Name and Proficiency Level (1–5).' };
    }
  }

  // Validate Resume PDF (<= 2 MB)
  let cleanResume: ProfileDraftPayload['resume'] = null;
  if (b.resume !== undefined) {
    if (b.resume && b.resume.file_name) {
      const dataUrl = b.resume.file_data_url || officialDossier.resume?.file_data_url || '';
      if (!dataUrl.startsWith('data:application/pdf;base64,')) {
        return { valid: false, error: 'Resume must be uploaded as a valid PDF file (.pdf).' };
      }
      const byteSize = estimateDataUrlBytes(dataUrl);
      if (byteSize > MAX_PDF_BYTES || Number(b.resume.file_size || 0) > MAX_PDF_BYTES) {
        return { valid: false, error: 'Resume PDF must be 2 MB or smaller.' };
      }
      cleanResume = {
        file_name: String(b.resume.file_name).trim(),
        file_size: Number(b.resume.file_size) || byteSize,
        mime_type: 'application/pdf',
        file_data_url: dataUrl,
        uploaded_at: b.resume.uploaded_at || new Date().toISOString(),
      };
    }
  } else {
    cleanResume = officialDossier.resume;
  }

  const normalized: ProfileDraftPayload = {
    personal: {
      full_name: fullName || officialDossier.personal.full_name,
      date_of_birth: String(p.date_of_birth || '').trim(),
      gender: String(p.gender || '').trim(),
      personal_email: personalEmail,
      phone: phone || officialDossier.personal.phone,
      alternate_phone: String(p.alternate_phone || '').trim(),
      address: String(p.address || '').trim(),
      city: String(p.city || '').trim(),
      state: String(p.state || '').trim(),
      pin_code: String(p.pin_code || '').trim(),
      photo_data_url: p.photo_data_url ?? officialDossier.personal.photo_data_url ?? null,
    },
    academic: {
      college_name: String(a.college_name ?? '').trim(),
      dept_name: String(a.dept_name || officialDossier.academic.dept_name).trim(),
      branch: String(a.branch || officialDossier.academic.branch).trim(),
      roll_number: officialDossier.academic.roll_number, // Roll number remains immutable institutional ID
      registration_number: String(a.registration_number ?? '').trim(),
      admission_year: Number(a.admission_year) || 0,
      academic_year: String(a.academic_year ?? officialDossier.academic.academic_year ?? '').trim(),
      year_of_study: Number(a.year_of_study) || officialDossier.academic.year_of_study,
      semester: Number(a.semester) || officialDossier.academic.semester,
      section: String(a.section ?? officialDossier.academic.section ?? '').trim().toUpperCase(),
      graduation_year: Number(a.graduation_year) || officialDossier.academic.graduation_year,
      cgpa: Math.round(cgpa * 100) / 100,
      percentage: Math.round(percentage * 10) / 10,
      active_backlogs: activeBacklogs,
      history_of_backlogs: historyBacklogs,
      tenth_marks: String(a.tenth_marks || '').trim(),
      inter_diploma_marks: String(a.inter_diploma_marks || '').trim(),
      university_name: String(a.university_name ?? '').trim(),
    },
    skills: cleanSkills.map((sk) => ({
      skill_id: sk.skill_id,
      skill_name: String(sk.skill_name).trim(),
      category: String(sk.category || 'Technical').trim(),
      proficiency_level: Number(sk.proficiency_level),
      proficiency_label:
        sk.proficiency_label ||
        (Number(sk.proficiency_level) >= 4 ? 'Advanced' : Number(sk.proficiency_level) >= 2 ? 'Intermediate' : 'Beginner'),
      experience_duration: String(sk.experience_duration || '').trim(),
      verified: sk.verified ?? 0,
    })),
    projects: cleanProjects.map((proj) => ({
      project_id: proj.project_id,
      title: String(proj.title).trim(),
      tech_stack: String(proj.tech_stack).trim(),
      description: String(proj.description || '').trim(),
      category: String(proj.category || '').trim(),
      duration: String(proj.duration || '').trim(),
      repo_url: String(proj.repo_url || '').trim(),
      live_url: String(proj.live_url || '').trim(),
      team_members: String(proj.team_members || '').trim(),
      role_in_project: String(proj.role_in_project || '').trim(),
    })),
    certifications: cleanCerts.map((c) => ({
      cert_id: c.cert_id,
      cert_name: String(c.cert_name).trim(),
      issuing_org: String(c.issuing_org).trim(),
      issue_date: String(c.issue_date || '').trim(),
      expiration_date: String(c.expiration_date || '').trim(),
      credential_id: String(c.credential_id || '').trim(),
      verification_url: String(c.verification_url || '').trim(),
      certificate_file_name: c.certificate_file_name || null,
      certificate_file_data: c.certificate_file_data || null,
    })),
    internships: cleanInternships.map((i) => ({
      internship_id: i.internship_id,
      company_name: String(i.company_name).trim(),
      role: String(i.role).trim(),
      duration: String(i.duration || '').trim(),
      start_date: String(i.start_date || '').trim(),
      end_date: String(i.end_date || '').trim(),
      description: String(i.description || '').trim(),
      technologies_used: String(i.technologies_used || '').trim(),
      certificate_name: i.certificate_name || null,
      certificate_data: i.certificate_data || null,
    })),
    achievements: cleanAchievements.map((ach) => ({
      achievement_id: ach.achievement_id,
      title: String(ach.title).trim(),
      category: String(ach.category || 'Technical Achievement').trim(),
      event_date: String(ach.event_date || '').trim(),
      description: String(ach.description || '').trim(),
    })),
    socialLinks: cleanSocial,
    resume: cleanResume,
  };

  return { valid: true, payload: normalized };
}

export function computeFieldDiffs(prev: ProfileDraftPayload, next: ProfileDraftPayload): ProfileDiffItem[] {
  const diffs: ProfileDiffItem[] = [];
  const pushScalar = (section: string, key: string, label: string, oldVal: unknown, newVal: unknown) => {
    const o = String(oldVal ?? '').trim();
    const n = String(newVal ?? '').trim();
    if (o !== n) {
      diffs.push({
        section_name: section,
        field_key: key,
        field_label: label,
        previous_value: o || '—',
        new_value: n || '—',
        is_changed: 1,
      });
    }
  };

  // Personal
  pushScalar('Personal Information', 'personal.full_name', 'Full Name', prev.personal.full_name, next.personal.full_name);
  pushScalar('Personal Information', 'personal.date_of_birth', 'Date of Birth', prev.personal.date_of_birth, next.personal.date_of_birth);
  pushScalar('Personal Information', 'personal.gender', 'Gender', prev.personal.gender, next.personal.gender);
  pushScalar('Personal Information', 'personal.personal_email', 'Personal Email', prev.personal.personal_email, next.personal.personal_email);
  pushScalar('Personal Information', 'personal.phone', 'Mobile Number', prev.personal.phone, next.personal.phone);
  pushScalar('Personal Information', 'personal.alternate_phone', 'Alternate Phone', prev.personal.alternate_phone, next.personal.alternate_phone);
  pushScalar('Personal Information', 'personal.address', 'Address', prev.personal.address, next.personal.address);
  pushScalar('Personal Information', 'personal.city', 'City', prev.personal.city, next.personal.city);
  pushScalar('Personal Information', 'personal.state', 'State', prev.personal.state, next.personal.state);
  pushScalar('Personal Information', 'personal.pin_code', 'PIN Code', prev.personal.pin_code, next.personal.pin_code);
  if ((prev.personal.photo_data_url || '') !== (next.personal.photo_data_url || '')) {
    diffs.push({
      section_name: 'Personal Information',
      field_key: 'personal.photo_data_url',
      field_label: 'Profile Photograph',
      previous_value: prev.personal.photo_data_url ? 'Uploaded Photo' : 'None',
      new_value: next.personal.photo_data_url ? 'Updated Photo' : 'Removed',
      is_changed: 1,
    });
  }

  // Academic
  pushScalar('Academic Information', 'academic.branch', 'Branch', prev.academic.branch, next.academic.branch);
  pushScalar('Academic Information', 'academic.registration_number', 'Registration Number', prev.academic.registration_number, next.academic.registration_number);
  pushScalar('Academic Information', 'academic.admission_year', 'Admission Year', prev.academic.admission_year, next.academic.admission_year);
  pushScalar('Academic Information', 'academic.academic_year', 'Academic Year', prev.academic.academic_year, next.academic.academic_year);
  pushScalar('Academic Information', 'academic.year_of_study', 'Current Year of Study', prev.academic.year_of_study, next.academic.year_of_study);
  pushScalar('Academic Information', 'academic.semester', 'Current Semester', prev.academic.semester, next.academic.semester);
  pushScalar('Academic Information', 'academic.section', 'Section', prev.academic.section, next.academic.section);
  pushScalar('Academic Information', 'academic.graduation_year', 'Graduation Year', prev.academic.graduation_year, next.academic.graduation_year);
  pushScalar('Academic Information', 'academic.cgpa', 'CGPA', prev.academic.cgpa, next.academic.cgpa);
  pushScalar('Academic Information', 'academic.percentage', 'Percentage', prev.academic.percentage, next.academic.percentage);
  pushScalar('Academic Information', 'academic.active_backlogs', 'Active Backlogs', prev.academic.active_backlogs, next.academic.active_backlogs);
  pushScalar('Academic Information', 'academic.history_of_backlogs', 'History of Backlogs', prev.academic.history_of_backlogs, next.academic.history_of_backlogs);
  pushScalar('Academic Information', 'academic.tenth_marks', '10th Standard Marks', prev.academic.tenth_marks, next.academic.tenth_marks);
  pushScalar('Academic Information', 'academic.inter_diploma_marks', 'Intermediate / Diploma Marks', prev.academic.inter_diploma_marks, next.academic.inter_diploma_marks);

  // Collections summarized cleanly
  const summarizeSkills = (arr: ProfileDraftPayload['skills']) =>
    arr.map((s) => `${s.skill_name} (${s.proficiency_level}/5 ${s.proficiency_label}, ${s.experience_duration})`).join('; ');
  pushScalar('Technical Skills', 'skills', 'Technical Skill Matrix', summarizeSkills(prev.skills), summarizeSkills(next.skills));

  const summarizeProjects = (arr: ProfileDraftPayload['projects']) =>
    arr.map((p) => `${p.title} [${p.tech_stack}]`).join('; ');
  pushScalar('Projects', 'projects', 'Projects Portfolio', summarizeProjects(prev.projects), summarizeProjects(next.projects));

  const summarizeCerts = (arr: ProfileDraftPayload['certifications']) =>
    arr.map((c) => `${c.cert_name} — ${c.issuing_org} (${c.issue_date})`).join('; ');
  pushScalar('Certifications', 'certifications', 'Certifications List', summarizeCerts(prev.certifications), summarizeCerts(next.certifications));

  const summarizeInternships = (arr: ProfileDraftPayload['internships']) =>
    arr.map((i) => `${i.company_name}: ${i.role} (${i.duration})`).join('; ');
  pushScalar('Internships & Experience', 'internships', 'Internship Records', summarizeInternships(prev.internships), summarizeInternships(next.internships));

  const summarizeAch = (arr: ProfileDraftPayload['achievements']) =>
    arr.map((a) => `${a.title} (${a.category}, ${a.event_date})`).join('; ');
  pushScalar('Achievements & Activities', 'achievements', 'Achievements & Activities', summarizeAch(prev.achievements), summarizeAch(next.achievements));

  // Social Links
  pushScalar('Professional Social Links', 'social.linkedin_url', 'LinkedIn URL', prev.socialLinks.linkedin_url, next.socialLinks.linkedin_url);
  pushScalar('Professional Social Links', 'social.github_url', 'GitHub URL', prev.socialLinks.github_url, next.socialLinks.github_url);
  pushScalar('Professional Social Links', 'social.portfolio_url', 'Portfolio URL', prev.socialLinks.portfolio_url, next.socialLinks.portfolio_url);
  pushScalar('Professional Social Links', 'social.personal_website_url', 'Personal Website URL', prev.socialLinks.personal_website_url, next.socialLinks.personal_website_url);
  pushScalar('Professional Social Links', 'social.leetcode_url', 'LeetCode URL', prev.socialLinks.leetcode_url, next.socialLinks.leetcode_url);
  pushScalar('Professional Social Links', 'social.hackerrank_url', 'HackerRank URL', prev.socialLinks.hackerrank_url, next.socialLinks.hackerrank_url);
  pushScalar('Professional Social Links', 'social.codechef_url', 'CodeChef URL', prev.socialLinks.codechef_url, next.socialLinks.codechef_url);
  pushScalar('Professional Social Links', 'social.geeksforgeeks_url', 'GeeksforGeeks URL', prev.socialLinks.geeksforgeeks_url, next.socialLinks.geeksforgeeks_url);

  // Resume
  const prevRes = prev.resume ? `${prev.resume.file_name} (${Math.round(prev.resume.file_size / 1024)} KB)` : 'No PDF uploaded';
  const nextRes = next.resume ? `${next.resume.file_name} (${Math.round(next.resume.file_size / 1024)} KB)` : 'No PDF uploaded';
  if (prevRes !== nextRes || (prev.resume?.uploaded_at || '') !== (next.resume?.uploaded_at || '')) {
    diffs.push({
      section_name: 'Resume Management',
      field_key: 'resume',
      field_label: 'Uploaded Resume PDF',
      previous_value: prevRes,
      new_value: nextRes,
      is_changed: 1,
    });
  }

  return diffs;
}

export function generateSubmissionCode(db: Database): string {
  const row = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM profile_submissions');
  const seq = (row?.c ?? 0) + 1;
  const rand = Math.floor(100 + Math.random() * 900);
  return `SUB-2026-${String(seq).padStart(3, '0')}${rand}`;
}

export function hydrateSubmissionRow(db: Database, row: Record<string, unknown>) {
  const subId = Number(row.submission_id);
  const details = queryAll<ProfileDiffItem & { detail_id: number }>(
    db,
    'SELECT * FROM profile_submission_details WHERE submission_id = ? ORDER BY detail_id ASC',
    [subId]
  );
  let draftPayload: ProfileDraftPayload | null = null;
  let previousSnapshot: ProfileDraftPayload | null = null;
  let storedDiffs: ProfileDiffItem[] = details;

  try {
    draftPayload = JSON.parse(String(row.draft_payload_json || '{}'));
  } catch {
    draftPayload = null;
  }
  try {
    if (row.previous_snapshot_json) {
      previousSnapshot = JSON.parse(String(row.previous_snapshot_json));
    }
  } catch {
    previousSnapshot = null;
  }
  if (storedDiffs.length === 0 && row.changed_fields_json) {
    try {
      storedDiffs = JSON.parse(String(row.changed_fields_json));
    } catch {
      storedDiffs = [];
    }
  }

  return {
    submission_id: subId,
    submission_code: String(row.submission_code),
    student_id: Number(row.student_id),
    student_name: row.student_name ? String(row.student_name) : undefined,
    roll_number: row.roll_number ? String(row.roll_number) : undefined,
    branch: row.branch ? String(row.branch) : undefined,
    section: row.section ? String(row.section) : undefined,
    assigned_faculty_id: row.assigned_faculty_id ? Number(row.assigned_faculty_id) : null,
    assigned_faculty_name: row.assigned_faculty_name ? String(row.assigned_faculty_name) : null,
    status: String(row.status) as ProfileApprovalStatus,
    draft_payload: draftPayload,
    previous_snapshot: previousSnapshot,
    changed_fields: storedDiffs,
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
    reviewed_by: row.reviewed_by ? Number(row.reviewed_by) : null,
    reviewed_by_name: row.reviewed_by_name ? String(row.reviewed_by_name) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    faculty_remarks: row.faculty_remarks ? String(row.faculty_remarks) : null,
    updated_at: String(row.updated_at || ''),
  };
}

export function applyApprovedRevisionTransaction(
  db: Database,
  submissionId: number,
  studentId: number,
  payload: ProfileDraftPayload,
  reviewer: AuthContextUser,
  facultyRemarks: string
): void {
  db.run('BEGIN TRANSACTION');
  try {
    // 1. Resolve branch/department if branch updated
    let deptId: number | null = null;
    let branchId: number | null = null;
    let branchCode = payload.academic.branch;
    const brRow = resolveBranchRow(db, branchCode);
    if (brRow) {
      branchId = brRow.branch_id;
      deptId = brRow.dept_id;
      branchCode = brRow.branch_code;
    }

    const existingStudent = queryOne<{ user_id: number | null; dept_id: number; branch_id: number; resume_url: string | null }>(
      db,
      'SELECT user_id, dept_id, branch_id, resume_url FROM students WHERE student_id = ?',
      [studentId]
    );
    if (!existingStudent) {
      throw new Error('Student record not found.');
    }

    const nextResumeUrl = payload.resume
      ? `/api/student-profile/${studentId}/resume`
      : existingStudent.resume_url;

    // 2. Update official students table
    db.run(
      `UPDATE students
       SET full_name = ?, phone = ?, dept_id = ?, branch_id = ?, branch = ?,
           academic_year = ?, year_of_study = ?, semester = ?, section = ?,
           graduation_year = ?, cgpa = ?, active_backlogs = ?, gender = ?, address = ?,
           profile_photo_url = ?, resume_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE student_id = ?`,
      [
        payload.personal.full_name,
        payload.personal.phone,
        deptId ?? existingStudent.dept_id,
        branchId ?? existingStudent.branch_id,
        branchCode,
        payload.academic.academic_year,
        payload.academic.year_of_study,
        payload.academic.semester,
        payload.academic.section,
        payload.academic.graduation_year,
        payload.academic.cgpa,
        payload.academic.active_backlogs,
        payload.personal.gender || null,
        payload.personal.address || null,
        payload.personal.photo_data_url || null,
        nextResumeUrl,
        studentId,
      ]
    );

    if (existingStudent.user_id) {
      db.run(
        'UPDATE users SET full_name = ?, assigned_branch = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [payload.personal.full_name, branchCode, existingStudent.user_id]
      );
    }

    // 3. Upsert student_profiles
    db.run(
      `INSERT INTO student_profiles (
         student_id, photo_data_url, date_of_birth, personal_email, alternate_phone,
         city, state, pin_code, college_name, registration_number, admission_year,
         percentage, history_of_backlogs, tenth_marks, inter_diploma_marks, university_name,
         last_approved_at, last_approved_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(student_id) DO UPDATE SET
         photo_data_url = excluded.photo_data_url,
         date_of_birth = excluded.date_of_birth,
         personal_email = excluded.personal_email,
         alternate_phone = excluded.alternate_phone,
         city = excluded.city,
         state = excluded.state,
         pin_code = excluded.pin_code,
         college_name = excluded.college_name,
         registration_number = excluded.registration_number,
         admission_year = excluded.admission_year,
         percentage = excluded.percentage,
         history_of_backlogs = excluded.history_of_backlogs,
         tenth_marks = excluded.tenth_marks,
         inter_diploma_marks = excluded.inter_diploma_marks,
         university_name = excluded.university_name,
         last_approved_at = CURRENT_TIMESTAMP,
         last_approved_by = excluded.last_approved_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        studentId,
        payload.personal.photo_data_url || null,
        payload.personal.date_of_birth || null,
        payload.personal.personal_email || null,
        payload.personal.alternate_phone || null,
        payload.personal.city || null,
        payload.personal.state || null,
        payload.personal.pin_code || null,
        payload.academic.college_name || '',
        payload.academic.registration_number || null,
        payload.academic.admission_year || null,
        payload.academic.percentage || null,
        payload.academic.history_of_backlogs,
        payload.academic.tenth_marks || null,
        payload.academic.inter_diploma_marks || null,
        payload.academic.university_name || '',
        reviewer.userId,
      ]
    );

    // 4. Replace student_skills (creating custom skills in skills catalog if needed)
    db.run('DELETE FROM student_skills WHERE student_id = ?', [studentId]);
    for (const sk of payload.skills) {
      let skillRow = queryOne<{ skill_id: number }>(
        db,
        'SELECT skill_id FROM skills WHERE LOWER(skill_name) = LOWER(?)',
        [sk.skill_name]
      );
      if (!skillRow) {
        db.run('INSERT INTO skills (skill_name, category, description) VALUES (?, ?, ?)', [
          sk.skill_name,
          sk.category || 'Technical',
          'Student competency verified via GCET profile approval',
        ]);
        skillRow = queryOne<{ skill_id: number }>(db, 'SELECT last_insert_rowid() AS skill_id');
      }
      if (skillRow) {
        db.run(
          `INSERT OR REPLACE INTO student_skills (student_id, skill_id, proficiency_level, proficiency_label, experience_duration, verified, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
          [studentId, skillRow.skill_id, sk.proficiency_level, sk.proficiency_label, sk.experience_duration || '']
        );
      }
    }

    // 5. Replace projects
    db.run('DELETE FROM projects WHERE student_id = ?', [studentId]);
    for (const proj of payload.projects) {
      db.run(
        `INSERT INTO projects (student_id, title, tech_stack, description, category, duration, repo_url, live_url, team_members, role_in_project)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId,
          proj.title,
          proj.tech_stack,
          proj.description,
          proj.category || '',
          proj.duration || '',
          proj.repo_url || null,
          proj.live_url || null,
          proj.team_members || '',
          proj.role_in_project || '',
        ]
      );
    }

    // 6. Replace certifications
    db.run('DELETE FROM certifications WHERE student_id = ?', [studentId]);
    for (const cert of payload.certifications) {
      db.run(
        `INSERT INTO certifications (student_id, cert_name, issuing_org, issue_date, expiration_date, credential_id, verification_url, certificate_file_name, certificate_file_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId,
          cert.cert_name,
          cert.issuing_org,
          cert.issue_date,
          cert.expiration_date || null,
          cert.credential_id || null,
          cert.verification_url || null,
          cert.certificate_file_name || null,
          cert.certificate_file_data || null,
        ]
      );
    }

    // 7. Replace internships
    db.run('DELETE FROM student_internships WHERE student_id = ?', [studentId]);
    for (const intern of payload.internships) {
      db.run(
        `INSERT INTO student_internships (student_id, company_name, role, duration, start_date, end_date, description, technologies_used, certificate_name, certificate_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId,
          intern.company_name,
          intern.role,
          intern.duration,
          intern.start_date,
          intern.end_date,
          intern.description,
          intern.technologies_used,
          intern.certificate_name || null,
          intern.certificate_data || null,
        ]
      );
    }

    // 8. Replace achievements
    db.run('DELETE FROM student_achievements WHERE student_id = ?', [studentId]);
    for (const ach of payload.achievements) {
      db.run(
        `INSERT INTO student_achievements (student_id, title, category, event_date, description)
         VALUES (?, ?, ?, ?, ?)`,
        [studentId, ach.title, ach.category, ach.event_date, ach.description]
      );
    }

    // 9. Upsert student_social_links
    db.run(
      `INSERT INTO student_social_links (
         student_id, linkedin_url, github_url, portfolio_url, personal_website_url,
         leetcode_url, hackerrank_url, codechef_url, geeksforgeeks_url, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(student_id) DO UPDATE SET
         linkedin_url = excluded.linkedin_url,
         github_url = excluded.github_url,
         portfolio_url = excluded.portfolio_url,
         personal_website_url = excluded.personal_website_url,
         leetcode_url = excluded.leetcode_url,
         hackerrank_url = excluded.hackerrank_url,
         codechef_url = excluded.codechef_url,
         geeksforgeeks_url = excluded.geeksforgeeks_url,
         updated_at = CURRENT_TIMESTAMP`,
      [
        studentId,
        payload.socialLinks.linkedin_url || null,
        payload.socialLinks.github_url || null,
        payload.socialLinks.portfolio_url || null,
        payload.socialLinks.personal_website_url || null,
        payload.socialLinks.leetcode_url || null,
        payload.socialLinks.hackerrank_url || null,
        payload.socialLinks.codechef_url || null,
        payload.socialLinks.geeksforgeeks_url || null,
      ]
    );

    // 10. Upsert student_resumes if uploaded
    if (payload.resume && payload.resume.file_data_url) {
      db.run(
        `INSERT INTO student_resumes (student_id, file_name, file_size, mime_type, file_data_url, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET
           file_name = excluded.file_name,
           file_size = excluded.file_size,
           mime_type = excluded.mime_type,
           file_data_url = excluded.file_data_url,
           uploaded_at = excluded.uploaded_at`,
        [
          studentId,
          payload.resume.file_name,
          payload.resume.file_size,
          payload.resume.mime_type || 'application/pdf',
          payload.resume.file_data_url,
          payload.resume.uploaded_at || new Date().toISOString(),
        ]
      );
    } else if (payload.resume === null) {
      db.run('DELETE FROM student_resumes WHERE student_id = ?', [studentId]);
    }

    // 11. Sync coordinator assignment if branch/section updated
    db.run('DELETE FROM faculty_student_assignments WHERE student_id = ?', [studentId]);
    resolveAssignedFaculty(db, studentId, branchCode, payload.academic.section || 'A');

    // 12. Mark submission APPROVED and record history
    db.run(
      `UPDATE profile_submissions
       SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, faculty_remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ?`,
      [reviewer.userId, facultyRemarks || 'Approved and synced to official student record.', submissionId]
    );

    db.run(
      `INSERT INTO profile_approval_history (submission_id, student_id, faculty_user_id, faculty_name, action, remarks)
       VALUES (?, ?, ?, ?, 'APPROVED', ?)`,
      [submissionId, studentId, reviewer.userId, reviewer.fullName, facultyRemarks || 'Official student profile updated.']
    );

    db.run('COMMIT');
    saveDatabase();
  } catch (err) {
    try {
      db.run('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}
