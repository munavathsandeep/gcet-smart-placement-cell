import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { Database } from 'sql.js';
import { queryAll, queryOne } from './db.ts';

export type ReportRole =
  | 'PRINCIPAL'
  | 'VICE_CHAIRMAN'
  | 'CHAIRMAN'
  | 'ADMIN'
  | 'PLACEMENT_OFFICER'
  | 'FACULTY_COORDINATOR'
  | 'FACULTY'
  | 'STUDENT'
  | 'RECRUITER';

const ALL_ROLES: { role: ReportRole; label: string }[] = [
  { role: 'PRINCIPAL', label: 'Principal' },
  { role: 'VICE_CHAIRMAN', label: 'Vice Chairman' },
  { role: 'CHAIRMAN', label: 'Chairman' },
  { role: 'ADMIN', label: 'System Administrator' },
  { role: 'PLACEMENT_OFFICER', label: 'Placement Officer' },
  { role: 'FACULTY_COORDINATOR', label: 'Faculty Coordinator' },
  { role: 'FACULTY', label: 'Faculty' },
  { role: 'STUDENT', label: 'Student' },
  { role: 'RECRUITER', label: 'Recruiter' },
];

export interface InstitutionalRegistrationReport {
  institutionName: string;
  portalTitle: string;
  lastUpdated: string;
  totalActiveUsers: number;
  totalRegisteredMembers: number;
  totalStudentProfiles: number;
  totalFacultyMembers: number;
  totalAdministrators: number;
  totalExecutiveLeadership: number;
  totalRecruiters: number;
  approvalStatusCounts: {
    Approved: number;
    Pending: number;
    Rejected: number;
  };
  roleCounts: {
    role: ReportRole;
    label: string;
    activeCount: number;
    totalCount: number;
  }[];
  departmentStats: {
    deptId: number;
    deptCode: string;
    deptName: string;
    hodName: string;
    facultyCount: number;
    assignedCoordinatorCount: number;
    studentCount: number;
    placedCount: number;
  }[];
  branchRegistrationStats: {
    branchCode: string;
    branchName: string;
    degreeLevel: string;
    deptCode: string;
    studentCount: number;
    placedCount: number;
  }[];
}

