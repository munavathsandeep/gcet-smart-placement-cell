import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import {
  getDb,
  queryAll,
  queryOne,
  executeSql,
  executeInTransaction,
  saveDatabase,
  generateSalt,
  hashPassword,
  verifyPassword,
} from './server/db.ts';
import {
  evaluateEligibility,
  analyzeSkillGap,
  matchStudentToDrives,
  type StudentRecord,
  type StudentSkillRecord,
  type DriveRecord,
  type DriveRequiredSkillRecord,
} from './server/placementEngine.ts';
import {
  syncAnnouncementSources,
  startAnnouncementScheduler,
  getSyncHealthSummary,
  checkUpcomingDriveDeadlines,
} from './server/announcementSync.ts';
import {
  applyApprovedRevisionTransaction,
  branchMatchesFacultyScope,
  buildOfficialDossier,
  canFacultyAccessStudent,
  computeFieldDiffs,
  generateSubmissionCode,
  getFacultyAssignedBranches,
  hydrateSubmissionRow,
  isFacultyRoleName,
  normalizeAndValidateDraft,
  resolveAssignedFaculty,
  resolveBranchRow,
} from './server/profileWorkflow.ts';
import {
  applyApprovedFacultyRevisionTransaction,
  buildOfficialFacultyDossier,
  computeFacultyFieldDiffs,
  generateFacultySubmissionCode,
  hydrateFacultySubmissionRow,
  listFacultySkills,
  normalizeAndValidateFacultyDraft,
  proficiencyLabelFromLevel,
  resolveFacultyForUser,
} from './server/facultyProfileWorkflow.ts';
import {
  computeInstitutionalRegistrationStats,
  generateRegistrationCsvBuffer,
  generateRegistrationExcelBuffer,
  generateRegistrationPdfBuffer,
} from './server/registrationReports.ts';

type UserRole =
  | 'PRINCIPAL'
  | 'VICE_CHAIRMAN'
  | 'CHAIRMAN'
  | 'ADMIN'
  | 'PLACEMENT_OFFICER'
  | 'FACULTY'
  | 'FACULTY_COORDINATOR'
  | 'STUDENT'
  | 'RECRUITER';

const EXECUTIVE_ROLES = new Set<UserRole>(['PRINCIPAL', 'VICE_CHAIRMAN', 'CHAIRMAN']);
const PLACEMENT_ADMIN_ROLES = new Set<UserRole>([
  'PRINCIPAL',
  'VICE_CHAIRMAN',
  'CHAIRMAN',
  'ADMIN',
  'PLACEMENT_OFFICER',
]);
const REGISTRATION_REPORT_ROLES = new Set<UserRole>([
  'PRINCIPAL',
  'VICE_CHAIRMAN',
  'CHAIRMAN',
  'FACULTY_COORDINATOR',
  'FACULTY',
]);

function isExecutiveRole(role?: string | null): boolean {
  return Boolean(role && EXECUTIVE_ROLES.has(role as UserRole));
}

function isPlacementAdminRole(role?: string | null): boolean {
  return Boolean(role && PLACEMENT_ADMIN_ROLES.has(role as UserRole));
}

function isFacultyRole(role?: string | null): boolean {
  return isFacultyRoleName(role);
}

function getDashboardRouteForRole(role: UserRole): 'EXECUTIVE' | 'ADMIN' | 'FACULTY' | 'STUDENT' | 'RECRUITER' {
  if (EXECUTIVE_ROLES.has(role)) return 'EXECUTIVE';
  if (role === 'ADMIN' || role === 'PLACEMENT_OFFICER') return 'ADMIN';
  if (role === 'FACULTY' || role === 'FACULTY_COORDINATOR') return 'FACULTY';
  if (role === 'RECRUITER') return 'RECRUITER';
  return 'STUDENT';
}

function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'PRINCIPAL':
      return '/principal/dashboard';
    case 'VICE_CHAIRMAN':
      return '/vice-chairman/dashboard';
    case 'CHAIRMAN':
      return '/chairman/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'PLACEMENT_OFFICER':
      return '/placement-officer/dashboard';
    case 'FACULTY_COORDINATOR':
      return '/faculty-coordinator/dashboard';
    case 'FACULTY':
      return '/faculty/dashboard';
    case 'RECRUITER':
      return '/recruiter/dashboard';
    case 'STUDENT':
    default:
      return '/student/dashboard';
  }
}

interface AuthUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  employeeId?: string | null;
  studentId?: number | null;
  companyId?: number | null;
  assignedBranch?: string | null;
  assignedBranches?: string[];
  designation?: string | null;
  departmentName?: string | null;
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  mustChangePassword?: boolean;
  passwordChangeDismissed?: boolean;
  dashboardRoute?: 'EXECUTIVE' | 'ADMIN' | 'FACULTY' | 'STUDENT' | 'RECRUITER';
  dashboardPath?: string;
}

type DbHandle = Awaited<ReturnType<typeof getDb>>;

interface AuthedRequest extends Request {
  authUser?: AuthUser;
  authRememberMe?: boolean;
  authSessionId?: string;
}

const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'gcet_spc_session';
const SHORT_SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const REMEMBER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
let cachedSessionSecret = '';

function getSessionSecret(db: DbHandle): string {
  if (cachedSessionSecret) return cachedSessionSecret;
  const envSecret = String(process.env.SESSION_SECRET || '').trim();
  if (envSecret && !envSecret.includes('replace-with') && envSecret.length >= 24) {
    cachedSessionSecret = envSecret;
    return cachedSessionSecret;
  }
  if (IS_PROD && (!envSecret || envSecret.includes('replace-with'))) {
    console.warn('[SECURITY] SESSION_SECRET is missing or placeholder in production; using persisted runtime secret.');
  }
  const existing = queryOne<{ setting_value: string }>(
    db,
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
    ['runtime_session_secret']
  );
  if (existing?.setting_value && existing.setting_value.length >= 32) {
    cachedSessionSecret = existing.setting_value;
    return cachedSessionSecret;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  executeSql(
    db,
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES ('runtime_session_secret', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`,
    [generated]
  );
  cachedSessionSecret = generated;
  return cachedSessionSecret;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return Boolean(req.secure || forwardedProto === 'https');
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const ROLL_NUMBER_REGEX = /^[A-Za-z0-9-]{6,20}$/;

function validatePhoneDigits(phone: string): boolean {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validatePasswordStrength(password: string): string | null {
  const raw = String(password || '');
  if (raw.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

// Sliding-window in-memory rate limiter for auth endpoints
const authRateBuckets = new Map<string, number[]>();
function createAuthRateLimiter(maxRequests: number, windowMs: number, message: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${req.path}:${clientIp}`;
    const now = Date.now();
    const recent = (authRateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({ success: false, error: message });
      return;
    }
    recent.push(now);
    authRateBuckets.set(key, recent);
    if (authRateBuckets.size > 2000) {
      for (const [k, list] of authRateBuckets.entries()) {
        if (list.every((ts) => now - ts >= windowMs)) authRateBuckets.delete(k);
      }
    }
    next();
  };
}

const loginRateLimiter = createAuthRateLimiter(30, 5 * 60 * 1000, 'Too many authentication requests from this network. Please wait a few minutes.');
const registerRateLimiter = createAuthRateLimiter(25, 10 * 60 * 1000, 'Too many registration requests from this network. Please wait a few minutes.');
const resetRateLimiter = createAuthRateLimiter(15, 10 * 60 * 1000, 'Too many password reset requests. Please try again later.');

function createAuthToken(user: AuthUser, ttlMs: number, secret: string, jti: string, rememberMe = false): string {
  const payloadObj = { ...user, jti, rememberMe, exp: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyAuthToken(
  token: string | undefined,
  secret: string
): (AuthUser & { rememberMe?: boolean; jti?: string }) | null {
  if (!token || !secret) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const payloadB64 = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AuthUser & {
      exp?: number;
      rememberMe?: boolean;
      jti?: string;
    };
    if (!parsed.exp || Date.now() > parsed.exp || !parsed.jti) return null;
    return {
      userId: parsed.userId,
      username: parsed.username,
      email: parsed.email,
      fullName: parsed.fullName,
      role: parsed.role,
      employeeId: parsed.employeeId ?? null,
      studentId: parsed.studentId ?? null,
      companyId: parsed.companyId ?? null,
      assignedBranch: parsed.assignedBranch ?? null,
      assignedBranches: Array.isArray(parsed.assignedBranches) ? parsed.assignedBranches : undefined,
      designation: parsed.designation ?? null,
      departmentName: parsed.departmentName ?? null,
      approvalStatus: parsed.approvalStatus ?? 'Approved',
      mustChangePassword: Boolean(parsed.mustChangePassword),
      passwordChangeDismissed: Boolean(parsed.passwordChangeDismissed),
      dashboardRoute: parsed.dashboardRoute ?? getDashboardRouteForRole(parsed.role),
      dashboardPath: parsed.dashboardPath ?? getDashboardPathForRole(parsed.role),
      rememberMe: Boolean(parsed.rememberMe),
      jti: String(parsed.jti),
    };
  } catch {
    return null;
  }
}

function getRequestToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.cookies?.[SESSION_COOKIE];
}

function createUserSession(
  db: DbHandle,
  user: AuthUser,
  ttlMs: number,
  rememberMe: boolean
): { token: string; sessionId: string } {
  const sessionId = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + ttlMs;
  executeSql(db, 'DELETE FROM user_sessions WHERE expires_at <= ?', [Date.now()], true);
  executeSql(
    db,
    'INSERT INTO user_sessions (session_id, user_id, remember_me, expires_at) VALUES (?, ?, ?, ?)',
    [sessionId, user.userId, rememberMe ? 1 : 0, expiresAt]
  );
  const token = createAuthToken(user, ttlMs, getSessionSecret(db), sessionId, rememberMe);
  return { token, sessionId };
}

function extractActiveSession(
  req: Request,
  db: DbHandle
): (AuthUser & { rememberMe?: boolean; jti: string }) | null {
  const token = getRequestToken(req);
  const decoded = verifyAuthToken(token, getSessionSecret(db));
  if (!decoded || !decoded.jti) return null;
  const sessionRow = queryOne<{ session_id: string; user_id: number; expires_at: number; remember_me: number }>(
    db,
    'SELECT session_id, user_id, expires_at, remember_me FROM user_sessions WHERE session_id = ? AND user_id = ?',
    [decoded.jti, decoded.userId]
  );
  if (!sessionRow || sessionRow.expires_at <= Date.now()) {
    if (sessionRow) {
      executeSql(db, 'DELETE FROM user_sessions WHERE session_id = ?', [decoded.jti]);
    }
    return null;
  }
  return { ...decoded, jti: decoded.jti, rememberMe: Boolean(sessionRow.remember_me) };
}

function setSessionCookie(req: Request, res: Response, token: string, ttlMs: number, rememberMe: boolean): void {
  const isHttps = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    ...(rememberMe ? { maxAge: ttlMs } : {}),
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const db = await getDb();
  const decoded = extractActiveSession(req, db);
  if (!decoded) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  const { rememberMe, jti, ...authUser } = decoded;
  const dbUser = queryOne<{
    is_active: number;
    approval_status: string;
    must_change_password: number;
    password_change_dismissed: number;
    role: UserRole;
    username: string;
    full_name: string;
    email: string;
    employee_id: string | null;
    company_id: number | null;
    assigned_branch: string | null;
    designation: string | null;
    department_name: string | null;
  }>(
    db,
    'SELECT is_active, approval_status, must_change_password, password_change_dismissed, role, username, full_name, email, employee_id, company_id, assigned_branch, designation, department_name FROM users WHERE user_id = ?',
    [authUser.userId]
  );
  if (!dbUser || !dbUser.is_active) {
    executeSql(db, 'DELETE FROM user_sessions WHERE session_id = ?', [jti]);
    res.status(403).json({ success: false, error: 'Account is disabled or inactive.' });
    return;
  }
  if (dbUser.approval_status === 'Pending' || dbUser.approval_status === 'Rejected') {
    executeSql(db, 'DELETE FROM user_sessions WHERE session_id = ?', [jti]);
    res.status(403).json({ success: false, error: 'Account is not approved for portal access.' });
    return;
  }
  let studentId = authUser.studentId ?? null;
  let resolvedBranch = dbUser.assigned_branch;
  if (dbUser.role === 'STUDENT' && !studentId) {
    const st = queryOne<{ student_id: number; branch: string }>(
      db,
      'SELECT student_id, branch FROM students WHERE user_id = ?',
      [authUser.userId]
    );
    studentId = st ? st.student_id : null;
    if (st?.branch) resolvedBranch = st.branch;
  }
  const assignedBranches = isFacultyRole(dbUser.role)
    ? getFacultyAssignedBranches(db, authUser.userId, dbUser.assigned_branch)
    : undefined;
  req.authRememberMe = Boolean(rememberMe);
  req.authSessionId = jti;
  req.authUser = {
    ...authUser,
    username: dbUser.username,
    fullName: dbUser.full_name,
    email: dbUser.email,
    role: dbUser.role,
    employeeId: dbUser.employee_id ?? null,
    studentId,
    companyId: dbUser.company_id ?? null,
    assignedBranch: resolvedBranch,
    assignedBranches,
    designation: dbUser.designation ?? authUser.designation ?? null,
    departmentName: dbUser.department_name ?? authUser.departmentName ?? null,
    approvalStatus: dbUser.approval_status as AuthUser['approvalStatus'],
    mustChangePassword: Boolean(dbUser.must_change_password),
    passwordChangeDismissed: Boolean(dbUser.password_change_dismissed),
    dashboardRoute: getDashboardRouteForRole(dbUser.role),
    dashboardPath: getDashboardPathForRole(dbUser.role),
  };
  next();
}

function requireStaff(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role === 'STUDENT' || req.authUser.role === 'RECRUITER') {
    res.status(403).json({ success: false, error: 'This operation requires Faculty, Placement Officer, or Admin privileges.' });
    return;
  }
  next();
}

function requirePlacementStaff(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (!isPlacementAdminRole(req.authUser.role)) {
    res.status(403).json({ success: false, error: 'This operation requires Placement Officer, System Admin, or Executive privileges.' });
    return;
  }
  next();
}

function requireSystemAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role !== 'ADMIN' && !isExecutiveRole(req.authUser.role)) {
    res.status(403).json({ success: false, error: 'This operation requires System Administrator or Executive authority.' });
    return;
  }
  next();
}

// Strict System Administration operations (user provisioning, credential resets, unlocks, sync config, destructive deletes)
function requireAdminOnly(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Only System Administrator (ADMIN) may perform IT infrastructure, user provisioning, or password reset operations.',
    });
    return;
  }
  next();
}

// Account activation / deactivation governance (System Admin or Chairman)
function requireAdminOrChairman(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role !== 'ADMIN' && req.authUser.role !== 'CHAIRMAN') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Only System Administrator or Chairman may activate or deactivate institutional accounts.',
    });
    return;
  }
  next();
}

// Operational placement & institutional approvals (excludes read-only Vice Chairman executive oversight)
function requireApprovingAuthority(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  const allowed = new Set<UserRole>(['ADMIN', 'PLACEMENT_OFFICER', 'PRINCIPAL', 'CHAIRMAN']);
  if (!allowed.has(req.authUser.role)) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Vice Chairman executive portal is read-only for operational placement mutations; approval authority belongs to Principal, Chairman, TPO, or System Admin.',
    });
    return;
  }
  next();
}

function requireRegistrationReportAccess(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (!REGISTRATION_REPORT_ROLES.has(req.authUser.role)) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Only Principal, Vice Chairman, Chairman, and authorized Faculty Coordinators may access institutional registration reports.',
    });
    return;
  }
  next();
}

async function logActivity(
  userId: number | null,
  actorName: string,
  activityType: 'STUDENT' | 'COMPANY' | 'DRIVE' | 'ANNOUNCEMENT' | 'APPLICATION',
  description: string
): Promise<void> {
  try {
    const db = await getDb();
    executeSql(
      db,
      'INSERT INTO activity_logs (user_id, actor_name, activity_type, description) VALUES (?, ?, ?, ?)',
      [userId, actorName, activityType, description]
    );
  } catch {
    // non-fatal
  }
}

async function hydrateDrive(driveId: number): Promise<DriveRecord | null> {
  const db = await getDb();
  const drive = queryOne<DriveRecord>(
    db,
    `SELECT pd.*, c.company_name, c.industry, de.min_cgpa, de.eligible_branches, de.graduation_year, de.max_backlogs, de.other_criteria
     FROM placement_drives pd
     JOIN companies c ON pd.company_id = c.company_id
     LEFT JOIN drive_eligibility de ON pd.drive_id = de.drive_id
     WHERE pd.drive_id = ?`,
    [driveId]
  );
  if (!drive) return null;
  drive.requiredSkills = queryAll<DriveRequiredSkillRecord>(
    db,
    `SELECT drs.skill_id, s.skill_name, s.category, drs.required_level, drs.weightage
     FROM drive_required_skills drs
     JOIN skills s ON drs.skill_id = s.skill_id
     WHERE drs.drive_id = ?`,
    [driveId]
  );
  return drive;
}

async function hydrateAllDrives(): Promise<DriveRecord[]> {
  const db = await getDb();
  const drives = queryAll<DriveRecord>(
    db,
    `SELECT pd.*, c.company_name, c.industry, de.min_cgpa, de.eligible_branches, de.graduation_year, de.max_backlogs, de.other_criteria
     FROM placement_drives pd
     JOIN companies c ON pd.company_id = c.company_id
     LEFT JOIN drive_eligibility de ON pd.drive_id = de.drive_id
     ORDER BY pd.drive_date DESC`
  );
  for (const d of drives) {
    d.requiredSkills = queryAll<DriveRequiredSkillRecord>(
      db,
      `SELECT drs.skill_id, s.skill_name, s.category, drs.required_level, drs.weightage
       FROM drive_required_skills drs
       JOIN skills s ON drs.skill_id = s.skill_id
       WHERE drs.drive_id = ?`,
      [d.drive_id]
    );
  }
  return drives;
}

