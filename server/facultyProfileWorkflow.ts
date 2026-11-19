import type { Database } from 'sql.js';
import { queryAll, queryOne, saveDatabase } from './db.ts';
import {
  type AuthContextUser,
  estimateDataUrlBytes,
  getFacultyAssignedBranches,
  isValidHttpUrl,
  type ProfileApprovalStatus,
  type ProfileDiffItem,
} from './profileWorkflow.ts';

export interface FacultySkillRecord {
  faculty_skill_id: number;
  faculty_id: number;
  user_id: number;
  skill_id: number | null;
  skill_name: string;
  category: string;
  proficiency_level: number;
  proficiency_label: 'Beginner' | 'Intermediate' | 'Advanced';
  experience_duration: string;
  verified: number;
  created_at?: string;
  updated_at?: string;
}

export interface FacultyProfileDraftPayload {
  personal: {
    full_name: string;
    personal_email: string;
    phone: string;
    alternate_phone: string;
    office_room: string;
    photo_data_url?: string | null;
  };
  academic: {
    employee_id: string;
    designation: string;
    department_name: string;
    assigned_branches: string[];
    qualification: string;
    specialization: string;
    experience_years: number | null;
    bio: string;
    research_interests: string;
    publications_summary: string;
    certifications_summary: string;
    achievements_summary: string;
  };
  socialLinks: {
    linkedin_url: string;
    google_scholar_url: string;
    orcid_url: string;
    github_url: string;
  };
}

export interface ResolvedFacultyIdentity {
  faculty_id: number;
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  employee_id: string;
  designation: string;
  department_name: string;
  assigned_branches: string[];
  is_active: number;
}

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

export function proficiencyLabelFromLevel(level: number): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (level >= 4) return 'Advanced';
  if (level >= 2) return 'Intermediate';
  return 'Beginner';
}