export function computeInstitutionalRegistrationStats(db: Database): InstitutionalRegistrationReport {
  const roleRows = queryAll<{ role: ReportRole; totalCount: number; activeCount: number }>(
    db,
    `SELECT role,
            COUNT(DISTINCT user_id) AS totalCount,
            COUNT(DISTINCT CASE WHEN is_active = 1 THEN user_id END) AS activeCount
     FROM users
     GROUP BY role`
  );
  const roleMap = new Map(roleRows.map((r) => [r.role, { totalCount: Number(r.totalCount || 0), activeCount: Number(r.activeCount || 0) }]));

  const roleCounts = ALL_ROLES.map(({ role, label }) => {
    const entry = roleMap.get(role) ?? { totalCount: 0, activeCount: 0 };
    return {
      role,
      label,
      activeCount: entry.activeCount,
      totalCount: entry.totalCount,
    };
  });

  const totalActiveUsers =
    queryOne<{ c: number }>(db, 'SELECT COUNT(DISTINCT user_id) AS c FROM users WHERE is_active = 1')?.c ?? 0;
  const totalStudentProfiles =
    queryOne<{ c: number }>(db, 'SELECT COUNT(DISTINCT student_id) AS c FROM students')?.c ?? 0;
  const totalFacultyMembers =
    queryOne<{ c: number }>(
      db,
      "SELECT COUNT(DISTINCT user_id) AS c FROM users WHERE is_active = 1 AND role IN ('FACULTY_COORDINATOR', 'FACULTY')"
    )?.c ?? 0;
  const totalAdministrators =
    (roleMap.get('ADMIN')?.activeCount ?? 0) + (roleMap.get('PLACEMENT_OFFICER')?.activeCount ?? 0);
  const totalExecutiveLeadership =
    (roleMap.get('PRINCIPAL')?.activeCount ?? 0) +
    (roleMap.get('VICE_CHAIRMAN')?.activeCount ?? 0) +
    (roleMap.get('CHAIRMAN')?.activeCount ?? 0);
  const totalRecruiters = roleMap.get('RECRUITER')?.activeCount ?? 0;

  // Deduplicated total members: active portal users + any seeded student records without a linked user_id
  const unlinkedStudents =
    queryOne<{ c: number }>(db, 'SELECT COUNT(DISTINCT student_id) AS c FROM students WHERE user_id IS NULL')?.c ?? 0;
  const totalRegisteredMembers = Number(totalActiveUsers) + Number(unlinkedStudents);

  const approvalRows = queryAll<{ approval_status: string; c: number }>(
    db,
    `SELECT approval_status, COUNT(DISTINCT user_id) AS c
     FROM users
     WHERE is_active = 1
     GROUP BY approval_status`
  );
  const approvalMap = new Map(approvalRows.map((a) => [a.approval_status, Number(a.c || 0)]));

  const departmentStats = queryAll<{
    deptId: number;
    deptCode: string;
    deptName: string;
    hodName: string;
    facultyCount: number;
    assignedCoordinatorCount: number;
    studentCount: number;
    placedCount: number;
  }>(
    db,
    `SELECT d.dept_id AS deptId,
            d.dept_code AS deptCode,
            d.dept_name AS deptName,
            d.hod_name AS hodName,
            COUNT(DISTINCT CASE WHEN f.is_active = 1 THEN f.faculty_id END) AS facultyCount,
            COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN fba.faculty_user_id END) AS assignedCoordinatorCount,
            COUNT(DISTINCT s.student_id) AS studentCount,
            COUNT(DISTINCT CASE WHEN s.placement_status = 'Placed' THEN s.student_id END) AS placedCount
     FROM departments d
     LEFT JOIN faculty f ON f.dept_id = d.dept_id
     LEFT JOIN branches b ON b.dept_id = d.dept_id
     LEFT JOIN faculty_branch_assignments fba
       ON UPPER(fba.branch_code) = UPPER(b.branch_code)
       OR (UPPER(b.branch_code) = 'ME' AND UPPER(fba.branch_code) = 'MECH')
       OR (UPPER(b.branch_code) = 'CE' AND UPPER(fba.branch_code) = 'CIVIL')
       OR (UPPER(b.branch_code) = 'CSE-IOT' AND UPPER(fba.branch_code) = 'IOT')
       OR (UPPER(b.branch_code) = 'CSE-CS' AND UPPER(fba.branch_code) = 'CS')
     LEFT JOIN users u ON u.user_id = fba.faculty_user_id
     LEFT JOIN students s ON s.dept_id = d.dept_id
     GROUP BY d.dept_id, d.dept_code, d.dept_name, d.hod_name
     ORDER BY d.dept_id ASC`
  );

  const branchRegistrationStats = queryAll<{
    branchCode: string;
    branchName: string;
    degreeLevel: string;
    deptCode: string;
    studentCount: number;
    placedCount: number;
  }>(
    db,
    `SELECT b.branch_code AS branchCode,
            b.branch_name AS branchName,
            b.degree_level AS degreeLevel,
            d.dept_code AS deptCode,
            COUNT(DISTINCT s.student_id) AS studentCount,
            COUNT(DISTINCT CASE WHEN s.placement_status = 'Placed' THEN s.student_id END) AS placedCount
     FROM branches b
     JOIN departments d ON b.dept_id = d.dept_id
     LEFT JOIN students s ON s.branch_id = b.branch_id OR UPPER(s.branch) = UPPER(b.branch_code)
     WHERE b.is_active = 1
     GROUP BY b.branch_id, b.branch_code, b.branch_name, b.degree_level, d.dept_code
     ORDER BY studentCount DESC, b.branch_code ASC`
  );

  return {
    institutionName: 'Geethanjali College of Engineering and Technology (GCET), Hyderabad',
    portalTitle: 'GCET Smart Placement Cell & Skill Matrix Portal',
    lastUpdated: new Date().toISOString(),
    totalActiveUsers: Number(totalActiveUsers),
    totalRegisteredMembers,
    totalStudentProfiles: Number(totalStudentProfiles),
    totalFacultyMembers: Number(totalFacultyMembers),
    totalAdministrators,
    totalExecutiveLeadership,
    totalRecruiters,
    approvalStatusCounts: {
      Approved: approvalMap.get('Approved') ?? 0,
      Pending: approvalMap.get('Pending') ?? 0,
      Rejected: approvalMap.get('Rejected') ?? 0,
    },
    roleCounts,
    departmentStats: departmentStats.map((d) => ({
      deptId: Number(d.deptId),
      deptCode: String(d.deptCode),
      deptName: String(d.deptName),
      hodName: String(d.hodName),
      facultyCount: Number(d.facultyCount || 0),
      assignedCoordinatorCount: Number(d.assignedCoordinatorCount || 0),
      studentCount: Number(d.studentCount || 0),
      placedCount: Number(d.placedCount || 0),
    })),
    branchRegistrationStats: branchRegistrationStats.map((b) => ({
      branchCode: String(b.branchCode),
      branchName: String(b.branchName),
      degreeLevel: String(b.degreeLevel),
      deptCode: String(b.deptCode),
      studentCount: Number(b.studentCount || 0),
      placedCount: Number(b.placedCount || 0),
    })),
  };
}

function csvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateRegistrationCsvBuffer(report: InstitutionalRegistrationReport): Buffer {
  const lines: string[] = [
    csvCell(report.institutionName),
    csvCell('Automatic Institutional Registration Report — GCET Smart Placement Cell'),
    csvCell(`Report Generated At (UTC): ${report.lastUpdated}`),
    '',
    'INSTITUTIONAL SUMMARY,Count',
    `Total Registered Members (Deduplicated),${report.totalRegisteredMembers}`,
    `Active Portal Accounts,${report.totalActiveUsers}`,
    `Total Student Profiles,${report.totalStudentProfiles}`,
    `Total Faculty Coordinators,${report.totalFacultyMembers}`,
    `Executive Leadership (Principal / VC / Chairman),${report.totalExecutiveLeadership}`,
    `Administrators & Placement Officers,${report.totalAdministrators}`,
    `Corporate Recruiters,${report.totalRecruiters}`,
    '',
    'APPROVAL STATUS BREAKDOWN,Active User Count',
    `Approved,${report.approvalStatusCounts.Approved}`,
    `Pending,${report.approvalStatusCounts.Pending}`,
    `Rejected,${report.approvalStatusCounts.Rejected}`,
    '',
    'ROLE CODE,ROLE TITLE,ACTIVE ACCOUNTS,TOTAL ACCOUNTS',
    ...report.roleCounts.map((r) => [csvCell(r.role), csvCell(r.label), r.activeCount, r.totalCount].join(',')),
    '',
    'DEPT CODE,DEPARTMENT NAME,HOD NAME,PRIMARY FACULTY,ASSIGNED COORDINATORS,REGISTERED STUDENTS,PLACED STUDENTS',
    ...report.departmentStats.map((d) =>
      [
        csvCell(d.deptCode),
        csvCell(d.deptName),
        csvCell(d.hodName),
        d.facultyCount,
        d.assignedCoordinatorCount,
        d.studentCount,
        d.placedCount,
      ].join(',')
    ),
    '',
    'BRANCH CODE,BRANCH NAME,DEGREE,DEPARTMENT,STUDENTS,PLACED',
    ...report.branchRegistrationStats.map((b) =>
      [
        csvCell(b.branchCode),
        csvCell(b.branchName),
        csvCell(b.degreeLevel),
        csvCell(b.deptCode),
        b.studentCount,
        b.placedCount,
      ].join(',')
    ),
  ];
  return Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf8');
}