async function notifyEligibleStudentsForDrive(driveId: number): Promise<number> {
  const db = await getDb();
  const drive = await hydrateDrive(driveId);
  if (!drive || (drive.approval_status && drive.approval_status !== 'Approved')) {
    return 0;
  }
  if (drive.drive_status !== 'Active' && drive.drive_status !== 'Planned') {
    return 0;
  }

  const students = queryAll<StudentRecord & { user_id: number | null }>(
    db,
    'SELECT * FROM students WHERE user_id IS NOT NULL'
  );
  const title = `New Eligible Opportunity: ${drive.company_name} — ${drive.job_role}`;
  let notified = 0;

  for (const st of students) {
    if (!st.user_id) continue;
    const skills = queryAll<StudentSkillRecord>(
      db,
      `SELECT ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
       FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ?`,
      [st.student_id]
    );
    const elig = evaluateEligibility(st, skills, drive);
    if (!elig.eligible) continue;

    const existing = queryOne<{ notification_id: number }>(
      db,
      'SELECT notification_id FROM notifications WHERE user_id = ? AND title = ? LIMIT 1',
      [st.user_id, title]
    );
    if (existing) continue;

    executeSql(
      db,
      `INSERT INTO notifications (user_id, title, message, category, related_module)
       VALUES (?, ?, ?, 'Placement Notifications', 'drives')`,
      [
        st.user_id,
        title,
        `You meet the eligibility criteria for ${drive.company_name} (${drive.compensation_label || `${drive.salary_package} LPA`}). Deadline: ${drive.application_deadline}.`,
      ]
    );
    notified++;
  }
  return notified;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const allowedOrigins = new Set(
    [
      process.env.APP_URL,
      ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
    ]
      .map((o) => String(o || '').trim().replace(/\/+$/, ''))
      .filter((o) => o && !o.includes('MY_APP_URL'))
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const origin = req.headers.origin ? String(req.headers.origin).replace(/\/+$/, '') : '';
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const hostHeader = forwardedHost || (req.headers.host ? String(req.headers.host) : '');
    const proto = isHttpsRequest(req) ? 'https' : req.protocol;
    const hostOrigin = hostHeader ? `${proto}://${hostHeader}` : '';
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if (origin && (origin === hostOrigin || allowedOrigins.has(origin) || (!IS_PROD && isLocalOrigin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '8mb' }));
  app.use(cookieParser());
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  const initDb = await getDb();
  checkUpcomingDriveDeadlines(initDb);
  startAnnouncementScheduler(getDb);

  // ---------------- AUTH ROUTES ----------------
  app.get('/api/auth/session', async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const decoded = extractActiveSession(req, db);
    if (!decoded) {
      res.json({ success: true, data: null });
      return;
    }
    const { rememberMe: _rm, jti, ...authUser } = decoded;
    const dbUser = queryOne<{
      is_active: number;
      approval_status: string;
      must_change_password: number;
      password_change_dismissed: number;
      role: UserRole;
      username: string;
      full_name: string;
      email: string;
      employee_id: string | null;
      assigned_branch: string | null;
      designation: string | null;
      department_name: string | null;
      company_id: number | null;
    }>(
      db,
      'SELECT is_active, approval_status, must_change_password, password_change_dismissed, role, username, full_name, email, employee_id, assigned_branch, designation, department_name, company_id FROM users WHERE user_id = ?',
      [authUser.userId]
    );
    if (!dbUser || !dbUser.is_active || dbUser.approval_status !== 'Approved') {
      executeSql(db, 'DELETE FROM user_sessions WHERE session_id = ?', [jti]);
      res.json({ success: true, data: null });
      return;
    }
    let studentId = authUser.studentId ?? null;
    let resolvedBranch = dbUser.assigned_branch;
    if (dbUser.role === 'STUDENT' && !studentId) {
      const st = queryOne<{ student_id: number; branch: string }>(
        db,
        'SELECT student_id, branch FROM students WHERE user_id = ?',
        [authUser.userId]
      );
      studentId = st ? st.student_id : null;
      if (st?.branch) resolvedBranch = st.branch;
    }
    const assignedBranches = isFacultyRole(dbUser.role)
      ? getFacultyAssignedBranches(db, authUser.userId, dbUser.assigned_branch)
      : undefined;
    const sessionUser: AuthUser = {
      ...authUser,
      username: dbUser.username,
      fullName: dbUser.full_name,
      email: dbUser.email,
      role: dbUser.role,
      employeeId: dbUser.employee_id ?? null,
      studentId,
      companyId: dbUser.company_id ?? authUser.companyId ?? null,
      assignedBranch: resolvedBranch,
      assignedBranches,
      designation: dbUser.designation ?? authUser.designation ?? null,
      departmentName: dbUser.department_name ?? authUser.departmentName ?? null,
      approvalStatus: dbUser.approval_status as AuthUser['approvalStatus'],
      mustChangePassword: Boolean(dbUser.must_change_password),
      passwordChangeDismissed: Boolean(dbUser.password_change_dismissed),
      dashboardRoute: getDashboardRouteForRole(dbUser.role),
      dashboardPath: getDashboardPathForRole(dbUser.role),
    };
    res.json({
      success: true,
      data: sessionUser,
    });
  });

  app.post('/api/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
    try {
      const { identifier, password, role, rememberMe } = req.body ?? {};
      const cleanId = String(identifier || '').trim();
      if (!cleanId || !password) {
        res.status(400).json({ success: false, error: 'Username/email and password are required.' });
        return;
      }
      const normKey = cleanId.toLowerCase();
      const db = await getDb();

      const user = queryOne<{
        user_id: number;
        username: string;
        email: string;
        password_hash: string;
        password_salt: string;
        role: AuthUser['role'];
        full_name: string;
        employee_id: string | null;
        assigned_branch: string | null;
        designation: string | null;
        department_name: string | null;
        company_id: number | null;
        approval_status: 'Approved' | 'Pending' | 'Rejected';
        is_active: number;
        must_change_password: number;
        password_change_dismissed: number;
      }>(
        db,
        `SELECT * FROM users
         WHERE LOWER(username) = LOWER(?)
            OR LOWER(email) = LOWER(?)
            OR LOWER(COALESCE(employee_id, '')) = LOWER(?)
         LIMIT 1`,
        [cleanId, cleanId, cleanId]
      );

      // Check brute-force lockout protection across all user aliases (5 failed attempts -> 15 min lockout)
      const lockKeys = user
        ? Array.from(
            new Set([
              `user:${user.user_id}`,
              normKey,
              user.username.toLowerCase(),
              user.email.toLowerCase(),
              ...(user.employee_id ? [user.employee_id.toLowerCase()] : []),
            ])
          )
        : [normKey];
      const lockPlaceholders = lockKeys.map(() => '?').join(',');
      const attemptRows = queryAll<{
        attempt_id: number;
        identifier: string;
        attempt_count: number;
        locked_until: string | null;
      }>(
        db,
        `SELECT attempt_id, identifier, attempt_count, locked_until FROM login_attempts WHERE identifier IN (${lockPlaceholders})`,
        lockKeys
      );

      const nowMs = Date.now();
      const activeLockRow = attemptRows.find(
        (r) => r.locked_until && !Number.isNaN(new Date(r.locked_until).getTime()) && new Date(r.locked_until).getTime() > nowMs
      );
      if (activeLockRow?.locked_until) {
        const lockedUntilMs = new Date(activeLockRow.locked_until).getTime();
        const minsLeft = Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 60000));
        res.status(429).json({
          success: false,
          error: `Too many failed sign-in attempts. Account login is temporarily locked for ${minsLeft} minute(s).`,
        });
        return;
      }

      if (!user || !verifyPassword(String(password), user.password_hash, user.password_salt)) {
        const prevCount = attemptRows.reduce((max, r) => {
          const isExpiredLock =
            r.locked_until && !Number.isNaN(new Date(r.locked_until).getTime()) && new Date(r.locked_until).getTime() <= nowMs;
          return Math.max(max, isExpiredLock ? 0 : r.attempt_count);
        }, 0);
        const nextCount = prevCount + 1;
        const lockUntil = nextCount >= 5 ? new Date(nowMs + 15 * 60 * 1000).toISOString() : null;
        const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
        const canonicalKey = user ? `user:${user.user_id}` : normKey;
        const canonicalRow = attemptRows.find((r) => r.identifier === canonicalKey);
        if (canonicalRow) {
          executeSql(
            db,
            'UPDATE login_attempts SET attempt_count = ?, locked_until = ?, ip_address = ?, last_attempt_at = CURRENT_TIMESTAMP WHERE attempt_id = ?',
            [nextCount, lockUntil, clientIp, canonicalRow.attempt_id]
          );
        } else {
          executeSql(
            db,
            'INSERT INTO login_attempts (identifier, ip_address, attempt_count, locked_until) VALUES (?, ?, ?, ?)',
            [canonicalKey, clientIp, nextCount, lockUntil]
          );
        }
        if (lockUntil) {
          res.status(429).json({
            success: false,
            error: 'Too many failed sign-in attempts (5/5). Account login locked for 15 minutes.',
          });
          return;
        }
        res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
        return;
      }

      if (!user.is_active) {
        res.status(403).json({ success: false, error: 'Account is deactivated. Please contact the System Administrator.' });
        return;
      }
      if (user.approval_status === 'Pending') {
        res.status(403).json({
          success: false,
          error: 'Your corporate recruiter account is pending administrator approval. Please wait for GCET Placement Cell verification.',
        });
        return;
      }
      if (user.approval_status === 'Rejected') {
        res.status(403).json({ success: false, error: 'Account registration was declined by the Placement Cell.' });
        return;
      }
      if (role) {
        const isAdminPortalMatch = role === 'ADMIN' && isPlacementAdminRole(user.role);
        const isFacultyPortalMatch = isFacultyRole(role) && isFacultyRole(user.role);
        if (!isAdminPortalMatch && !isFacultyPortalMatch && user.role !== role) {
          res.status(403).json({
            success: false,
            error: `Selected portal (${String(role).replace('_', ' ')}) does not match account role (${user.role.replace('_', ' ')}).`,
          });
          return;
        }
      }

      // Clear failed attempt tracker across all aliases & record successful login
      executeSql(db, `DELETE FROM login_attempts WHERE identifier IN (${lockPlaceholders})`, lockKeys);
      executeSql(db, 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

      let studentId: number | null = null;
      let resolvedBranch = user.assigned_branch ?? null;
      if (user.role === 'STUDENT') {
        const st = queryOne<{ student_id: number; branch: string }>(
          db,
          'SELECT student_id, branch FROM students WHERE user_id = ?',
          [user.user_id]
        );
        studentId = st ? st.student_id : null;
        if (st?.branch) resolvedBranch = st.branch;
      }
      const assignedBranches = isFacultyRole(user.role)
        ? getFacultyAssignedBranches(db, user.user_id, user.assigned_branch)
        : undefined;

      const authUser: AuthUser = {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        employeeId: user.employee_id ?? null,
        studentId,
        companyId: user.company_id ?? null,
        assignedBranch: resolvedBranch,
        assignedBranches,
        designation: user.designation ?? null,
        departmentName: user.department_name ?? null,
        approvalStatus: user.approval_status ?? 'Approved',
        mustChangePassword: Boolean(user.must_change_password),
        passwordChangeDismissed: Boolean(user.password_change_dismissed),
        dashboardRoute: getDashboardRouteForRole(user.role),
        dashboardPath: getDashboardPathForRole(user.role),
      };

      const remember = Boolean(rememberMe);
      const ttlMs = remember ? REMEMBER_SESSION_TTL_MS : SHORT_SESSION_TTL_MS;
      const { token } = createUserSession(db, authUser, ttlMs, remember);
      setSessionCookie(req, res, token, ttlMs, remember);

      res.json({ success: true, data: { ...authUser, token } });
    } catch {
      res.status(500).json({ success: false, error: 'Authentication failed.' });
    }
  });

  app.post('/api/auth/register', registerRateLimiter, async (req: Request, res: Response) => {
    try {
      const {
        rollNumber,
        fullName,
        email,
        phone,
        branchId,
        branch,
        graduationYear,
        academicYear,
        yearOfStudy,
        semester,
        section,
        cgpa,
        activeBacklogs,
        password,
        confirmPassword,
      } = req.body ?? {};

      const cleanRoll = String(rollNumber || '').trim().toUpperCase();
      const cleanName = String(fullName || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPhone = String(phone || '').trim();
      const cleanAcademicYear = String(academicYear || '2026-27').trim();
      const cleanSection = String(section || 'A').trim().toUpperCase() || 'A';

      if (!cleanRoll || !cleanName || !cleanEmail || !cleanPhone || (!branch && !branchId) || !graduationYear || cgpa === undefined || cgpa === '' || !password || !confirmPassword) {
        res.status(400).json({ success: false, error: 'All required student registration fields (including confirm password) must be completed.' });
        return;
      }
      if (!ROLL_NUMBER_REGEX.test(cleanRoll)) {
        res.status(400).json({ success: false, error: 'Student Roll Number must be 6–20 alphanumeric characters (e.g., 25R11A0501).' });
        return;
      }
      if (cleanName.length < 2) {
        res.status(400).json({ success: false, error: 'Full name must be at least 2 characters.' });
        return;
      }
      if (!EMAIL_REGEX.test(cleanEmail)) {
        res.status(400).json({ success: false, error: 'Please enter a valid institutional or personal email address.' });
        return;
      }
      if (!validatePhoneDigits(cleanPhone)) {
        res.status(400).json({ success: false, error: 'Mobile number must contain 10 to 15 digits.' });
        return;
      }
      const numGradYear = Number(graduationYear);
      if (!Number.isInteger(numGradYear) || numGradYear < 2020 || numGradYear > 2035) {
        res.status(400).json({ success: false, error: 'Graduation year must be between 2020 and 2035.' });
        return;
      }
      const numSemester = Number(semester) || 7;
      if (!Number.isInteger(numSemester) || numSemester < 1 || numSemester > 8) {
        res.status(400).json({ success: false, error: 'Semester must be between 1 and 8.' });
        return;
      }
      const numCgpa = Number(cgpa);
      if (Number.isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
        res.status(400).json({ success: false, error: 'CGPA must be between 0.00 and 10.00.' });
        return;
      }
      const pwdErr = validatePasswordStrength(String(password));
      if (pwdErr) {
        res.status(400).json({ success: false, error: pwdErr });
        return;
      }
      if (String(password) !== String(confirmPassword)) {
        res.status(400).json({ success: false, error: 'Password and Confirm Password do not match.' });
        return;
      }

      const db = await getDb();
      const branchRow = resolveBranchRow(db, branch ? String(branch).trim() : null, branchId ? Number(branchId) : null);

      if (!branchRow) {
        res.status(400).json({ success: false, error: 'Selected GCET branch is invalid.' });
        return;
      }

      const existingUser = queryOne(
        db,
        'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
        [cleanRoll, cleanEmail]
      );
      const existingStudent = queryOne(
        db,
        'SELECT student_id FROM students WHERE UPPER(roll_number) = UPPER(?) OR LOWER(email) = LOWER(?)',
        [cleanRoll, cleanEmail]
      );
      if (existingUser || existingStudent) {
        res.status(409).json({ success: false, error: 'An account with this roll number or email already exists.' });
        return;
      }

      const salt = generateSalt();
      const hash = hashPassword(String(password), salt);
      const computedYearOfStudy = Number(yearOfStudy) || Math.max(1, Math.min(4, Math.ceil(numSemester / 2)));

      const { userId, studentId } = executeInTransaction(db, () => {
        const userRes = executeSql(
          db,
          'INSERT INTO users (username, email, password_hash, password_salt, role, full_name, assigned_branch) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            cleanRoll.toLowerCase(),
            cleanEmail,
            hash,
            salt,
            'STUDENT',
            cleanName,
            branchRow.branch_code,
          ],
          true
        );

        const stuRes = executeSql(
          db,
          `INSERT INTO students (user_id, roll_number, full_name, email, phone, dept_id, branch_id, branch, academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, placement_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unplaced')`,
          [
            userRes.lastInsertRowid,
            cleanRoll,
            cleanName,
            cleanEmail,
            cleanPhone,
            branchRow.dept_id,
            branchRow.branch_id,
            branchRow.branch_code,
            cleanAcademicYear,
            computedYearOfStudy,
            numSemester,
            cleanSection,
            numGradYear,
            numCgpa,
            Number(activeBacklogs) || 0,
          ],
          true
        );

        return { userId: userRes.lastInsertRowid, studentId: stuRes.lastInsertRowid };
      });

      // Assign student to matching department Faculty Coordinator cleanly
      const assignedCoordinator = resolveAssignedFaculty(
        db,
        studentId,
        branchRow.branch_code,
        cleanSection
      );
      if (assignedCoordinator?.user_id) {
        executeSql(
          db,
          `INSERT INTO notifications (user_id, title, message, category, related_module)
           VALUES (?, ?, ?, 'Department Notifications', 'students')`,
          [
            assignedCoordinator.user_id,
            `New ${branchRow.branch_code} Student Registered: ${cleanRoll}`,
            `${cleanName} (${cleanRoll}, ${branchRow.branch_code}) registered and was automatically assigned to your coordinator cohort.`,
          ]
        );
      }

      await logActivity(userId, cleanName, 'STUDENT', `New ${branchRow.branch_code} student registered: ${cleanName}`);
      res.status(201).json({
        success: true,
        data: {
          registered: true,
          userId,
          studentId,
          username: cleanRoll.toLowerCase(),
          rollNumber: cleanRoll,
          email: cleanEmail,
          fullName: cleanName,
          branch: branchRow.branch_code,
          message: 'Registration successful! Please sign in with your roll number or email and password.',
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Unable to complete registration.' });
    }
  });

  app.post('/api/auth/register-recruiter', registerRateLimiter, async (req: Request, res: Response) => {
    try {
      const { companyName, industry, officialWebsite, headquarters, fullName, designation, email, phone, password, confirmPassword, username } =
        req.body ?? {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!companyName || !fullName || !cleanEmail || !password) {
        res.status(400).json({
          success: false,
          error: 'Company name, contact person, official company email, and password are required.',
        });
        return;
      }
      if (!EMAIL_REGEX.test(cleanEmail)) {
        res.status(400).json({ success: false, error: 'Please enter a valid corporate email address.' });
        return;
      }
      if (phone && !validatePhoneDigits(String(phone))) {
        res.status(400).json({ success: false, error: 'Phone number must contain 10 to 15 digits.' });
        return;
      }
      const pwdErr = validatePasswordStrength(String(password));
      if (pwdErr) {
        res.status(400).json({ success: false, error: pwdErr });
        return;
      }
      if (confirmPassword !== undefined && String(password) !== String(confirmPassword)) {
        res.status(400).json({ success: false, error: 'Password and Confirm Password do not match.' });
        return;
      }

      const db = await getDb();
      const loginName = (username || cleanEmail.split('@')[0]).trim().toLowerCase();
      const dup = queryOne(db, 'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [
        loginName,
        cleanEmail,
      ]);
      if (dup) {
        res.status(409).json({ success: false, error: 'A portal account with this email or username already exists.' });
        return;
      }

      const salt = generateSalt();
      const hash = hashPassword(String(password), salt);

      const newUserId = executeInTransaction(db, () => {
        let company = queryOne<{ company_id: number }>(
          db,
          'SELECT company_id FROM companies WHERE LOWER(company_name) = LOWER(?)',
          [String(companyName).trim()]
        );
        if (!company) {
          const compRes = executeSql(
            db,
            `INSERT INTO companies (company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
              String(companyName).trim(),
              industry || 'Technology & Engineering',
              officialWebsite || 'https://gcet.edu.in/',
              officialWebsite || 'https://gcet.edu.in/',
              headquarters || 'Hyderabad, India',
              'Recruiter-registered corporate partner awaiting Placement Cell verification.',
            ],
            true
          );
          company = { company_id: compRes.lastInsertRowid };
          executeSql(
            db,
            'INSERT INTO company_contacts (company_id, contact_person, designation, contact_email, contact_phone, is_primary) VALUES (?, ?, ?, ?, ?, 1)',
            [company.company_id, String(fullName).trim(), designation || 'Campus Recruiter', cleanEmail, phone || ''],
            true
          );
        }

        const userRes = executeSql(
          db,
          `INSERT INTO users (username, email, password_hash, password_salt, role, full_name, assigned_branch, company_id, approval_status, is_active, must_change_password)
           VALUES (?, ?, ?, ?, 'RECRUITER', ?, NULL, ?, 'Pending', 1, 0)`,
          [loginName, cleanEmail, hash, salt, String(fullName).trim(), company.company_id],
          true
        );

        executeSql(
          db,
          `INSERT INTO recruiter_profiles (user_id, company_id, contact_person, designation, phone, official_email, website, industry, approval_status, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0)`,
          [
            userRes.lastInsertRowid,
            company.company_id,
            String(fullName).trim(),
            designation || 'Campus Recruiter',
            phone || '',
            cleanEmail,
            officialWebsite || null,
            industry || 'Technology & Engineering',
          ],
          true
        );

        executeSql(
          db,
          `INSERT INTO notifications (user_id, title, message, category, related_module)
           VALUES (NULL, ?, ?, 'Placement Notifications', 'approvals')`,
          [
            `New Recruiter Approval Request: ${String(companyName).trim()}`,
            `${String(fullName).trim()} (${cleanEmail}) requested recruiter portal authorization.`,
          ],
          true
        );
        return userRes.lastInsertRowid;
      });

      await logActivity(newUserId, String(fullName).trim(), 'COMPANY', `Recruiter account pending approval: ${companyName}`);

      // Do not issue an active dashboard session yet; recruiter must wait for administrator approval
      res.status(201).json({
        success: true,
        data: {
          pendingApproval: true,
          approvalStatus: 'Pending',
          username: loginName,
          email: cleanEmail,
          companyName: String(companyName).trim(),
          message:
            'Recruiter registration submitted. Your account is Pending approval from the GCET Placement Cell / System Administrator before you can sign in.',
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Unable to complete recruiter registration.' });
    }
  });

  app.post('/api/auth/dismiss-password-prompt', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const db = await getDb();
      const user = queryOne<{
        user_id: number;
        must_change_password: number;
      }>(db, 'SELECT user_id, must_change_password FROM users WHERE user_id = ?', [req.authUser!.userId]);

      if (!user) {
        res.status(404).json({ success: false, error: 'Account not found.' });
        return;
      }

      executeSql(
        db,
        'UPDATE users SET password_change_dismissed = 1, password_change_dismissed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [user.user_id]
      );

      const updatedUser: AuthUser = {
        ...req.authUser!,
        mustChangePassword: Boolean(user.must_change_password),
        passwordChangeDismissed: true,
      };
      const remember = Boolean(req.authRememberMe);
      const ttlMs = remember ? REMEMBER_SESSION_TTL_MS : SHORT_SESSION_TTL_MS;
      const sessionId = req.authSessionId || crypto.randomBytes(24).toString('hex');
      if (!req.authSessionId) {
        executeSql(
          db,
          'INSERT INTO user_sessions (session_id, user_id, remember_me, expires_at) VALUES (?, ?, ?, ?)',
          [sessionId, user.user_id, remember ? 1 : 0, Date.now() + ttlMs]
        );
      }
      const token = createAuthToken(updatedUser, ttlMs, getSessionSecret(db), sessionId, remember);
      setSessionCookie(req, res, token, ttlMs, remember);

      await logActivity(
        user.user_id,
        updatedUser.fullName,
        updatedUser.role === 'RECRUITER' ? 'COMPANY' : 'STUDENT',
        `Dismissed first-login password prompt for @${updatedUser.username} (temporary password remains active)`
      );

      res.json({
        success: true,
        data: {
          ...updatedUser,
          token,
          message: 'Password prompt dismissed. You can update your temporary password anytime in Settings.',
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Unable to persist password prompt dismissal.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      const pwdErr = validatePasswordStrength(String(newPassword || ''));
      if (pwdErr) {
        res.status(400).json({ success: false, error: pwdErr });
        return;
      }
      if (currentPassword && String(newPassword) === String(currentPassword)) {
        res.status(400).json({ success: false, error: 'New password must differ from your current password.' });
        return;
      }
      const db = await getDb();
      const user = queryOne<{
        user_id: number;
        username: string;
        email: string;
        password_hash: string;
        password_salt: string;
        role: UserRole;
        full_name: string;
        employee_id: string | null;
        assigned_branch: string | null;
        company_id: number | null;
        approval_status: 'Approved' | 'Pending' | 'Rejected';
        must_change_password: number;
      }>(db, 'SELECT * FROM users WHERE user_id = ?', [req.authUser!.userId]);

      if (!user) {
        res.status(404).json({ success: false, error: 'Account not found.' });
        return;
      }
      if (!currentPassword || !verifyPassword(String(currentPassword), user.password_hash, user.password_salt)) {
        res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        return;
      }

      const salt = generateSalt();
      const hash = hashPassword(String(newPassword), salt);
      executeSql(
        db,
        'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, password_change_dismissed = 0, password_change_dismissed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [hash, salt, user.user_id]
      );
      executeSql(db, 'DELETE FROM user_sessions WHERE user_id = ?', [user.user_id]);
      executeSql(db, 'DELETE FROM login_attempts WHERE identifier IN (?, ?, ?, ?)', [
        `user:${user.user_id}`,
        user.username.toLowerCase(),
        user.email.toLowerCase(),
        (user.employee_id || '').toLowerCase(),
      ]);
      executeSql(
        db,
        "INSERT INTO password_reset_requests (user_id, email, status, completed_at) VALUES (?, ?, 'Completed', CURRENT_TIMESTAMP)",
        [user.user_id, user.email]
      );

      const updatedUser: AuthUser = {
        ...req.authUser!,
        mustChangePassword: false,
        passwordChangeDismissed: false,
      };
      const remember = Boolean(req.authRememberMe);
      const ttlMs = remember ? REMEMBER_SESSION_TTL_MS : SHORT_SESSION_TTL_MS;
      const { token } = createUserSession(db, updatedUser, ttlMs, remember);
      setSessionCookie(req, res, token, ttlMs, remember);

      res.json({
        success: true,
        data: { ...updatedUser, token, message: 'Password updated securely with BCrypt.' },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Unable to update password.' });
    }
  });

  app.post('/api/auth/forgot-password', resetRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body ?? {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        res.status(400).json({ success: false, error: 'Valid institutional email address is required.' });
        return;
      }
      const pwdErr = validatePasswordStrength(String(newPassword || ''));
      if (pwdErr) {
        res.status(400).json({ success: false, error: pwdErr });
        return;
      }
      const db = await getDb();
      const user = queryOne<{ user_id: number; username: string; email: string; employee_id: string | null }>(
        db,
        'SELECT user_id, username, email, employee_id FROM users WHERE LOWER(email) = LOWER(?)',
        [cleanEmail]
      );
      if (!user) {
        res.status(404).json({ success: false, error: 'No portal account found for this email.' });
        return;
      }
      const salt = generateSalt();
      const hash = hashPassword(String(newPassword), salt);
      executeSql(
        db,
        'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, password_change_dismissed = 0, password_change_dismissed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [hash, salt, user.user_id]
      );
      executeSql(db, 'DELETE FROM user_sessions WHERE user_id = ?', [user.user_id]);
      executeSql(db, 'DELETE FROM login_attempts WHERE identifier IN (?, ?, ?, ?)', [
        `user:${user.user_id}`,
        user.email.toLowerCase(),
        user.username.toLowerCase(),
        (user.employee_id || '').toLowerCase(),
      ]);
      executeSql(
        db,
        "INSERT INTO password_reset_requests (user_id, email, status, completed_at) VALUES (?, ?, 'Completed', CURRENT_TIMESTAMP)",
        [user.user_id, user.email]
      );
      res.json({ success: true, data: { message: 'Password updated successfully. You may now sign in.' } });
    } catch {
      res.status(500).json({ success: false, error: 'Password reset failed.' });
    }
  });

  const handleLogoutRoute = async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const token = getRequestToken(req);
      const decoded = verifyAuthToken(token, getSessionSecret(db));
      if (decoded?.jti) {
        executeSql(db, 'DELETE FROM user_sessions WHERE session_id = ?', [decoded.jti]);
      }
    } catch {
      // ignore session cleanup error on logout
    }
    clearSessionCookie(req, res);
    res.json({ success: true, data: { message: 'Signed out.' } });
  };
  app.post('/api/auth/logout', handleLogoutRoute);
  app.get('/api/auth/logout', handleLogoutRoute);

  // ---------------- ADMIN ACCOUNT & FACULTY MANAGEMENT ----------------
  app.get('/api/admin/users', requireAuth, requireSystemAdmin, async (_req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const users = queryAll<{
      user_id: number;
      username: string;
      email: string;
      role: UserRole;
      full_name: string;
      employee_id: string | null;
      assigned_branch: string | null;
      designation: string | null;
      department_name: string | null;
      company_id: number | null;
      company_name: string | null;
      approval_status: string;
      is_active: number;
      must_change_password: number;
      password_change_dismissed: number;
      password_change_dismissed_at: string | null;
      last_login: string | null;
      created_at: string;
    }>(
      db,
      `SELECT u.user_id, u.username, u.email, u.role, u.full_name, u.employee_id, u.assigned_branch,
              u.designation, u.department_name,
              u.company_id, c.company_name, u.approval_status, u.is_active, u.must_change_password,
              u.password_change_dismissed, u.password_change_dismissed_at,
              u.last_login, u.created_at
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.company_id
       WHERE NOT (u.role IN ('FACULTY', 'FACULTY_COORDINATOR') AND LOWER(u.username) NOT IN ('faculty_lavanya', 'faculty_aparna', 'faculty_rajashakar'))
       ORDER BY CASE u.role
         WHEN 'CHAIRMAN' THEN 1
         WHEN 'VICE_CHAIRMAN' THEN 2
         WHEN 'PRINCIPAL' THEN 3
         WHEN 'ADMIN' THEN 4
         WHEN 'PLACEMENT_OFFICER' THEN 5
         WHEN 'FACULTY_COORDINATOR' THEN 6
         WHEN 'FACULTY' THEN 7
         WHEN 'RECRUITER' THEN 8
         ELSE 9 END, u.user_id ASC`
    );
    const locks = queryAll<{ identifier: string; attempt_count: number; locked_until: string | null }>(
      db,
      'SELECT identifier, attempt_count, locked_until FROM login_attempts WHERE locked_until IS NOT NULL'
    );
    const lockSet = new Set(
      locks
        .filter((l) => l.locked_until && new Date(l.locked_until).getTime() > Date.now())
        .map((l) => l.identifier.toLowerCase())
    );
    const enriched = users.map((u) => {
      const assignedBranches = isFacultyRole(u.role)
        ? getFacultyAssignedBranches(db, u.user_id, u.assigned_branch)
        : undefined;
      return {
        ...u,
        assigned_branches: assignedBranches,
        is_locked:
          lockSet.has(`user:${u.user_id}`) ||
          lockSet.has(String(u.username).toLowerCase()) ||
          lockSet.has(String(u.email).toLowerCase()) ||
          (u.employee_id ? lockSet.has(String(u.employee_id).toLowerCase()) : false),
      };
    });
    res.json({ success: true, data: enriched });
  });

  // Official 3-Coordinator Faculty Directory & Audit Stats (Admin/Executive Only)
  app.get('/api/admin/faculty', requireAuth, requireSystemAdmin, async (_req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const coordinators = queryAll<{
      user_id: number;
      username: string;
      email: string;
      role: UserRole;
      full_name: string;
      employee_id: string | null;
      assigned_branch: string | null;
      designation: string | null;
      department_name: string | null;
      is_active: number;
      last_login: string | null;
      created_at: string;
    }>(
      db,
      `SELECT user_id, username, email, role, full_name, employee_id, assigned_branch, designation, department_name,
              is_active, last_login, created_at
       FROM users
       WHERE LOWER(username) IN ('faculty_lavanya', 'faculty_aparna', 'faculty_rajashakar')
         AND role IN ('FACULTY', 'FACULTY_COORDINATOR')
       ORDER BY CASE LOWER(username)
         WHEN 'faculty_lavanya' THEN 1
         WHEN 'faculty_aparna' THEN 2
         WHEN 'faculty_rajashakar' THEN 3
         ELSE 4 END`
    );

    const allStudents = queryAll<{ student_id: number; branch: string; placement_status: string }>(
      db,
      'SELECT student_id, branch, placement_status FROM students'
    );

    const result = coordinators.map((c) => {
      const assignedBranches = getFacultyAssignedBranches(db, c.user_id, c.assigned_branch);
      const matchingStudents = allStudents.filter((st) => branchMatchesFacultyScope(st.branch, assignedBranches));
      const matchingStudentIds = matchingStudents.map((s) => s.student_id);

      let pendingApprovalsCount = 0;
      let approvedProfilesCount = 0;
      let rejectedProfilesCount = 0;
      let correctionRequestedCount = 0;
      let recentApprovals: Record<string, unknown>[] = [];

      if (matchingStudentIds.length > 0) {
        const placeholders = matchingStudentIds.map(() => '?').join(',');
        pendingApprovalsCount =
          queryOne<{ c: number }>(
            db,
            `SELECT COUNT(*) AS c FROM profile_submissions WHERE student_id IN (${placeholders}) AND status = 'WAITING_FOR_APPROVAL'`,
            matchingStudentIds
          )?.c ?? 0;
        approvedProfilesCount =
          queryOne<{ c: number }>(
            db,
            `SELECT COUNT(*) AS c FROM profile_submissions WHERE student_id IN (${placeholders}) AND status = 'APPROVED'`,
            matchingStudentIds
          )?.c ?? 0;
        rejectedProfilesCount =
          queryOne<{ c: number }>(
            db,
            `SELECT COUNT(*) AS c FROM profile_submissions WHERE student_id IN (${placeholders}) AND status = 'REJECTED'`,
            matchingStudentIds
          )?.c ?? 0;
        correctionRequestedCount =
          queryOne<{ c: number }>(
            db,
            `SELECT COUNT(*) AS c FROM profile_submissions WHERE student_id IN (${placeholders}) AND status = 'CORRECTION_REQUESTED'`,
            matchingStudentIds
          )?.c ?? 0;
        recentApprovals = queryAll(
          db,
          `SELECT pah.*, ps.submission_code, s.full_name AS student_name, s.roll_number, s.branch
           FROM profile_approval_history pah
           LEFT JOIN profile_submissions ps ON pah.submission_id = ps.submission_id
           LEFT JOIN students s ON pah.student_id = s.student_id
           WHERE pah.faculty_user_id = ? OR pah.student_id IN (${placeholders})
           ORDER BY pah.history_id DESC
           LIMIT 8`,
          [c.user_id, ...matchingStudentIds]
        );
      }

      const activityLogs = queryAll(
        db,
        'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 8',
        [c.user_id]
      );

      return {
        ...c,
        assigned_branches: assignedBranches,
        assignedStudentCount: matchingStudents.length,
        placedStudentCount: matchingStudents.filter((s) => s.placement_status === 'Placed').length,
        pendingApprovalsCount,
        approvedProfilesCount,
        rejectedProfilesCount,
        correctionRequestedCount,
        recentApprovals,
        activityLogs,
      };
    });

    res.json({ success: true, data: result });
  });

  // Protect department assignments from unauthorized faculty self-modification
  app.put('/api/faculty/assignments', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role !== 'ADMIN' && !isExecutiveRole(req.authUser?.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Only System Administrators or Executive Management may modify faculty department assignments.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: 'The 3 official GCET Faculty Coordinators and their department scopes are locked by institutional policy.',
    });
  });

  app.post('/api/admin/users', requireAuth, requireAdminOnly, async (req: AuthedRequest, res: Response) => {
    try {
      const { fullName, username, email, employeeId, role, assignedBranch, temporaryPassword } = req.body ?? {};
      const allowedCreateRoles: UserRole[] = ['PLACEMENT_OFFICER', 'ADMIN'];
      if (!fullName || !email || !temporaryPassword) {
        res.status(400).json({
          success: false,
          error: 'Full name, institutional email, and temporary password are required.',
        });
        return;
      }
      const pwdErr = validatePasswordStrength(String(temporaryPassword));
      if (pwdErr) {
        res.status(400).json({ success: false, error: pwdErr });
        return;
      }
      const targetRole = (role || 'PLACEMENT_OFFICER') as UserRole;
      if (isFacultyRole(targetRole)) {
        res.status(403).json({
          success: false,
          error: 'GCET Faculty Coordinator directory is strictly standardized to the 3 official coordinators (B. Laxmi Lavanya, P. Aparna, and S. Raja Shakar Reddy).',
        });
        return;
      }
      if (!allowedCreateRoles.includes(targetRole)) {
        res.status(400).json({ success: false, error: 'Unsupported role for staff account creation.' });
        return;
      }
      const db = await getDb();
      const loginName = (username || String(email).split('@')[0]).trim().toLowerCase();
      const dup = queryOne(
        db,
        'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
        [loginName, String(email).trim()]
      );
      if (dup) {
        res.status(409).json({ success: false, error: 'An account with this username or email already exists.' });
        return;
      }
      const salt = generateSalt();
      const hash = hashPassword(String(temporaryPassword), salt);
      const empCode = employeeId ? String(employeeId).trim().toUpperCase() : null;
      const ins = executeSql(
        db,
        `INSERT INTO users (username, email, password_hash, password_salt, role, full_name, employee_id, assigned_branch, approval_status, is_active, must_change_password, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved', 1, 1, ?)`,
        [
          loginName,
          String(email).trim(),
          hash,
          salt,
          targetRole,
          String(fullName).trim(),
          empCode,
          assignedBranch || null,
          req.authUser!.userId,
        ]
      );
      await logActivity(
        req.authUser!.userId,
        req.authUser!.fullName,
        'STUDENT',
        `Created ${targetRole.replace('_', ' ')} account for ${String(fullName).trim()} (${loginName})`
      );
      const created = queryOne(
        db,
        'SELECT user_id, username, email, role, full_name, employee_id, assigned_branch, approval_status, is_active, must_change_password, created_at FROM users WHERE user_id = ?',
        [ins.lastInsertRowid]
      );
      res.status(201).json({ success: true, data: created });
    } catch {
      res.status(500).json({ success: false, error: 'Unable to create institutional user account.' });
    }
  });

  app.put('/api/admin/users/:id/status', requireAuth, requireAdminOrChairman, async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const isActive = req.body?.isActive ? 1 : 0;
    if (id === req.authUser?.userId && !isActive) {
      res.status(400).json({ success: false, error: 'You cannot deactivate your own active administrator session.' });
      return;
    }
    const db = await getDb();
    const target = queryOne<{ user_id: number; full_name: string }>(db, 'SELECT user_id, full_name FROM users WHERE user_id = ?', [id]);
    if (!target) {
      res.status(404).json({ success: false, error: 'User account not found.' });
      return;
    }
    executeSql(db, 'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [isActive, id]);
    executeSql(db, 'UPDATE faculty SET is_active = ? WHERE user_id = ?', [isActive, id]);
    if (!isActive) {
      executeSql(db, 'DELETE FROM user_sessions WHERE user_id = ?', [id]);
    }
    await logActivity(
      req.authUser!.userId,
      req.authUser!.fullName,
      'STUDENT',
      `${isActive ? 'Activated' : 'Deactivated'} user account: ${target.full_name}`
    );
    res.json({ success: true, data: { updated: true, isActive: Boolean(isActive) } });
  });

  app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdminOnly, async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const { newPassword } = req.body ?? {};
    const pwdErr = validatePasswordStrength(String(newPassword || ''));
    if (pwdErr) {
      res.status(400).json({ success: false, error: pwdErr });
      return;
    }
    const db = await getDb();
    const target = queryOne<{ user_id: number; username: string; email: string; employee_id: string | null }>(
      db,
      'SELECT user_id, username, email, employee_id FROM users WHERE user_id = ?',
      [id]
    );
    if (!target) {
      res.status(404).json({ success: false, error: 'User account not found.' });
      return;
    }
    const salt = generateSalt();
    const hash = hashPassword(String(newPassword), salt);
    executeSql(
      db,
      'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, password_change_dismissed = 0, password_change_dismissed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [hash, salt, id]
    );
    executeSql(db, 'DELETE FROM user_sessions WHERE user_id = ?', [id]);
    executeSql(db, 'DELETE FROM login_attempts WHERE identifier IN (?, ?, ?, ?)', [
      `user:${id}`,
      target.username.toLowerCase(),
      target.email.toLowerCase(),
      (target.employee_id || '').toLowerCase(),
    ]);
    executeSql(
      db,
      "INSERT INTO password_reset_requests (user_id, email, status, completed_at) VALUES (?, ?, 'Completed', CURRENT_TIMESTAMP)",
      [target.user_id, target.email]
    );
    res.json({ success: true, data: { message: 'Temporary password set. User will be prompted to change password on next sign-in.' } });
  });

  app.post('/api/admin/users/:id/unlock', requireAuth, requireAdminOnly, async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const db = await getDb();
    const target = queryOne<{ username: string; email: string; employee_id: string | null }>(
      db,
      'SELECT username, email, employee_id FROM users WHERE user_id = ?',
      [id]
    );
    if (!target) {
      res.status(404).json({ success: false, error: 'User account not found.' });
      return;
    }
    executeSql(db, 'DELETE FROM login_attempts WHERE identifier IN (?, ?, ?, ?)', [
      `user:${id}`,
      target.username.toLowerCase(),
      target.email.toLowerCase(),
      (target.employee_id || '').toLowerCase(),
    ]);
    res.json({ success: true, data: { unlocked: true } });
  });

  // Real DB Health Check
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const tables = queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table'")?.c ?? 0;
      res.json({
        success: true,
        data: {
          status: 'Connected',
          engine: 'Relational SQL (MySQL-Compatible Schema)',
          tables,
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Database connection unavailable.' });
    }
  });

  // Admin System Status, Sync Logs & Configurable Scheduler Interval
  app.get('/api/admin/system-status', requireAuth, requirePlacementStaff, async (_req: AuthedRequest, res: Response) => {
    try {
      const db = await getDb();
      const students = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM students')?.c ?? 0;
      const faculty = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM faculty WHERE is_active = 1')?.c ?? 0;
      const companies = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM companies')?.c ?? 0;
      const drives = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM placement_drives')?.c ?? 0;
      const applications = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM applications')?.c ?? 0;
      const placements = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM placements')?.c ?? 0;
      const announcements = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM announcements WHERE is_archived = 0')?.c ?? 0;
      const notifications = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM notifications')?.c ?? 0;
      const unreadNotifications = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0')?.c ?? 0;

      const zipPath = path.resolve(process.cwd(), 'public', 'downloads', 'gcet-placement-hub-java.zip');
      let javaZipAvailable = false;
      let javaZipSizeBytes = 0;
      if (fs.existsSync(zipPath)) {
        const stat = fs.statSync(zipPath);
        javaZipAvailable = stat.isFile() && stat.size > 0;
        javaZipSizeBytes = stat.size;
      }

      res.json({
        success: true,
        data: {
          databaseConnected: true,
          databaseEngine: 'SQLite Relational Engine (MySQL 8 / JDBC PreparedStatement Parity)',
          checkedAt: new Date().toISOString(),
          javaZipAvailable,
          javaZipSizeBytes,
          counts: {
            students,
            faculty,
            companies,
            drives,
            applications,
            placements,
            announcements,
            notifications,
            unreadNotifications,
          },
          syncHealth: getSyncHealthSummary(db),
        },
      });
    } catch {
      res.status(500).json({ success: false, error: 'Unable to retrieve system status.' });
    }
  });

  app.put('/api/admin/system-status/sync-interval', requireAuth, requireAdminOnly, async (req: AuthedRequest, res: Response) => {
    const minutes = Number(req.body?.syncIntervalMinutes);
    if (!Number.isFinite(minutes) || minutes < 15 || minutes > 1440) {
      res.status(400).json({ success: false, error: 'Sync interval must be between 15 and 1440 minutes.' });
      return;
    }
    const db = await getDb();
    executeSql(
      db,
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES ('sync_interval_minutes', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`,
      [String(Math.round(minutes))]
    );
    executeSql(db, 'UPDATE announcement_sources SET sync_interval_minutes = ?', [Math.round(minutes)]);
    await logActivity(
      req.authUser?.userId ?? null,
      req.authUser?.fullName ?? 'Admin',
      'ANNOUNCEMENT',
      `Updated automated announcement sync interval to ${Math.round(minutes)} minutes`
    );
    res.json({ success: true, data: { syncIntervalMinutes: Math.round(minutes), syncHealth: getSyncHealthSummary(db) } });
  });

  // Downloadable VS Code-Ready Java Full-Stack Project (.ZIP)
  app.get('/api/download/java-project', requireAuth, async (_req: AuthedRequest, res: Response) => {
    const zipPath = path.resolve(process.cwd(), 'public', 'downloads', 'gcet-placement-hub-java.zip');
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ success: false, error: 'Java Full-Stack ZIP bundle is not yet generated.' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="gcet-placement-hub-java.zip"');
    res.sendFile(zipPath);
  });

  // Public overview stats for Login & Public Landing Page (zero student PII)
  app.get('/api/public-stats', async (_req: Request, res: Response) => {
    const db = await getDb();
    const totalStudents = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM students')?.c ?? 0;
    const registeredCompanies = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM companies')?.c ?? 0;
    const activeDrives =
      queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM placement_drives WHERE drive_status = 'Active' AND approval_status = 'Approved'")?.c ?? 0;
    const totalBranches = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM branches WHERE is_active = 1')?.c ?? 0;
    const totalAnnouncements = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM announcements WHERE is_archived = 0')?.c ?? 0;
    const studentsPlaced = queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM students WHERE placement_status = 'Placed'")?.c ?? 0;
    res.json({
      success: true,
      data: { totalStudents, registeredCompanies, activeDrives, totalBranches, totalAnnouncements, studentsPlaced },
    });
  });

  app.get('/api/public-overview', async (_req: Request, res: Response) => {
    const db = await getDb();
    const totalStudents = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM students')?.c ?? 0;
    const registeredCompanies = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM companies')?.c ?? 0;
    const activeDrives =
      queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM placement_drives WHERE drive_status = 'Active' AND approval_status = 'Approved'")?.c ?? 0;
    const totalBranches = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM branches WHERE is_active = 1')?.c ?? 0;
    const totalAnnouncements = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM announcements WHERE is_archived = 0')?.c ?? 0;
    const studentsPlaced = queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM students WHERE placement_status = 'Placed'")?.c ?? 0;

    const branches = queryAll(
      db,
      `SELECT b.*, d.dept_code, d.dept_name, d.hod_name
       FROM branches b
       JOIN departments d ON b.dept_id = d.dept_id
       WHERE b.is_active = 1
       ORDER BY b.branch_id ASC`
    );

    const companies = queryAll(
      db,
      `SELECT company_id, company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference
       FROM companies ORDER BY company_name ASC`
    );

    const announcements = queryAll(
      db,
      `SELECT a.announcement_id, a.title, a.category_id, ac.category_name, a.source_name, a.source_url, a.published_date, a.description, a.relevant_branches, a.department_code, a.academic_year, a.deadline_date, a.priority, a.is_pinned, a.is_verified_source
       FROM announcements a
       JOIN announcement_categories ac ON a.category_id = ac.category_id
       WHERE a.is_archived = 0
       ORDER BY a.is_pinned DESC, a.published_date DESC LIMIT 6`
    );

    const drives = queryAll(
      db,
      `SELECT pd.drive_id, pd.company_id, c.company_name, c.industry, pd.job_role, pd.job_description, pd.job_location, pd.job_type, pd.salary_package, pd.compensation_label, pd.apply_url, pd.posted_date, pd.drive_date, pd.application_deadline, pd.drive_status,
              de.min_cgpa, de.eligible_branches, de.graduation_year, de.max_backlogs
       FROM placement_drives pd
       JOIN companies c ON pd.company_id = c.company_id
       LEFT JOIN drive_eligibility de ON pd.drive_id = de.drive_id
       WHERE pd.approval_status = 'Approved' AND pd.drive_status IN ('Active', 'Planned')
       ORDER BY pd.drive_date ASC LIMIT 6`
    );

    res.json({
      success: true,
      data: {
        stats: { totalStudents, registeredCompanies, activeDrives, totalBranches, totalAnnouncements, studentsPlaced },
        branches,
        companies,
        announcements,
        drives,
      },
    });
  });

  // ---------------- BRANCHES & DEPARTMENTS ----------------
  app.get('/api/public-branches', async (_req: Request, res: Response) => {
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT b.*, d.dept_code, d.dept_name, d.hod_name
       FROM branches b
       JOIN departments d ON b.dept_id = d.dept_id
       WHERE b.is_active = 1
       ORDER BY b.branch_id ASC`
    );
    res.json({ success: true, data: rows });
  });

  app.get('/api/departments', requireAuth, async (_req: Request, res: Response) => {
    const db = await getDb();
    res.json({ success: true, data: queryAll(db, 'SELECT * FROM departments ORDER BY dept_id ASC') });
  });

  app.get('/api/branches', requireAuth, async (_req: Request, res: Response) => {
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT b.*, d.dept_code, d.dept_name, d.hod_name,
              (SELECT COUNT(*) FROM students s WHERE s.branch = b.branch_code) AS studentCount,
              (SELECT COUNT(*) FROM students s WHERE s.branch = b.branch_code AND s.placement_status = 'Placed') AS placedCount
       FROM branches b
       JOIN departments d ON b.dept_id = d.dept_id
       ORDER BY b.branch_id ASC`
    );
    res.json({ success: true, data: rows });
  });

  app.post('/api/branches', requireAuth, requireApprovingAuthority, async (req: AuthedRequest, res: Response) => {
    const { deptId, branchCode, branchName, degreeLevel } = req.body ?? {};
    if (!deptId || !branchCode || !branchName) {
      res.status(400).json({ success: false, error: 'Department, branch code, and branch name are required.' });
      return;
    }
    const db = await getDb();
    const dup = queryOne(db, 'SELECT branch_id FROM branches WHERE UPPER(branch_code) = UPPER(?)', [String(branchCode).trim()]);
    if (dup) {
      res.status(409).json({ success: false, error: 'Branch code already exists.' });
      return;
    }
    const ins = executeSql(
      db,
      'INSERT INTO branches (dept_id, branch_code, branch_name, degree_level, is_active) VALUES (?, ?, ?, ?, 1)',
      [Number(deptId), String(branchCode).trim(), String(branchName).trim(), degreeLevel || 'B.Tech']
    );
    await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Admin', 'STUDENT', `Added branch ${branchCode}`);
    res.status(201).json({ success: true, data: queryOne(db, 'SELECT * FROM branches WHERE branch_id = ?', [ins.lastInsertRowid]) });
  });

  app.put('/api/branches/:id', requireAuth, requireApprovingAuthority, async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const { deptId, branchCode, branchName, degreeLevel, isActive } = req.body ?? {};
    const db = await getDb();
    executeSql(
      db,
      'UPDATE branches SET dept_id = COALESCE(?, dept_id), branch_code = COALESCE(?, branch_code), branch_name = COALESCE(?, branch_name), degree_level = COALESCE(?, degree_level), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP WHERE branch_id = ?',
      [deptId ? Number(deptId) : null, branchCode ?? null, branchName ?? null, degreeLevel ?? null, isActive !== undefined ? (isActive ? 1 : 0) : null, id]
    );
    res.json({ success: true, data: queryOne(db, 'SELECT * FROM branches WHERE branch_id = ?', [id]) });
  });

  app.delete('/api/branches/:id', requireAuth, requireAdminOnly, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const db = await getDb();
    const linked = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM students WHERE branch_id = ?', [id])?.c ?? 0;
    if (linked > 0) {
      res.status(400).json({ success: false, error: 'Cannot delete branch with enrolled students. Deactivate it instead.' });
      return;
    }
    executeSql(db, 'DELETE FROM branches WHERE branch_id = ?', [id]);
    res.json({ success: true, data: { deleted: true } });
  });

  // ---------------- ANALYTICS & DASHBOARD ----------------
  app.get('/api/faculty/dashboard', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Faculty Coordinator or Placement Administration access required.' });
      return;
    }

    const db = await getDb();
    const assignedBranches = isFacultyRole(authUser.role)
      ? getFacultyAssignedBranches(db, authUser.userId, authUser.assignedBranch)
      : [];

    const allStudents = queryAll<StudentRecord & { created_at?: string; dept_code?: string; dept_name?: string }>(
      db,
      `SELECT s.*, d.dept_code, d.dept_name
       FROM students s
       JOIN departments d ON s.dept_id = d.dept_id
       ORDER BY s.student_id DESC`
    );

    const scopedStudents = isFacultyRole(authUser.role)
      ? allStudents.filter((s) => branchMatchesFacultyScope(s.branch, assignedBranches))
      : allStudents;

    const studentIds = scopedStudents.map((s) => s.student_id);
    let pendingApprovals = 0;
    let approvedProfiles = 0;
    let rejectedSubmissions = 0;
    let correctionRequests = 0;
    let skillDistribution: Record<string, unknown>[] = [];

    if (studentIds.length > 0) {
      const ph = studentIds.map(() => '?').join(',');
      const latestSubs = queryAll<{ student_id: number; status: string }>(
        db,
        `SELECT ps.student_id, ps.status
         FROM profile_submissions ps
         WHERE ps.submission_id IN (
           SELECT MAX(submission_id) FROM profile_submissions WHERE student_id IN (${ph}) GROUP BY student_id
         )`,
        studentIds
      );
      const subMap = new Map(latestSubs.map((r) => [r.student_id, r.status]));
      for (const sid of studentIds) {
        const stStatus = subMap.get(sid);
        if (stStatus === 'WAITING_FOR_APPROVAL') pendingApprovals++;
        else if (stStatus === 'REJECTED') rejectedSubmissions++;
        else if (stStatus === 'CORRECTION_REQUESTED') correctionRequests++;
        else if (stStatus === 'APPROVED') approvedProfiles++;
      }

      skillDistribution = queryAll(
        db,
        `SELECT sk.skill_name AS label, sk.category, COUNT(ss.student_id) AS count,
                ROUND(COALESCE(AVG(ss.proficiency_level), 0), 2) AS avgLevel
         FROM student_skills ss
         JOIN skills sk ON ss.skill_id = sk.skill_id
         WHERE ss.student_id IN (${ph})
         GROUP BY sk.skill_id, sk.skill_name, sk.category
         ORDER BY count DESC, sk.skill_name ASC
         LIMIT 10`,
        studentIds
      );
    }

    const branchBreakdown = (assignedBranches.length > 0
      ? assignedBranches
      : Array.from(new Set(scopedStudents.map((s) => s.branch)))
    ).map((branchLabel) => {
      const members = scopedStudents.filter((s) => branchMatchesFacultyScope(s.branch, [branchLabel]));
      return {
        branch: branchLabel,
        label: branchLabel,
        count: members.length,
        placed: members.filter((s) => s.placement_status === 'Placed').length,
      };
    });

    const recentRegistrations = scopedStudents.slice(0, 8).map((s) => ({
      student_id: s.student_id,
      roll_number: s.roll_number,
      full_name: s.full_name,
      branch: s.branch,
      section: s.section || 'A',
      cgpa: s.cgpa,
      placement_status: s.placement_status,
      created_at: s.created_at || '',
    }));

    const recentNotifications = queryAll(
      db,
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT 8`,
      [authUser.userId]
    );

    res.json({
      success: true,
      data: {
        coordinator: {
          userId: authUser.userId,
          fullName: authUser.fullName,
          username: authUser.username,
          email: authUser.email,
          employeeId: authUser.employeeId || null,
          designation: authUser.designation || 'Faculty Coordinator',
          departmentName: authUser.departmentName || authUser.assignedBranch || 'Department Coordinator',
          assignedBranches,
        },
        totalAssignedStudents: scopedStudents.length,
        placedAssignedStudents: scopedStudents.filter((s) => s.placement_status === 'Placed').length,
        pendingApprovals,
        approvedProfiles,
        rejectedSubmissions,
        correctionRequests,
        recentRegistrations,
        recentNotifications,
        branchBreakdown,
        skillDistribution,
      },
    });
  });

  app.get('/api/analytics', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const authUser = req.authUser!;
    if (authUser.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters must use company-scoped recruiter analytics.' });
      return;
    }
    const branchFilter = req.query.branch ? String(req.query.branch).trim() : null;

    if (isFacultyRole(authUser.role)) {
      const assignedBranches = getFacultyAssignedBranches(db, authUser.userId, authUser.assignedBranch);
      if (branchFilter && !branchMatchesFacultyScope(branchFilter, assignedBranches)) {
        res.status(403).json({
          success: false,
          error: `Access denied: branch "${branchFilter}" is outside your assigned department scope.`,
        });
        return;
      }

      const allStudents = queryAll<StudentRecord & { branch_name?: string }>(
        db,
        'SELECT * FROM students'
      );
      const scopedStudents = allStudents.filter((s) => {
        const inScope = branchMatchesFacultyScope(s.branch, assignedBranches);
        if (!inScope) return false;
        return branchFilter ? branchMatchesFacultyScope(s.branch, [branchFilter]) : true;
      });
      const studentIds = scopedStudents.map((s) => s.student_id);
      const ph = studentIds.map(() => '?').join(',');

      const totalStudents = scopedStudents.length;
      const studentsPlaced = scopedStudents.filter((s) => s.placement_status === 'Placed').length;
      const eligibleStudents = scopedStudents.filter((s) => Number(s.cgpa) >= 7.0 && Number(s.active_backlogs) === 0).length;
      const registeredCompanies = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM companies')?.c ?? 0;
      const activeDrives =
        queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM placement_drives WHERE drive_status = 'Active' AND approval_status = 'Approved'")?.c ?? 0;
      const totalApplications =
        studentIds.length > 0
          ? queryOne<{ c: number }>(db, `SELECT COUNT(*) AS c FROM applications WHERE student_id IN (${ph})`, studentIds)?.c ?? 0
          : 0;
      const upcomingInterviews =
        studentIds.length > 0
          ? queryOne<{ c: number }>(db, `SELECT COUNT(*) AS c FROM applications WHERE student_id IN (${ph}) AND status = 'Interview'`, studentIds)?.c ?? 0
          : 0;
      const pendingApprovals =
        studentIds.length > 0
          ? queryOne<{ c: number }>(
              db,
              `SELECT COUNT(*) AS c FROM profile_submissions WHERE student_id IN (${ph}) AND status = 'WAITING_FOR_APPROVAL'`,
              studentIds
            )?.c ?? 0
          : 0;
      const totalAnnouncements = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM announcements WHERE is_archived = 0')?.c ?? 0;

      const branchDistribution = assignedBranches.map((code) => {
        const members = scopedStudents.filter((s) => branchMatchesFacultyScope(s.branch, [code]));
        return {
          label: code,
          branch_name: code,
          degree_level: 'B.Tech',
          count: members.length,
          placed: members.filter((s) => s.placement_status === 'Placed').length,
        };
      });

      const skillDistribution =
        studentIds.length > 0
          ? queryAll(
              db,
              `SELECT s.skill_name AS label, s.category, COUNT(ss.student_id) AS count,
                      ROUND(COALESCE(AVG(ss.proficiency_level), 0), 2) AS avgLevel
               FROM skills s
               LEFT JOIN student_skills ss ON s.skill_id = ss.skill_id AND ss.student_id IN (${ph})
               GROUP BY s.skill_id, s.skill_name, s.category
               ORDER BY count DESC, s.skill_name ASC`,
              studentIds
            )
          : [];

      const applicationOutcomes =
        studentIds.length > 0
          ? queryAll(db, `SELECT status AS label, COUNT(*) AS count FROM applications WHERE student_id IN (${ph}) GROUP BY status`, studentIds)
          : [];

      const companyPlacements =
        studentIds.length > 0
          ? queryAll(
              db,
              `SELECT c.company_name AS label, COUNT(p.placement_id) AS count,
                      ROUND(COALESCE(AVG(p.package_lpa), 0), 2) AS avgPackage
               FROM companies c
               LEFT JOIN placements p ON c.company_id = p.company_id AND p.student_id IN (${ph})
               GROUP BY c.company_id, c.company_name
               ORDER BY count DESC, c.company_name ASC`,
              studentIds
            )
          : [];

      const upcomingDrives = queryAll(
        db,
        `SELECT pd.drive_id, c.company_name, pd.job_role, pd.job_type, pd.job_location, pd.salary_package, pd.compensation_label, pd.drive_date, pd.application_deadline, pd.drive_status
         FROM placement_drives pd
         JOIN companies c ON pd.company_id = c.company_id
         WHERE pd.approval_status = 'Approved' AND pd.drive_status IN ('Active', 'Planned')
         ORDER BY pd.drive_date ASC LIMIT 6`
      );

      const recentApplications =
        studentIds.length > 0
          ? queryAll(
              db,
              `SELECT a.application_id, s.full_name AS student_name, s.roll_number, s.branch,
                      c.company_name, pd.job_role, a.status, a.applied_at
               FROM applications a
               JOIN students s ON a.student_id = s.student_id
               JOIN placement_drives pd ON a.drive_id = pd.drive_id
               JOIN companies c ON pd.company_id = c.company_id
               WHERE a.student_id IN (${ph})
               ORDER BY a.applied_at DESC LIMIT 8`,
              studentIds
            )
          : [];

      const recentPlacements =
        studentIds.length > 0
          ? queryAll(
              db,
              `SELECT p.placement_id, s.full_name AS student_name, s.roll_number, s.branch, c.company_name,
                      p.job_role, p.package_lpa, p.offer_date, p.joining_status
               FROM placements p
               JOIN students s ON p.student_id = s.student_id
               JOIN companies c ON p.company_id = c.company_id
               WHERE p.student_id IN (${ph})
               ORDER BY p.offer_date DESC LIMIT 6`,
              studentIds
            )
          : [];

      const activityLogs = queryAll(
        db,
        'SELECT * FROM activity_logs WHERE user_id = ? OR activity_type IN (\'COMPANY\', \'DRIVE\', \'ANNOUNCEMENT\') ORDER BY created_at DESC LIMIT 8',
        [authUser.userId]
      );

      res.json({
        success: true,
        data: {
          totalStudents,
          registeredCompanies,
          activeDrives,
          studentsPlaced,
          totalApplications,
          eligibleStudents,
          upcomingInterviews,
          pendingApprovals,
          totalAnnouncements,
          totalBranches: assignedBranches.length,
          placementPercentage: totalStudents > 0 ? Math.round((studentsPlaced / totalStudents) * 1000) / 10 : 0,
          branchDistribution,
          skillDistribution,
          applicationOutcomes,
          companyPlacements,
          upcomingDrives,
          recentApplications,
          recentPlacements,
          activityLogs,
        },
      });
      return;
    }

    const whereBranch = branchFilter ? ' WHERE branch = ?' : '';
    const branchParams = branchFilter ? [branchFilter] : [];

    const totalStudents = queryOne<{ c: number }>(db, `SELECT COUNT(*) AS c FROM students${whereBranch}`, branchParams)?.c ?? 0;
    const registeredCompanies = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM companies')?.c ?? 0;
    const activeDrives =
      queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM placement_drives WHERE drive_status = 'Active' AND approval_status = 'Approved'")?.c ?? 0;
    const studentsPlaced = branchFilter
      ? queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM students WHERE branch = ? AND placement_status = 'Placed'", [branchFilter])?.c ?? 0
      : queryOne<{ c: number }>(db, 'SELECT COUNT(DISTINCT student_id) AS c FROM placements')?.c ?? 0;
    const totalApplications = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM applications')?.c ?? 0;
    const eligibleStudents = queryOne<{ c: number }>(
      db,
      `SELECT COUNT(*) AS c FROM students WHERE cgpa >= 7.0 AND active_backlogs = 0${branchFilter ? ' AND branch = ?' : ''}`,
      branchParams
    )?.c ?? 0;
    const upcomingInterviews = queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM applications WHERE status = 'Interview'")?.c ?? 0;
    const pendingRecruitersCount =
      queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM users WHERE role = 'RECRUITER' AND approval_status = 'Pending'")?.c ?? 0;
    const pendingDrivesCount =
      queryOne<{ c: number }>(db, "SELECT COUNT(*) AS c FROM placement_drives WHERE approval_status = 'Pending'")?.c ?? 0;
    const pendingSkillsCount = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM student_skills WHERE verified = 0')?.c ?? 0;
    const pendingApprovals = pendingRecruitersCount + pendingDrivesCount + pendingSkillsCount;

    const totalAnnouncements = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM announcements WHERE is_archived = 0')?.c ?? 0;
    const totalBranches = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM branches WHERE is_active = 1')?.c ?? 0;

    const branchDistribution = queryAll(
      db,
      `SELECT b.branch_code AS label, b.branch_name, b.degree_level,
              COUNT(s.student_id) AS count,
              SUM(CASE WHEN s.placement_status = 'Placed' THEN 1 ELSE 0 END) AS placed
       FROM branches b
       LEFT JOIN students s ON b.branch_code = s.branch
       WHERE b.is_active = 1
       GROUP BY b.branch_id, b.branch_code, b.branch_name, b.degree_level
       ORDER BY count DESC, b.branch_id ASC`
    );

    const skillDistribution = queryAll(
      db,
      `SELECT s.skill_name AS label, s.category, COUNT(ss.student_id) AS count,
              ROUND(COALESCE(AVG(ss.proficiency_level), 0), 2) AS avgLevel
       FROM skills s
       LEFT JOIN student_skills ss ON s.skill_id = ss.skill_id
       GROUP BY s.skill_id, s.skill_name, s.category
       ORDER BY count DESC, s.skill_name ASC`
    );

    const applicationOutcomes = queryAll(
      db,
      'SELECT status AS label, COUNT(*) AS count FROM applications GROUP BY status'
    );

    const companyPlacements = queryAll(
      db,
      `SELECT c.company_name AS label, COUNT(p.placement_id) AS count,
              ROUND(COALESCE(AVG(p.package_lpa), 0), 2) AS avgPackage
       FROM companies c
       LEFT JOIN placements p ON c.company_id = p.company_id
       GROUP BY c.company_id, c.company_name
       ORDER BY count DESC, c.company_name ASC`
    );

    const upcomingDrives = queryAll(
      db,
      `SELECT pd.drive_id, c.company_name, pd.job_role, pd.job_type, pd.job_location, pd.salary_package, pd.compensation_label, pd.drive_date, pd.application_deadline, pd.drive_status
       FROM placement_drives pd
       JOIN companies c ON pd.company_id = c.company_id
       WHERE pd.approval_status = 'Approved' AND pd.drive_status IN ('Active', 'Planned')
       ORDER BY pd.drive_date ASC LIMIT 6`
    );

    const recentApplications = queryAll(
      db,
      `SELECT a.application_id, s.full_name AS student_name, s.roll_number, s.branch,
              c.company_name, pd.job_role, a.status, a.applied_at
       FROM applications a
       JOIN students s ON a.student_id = s.student_id
       JOIN placement_drives pd ON a.drive_id = pd.drive_id
       JOIN companies c ON pd.company_id = c.company_id
       ORDER BY a.applied_at DESC LIMIT 8`
    );

    const recentPlacements = queryAll(
      db,
      `SELECT p.placement_id, s.full_name AS student_name, s.roll_number, s.branch, c.company_name,
              p.job_role, p.package_lpa, p.offer_date, p.joining_status
       FROM placements p
       JOIN students s ON p.student_id = s.student_id
       JOIN companies c ON p.company_id = c.company_id
       ORDER BY p.offer_date DESC LIMIT 6`
    );

    const activityLogs = queryAll(db, 'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 8');

    res.json({
      success: true,
      data: {
        totalStudents,
        registeredCompanies,
        activeDrives,
        studentsPlaced,
        totalApplications,
        eligibleStudents,
        upcomingInterviews,
        pendingApprovals,
        totalAnnouncements,
        totalBranches,
        placementPercentage: totalStudents > 0 ? Math.round((studentsPlaced / totalStudents) * 1000) / 10 : 0,
        branchDistribution,
        skillDistribution,
        applicationOutcomes,
        companyPlacements,
        upcomingDrives,
        recentApplications,
        recentPlacements,
        activityLogs,
      },
    });
  });

  // ---------------- AUTOMATIC INSTITUTIONAL REGISTRATION REPORTS ----------------
  app.get(
    '/api/reports/registrations',
    requireAuth,
    requireRegistrationReportAccess,
    async (_req: AuthedRequest, res: Response) => {
      try {
        const db = await getDb();
        const report = computeInstitutionalRegistrationStats(db);
        res.json({ success: true, data: report });
      } catch {
        res.status(500).json({ success: false, error: 'Unable to compute institutional registration statistics.' });
      }
    }
  );

  app.get(
    '/api/reports/registrations/export',
    requireAuth,
    requireRegistrationReportAccess,
    async (req: AuthedRequest, res: Response) => {
      try {
        const format = String(req.query.format || 'csv').trim().toLowerCase();
        if (!['pdf', 'xlsx', 'csv'].includes(format)) {
          res.status(400).json({ success: false, error: 'Unsupported report format. Use pdf, xlsx, or csv.' });
          return;
        }
        const db = await getDb();
        const report = computeInstitutionalRegistrationStats(db);
        const dateStamp = new Date().toISOString().slice(0, 10);

        if (format === 'pdf') {
          const pdfBuffer = await generateRegistrationPdfBuffer(report);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="gcet-registration-report-${dateStamp}.pdf"`
          );
          res.send(pdfBuffer);
          return;
        }

        if (format === 'xlsx') {
          const xlsxBuffer = await generateRegistrationExcelBuffer(report);
          res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="gcet-registration-report-${dateStamp}.xlsx"`
          );
          res.send(xlsxBuffer);
          return;
        }

        const csvBuffer = generateRegistrationCsvBuffer(report);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="gcet-registration-report-${dateStamp}.csv"`
        );
        res.send(csvBuffer);
      } catch {
        res.status(500).json({ success: false, error: 'Unable to generate downloadable registration report.' });
      }
    }
  );

  // ---------------- APPROVAL CENTER (ADMIN / TPO / EXECUTIVE) ----------------
  app.get('/api/approvals', requireAuth, requirePlacementStaff, async (_req: Request, res: Response) => {
    const db = await getDb();
    const pendingRecruiters = queryAll(
      db,
      `SELECT u.user_id, u.username, u.email, u.full_name, u.company_id, c.company_name,
              rp.phone, rp.website, rp.industry, rp.designation, u.approval_status, u.created_at
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.company_id
       LEFT JOIN recruiter_profiles rp ON u.user_id = rp.user_id
       WHERE u.role = 'RECRUITER' AND u.approval_status = 'Pending'
       ORDER BY u.created_at DESC`
    );
    const pendingDrives = queryAll(
      db,
      `SELECT pd.drive_id, pd.company_id, c.company_name, pd.job_role, pd.job_type, pd.salary_package, pd.drive_date, pd.application_deadline, pd.approval_status
       FROM placement_drives pd
       JOIN companies c ON pd.company_id = c.company_id
       WHERE pd.approval_status = 'Pending'
       ORDER BY pd.created_at DESC`
    );
    const unverifiedSkills = queryAll(
      db,
      `SELECT ss.student_skill_id, ss.student_id, s.roll_number, s.full_name AS student_name, s.branch, sk.skill_name, sk.category, ss.proficiency_level
       FROM student_skills ss
       JOIN students s ON ss.student_id = s.student_id
       JOIN skills sk ON ss.skill_id = sk.skill_id
       WHERE ss.verified = 0
       ORDER BY ss.updated_at DESC`
    );
    res.json({ success: true, data: { pendingRecruiters, pendingDrives, unverifiedSkills } });
  });

  app.post('/api/approvals/:type/:id/decision', requireAuth, requireApprovingAuthority, async (req: AuthedRequest, res: Response) => {
    const type = req.params.type;
    const id = Number(req.params.id);
    const decision = req.body?.decision;
    if (!['Approved', 'Rejected'].includes(decision)) {
      res.status(400).json({ success: false, error: 'Decision must be Approved or Rejected.' });
      return;
    }
    const db = await getDb();

    if (type === 'recruiter') {
      const target = queryOne<{ user_id: number; full_name: string }>(
        db,
        "SELECT user_id, full_name FROM users WHERE user_id = ? AND role = 'RECRUITER'",
        [id]
      );
      if (!target) {
        res.status(404).json({ success: false, error: 'Recruiter user not found.' });
        return;
      }
      executeSql(db, 'UPDATE users SET approval_status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [decision, id]);
      executeSql(
        db,
        'UPDATE recruiter_profiles SET approval_status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [decision, id]
      );
      executeSql(
        db,
        "INSERT INTO notifications (user_id, title, message, category, related_module) VALUES (?, ?, ?, 'Placement Notifications', 'dashboard')",
        [
          id,
          `Recruiter Portal ${decision}`,
          decision === 'Approved'
            ? 'Your recruiter account is verified by GCET Placement Cell. You can now sign in and publish placement drives.'
            : 'Your recruiter verification request was declined by GCET Placement Cell.',
        ]
      );
      await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Admin', 'COMPANY', `${decision} recruiter account: ${target.full_name}`);
      res.json({ success: true, data: { updated: true } });
      return;
    }

    if (type === 'drive') {
      const drive = queryOne<{ drive_id: number; job_role: string; created_by: number | null }>(
        db,
        'SELECT drive_id, job_role, created_by FROM placement_drives WHERE drive_id = ?',
        [id]
      );
      if (!drive) {
        res.status(404).json({ success: false, error: 'Placement drive not found.' });
        return;
      }
      const nextDriveStatus = decision === 'Approved' ? 'Active' : 'Cancelled';
      executeSql(
        db,
        'UPDATE placement_drives SET approval_status = ?, drive_status = ?, updated_at = CURRENT_TIMESTAMP WHERE drive_id = ?',
        [decision, nextDriveStatus, id]
      );
      if (drive.created_by) {
        executeSql(
          db,
          "INSERT INTO notifications (user_id, title, message, category, related_module) VALUES (?, ?, ?, 'Placement Notifications', 'drives')",
          [
            drive.created_by,
            `Drive ${decision}: ${drive.job_role}`,
            `GCET Placement Cell marked your drive "${drive.job_role}" as ${decision}.`,
          ]
        );
      }
      if (decision === 'Approved') {
        await notifyEligibleStudentsForDrive(id);
      }
      await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Admin', 'DRIVE', `${decision} placement drive: ${drive.job_role}`);
      res.json({ success: true, data: { updated: true } });
      return;
    }

    if (type === 'skill') {
      const row = queryOne<{ student_skill_id: number; student_id: number; skill_name: string }>(
        db,
        `SELECT ss.student_skill_id, ss.student_id, sk.skill_name
         FROM student_skills ss JOIN skills sk ON ss.skill_id = sk.skill_id
         WHERE ss.student_skill_id = ?`,
        [id]
      );
      if (!row) {
        res.status(404).json({ success: false, error: 'Skill entry not found.' });
        return;
      }
      if (decision === 'Approved') {
        executeSql(db, 'UPDATE student_skills SET verified = 1, updated_at = CURRENT_TIMESTAMP WHERE student_skill_id = ?', [id]);
      } else {
        executeSql(db, 'DELETE FROM student_skills WHERE student_skill_id = ?', [id]);
      }
      const stu = queryOne<{ user_id: number | null; full_name: string }>(
        db,
        'SELECT user_id, full_name FROM students WHERE student_id = ?',
        [row.student_id]
      );
      if (stu?.user_id) {
        executeSql(
          db,
          "INSERT INTO notifications (user_id, title, message, category, related_module) VALUES (?, ?, ?, 'Department Notifications', 'skill-matrix')",
          [
            stu.user_id,
            `Skill Verification ${decision}: ${row.skill_name}`,
            decision === 'Approved'
              ? `Your ${row.skill_name} skill proficiency has been verified by the Placement Cell.`
              : `Your unverified ${row.skill_name} claim was declined. Please update your proficiency with project evidence.`,
          ]
        );
      }
      await logActivity(
        req.authUser?.userId ?? null,
        req.authUser?.fullName ?? 'Admin',
        'STUDENT',
        `${decision} skill verification (${row.skill_name}) for ${stu?.full_name || 'Student'}`
      );
      res.json({ success: true, data: { updated: true } });
      return;
    }

    res.status(400).json({ success: false, error: 'Invalid approval item type.' });
  });

  // ---------------- RECRUITER WORKSPACE OVERVIEW ----------------
  app.get('/api/recruiter/overview', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role !== 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiter role required.' });
      return;
    }
    const db = await getDb();
    const companyId = req.authUser.companyId;
    const company = companyId
      ? queryOne(
          db,
          `SELECT c.*, cc.contact_person, cc.designation, cc.contact_email, cc.contact_phone
           FROM companies c
           LEFT JOIN company_contacts cc ON c.company_id = cc.company_id AND cc.is_primary = 1
           WHERE c.company_id = ?`,
          [companyId]
        )
      : null;

    const allDrives = await hydrateAllDrives();
    const drives = allDrives.filter((d) => d.company_id === companyId);
    const driveIds = drives.map((d) => d.drive_id);

    const applications =
      driveIds.length > 0
        ? queryAll(
            db,
            `SELECT a.application_id, a.drive_id, a.student_id, a.applied_at, a.status, a.interview_date, a.interview_mode, a.remarks,
                    s.full_name AS student_name, s.roll_number, s.branch, s.cgpa, s.resume_url,
                    c.company_name, pd.job_role, pd.job_type, pd.salary_package, pd.drive_date
             FROM applications a
             JOIN students s ON a.student_id = s.student_id
             JOIN placement_drives pd ON a.drive_id = pd.drive_id
             JOIN companies c ON pd.company_id = c.company_id
             WHERE pd.company_id = ?
             ORDER BY a.applied_at DESC`,
            [companyId]
          )
        : [];

    // Compute aggregate eligible candidate count across active/planned approved drives for this company
    const students = queryAll<StudentRecord>(db, 'SELECT * FROM students');
    const eligibleSet = new Set<number>();
    const activeCompanyDrives = drives.filter((d) => d.drive_status !== 'Cancelled');
    for (const st of students) {
      const skills = queryAll<StudentSkillRecord>(
        db,
        `SELECT ss.skill_id, sk.skill_name, sk.category, ss.proficiency_level, ss.verified
         FROM student_skills ss JOIN skills sk ON ss.skill_id = sk.skill_id WHERE ss.student_id = ?`,
        [st.student_id]
      );
      for (const drv of activeCompanyDrives) {
        if (evaluateEligibility(st, skills, drv).eligible) {
          eligibleSet.add(st.student_id);
          break;
        }
      }
    }

    const shortlistedCount = applications.filter((a) => a.status === 'Shortlisted' || a.status === 'Assessment').length;
    const interviewCount = applications.filter((a) => a.status === 'Interview').length;
    const selectedCount = applications.filter((a) => a.status === 'Selected').length;

    res.json({
      success: true,
      data: {
        company,
        approvalStatus: req.authUser.approvalStatus || 'Pending',
        drives,
        applications,
        eligibleCandidateCount: eligibleSet.size,
        shortlistedCount,
        interviewCount,
        selectedCount,
      },
    });
  });

  // ---------------- GLOBAL SEARCH ----------------
  app.get('/api/search', requireAuth, async (req: AuthedRequest, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ success: true, data: { students: [], companies: [], drives: [], announcements: [] } });
      return;
    }
    const db = await getDb();
    const like = `%${q}%`;
    let students: Record<string, unknown>[] = [];
    if (req.authUser?.role !== 'STUDENT' && req.authUser?.role !== 'RECRUITER') {
      const rawStudents = queryAll<{ student_id: number; roll_number: string; full_name: string; branch: string; cgpa: number }>(
        db,
        'SELECT student_id, roll_number, full_name, branch, cgpa FROM students WHERE full_name LIKE ? OR roll_number LIKE ? OR branch LIKE ? LIMIT 25',
        [like, like, like]
      );
      if (isFacultyRole(req.authUser?.role)) {
        const assignedBranches = getFacultyAssignedBranches(db, req.authUser!.userId, req.authUser!.assignedBranch);
        students = rawStudents.filter((s) => branchMatchesFacultyScope(s.branch, assignedBranches)).slice(0, 5);
      } else {
        students = rawStudents.slice(0, 5);
      }
    }
    const companies = queryAll(
      db,
      'SELECT company_id, company_name, industry, headquarters FROM companies WHERE company_name LIKE ? OR industry LIKE ? LIMIT 5',
      [like, like]
    );
    const drives = queryAll(
      db,
      `SELECT pd.drive_id, pd.job_role, pd.job_type, pd.salary_package, c.company_name
       FROM placement_drives pd JOIN companies c ON pd.company_id = c.company_id
       WHERE pd.job_role LIKE ? OR c.company_name LIKE ? LIMIT 5`,
      [like, like]
    );
    const announcements = queryAll(
      db,
      `SELECT a.announcement_id, a.title, a.source_url, a.published_date, ac.category_name
       FROM announcements a JOIN announcement_categories ac ON a.category_id = ac.category_id
       WHERE a.is_archived = 0 AND (a.title LIKE ? OR a.description LIKE ?) LIMIT 5`,
      [like, like]
    );
    res.json({ success: true, data: { students, companies, drives, announcements } });
  });

  // ---------------- ANNOUNCEMENTS, CATEGORIES, SOURCES & SYNC ----------------
  app.get('/api/announcements/categories', requireAuth, async (_req: Request, res: Response) => {
    const db = await getDb();
    res.json({ success: true, data: queryAll(db, 'SELECT * FROM announcement_categories ORDER BY category_id ASC') });
  });

  app.get('/api/announcements/sources', requireAuth, async (_req: Request, res: Response) => {
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT s.*, (SELECT COUNT(*) FROM announcements a WHERE a.source_id = s.source_id) AS itemCount
       FROM announcement_sources s ORDER BY s.source_id ASC`
    );
    res.json({ success: true, data: rows });
  });

  app.post('/api/announcements/sources', requireAuth, requireAdminOnly, async (req: AuthedRequest, res: Response) => {
    const { sourceName, baseUrl, feedUrl, syncMode, syncIntervalMinutes } = req.body ?? {};
    if (!sourceName || !baseUrl) {
      res.status(400).json({ success: false, error: 'Source name and official URL are required.' });
      return;
    }
    const db = await getDb();
    const dup = queryOne(db, 'SELECT source_id FROM announcement_sources WHERE LOWER(base_url) = LOWER(?)', [String(baseUrl).trim()]);
    if (dup) {
      res.status(409).json({ success: false, error: 'This announcement source URL is already configured.' });
      return;
    }
    const ins = executeSql(
      db,
      'INSERT INTO announcement_sources (source_name, base_url, feed_url, sync_mode, is_enabled, sync_interval_minutes) VALUES (?, ?, ?, ?, 1, ?)',
      [String(sourceName).trim(), String(baseUrl).trim(), feedUrl ? String(feedUrl).trim() : String(baseUrl).trim(), syncMode || 'HTML', Number(syncIntervalMinutes) || 60]
    );
    res.status(201).json({ success: true, data: queryOne(db, 'SELECT * FROM announcement_sources WHERE source_id = ?', [ins.lastInsertRowid]) });
  });

  app.put('/api/announcements/sources/:id', requireAuth, requireAdminOnly, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { isEnabled, syncIntervalMinutes, feedUrl } = req.body ?? {};
    const db = await getDb();
    executeSql(
      db,
      `UPDATE announcement_sources
       SET is_enabled = COALESCE(?, is_enabled),
           sync_interval_minutes = COALESCE(?, sync_interval_minutes),
           feed_url = COALESCE(?, feed_url)
       WHERE source_id = ?`,
      [isEnabled !== undefined ? (isEnabled ? 1 : 0) : null, syncIntervalMinutes ? Number(syncIntervalMinutes) : null, feedUrl ?? null, id]
    );
    res.json({ success: true, data: queryOne(db, 'SELECT * FROM announcement_sources WHERE source_id = ?', [id]) });
  });

  app.post('/api/announcements/sync', requireAuth, requireStaff, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const sourceId = req.body?.sourceId ? Number(req.body.sourceId) : undefined;
    const summary = await syncAnnouncementSources(db, sourceId, req.authUser?.fullName || 'Portal Admin');
    checkUpcomingDriveDeadlines(db);
    res.json({ success: true, data: summary });
  });

  app.get('/api/announcements/sync-status', requireAuth, async (_req: AuthedRequest, res: Response) => {
    const db = await getDb();
    res.json({ success: true, data: getSyncHealthSummary(db) });
  });

  app.get('/api/announcements', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const { categoryId, branch, departmentCode, sourceId, academicYear, priority, q, pinnedOnly, archived } = req.query;
    const isFaculty = isFacultyRole(req.authUser?.role);
    const assignedBranches = isFaculty
      ? getFacultyAssignedBranches(db, req.authUser!.userId, req.authUser!.assignedBranch)
      : [];

    if (isFaculty) {
      const requestedBranch = String(branch || departmentCode || '').trim();
      if (
        requestedBranch &&
        requestedBranch.toUpperCase() !== 'ALL' &&
        !branchMatchesFacultyScope(requestedBranch, assignedBranches)
      ) {
        res.status(403).json({
          success: false,
          error: `Access denied: you are not authorized to view department announcements for ${requestedBranch}.`,
        });
        return;
      }
    }

    let sql = `SELECT a.*, ac.category_name
               FROM announcements a
               JOIN announcement_categories ac ON a.category_id = ac.category_id
               WHERE a.is_archived = ?`;
    const params: unknown[] = [archived === 'true' ? 1 : 0];

    if (categoryId && String(categoryId).trim()) {
      sql += ' AND a.category_id = ?';
      params.push(Number(categoryId));
    }
    if (sourceId && String(sourceId).trim()) {
      sql += ' AND a.source_id = ?';
      params.push(Number(sourceId));
    }
    if (academicYear && String(academicYear).trim()) {
      sql += ' AND a.academic_year = ?';
      params.push(String(academicYear).trim());
    }
    if (priority && String(priority).trim()) {
      sql += ' AND a.priority = ?';
      params.push(String(priority).trim());
    }
    if (pinnedOnly === 'true') {
      sql += ' AND a.is_pinned = 1';
    }
    if (departmentCode && String(departmentCode).trim() && String(departmentCode).trim().toUpperCase() !== 'ALL') {
      const dept = String(departmentCode).trim().toUpperCase();
      sql += ' AND (UPPER(COALESCE(a.department_code, "")) = ? OR UPPER(a.relevant_branches) LIKE ? OR UPPER(a.relevant_branches) = "ALL")';
      params.push(dept, `%${dept}%`);
    } else if (branch && String(branch).trim() && String(branch).trim().toUpperCase() !== 'ALL') {
      const br = String(branch).trim().toUpperCase();
      sql += ' AND (UPPER(a.relevant_branches) = "ALL" OR UPPER(a.relevant_branches) LIKE ? OR UPPER(COALESCE(a.department_code, "")) = ?)';
      params.push(`%${br}%`, br);
    }
    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      sql += ' AND (a.title LIKE ? OR a.description LIKE ? OR a.source_name LIKE ?)';
      params.push(like, like, like);
    }

    sql += ' ORDER BY a.is_pinned DESC, a.published_date DESC, a.announcement_id DESC';
    let rows = queryAll<Record<string, unknown>>(db, sql, params);
    if (isFaculty) {
      rows = rows.filter((a) => {
        const rel = String(a.relevant_branches || 'ALL').trim();
        const dept = String(a.department_code || '').trim();
        if (rel.toUpperCase() === 'ALL' && !dept) return true;
        const tokens = rel
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (tokens.some((t) => t.toUpperCase() === 'ALL')) return true;
        if (dept && branchMatchesFacultyScope(dept, assignedBranches)) return true;
        return tokens.some((t) => branchMatchesFacultyScope(t, assignedBranches));
      });
    }
    res.json({ success: true, data: rows });
  });

  app.post('/api/announcements', requireAuth, requireStaff, async (req: AuthedRequest, res: Response) => {
    const {
      title,
      categoryId,
      sourceName,
      sourceUrl,
      publishedDate,
      description,
      relevantBranches,
      departmentCode,
      academicYear,
      deadlineDate,
      attachmentUrl,
      priority,
      isPinned,
    } = req.body ?? {};
    if (!title || !categoryId || !sourceUrl || !description) {
      res.status(400).json({ success: false, error: 'Title, category, official source URL, and description are required.' });
      return;
    }
    const db = await getDb();
    let finalRelevantBranches = relevantBranches || 'ALL';
    let finalDepartmentCode = departmentCode || null;
    if (isFacultyRole(req.authUser?.role)) {
      const assignedBranches = getFacultyAssignedBranches(db, req.authUser!.userId, req.authUser!.assignedBranch);
      if (relevantBranches && String(relevantBranches).trim().toUpperCase() !== 'ALL') {
        const requestedList = String(relevantBranches)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        const unauthorized = requestedList.find((b) => !branchMatchesFacultyScope(b, assignedBranches));
        if (unauthorized) {
          res.status(403).json({
            success: false,
            error: `Access denied: cannot publish department announcement to ${unauthorized}.`,
          });
          return;
        }
        finalRelevantBranches = requestedList.join(', ');
      } else {
        finalRelevantBranches = assignedBranches.join(', ');
      }
      if (departmentCode && !branchMatchesFacultyScope(String(departmentCode), assignedBranches)) {
        res.status(403).json({
          success: false,
          error: `Access denied: department code ${departmentCode} is outside your assigned branches.`,
        });
        return;
      }
      finalDepartmentCode = departmentCode || assignedBranches[0] || null;
    }

    const pubDate = publishedDate || new Date().toISOString().slice(0, 10);
    const ins = executeSql(
      db,
      `INSERT INTO announcements (title, category_id, source_id, source_name, source_url, published_date, description, relevant_branches, department_code, academic_year, deadline_date, has_attachment, attachment_url, priority, is_pinned, is_archived, is_verified_source, created_by)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [
        String(title).trim(),
        Number(categoryId),
        sourceName || `${req.authUser?.designation || 'Official Notice'} — ${req.authUser?.fullName || 'GCET'}`,
        String(sourceUrl).trim(),
        pubDate,
        String(description).trim(),
        finalRelevantBranches,
        finalDepartmentCode,
        academicYear || '2026-27',
        deadlineDate || null,
        attachmentUrl ? 1 : 0,
        attachmentUrl || null,
        priority || 'Important',
        isPinned ? 1 : 0,
        req.authUser?.userId ?? null,
      ]
    );

    executeSql(
      db,
      `INSERT INTO notifications (user_id, title, message, category, link_url, related_module)
       VALUES (NULL, ?, ?, ?, ?, 'announcements')`,
      [String(title).trim(), String(description).trim().slice(0, 180), 'College Announcements', String(sourceUrl).trim()]
    );
    await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Staff', 'ANNOUNCEMENT', `Published Notice: ${title}`);

    const created = queryOne(
      db,
      'SELECT a.*, ac.category_name FROM announcements a JOIN announcement_categories ac ON a.category_id = ac.category_id WHERE a.announcement_id = ?',
      [ins.lastInsertRowid]
    );
    res.status(201).json({ success: true, data: created });
  });

  app.put('/api/announcements/:id', requireAuth, requireStaff, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { isPinned, isArchived } = req.body ?? {};
    const db = await getDb();
    executeSql(
      db,
      'UPDATE announcements SET is_pinned = COALESCE(?, is_pinned), is_archived = COALESCE(?, is_archived), updated_date = ? WHERE announcement_id = ?',
      [isPinned !== undefined ? (isPinned ? 1 : 0) : null, isArchived !== undefined ? (isArchived ? 1 : 0) : null, new Date().toISOString().slice(0, 10), id]
    );
    res.json({ success: true, data: { updated: true } });
  });

  // ---------------- NOTIFICATIONS BELL & ALERTS ----------------
  app.get('/api/notifications', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const userId = req.authUser?.userId ?? 0;
    const rows = queryAll(
      db,
      'SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY is_read ASC, created_at DESC LIMIT 40',
      [userId]
    );
    const unreadCount = rows.filter((r) => !r.is_read).length;
    res.json({ success: true, data: { notifications: rows, unreadCount } });
  });

  app.put('/api/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const isRead = req.body?.isRead !== false ? 1 : 0;
    const db = await getDb();
    executeSql(db, 'UPDATE notifications SET is_read = ? WHERE notification_id = ?', [isRead, id]);
    res.json({ success: true, data: { updated: true } });
  });

  app.put('/api/notifications/mark-all-read', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const userId = req.authUser?.userId ?? 0;
    executeSql(db, 'UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL', [userId]);
    res.json({ success: true, data: { updated: true } });
  });

  // ---------------- SAVED JOBS / BOOKMARKS ----------------
  app.get('/api/saved-jobs', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const userId = req.authUser?.userId ?? 0;
    const rows = queryAll(
      db,
      `SELECT sj.saved_id, sj.saved_at, pd.*, c.company_name, c.industry, de.min_cgpa, de.eligible_branches, de.graduation_year, de.max_backlogs
       FROM saved_jobs sj
       JOIN placement_drives pd ON sj.drive_id = pd.drive_id
       JOIN companies c ON pd.company_id = c.company_id
       LEFT JOIN drive_eligibility de ON pd.drive_id = de.drive_id
       WHERE sj.user_id = ?
       ORDER BY sj.saved_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  });

  app.post('/api/saved-jobs', requireAuth, async (req: AuthedRequest, res: Response) => {
    const userId = req.authUser?.userId;
    const driveId = Number(req.body?.driveId);
    if (!userId || !driveId) {
      res.status(400).json({ success: false, error: 'driveId is required.' });
      return;
    }
    const db = await getDb();
    executeSql(db, 'INSERT OR IGNORE INTO saved_jobs (user_id, drive_id) VALUES (?, ?)', [userId, driveId]);
    res.status(201).json({ success: true, data: { saved: true, driveId } });
  });

  app.delete('/api/saved-jobs/:driveId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const userId = req.authUser?.userId;
    const driveId = Number(req.params.driveId);
    const db = await getDb();
    executeSql(db, 'DELETE FROM saved_jobs WHERE user_id = ? AND drive_id = ?', [userId, driveId]);
    res.json({ success: true, data: { removed: true } });
  });

  // ---------------- STUDENTS CRUD, CSV IMPORT & PROFILES ----------------
  app.get('/api/students', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({
        success: false,
        error: 'Recruiters review eligible candidate counts and drive applicants inside Recruiter Workspace and Applications.',
      });
      return;
    }
    const db = await getDb();
    const authUser = req.authUser!;
    const { q, branch, deptId, gradYear, minCgpa, academicYear, semester, section } = req.query;

    let facultyAssignedBranches: string[] = [];
    if (isFacultyRole(authUser.role)) {
      facultyAssignedBranches = getFacultyAssignedBranches(db, authUser.userId, authUser.assignedBranch);
      if (branch && String(branch).trim() && !branchMatchesFacultyScope(String(branch).trim(), facultyAssignedBranches)) {
        res.status(403).json({
          success: false,
          error: `Access denied: branch "${String(branch).trim()}" is outside your assigned coordinator departments.`,
        });
        return;
      }
    }

    let sql = `SELECT s.*, d.dept_code, d.dept_name
               FROM students s
               JOIN departments d ON s.dept_id = d.dept_id
               WHERE 1=1`;
    const params: unknown[] = [];

    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      sql += ' AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)';
      params.push(like, like, like);
    }
    if (deptId && String(deptId).trim()) {
      sql += ' AND s.dept_id = ?';
      params.push(Number(deptId));
    }
    if (gradYear && String(gradYear).trim()) {
      sql += ' AND s.graduation_year = ?';
      params.push(Number(gradYear));
    }
    if (minCgpa && String(minCgpa).trim()) {
      sql += ' AND s.cgpa >= ?';
      params.push(Number(minCgpa));
    }
    if (academicYear && String(academicYear).trim()) {
      sql += ' AND s.academic_year = ?';
      params.push(String(academicYear).trim());
    }
    if (semester && String(semester).trim()) {
      sql += ' AND s.semester = ?';
      params.push(Number(semester));
    }
    if (section && String(section).trim()) {
      sql += ' AND UPPER(s.section) = UPPER(?)';
      params.push(String(section).trim());
    }
    sql += ' ORDER BY s.cgpa DESC, s.roll_number ASC';

    let students = queryAll<StudentRecord & { skillCount?: number }>(db, sql, params);

    if (branch && String(branch).trim()) {
      const bStr = String(branch).trim();
      students = students.filter((s) => branchMatchesFacultyScope(s.branch, [bStr]));
    }
    if (isFacultyRole(authUser.role)) {
      students = students.filter((s) => branchMatchesFacultyScope(s.branch, facultyAssignedBranches));
    } else if (authUser.role === 'STUDENT' && authUser.studentId) {
      // Students can view their own record cleanly or peers only if needed; keep student view scoped cleanly
    }

    for (const st of students) {
      const skCount = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM student_skills WHERE student_id = ?', [st.student_id]);
      st.skillCount = skCount?.c ?? 0;
    }
    res.json({ success: true, data: students });
  });

  app.get('/api/students/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (authUser.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Direct access to private student records is restricted.' });
      return;
    }
    const db = await getDb();
    const id = Number(req.params.id);
    if (authUser.role === 'STUDENT' && authUser.studentId !== id) {
      res.status(403).json({ success: false, error: 'Students may only access their own record.' });
      return;
    }
    if (isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, id)) {
      res.status(403).json({ success: false, error: 'Access denied: student belongs to another coordinator department.' });
      return;
    }

    const student = queryOne(
      db,
      `SELECT s.*, d.dept_code, d.dept_name
       FROM students s
       JOIN departments d ON s.dept_id = d.dept_id
       WHERE s.student_id = ?`,
      [id]
    );
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }
    const skills = queryAll(
      db,
      `SELECT ss.student_skill_id, ss.skill_id, sk.skill_name, sk.category, ss.proficiency_level, ss.verified
       FROM student_skills ss
       JOIN skills sk ON ss.skill_id = sk.skill_id
       WHERE ss.student_id = ?
       ORDER BY ss.proficiency_level DESC`,
      [id]
    );
    const projects = queryAll(db, 'SELECT * FROM projects WHERE student_id = ? ORDER BY created_at DESC', [id]);
    const certifications = queryAll(db, 'SELECT * FROM certifications WHERE student_id = ? ORDER BY issue_date DESC', [id]);
    const applications = queryAll(
      db,
      `SELECT a.*, c.company_name, pd.job_role, pd.salary_package
       FROM applications a
       JOIN placement_drives pd ON a.drive_id = pd.drive_id
       JOIN companies c ON pd.company_id = c.company_id
       WHERE a.student_id = ?
       ORDER BY a.applied_at DESC`,
      [id]
    );
    res.json({ success: true, data: { ...student, skills, projects, certifications, applications } });
  });

  app.post('/api/students', requireAuth, requireStaff, async (req: AuthedRequest, res: Response) => {
    try {
      const {
        rollNumber,
        fullName,
        email,
        phone,
        branch,
        branchId,
        academicYear,
        yearOfStudy,
        semester,
        section,
        graduationYear,
        cgpa,
        activeBacklogs,
        gender,
        address,
        resumeUrl,
        placementStatus,
      } = req.body ?? {};
      if (!rollNumber || !fullName || !email || !phone || (!branch && !branchId) || !graduationYear || cgpa === undefined) {
        res.status(400).json({ success: false, error: 'Missing required student fields.' });
        return;
      }
      const numCgpa = Number(cgpa);
      if (Number.isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
        res.status(400).json({ success: false, error: 'CGPA must be between 0.00 and 10.00.' });
        return;
      }
      const db = await getDb();
      const branchRow = resolveBranchRow(db, branch ? String(branch).trim() : null, branchId ? Number(branchId) : null);

      if (!branchRow) {
        res.status(400).json({ success: false, error: 'Invalid GCET branch.' });
        return;
      }

      if (isFacultyRole(req.authUser?.role)) {
        const assignedBranches = getFacultyAssignedBranches(db, req.authUser!.userId, req.authUser!.assignedBranch);
        if (!branchMatchesFacultyScope(branchRow.branch_code, assignedBranches)) {
          res.status(403).json({
            success: false,
            error: `Access denied: you may only enroll students in your assigned branches (${assignedBranches.join(', ')}).`,
          });
          return;
        }
      }

      const dup = queryOne(
        db,
        'SELECT student_id FROM students WHERE UPPER(roll_number) = UPPER(?) OR LOWER(email) = LOWER(?)',
        [String(rollNumber).trim(), String(email).trim()]
      );
      if (dup) {
        res.status(409).json({ success: false, error: 'A student with this roll number or email already exists.' });
        return;
      }
      const result = executeSql(
        db,
        `INSERT INTO students (roll_number, full_name, email, phone, dept_id, branch_id, branch, academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, gender, address, resume_url, placement_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(rollNumber).trim().toUpperCase(),
          String(fullName).trim(),
          String(email).trim(),
          String(phone).trim(),
          branchRow.dept_id,
          branchRow.branch_id,
          branchRow.branch_code,
          academicYear || '2026-27',
          Number(yearOfStudy) || 4,
          Number(semester) || 7,
          section || 'A',
          Number(graduationYear),
          numCgpa,
          Number(activeBacklogs) || 0,
          gender || null,
          address || null,
          resumeUrl || null,
          placementStatus || 'Unplaced',
        ]
      );
      resolveAssignedFaculty(db, result.lastInsertRowid, branchRow.branch_code, section || 'A');
      await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Staff', 'STUDENT', `Added student ${rollNumber} (${branchRow.branch_code})`);
      const created = queryOne(db, 'SELECT * FROM students WHERE student_id = ?', [result.lastInsertRowid]);
      res.status(201).json({ success: true, data: created });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to create student.' });
    }
  });

  app.post('/api/students/import', requireAuth, requireStaff, async (req: AuthedRequest, res: Response) => {
    try {
      const { csvText } = req.body ?? {};
      if (!csvText || typeof csvText !== 'string') {
        res.status(400).json({ success: false, error: 'CSV content is required.' });
        return;
      }
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        res.status(400).json({ success: false, error: 'CSV must contain a header row and at least one student row.' });
        return;
      }
      const db = await getDb();
      const facultyAssignedBranches = isFacultyRole(req.authUser?.role)
        ? getFacultyAssignedBranches(db, req.authUser!.userId, req.authUser!.assignedBranch)
        : null;
      let imported = 0;
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const [roll, name, email, phone, branchCode, gradYear, cgpaStr, semStr, sec, backlogsStr] = cols;
        if (!roll || !name || !email || !branchCode) {
          skipped++;
          continue;
        }
        const branchRow = resolveBranchRow(db, branchCode);
        if (!branchRow) {
          skipped++;
          continue;
        }
        if (facultyAssignedBranches && !branchMatchesFacultyScope(branchRow.branch_code, facultyAssignedBranches)) {
          skipped++;
          continue;
        }
        const dup = queryOne(db, 'SELECT student_id FROM students WHERE UPPER(roll_number) = UPPER(?) OR LOWER(email) = LOWER(?)', [roll, email]);
        if (dup) {
          skipped++;
          continue;
        }
        const cgpaVal = Math.min(10, Math.max(0, Number(cgpaStr) || 7.0));
        const ins = executeSql(
          db,
          `INSERT INTO students (roll_number, full_name, email, phone, dept_id, branch_id, branch, academic_year, year_of_study, semester, section, graduation_year, cgpa, active_backlogs, placement_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, '2026-27', 4, ?, ?, ?, ?, ?, 'Unplaced')`,
          [
            roll.toUpperCase(),
            name,
            email,
            phone || '+91 90000 00000',
            branchRow.dept_id,
            branchRow.branch_id,
            branchRow.branch_code,
            Number(semStr) || 7,
            sec || 'A',
            Number(gradYear) || 2027,
            cgpaVal,
            Number(backlogsStr) || 0,
          ]
        );
        resolveAssignedFaculty(db, ins.lastInsertRowid, branchRow.branch_code, sec || 'A');
        imported++;
      }
      await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Staff', 'STUDENT', `CSV import: ${imported} student(s) imported, ${skipped} skipped`);
      res.json({ success: true, data: { imported, skipped } });
    } catch {
      res.status(500).json({ success: false, error: 'CSV import failed.' });
    }
  });

  app.put('/api/students/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const authUser = req.authUser!;
      if (authUser.role === 'RECRUITER') {
        res.status(403).json({ success: false, error: 'Recruiters cannot modify student profiles.' });
        return;
      }
      if (authUser.role === 'STUDENT' && authUser.studentId !== id) {
        res.status(403).json({ success: false, error: 'Students may only update their own profile.' });
        return;
      }
      const db = await getDb();
      if (isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, id)) {
        res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned department scope.' });
        return;
      }
      const existing = queryOne<StudentRecord & { email: string; phone: string; dept_id: number; branch_id: number; gender: string; address: string; resume_url: string }>(
        db,
        'SELECT * FROM students WHERE student_id = ?',
        [id]
      );
      if (!existing) {
        res.status(404).json({ success: false, error: 'Student not found.' });
        return;
      }
      const b = req.body ?? {};
      const isStaff = authUser.role !== 'STUDENT';
      const cgpaVal = isStaff && b.cgpa !== undefined ? Number(b.cgpa) : existing.cgpa;
      if (Number.isNaN(cgpaVal) || cgpaVal < 0 || cgpaVal > 10) {
        res.status(400).json({ success: false, error: 'CGPA must be between 0.00 and 10.00.' });
        return;
      }

      let resolvedDeptId = existing.dept_id;
      let resolvedBranchId = existing.branch_id;
      let resolvedBranch = existing.branch;
      if (isStaff && b.branch) {
        const br = resolveBranchRow(db, String(b.branch));
        if (br) {
          if (isFacultyRole(authUser.role)) {
            const assignedBranches = getFacultyAssignedBranches(db, authUser.userId, authUser.assignedBranch);
            if (!branchMatchesFacultyScope(br.branch_code, assignedBranches)) {
              res.status(403).json({ success: false, error: 'Cannot move student outside your assigned coordinator branches.' });
              return;
            }
          }
          resolvedBranchId = br.branch_id;
          resolvedDeptId = br.dept_id;
          resolvedBranch = br.branch_code;
        }
      }

      executeSql(
        db,
        `UPDATE students
         SET full_name = ?, email = ?, phone = ?, dept_id = ?, branch_id = ?, branch = ?,
             academic_year = ?, year_of_study = ?, semester = ?, section = ?,
             graduation_year = ?, cgpa = ?, active_backlogs = ?, gender = ?, address = ?, resume_url = ?, placement_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE student_id = ?`,
        [
          b.fullName ?? existing.full_name,
          isStaff ? (b.email ?? existing.email) : existing.email,
          b.phone ?? existing.phone,
          resolvedDeptId,
          resolvedBranchId,
          resolvedBranch,
          isStaff ? (b.academicYear ?? existing.academic_year ?? '2026-27') : (existing.academic_year ?? '2026-27'),
          isStaff ? (Number(b.yearOfStudy) || existing.year_of_study || 4) : (existing.year_of_study || 4),
          isStaff ? (Number(b.semester) || existing.semester || 7) : (existing.semester || 7),
          isStaff ? (b.section ?? existing.section ?? 'A') : (existing.section ?? 'A'),
          isStaff ? (Number(b.graduationYear) || existing.graduation_year) : existing.graduation_year,
          cgpaVal,
          isStaff && b.activeBacklogs !== undefined ? Number(b.activeBacklogs) : existing.active_backlogs,
          b.gender ?? existing.gender,
          b.address ?? existing.address,
          b.resumeUrl !== undefined ? b.resumeUrl : existing.resume_url,
          isStaff ? (b.placementStatus ?? existing.placement_status) : existing.placement_status,
          id,
        ]
      );
      if (resolvedBranch !== existing.branch) {
        executeSql(db, 'DELETE FROM faculty_student_assignments WHERE student_id = ?', [id]);
        resolveAssignedFaculty(db, id, resolvedBranch, b.section ?? existing.section ?? 'A');
      }
      res.json({ success: true, data: queryOne(db, 'SELECT * FROM students WHERE student_id = ?', [id]) });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to update student record.' });
    }
  });

  app.delete('/api/students/:id', requireAuth, requireStaff, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const id = Number(req.params.id);
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, id)) {
      res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned department scope.' });
      return;
    }
    const r = executeSql(db, 'DELETE FROM students WHERE student_id = ?', [id]);
    if (r.changes === 0) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  });

  // Student Projects & Certifications
  app.post('/api/students/:id/projects', requireAuth, async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot modify student projects.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== id) {
      res.status(403).json({ success: false, error: 'Forbidden.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, id)) {
      res.status(403).json({ success: false, error: 'Access denied: student belongs to another department.' });
      return;
    }
    const { title, techStack, description, repoUrl } = req.body ?? {};
    if (!title || !techStack || !description) {
      res.status(400).json({ success: false, error: 'Title, tech stack, and description are required.' });
      return;
    }
    executeSql(db, 'INSERT INTO projects (student_id, title, tech_stack, description, repo_url) VALUES (?, ?, ?, ?, ?)', [
      id,
      title,
      techStack,
      description,
      repoUrl || null,
    ]);
    res.status(201).json({ success: true, data: queryAll(db, 'SELECT * FROM projects WHERE student_id = ? ORDER BY created_at DESC', [id]) });
  });

  app.post('/api/students/:id/certifications', requireAuth, async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot modify student certifications.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== id) {
      res.status(403).json({ success: false, error: 'Forbidden.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, id)) {
      res.status(403).json({ success: false, error: 'Access denied: student belongs to another department.' });
      return;
    }
    const { certName, issuingOrg, issueDate, credentialId } = req.body ?? {};
    if (!certName || !issuingOrg || !issueDate) {
      res.status(400).json({ success: false, error: 'Certification name, issuing organization, and date are required.' });
      return;
    }
    executeSql(db, 'INSERT INTO certifications (student_id, cert_name, issuing_org, issue_date, credential_id) VALUES (?, ?, ?, ?, ?)', [
      id,
      certName,
      issuingOrg,
      issueDate,
      credentialId || null,
    ]);
    res.status(201).json({ success: true, data: queryAll(db, 'SELECT * FROM certifications WHERE student_id = ? ORDER BY issue_date DESC', [id]) });
  });

  // ---------------- SKILL MATRIX ROUTES ----------------
  app.get('/api/skills', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;
    if (studentId) {
      if (req.authUser?.role === 'RECRUITER') {
        res.status(403).json({ success: false, error: 'Recruiters cannot inspect private student skill matrices.' });
        return;
      }
      if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== studentId) {
        res.status(403).json({ success: false, error: 'Students may only inspect their own skill matrix.' });
        return;
      }
      if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, studentId)) {
        res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned branches.' });
        return;
      }
      const rows = queryAll(
        db,
        `SELECT ss.student_skill_id, ss.student_id, ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
         FROM student_skills ss
         JOIN skills s ON ss.skill_id = s.skill_id
         WHERE ss.student_id = ?
         ORDER BY s.category, s.skill_name`,
        [studentId]
      );
      res.json({ success: true, data: rows });
      return;
    }
    res.json({ success: true, data: queryAll(db, 'SELECT * FROM skills ORDER BY category, skill_name') });
  });

  app.post('/api/skills', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { studentId, skillId, proficiencyLevel, verified } = req.body ?? {};
    const sId = Number(studentId);
    const skId = Number(skillId);
    const level = Number(proficiencyLevel);

    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot modify student skills.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== sId) {
      res.status(403).json({ success: false, error: 'Students can only update their own skill matrix.' });
      return;
    }
    if (!sId || !skId || level < 1 || level > 5) {
      res.status(400).json({ success: false, error: 'Proficiency level must be between 1 and 5.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, sId)) {
      res.status(403).json({ success: false, error: 'Access denied: cannot modify skills for students outside your department.' });
      return;
    }
    const isStaff = req.authUser?.role !== 'STUDENT';
    const existing = queryOne<{ student_skill_id: number; verified: number }>(
      db,
      'SELECT student_skill_id, verified FROM student_skills WHERE student_id = ? AND skill_id = ?',
      [sId, skId]
    );
    if (existing) {
      const nextVerified = isStaff && verified !== undefined ? (verified ? 1 : 0) : existing.verified;
      executeSql(
        db,
        'UPDATE student_skills SET proficiency_level = ?, verified = ?, updated_at = CURRENT_TIMESTAMP WHERE student_skill_id = ?',
        [level, nextVerified, existing.student_skill_id]
      );
    } else {
      executeSql(
        db,
        'INSERT INTO student_skills (student_id, skill_id, proficiency_level, verified) VALUES (?, ?, ?, ?)',
        [sId, skId, level, isStaff && verified ? 1 : 0]
      );
    }

    const updated = queryAll(
      db,
      `SELECT ss.student_skill_id, ss.student_id, ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
       FROM student_skills ss
       JOIN skills s ON ss.skill_id = s.skill_id
       WHERE ss.student_id = ?
       ORDER BY s.category, s.skill_name`,
      [sId]
    );
    res.json({ success: true, data: updated });
  });

  app.delete('/api/skills', requireAuth, async (req: AuthedRequest, res: Response) => {
    const sId = Number(req.query.studentId);
    const skId = Number(req.query.skillId);
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot remove student skills.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== sId) {
      res.status(403).json({ success: false, error: 'Forbidden.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, sId)) {
      res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned branches.' });
      return;
    }
    executeSql(db, 'DELETE FROM student_skills WHERE student_id = ? AND skill_id = ?', [sId, skId]);
    res.json({ success: true, data: { removed: true } });
  });

  // ---------------- COMPANY DIRECTORY ROUTES ----------------
  app.get('/api/companies', requireAuth, async (req: Request, res: Response) => {
    const db = await getDb();
    const q = req.query.q ? `%${String(req.query.q).trim()}%` : '%%';
    const industry = req.query.industry ? String(req.query.industry).trim() : '';
    let sql = `SELECT c.*,
                      cc.contact_person, cc.designation, cc.contact_email, cc.contact_phone,
                      (SELECT COUNT(*) FROM placement_drives pd WHERE pd.company_id = c.company_id) AS driveCount,
                      (SELECT COUNT(*) FROM placements p WHERE p.company_id = c.company_id) AS placedCount
               FROM companies c
               LEFT JOIN company_contacts cc ON c.company_id = cc.company_id AND cc.is_primary = 1
               WHERE (c.company_name LIKE ? OR c.industry LIKE ? OR c.headquarters LIKE ?)`;
    const params: unknown[] = [q, q, q];
    if (industry) {
      sql += ' AND c.industry = ?';
      params.push(industry);
    }
    sql += ' ORDER BY c.company_name ASC';
    res.json({ success: true, data: queryAll(db, sql, params) });
  });

  app.post('/api/companies', requireAuth, requireApprovingAuthority, async (req: AuthedRequest, res: Response) => {
    const {
      companyName,
      industry,
      officialWebsite,
      careerPageUrl,
      headquarters,
      description,
      contactPerson,
      contactEmail,
      contactPhone,
      logoUrl,
    } = req.body ?? {};
    if (!companyName || !industry || !officialWebsite || !headquarters) {
      res.status(400).json({ success: false, error: 'Company name, industry, official website, and headquarters are required.' });
      return;
    }
    const db = await getDb();
    const dup = queryOne(db, 'SELECT company_id FROM companies WHERE LOWER(company_name) = LOWER(?)', [String(companyName).trim()]);
    if (dup) {
      res.status(409).json({ success: false, error: 'Company is already registered in the directory.' });
      return;
    }
    const result = executeSql(
      db,
      `INSERT INTO companies (company_name, logo_url, industry, official_website, career_page_url, headquarters, description, is_directory_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        companyName.trim(),
        logoUrl || null,
        industry.trim(),
        officialWebsite.trim(),
        (careerPageUrl || officialWebsite).trim(),
        headquarters.trim(),
        description || '',
      ]
    );
    if (contactPerson || contactEmail) {
      executeSql(
        db,
        'INSERT INTO company_contacts (company_id, contact_person, designation, contact_email, contact_phone, is_primary) VALUES (?, ?, ?, ?, ?, 1)',
        [result.lastInsertRowid, contactPerson || 'Campus Relations', 'Talent Acquisition', contactEmail || '', contactPhone || '']
      );
    }
    await logActivity(req.authUser?.userId ?? null, req.authUser?.fullName ?? 'Staff', 'COMPANY', `Added company to directory: ${companyName}`);
    res.status(201).json({ success: true, data: queryOne(db, 'SELECT * FROM companies WHERE company_id = ?', [result.lastInsertRowid]) });
  });

  app.put('/api/companies/:id', requireAuth, requireApprovingAuthority, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const {
      companyName,
      industry,
      officialWebsite,
      careerPageUrl,
      headquarters,
      description,
      contactPerson,
      contactEmail,
      contactPhone,
    } = req.body ?? {};
    const db = await getDb();
    executeSql(
      db,
      `UPDATE companies SET company_name=?, industry=?, official_website=?, career_page_url=?, headquarters=?, description=?, updated_at=CURRENT_TIMESTAMP
       WHERE company_id=?`,
      [companyName, industry, officialWebsite, careerPageUrl || officialWebsite, headquarters, description || '', id]
    );
    const existingContact = queryOne<{ contact_id: number }>(db, 'SELECT contact_id FROM company_contacts WHERE company_id = ? AND is_primary = 1', [id]);
    if (existingContact) {
      executeSql(
        db,
        'UPDATE company_contacts SET contact_person=?, contact_email=?, contact_phone=? WHERE contact_id=?',
        [contactPerson || 'Campus Relations', contactEmail || '', contactPhone || '', existingContact.contact_id]
      );
    }
    res.json({ success: true, data: queryOne(db, 'SELECT * FROM companies WHERE company_id = ?', [id]) });
  });

  app.delete('/api/companies/:id', requireAuth, requireAdminOnly, async (req: Request, res: Response) => {
    const db = await getDb();
    executeSql(db, 'DELETE FROM companies WHERE company_id = ?', [Number(req.params.id)]);
    res.json({ success: true, data: { deleted: true } });
  });

  // ---------------- PLACEMENT DRIVES & OPPORTUNITY BOARD ----------------
  app.get('/api/drives', requireAuth, async (req: AuthedRequest, res: Response) => {
    const drives = await hydrateAllDrives();
    if (req.authUser?.role === 'STUDENT') {
      res.json({ success: true, data: drives.filter((d) => (d.approval_status ?? 'Approved') === 'Approved') });
      return;
    }
    if (req.authUser?.role === 'RECRUITER') {
      res.json({
        success: true,
        data: drives.filter(
          (d) => (d.approval_status ?? 'Approved') === 'Approved' || d.company_id === req.authUser?.companyId
        ),
      });
      return;
    }
    res.json({ success: true, data: drives });
  });

  app.post('/api/drives', requireAuth, async (req: AuthedRequest, res: Response) => {
    const role = req.authUser?.role;
    if ((!isPlacementAdminRole(role) || role === 'VICE_CHAIRMAN') && role !== 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Only Placement Officers, System Admin, Principal, Chairman, or verified Recruiters can create drives.' });
      return;
    }
    if (role === 'RECRUITER' && req.authUser?.approvalStatus !== 'Approved') {
      res.status(403).json({
        success: false,
        error: 'Your recruiter account is awaiting GCET Placement Cell approval before posting drives.',
      });
      return;
    }

    const {
      companyId,
      jobRole,
      jobDescription,
      jobLocation,
      jobType,
      salaryPackage,
      compensationLabel,
      applyUrl,
      driveDate,
      applicationDeadline,
      driveStatus,
      minCgpa,
      eligibleBranches,
      graduationYear,
      maxBacklogs,
      otherCriteria,
      requiredSkills,
    } = req.body ?? {};
    const effectiveCompanyId = role === 'RECRUITER' ? req.authUser?.companyId : Number(companyId);
    if (!effectiveCompanyId || !jobRole || salaryPackage === undefined || !driveDate || !applicationDeadline) {
      res.status(400).json({ success: false, error: 'Company, job role, salary package, and dates are required.' });
      return;
    }
    const db = await getDb();
    const postedDate = new Date().toISOString().slice(0, 10);
    const approvalStatus = role === 'RECRUITER' ? 'Pending' : 'Approved';
    const effectiveDriveStatus = role === 'RECRUITER' ? 'Planned' : driveStatus || 'Planned';

    const dRes = executeSql(
      db,
      `INSERT INTO placement_drives (company_id, job_role, job_description, job_location, job_type, salary_package, compensation_label, apply_url, posted_date, drive_date, application_deadline, drive_status, approval_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(effectiveCompanyId),
        jobRole.trim(),
        jobDescription || '',
        jobLocation || 'Hyderabad',
        jobType || 'On-Campus Drive',
        Number(salaryPackage),
        compensationLabel || `${Number(salaryPackage).toFixed(2)} LPA`,
        applyUrl || null,
        postedDate,
        driveDate,
        applicationDeadline,
        effectiveDriveStatus,
        approvalStatus,
        req.authUser?.userId ?? null,
      ]
    );
    const driveId = dRes.lastInsertRowid;
    executeSql(
      db,
      `INSERT INTO drive_eligibility (drive_id, min_cgpa, eligible_branches, graduation_year, max_backlogs, other_criteria)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        driveId,
        Number(minCgpa) || 6.5,
        eligibleBranches || 'CSE,CSE-AIML,CSE-DS,CSE-CS,IT,ECE',
        Number(graduationYear) || 2027,
        Number(maxBacklogs) || 0,
        otherCriteria || '',
      ]
    );

    if (Array.isArray(requiredSkills)) {
      for (const rs of requiredSkills) {
        if (rs.skillId && rs.requiredLevel) {
          executeSql(db, 'INSERT INTO drive_required_skills (drive_id, skill_id, required_level, weightage) VALUES (?, ?, ?, ?)', [
            driveId,
            Number(rs.skillId),
            Number(rs.requiredLevel),
            Number(rs.weightage) || 1.0,
          ]);
        }
      }
    }

    if (approvalStatus === 'Pending') {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (NULL, ?, ?, 'Placement Notifications', 'approvals')`,
        [
          `Recruiter Drive Pending Approval: ${jobRole.trim()}`,
          `${req.authUser?.fullName} submitted a new drive awaiting Placement Cell verification.`,
        ]
      );
    } else if (approvalStatus === 'Approved') {
      await notifyEligibleStudentsForDrive(driveId);
    }

    await logActivity(
      req.authUser?.userId ?? null,
      req.authUser?.fullName ?? 'Staff',
      'DRIVE',
      approvalStatus === 'Pending' ? `Submitted drive for approval: ${jobRole}` : `Published drive: ${jobRole}`
    );
    res.status(201).json({ success: true, data: await hydrateDrive(driveId) });
  });

  app.put('/api/drives/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const role = req.authUser?.role;
      if ((!isPlacementAdminRole(role) || role === 'VICE_CHAIRMAN') && role !== 'RECRUITER') {
        res.status(403).json({ success: false, error: 'Insufficient permissions to edit drive.' });
        return;
      }
      const driveId = Number(req.params.id);
      const db = await getDb();
      const existingDrive = queryOne<Record<string, unknown>>(db, 'SELECT * FROM placement_drives WHERE drive_id = ?', [driveId]);
      if (!existingDrive) {
        res.status(404).json({ success: false, error: 'Drive not found.' });
        return;
      }
      if (role === 'RECRUITER' && Number(existingDrive.company_id) !== req.authUser?.companyId) {
        res.status(403).json({ success: false, error: 'Recruiters can only edit drives for their own company.' });
        return;
      }

      const b = req.body ?? {};
      const nextCompanyId = role === 'RECRUITER' ? Number(existingDrive.company_id) : Number(b.companyId ?? existingDrive.company_id);
      const nextJobRole = String(b.jobRole ?? existingDrive.job_role ?? '').trim();
      const nextSalary = b.salaryPackage !== undefined ? Number(b.salaryPackage) : Number(existingDrive.salary_package);
      const nextDriveDate = String(b.driveDate ?? existingDrive.drive_date ?? '').trim();
      const nextDeadline = String(b.applicationDeadline ?? existingDrive.application_deadline ?? '').trim();
      const nextStatus = String(b.driveStatus ?? existingDrive.drive_status ?? 'Planned').trim();

      if (!nextJobRole || !Number.isFinite(nextSalary) || nextSalary < 0 || !nextDriveDate || !nextDeadline) {
        res.status(400).json({ success: false, error: 'Job role, valid salary package, drive date, and deadline are required.' });
        return;
      }

      executeSql(
        db,
        `UPDATE placement_drives SET company_id=?, job_role=?, job_description=?, job_location=?, job_type=?, salary_package=?, compensation_label=?, apply_url=?, drive_date=?, application_deadline=?, drive_status=?, updated_at=CURRENT_TIMESTAMP
         WHERE drive_id=?`,
        [
          nextCompanyId,
          nextJobRole,
          b.jobDescription !== undefined ? String(b.jobDescription) : String(existingDrive.job_description || ''),
          b.jobLocation !== undefined ? String(b.jobLocation) : String(existingDrive.job_location || 'Hyderabad'),
          b.jobType !== undefined ? String(b.jobType) : String(existingDrive.job_type || 'On-Campus Drive'),
          nextSalary,
          b.compensationLabel || `${nextSalary.toFixed(2)} LPA`,
          b.applyUrl !== undefined ? (b.applyUrl || null) : (existingDrive.apply_url ?? null),
          nextDriveDate,
          nextDeadline,
          nextStatus,
          driveId,
        ]
      );
      const existingElig = queryOne<Record<string, unknown>>(db, 'SELECT * FROM drive_eligibility WHERE drive_id = ?', [driveId]);
      if (existingElig) {
        executeSql(
          db,
          `UPDATE drive_eligibility SET min_cgpa=?, eligible_branches=?, graduation_year=?, max_backlogs=?, other_criteria=? WHERE drive_id=?`,
          [
            b.minCgpa !== undefined ? Number(b.minCgpa) : Number(existingElig.min_cgpa ?? 6.0),
            b.eligibleBranches ?? existingElig.eligible_branches ?? 'CSE',
            b.graduationYear !== undefined ? Number(b.graduationYear) : Number(existingElig.graduation_year ?? 2027),
            b.maxBacklogs !== undefined ? Number(b.maxBacklogs) : Number(existingElig.max_backlogs ?? 0),
            b.otherCriteria !== undefined ? String(b.otherCriteria) : String(existingElig.other_criteria ?? ''),
            driveId,
          ]
        );
      }
      if (Array.isArray(b.requiredSkills)) {
        executeSql(db, 'DELETE FROM drive_required_skills WHERE drive_id = ?', [driveId]);
        for (const rs of b.requiredSkills) {
          if (rs.skillId && rs.requiredLevel) {
            executeSql(db, 'INSERT INTO drive_required_skills (drive_id, skill_id, required_level, weightage) VALUES (?, ?, ?, ?)', [
              driveId,
              Number(rs.skillId),
              Number(rs.requiredLevel),
              Number(rs.weightage) || 1.0,
            ]);
          }
        }
      }
      await notifyEligibleStudentsForDrive(driveId);
      res.json({ success: true, data: await hydrateDrive(driveId) });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to update placement drive.' });
    }
  });

  app.delete('/api/drives/:id', requireAuth, requireAdminOnly, async (req: Request, res: Response) => {
    const db = await getDb();
    executeSql(db, 'DELETE FROM placement_drives WHERE drive_id = ?', [Number(req.params.id)]);
    res.json({ success: true, data: { deleted: true } });
  });

  // ---------------- ELIGIBILITY, SKILL GAP & COMPANY MATCHING ----------------
  app.get('/api/eligibility', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot inspect private student eligibility reports.' });
      return;
    }
    const studentId = Number(req.query.studentId);
    const driveId = req.query.driveId ? Number(req.query.driveId) : null;
    if (!studentId) {
      res.status(400).json({ success: false, error: 'studentId is required.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Students may only inspect their own eligibility.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, studentId)) {
      res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned branches.' });
      return;
    }
    const student = queryOne<StudentRecord>(db, 'SELECT * FROM students WHERE student_id = ?', [studentId]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }
    const skills = queryAll<StudentSkillRecord>(
      db,
      `SELECT ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
       FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ?`,
      [studentId]
    );

    if (driveId) {
      const drive = await hydrateDrive(driveId);
      if (!drive) {
        res.status(404).json({ success: false, error: 'Placement drive not found.' });
        return;
      }
      res.json({ success: true, data: evaluateEligibility(student, skills, drive) });
      return;
    }

    const drives = await hydrateAllDrives();
    res.json({ success: true, data: drives.map((d) => evaluateEligibility(student, skills, d)) });
  });

  app.get('/api/skill-gap', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot inspect private student skill gap reports.' });
      return;
    }
    const studentId = Number(req.query.studentId);
    const driveId = Number(req.query.driveId);
    if (!studentId || !driveId) {
      res.status(400).json({ success: false, error: 'Both studentId and driveId are required.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Students may only inspect their own skill gap.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, studentId)) {
      res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned branches.' });
      return;
    }
    const student = queryOne<StudentRecord>(db, 'SELECT * FROM students WHERE student_id = ?', [studentId]);
    const drive = await hydrateDrive(driveId);
    if (!student || !drive) {
      res.status(404).json({ success: false, error: 'Student or placement drive not found.' });
      return;
    }
    const skills = queryAll<StudentSkillRecord>(
      db,
      `SELECT ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
       FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ?`,
      [studentId]
    );
    res.json({ success: true, data: analyzeSkillGap(student, skills, drive) });
  });

  app.get('/api/matching', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot inspect student company matching reports.' });
      return;
    }
    const studentId = Number(req.query.studentId);
    if (!studentId) {
      res.status(400).json({ success: false, error: 'studentId is required.' });
      return;
    }
    if (req.authUser?.role === 'STUDENT' && req.authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Students may only inspect their own company matches.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, studentId)) {
      res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned branches.' });
      return;
    }
    const student = queryOne<StudentRecord>(db, 'SELECT * FROM students WHERE student_id = ?', [studentId]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }
    const skills = queryAll<StudentSkillRecord>(
      db,
      `SELECT ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
       FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ?`,
      [studentId]
    );
    const drives = await hydrateAllDrives();
    res.json({ success: true, data: matchStudentToDrives(student, skills, drives) });
  });

  // ---------------- APPLICATIONS ----------------
  app.get('/api/applications', requireAuth, async (req: AuthedRequest, res: Response) => {
    const db = await getDb();
    const authUser = req.authUser!;
    const studentFilter =
      authUser.role === 'STUDENT' && authUser.studentId
        ? authUser.studentId
        : req.query.studentId
        ? Number(req.query.studentId)
        : null;

    if (studentFilter && isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, studentFilter)) {
      res.status(403).json({ success: false, error: 'Access denied: student belongs to another department.' });
      return;
    }

    let sql = `SELECT a.*, s.full_name AS student_name, s.roll_number, s.branch, s.cgpa, s.resume_url,
                      c.company_name, pd.job_role, pd.job_type, pd.salary_package, pd.drive_date
               FROM applications a
               JOIN students s ON a.student_id = s.student_id
               JOIN placement_drives pd ON a.drive_id = pd.drive_id
               JOIN companies c ON pd.company_id = c.company_id`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (studentFilter) {
      conditions.push('a.student_id = ?');
      params.push(studentFilter);
    }
    if (authUser.role === 'RECRUITER') {
      conditions.push('pd.company_id = ?');
      params.push(authUser.companyId ?? -1);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY a.applied_at DESC';
    let rows = queryAll<{ branch: string } & Record<string, unknown>>(db, sql, params);
    if (isFacultyRole(authUser.role)) {
      const assignedBranches = getFacultyAssignedBranches(db, authUser.userId, authUser.assignedBranch);
      rows = rows.filter((r) => branchMatchesFacultyScope(String(r.branch || ''), assignedBranches));
    }
    res.json({ success: true, data: rows });
  });

  app.post('/api/applications', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot submit placement applications on behalf of students.' });
      return;
    }
    const { studentId, driveId } = req.body ?? {};
    const targetStudentId =
      req.authUser?.role === 'STUDENT' && req.authUser.studentId ? req.authUser.studentId : Number(studentId);
    const targetDriveId = Number(driveId);

    if (!targetStudentId || !targetDriveId) {
      res.status(400).json({ success: false, error: 'Student and Placement Drive are required.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(req.authUser?.role) && !canFacultyAccessStudent(db, req.authUser!, targetStudentId)) {
      res.status(403).json({ success: false, error: 'Access denied: cannot apply on behalf of students outside your department.' });
      return;
    }
    const student = queryOne<StudentRecord>(db, 'SELECT * FROM students WHERE student_id = ?', [targetStudentId]);
    const drive = await hydrateDrive(targetDriveId);
    if (!student || !drive) {
      res.status(404).json({ success: false, error: 'Student or placement drive not found.' });
      return;
    }
    if ((drive.approval_status ?? 'Approved') !== 'Approved' || drive.drive_status !== 'Active') {
      res.status(400).json({ success: false, error: 'Applications are only open for Approved Active drives.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (drive.application_deadline && today > drive.application_deadline) {
      res.status(400).json({ success: false, error: 'Application deadline for this drive has passed.' });
      return;
    }
    const dup = queryOne(db, 'SELECT application_id FROM applications WHERE drive_id = ? AND student_id = ?', [
      targetDriveId,
      targetStudentId,
    ]);
    if (dup) {
      res.status(409).json({ success: false, error: 'Duplicate application prevented: student has already applied to this drive.' });
      return;
    }

    const skills = queryAll<StudentSkillRecord>(
      db,
      `SELECT ss.skill_id, s.skill_name, s.category, ss.proficiency_level, ss.verified
       FROM student_skills ss JOIN skills s ON ss.skill_id = s.skill_id WHERE ss.student_id = ?`,
      [targetStudentId]
    );
    const elig = evaluateEligibility(student, skills, drive);
    if (!elig.eligible) {
      res.status(400).json({ success: false, error: `Not eligible: ${elig.rejectionReasons.join('; ')}` });
      return;
    }

    const ins = executeSql(
      db,
      "INSERT INTO applications (drive_id, student_id, status, remarks) VALUES (?, ?, 'Applied', 'Eligibility verified via GCET Placement Hub')",
      [targetDriveId, targetStudentId]
    );
    if (student.placement_status === 'Unplaced') {
      executeSql(db, "UPDATE students SET placement_status = 'In Process' WHERE student_id = ?", [targetStudentId]);
    }
    await logActivity(
      req.authUser?.userId ?? null,
      student.full_name,
      'APPLICATION',
      `${student.roll_number} applied to ${drive.company_name} — ${drive.job_role}`
    );
    res.status(201).json({ success: true, data: queryOne(db, 'SELECT * FROM applications WHERE application_id = ?', [ins.lastInsertRowid]) });
  });

  app.put('/api/applications/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    const role = req.authUser?.role;
    if (!isPlacementAdminRole(role) && role !== 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Insufficient permissions to update applications.' });
      return;
    }
    const appId = Number(req.params.id);
    const { status, remarks, interviewDate, interviewMode } = req.body ?? {};
    const valid = ['Applied', 'Shortlisted', 'Assessment', 'Interview', 'Selected', 'Rejected'];
    if (!valid.includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid application pipeline status.' });
      return;
    }
    const db = await getDb();
    const appRow = queryOne<{ student_id: number; drive_id: number }>(
      db,
      'SELECT student_id, drive_id FROM applications WHERE application_id = ?',
      [appId]
    );
    if (!appRow) {
      res.status(404).json({ success: false, error: 'Application not found.' });
      return;
    }
    const drive = await hydrateDrive(appRow.drive_id);
    if (role === 'RECRUITER' && drive?.company_id !== req.authUser?.companyId) {
      res.status(403).json({ success: false, error: 'Recruiters can only manage applicants for their own company drives.' });
      return;
    }

    executeSql(
      db,
      `UPDATE applications
       SET status = ?,
           remarks = ?,
           interview_date = COALESCE(?, interview_date),
           interview_mode = COALESCE(?, interview_mode),
           updated_at = CURRENT_TIMESTAMP
       WHERE application_id = ?`,
      [status, remarks || '', interviewDate ?? null, interviewMode ?? null, appId]
    );

    const stuUser = queryOne<{ user_id: number | null }>(db, 'SELECT user_id FROM students WHERE student_id = ?', [appRow.student_id]);
    if (stuUser?.user_id && drive) {
      const msg =
        status === 'Interview' && interviewDate
          ? `Interview scheduled for ${drive.job_role} at ${drive.company_name} on ${interviewDate}${interviewMode ? ` (${interviewMode})` : ''}.`
          : `Your status for ${drive.job_role} at ${drive.company_name} is now ${status}.`;
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'Placement Notifications', 'applications')`,
        [stuUser.user_id, `Application Updated: ${drive.company_name} (${status})`, msg]
      );
    }

    if (status === 'Selected') {
      const existingPlacement = queryOne(db, 'SELECT placement_id FROM placements WHERE student_id = ? AND drive_id = ?', [
        appRow.student_id,
        appRow.drive_id,
      ]);
      if (drive && !existingPlacement) {
        executeSql(
          db,
          `INSERT INTO placements (student_id, drive_id, company_id, job_role, package_lpa, offer_date, joining_status)
           VALUES (?, ?, ?, ?, ?, ?, 'Offered')`,
          [appRow.student_id, drive.drive_id, drive.company_id, drive.job_role, drive.salary_package, new Date().toISOString().slice(0, 10)]
        );
        executeSql(db, "UPDATE students SET placement_status = 'Placed' WHERE student_id = ?", [appRow.student_id]);
      }
    }
    res.json({ success: true, data: { updated: true } });
  });

  // ---------------- PLACEMENTS TRACKING ----------------
  app.get('/api/placements', requireAuth, async (req: AuthedRequest, res: Response) => {
    if (req.authUser?.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot access campus-wide student placement records.' });
      return;
    }
    const db = await getDb();
    let rows = queryAll<{ branch: string } & Record<string, unknown>>(
      db,
      `SELECT p.*, s.full_name AS student_name, s.roll_number, s.branch, c.company_name
       FROM placements p
       JOIN students s ON p.student_id = s.student_id
       JOIN companies c ON p.company_id = c.company_id
       ORDER BY p.offer_date DESC`
    );
    if (isFacultyRole(req.authUser?.role)) {
      const assignedBranches = getFacultyAssignedBranches(db, req.authUser!.userId, req.authUser!.assignedBranch);
      rows = rows.filter((r) => branchMatchesFacultyScope(String(r.branch || ''), assignedBranches));
    }
    res.json({ success: true, data: rows });
  });

  app.post('/api/placements', requireAuth, requireApprovingAuthority, async (req: Request, res: Response) => {
    const { studentId, driveId, packageLpa, offerDate, joiningStatus } = req.body ?? {};
    const db = await getDb();
    const drive = await hydrateDrive(Number(driveId));
    if (!drive) {
      res.status(404).json({ success: false, error: 'Placement drive not found.' });
      return;
    }
    const dup = queryOne(db, 'SELECT placement_id FROM placements WHERE student_id = ? AND drive_id = ?', [
      Number(studentId),
      drive.drive_id,
    ]);
    if (dup) {
      res.status(409).json({ success: false, error: 'Placement record already exists for this student and drive.' });
      return;
    }
    const resIns = executeSql(
      db,
      `INSERT INTO placements (student_id, drive_id, company_id, job_role, package_lpa, offer_date, joining_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(studentId),
        drive.drive_id,
        drive.company_id,
        drive.job_role,
        Number(packageLpa) || drive.salary_package,
        offerDate || new Date().toISOString().slice(0, 10),
        joiningStatus || 'Offered',
      ]
    );
    executeSql(db, "UPDATE students SET placement_status = 'Placed' WHERE student_id = ?", [Number(studentId)]);
    const stuUser = queryOne<{ user_id: number | null }>(db, 'SELECT user_id FROM students WHERE student_id = ?', [Number(studentId)]);
    if (stuUser?.user_id) {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'Placement Notifications', 'placements')`,
        [
          stuUser.user_id,
          `Placement Offer Recorded: ${drive.company_name}`,
          `Congratulations! Your ${drive.job_role} placement offer (${Number(packageLpa) || drive.salary_package} LPA) is now recorded as ${joiningStatus || 'Offered'}.`,
        ]
      );
    }
    res.status(201).json({ success: true, data: queryOne(db, 'SELECT * FROM placements WHERE placement_id = ?', [resIns.lastInsertRowid]) });
  });

  app.put('/api/placements/:id', requireAuth, requireApprovingAuthority, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { joiningStatus, packageLpa } = req.body ?? {};
    const db = await getDb();
    executeSql(
      db,
      'UPDATE placements SET joining_status = ?, package_lpa = COALESCE(?, package_lpa), updated_at = CURRENT_TIMESTAMP WHERE placement_id = ?',
      [joiningStatus, packageLpa ? Number(packageLpa) : null, id]
    );
    res.json({ success: true, data: { updated: true } });
  });

  // ---------------- STUDENT PROFILE APPROVAL WORKFLOW ----------------
  app.get('/api/student-profile/:studentId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const studentId = Number(req.params.studentId);
    const authUser = req.authUser!;
    if (authUser.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot access private student profile dossiers.' });
      return;
    }
    if (authUser.role === 'STUDENT' && authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Students may only access their own profile.' });
      return;
    }

    const db = await getDb();
    if (isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, studentId)) {
      res.status(403).json({ success: false, error: 'Access denied: student is outside your assigned department/branch.' });
      return;
    }

    const built = buildOfficialDossier(db, studentId);
    if (!built) {
      res.status(404).json({ success: false, error: 'Student profile not found.' });
      return;
    }

    const latestSubRow = queryOne<Record<string, unknown>>(
      db,
      `SELECT ps.*,
              s.full_name AS student_name, s.roll_number, s.branch, s.section,
              af.full_name AS assigned_faculty_name,
              rv.full_name AS reviewed_by_name
       FROM profile_submissions ps
       JOIN students s ON ps.student_id = s.student_id
       LEFT JOIN users af ON ps.assigned_faculty_id = af.user_id
       LEFT JOIN users rv ON ps.reviewed_by = rv.user_id
       WHERE ps.student_id = ?
       ORDER BY ps.submission_id DESC
       LIMIT 1`,
      [studentId]
    );

    const latestSubmission = latestSubRow ? hydrateSubmissionRow(db, latestSubRow) : null;
    const history = queryAll<Record<string, unknown>>(
      db,
      `SELECT pah.*, ps.submission_code
       FROM profile_approval_history pah
       LEFT JOIN profile_submissions ps ON pah.submission_id = ps.submission_id
       WHERE pah.student_id = ?
       ORDER BY pah.history_id DESC`,
      [studentId]
    );

    const st = built.officialStudent;
    const assignedFaculty = resolveAssignedFaculty(
      db,
      studentId,
      String(st.branch || ''),
      String(st.section || 'A')
    );

    res.json({
      success: true,
      data: {
        officialStudent: built.officialStudent,
        officialDossier: built.officialDossier,
        latestSubmission,
        approvalHistory: history,
        assignedFaculty,
        completionPercentage: built.completionPercentage,
        currentApprovalStatus: latestSubmission ? latestSubmission.status : 'APPROVED',
      },
    });
  });

  app.get('/api/student-profile/:studentId/resume', requireAuth, async (req: AuthedRequest, res: Response) => {
    const studentId = Number(req.params.studentId);
    const authUser = req.authUser!;
    if (authUser.role === 'RECRUITER') {
      res.status(403).json({ success: false, error: 'Recruiters cannot download private student dossiers from this endpoint.' });
      return;
    }
    if (authUser.role === 'STUDENT' && authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Forbidden.' });
      return;
    }
    const db = await getDb();
    if (isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, studentId)) {
      res.status(403).json({ success: false, error: 'Access denied for this student.' });
      return;
    }
    const scope = String(req.query.scope || 'official');
    if (scope === 'pending') {
      const sub = queryOne<{ draft_payload_json: string }>(
        db,
        'SELECT draft_payload_json FROM profile_submissions WHERE student_id = ? ORDER BY submission_id DESC LIMIT 1',
        [studentId]
      );
      if (sub) {
        try {
          const parsed = JSON.parse(sub.draft_payload_json);
          if (parsed?.resume?.file_data_url) {
            res.json({ success: true, data: parsed.resume });
            return;
          }
        } catch {
          // fallback to official
        }
      }
    }
    const row = queryOne(db, 'SELECT * FROM student_resumes WHERE student_id = ?', [studentId]);
    if (!row) {
      res.status(404).json({ success: false, error: 'No uploaded PDF resume found.' });
      return;
    }
    res.json({ success: true, data: row });
  });

  app.post('/api/student-profile/:studentId/draft', requireAuth, async (req: AuthedRequest, res: Response) => {
    const studentId = Number(req.params.studentId);
    const authUser = req.authUser!;
    if (authUser.role === 'STUDENT' && authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Students may only edit their own profile.' });
      return;
    }
    if (authUser.role !== 'STUDENT' && !isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only the student or placement administration may save a student profile draft.' });
      return;
    }

    const db = await getDb();
    const built = buildOfficialDossier(db, studentId);
    if (!built) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }

    const validated = normalizeAndValidateDraft(req.body, built.officialDossier, false);
    if (validated.valid === false) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const diffs = computeFieldDiffs(built.officialDossier, validated.payload);
    const assignedFaculty = resolveAssignedFaculty(
      db,
      studentId,
      String(built.officialStudent.branch || ''),
      String(built.officialStudent.section || 'A')
    );

    const existingSub = queryOne<{ submission_id: number; status: string; submission_code: string }>(
      db,
      'SELECT submission_id, status, submission_code FROM profile_submissions WHERE student_id = ? ORDER BY submission_id DESC LIMIT 1',
      [studentId]
    );

    let submissionId: number;
    let submissionCode: string;
    if (existingSub && (existingSub.status === 'DRAFT' || existingSub.status === 'CORRECTION_REQUESTED')) {
      submissionId = existingSub.submission_id;
      submissionCode = existingSub.submission_code;
      executeSql(
        db,
        `UPDATE profile_submissions
         SET status = 'DRAFT',
             assigned_faculty_id = COALESCE(?, assigned_faculty_id),
             draft_payload_json = ?,
             previous_snapshot_json = ?,
             changed_fields_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = ?`,
        [
          assignedFaculty?.user_id ?? null,
          JSON.stringify(validated.payload),
          JSON.stringify(built.officialDossier),
          JSON.stringify(diffs),
          submissionId,
        ]
      );
    } else {
      submissionCode = generateSubmissionCode(db);
      const ins = executeSql(
        db,
        `INSERT INTO profile_submissions (
           submission_code, student_id, assigned_faculty_id, status,
           draft_payload_json, previous_snapshot_json, changed_fields_json
         ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?)`,
        [
          submissionCode,
          studentId,
          assignedFaculty?.user_id ?? null,
          JSON.stringify(validated.payload),
          JSON.stringify(built.officialDossier),
          JSON.stringify(diffs),
        ]
      );
      submissionId = ins.lastInsertRowid;
    }

    executeSql(
      db,
      `INSERT INTO profile_approval_history (submission_id, student_id, faculty_user_id, faculty_name, action, remarks)
       VALUES (?, ?, ?, ?, 'DRAFT_SAVED', ?)`,
      [submissionId, studentId, authUser.userId, authUser.fullName, `Draft saved (${diffs.length} pending change(s)). Official profile unchanged.`]
    );

    res.json({
      success: true,
      data: {
        submissionId,
        submissionCode,
        status: 'DRAFT',
        changedCount: diffs.length,
        message: 'Profile changes saved as Draft. Your Official Profile remains unchanged until Faculty approval.',
      },
    });
  });

  app.post('/api/student-profile/:studentId/submit', requireAuth, async (req: AuthedRequest, res: Response) => {
    const studentId = Number(req.params.studentId);
    const authUser = req.authUser!;
    if (authUser.role === 'STUDENT' && authUser.studentId !== studentId) {
      res.status(403).json({ success: false, error: 'Students may only submit their own profile.' });
      return;
    }
    if (authUser.role !== 'STUDENT' && !isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only the student may submit profile changes for faculty review.' });
      return;
    }

    const db = await getDb();
    const built = buildOfficialDossier(db, studentId);
    if (!built) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }

    const validated = normalizeAndValidateDraft(req.body, built.officialDossier, true);
    if (validated.valid === false) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const diffs = computeFieldDiffs(built.officialDossier, validated.payload);
    const assignedFaculty = resolveAssignedFaculty(
      db,
      studentId,
      String(built.officialStudent.branch || ''),
      String(built.officialStudent.section || 'A')
    );

    const priorCount = queryOne<{ c: number }>(
      db,
      "SELECT COUNT(*) AS c FROM profile_submissions WHERE student_id = ? AND status != 'DRAFT'",
      [studentId]
    )?.c ?? 0;

    const existingOpen = queryOne<{ submission_id: number; status: string; submission_code: string }>(
      db,
      'SELECT submission_id, status, submission_code FROM profile_submissions WHERE student_id = ? ORDER BY submission_id DESC LIMIT 1',
      [studentId]
    );

    let submissionId: number;
    let submissionCode: string;
    const isResubmit = priorCount > 0;

    if (
      existingOpen &&
      (existingOpen.status === 'DRAFT' ||
        existingOpen.status === 'CORRECTION_REQUESTED' ||
        existingOpen.status === 'WAITING_FOR_APPROVAL')
    ) {
      submissionId = existingOpen.submission_id;
      submissionCode = existingOpen.submission_code;
      executeSql(
        db,
        `UPDATE profile_submissions
         SET assigned_faculty_id = ?,
             status = 'WAITING_FOR_APPROVAL',
             draft_payload_json = ?,
             previous_snapshot_json = ?,
             changed_fields_json = ?,
             submitted_at = CURRENT_TIMESTAMP,
             reviewed_by = NULL,
             reviewed_at = NULL,
             faculty_remarks = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = ?`,
        [
          assignedFaculty?.user_id ?? null,
          JSON.stringify(validated.payload),
          JSON.stringify(built.officialDossier),
          JSON.stringify(diffs),
          submissionId,
        ]
      );
      executeSql(db, 'DELETE FROM profile_submission_details WHERE submission_id = ?', [submissionId]);
    } else {
      submissionCode = generateSubmissionCode(db);
      const ins = executeSql(
        db,
        `INSERT INTO profile_submissions (
           submission_code, student_id, assigned_faculty_id, status,
           draft_payload_json, previous_snapshot_json, changed_fields_json, submitted_at
         ) VALUES (?, ?, ?, 'WAITING_FOR_APPROVAL', ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          submissionCode,
          studentId,
          assignedFaculty?.user_id ?? null,
          JSON.stringify(validated.payload),
          JSON.stringify(built.officialDossier),
          JSON.stringify(diffs),
        ]
      );
      submissionId = ins.lastInsertRowid;
    }

    for (const d of diffs) {
      executeSql(
        db,
        `INSERT INTO profile_submission_details (submission_id, section_name, field_key, field_label, previous_value, new_value, is_changed)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [submissionId, d.section_name, d.field_key, d.field_label, d.previous_value, d.new_value]
      );
    }

    const actionType = isResubmit ? 'RESUBMITTED' : 'SUBMITTED';
    executeSql(
      db,
      `INSERT INTO profile_approval_history (submission_id, student_id, faculty_user_id, faculty_name, action, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        studentId,
        assignedFaculty?.user_id ?? null,
        assignedFaculty?.full_name || 'Department Faculty Coordinator',
        actionType,
        `Submitted ${diffs.length} modified field(s) for faculty verification (${submissionCode}).`,
      ]
    );

    // Notify student
    const stuUser = queryOne<{ user_id: number | null }>(db, 'SELECT user_id FROM students WHERE student_id = ?', [studentId]);
    if (stuUser?.user_id) {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'System Alerts', 'profile')`,
        [
          stuUser.user_id,
          `Profile Submitted · ${submissionCode}`,
          `Your profile changes (${diffs.length} field(s)) have been submitted and are Waiting For Approval by ${assignedFaculty?.full_name || 'your Faculty Coordinator'}. Your official profile remains unchanged until approved.`,
        ]
      );
    }

    // Notify assigned faculty (and TPO/Admin fallback)
    if (assignedFaculty?.user_id) {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'Student Verification', 'profile-approvals')`,
        [
          assignedFaculty.user_id,
          isResubmit ? `Profile Resubmitted: ${built.officialStudent.roll_number}` : `New Student Profile Submitted: ${built.officialStudent.roll_number}`,
          `${built.officialStudent.full_name} (${built.officialStudent.roll_number}, ${built.officialStudent.branch}) submitted profile changes (${submissionCode}) for verification.`,
        ]
      );
    }
    const adminNotifs = queryAll<{ user_id: number }>(
      db,
      "SELECT user_id FROM users WHERE role IN ('ADMIN', 'PLACEMENT_OFFICER') AND is_active = 1 AND user_id != ?",
      [assignedFaculty?.user_id ?? -1]
    );
    for (const adm of adminNotifs) {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'Student Verification', 'profile-approvals')`,
        [
          adm.user_id,
          `Profile Pending Review: ${built.officialStudent.roll_number}`,
          `${built.officialStudent.full_name} (${built.officialStudent.branch}) submitted ${submissionCode} for faculty verification.`,
        ]
      );
    }

    await logActivity(
      authUser.userId,
      authUser.fullName,
      'STUDENT',
      `Submitted student profile revision ${submissionCode} (${diffs.length} change(s)) for faculty approval`
    );

    res.json({
      success: true,
      data: {
        submissionId,
        submissionCode,
        status: 'WAITING_FOR_APPROVAL',
        assignedFaculty,
        changedCount: diffs.length,
        message: `Profile submitted successfully (${submissionCode}) — Waiting for Faculty Approval.`,
      },
    });
  });

  app.get('/api/faculty/profile-approvals', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only authorized Faculty Coordinators or Placement Administration may access profile approvals.' });
      return;
    }

    const db = await getDb();
    const isFaculty = isFacultyRole(authUser.role);
    const assignedBranches = isFaculty
      ? getFacultyAssignedBranches(db, authUser.userId, authUser.assignedBranch)
      : [];
    const branchFilter = req.query.branch ? String(req.query.branch).trim() : '';
    if (isFaculty && branchFilter && !branchMatchesFacultyScope(branchFilter, assignedBranches)) {
      res.status(403).json({
        success: false,
        error: `Access denied: you are not authorized to access approvals for branch ${branchFilter}.`,
      });
      return;
    }

    const statusFilter = req.query.status ? String(req.query.status).trim() : '';
    let sql = `SELECT ps.submission_id, ps.submission_code, ps.student_id, ps.assigned_faculty_id, ps.status,
                      ps.changed_fields_json, ps.submitted_at, ps.reviewed_by, ps.reviewed_at, ps.faculty_remarks, ps.updated_at,
                      s.full_name AS student_name, s.roll_number, s.branch, s.section, s.cgpa,
                      af.full_name AS assigned_faculty_name,
                      rv.full_name AS reviewed_by_name
               FROM profile_submissions ps
               JOIN students s ON ps.student_id = s.student_id
               LEFT JOIN users af ON ps.assigned_faculty_id = af.user_id
               LEFT JOIN users rv ON ps.reviewed_by = rv.user_id
               WHERE ps.status != 'DRAFT'`;
    const params: unknown[] = [];
    if (statusFilter) {
      sql += ' AND ps.status = ?';
      params.push(statusFilter);
    }
    sql += ` ORDER BY CASE ps.status WHEN 'WAITING_FOR_APPROVAL' THEN 0 WHEN 'CORRECTION_REQUESTED' THEN 1 ELSE 2 END, ps.updated_at DESC`;

    const rawRows = queryAll<Record<string, unknown>>(db, sql, params);
    let scopedRows = rawRows.filter((r) =>
      isFaculty ? canFacultyAccessStudent(db, authUser, Number(r.student_id)) : true
    );
    if (branchFilter) {
      scopedRows = scopedRows.filter((r) => branchMatchesFacultyScope(String(r.branch || ''), [branchFilter]));
    }

    const formatted = scopedRows.map((r) => {
      let changedCount = 0;
      try {
        const arr = JSON.parse(String(r.changed_fields_json || '[]'));
        changedCount = Array.isArray(arr) ? arr.length : 0;
      } catch {
        changedCount = 0;
      }
      return {
        submission_id: Number(r.submission_id),
        submission_code: String(r.submission_code),
        student_id: Number(r.student_id),
        student_name: String(r.student_name),
        roll_number: String(r.roll_number),
        branch: String(r.branch),
        section: String(r.section || 'A'),
        cgpa: Number(r.cgpa || 0),
        assigned_faculty_id: r.assigned_faculty_id ? Number(r.assigned_faculty_id) : null,
        assigned_faculty_name: r.assigned_faculty_name ? String(r.assigned_faculty_name) : null,
        status: String(r.status),
        changedCount,
        submitted_at: r.submitted_at ? String(r.submitted_at) : null,
        reviewed_by_name: r.reviewed_by_name ? String(r.reviewed_by_name) : null,
        reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
        faculty_remarks: r.faculty_remarks ? String(r.faculty_remarks) : null,
        updated_at: String(r.updated_at),
      };
    });

    const pendingCount = formatted.filter((x) => x.status === 'WAITING_FOR_APPROVAL').length;
    res.json({ success: true, data: { submissions: formatted, pendingCount } });
  });

  app.get('/api/faculty/profile-approvals/faculty', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only authorized Placement Administration or Leadership may review faculty profile updates.' });
      return;
    }

    const db = await getDb();
    const statusFilter = req.query.status ? String(req.query.status).trim() : '';
    let sql = `SELECT fps.submission_id, fps.submission_code, fps.faculty_id, fps.user_id, fps.status,
                      fps.changed_fields_json, fps.submitted_at, fps.reviewed_by, fps.reviewed_at, fps.reviewer_remarks, fps.updated_at,
                      COALESCE(f.full_name, u.full_name) AS faculty_name,
                      COALESCE(f.employee_id, u.employee_id) AS employee_id,
                      COALESCE(f.designation, u.designation) AS designation,
                      COALESCE(f.department_name, u.department_name) AS department_name,
                      rv.full_name AS reviewed_by_name
               FROM faculty_profile_submissions fps
               JOIN users u ON fps.user_id = u.user_id
               LEFT JOIN faculty f ON fps.faculty_id = f.faculty_id
               LEFT JOIN users rv ON fps.reviewed_by = rv.user_id
               WHERE fps.status != 'DRAFT'`;
    const params: unknown[] = [];
    if (statusFilter) {
      sql += ' AND fps.status = ?';
      params.push(statusFilter);
    }
    sql += ` ORDER BY CASE fps.status WHEN 'WAITING_FOR_APPROVAL' THEN 0 WHEN 'CORRECTION_REQUESTED' THEN 1 ELSE 2 END, fps.updated_at DESC`;

    const rawRows = queryAll<Record<string, unknown>>(db, sql, params);
    const formatted = rawRows.map((r) => {
      let changedCount = 0;
      try {
        const arr = JSON.parse(String(r.changed_fields_json || '[]'));
        changedCount = Array.isArray(arr) ? arr.length : 0;
      } catch {
        changedCount = 0;
      }
      return {
        submission_id: Number(r.submission_id),
        submission_code: String(r.submission_code),
        faculty_id: Number(r.faculty_id),
        user_id: Number(r.user_id),
        faculty_name: String(r.faculty_name || ''),
        employee_id: String(r.employee_id || ''),
        designation: String(r.designation || ''),
        department_name: String(r.department_name || ''),
        status: String(r.status),
        changedCount,
        submitted_at: r.submitted_at ? String(r.submitted_at) : null,
        reviewed_by_name: r.reviewed_by_name ? String(r.reviewed_by_name) : null,
        reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
        reviewer_remarks: r.reviewer_remarks ? String(r.reviewer_remarks) : null,
        updated_at: String(r.updated_at || ''),
      };
    });

    const pendingCount = formatted.filter((x) => x.status === 'WAITING_FOR_APPROVAL').length;
    res.json({ success: true, data: { submissions: formatted, pendingCount } });
  });

  app.get('/api/faculty/profile-approvals/faculty/:submissionId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const submissionId = Number(req.params.submissionId);
    const db = await getDb();
    const row = queryOne<Record<string, unknown>>(
      db,
      `SELECT fps.*,
              COALESCE(f.full_name, u.full_name) AS faculty_name,
              COALESCE(f.employee_id, u.employee_id) AS employee_id,
              COALESCE(f.designation, u.designation) AS designation,
              COALESCE(f.department_name, u.department_name) AS department_name,
              rv.full_name AS reviewed_by_name
       FROM faculty_profile_submissions fps
       JOIN users u ON fps.user_id = u.user_id
       LEFT JOIN faculty f ON fps.faculty_id = f.faculty_id
       LEFT JOIN users rv ON fps.reviewed_by = rv.user_id
       WHERE fps.submission_id = ?`,
      [submissionId]
    );
    if (!row) {
      res.status(404).json({ success: false, error: 'Faculty profile submission not found.' });
      return;
    }

    const hydrated = hydrateFacultySubmissionRow(row);
    const targetUserId = Number(row.user_id);
    const official = buildOfficialFacultyDossier(db, targetUserId);
    const history = queryAll<Record<string, unknown>>(
      db,
      `SELECT fpah.*, fps.submission_code
       FROM faculty_profile_approval_history fpah
       LEFT JOIN faculty_profile_submissions fps ON fpah.submission_id = fps.submission_id
       WHERE fpah.faculty_id = ?
       ORDER BY fpah.history_id DESC`,
      [Number(row.faculty_id)]
    );

    res.json({
      success: true,
      data: {
        submission: hydrated,
        identity: official?.identity ?? null,
        officialProfile: official?.officialProfile ?? null,
        skills: official?.skills ?? [],
        approvalHistory: history,
      },
    });
  });

  app.post('/api/faculty/profile-approvals/faculty/:submissionId/decision', requireAuth, requireApprovingAuthority, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;

    const submissionId = Number(req.params.submissionId);
    const { decision, remarks } = req.body ?? {};
    if (!['APPROVE', 'REJECT', 'REQUEST_CORRECTION'].includes(decision)) {
      res.status(400).json({ success: false, error: 'Invalid decision. Must be APPROVE, REJECT, or REQUEST_CORRECTION.' });
      return;
    }

    const cleanRemarks = String(remarks || '').trim();
    if ((decision === 'REJECT' || decision === 'REQUEST_CORRECTION') && cleanRemarks.length < 3) {
      res.status(400).json({
        success: false,
        error: decision === 'REJECT' ? 'Rejection reason is required.' : 'Correction comments are required.',
      });
      return;
    }

    const db = await getDb();
    const row = queryOne<Record<string, unknown>>(
      db,
      `SELECT fps.*, COALESCE(f.full_name, u.full_name) AS faculty_name, COALESCE(f.employee_id, u.employee_id) AS employee_id
       FROM faculty_profile_submissions fps
       JOIN users u ON fps.user_id = u.user_id
       LEFT JOIN faculty f ON fps.faculty_id = f.faculty_id
       WHERE fps.submission_id = ?`,
      [submissionId]
    );
    if (!row) {
      res.status(404).json({ success: false, error: 'Faculty profile submission not found.' });
      return;
    }

    const targetUserId = Number(row.user_id);
    if (targetUserId === authUser.userId) {
      res.status(403).json({ success: false, error: 'Self-approval is not permitted. Another authorized administrator must review your submission.' });
      return;
    }

    if (String(row.status) !== 'WAITING_FOR_APPROVAL') {
      res.status(400).json({ success: false, error: `Submission is currently ${row.status} and cannot be decided again until resubmitted.` });
      return;
    }

    const hydrated = hydrateFacultySubmissionRow(row);
    const facultyId = Number(row.faculty_id);

    if (decision === 'APPROVE') {
      if (!hydrated.draft_payload) {
        res.status(400).json({ success: false, error: 'Submitted faculty profile payload could not be parsed.' });
        return;
      }

      applyApprovedFacultyRevisionTransaction(db, submissionId, facultyId, targetUserId, hydrated.draft_payload, authUser, cleanRemarks);

      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'System Alerts', 'faculty-profile')`,
        [
          targetUserId,
          `Faculty Profile Approved · ${hydrated.submission_code}`,
          `Your submitted faculty profile revision (${hydrated.submission_code}) was approved by ${authUser.fullName}. Your official profile has been updated.`,
        ]
      );

      await logActivity(
        authUser.userId,
        authUser.fullName,
        'STUDENT',
        `Approved faculty profile revision ${hydrated.submission_code} for ${row.faculty_name}`
      );

      res.json({
        success: true,
        data: {
          status: 'APPROVED',
          submissionCode: hydrated.submission_code,
          message: `Approved ${hydrated.submission_code}. Official faculty profile has been updated.`,
        },
      });
      return;
    }

    const nextStatus = decision === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUESTED';
    const historyAction = decision === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUESTED';

    executeSql(
      db,
      `UPDATE faculty_profile_submissions
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reviewer_remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ?`,
      [nextStatus, authUser.userId, cleanRemarks, submissionId]
    );

    executeSql(
      db,
      `INSERT INTO faculty_profile_approval_history (submission_id, faculty_id, reviewer_user_id, reviewer_name, action, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [submissionId, facultyId, authUser.userId, authUser.fullName, historyAction, cleanRemarks]
    );

    executeSql(
      db,
      `INSERT INTO notifications (user_id, title, message, category, related_module)
       VALUES (?, ?, ?, 'System Alerts', 'faculty-profile')`,
      [
        targetUserId,
        decision === 'REJECT'
          ? `Faculty Profile Rejected · ${hydrated.submission_code}`
          : `Corrections Requested · ${hydrated.submission_code}`,
        decision === 'REJECT'
          ? `Your faculty profile submission ${hydrated.submission_code} was rejected by ${authUser.fullName}. Reason: ${cleanRemarks}. Your official profile remains unchanged.`
          : `${authUser.fullName} requested corrections on ${hydrated.submission_code}: ${cleanRemarks}. Please update and resubmit.`,
      ]
    );

    await logActivity(
      authUser.userId,
      authUser.fullName,
      'STUDENT',
      `${decision === 'REJECT' ? 'Rejected' : 'Requested corrections on'} faculty profile ${hydrated.submission_code}`
    );

    res.json({
      success: true,
      data: {
        status: nextStatus,
        submissionCode: hydrated.submission_code,
        message:
          decision === 'REJECT'
            ? `Submission ${hydrated.submission_code} rejected. Official faculty profile preserved.`
            : `Correction request sent for ${hydrated.submission_code}. Official faculty profile preserved.`,
      },
    });
  });

  app.get('/api/faculty/profile-approvals/:submissionId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    const submissionId = Number(req.params.submissionId);
    const db = await getDb();
    const row = queryOne<Record<string, unknown>>(
      db,
      `SELECT ps.*,
              s.full_name AS student_name, s.roll_number, s.branch, s.section,
              af.full_name AS assigned_faculty_name,
              rv.full_name AS reviewed_by_name
       FROM profile_submissions ps
       JOIN students s ON ps.student_id = s.student_id
       LEFT JOIN users af ON ps.assigned_faculty_id = af.user_id
       LEFT JOIN users rv ON ps.reviewed_by = rv.user_id
       WHERE ps.submission_id = ?`,
      [submissionId]
    );
    if (!row) {
      res.status(404).json({ success: false, error: 'Profile submission not found.' });
      return;
    }
    const studentId = Number(row.student_id);
    if (isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, studentId)) {
      res.status(403).json({ success: false, error: 'Access denied: student is not assigned to your department/branch.' });
      return;
    }

    const hydrated = hydrateSubmissionRow(db, row);
    const official = buildOfficialDossier(db, studentId);
    const history = queryAll<Record<string, unknown>>(
      db,
      `SELECT pah.*, ps.submission_code
       FROM profile_approval_history pah
       LEFT JOIN profile_submissions ps ON pah.submission_id = ps.submission_id
       WHERE pah.student_id = ?
       ORDER BY pah.history_id DESC`,
      [studentId]
    );

    res.json({
      success: true,
      data: {
        submission: hydrated,
        officialDossier: official?.officialDossier ?? null,
        officialStudent: official?.officialStudent ?? null,
        approvalHistory: history,
      },
    });
  });

  app.post('/api/faculty/profile-approvals/:submissionId/decision', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only assigned Faculty or Placement Administration may review student profiles.' });
      return;
    }

    const submissionId = Number(req.params.submissionId);
    const { decision, remarks } = req.body ?? {};
    if (!['APPROVE', 'REJECT', 'REQUEST_CORRECTION'].includes(decision)) {
      res.status(400).json({ success: false, error: 'Invalid decision. Must be APPROVE, REJECT, or REQUEST_CORRECTION.' });
      return;
    }

    const cleanRemarks = String(remarks || '').trim();
    if ((decision === 'REJECT' || decision === 'REQUEST_CORRECTION') && cleanRemarks.length < 3) {
      res.status(400).json({
        success: false,
        error: decision === 'REJECT' ? 'Rejection reason is required.' : 'Faculty correction comments are required.',
      });
      return;
    }

    const db = await getDb();
    const row = queryOne<Record<string, unknown>>(
      db,
      `SELECT ps.*, s.full_name AS student_name, s.roll_number, s.branch, s.user_id AS student_user_id
       FROM profile_submissions ps
       JOIN students s ON ps.student_id = s.student_id
       WHERE ps.submission_id = ?`,
      [submissionId]
    );
    if (!row) {
      res.status(404).json({ success: false, error: 'Profile submission not found.' });
      return;
    }

    const studentId = Number(row.student_id);
    if (isFacultyRole(authUser.role) && !canFacultyAccessStudent(db, authUser, studentId)) {
      res.status(403).json({ success: false, error: 'Forbidden: you can only approve/reject students assigned to your branch/department.' });
      return;
    }

    if (String(row.status) !== 'WAITING_FOR_APPROVAL') {
      res.status(400).json({ success: false, error: `Submission is currently ${row.status} and cannot be decided again until resubmitted.` });
      return;
    }

    const hydrated = hydrateSubmissionRow(db, row);
    const studentUserId = row.student_user_id ? Number(row.student_user_id) : null;

    if (studentUserId && studentUserId === authUser.userId) {
      res.status(403).json({ success: false, error: 'Self-approval is not permitted.' });
      return;
    }

    if (decision === 'APPROVE') {
      if (!hydrated.draft_payload) {
        res.status(400).json({ success: false, error: 'Submitted payload could not be parsed.' });
        return;
      }
      applyApprovedRevisionTransaction(db, submissionId, studentId, hydrated.draft_payload, authUser, cleanRemarks);

      if (studentUserId) {
        executeSql(
          db,
          `INSERT INTO notifications (user_id, title, message, category, related_module)
           VALUES (?, ?, ?, 'System Alerts', 'profile')`,
          [
            studentUserId,
            `Profile Approved · ${hydrated.submission_code}`,
            `Your submitted profile changes (${hydrated.submission_code}) were approved by ${authUser.fullName}. Your Official Student Profile has been updated.`,
          ]
        );
      }

      await logActivity(
        authUser.userId,
        authUser.fullName,
        'STUDENT',
        `Approved student profile revision ${hydrated.submission_code} for ${row.student_name} (${row.roll_number})`
      );

      res.json({
        success: true,
        data: {
          status: 'APPROVED',
          submissionCode: hydrated.submission_code,
          message: `Approved ${hydrated.submission_code}. Official student profile has been updated.`,
        },
      });
      return;
    }

    const nextStatus = decision === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUESTED';
    const historyAction = decision === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUESTED';

    executeSql(
      db,
      `UPDATE profile_submissions
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, faculty_remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ?`,
      [nextStatus, authUser.userId, cleanRemarks, submissionId]
    );

    executeSql(
      db,
      `INSERT INTO profile_approval_history (submission_id, student_id, faculty_user_id, faculty_name, action, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [submissionId, studentId, authUser.userId, authUser.fullName, historyAction, cleanRemarks]
    );

    if (studentUserId) {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'System Alerts', 'profile')`,
        [
          studentUserId,
          decision === 'REJECT'
            ? `Profile Rejected · ${hydrated.submission_code}`
            : `Corrections Requested · ${hydrated.submission_code}`,
          decision === 'REJECT'
            ? `Your profile submission ${hydrated.submission_code} was rejected by ${authUser.fullName}. Reason: ${cleanRemarks}. Your official profile remains unchanged.`
            : `${authUser.fullName} requested corrections on ${hydrated.submission_code}: ${cleanRemarks}. Please update and resubmit.`,
        ]
      );
    }

    await logActivity(
      authUser.userId,
      authUser.fullName,
      'STUDENT',
      `${decision === 'REJECT' ? 'Rejected' : 'Requested corrections on'} profile ${hydrated.submission_code} (${row.roll_number})`
    );

    res.json({
      success: true,
      data: {
        status: nextStatus,
        submissionCode: hydrated.submission_code,
        message:
          decision === 'REJECT'
            ? `Submission ${hydrated.submission_code} rejected. Official profile preserved.`
            : `Correction request sent for ${hydrated.submission_code}. Official profile preserved.`,
      },
    });
  });

  /* ==================== FACULTY PROFILE & SKILLS WORKSPACE ROUTES ==================== */
  app.get('/api/faculty/my-profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const requestedUserId = req.query.userId ? Number(req.query.userId) : authUser.userId;

      if (requestedUserId !== authUser.userId && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'You may only view your own faculty profile.' });
        return;
      }
      if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'Faculty profile workspace is restricted to Faculty and Administration.' });
        return;
      }

      const db = await getDb();
      const dossier = buildOfficialFacultyDossier(db, requestedUserId);
      if (!dossier) {
        res.status(404).json({ success: false, error: 'Faculty directory profile not found.' });
        return;
      }

      const latestRow = queryOne<Record<string, unknown>>(
        db,
        `SELECT fps.*, rv.full_name AS reviewed_by_name
         FROM faculty_profile_submissions fps
         LEFT JOIN users rv ON fps.reviewed_by = rv.user_id
         WHERE fps.faculty_id = ?
         ORDER BY fps.submission_id DESC
         LIMIT 1`,
        [dossier.identity.faculty_id]
      );
      const latestSubmission = latestRow ? hydrateFacultySubmissionRow(latestRow) : null;

      const approvalHistory = queryAll<Record<string, unknown>>(
        db,
        `SELECT fpah.*, fps.submission_code
         FROM faculty_profile_approval_history fpah
         LEFT JOIN faculty_profile_submissions fps ON fpah.submission_id = fps.submission_id
         WHERE fpah.faculty_id = ?
         ORDER BY fpah.history_id DESC`,
        [dossier.identity.faculty_id]
      );

      const currentApprovalStatus = latestSubmission?.status ?? 'APPROVED';

      res.json({
        success: true,
        data: {
          ...dossier,
          latestSubmission,
          approvalHistory,
          currentApprovalStatus,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Unable to load faculty profile.',
      });
    }
  });

  app.get('/api/faculty/skills', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const requestedUserId = req.query.userId ? Number(req.query.userId) : authUser.userId;
      if (requestedUserId !== authUser.userId && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'Forbidden.' });
        return;
      }
      if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'Forbidden.' });
        return;
      }

      const db = await getDb();
      const identity = resolveFacultyForUser(db, requestedUserId);
      if (!identity) {
        res.status(404).json({ success: false, error: 'Faculty record not found.' });
        return;
      }
      res.json({ success: true, data: listFacultySkills(db, identity.faculty_id) });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Unable to fetch faculty skills.',
      });
    }
  });

  app.post('/api/faculty/skills', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const targetUserId = req.body?.userId && isPlacementAdminRole(authUser.role)
        ? Number(req.body.userId)
        : authUser.userId;

      if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'Only faculty members can manage faculty skills.' });
        return;
      }
      if (targetUserId !== authUser.userId && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'You can only modify your own faculty skills.' });
        return;
      }

      const skillName = String(req.body?.skillName || '').trim().replace(/\s+/g, ' ');
      const category = String(req.body?.category || 'Programming Languages').trim() || 'Technical';
      const level = Number(req.body?.proficiencyLevel);
      const experienceDuration = String(req.body?.experienceDuration || '').trim();

      if (skillName.length < 1 || skillName.length > 80) {
        res.status(400).json({ success: false, error: 'Skill name is required (1–80 characters).' });
        return;
      }
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        res.status(400).json({ success: false, error: 'Proficiency level must be between 1 and 5.' });
        return;
      }

      const db = await getDb();
      const identity = resolveFacultyForUser(db, targetUserId);
      if (!identity) {
        res.status(404).json({ success: false, error: 'Faculty profile record not found.' });
        return;
      }

      const catalogMatch = queryOne<{ skill_id: number; skill_name: string }>(
        db,
        'SELECT skill_id, skill_name FROM skills WHERE LOWER(TRIM(skill_name)) = LOWER(?)',
        [skillName]
      );
      const canonicalName = catalogMatch?.skill_name || skillName;

      const dup = queryOne<{ faculty_skill_id: number }>(
        db,
        'SELECT faculty_skill_id FROM faculty_skills WHERE faculty_id = ? AND (LOWER(TRIM(skill_name)) = LOWER(?) OR LOWER(TRIM(skill_name)) = LOWER(?))',
        [identity.faculty_id, skillName, canonicalName]
      );
      if (dup) {
        res.status(409).json({
          success: false,
          error: `Skill "${canonicalName}" already exists in your faculty skills list. Edit the existing entry instead.`,
        });
        return;
      }

      const label = proficiencyLabelFromLevel(level);
      const ins = executeSql(
        db,
        `INSERT INTO faculty_skills (faculty_id, user_id, skill_id, skill_name, category, proficiency_level, proficiency_label, experience_duration, verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          identity.faculty_id,
          identity.user_id,
          catalogMatch?.skill_id ?? null,
          canonicalName,
          category,
          level,
          label,
          experienceDuration,
        ]
      );

      const created = queryOne<Record<string, unknown>>(
        db,
        'SELECT * FROM faculty_skills WHERE faculty_skill_id = ?',
        [ins.lastInsertRowid]
      );

      await logActivity(authUser.userId, authUser.fullName, 'STUDENT', `Added faculty skill "${canonicalName}" (${identity.full_name})`);
      res.status(201).json({
        success: true,
        data: {
          skill: created,
          skills: listFacultySkills(db, identity.faculty_id),
          message: `Added skill "${canonicalName}".`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save faculty skill.';
      if (msg.toLowerCase().includes('unique')) {
        res.status(409).json({ success: false, error: 'This skill already exists in your faculty skills list.' });
        return;
      }
      res.status(500).json({ success: false, error: msg });
    }
  });

  app.put('/api/faculty/skills/:facultySkillId', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'Only faculty members can update faculty skills.' });
        return;
      }

      const facultySkillId = Number(req.params.facultySkillId);
      if (!Number.isInteger(facultySkillId) || facultySkillId <= 0) {
        res.status(400).json({ success: false, error: 'Invalid faculty skill identifier.' });
        return;
      }
      const db = await getDb();
      const existing = queryOne<{ faculty_skill_id: number; faculty_id: number; user_id: number; skill_name: string }>(
        db,
        'SELECT faculty_skill_id, faculty_id, user_id, skill_name FROM faculty_skills WHERE faculty_skill_id = ?',
        [facultySkillId]
      );
      if (!existing) {
        res.status(404).json({ success: false, error: 'Faculty skill record not found.' });
        return;
      }
      if (existing.user_id !== authUser.userId && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'You may only edit your own faculty skills.' });
        return;
      }

      const skillName = String(req.body?.skillName ?? existing.skill_name).trim().replace(/\s+/g, ' ');
      const category = String(req.body?.category || 'Technical').trim() || 'Technical';
      const level = Number(req.body?.proficiencyLevel);
      const experienceDuration = String(req.body?.experienceDuration ?? '').trim();

      if (skillName.length < 1 || skillName.length > 80) {
        res.status(400).json({ success: false, error: 'Skill name is required (1–80 characters).' });
        return;
      }
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        res.status(400).json({ success: false, error: 'Proficiency level must be between 1 and 5.' });
        return;
      }

      const catalogMatch = queryOne<{ skill_id: number; skill_name: string }>(
        db,
        'SELECT skill_id, skill_name FROM skills WHERE LOWER(TRIM(skill_name)) = LOWER(?)',
        [skillName]
      );
      const canonicalName = catalogMatch?.skill_name || skillName;

      const dup = queryOne<{ faculty_skill_id: number }>(
        db,
        'SELECT faculty_skill_id FROM faculty_skills WHERE faculty_id = ? AND (LOWER(TRIM(skill_name)) = LOWER(?) OR LOWER(TRIM(skill_name)) = LOWER(?)) AND faculty_skill_id != ?',
        [existing.faculty_id, skillName, canonicalName, facultySkillId]
      );
      if (dup) {
        res.status(409).json({ success: false, error: `Another entry named "${canonicalName}" already exists.` });
        return;
      }

      const label = proficiencyLabelFromLevel(level);
      executeSql(
        db,
        `UPDATE faculty_skills
         SET skill_id = ?, skill_name = ?, category = ?, proficiency_level = ?, proficiency_label = ?, experience_duration = ?, updated_at = CURRENT_TIMESTAMP
         WHERE faculty_skill_id = ?`,
        [catalogMatch?.skill_id ?? null, canonicalName, category, level, label, experienceDuration, facultySkillId]
      );

      const updated = queryOne<Record<string, unknown>>(
        db,
        'SELECT * FROM faculty_skills WHERE faculty_skill_id = ?',
        [facultySkillId]
      );

      res.json({
        success: true,
        data: {
          skill: updated,
          skills: listFacultySkills(db, existing.faculty_id),
          message: `Updated skill "${canonicalName}".`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update faculty skill.';
      if (msg.toLowerCase().includes('unique')) {
        res.status(409).json({ success: false, error: 'Another skill with this name already exists.' });
        return;
      }
      res.status(500).json({ success: false, error: msg });
    }
  });

  app.delete('/api/faculty/skills/:facultySkillId', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      if (!isFacultyRole(authUser.role) && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const facultySkillId = Number(req.params.facultySkillId);
      if (!Number.isInteger(facultySkillId) || facultySkillId <= 0) {
        res.status(400).json({ success: false, error: 'Invalid faculty skill identifier.' });
        return;
      }
      const db = await getDb();
      const existing = queryOne<{ faculty_skill_id: number; faculty_id: number; user_id: number; skill_name: string }>(
        db,
        'SELECT faculty_skill_id, faculty_id, user_id, skill_name FROM faculty_skills WHERE faculty_skill_id = ?',
        [facultySkillId]
      );
      if (!existing) {
        res.status(404).json({ success: false, error: 'Faculty skill record not found.' });
        return;
      }
      if (existing.user_id !== authUser.userId && !isPlacementAdminRole(authUser.role)) {
        res.status(403).json({ success: false, error: 'You may only delete your own faculty skills.' });
        return;
      }

      executeSql(db, 'DELETE FROM faculty_skills WHERE faculty_skill_id = ?', [facultySkillId]);
      res.json({
        success: true,
        data: {
          removed: true,
          skills: listFacultySkills(db, existing.faculty_id),
          message: `Removed skill "${existing.skill_name}".`,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Unable to delete faculty skill.',
      });
    }
  });

  app.post('/api/faculty/my-profile/draft', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isFacultyRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only faculty users can save a faculty profile draft.' });
      return;
    }

    const db = await getDb();
    const built = buildOfficialFacultyDossier(db, authUser.userId);
    if (!built) {
      res.status(404).json({ success: false, error: 'Faculty account not found.' });
      return;
    }

    const validation = normalizeAndValidateFacultyDraft(req.body, built.officialProfile, false);
    if (validation.valid === false) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    const diffs = computeFacultyFieldDiffs(built.officialProfile, validation.payload);
    const openSub = queryOne<{ submission_id: number; submission_code: string; status: string }>(
      db,
      `SELECT submission_id, submission_code, status
       FROM faculty_profile_submissions
       WHERE faculty_id = ? AND status IN ('DRAFT', 'CORRECTION_REQUESTED', 'WAITING_FOR_APPROVAL')
       ORDER BY submission_id DESC LIMIT 1`,
      [built.identity.faculty_id]
    );

    let submissionId: number;
    let submissionCode: string;
    if (openSub && openSub.status !== 'WAITING_FOR_APPROVAL') {
      submissionId = openSub.submission_id;
      submissionCode = openSub.submission_code;
      executeSql(
        db,
        `UPDATE faculty_profile_submissions
         SET status = 'DRAFT', draft_payload_json = ?, changed_fields_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = ?`,
        [JSON.stringify(validation.payload), JSON.stringify(diffs), submissionId]
      );
    } else {
      submissionCode = generateFacultySubmissionCode(db);
      const ins = executeSql(
        db,
        `INSERT INTO faculty_profile_submissions (submission_code, faculty_id, user_id, status, draft_payload_json, changed_fields_json)
         VALUES (?, ?, ?, 'DRAFT', ?, ?)`,
        [
          submissionCode,
          built.identity.faculty_id,
          authUser.userId,
          JSON.stringify(validation.payload),
          JSON.stringify(diffs),
        ]
      );
      submissionId = ins.lastInsertRowid;
    }

    executeSql(
      db,
      `INSERT INTO faculty_profile_approval_history (submission_id, faculty_id, reviewer_user_id, reviewer_name, action, remarks)
       VALUES (?, ?, ?, ?, 'DRAFT_SAVED', ?)`,
      [
        submissionId,
        built.identity.faculty_id,
        authUser.userId,
        authUser.fullName,
        `Saved draft (${diffs.length} pending field update(s)); official faculty profile untouched.`,
      ]
    );

    res.json({
      success: true,
      data: {
        submissionId,
        submissionCode,
        status: 'DRAFT',
        changedCount: diffs.length,
        message: 'Faculty profile draft saved. Official profile remains unchanged until submitted and approved.',
      },
    });
  });

  app.post('/api/faculty/my-profile/submit', requireAuth, async (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    if (!isFacultyRole(authUser.role)) {
      res.status(403).json({ success: false, error: 'Only faculty users can submit faculty profile revisions for approval.' });
      return;
    }

    const db = await getDb();
    const built = buildOfficialFacultyDossier(db, authUser.userId);
    if (!built) {
      res.status(404).json({ success: false, error: 'Faculty account not found.' });
      return;
    }

    const validation = normalizeAndValidateFacultyDraft(req.body, built.officialProfile, true);
    if (validation.valid === false) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    const diffs = computeFacultyFieldDiffs(built.officialProfile, validation.payload);
    const openSub = queryOne<{ submission_id: number; submission_code: string; status: string }>(
      db,
      `SELECT submission_id, submission_code, status
       FROM faculty_profile_submissions
       WHERE faculty_id = ? AND status IN ('DRAFT', 'CORRECTION_REQUESTED', 'WAITING_FOR_APPROVAL')
       ORDER BY submission_id DESC LIMIT 1`,
      [built.identity.faculty_id]
    );

    const isResubmit = Boolean(openSub && openSub.status !== 'DRAFT');
    let submissionId: number;
    let submissionCode: string;
    if (openSub) {
      submissionId = openSub.submission_id;
      submissionCode = openSub.submission_code;
      executeSql(
        db,
        `UPDATE faculty_profile_submissions
         SET status = 'WAITING_FOR_APPROVAL',
             draft_payload_json = ?,
             previous_snapshot_json = ?,
             changed_fields_json = ?,
             submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = ?`,
        [
          JSON.stringify(validation.payload),
          JSON.stringify(built.officialProfile),
          JSON.stringify(diffs),
          submissionId,
        ]
      );
    } else {
      submissionCode = generateFacultySubmissionCode(db);
      const ins = executeSql(
        db,
        `INSERT INTO faculty_profile_submissions (
           submission_code, faculty_id, user_id, status,
           draft_payload_json, previous_snapshot_json, changed_fields_json, submitted_at
         ) VALUES (?, ?, ?, 'WAITING_FOR_APPROVAL', ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          submissionCode,
          built.identity.faculty_id,
          authUser.userId,
          JSON.stringify(validation.payload),
          JSON.stringify(built.officialProfile),
          JSON.stringify(diffs),
        ]
      );
      submissionId = ins.lastInsertRowid;
    }

    executeSql(
      db,
      `INSERT INTO faculty_profile_approval_history (submission_id, faculty_id, reviewer_user_id, reviewer_name, action, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        built.identity.faculty_id,
        authUser.userId,
        authUser.fullName,
        isResubmit ? 'RESUBMITTED' : 'SUBMITTED',
        `Submitted ${diffs.length} change(s) for institutional approval.`,
      ]
    );

    const approvers = queryAll<{ user_id: number }>(
      db,
      "SELECT user_id FROM users WHERE role IN ('PRINCIPAL', 'ADMIN', 'PLACEMENT_OFFICER') AND is_active = 1 AND user_id != ?",
      [authUser.userId]
    );
    for (const appr of approvers) {
      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'System Alerts', 'profile-approvals')`,
        [
          appr.user_id,
          `Faculty Profile Pending Approval · ${built.identity.employee_id || built.identity.username}`,
          `${built.identity.full_name} (${built.identity.designation || 'Faculty'}) submitted profile revision ${submissionCode} (${diffs.length} change(s)) for approval.`,
        ]
      );
    }

    await logActivity(
      authUser.userId,
      authUser.fullName,
      'STUDENT',
      `Submitted faculty profile revision ${submissionCode} (${diffs.length} change(s)) for approval`
    );

    res.json({
      success: true,
      data: {
        submissionId,
        submissionCode,
        status: 'WAITING_FOR_APPROVAL',
        changedCount: diffs.length,
        message: `Faculty profile submitted (${submissionCode}) — Waiting for Administration Approval.`,
      },
    });
  });

  // Return JSON 404 for unknown /api/* endpoints instead of falling through to SPA HTML
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  });

  // Vite middleware in dev / static files in production
  let vite: ViteDevServer | null = null;
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexFile)) {
        res.status(503).send('Production bundle not found. Run npm run build first.');
        return;
      }
      res.sendFile(indexFile);
    });
  }

  // Global error handler hiding stack traces in production
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (!IS_PROD) {
      console.error('Unhandled server error:', err);
    } else {
      console.error('Unhandled server error:', err.message);
    }
    if (res.headersSent) return;
    res.status(500).json({
      success: false,
      error: IS_PROD ? 'An unexpected server error occurred.' : err.message || 'Internal server error.',
    });
  });

  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);
  let retriesLeft = 5;

  const startListening = () => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`GCET Placement Hub running on http://localhost:${PORT}`);
    });
  };

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      retriesLeft -= 1;
      console.warn(`Port ${PORT} busy during restart, retrying in 500ms (${retriesLeft} left)...`);
      setTimeout(() => {
        server.close(() => startListening());
      }, 500);
      return;
    }
    console.error(`Server listen error on port ${PORT}:`, err.message);
    process.exit(1);
  });

  const shutdown = async () => {
    server.close(async () => {
      if (vite) {
        await vite.close().catch(() => {});
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  startListening();
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
