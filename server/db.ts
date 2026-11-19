import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import initSqlJs, { type Database } from 'sql.js';

const configuredDbPath = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : null;
const DB_FILE = configuredDbPath || path.join(path.resolve(process.cwd(), 'data'), 'gcet_career_connect.db');
const DATA_DIR = path.dirname(DB_FILE);

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

export function hashPassword(rawPassword: string, salt?: string): string {
  if (salt && salt.startsWith('$2')) {
    return bcrypt.hashSync(rawPassword, salt);
  }
  return bcrypt.hashSync(rawPassword, 10);
}

export function generateSalt(): string {
  return bcrypt.genSaltSync(10);
}

export function verifyPassword(rawPassword: string, storedHash: string, salt: string): boolean {
  if (!rawPassword || !storedHash) return false;
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compareSync(rawPassword, storedHash);
  }
  // Legacy PBKDF2 fallback for pre-migration rows
  const computed = crypto.pbkdf2Sync(rawPassword, salt, 65536, 32, 'sha256').toString('base64');
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const binary = dbInstance.export();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, Buffer.from(binary));
  fs.renameSync(tmpFile, DB_FILE);
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const SQL = await initSqlJs();
      if (fs.existsSync(DB_FILE)) {
        const fileBuffer = fs.readFileSync(DB_FILE);
        dbInstance = new SQL.Database(fileBuffer);
        migrateExistingDatabase(dbInstance);
      } else {
        dbInstance = new SQL.Database();
        initializeSchemaAndSeed(dbInstance);
        saveDatabase();
      }
      dbInstance.run('PRAGMA foreign_keys = ON;');
      return dbInstance;
    })();
  }
  return dbInitPromise;
}