export function resolveFacultyForUser(db: Database, userId: number): ResolvedFacultyIdentity | null {
  const user = queryOne<{
    user_id: number;
    username: string;
    email: string;
    role: string;
    full_name: string;
    employee_id: string | null;
    assigned_branch: string | null;
    designation: string | null;
    department_name: string | null;
    is_active: number;
  }>(
    db,
    `SELECT user_id, username, email, role, full_name, employee_id, assigned_branch, designation, department_name, is_active
     FROM users
     WHERE user_id = ? AND role IN ('FACULTY', 'FACULTY_COORDINATOR') AND is_active = 1`,
    [userId]
  );
  if (!user) return null;

  let fac = queryOne<{
    faculty_id: number;
    employee_id: string;
    full_name: string;
    email: string;
    branch_code: string | null;
    designation: string;
    department_name: string | null;
    assigned_branches_summary: string | null;
    is_active: number;
  }>(db, 'SELECT * FROM faculty WHERE user_id = ?', [user.user_id]);

  if (!fac) {
    const empCode = user.employee_id || `FAC-USR-${user.user_id}`;
    db.run(
      `INSERT OR IGNORE INTO faculty (user_id, employee_id, full_name, email, branch_code, designation, department_name, assigned_branches_summary, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        user.user_id,
        empCode,
        user.full_name,
        user.email,
        user.assigned_branch || null,
        user.designation || 'Faculty Coordinator',
        user.department_name || null,
        user.assigned_branch || null,
      ]
    );
    saveDatabase();
    fac = queryOne(db, 'SELECT * FROM faculty WHERE user_id = ?', [user.user_id]);
  }
  if (!fac) return null;

  const assignedBranches = getFacultyAssignedBranches(
    db,
    user.user_id,
    user.assigned_branch || fac.assigned_branches_summary || fac.branch_code
  );

  return {
    faculty_id: Number(fac.faculty_id),
    user_id: Number(user.user_id),
    username: String(user.username),
    email: String(user.email),
    full_name: String(fac.full_name || user.full_name),
    employee_id: String(fac.employee_id || user.employee_id || ''),
    designation: String(fac.designation || user.designation || ''),
    department_name: String(fac.department_name || user.department_name || ''),
    assigned_branches: assignedBranches,
    is_active: Number(fac.is_active ?? 1),
  };
}

export function listFacultySkills(db: Database, facultyId: number): FacultySkillRecord[] {
  const rows = queryAll<Record<string, unknown>>(
    db,
    `SELECT fs.*, s.category AS catalog_category
     FROM faculty_skills fs
     LEFT JOIN skills s ON fs.skill_id = s.skill_id
     WHERE fs.faculty_id = ?
     ORDER BY fs.proficiency_level DESC, LOWER(fs.skill_name) ASC`,
    [facultyId]
  );
  return rows.map((r) => ({
    faculty_skill_id: Number(r.faculty_skill_id),
    faculty_id: Number(r.faculty_id),
    user_id: Number(r.user_id),
    skill_id: r.skill_id ? Number(r.skill_id) : null,
    skill_name: String(r.skill_name),
    category: String(r.category || r.catalog_category || 'Technical'),
    proficiency_level: Number(r.proficiency_level),
    proficiency_label:
      (r.proficiency_label as 'Beginner' | 'Intermediate' | 'Advanced') ||
      proficiencyLabelFromLevel(Number(r.proficiency_level)),
    experience_duration: String(r.experience_duration || ''),
    verified: Number(r.verified || 0),
    created_at: r.created_at ? String(r.created_at) : undefined,
    updated_at: r.updated_at ? String(r.updated_at) : undefined,
  }));
}

export function buildOfficialFacultyDossier(db: Database, userId: number): {
  identity: ResolvedFacultyIdentity;
  officialProfile: FacultyProfileDraftPayload;
  skills: FacultySkillRecord[];
  lastApprovedAt: string | null;
  lastApprovedByName: string | null;
} | null {
  const identity = resolveFacultyForUser(db, userId);
  if (!identity) return null;

  const ext = queryOne<Record<string, unknown>>(
    db,
    `SELECT fp.*, rv.full_name AS last_approved_by_name
     FROM faculty_profiles fp
     LEFT JOIN users rv ON fp.last_approved_by = rv.user_id
     WHERE fp.faculty_id = ?`,
    [identity.faculty_id]
  );

  const skills = listFacultySkills(db, identity.faculty_id);

  const officialProfile: FacultyProfileDraftPayload = {
    personal: {
      full_name: identity.full_name,
      personal_email: String(ext?.personal_email || ''),
      phone: String(ext?.phone || ''),
      alternate_phone: String(ext?.alternate_phone || ''),
      office_room: String(ext?.office_room || ''),
      photo_data_url: (ext?.photo_data_url as string | null) || null,
    },
    academic: {
      employee_id: identity.employee_id,
      designation: identity.designation,
      department_name: identity.department_name,
      assigned_branches: identity.assigned_branches,
      qualification: String(ext?.qualification || ''),
      specialization: String(ext?.specialization || ''),
      experience_years:
        ext?.experience_years !== null && ext?.experience_years !== undefined
          ? Number(ext.experience_years)
          : null,
      bio: String(ext?.bio || ''),
      research_interests: String(ext?.research_interests || ''),
      publications_summary: String(ext?.publications_summary || ''),
      certifications_summary: String(ext?.certifications_summary || ''),
      achievements_summary: String(ext?.achievements_summary || ''),
    },
    socialLinks: {
      linkedin_url: String(ext?.linkedin_url || ''),
      google_scholar_url: String(ext?.google_scholar_url || ''),
      orcid_url: String(ext?.orcid_url || ''),
      github_url: String(ext?.github_url || ''),
    },
  };

  return {
    identity,
    officialProfile,
    skills,
    lastApprovedAt: ext?.last_approved_at ? String(ext.last_approved_at) : null,
    lastApprovedByName: ext?.last_approved_by_name ? String(ext.last_approved_by_name) : null,
  };
}

export function normalizeAndValidateFacultyDraft(
  raw: unknown,
  officialProfile: FacultyProfileDraftPayload,
  strictForSubmit: boolean
): { valid: true; payload: FacultyProfileDraftPayload } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Invalid faculty profile payload.' };
  }
  const b = raw as Partial<FacultyProfileDraftPayload>;
  const p = b.personal ?? officialProfile.personal;
  const a = b.academic ?? officialProfile.academic;
  const sl = b.socialLinks ?? officialProfile.socialLinks;

  const fullName = String(p.full_name ?? officialProfile.personal.full_name).trim();
  const personalEmail = String(p.personal_email ?? '').trim();
  if (strictForSubmit && fullName.length < 2) {
    return { valid: false, error: 'Full Name must be at least 2 characters.' };
  }
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    return { valid: false, error: 'Personal Email format is invalid.' };
  }

  if (p.photo_data_url) {
    if (!String(p.photo_data_url).startsWith('data:image/')) {
      return { valid: false, error: 'Profile photograph must be PNG, JPG, or WebP.' };
    }
    if (estimateDataUrlBytes(String(p.photo_data_url)) > MAX_IMAGE_BYTES) {
      return { valid: false, error: 'Profile photograph must be 1.5 MB or smaller.' };
    }
  }

  let expYears: number | null = null;
  if (a.experience_years !== null && a.experience_years !== undefined && String(a.experience_years) !== '') {
    const parsed = Number(a.experience_years);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 60) {
      return { valid: false, error: 'Years of experience must be between 0 and 60.' };
    }
    expYears = Math.round(parsed * 10) / 10;
  }

  const linkFields: [keyof FacultyProfileDraftPayload['socialLinks'], string][] = [
    ['linkedin_url', 'LinkedIn'],
    ['google_scholar_url', 'Google Scholar'],
    ['orcid_url', 'ORCID'],
    ['github_url', 'GitHub'],
  ];
  const cleanSocial: FacultyProfileDraftPayload['socialLinks'] = {
    linkedin_url: '',
    google_scholar_url: '',
    orcid_url: '',
    github_url: '',
  };
  for (const [key, label] of linkFields) {
    const val = String(sl?.[key] || '').trim();
    if (val && !isValidHttpUrl(val)) {
      return { valid: false, error: `${label} link must be a valid HTTP/HTTPS URL.` };
    }
    cleanSocial[key] = val;
  }

  return {
    valid: true,
    payload: {
      personal: {
        full_name: fullName || officialProfile.personal.full_name,
        personal_email: personalEmail,
        phone: String(p.phone ?? '').trim(),
        alternate_phone: String(p.alternate_phone ?? '').trim(),
        office_room: String(p.office_room ?? '').trim(),
        photo_data_url: p.photo_data_url ?? officialProfile.personal.photo_data_url ?? null,
      },
      academic: {
        // Keep institutional identifiers authoritative from directory policy
        employee_id: officialProfile.academic.employee_id,
        designation: officialProfile.academic.designation,
        department_name: officialProfile.academic.department_name,
        assigned_branches: officialProfile.academic.assigned_branches,
        qualification: String(a.qualification ?? '').trim(),
        specialization: String(a.specialization ?? '').trim(),
        experience_years: expYears,
        bio: String(a.bio ?? '').trim(),
        research_interests: String(a.research_interests ?? '').trim(),
        publications_summary: String(a.publications_summary ?? '').trim(),
        certifications_summary: String(a.certifications_summary ?? '').trim(),
        achievements_summary: String(a.achievements_summary ?? '').trim(),
      },
      socialLinks: cleanSocial,
    },
  };
}

export function computeFacultyFieldDiffs(
  prev: FacultyProfileDraftPayload,
  next: FacultyProfileDraftPayload
): ProfileDiffItem[] {
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

  pushScalar('Personal & Contact', 'personal.full_name', 'Full Name', prev.personal.full_name, next.personal.full_name);
  pushScalar('Personal & Contact', 'personal.personal_email', 'Personal Email', prev.personal.personal_email, next.personal.personal_email);
  pushScalar('Personal & Contact', 'personal.phone', 'Mobile Phone', prev.personal.phone, next.personal.phone);
  pushScalar('Personal & Contact', 'personal.alternate_phone', 'Alternate Phone', prev.personal.alternate_phone, next.personal.alternate_phone);
  pushScalar('Personal & Contact', 'personal.office_room', 'Office / Cabin Room', prev.personal.office_room, next.personal.office_room);
  if ((prev.personal.photo_data_url || '') !== (next.personal.photo_data_url || '')) {
    diffs.push({
      section_name: 'Personal & Contact',
      field_key: 'personal.photo_data_url',
      field_label: 'Profile Photograph',
      previous_value: prev.personal.photo_data_url ? 'Uploaded Photo' : 'None',
      new_value: next.personal.photo_data_url ? 'Updated Photo' : 'Removed',
      is_changed: 1,
    });
  }

  pushScalar('Academic & Research', 'academic.qualification', 'Highest Qualification', prev.academic.qualification, next.academic.qualification);
  pushScalar('Academic & Research', 'academic.specialization', 'Specialization', prev.academic.specialization, next.academic.specialization);
  pushScalar(
    'Academic & Research',
    'academic.experience_years',
    'Experience (Years)',
    prev.academic.experience_years ?? '',
    next.academic.experience_years ?? ''
  );
  pushScalar('Academic & Research', 'academic.bio', 'Faculty Bio', prev.academic.bio, next.academic.bio);
  pushScalar('Academic & Research', 'academic.research_interests', 'Research Interests', prev.academic.research_interests, next.academic.research_interests);
  pushScalar('Academic & Research', 'academic.publications_summary', 'Publications & Patents', prev.academic.publications_summary, next.academic.publications_summary);
  pushScalar('Academic & Research', 'academic.certifications_summary', 'Certifications & FDPs', prev.academic.certifications_summary, next.academic.certifications_summary);
  pushScalar('Academic & Research', 'academic.achievements_summary', 'Awards & Recognition', prev.academic.achievements_summary, next.academic.achievements_summary);

  pushScalar('Professional Links', 'social.linkedin_url', 'LinkedIn URL', prev.socialLinks.linkedin_url, next.socialLinks.linkedin_url);
  pushScalar('Professional Links', 'social.google_scholar_url', 'Google Scholar URL', prev.socialLinks.google_scholar_url, next.socialLinks.google_scholar_url);
  pushScalar('Professional Links', 'social.orcid_url', 'ORCID URL', prev.socialLinks.orcid_url, next.socialLinks.orcid_url);
  pushScalar('Professional Links', 'social.github_url', 'GitHub URL', prev.socialLinks.github_url, next.socialLinks.github_url);

  return diffs;
}

export function generateFacultySubmissionCode(db: Database): string {
  const row = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM faculty_profile_submissions');
  const seq = (row?.c ?? 0) + 1;
  const rand = Math.floor(100 + Math.random() * 900);
  return `FAC-SUB-2026-${String(seq).padStart(3, '0')}${rand}`;
}

export function hydrateFacultySubmissionRow(row: Record<string, unknown>) {
  let draftPayload: FacultyProfileDraftPayload | null = null;
  let previousSnapshot: FacultyProfileDraftPayload | null = null;
  let diffs: ProfileDiffItem[] = [];
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
  try {
    if (row.changed_fields_json) {
      diffs = JSON.parse(String(row.changed_fields_json));
    }
  } catch {
    diffs = [];
  }

  return {
    submission_id: Number(row.submission_id),
    submission_code: String(row.submission_code),
    faculty_id: Number(row.faculty_id),
    user_id: Number(row.user_id),
    faculty_name: row.faculty_name ? String(row.faculty_name) : undefined,
    employee_id: row.employee_id ? String(row.employee_id) : undefined,
    designation: row.designation ? String(row.designation) : undefined,
    department_name: row.department_name ? String(row.department_name) : undefined,
    status: String(row.status) as ProfileApprovalStatus,
    draft_payload: draftPayload,
    previous_snapshot: previousSnapshot,
    changed_fields: diffs,
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
    reviewed_by: row.reviewed_by ? Number(row.reviewed_by) : null,
    reviewed_by_name: row.reviewed_by_name ? String(row.reviewed_by_name) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewer_remarks: row.reviewer_remarks ? String(row.reviewer_remarks) : null,
    updated_at: String(row.updated_at || ''),
  };
}

export function applyApprovedFacultyRevisionTransaction(
  db: Database,
  submissionId: number,
  facultyId: number,
  targetUserId: number,
  payload: FacultyProfileDraftPayload,
  reviewer: AuthContextUser,
  remarks: string
): void {
  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      'UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [payload.personal.full_name, targetUserId]
    );
    db.run(
      'UPDATE faculty SET full_name = ? WHERE faculty_id = ?',
      [payload.personal.full_name, facultyId]
    );

    db.run(
      `INSERT INTO faculty_profiles (
         faculty_id, user_id, phone, alternate_phone, personal_email,
         qualification, specialization, experience_years, office_room,
         bio, research_interests, publications_summary, certifications_summary, achievements_summary,
         linkedin_url, google_scholar_url, orcid_url, github_url, photo_data_url,
         last_approved_at, last_approved_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(faculty_id) DO UPDATE SET
         phone = excluded.phone,
         alternate_phone = excluded.alternate_phone,
         personal_email = excluded.personal_email,
         qualification = excluded.qualification,
         specialization = excluded.specialization,
         experience_years = excluded.experience_years,
         office_room = excluded.office_room,
         bio = excluded.bio,
         research_interests = excluded.research_interests,
         publications_summary = excluded.publications_summary,
         certifications_summary = excluded.certifications_summary,
         achievements_summary = excluded.achievements_summary,
         linkedin_url = excluded.linkedin_url,
         google_scholar_url = excluded.google_scholar_url,
         orcid_url = excluded.orcid_url,
         github_url = excluded.github_url,
         photo_data_url = excluded.photo_data_url,
         last_approved_at = CURRENT_TIMESTAMP,
         last_approved_by = excluded.last_approved_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        facultyId,
        targetUserId,
        payload.personal.phone || null,
        payload.personal.alternate_phone || null,
        payload.personal.personal_email || null,
        payload.academic.qualification || null,
        payload.academic.specialization || null,
        payload.academic.experience_years,
        payload.personal.office_room || null,
        payload.academic.bio || null,
        payload.academic.research_interests || null,
        payload.academic.publications_summary || null,
        payload.academic.certifications_summary || null,
        payload.academic.achievements_summary || null,
        payload.socialLinks.linkedin_url || null,
        payload.socialLinks.google_scholar_url || null,
        payload.socialLinks.orcid_url || null,
        payload.socialLinks.github_url || null,
        payload.personal.photo_data_url || null,
        reviewer.userId,
      ]
    );

    db.run(
      `UPDATE faculty_profile_submissions
       SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reviewer_remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ?`,
      [reviewer.userId, remarks || 'Approved and published to official faculty profile.', submissionId]
    );

    db.run(
      `INSERT INTO faculty_profile_approval_history (submission_id, faculty_id, reviewer_user_id, reviewer_name, action, remarks)
       VALUES (?, ?, ?, ?, 'APPROVED', ?)`,
      [submissionId, facultyId, reviewer.userId, reviewer.fullName, remarks || 'Official faculty profile updated.']
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