export async function generateRegistrationExcelBuffer(report: InstitutionalRegistrationReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GCET Smart Placement Cell';
  workbook.created = new Date();

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101A35' } };
  const subHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF246BFD' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

  // Sheet 1: Summary & Role Breakdown
  const s1 = workbook.addWorksheet('Registration Summary');
  s1.columns = [
    { width: 38 },
    { width: 26 },
    { width: 18 },
    { width: 18 },
  ];
  s1.addRow([report.institutionName]);
  s1.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF101A35' } };
  s1.addRow([`${report.portalTitle} — Institutional Registration Report`]);
  s1.getRow(2).font = { bold: true, size: 11, color: { argb: 'FF246BFD' } };
  s1.addRow([`Generated Timestamp: ${report.lastUpdated}`]);
  s1.addRow([]);

  const sumHdr = s1.addRow(['Institutional Metric', 'Value', 'Notes', '']);
  sumHdr.eachCell((c) => {
    c.fill = headerFill;
    c.font = headerFont;
  });
  s1.addRow(['Total Registered Members (Deduplicated)', report.totalRegisteredMembers, 'Distinct portal users + student records', '']);
  s1.addRow(['Active Portal User Accounts', report.totalActiveUsers, 'Active login accounts in users table', '']);
  s1.addRow(['Total Student Profiles', report.totalStudentProfiles, 'Distinct students across all branches', '']);
  s1.addRow(['Active Faculty Coordinators', report.totalFacultyMembers, 'FACULTY_COORDINATOR + FACULTY', '']);
  s1.addRow(['Executive Leadership', report.totalExecutiveLeadership, 'Principal, Vice Chairman, Chairman', '']);
  s1.addRow(['Admins & Placement Officers', report.totalAdministrators, 'ADMIN + PLACEMENT_OFFICER', '']);
  s1.addRow(['Corporate Recruiters', report.totalRecruiters, 'Approved + Pending recruiters', '']);
  s1.addRow([]);

  const appHdr = s1.addRow(['Approval Status', 'Active Accounts', '', '']);
  appHdr.eachCell((c) => {
    c.fill = subHeaderFill;
    c.font = headerFont;
  });
  s1.addRow(['Approved', report.approvalStatusCounts.Approved]);
  s1.addRow(['Pending', report.approvalStatusCounts.Pending]);
  s1.addRow(['Rejected', report.approvalStatusCounts.Rejected]);
  s1.addRow([]);

  const roleHdr = s1.addRow(['Role Code', 'Role Title', 'Active Accounts', 'Total Accounts']);
  roleHdr.eachCell((c) => {
    c.fill = headerFill;
    c.font = headerFont;
  });
  for (const r of report.roleCounts) {
    s1.addRow([r.role, r.label, r.activeCount, r.totalCount]);
  }

  // Sheet 2: Department Breakdown
  const s2 = workbook.addWorksheet('Department Breakdown');
  s2.columns = [
    { width: 14 },
    { width: 42 },
    { width: 28 },
    { width: 18 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
  ];
  s2.addRow([`${report.institutionName} — Department-Wise Registrations`]).font = { bold: true, size: 13 };
  s2.addRow([`Generated: ${report.lastUpdated}`]);
  s2.addRow([]);
  const deptHdr = s2.addRow([
    'Dept Code',
    'Department Name',
    'Head of Department',
    'Primary Faculty',
    'Assigned Coordinators',
    'Total Students',
    'Placed Students',
  ]);
  deptHdr.eachCell((c) => {
    c.fill = headerFill;
    c.font = headerFont;
  });
  for (const d of report.departmentStats) {
    s2.addRow([
      d.deptCode,
      d.deptName,
      d.hodName,
      d.facultyCount,
      d.assignedCoordinatorCount,
      d.studentCount,
      d.placedCount,
    ]);
  }

  // Sheet 3: Branch Breakdown
  const s3 = workbook.addWorksheet('Branch Breakdown');
  s3.columns = [
    { width: 16 },
    { width: 42 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
  ];
  s3.addRow([`${report.institutionName} — Branch-Wise Student Counts`]).font = { bold: true, size: 13 };
  s3.addRow([`Generated: ${report.lastUpdated}`]);
  s3.addRow([]);
  const brHdr = s3.addRow(['Branch Code', 'Branch Name', 'Degree', 'Department', 'Total Students', 'Placed Students']);
  brHdr.eachCell((c) => {
    c.fill = headerFill;
    c.font = headerFont;
  });
  for (const b of report.branchRegistrationStats) {
    s3.addRow([b.branchCode, b.branchName, b.degreeLevel, b.deptCode, b.studentCount, b.placedCount]);
  }

  const arrBuf = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

export async function generateRegistrationPdfBuffer(report: InstitutionalRegistrationReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header Banner
    doc.rect(40, 36, 515, 68).fill('#101A35');
    doc.fillColor('#20C5E8').fontSize(9).font('Helvetica-Bold').text('GEETHANJALI COLLEGE OF ENGINEERING AND TECHNOLOGY (GCET), HYDERABAD', 54, 48);
    doc.fillColor('#FFFFFF').fontSize(15).font('Helvetica-Bold').text('Automatic Institutional Registration Report', 54, 62);
    doc.fillColor('#CBD5E1').fontSize(8.5).font('Helvetica').text(`GCET Smart Placement Cell · Generated UTC: ${report.lastUpdated}`, 54, 83);

    doc.y = 118;

    // Section 1: Institutional Summary
    doc.fillColor('#101A35').fontSize(11).font('Helvetica-Bold').text('1. Institutional Registration Totals', 40, doc.y);
    doc.moveDown(0.4);
    const summaryPairs: [string, string][] = [
      ['Total Registered Members (Deduplicated)', String(report.totalRegisteredMembers)],
      ['Active Portal User Accounts', String(report.totalActiveUsers)],
      ['Total Student Profiles', String(report.totalStudentProfiles)],
      ['Active Faculty Coordinators', String(report.totalFacultyMembers)],
      ['Executive Leadership (Principal / VC / Chairman)', String(report.totalExecutiveLeadership)],
      ['Administrators & Placement Officers', String(report.totalAdministrators)],
      ['Corporate Recruiters', String(report.totalRecruiters)],
      [
        'Account Approval Status',
        `Approved: ${report.approvalStatusCounts.Approved} | Pending: ${report.approvalStatusCounts.Pending} | Rejected: ${report.approvalStatusCounts.Rejected}`,
      ],
    ];
    for (const [k, v] of summaryPairs) {
      const y = doc.y;
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(k, 44, y, { width: 320 });
      doc.fillColor('#101A35').font('Helvetica-Bold').text(v, 365, y, { width: 185, align: 'right' });
      doc.moveDown(0.35);
    }

    doc.moveDown(0.6);

    // Section 2: Role-Wise Counts
    doc.fillColor('#101A35').fontSize(11).font('Helvetica-Bold').text('2. Role-Wise Account Breakdown (All 9 Institutional Roles)', 40, doc.y);
    doc.moveDown(0.4);
    let yRole = doc.y;
    doc.rect(40, yRole, 515, 18).fill('#246BFD');
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
    doc.text('Role Code', 46, yRole + 5);
    doc.text('Role Designation', 180, yRole + 5);
    doc.text('Active', 390, yRole + 5, { width: 65, align: 'right' });
    doc.text('Total', 475, yRole + 5, { width: 70, align: 'right' });
    yRole += 20;

    doc.font('Helvetica').fontSize(8.5);
    for (const r of report.roleCounts) {
      doc.fillColor('#1E293B').text(r.role, 46, yRole);
      doc.text(r.label, 180, yRole);
      doc.text(String(r.activeCount), 390, yRole, { width: 65, align: 'right' });
      doc.text(String(r.totalCount), 475, yRole, { width: 70, align: 'right' });
      yRole += 15;
    }
    doc.y = yRole + 10;

    // Section 3: Department-Wise Faculty & Student Counts
    if (doc.y > 620) doc.addPage();
    doc.fillColor('#101A35').fontSize(11).font('Helvetica-Bold').text('3. Department-Wise Faculty & Student Counts', 40, doc.y);
    doc.moveDown(0.4);
    let yDept = doc.y;
    doc.rect(40, yDept, 515, 18).fill('#101A35');
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
    doc.text('Dept', 46, yDept + 5);
    doc.text('Department Name', 100, yDept + 5);
    doc.text('Faculty', 330, yDept + 5, { width: 55, align: 'right' });
    doc.text('Coordinators', 390, yDept + 5, { width: 60, align: 'right' });
    doc.text('Students', 455, yDept + 5, { width: 45, align: 'right' });
    doc.text('Placed', 502, yDept + 5, { width: 45, align: 'right' });
    yDept += 20;

    doc.font('Helvetica').fontSize(8.5);
    for (const d of report.departmentStats) {
      doc.fillColor('#1E293B').text(d.deptCode, 46, yDept);
      doc.text(d.deptName, 100, yDept, { width: 225 });
      doc.text(String(d.facultyCount), 330, yDept, { width: 55, align: 'right' });
      doc.text(String(d.assignedCoordinatorCount), 390, yDept, { width: 60, align: 'right' });
      doc.text(String(d.studentCount), 455, yDept, { width: 45, align: 'right' });
      doc.text(String(d.placedCount), 502, yDept, { width: 45, align: 'right' });
      yDept += 16;
    }

    doc.moveDown(1.2);
    doc.fillColor('#64748B').fontSize(7.5).text('Confidential Institutional Document · GCET Placement Hub · Generated dynamically from live database tables.', 40, yDept + 12);

    doc.end();
  });
}