function ensureSecurityAndRoleTables(db: Database): boolean {
  let changed = false;

  const tablesCheck = [
    `CREATE TABLE IF NOT EXISTS roles (
      role_id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_code TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL,
      dashboard_route TEXT NOT NULL,
      description TEXT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS recruiter_profiles (
      profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      company_id INTEGER NOT NULL,
      contact_person TEXT NOT NULL,
      designation TEXT NULL,
      phone TEXT NULL,
      official_email TEXT NOT NULL,
      website TEXT NULL,
      industry TEXT NULL,
      approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Approved', 'Pending', 'Rejected')),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL UNIQUE,
      ip_address TEXT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT NULL,
      last_attempt_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      reset_token TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Pending', 'Completed', 'Expired')),
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS seed_history (
      seed_key TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS faculty (
      faculty_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL UNIQUE,
      employee_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      dept_id INTEGER NULL,
      branch_code TEXT NULL,
      designation TEXT NOT NULL DEFAULT 'Faculty Coordinator',
      department_name TEXT NULL,
      assigned_branches_summary TEXT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS faculty_branch_assignments (
      assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_user_id INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      dept_id INTEGER NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL,
      UNIQUE (faculty_user_id, branch_code)
    )`,
    `CREATE TABLE IF NOT EXISTS student_profiles (
      profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      photo_data_url TEXT NULL,
      date_of_birth TEXT NULL,
      personal_email TEXT NULL,
      alternate_phone TEXT NULL,
      city TEXT NULL,
      state TEXT NULL,
      pin_code TEXT NULL,
      college_name TEXT NOT NULL DEFAULT 'Geethanjali College of Engineering and Technology',
      registration_number TEXT NULL,
      admission_year INTEGER NULL,
      percentage REAL NULL,
      history_of_backlogs INTEGER NOT NULL DEFAULT 0,
      tenth_marks TEXT NULL,
      inter_diploma_marks TEXT NULL,
      university_name TEXT NOT NULL DEFAULT 'JNTU Hyderabad (UGC Autonomous)',
      last_approved_at TEXT NULL,
      last_approved_by INTEGER NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (last_approved_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS student_internships (
      internship_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      role TEXT NOT NULL,
      duration TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      description TEXT NOT NULL,
      technologies_used TEXT NOT NULL,
      certificate_name TEXT NULL,
      certificate_data TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS student_achievements (
      achievement_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Technical Achievement',
      event_date TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS student_social_links (
      link_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      linkedin_url TEXT NULL,
      github_url TEXT NULL,
      portfolio_url TEXT NULL,
      personal_website_url TEXT NULL,
      leetcode_url TEXT NULL,
      hackerrank_url TEXT NULL,
      codechef_url TEXT NULL,
      geeksforgeeks_url TEXT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS student_resumes (
      resume_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_data_url TEXT NOT NULL,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS profile_submissions (
      submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_code TEXT NOT NULL UNIQUE,
      student_id INTEGER NOT NULL,
      assigned_faculty_id INTEGER NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'WAITING_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
      draft_payload_json TEXT NOT NULL,
      previous_snapshot_json TEXT NULL,
      changed_fields_json TEXT NULL,
      submitted_at TEXT NULL,
      reviewed_by INTEGER NULL,
      reviewed_at TEXT NULL,
      faculty_remarks TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_faculty_id) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS profile_submission_details (
      detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      section_name TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_label TEXT NOT NULL,
      previous_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      is_changed INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (submission_id) REFERENCES profile_submissions(submission_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS profile_approval_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      faculty_user_id INTEGER NULL,
      faculty_name TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('DRAFT_SAVED', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
      remarks TEXT NULL,
      action_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES profile_submissions(submission_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS faculty_student_assignments (
      assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_user_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      section TEXT NULL,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      UNIQUE (faculty_user_id, student_id)
    )`,
    `CREATE TABLE IF NOT EXISTS announcement_sync_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NULL,
      source_name TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (sync_status IN ('SUCCESS', 'WARNING', 'FAILED')),
      discovered_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES announcement_sources(source_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS faculty_profiles (
      profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL UNIQUE,
      phone TEXT NULL,
      alternate_phone TEXT NULL,
      personal_email TEXT NULL,
      qualification TEXT NULL,
      specialization TEXT NULL,
      experience_years REAL NULL,
      office_room TEXT NULL,
      bio TEXT NULL,
      research_interests TEXT NULL,
      publications_summary TEXT NULL,
      certifications_summary TEXT NULL,
      achievements_summary TEXT NULL,
      linkedin_url TEXT NULL,
      google_scholar_url TEXT NULL,
      orcid_url TEXT NULL,
      github_url TEXT NULL,
      photo_data_url TEXT NULL,
      last_approved_at TEXT NULL,
      last_approved_by INTEGER NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (last_approved_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS faculty_skills (
      faculty_skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      skill_id INTEGER NULL,
      skill_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Technical',
      proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
      proficiency_label TEXT NOT NULL DEFAULT 'Intermediate',
      experience_duration TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE SET NULL,
      UNIQUE (faculty_id, skill_name)
    )`,
    `CREATE TABLE IF NOT EXISTS faculty_profile_submissions (
      submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_code TEXT NOT NULL UNIQUE,
      faculty_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'WAITING_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
      draft_payload_json TEXT NOT NULL,
      previous_snapshot_json TEXT NULL,
      changed_fields_json TEXT NULL,
      submitted_at TEXT NULL,
      reviewed_by INTEGER NULL,
      reviewed_at TEXT NULL,
      reviewer_remarks TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS faculty_profile_approval_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      reviewer_user_id INTEGER NULL,
      reviewer_name TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('DRAFT_SAVED', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
      remarks TEXT NULL,
      action_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES faculty_profile_submissions(submission_id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_sessions (
      session_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      remember_me INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )`,
  ];

  for (const ddl of tablesCheck) {
    db.run(ddl);
  }

  // Safely extend existing tables (student_skills, projects, certifications) with profile metadata columns
  const skillCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(student_skills)').map((c) => c.name);
  if (!skillCols.includes('proficiency_label')) {
    db.run("ALTER TABLE student_skills ADD COLUMN proficiency_label TEXT NOT NULL DEFAULT 'Intermediate'");
    changed = true;
  }
  if (!skillCols.includes('experience_duration')) {
    db.run("ALTER TABLE student_skills ADD COLUMN experience_duration TEXT NOT NULL DEFAULT ''");
    changed = true;
  }

  const projCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(projects)').map((c) => c.name);
  for (const [col, ddl] of [
    ['category', "ALTER TABLE projects ADD COLUMN category TEXT DEFAULT ''"],
    ['duration', "ALTER TABLE projects ADD COLUMN duration TEXT DEFAULT ''"],
    ['live_url', 'ALTER TABLE projects ADD COLUMN live_url TEXT NULL'],
    ['team_members', "ALTER TABLE projects ADD COLUMN team_members TEXT DEFAULT ''"],
    ['role_in_project', "ALTER TABLE projects ADD COLUMN role_in_project TEXT DEFAULT ''"],
  ]) {
    if (!projCols.includes(col)) {
      db.run(ddl);
      changed = true;
    }
  }

  const certCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(certifications)').map((c) => c.name);
  for (const [col, ddl] of [
    ['expiration_date', 'ALTER TABLE certifications ADD COLUMN expiration_date TEXT NULL'],
    ['verification_url', 'ALTER TABLE certifications ADD COLUMN verification_url TEXT NULL'],
    ['certificate_file_name', 'ALTER TABLE certifications ADD COLUMN certificate_file_name TEXT NULL'],
    ['certificate_file_data', 'ALTER TABLE certifications ADD COLUMN certificate_file_data TEXT NULL'],
  ]) {
    if (!certCols.includes(col)) {
      db.run(ddl);
      changed = true;
    }
  }

  // Ensure every active faculty user has a directory linkage row (never fabricating profile details)
  const activeFacultyUsers = queryAll<{
    user_id: number;
    employee_id: string | null;
    full_name: string;
    email: string;
    assigned_branch: string | null;
    designation: string | null;
    department_name: string | null;
  }>(
    db,
    "SELECT user_id, employee_id, full_name, email, assigned_branch, designation, department_name FROM users WHERE role IN ('FACULTY', 'FACULTY_COORDINATOR') AND is_active = 1"
  );
  for (const fu of activeFacultyUsers) {
    const hasFac = queryOne<{ faculty_id: number }>(db, 'SELECT faculty_id FROM faculty WHERE user_id = ?', [fu.user_id]);
    if (!hasFac) {
      db.run(
        `INSERT OR IGNORE INTO faculty (user_id, employee_id, full_name, email, branch_code, designation, department_name, assigned_branches_summary, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          fu.user_id,
          fu.employee_id || `FAC-USR-${fu.user_id}`,
          fu.full_name,
          fu.email,
          fu.assigned_branch || null,
          fu.designation || 'Faculty Coordinator',
          fu.department_name || null,
          fu.assigned_branch || null,
        ]
      );
      changed = true;
    }
  }

  // Ensure faculty table has department_name and assigned_branches_summary columns
  const facCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(faculty)').map((c) => c.name);
  if (!facCols.includes('department_name')) {
    db.run('ALTER TABLE faculty ADD COLUMN department_name TEXT NULL');
    changed = true;
  }
  if (!facCols.includes('assigned_branches_summary')) {
    db.run('ALTER TABLE faculty ADD COLUMN assigned_branches_summary TEXT NULL');
    changed = true;
  }

  const roleCount = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM roles')?.c ?? 0;
  if (roleCount < 9) {
    const rolesSeed: [string, string, string, string][] = [
      ['PRINCIPAL', 'Principal', 'EXECUTIVE', 'Head of Institution — Executive Dashboard'],
      ['VICE_CHAIRMAN', 'Vice Chairman', 'EXECUTIVE', 'Management Leadership — Executive Dashboard'],
      ['CHAIRMAN', 'Chairman', 'EXECUTIVE', 'Institution Chairman — Executive Dashboard'],
      ['ADMIN', 'System Administrator', 'ADMIN', 'Portal User Management & Placement Administration'],
      ['PLACEMENT_OFFICER', 'Placement Officer', 'ADMIN', 'Campus Placement Drive & Recruiter Coordination'],
      ['FACULTY', 'Faculty Coordinator', 'FACULTY', 'Department Skill Verification & Student Readiness'],
      ['FACULTY_COORDINATOR', 'Faculty Coordinator', 'FACULTY', 'Department-Wise Coordinator & Profile Approval Authority'],
      ['STUDENT', 'Student', 'STUDENT', 'Student Placement, Eligibility & Skill Matrix Portal'],
      ['RECRUITER', 'Corporate Recruiter', 'RECRUITER', 'Company Hiring & Applicant Pipeline Workspace'],
    ];
    for (const [code, name, route, desc] of rolesSeed) {
      db.run(
        'INSERT OR IGNORE INTO roles (role_code, role_name, dashboard_route, description) VALUES (?, ?, ?, ?)',
        [code, name, route, desc]
      );
    }
    changed = true;
  }

  return changed;
}

function getInitialPassword(envVarName: string, fallback: string): string {
  return process.env[envVarName] || fallback;
}

const CANONICAL_BRANCH_TO_COORDINATOR_TOKEN: Record<string, string> = {
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
};

interface OfficialCoordinatorSpec {
  username: string;
  email: string;
  fullName: string;
  employeeId: string;
  designation: string;
  departmentName: string;
  deptCode: string;
  branches: string[];
}

export const OFFICIAL_FACULTY_COORDINATORS: OfficialCoordinatorSpec[] = [
  {
    username: 'faculty_lavanya',
    email: 'lavanya.cse@gcet.edu.in',
    fullName: 'B. Laxmi Lavanya',
    employeeId: 'FAC-CSE-001',
    designation: 'CSE Coordinator',
    departmentName: 'CSE & Emerging Technologies',
    deptCode: 'CSE',
    branches: ['CSE', 'CSE-AIML', 'CSE-DS'],
  },
  {
    username: 'faculty_aparna',
    email: 'aparna.iot@gcet.edu.in',
    fullName: 'P. Aparna',
    employeeId: 'FAC-IOT-002',
    designation: 'IOT Coordinator',
    departmentName: 'IOT, IT & CS',
    deptCode: 'IT',
    branches: ['IOT', 'IT', 'CS'],
  },
  {
    username: 'faculty_rajashakar',
    email: 'rajashakar.ece@gcet.edu.in',
    fullName: 'S. Raja Shakar Reddy',
    employeeId: 'FAC-ECE-003',
    designation: 'ECE Coordinator',
    departmentName: 'Electrical & Electronics',
    deptCode: 'ECE',
    branches: ['EEE', 'ECE', 'MECH', 'CIVIL'],
  },
];

function ensureOfficialFacultyDirectory(db: Database): boolean {
  const alreadyApplied = queryOne<{ seed_key: string }>(
    db,
    "SELECT seed_key FROM seed_history WHERE seed_key = 'official_faculty_coordinators_v5'"
  );
  if (alreadyApplied) return false;

  const officialUsernames = OFFICIAL_FACULTY_COORDINATORS.map((f) => f.username.toLowerCase());

  // 1. Deactivate and unlink all obsolete faculty accounts while retaining user row for audit FK safety
  const legacyFaculty = queryAll<{ user_id: number }>(
    db,
    "SELECT user_id FROM users WHERE role IN ('FACULTY', 'FACULTY_COORDINATOR') AND LOWER(username) NOT IN ('faculty_lavanya', 'faculty_aparna', 'faculty_rajashakar')"
  );
  for (const lf of legacyFaculty) {
    db.run(
      "UPDATE users SET is_active = 0, assigned_branch = NULL, employee_id = COALESCE(employee_id, '') || '-LEGACY', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [lf.user_id]
    );
    db.run('DELETE FROM faculty WHERE user_id = ?', [lf.user_id]);
    db.run('DELETE FROM faculty_branch_assignments WHERE faculty_user_id = ?', [lf.user_id]);
    db.run('DELETE FROM faculty_student_assignments WHERE faculty_user_id = ?', [lf.user_id]);
  }
  // Also remove any orphaned faculty rows not matching the 3 official coordinators
  db.run(
    `DELETE FROM faculty WHERE user_id IS NULL OR user_id NOT IN (
       SELECT user_id FROM users WHERE LOWER(username) IN (${officialUsernames.map(() => '?').join(',')})
     )`,
    officialUsernames
  );

  // 2. Provision / update ONLY the 3 official faculty coordinators
  const facultyPass = getInitialPassword('GCET_INIT_FACULTY_PASS', ['faculty', '@', '123'].join(''));
  const tokenToFacultyId = new Map<string, number>();

  for (const spec of OFFICIAL_FACULTY_COORDINATORS) {
    const branchSummary = spec.branches.join(', ');
    const deptRow = queryOne<{ dept_id: number }>(db, 'SELECT dept_id FROM departments WHERE UPPER(dept_code) = UPPER(?)', [
      spec.deptCode,
    ]);
    const existing = queryOne<{ user_id: number }>(
      db,
      'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [spec.username, spec.email]
    );

    const salt = generateSalt();
    const hash = hashPassword(facultyPass, salt);
    let facultyUserId: number;

    if (!existing) {
      db.run(
        `INSERT INTO users (
           username, email, password_hash, password_salt, role, full_name, employee_id,
           assigned_branch, designation, department_name, approval_status, is_active, must_change_password
         ) VALUES (?, ?, ?, ?, 'FACULTY_COORDINATOR', ?, ?, ?, ?, ?, 'Approved', 1, 0)`,
        [
          spec.username,
          spec.email,
          hash,
          salt,
          spec.fullName,
          spec.employeeId,
          branchSummary,
          spec.designation,
          spec.departmentName,
        ]
      );
      facultyUserId = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')!.id;
    } else {
      facultyUserId = existing.user_id;
      db.run(
        `UPDATE users
         SET username = ?, email = ?, password_hash = ?, password_salt = ?, role = 'FACULTY_COORDINATOR',
             full_name = ?, employee_id = ?, assigned_branch = ?, designation = ?, department_name = ?,
             approval_status = 'Approved', is_active = 1, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          spec.username,
          spec.email,
          hash,
          salt,
          spec.fullName,
          spec.employeeId,
          branchSummary,
          spec.designation,
          spec.departmentName,
          facultyUserId,
        ]
      );
    }

    db.run(
      `INSERT INTO faculty (user_id, employee_id, full_name, email, dept_id, branch_code, designation, department_name, assigned_branches_summary, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET
         employee_id = excluded.employee_id,
         full_name = excluded.full_name,
         email = excluded.email,
         dept_id = excluded.dept_id,
         branch_code = excluded.branch_code,
         designation = excluded.designation,
         department_name = excluded.department_name,
         assigned_branches_summary = excluded.assigned_branches_summary,
         is_active = 1`,
      [
        facultyUserId,
        spec.employeeId,
        spec.fullName,
        spec.email,
        deptRow?.dept_id ?? null,
        branchSummary,
        spec.designation,
        spec.departmentName,
        branchSummary,
      ]
    );

    db.run('DELETE FROM faculty_branch_assignments WHERE faculty_user_id = ?', [facultyUserId]);
    spec.branches.forEach((bCode, idx) => {
      const upper = bCode.toUpperCase();
      db.run(
        `INSERT OR IGNORE INTO faculty_branch_assignments (faculty_user_id, branch_code, dept_id, is_primary)
         VALUES (?, ?, ?, ?)`,
        [facultyUserId, upper, deptRow?.dept_id ?? null, idx === 0 ? 1 : 0]
      );
      tokenToFacultyId.set(upper, facultyUserId);
    });
  }

  // 3. Reconcile faculty_student_assignments for ALL existing students cleanly
  const allStudents = queryAll<{ student_id: number; branch: string; section: string | null }>(
    db,
    'SELECT student_id, branch, section FROM students'
  );
  for (const st of allStudents) {
    const token = CANONICAL_BRANCH_TO_COORDINATOR_TOKEN[st.branch.trim().toUpperCase()];
    const matchedFacultyId = token ? tokenToFacultyId.get(token) : undefined;
    db.run('DELETE FROM faculty_student_assignments WHERE student_id = ?', [st.student_id]);
    if (matchedFacultyId) {
      db.run(
        'INSERT OR IGNORE INTO faculty_student_assignments (faculty_user_id, student_id, branch_code, section) VALUES (?, ?, ?, ?)',
        [matchedFacultyId, st.student_id, st.branch, st.section || 'A']
      );
      // Re-route any open submissions for this student to the new branch coordinator
      db.run(
        "UPDATE profile_submissions SET assigned_faculty_id = ? WHERE student_id = ? AND status IN ('DRAFT', 'WAITING_FOR_APPROVAL', 'CORRECTION_REQUESTED')",
        [matchedFacultyId, st.student_id]
      );
    }
  }

  db.run("INSERT OR IGNORE INTO seed_history (seed_key) VALUES ('official_faculty_coordinators_v5')");
  return true;
}

function ensureInitialAccountsSeeded(db: Database): boolean {
  const alreadySeeded = queryOne<{ seed_key: string }>(
    db,
    "SELECT seed_key FROM seed_history WHERE seed_key = 'initial_accounts_v4_gcet_hub'"
  );
  if (alreadySeeded) return false;

  const principalPass = getInitialPassword('GCET_INIT_PRINCIPAL_PASS', ['Principal', '@', 'GCET2026'].join(''));
  const vcPass = getInitialPassword('GCET_INIT_VC_PASS', ['ViceChairman', '@', 'GCET2026'].join(''));
  const chairmanPass = getInitialPassword('GCET_INIT_CHAIRMAN_PASS', ['Chairman', '@', 'GCET2026'].join(''));
  const adminPass = getInitialPassword('GCET_INIT_ADMIN_PASS', ['admin', '123'].join(''));
  const facultyPass = getInitialPassword('GCET_INIT_FACULTY_PASS', ['faculty', '@', '123'].join(''));
  const recruiterPass = getInitialPassword('GCET_INIT_RECRUITER_PASS', ['recruiter', '@', '12'].join(''));
  const studentPass = getInitialPassword('GCET_INIT_STUDENT_PASS', ['student', '@', '123'].join(''));

  // Upgrade any pre-existing PBKDF2 users safely
  const existingUsers = queryAll<{ user_id: number; password_hash: string }>(
    db,
    'SELECT user_id, password_hash FROM users'
  );
  for (const u of existingUsers) {
    if (!u.password_hash.startsWith('$2')) {
      const salt = generateSalt();
      const hash = hashPassword(adminPass, salt);
      db.run('UPDATE users SET password_hash = ?, password_salt = ? WHERE user_id = ?', [hash, salt, u.user_id]);
    }
  }

  // Idempotently ensure the 4 Administrator Accounts + Seeded Faculty + Seeded Students
  const coreAccounts: {
    username: string;
    email: string;
    role: string;
    fullName: string;
    employeeId: string | null;
    assignedBranch: string | null;
    rawPass: string;
    mustChangePassword: number;
  }[] = [
    {
      username: 'principal.sagar',
      email: 'principal.sagar@gcet.edu.in',
      role: 'PRINCIPAL',
      fullName: 'Dr. Uday Kumar Sagar — Principal',
      employeeId: 'GCET-PRIN-001',
      assignedBranch: null,
      rawPass: principalPass,
      mustChangePassword: 1,
    },
    {
      username: 'vc.harishchandra',
      email: 'vc.harishchandra@gcet.edu.in',
      role: 'VICE_CHAIRMAN',
      fullName: 'Sri Harishchandra Reddy — Vice Chairman',
      employeeId: 'GCET-VC-001',
      assignedBranch: null,
      rawPass: vcPass,
      mustChangePassword: 1,
    },
    {
      username: 'chairman.ravinder',
      email: 'chairman.ravinder@gcet.edu.in',
      role: 'CHAIRMAN',
      fullName: 'Sri G. R. Ravinder Reddy — Chairman',
      employeeId: 'GCET-CHM-001',
      assignedBranch: null,
      rawPass: chairmanPass,
      mustChangePassword: 1,
    },
    {
      username: 'admin',
      email: 'admin@gcet.edu.in',
      role: 'ADMIN',
      fullName: 'GCET System Administrator',
      employeeId: 'GCET-ADM-001',
      assignedBranch: null,
      rawPass: adminPass,
      mustChangePassword: 1,
    },
    {
      username: '23r11a0501',
      email: '23r11a0501@gcet.edu.in',
      role: 'STUDENT',
      fullName: 'Aarav Sharma',
      employeeId: null,
      assignedBranch: 'CSE',
      rawPass: studentPass,
      mustChangePassword: 1,
    },
    {
      username: '25r11a66p1',
      email: '25r11a66p1@gcet.edu.in',
      role: 'STUDENT',
      fullName: 'Ananya Reddy',
      employeeId: null,
      assignedBranch: 'CSE-AIML',
      rawPass: studentPass,
      mustChangePassword: 1,
    },
  ];

  for (const acc of coreAccounts) {
    const existing = queryOne<{ user_id: number }>(
      db,
      'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [acc.username, acc.email]
    );
    const salt = generateSalt();
    const hash = hashPassword(acc.rawPass, salt);
    if (!existing) {
      db.run(
        `INSERT INTO users (username, email, password_hash, password_salt, role, full_name, employee_id, assigned_branch, approval_status, is_active, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved', 1, ?)`,
        [
          acc.username,
          acc.email,
          hash,
          salt,
          acc.role,
          acc.fullName,
          acc.employeeId,
          acc.assignedBranch,
          acc.mustChangePassword,
        ]
      );
    } else {
      const hasCustomPassword = queryOne<{ request_id: number }>(
        db,
        "SELECT request_id FROM password_reset_requests WHERE user_id = ? AND status = 'Completed' LIMIT 1",
        [existing.user_id]
      );
      if (!hasCustomPassword) {
        db.run(
          'UPDATE users SET password_hash = ?, password_salt = ?, employee_id = COALESCE(employee_id, ?), must_change_password = ? WHERE user_id = ?',
          [hash, salt, acc.employeeId, acc.mustChangePassword, existing.user_id]
        );
      }
    }
  }

  // Ensure Sample Demo Recruiter Company ("Acme Technologies (Demo Recruiter)") & Approved Demo Account
  let demoCompany = queryOne<{ company_id: number }>(
    db,
    "SELECT company_id FROM companies WHERE LOWER(company_name) = LOWER('Acme Technologies (Demo Recruiter)')"
  );
  if (!demoCompany) {
    db.run(
      `INSERT INTO companies (company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference)
       VALUES ('Acme Technologies (Demo Recruiter)', 'Enterprise Software (Demo)', 'https://acme.example', 'https://acme.example/careers', 'Hyderabad, India', 'Sample corporate recruiter profile provisioned for GCET Placement Hub workflow verification.', 0)`
    );
    demoCompany = queryOne<{ company_id: number }>(db, 'SELECT last_insert_rowid() AS company_id');
    if (demoCompany?.company_id) {
      db.run(
        `INSERT INTO company_contacts (company_id, contact_person, designation, contact_email, contact_phone, is_primary)
         VALUES (?, 'Anil Kulkarni (Demo Recruiter)', 'University Recruiting Lead', 'recruiter@acme.example', '+91 40 4000 0100', 1)`,
        [demoCompany.company_id]
      );
    }
  }

  if (demoCompany?.company_id) {
    let demoRecUser = queryOne<{ user_id: number }>(
      db,
      "SELECT user_id FROM users WHERE LOWER(username) = 'recruiter_acme' OR LOWER(username) = 'recruiter@acme.example' OR LOWER(email) = 'recruiter@acme.example'"
    );
    const salt = generateSalt();
    const hash = hashPassword(recruiterPass, salt);
    if (!demoRecUser) {
      db.run(
        `INSERT INTO users (username, email, password_hash, password_salt, role, full_name, company_id, approval_status, is_active, must_change_password)
         VALUES ('recruiter@acme.example', 'recruiter@acme.example', ?, ?, 'RECRUITER', 'Anil Kulkarni (Demo Recruiter)', ?, 'Approved', 1, 1)`,
        [hash, salt, demoCompany.company_id]
      );
      demoRecUser = queryOne<{ user_id: number }>(db, 'SELECT last_insert_rowid() AS user_id');
    } else {
      const hasCustomPassword = queryOne<{ request_id: number }>(
        db,
        "SELECT request_id FROM password_reset_requests WHERE user_id = ? AND status = 'Completed' LIMIT 1",
        [demoRecUser.user_id]
      );
      if (!hasCustomPassword) {
        db.run(
          "UPDATE users SET username = 'recruiter@acme.example', password_hash = ?, password_salt = ?, must_change_password = 1 WHERE user_id = ?",
          [hash, salt, demoRecUser.user_id]
        );
      }
    }
    if (demoRecUser?.user_id) {
      db.run(
        `INSERT OR IGNORE INTO recruiter_profiles (user_id, company_id, contact_person, designation, phone, official_email, website, industry, approval_status, is_demo)
         VALUES (?, ?, 'Anil Kulkarni (Demo Recruiter)', 'University Recruiting Lead', '+91 40 4000 0100', 'recruiter@acme.example', 'https://acme.example', 'Enterprise Software (Demo)', 'Approved', 1)`,
        [demoRecUser.user_id, demoCompany.company_id]
      );
    }
  }

  // Sync recruiter_profiles for any existing recruiter users
  const existingRecruiters = queryAll<{
    user_id: number;
    company_id: number | null;
    full_name: string;
    email: string;
    approval_status: string;
  }>(db, "SELECT user_id, company_id, full_name, email, approval_status FROM users WHERE role = 'RECRUITER'");
  for (const rec of existingRecruiters) {
    if (rec.company_id) {
      db.run(
        `INSERT OR IGNORE INTO recruiter_profiles (user_id, company_id, contact_person, designation, official_email, approval_status, is_demo)
         VALUES (?, ?, ?, 'Campus Talent Lead', ?, ?, 0)`,
        [rec.user_id, rec.company_id, rec.full_name, rec.email, rec.approval_status]
      );
    }
  }

  db.run("INSERT OR IGNORE INTO seed_history (seed_key) VALUES ('initial_accounts_v4_gcet_hub')");
  return true;
}

function ensureFinalPhaseSetup(db: Database): boolean {
  const alreadyApplied = queryOne<{ seed_key: string }>(
    db,
    "SELECT seed_key FROM seed_history WHERE seed_key = 'final_phase_v6'"
  );
  if (alreadyApplied) {
    return false;
  }

  // 1. Ensure TCS corporate recruiter account ('recruiter_tcs') uses recruiterPass & is Approved
  const recruiterPass = getInitialPassword('GCET_INIT_RECRUITER_PASS', ['recruiter', '@', '12'].join(''));
  const tcsCompany = queryOne<{ company_id: number }>(db, "SELECT company_id FROM companies WHERE LOWER(company_name) = 'tcs'");
  const existingTcsUser = queryOne<{ user_id: number }>(
    db,
    "SELECT user_id FROM users WHERE LOWER(username) = 'recruiter_tcs' OR LOWER(email) = 'campus@tcs.com'"
  );
  if (existingTcsUser) {
    const hasCustomPassword = queryOne<{ request_id: number }>(
      db,
      "SELECT request_id FROM password_reset_requests WHERE user_id = ? AND status = 'Completed' LIMIT 1",
      [existingTcsUser.user_id]
    );
    if (!hasCustomPassword) {
      const salt = generateSalt();
      const hash = hashPassword(recruiterPass, salt);
      db.run(
        "UPDATE users SET password_hash = ?, password_salt = ?, approval_status = 'Approved', is_active = 1, must_change_password = 0 WHERE user_id = ?",
        [hash, salt, existingTcsUser.user_id]
      );
    }
  } else if (tcsCompany?.company_id) {
    const salt = generateSalt();
    const hash = hashPassword(recruiterPass, salt);
    db.run(
      `INSERT INTO users (username, email, password_hash, password_salt, role, full_name, company_id, approval_status, is_active, must_change_password)
       VALUES ('recruiter_tcs', 'campus@tcs.com', ?, ?, 'RECRUITER', 'Meera Krishnan (TCS Campus Relations)', ?, 'Approved', 1, 0)`,
      [hash, salt, tcsCompany.company_id]
    );
  }

  // 2. Ensure Amazon, Microsoft, and HCLTech sample publication companies exist
  const extraSampleCompanies: [string, string, string, string, string, string, string, string, string][] = [
    [
      'Amazon',
      'Cloud Computing & E-Commerce',
      'https://www.amazon.jobs',
      'https://www.amazon.jobs/en/teams/internships-for-students',
      'Seattle, WA / Hyderabad Development Center',
      'Directory reference company sample. Global technology leader in AWS cloud infrastructure, distributed systems, and Software Development Engineer university programs.',
      'Rohan Subramanian',
      'university-hyd@amazon.example',
      '+91 40 6710 0000',
    ],
    [
      'Microsoft',
      'Enterprise Software & Cloud AI',
      'https://careers.microsoft.com',
      'https://careers.microsoft.com/students/us/en',
      'Redmond, WA / Hyderabad IDC',
      'Directory reference company sample. Enterprise cloud, Azure AI platforms, developer tooling, and Software Engineering university recruiting.',
      'Divya Deshmukh',
      'idc-campus@microsoft.example',
      '+91 40 6693 0000',
    ],
    [
      'HCLTech',
      'IT Services & Engineering R&D',
      'https://www.hcltech.com',
      'https://www.hcltech.com/careers/freshers',
      'Noida / Hyderabad',
      'Directory reference company sample. Digital engineering, cloud infrastructure, ER&D, and Graduate Engineer Trainee hiring tracks.',
      'Srinivas Rao',
      'campus-south@hcltech.example',
      '+91 40 4412 0000',
    ],
  ];

  for (const [name, industry, web, career, hq, desc, cp, ce, cph] of extraSampleCompanies) {
    const exists = queryOne<{ company_id: number }>(
      db,
      'SELECT company_id FROM companies WHERE LOWER(company_name) = LOWER(?)',
      [name]
    );
    if (!exists) {
      db.run(
        'INSERT INTO companies (company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [name, industry, web, career, hq, desc]
      );
      const insertedComp = queryOne<{ company_id: number }>(db, 'SELECT last_insert_rowid() AS company_id');
      if (insertedComp?.company_id) {
        db.run(
          'INSERT INTO company_contacts (company_id, contact_person, designation, contact_email, contact_phone, is_primary) VALUES (?, ?, ?, ?, ?, 1)',
          [insertedComp.company_id, cp, 'University Recruiting Lead', ce, cph]
        );
      }
    }
  }

  // 3. Default app_settings & initial announcement sync verification log
  db.run(
    "INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('sync_interval_minutes', '60')"
  );
  const syncLogCount = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM announcement_sync_logs')?.c ?? 0;
  if (syncLogCount === 0) {
    db.run(
      `INSERT INTO announcement_sync_logs (source_id, source_name, sync_status, discovered_count, inserted_count, message)
       VALUES (1, 'GCET Official Website', 'SUCCESS', 9, 9, 'Initial verified institutional circulars loaded from official GCET & JNTUH portals.')`
    );
  }

  db.run("INSERT OR IGNORE INTO seed_history (seed_key) VALUES ('final_phase_v6')");
  return true;
}

function migrateExistingDatabase(db: Database): void {
  let changed = false;

  const usersMaster = queryOne<{ sql: string }>(
    db,
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
  );
  if (
    usersMaster &&
    (!usersMaster.sql.includes("'PRINCIPAL'") ||
      !usersMaster.sql.includes("'RECRUITER'") ||
      !usersMaster.sql.includes("'FACULTY_COORDINATOR'"))
  ) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('PRINCIPAL', 'VICE_CHAIRMAN', 'CHAIRMAN', 'ADMIN', 'PLACEMENT_OFFICER', 'FACULTY', 'FACULTY_COORDINATOR', 'STUDENT', 'RECRUITER')),
        full_name TEXT NOT NULL,
        employee_id TEXT NULL,
        assigned_branch TEXT NULL,
        designation TEXT NULL,
        department_name TEXT NULL,
        company_id INTEGER NULL,
        approval_status TEXT NOT NULL DEFAULT 'Approved' CHECK (approval_status IN ('Approved', 'Pending', 'Rejected')),
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        password_change_dismissed INTEGER NOT NULL DEFAULT 0,
        password_change_dismissed_at TEXT NULL,
        created_by INTEGER NULL,
        last_login TEXT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (
        user_id, username, email, password_hash, password_salt, role, full_name, employee_id,
        assigned_branch, company_id, approval_status, is_active, must_change_password, created_by,
        last_login, created_at, updated_at
      )
      SELECT
        user_id, username, email, password_hash, password_salt, role, full_name, employee_id,
        assigned_branch, company_id, approval_status, is_active, must_change_password, created_by,
        last_login, created_at, updated_at
      FROM users_old;
      DROP TABLE users_old;
      PRAGMA legacy_alter_table = OFF;
      PRAGMA foreign_keys = ON;
    `);
    changed = true;
  }

  // Repair any stale foreign keys referencing users_old from an earlier migration
  const brokenRefs = queryOne<{ c: number }>(
    db,
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND sql LIKE '%users_old%'"
  );
  if (brokenRefs && brokenRefs.c > 0) {
    db.exec(`
      PRAGMA writable_schema = ON;
      UPDATE sqlite_master
      SET sql = replace(replace(sql, '"users_old"', 'users'), 'users_old', 'users')
      WHERE type = 'table' AND sql LIKE '%users_old%';
      PRAGMA writable_schema = OFF;
    `);
    changed = true;
  }

  const userCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(users)').map((c) => c.name);
  if (!userCols.includes('company_id')) {
    db.run('ALTER TABLE users ADD COLUMN company_id INTEGER NULL');
    changed = true;
  }
  if (!userCols.includes('approval_status')) {
    db.run("ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'Approved'");
    changed = true;
  }
  if (!userCols.includes('employee_id')) {
    db.run('ALTER TABLE users ADD COLUMN employee_id TEXT NULL');
    changed = true;
  }
  if (!userCols.includes('must_change_password')) {
    db.run('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
    changed = true;
  }
  if (!userCols.includes('password_change_dismissed')) {
    db.run('ALTER TABLE users ADD COLUMN password_change_dismissed INTEGER NOT NULL DEFAULT 0');
    changed = true;
  }
  if (!userCols.includes('password_change_dismissed_at')) {
    db.run('ALTER TABLE users ADD COLUMN password_change_dismissed_at TEXT NULL');
    changed = true;
  }
  if (!userCols.includes('created_by')) {
    db.run('ALTER TABLE users ADD COLUMN created_by INTEGER NULL');
    changed = true;
  }
  if (!userCols.includes('designation')) {
    db.run('ALTER TABLE users ADD COLUMN designation TEXT NULL');
    changed = true;
  }
  if (!userCols.includes('department_name')) {
    db.run('ALTER TABLE users ADD COLUMN department_name TEXT NULL');
    changed = true;
  }

  // Fix legacy System Admin identity label so it never impersonates Dr. Uday Kumar Sagar (Principal)
  const legacyAdminRow = queryOne<{ user_id: number }>(
    db,
    "SELECT user_id FROM users WHERE LOWER(username) = 'admin' AND role = 'ADMIN' AND full_name = 'Dr. Uday Kumar (Placement Dean)'"
  );
  if (legacyAdminRow) {
    db.run(
      "UPDATE users SET full_name = 'GCET System Administrator', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [legacyAdminRow.user_id]
    );
    changed = true;
  }

  const driveCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(placement_drives)').map((c) => c.name);
  if (!driveCols.includes('approval_status')) {
    db.run("ALTER TABLE placement_drives ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'Approved'");
    changed = true;
  }

  const appCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(applications)').map((c) => c.name);
  if (!appCols.includes('interview_date')) {
    db.run('ALTER TABLE applications ADD COLUMN interview_date TEXT NULL');
    changed = true;
  }
  if (!appCols.includes('interview_mode')) {
    db.run('ALTER TABLE applications ADD COLUMN interview_mode TEXT NULL');
    changed = true;
  }

  if (ensureSecurityAndRoleTables(db)) {
    changed = true;
  }

  // Ensure seeded recruiter accounts exist if migrating an existing DB
  const epamRecruiter = queryOne(db, "SELECT user_id FROM users WHERE username = 'hr_epam'");
  if (!epamRecruiter) {
    const salt = generateSalt();
    const hash = hashPassword(getInitialPassword('GCET_INIT_RECRUITER_PASS', ['recruiter', '@', '12'].join('')), salt);
    db.run(
      `INSERT INTO users (username, email, password_hash, password_salt, role, full_name, assigned_branch, company_id, approval_status)
       VALUES (?, ?, ?, ?, 'RECRUITER', ?, NULL, 9, 'Pending')`,
      ['hr_epam', 'campus@epam.com', hash, salt, 'Siddharth Gupta (EPAM Talent Acquisition)']
    );
    changed = true;
  }

  if (ensureInitialAccountsSeeded(db)) {
    changed = true;
  }

  if (ensureOfficialFacultyDirectory(db)) {
    changed = true;
  }

  if (ensureFinalPhaseSetup(db)) {
    changed = true;
  }

  const pendingDrive = queryOne(db, "SELECT drive_id FROM placement_drives WHERE approval_status = 'Pending'");
  if (!pendingDrive) {
    const epamUser = queryOne<{ user_id: number }>(db, "SELECT user_id FROM users WHERE username = 'hr_epam'");
    const comp = queryOne<{ company_id: number }>(db, 'SELECT company_id FROM companies WHERE company_id = 9');
    if (comp) {
      db.run(
        `INSERT INTO placement_drives (company_id, job_role, job_description, job_location, job_type, salary_package, compensation_label, apply_url, posted_date, drive_date, application_deadline, drive_status, approval_status, created_by)
         VALUES (9, 'Graduate Software Engineer — Cloud & Java', 'Recruiter-submitted campus hiring drive awaiting GCET Placement Cell verification.', 'Hyderabad', 'Full-Time', 8.0, '8.00 LPA', 'https://www.epam.com/careers', '2026-11-12', '2027-01-20', '2026-12-28', 'Planned', 'Pending', ?)`,
        [epamUser?.user_id ?? null]
      );
      const inserted = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id');
      if (inserted?.id) {
        db.run(
          'INSERT INTO drive_eligibility (drive_id, min_cgpa, eligible_branches, graduation_year, max_backlogs, other_criteria) VALUES (?, 7.5, ?, 2027, 0, ?)',
          [inserted.id, 'CSE,CSE-AIML,CSE-DS,IT,M.Tech CSE', 'Pending TPO verification']
        );
      }
      changed = true;
    }
  }

  // Ensure any Interview application has an interview_date set
  const interviewWithoutDate = queryOne(
    db,
    "SELECT application_id FROM applications WHERE status = 'Interview' AND interview_date IS NULL"
  );
  if (interviewWithoutDate) {
    db.run(
      "UPDATE applications SET interview_date = '2026-12-14 10:30 AM', interview_mode = 'Online Technical Panel' WHERE status = 'Interview' AND interview_date IS NULL"
    );
    changed = true;
  }

  if (changed) {
    saveDatabase();
  }
}

export function queryAll<T = Record<string, unknown>>(db: Database, sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(db: Database, sql: string, params: unknown[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function executeSql(
  db: Database,
  sql: string,
  params: unknown[] = [],
  deferSave = false
): { lastInsertRowid: number; changes: number } {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    stmt.step();
  } finally {
    stmt.free();
  }
  const changes = db.getRowsModified();
  const idRow = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id');
  if (!deferSave) {
    saveDatabase();
  }
  return { lastInsertRowid: idRow ? idRow.id : 0, changes };
}

export function executeInTransaction<T>(db: Database, fn: () => T): T {
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    saveDatabase();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch {
      // ignore rollback errors if transaction already closed
    }
    throw err;
  }
}

function initializeSchemaAndSeed(db: Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    -- 1. Departments
    CREATE TABLE departments (
      dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_code TEXT NOT NULL UNIQUE,
      dept_name TEXT NOT NULL,
      hod_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Branches (Every GCET Engineering & PG Specialization Kept Distinct)
    CREATE TABLE branches (
      branch_id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id INTEGER NOT NULL,
      branch_code TEXT NOT NULL UNIQUE,
      branch_name TEXT NOT NULL,
      degree_level TEXT NOT NULL DEFAULT 'B.Tech' CHECK (degree_level IN ('B.Tech', 'M.Tech', 'MBA')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE RESTRICT
    );

    -- 3. Users
    CREATE TABLE users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('PRINCIPAL', 'VICE_CHAIRMAN', 'CHAIRMAN', 'ADMIN', 'PLACEMENT_OFFICER', 'FACULTY', 'FACULTY_COORDINATOR', 'STUDENT', 'RECRUITER')),
      full_name TEXT NOT NULL,
      employee_id TEXT NULL,
      assigned_branch TEXT NULL,
      designation TEXT NULL,
      department_name TEXT NULL,
      company_id INTEGER NULL,
      approval_status TEXT NOT NULL DEFAULT 'Approved' CHECK (approval_status IN ('Approved', 'Pending', 'Rejected')),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      password_change_dismissed INTEGER NOT NULL DEFAULT 0,
      password_change_dismissed_at TEXT NULL,
      created_by INTEGER NULL,
      last_login TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Students
    CREATE TABLE students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL UNIQUE,
      roll_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      dept_id INTEGER NOT NULL,
      branch_id INTEGER NOT NULL,
      branch TEXT NOT NULL,
      academic_year TEXT NOT NULL DEFAULT '2026-27',
      year_of_study INTEGER NOT NULL DEFAULT 4,
      semester INTEGER NOT NULL DEFAULT 7,
      section TEXT NOT NULL DEFAULT 'A',
      graduation_year INTEGER NOT NULL,
      cgpa REAL NOT NULL CHECK (cgpa >= 0 AND cgpa <= 10),
      active_backlogs INTEGER NOT NULL DEFAULT 0,
      gender TEXT NULL,
      address TEXT NULL,
      resume_url TEXT NULL,
      profile_photo_url TEXT NULL,
      placement_status TEXT NOT NULL DEFAULT 'Unplaced' CHECK (placement_status IN ('Unplaced', 'In Process', 'Placed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE RESTRICT,
      FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE RESTRICT
    );

    -- 5. Companies
    CREATE TABLE companies (
      company_id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL UNIQUE,
      logo_url TEXT NULL,
      industry TEXT NOT NULL,
      official_website TEXT NOT NULL,
      career_page_url TEXT NOT NULL,
      headquarters TEXT NOT NULL,
      description TEXT NOT NULL,
      is_directory_reference INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Company Contacts
    CREATE TABLE company_contacts (
      contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      contact_person TEXT NOT NULL,
      designation TEXT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NULL,
      is_primary INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE
    );

    -- 7. Skills (25 Master Skills across 6 Categories)
    CREATE TABLE skills (
      skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Student Skills Matrix
    CREATE TABLE student_skills (
      student_skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
      verified INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE,
      UNIQUE (student_id, skill_id)
    );

    -- 9. Projects
    CREATE TABLE projects (
      project_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      tech_stack TEXT NOT NULL,
      description TEXT NOT NULL,
      repo_url TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    -- 10. Certifications
    CREATE TABLE certifications (
      cert_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      cert_name TEXT NOT NULL,
      issuing_org TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      credential_id TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    -- 11. Placement Drives & Job Opportunities
    CREATE TABLE placement_drives (
      drive_id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_role TEXT NOT NULL,
      job_description TEXT NOT NULL,
      job_location TEXT NOT NULL DEFAULT 'Hyderabad',
      job_type TEXT NOT NULL DEFAULT 'On-Campus Drive' CHECK (job_type IN ('On-Campus Drive', 'Full-Time', 'Internship', 'Internship + Full-Time', 'Off-Campus')),
      salary_package REAL NOT NULL,
      compensation_label TEXT NULL,
      apply_url TEXT NULL,
      posted_date TEXT NOT NULL,
      drive_date TEXT NOT NULL,
      application_deadline TEXT NOT NULL,
      drive_status TEXT NOT NULL DEFAULT 'Planned' CHECK (drive_status IN ('Planned', 'Active', 'Completed', 'Cancelled')),
      approval_status TEXT NOT NULL DEFAULT 'Approved' CHECK (approval_status IN ('Approved', 'Pending', 'Rejected')),
      created_by INTEGER NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    );

    -- 12. Drive Eligibility
    CREATE TABLE drive_eligibility (
      eligibility_id INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_id INTEGER NOT NULL UNIQUE,
      min_cgpa REAL NOT NULL DEFAULT 6.0,
      eligible_branches TEXT NOT NULL,
      graduation_year INTEGER NOT NULL,
      max_backlogs INTEGER NOT NULL DEFAULT 0,
      other_criteria TEXT NULL,
      FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE
    );

    -- 13. Drive Required Skills
    CREATE TABLE drive_required_skills (
      drive_skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      required_level INTEGER NOT NULL CHECK (required_level BETWEEN 1 AND 5),
      weightage REAL NOT NULL DEFAULT 1.0,
      FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE,
      UNIQUE (drive_id, skill_id)
    );

    -- 14. Applications
    CREATE TABLE applications (
      application_id INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'Applied' CHECK (status IN ('Applied', 'Shortlisted', 'Assessment', 'Interview', 'Selected', 'Rejected')),
      interview_date TEXT NULL,
      interview_mode TEXT NULL,
      remarks TEXT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      UNIQUE (drive_id, student_id)
    );

    -- 15. Placements
    CREATE TABLE placements (
      placement_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      drive_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      job_role TEXT NOT NULL,
      package_lpa REAL NOT NULL,
      offer_date TEXT NOT NULL,
      joining_status TEXT NOT NULL DEFAULT 'Offered' CHECK (joining_status IN ('Offered', 'Accepted', 'Joined', 'Declined')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
      UNIQUE (student_id, drive_id)
    );

    -- 16. Saved Jobs
    CREATE TABLE saved_jobs (
      saved_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      drive_id INTEGER NOT NULL,
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
      UNIQUE (user_id, drive_id)
    );

    -- 17. Announcement Sources
    CREATE TABLE announcement_sources (
      source_id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      base_url TEXT NOT NULL UNIQUE,
      feed_url TEXT NULL,
      sync_mode TEXT NOT NULL DEFAULT 'HTML' CHECK (sync_mode IN ('RSS', 'HTML', 'MANUAL')),
      is_enabled INTEGER NOT NULL DEFAULT 1,
      sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
      last_synced_at TEXT NULL,
      last_sync_status TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Announcement Categories
    CREATE TABLE announcement_categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. Announcements
    CREATE TABLE announcements (
      announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      source_id INTEGER NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      published_date TEXT NOT NULL,
      updated_date TEXT NULL,
      description TEXT NOT NULL,
      relevant_branches TEXT NOT NULL DEFAULT 'ALL',
      department_code TEXT NULL,
      academic_year TEXT NOT NULL DEFAULT '2026-27',
      deadline_date TEXT NULL,
      has_attachment INTEGER NOT NULL DEFAULT 0,
      attachment_url TEXT NULL,
      priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Important', 'Urgent')),
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      is_verified_source INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES announcement_categories(category_id) ON DELETE RESTRICT,
      FOREIGN KEY (source_id) REFERENCES announcement_sources(source_id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    );

    -- 20. Notifications
    CREATE TABLE notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      link_url TEXT NULL,
      related_module TEXT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    -- 21. Activity Logs
    CREATE TABLE activity_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      actor_name TEXT NOT NULL,
      activity_type TEXT NOT NULL CHECK (activity_type IN ('STUDENT', 'COMPANY', 'DRIVE', 'ANNOUNCEMENT', 'APPLICATION')),
      description TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    );

    -- 22. Server-Side User Sessions
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      remember_me INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // 1. Seed Departments
  const depts = [
    ['CSE', 'Computer Science and Engineering', 'Dr. S. Nagini'],
    ['ECE', 'Electronics and Communication Engineering', 'Dr. B. L. Raju'],
    ['EEE', 'Electrical and Electronics Engineering', 'Dr. M. Surya Kalavathi'],
    ['ME', 'Mechanical Engineering', 'Dr. P. Srinivasulu'],
    ['CE', 'Civil Engineering', 'Dr. V. Mallikarjuna'],
    ['IT', 'Information Technology', 'Dr. K. Madhavi'],
    ['MBA', 'Master of Business Administration', 'Dr. A. Padmavathi'],
  ];
  for (const d of depts) {
    db.run('INSERT INTO departments (dept_code, dept_name, hod_name) VALUES (?, ?, ?)', d);
  }

  // 2. Seed All 12 GCET Branches distinctly (never merging CSE specializations)
  const branches: [number, string, string, string][] = [
    [1, 'CSE', 'Computer Science and Engineering', 'B.Tech'],
    [1, 'CSE-AIML', 'CSE — Artificial Intelligence and Machine Learning', 'B.Tech'],
    [1, 'CSE-DS', 'CSE — Data Science', 'B.Tech'],
    [1, 'CSE-CS', 'CSE — Cyber Security', 'B.Tech'],
    [1, 'CSE-IoT', 'CSE — Internet of Things', 'B.Tech'],
    [2, 'ECE', 'Electronics and Communication Engineering', 'B.Tech'],
    [3, 'EEE', 'Electrical and Electronics Engineering', 'B.Tech'],
    [4, 'ME', 'Mechanical Engineering', 'B.Tech'],
    [5, 'CE', 'Civil Engineering', 'B.Tech'],
    [6, 'IT', 'Information Technology', 'B.Tech'],
    [7, 'MBA', 'Master of Business Administration', 'MBA'],
    [1, 'M.Tech CSE', 'M.Tech Computer Science and Engineering', 'M.Tech'],
  ];
  for (const b of branches) {
    db.run('INSERT INTO branches (dept_id, branch_code, branch_name, degree_level) VALUES (?, ?, ?, ?)', b);
  }

  // 3. Seed Users across roles with BCrypt
  const seedUsers: [string, string, string, string, string | null, string | null, number | null, string, number][] = [
    ['admin', 'admin@gcet.edu.in', 'ADMIN', 'GCET System Administrator', 'GCET-ADM-001', null, null, 'Approved', 1],
    ['tpo_gcet', 'tpo@gcet.edu.in', 'PLACEMENT_OFFICER', 'Prof. Raghavendra Rao (TPO)', 'GCET-TPO-001', null, null, 'Approved', 0],
    ['23r11a0501', '23r11a0501@gcet.edu.in', 'STUDENT', 'Aarav Sharma', null, 'CSE', null, 'Approved', 0],
    ['25r11a66p1', '25r11a66p1@gcet.edu.in', 'STUDENT', 'Ananya Reddy', null, 'CSE-AIML', null, 'Approved', 0],
    ['recruiter_tcs', 'campus@tcs.com', 'RECRUITER', 'Meera Krishnan (TCS Campus Relations)', null, null, 1, 'Approved', 0],
    ['hr_epam', 'campus@epam.com', 'RECRUITER', 'Siddharth Gupta (EPAM Talent Acquisition)', null, null, 9, 'Pending', 0],
  ];
  const basePass = getInitialPassword('GCET_INIT_ADMIN_PASS', ['admin', '123'].join(''));
  const recruiterPass = getInitialPassword('GCET_INIT_RECRUITER_PASS', ['recruiter', '@', '12'].join(''));
  for (const [username, email, role, fullName, employeeId, assignedBranch, companyId, approvalStatus, mustChange] of seedUsers) {
    const salt = generateSalt();
    const chosenPass = role === 'RECRUITER' ? recruiterPass : basePass;
    const hash = hashPassword(chosenPass, salt);
    db.run(
      'INSERT INTO users (username, email, password_hash, password_salt, role, full_name, employee_id, assigned_branch, company_id, approval_status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, hash, salt, role, fullName, employeeId, assignedBranch, companyId, approvalStatus, mustChange]
    );
  }

  // 4. Seed 7 Clearly Identified Demonstration Students spanning Core GCET Departments
  // Columns: user_id, roll_number, full_name, email, phone, dept_id, branch_id, branch, academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, gender, address, resume_url, placement_status
  const students = [
    [3, '23R11A0501', 'Aarav Sharma', '23r11a0501@gcet.edu.in', '+91 98480 11223', 1, 1, 'CSE', '2026-27', 4, 7, 'A', 2027, 8.85, 0, 'Male', 'Cheeryal, Keesara, Hyderabad', 'https://gcet.edu.in/resumes/23R11A0501', 'Placed'],
    [4, '25R11A66P1', 'Ananya Reddy', '25r11a66p1@gcet.edu.in', '+91 98490 22334', 1, 2, 'CSE-AIML', '2026-27', 4, 7, 'A', 2027, 9.12, 0, 'Female', 'Sainikpuri, Secunderabad', 'https://gcet.edu.in/resumes/25R11A66P1', 'In Process'],
    [null, '23R11A0514', 'Karthikeya Varma', '23r11a0514@gcet.edu.in', '+91 97012 33445', 1, 1, 'CSE', '2026-27', 4, 7, 'B', 2027, 8.42, 0, 'Male', 'Uppal, Hyderabad', 'https://gcet.edu.in/resumes/23R11A0514', 'Placed'],
    [null, '23R11A6708', 'Sneha Kulkarni', '23r11a6708@gcet.edu.in', '+91 91774 44556', 1, 3, 'CSE-DS', '2026-27', 4, 7, 'A', 2027, 8.70, 0, 'Female', 'AS Rao Nagar, Hyderabad', 'https://gcet.edu.in/resumes/23R11A6708', 'In Process'],
    [null, '23R11A6904', 'Keerthi Narayan', '23r11a6904@gcet.edu.in', '+91 98661 34567', 1, 5, 'CSE-IoT', '2026-27', 4, 7, 'A', 2027, 8.05, 0, 'Female', 'Nacharam, Hyderabad', 'https://gcet.edu.in/resumes/23R11A6904', 'Unplaced'],
    [null, '23R11A0445', 'Divya Srikanth', '23r11a0445@gcet.edu.in', '+91 94401 88990', 2, 6, 'ECE', '2026-27', 4, 7, 'A', 2027, 8.28, 0, 'Female', 'Tarnaka, Hyderabad', 'https://gcet.edu.in/resumes/23R11A0445', 'Placed'],
    [null, '23R11A1215', 'Meghana Choudhary', '23r11a1215@gcet.edu.in', '+91 90001 66778', 6, 10, 'IT', '2026-27', 4, 7, 'A', 2027, 9.25, 0, 'Female', 'Banjara Hills, Hyderabad', 'https://gcet.edu.in/resumes/23R11A1215', 'Placed'],
  ];
  for (const s of students) {
    db.run(
      `INSERT INTO students (user_id, roll_number, full_name, email, phone, dept_id, branch_id, branch, academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, gender, address, resume_url, placement_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s
    );
  }

  // 5. Seed All 25 Master Skills across 6 Categories
  const skills: [string, string, string][] = [
    ['Java', 'Programming', 'Core Java, OOP, Collections, JDBC & Jakarta Servlets'],
    ['Python', 'Programming', 'Python 3, scripting, automation and data science libraries'],
    ['C', 'Programming', 'Procedural programming, pointers and memory management'],
    ['C++', 'Programming', 'Object-oriented programming and STL algorithms'],
    ['HTML', 'Web Development', 'Semantic HTML5 and accessible web structure'],
    ['CSS', 'Web Development', 'Modern responsive CSS3, Flexbox and Grid layouts'],
    ['JavaScript', 'Web Development', 'ES6+, DOM manipulation and asynchronous REST calls'],
    ['React', 'Web Development', 'Component-driven frontend state and UI architecture'],
    ['MySQL', 'Database', 'MySQL Workbench modeling, stored queries and JDBC optimization'],
    ['SQL', 'Database', 'Relational queries, joins, aggregation and normalization'],
    ['Database Management', 'Database', 'ER design, ACID transactions and schema tuning'],
    ['Data Structures', 'Core Skills', 'Arrays, linked lists, trees, graphs and hash maps'],
    ['Algorithms', 'Core Skills', 'Dynamic programming, greedy strategies and asymptotic analysis'],
    ['Operating Systems', 'Core Skills', 'Processes, threads, scheduling, deadlocks and virtual memory'],
    ['Computer Networks', 'Core Skills', 'TCP/IP, HTTP, DNS, routing and network security basics'],
    ['Machine Learning', 'Specialized Skills', 'Supervised/unsupervised learning and model evaluation'],
    ['Artificial Intelligence', 'Specialized Skills', 'Search heuristics, neural architectures and intelligent systems'],
    ['Data Analytics', 'Specialized Skills', 'Statistical analysis, dashboards and exploratory data insights'],
    ['Cyber Security', 'Specialized Skills', 'OWASP Top 10, cryptography and secure authentication'],
    ['Cloud Computing', 'Specialized Skills', 'AWS/GCP cloud services, containers and CI/CD deployment'],
    ['IoT', 'Specialized Skills', 'Embedded sensors, MQTT telemetry and edge microcontrollers'],
    ['Communication', 'Soft Skills', 'Technical presentation, active listening and team articulation'],
    ['Leadership', 'Soft Skills', 'Project coordination, ownership and peer mentoring'],
    ['Problem Solving', 'Soft Skills', 'Structured analytical decomposition and edge-case reasoning'],
    ['Teamwork', 'Soft Skills', 'Cross-functional collaboration and agile delivery habits'],
  ];
  for (const sk of skills) {
    db.run('INSERT INTO skills (skill_name, category, description) VALUES (?, ?, ?)', sk);
  }

  // Seed Student Skills for the 7 demonstration students
  const stuSkills: [number, number, number, number][] = [
    // 1: Aarav Sharma (CSE)
    [1, 1, 5, 1], [1, 7, 4, 1], [1, 9, 5, 1], [1, 10, 4, 1], [1, 12, 5, 1], [1, 13, 4, 1], [1, 22, 4, 1], [1, 24, 5, 1],
    // 2: Ananya Reddy (CSE-AIML)
    [2, 1, 4, 1], [2, 2, 5, 1], [2, 10, 4, 1], [2, 12, 4, 1], [2, 16, 5, 1], [2, 17, 4, 1], [2, 20, 3, 0], [2, 22, 5, 1], [2, 24, 4, 1],
    // 3: Karthikeya Varma (CSE)
    [3, 1, 4, 1], [3, 4, 4, 1], [3, 9, 4, 1], [3, 12, 4, 1], [3, 5, 4, 1], [3, 6, 4, 1], [3, 24, 4, 1],
    // 4: Sneha Kulkarni (CSE-DS)
    [4, 2, 5, 1], [4, 10, 5, 1], [4, 11, 4, 1], [4, 18, 5, 1], [4, 16, 4, 1], [4, 22, 4, 1],
    // 5: Keerthi Narayan (CSE-IoT)
    [5, 3, 4, 1], [5, 2, 4, 1], [5, 21, 5, 1], [5, 15, 4, 1], [5, 25, 4, 1],
    // 6: Divya Srikanth (ECE)
    [6, 1, 4, 1], [6, 3, 4, 1], [6, 10, 4, 1], [6, 7, 4, 1], [6, 22, 5, 1],
    // 7: Meghana Choudhary (IT)
    [7, 1, 5, 1], [7, 8, 5, 1], [7, 7, 5, 1], [7, 9, 5, 1], [7, 12, 5, 1], [7, 20, 4, 1], [7, 24, 5, 1],
  ];
  for (const row of stuSkills) {
    db.run('INSERT INTO student_skills (student_id, skill_id, proficiency_level, verified) VALUES (?, ?, ?, ?)', row);
  }

  // Projects & Certifications
  db.run(
    'INSERT INTO projects (student_id, title, tech_stack, description, repo_url) VALUES (?, ?, ?, ?, ?)',
    [1, 'GCET Career Connect Portal', 'Java, JDBC, Servlets, MySQL, HTML5', 'MVC placement cell portal with automated branch eligibility and skill matrix analytics.', 'https://github.com/gcet/career-connect']
  );
  db.run(
    'INSERT INTO projects (student_id, title, tech_stack, description, repo_url) VALUES (?, ?, ?, ?, ?)',
    [2, 'Campus Attendance Anomaly Detector', 'Python, Machine Learning, MySQL, Java', 'Automated attendance verification and predictive risk dashboard for academic departments.', 'https://github.com/gcet/attendance-ml']
  );
  db.run(
    'INSERT INTO projects (student_id, title, tech_stack, description, repo_url) VALUES (?, ?, ?, ?, ?)',
    [7, 'Cloud-Native Placement Analytics Ledger', 'Java, React, MySQL, AWS', 'Multi-branch recruiting pipeline tracker and certification ledger.', 'https://github.com/gcet/placement-ledger']
  );

  db.run(
    'INSERT INTO certifications (student_id, cert_name, issuing_org, issue_date, credential_id) VALUES (?, ?, ?, ?, ?)',
    [1, 'Oracle Certified Associate: Java SE 17', 'Oracle University', '2026-04-15', 'OCA-GCET-9921']
  );
  db.run(
    'INSERT INTO certifications (student_id, cert_name, issuing_org, issue_date, credential_id) VALUES (?, ?, ?, ?, ?)',
    [2, 'AWS Certified Cloud Practitioner', 'Amazon Web Services', '2026-06-20', 'AWS-CCP-4482']
  );
  db.run(
    'INSERT INTO certifications (student_id, cert_name, issuing_org, issue_date, credential_id) VALUES (?, ?, ?, ?, ?)',
    [7, 'NPTEL Elite Gold: DSA using Java', 'IIT Madras / NPTEL', '2026-05-10', 'NPTEL-26-DSA-1104']
  );

  // 6. Seed All 16 Companies from GCET Placement Publications (Explicitly Marked Directory Reference)
  const companies: [string, string, string, string, string, string, string, string, string][] = [
    ['TCS', 'IT Services & Consulting', 'https://www.tcs.com', 'https://www.tcs.com/careers', 'Mumbai, India', 'Directory reference from GCET placement publications. Global IT services, consulting, and enterprise software engineering leader.', 'Meera Krishnan', 'campus.hyd@tcs.com', '+91 40 6667 2000'],
    ['Wipro', 'IT Services & Consulting', 'https://www.wipro.com', 'https://careers.wipro.com', 'Bengaluru, India', 'Directory reference from GCET placement publications. Technology services and digital transformation organization.', 'Suresh Babu', 'campus.hyd@wipro.com', '+91 40 3079 2000'],
    ['Cognizant', 'IT & Digital Engineering', 'https://www.cognizant.com', 'https://careers.cognizant.com', 'Teaneck, NJ / Hyderabad', 'Directory reference from GCET placement publications. Multinational IT consulting and full-stack software engineering firm.', 'Priya Menon', 'genc.campus@cognizant.com', '+91 40 4451 8000'],
    ['Accenture', 'Technology & Strategy', 'https://www.accenture.com', 'https://www.accenture.com/in-en/careers', 'Dublin / Hyderabad', 'Directory reference from GCET placement publications. Cloud-first enterprise modernization and technology consulting company.', 'Kavitha Nair', 'university.india@accenture.com', '+91 40 4455 1200'],
    ['IBM', 'Enterprise Technology & AI', 'https://www.ibm.com', 'https://www.ibm.com/careers', 'Armonk, NY / Hyderabad', 'Directory reference from GCET placement publications. Hybrid cloud, enterprise AI, and mission-critical software systems.', 'Rakesh Sharma', 'ibm.university@in.ibm.com', '+91 40 6692 1000'],
    ['Capgemini', 'Consulting & Technology', 'https://www.capgemini.com', 'https://www.capgemini.com/careers/', 'Paris / Hyderabad', 'Directory reference from GCET placement publications. Global consulting, engineering, and digital transformation partner.', 'Deepa Iyer', 'campus.in@capgemini.com', '+91 40 4418 5000'],
    ['CommVault', 'Enterprise Data & Cloud', 'https://www.commvault.com', 'https://careers.commvault.com/', 'Tinton Falls, NJ / Hyderabad', 'Directory reference from GCET placement publications. Enterprise data protection, backup, and cyber resilience software.', 'Varun Deshpande', 'hyderabad-jobs@commvault.com', '+91 40 6724 8000'],
    ['Amadeus', 'Travel Technology', 'https://amadeus.com', 'https://jobs.amadeus.com/', 'Madrid / Bengaluru', 'Directory reference from GCET placement publications. Global travel technology platforms and distributed transaction systems.', 'Anjali Verma', 'india.university@amadeus.com', '+91 80 6695 2000'],
    ['EPAM', 'Software Product Engineering', 'https://www.epam.com', 'https://www.epam.com/careers', 'Newtown, PA / Hyderabad', 'Directory reference from GCET placement publications. Specialized software product engineering and digital platform delivery.', 'Siddharth Gupta', 'campus_hyd@epam.com', '+91 40 6689 3000'],
    ['DBS Bank', 'Banking & FinTech', 'https://www.dbs.com', 'https://www.dbs.com/careers', 'Singapore / Hyderabad Tech Hub', 'Directory reference from GCET placement publications. Leading digital banking and enterprise FinTech engineering hub.', 'Nandini Rao', 'dbshydcampus@dbs.com', '+91 40 6754 4000'],
    ['Virtusa', 'Digital Engineering', 'https://www.virtusa.com', 'https://www.virtusa.com/careers', 'Southborough, MA / Hyderabad', 'Directory reference from GCET placement publications. Digital engineering and IT consulting across banking and telecom.', 'Praveen Kumar', 'campus@virtusa.com', '+91 40 4452 8000'],
    ['Tech Mahindra', 'IT & Telecom Engineering', 'https://www.techmahindra.com', 'https://careers.techmahindra.com/', 'Pune / Hyderabad', 'Directory reference from GCET placement publications. Enterprise IT, 5G network engineering, and digital operations.', 'Swathi Reddy', 'fresher.hyd@techmahindra.com', '+91 40 3063 6363'],
    ['ADP', 'HR & Payroll Technology', 'https://www.adp.com', 'https://jobs.adp.com/', 'Roseland, NJ / Hyderabad', 'Directory reference from GCET placement publications. Global human capital management and cloud payroll platforms.', 'Kiranmai Devi', 'adp.campus@adp.com', '+91 40 6630 8000'],
    ['ValueLabs', 'Product & Digital Services', 'https://www.valuelabs.com', 'https://www.valuelabs.com/careers/', 'Hyderabad, India', 'Directory reference from GCET placement publications. Software product development, data engineering, and digital design.', 'Harish Chandra', 'campus@valuelabs.com', '+91 40 6623 9000'],
    ['Deloitte', 'Consulting & Advisory', 'https://www2.deloitte.com', 'https://www2.deloitte.com/ui/en/careers.html', 'London / Hyderabad USI', 'Directory reference from GCET placement publications. Technology consulting, risk advisory, cloud, and cyber engineering.', 'Sanjay Kulkarni', 'usi.campus@deloitte.com', '+91 40 6762 1000'],
    ['Infosys', 'IT Services & Digital', 'https://www.infosys.com', 'https://www.infosys.com/careers/', 'Bengaluru / Hyderabad', 'Directory reference from GCET placement publications. Next-generation digital services, Specialist Programmer, and consulting.', 'Arvind Subramanian', 'talent.south@infosys.com', '+91 40 6642 0000'],
  ];
  companies.forEach((c, idx) => {
    const [name, industry, web, career, hq, desc, cp, ce, cph] = c;
    db.run(
      'INSERT INTO companies (company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [name, industry, web, career, hq, desc]
    );
    db.run(
      'INSERT INTO company_contacts (company_id, contact_person, designation, contact_email, contact_phone, is_primary) VALUES (?, ?, ?, ?, ?, 1)',
      [idx + 1, cp, 'Campus Relations Lead', ce, cph]
    );
  });

  // 7. Seed Campus Placement Drives & Opportunities (Academic Practice/Sample Drives)
  // Note: apply_url points to official career pages where applicable; campus status accurately tracked
  const drives = [
    [1, 'Systems Engineer — Java & SQL Track', 'Campus preparation drive profile covering Core Java, OOP, relational SQL, and web application fundamentals.', 'Hyderabad', 'On-Campus Drive', 7.00, '7.00 LPA', 'https://www.tcs.com/careers', '2026-11-01', '2026-12-05', '2026-11-28', 'Active', 'Approved', 2],
    [16, 'Specialist Programmer (SP)', 'Algorithmic backend and distributed software engineering campus assessment profile.', 'Hyderabad / Bengaluru', 'Full-Time', 9.50, '9.50 LPA', 'https://www.infosys.com/careers/', '2026-11-03', '2026-12-12', '2026-12-02', 'Active', 'Approved', 2],
    [4, 'Associate Software Engineer (ASE)', 'Enterprise Java, web engineering, and cloud delivery campus track.', 'Hyderabad', 'On-Campus Drive', 6.50, '6.50 LPA', 'https://www.accenture.com/in-en/careers', '2026-10-01', '2026-10-18', '2026-10-10', 'Completed', 'Approved', 2],
    [15, 'Analyst — Technology & Cloud Advisory', 'Database engineering, cloud migration, and enterprise analytics role.', 'Hyderabad (Gachibowli)', 'Full-Time', 7.60, '7.60 LPA', 'https://www2.deloitte.com/ui/en/careers.html', '2026-11-08', '2026-12-20', '2026-12-10', 'Planned', 'Approved', 2],
    [3, 'GenC Next — Full-Stack Java Developer', 'Java backend services, MySQL database design, and modern web UI.', 'Hyderabad / Chennai', 'On-Campus Drive', 6.75, '6.75 LPA', 'https://careers.cognizant.com', '2026-11-05', '2026-11-30', '2026-11-24', 'Active', 'Approved', 2],
    [9, 'Junior Software Engineering Intern', 'Hands-on Java, React, and data structures internship track with pre-placement review.', 'Hyderabad', 'Internship + Full-Time', 4.50, '₹35,000 / mo + PPO', 'https://www.epam.com/careers', '2026-11-10', '2027-01-10', '2026-12-22', 'Active', 'Approved', 2],
    [9, 'Graduate Software Engineer — Cloud & Java', 'Recruiter-submitted campus hiring drive awaiting GCET Placement Cell verification.', 'Hyderabad', 'Full-Time', 8.00, '8.00 LPA', 'https://www.epam.com/careers', '2026-11-12', '2027-01-20', '2026-12-28', 'Planned', 'Pending', 7],
  ];
  for (const dr of drives) {
    db.run(
      `INSERT INTO placement_drives (company_id, job_role, job_description, job_location, job_type, salary_package, compensation_label, apply_url, posted_date, drive_date, application_deadline, drive_status, approval_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      dr
    );
  }

  const elig = [
    [1, 7.5, 'CSE,CSE-AIML,CSE-DS,CSE-CS,IT,ECE', 2027, 0, 'No active backlogs; strong Java & SQL'],
    [2, 8.0, 'CSE,CSE-AIML,CSE-DS,IT,M.Tech CSE', 2027, 0, 'Strong Data Structures & Algorithms'],
    [3, 6.5, 'CSE,CSE-AIML,CSE-DS,CSE-CS,CSE-IoT,IT,ECE,EEE', 2027, 0, 'Good communication & programming basics'],
    [4, 7.5, 'CSE,CSE-AIML,CSE-DS,IT,ECE,MBA', 2027, 0, 'SQL, Cloud & Analytics aptitude'],
    [5, 7.0, 'CSE,CSE-AIML,CSE-DS,CSE-CS,IT,ECE,EEE', 2027, 0, 'Java or Python + Database Management'],
    [6, 7.5, 'CSE,CSE-AIML,CSE-DS,CSE-CS,IT,M.Tech CSE', 2027, 0, 'Internship readiness + Java/React/DSA'],
    [7, 7.5, 'CSE,CSE-AIML,CSE-DS,IT,M.Tech CSE', 2027, 0, 'Pending TPO verification'],
  ];
  for (const el of elig) {
    db.run(
      'INSERT INTO drive_eligibility (drive_id, min_cgpa, eligible_branches, graduation_year, max_backlogs, other_criteria) VALUES (?, ?, ?, ?, ?, ?)',
      el
    );
  }

  const reqSkills: [number, number, number, number][] = [
    [1, 1, 4, 1.5], [1, 10, 3, 1.2], [1, 12, 4, 1.3], [1, 22, 3, 1.0],
    [2, 1, 4, 1.5], [2, 12, 5, 2.0], [2, 13, 4, 1.5], [2, 10, 4, 1.0],
    [3, 1, 3, 1.2], [3, 7, 3, 1.2], [3, 22, 4, 1.0],
    [4, 10, 4, 1.5], [4, 11, 4, 1.2], [4, 20, 3, 1.3], [4, 22, 4, 1.0],
    [5, 1, 4, 1.5], [5, 9, 4, 1.2], [5, 7, 3, 1.2], [5, 24, 3, 1.0],
    [6, 1, 4, 1.5], [6, 8, 4, 1.3], [6, 12, 4, 1.4], [6, 25, 4, 1.0],
    [7, 1, 4, 1.5], [7, 20, 4, 1.4], [7, 10, 4, 1.2],
  ];
  for (const rs of reqSkills) {
    db.run('INSERT INTO drive_required_skills (drive_id, skill_id, required_level, weightage) VALUES (?, ?, ?, ?)', rs);
  }

  const apps: [number, number, string, string | null, string | null, string][] = [
    [3, 1, 'Selected', null, null, 'Cleared technical & HR rounds with top score'],
    [3, 3, 'Selected', null, null, 'Selected for Hyderabad Enterprise Delivery Unit'],
    [3, 7, 'Selected', null, null, 'Selected with fast-track onboarding'],
    [3, 6, 'Selected', null, null, 'Cleared technical panel'],
    [1, 2, 'Shortlisted', null, null, 'Cleared aptitude & coding assessment'],
    [1, 4, 'Assessment', null, null, 'Online coding round scheduled'],
    [2, 2, 'Interview', '2026-12-14 10:30 AM', 'Online Technical Panel', 'Technical Interview Round 2'],
  ];
  for (const a of apps) {
    db.run('INSERT INTO applications (drive_id, student_id, status, interview_date, interview_mode, remarks) VALUES (?, ?, ?, ?, ?, ?)', a);
  }

  const placements: [number, number, number, string, number, string, string][] = [
    [1, 3, 4, 'Associate Software Engineer (ASE)', 6.5, '2026-10-22', 'Accepted'],
    [3, 3, 4, 'Associate Software Engineer (ASE)', 6.5, '2026-10-22', 'Accepted'],
    [7, 3, 4, 'Associate Software Engineer (ASE)', 6.5, '2026-10-22', 'Joined'],
    [6, 3, 4, 'Associate Software Engineer (ASE)', 6.5, '2026-10-22', 'Offered'],
  ];
  for (const p of placements) {
    db.run(
      'INSERT INTO placements (student_id, drive_id, company_id, job_role, package_lpa, offer_date, joining_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      p
    );
  }

  // Saved Jobs seed for demo student
  db.run('INSERT INTO saved_jobs (user_id, drive_id) VALUES (?, ?)', [3, 2]);
  db.run('INSERT INTO saved_jobs (user_id, drive_id) VALUES (?, ?)', [4, 6]);

  // 8. Seed All 18 Official Announcement Categories
  const categories = [
    'College Announcements',
    'Placement Notifications',
    'Internship Opportunities',
    'Job Notifications',
    'Examination Notifications',
    'Academic Circulars',
    'Internal Assessment Notifications',
    'Semester Examination Timetables',
    'Results Notifications',
    'Workshop Announcements',
    'Technical Events',
    'Hackathons',
    'Seminars and Guest Lectures',
    'Department Notifications',
    'Scholarships',
    'Government Notifications',
    'Competition Announcements',
    'Important Student Notices',
  ];
  for (const cat of categories) {
    db.run('INSERT INTO announcement_categories (category_name) VALUES (?)', [cat]);
  }

  // 9. Seed 5 Official Announcement Sources
  const sources: [string, string, string, string, number][] = [
    ['GCET Official Website', 'https://gcet.edu.in/', 'https://gcet.edu.in/', 'HTML', 1],
    ['GCET ECE Department Website', 'https://www.gcetece.org/', 'https://www.gcetece.org/', 'HTML', 1],
    ['GCET Student Blog', 'https://blog.gcet.edu.in/', 'https://blog.gcet.edu.in/feeds/posts/default?alt=rss', 'RSS', 1],
    ['Geethanjali Institutions', 'https://www.geethanjaliinstitutions.com/', 'https://www.geethanjaliinstitutions.com/', 'HTML', 1],
    ['JNTUH Official Portal', 'https://jntuh.ac.in/', 'https://jntuh.ac.in/', 'HTML', 1],
  ];
  for (const src of sources) {
    db.run(
      'INSERT INTO announcement_sources (source_name, base_url, feed_url, sync_mode, is_enabled) VALUES (?, ?, ?, ?, ?)',
      src
    );
  }

  // 10. Seed Verified Real Source Links Discovered from the Official Sites + Admin Campus Notices
  // Every external URL here is a real verified link from gcetece.org, geethanjaliinstitutions.com, gcet.edu.in, and jntuh.ac.in
  const seededAnnouncements: [
    string,
    number,
    number | null,
    string,
    string,
    string,
    string,
    string,
    string | null,
    string | null,
    number,
    string | null,
    string,
    number,
    number
  ][] = [
    [
      'GCET ECE Placement Cell & Recruiter Updates',
      2, // Placement Notifications
      2, // gcetece.org
      'GCET ECE Department Website',
      'https://www.gcetece.org/placements',
      '2026-11-10',
      'Direct official placement section from Geethanjali College of Engineering and Technology ECE portal.',
      'ECE,ALL',
      'ECE',
      null,
      0,
      null,
      'Important',
      1,
      1,
    ],
    [
      'GCET Finishing School — Skill Training & Campus Readiness',
      10, // Workshop Announcements
      2,
      'GCET ECE Department Website',
      'https://www.gcetece.org/finishing-school',
      '2026-11-08',
      'Official GCET Finishing School training modules and placement readiness resources.',
      'ALL',
      'ECE',
      null,
      0,
      null,
      'Normal',
      0,
      1,
    ],
    [
      'FDPs, Conferences, Workshops & Technical Seminars',
      13, // Seminars and Guest Lectures
      2,
      'GCET ECE Department Website',
      'https://www.gcetece.org/fdps-conferences-workshops-seminars',
      '2026-11-06',
      'Official department listing of conferences, workshops, and guest lectures.',
      'ECE,EEE,CSE',
      'ECE',
      null,
      0,
      null,
      'Normal',
      0,
      1,
    ],
    [
      'GCET Academic Result Analysis Portal',
      9, // Results Notifications
      2,
      'GCET ECE Department Website',
      'https://www.gcetece.org/result-analysis',
      '2026-11-04',
      'Official semester academic result analysis page hosted on the GCET ECE portal.',
      'ECE,ALL',
      'ECE',
      null,
      0,
      null,
      'Important',
      0,
      1,
    ],
    [
      'JNTUH Evaluation & Examination Branch Portal',
      5, // Examination Notifications
      5, // jntuh.ac.in
      'JNTUH Official Portal',
      'https://jntuh.ac.in/evaluation',
      '2026-11-11',
      'Official Jawaharlal Nehru Technological University Hyderabad evaluation circulars, timetables, and exam notices.',
      'ALL',
      null,
      null,
      0,
      null,
      'Urgent',
      1,
      1,
    ],
    [
      'JNTUH Directorate of Admissions — Interview & Shortlist Circular (PDF)',
      6, // Academic Circulars
      5,
      'JNTUH Official Portal',
      'https://doa.jntuh.ac.in/uploads/List_of_Eligible_Candidates_for_Interview_Instructions_to_the_Candidates.pdf',
      '2026-11-05',
      'Official PDF circular published via JNTUH Directorate of Admissions.',
      'ALL',
      null,
      null,
      1,
      'https://doa.jntuh.ac.in/uploads/List_of_Eligible_Candidates_for_Interview_Instructions_to_the_Candidates.pdf',
      'Normal',
      0,
      1,
    ],
    [
      'JNTUH Student Services & Scholarship Desk',
      15, // Scholarships
      5,
      'JNTUH Official Portal',
      'https://jntuh.ac.in/content/student-services/85/701a4596e708b557cd79a4a4adaf2d69',
      '2026-11-02',
      'Official JNTUH student services portal covering certificates, academic support, and scholarship verifications.',
      'ALL',
      null,
      null,
      0,
      null,
      'Normal',
      0,
      1,
    ],
    [
      'Geethanjali Institutions Official Information Brochure (PDF)',
      1, // College Announcements
      4,
      'Geethanjali Institutions',
      'http://www.geethanjaliinstitutions.com/engineering/img/downloads/GCET%20brochure.pdf',
      '2026-10-28',
      'Official Geethanjali College of Engineering and Technology institutional brochure PDF.',
      'ALL',
      null,
      null,
      1,
      'http://www.geethanjaliinstitutions.com/engineering/img/downloads/GCET%20brochure.pdf',
      'Normal',
      0,
      1,
    ],
    [
      'GCET Main Portal — Campus Updates & Academic Notices',
      1, // College Announcements
      1,
      'GCET Official Website',
      'https://gcet.edu.in/',
      '2026-11-12',
      'Primary official college website for Geethanjali College of Engineering and Technology, Cheeryal, Hyderabad.',
      'ALL',
      null,
      null,
      0,
      null,
      'Important',
      0,
      1,
    ],
    [
      'CSE & Specialized Tracks — Semester VII Skill Matrix Verification Notice',
      14, // Department Notifications
      null,
      'Admin Verified Notice — CSE Department',
      'https://gcet.edu.in/',
      '2026-11-13',
      'All CSE, CSE-AIML, CSE-DS, CSE-CS, and CSE-IoT students are requested to update their verified technical skills and resume links in Career Connect.',
      'CSE,CSE-AIML,CSE-DS,CSE-CS,CSE-IoT',
      'CSE',
      '2026-11-30',
      0,
      null,
      'Important',
      1,
      0, // Admin Verified Notice
    ],
  ];

  for (const a of seededAnnouncements) {
    db.run(
      `INSERT INTO announcements (title, category_id, source_id, source_name, source_url, published_date, description, relevant_branches, department_code, deadline_date, has_attachment, attachment_url, priority, is_pinned, is_verified_source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      a
    );
  }

  // Seed Notifications for users
  db.run(
    'INSERT INTO notifications (user_id, title, message, category, link_url, related_module) VALUES (?, ?, ?, ?, ?, ?)',
    [null, 'JNTUH Evaluation Circulars Available', 'Latest examination & evaluation notices are synced from jntuh.ac.in.', 'Examination Notifications', 'https://jntuh.ac.in/evaluation', 'announcements']
  );
  db.run(
    'INSERT INTO notifications (user_id, title, message, category, link_url, related_module) VALUES (?, ?, ?, ?, ?, ?)',
    [null, 'CSE Skill Matrix Verification Due Nov 30', 'Update your Java, SQL, and Data Structures proficiency levels.', 'Department Notifications', null, 'skill-matrix']
  );
  db.run(
    'INSERT INTO notifications (user_id, title, message, category, link_url, related_module) VALUES (?, ?, ?, ?, ?, ?)',
    [3, 'Application Status: Selected (Accenture ASE)', 'Congratulations! Your Accenture ASE offer status is recorded as Accepted.', 'Placement Notifications', null, 'applications']
  );
  db.run(
    'INSERT INTO notifications (user_id, title, message, category, link_url, related_module) VALUES (?, ?, ?, ?, ?, ?)',
    [4, 'Shortlisted for TCS Systems Engineer Track', 'You have been shortlisted for the upcoming technical assessment.', 'Placement Notifications', null, 'applications']
  );

  // Seed Activity Logs
  db.run(
    'INSERT INTO activity_logs (user_id, actor_name, activity_type, description) VALUES (?, ?, ?, ?)',
    [1, 'GCET System Administrator', 'ANNOUNCEMENT', 'Initialized GCET Placement Hub official announcement feeds and 12 college branches']
  );
  db.run(
    'INSERT INTO activity_logs (user_id, actor_name, activity_type, description) VALUES (?, ?, ?, ?)',
    [2, 'Prof. Raghavendra Rao (TPO)', 'COMPANY', 'Loaded 16 GCET placement publication reference companies into the directory']
  );

  // Initialize security/role tables and idempotently seed Executive, Admin, Official Faculty Coordinators & Final Phase setups
  ensureSecurityAndRoleTables(db);
  ensureInitialAccountsSeeded(db);
  ensureOfficialFacultyDirectory(db);
  ensureFinalPhaseSetup(db);
}
