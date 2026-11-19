export type UserRole =
  | 'PRINCIPAL'
  | 'VICE_CHAIRMAN'
  | 'CHAIRMAN'
  | 'ADMIN'
  | 'PLACEMENT_OFFICER'
  | 'FACULTY_COORDINATOR'
  | 'FACULTY'
  | 'STUDENT'
  | 'RECRUITER';

export function isFacultyRole(role?: UserRole | string | null): boolean {
  return role === 'FACULTY' || role === 'FACULTY_COORDINATOR';
}

export function isExecutiveRole(role?: UserRole | string | null): boolean {
  return role === 'PRINCIPAL' || role === 'VICE_CHAIRMAN' || role === 'CHAIRMAN';
}

export function isPlacementAdminRole(role?: UserRole | string | null): boolean {
  return (
    role === 'PRINCIPAL' ||
    role === 'VICE_CHAIRMAN' ||
    role === 'CHAIRMAN' ||
    role === 'ADMIN' ||
    role === 'PLACEMENT_OFFICER'
  );
}

export function isSystemAdminRole(role?: UserRole | string | null): boolean {
  return (
    role === 'PRINCIPAL' ||
    role === 'VICE_CHAIRMAN' ||
    role === 'CHAIRMAN' ||
    role === 'ADMIN'
  );
}

export function formatRoleLabel(role?: UserRole | string | null): string {
  switch (role) {
    case 'PRINCIPAL':
      return 'Principal';
    case 'VICE_CHAIRMAN':
      return 'Vice Chairman';
    case 'CHAIRMAN':
      return 'Chairman';
    case 'ADMIN':
      return 'System Administrator';
    case 'PLACEMENT_OFFICER':
      return 'Placement Officer';
    case 'FACULTY_COORDINATOR':
    case 'FACULTY':
      return 'Faculty Coordinator';
    case 'RECRUITER':
      return 'Corporate Recruiter';
    case 'STUDENT':
      return 'Student';
    default:
      return String(role || '').replace('_', ' ');
  }
}

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  employeeId?: string | null;
  studentId?: number | null;
  companyId?: number | null;
  assignedBranch?: string | null;
  designation?: string | null;
  departmentName?: string | null;
  assignedBranches?: string[];
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  mustChangePassword?: boolean;
  passwordChangeDismissed?: boolean;
  dashboardRoute?: 'EXECUTIVE' | 'ADMIN' | 'FACULTY' | 'STUDENT' | 'RECRUITER';
  dashboardPath?: string;
  token?: string;
}

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
    role: UserRole;
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

export interface ManagedUser {
  user_id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  employee_id?: string | null;
  assigned_branch?: string | null;
  designation?: string | null;
  department_name?: string | null;
  assigned_branches?: string[];
  company_id?: number | null;
  company_name?: string | null;
  approval_status: 'Approved' | 'Pending' | 'Rejected';
  is_active: number;
  must_change_password: number;
  password_change_dismissed?: number;
  password_change_dismissed_at?: string | null;
  is_locked?: boolean;
  last_login?: string | null;
  created_at: string;
}

export interface FacultyCoordinatorSummary {
  user_id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  employee_id?: string | null;
  assigned_branch?: string | null;
  designation?: string | null;
  department_name?: string | null;
  assigned_branches: string[];
  is_active: number;
  last_login?: string | null;
  created_at: string;
  assignedStudentCount: number;
  placedStudentCount: number;
  pendingApprovalsCount: number;
  approvedProfilesCount: number;
  rejectedProfilesCount: number;
  correctionRequestedCount: number;
  recentApprovals: {
    history_id: number;
    submission_code?: string | null;
    student_name?: string | null;
    roll_number?: string | null;
    branch?: string | null;
    action: string;
    remarks?: string | null;
    action_at: string;
  }[];
  activityLogs: ActivityLogItem[];
}

export interface FacultyDashboardData {
  coordinator: {
    userId: number;
    fullName: string;
    username: string;
    email: string;
    employeeId?: string | null;
    designation: string;
    departmentName: string;
    assignedBranches: string[];
  };
  totalAssignedStudents: number;
  placedAssignedStudents: number;
  pendingApprovals: number;
  approvedProfiles: number;
  rejectedSubmissions: number;
  correctionRequests: number;
  recentRegistrations: {
    student_id: number;
    roll_number: string;
    full_name: string;
    branch: string;
    cgpa: number;
    semester?: number;
    section?: string;
    placement_status: 'Unplaced' | 'In Process' | 'Placed';
    created_at: string;
  }[];
  recentNotifications: NotificationItem[];
  branchBreakdown: { branch?: string; label?: string; count: number; placed: number }[];
  skillDistribution: { label: string; category: string; count: number; avgLevel: number }[];
}

export interface Department {
  dept_id: number;
  dept_code: string;
  dept_name: string;
  hod_name: string;
}

export interface Branch {
  branch_id: number;
  dept_id: number;
  dept_code?: string;
  dept_name?: string;
  hod_name?: string;
  branch_code: string;
  branch_name: string;
  degree_level: 'B.Tech' | 'M.Tech' | 'MBA';
  is_active: number;
  studentCount?: number;
  placedCount?: number;
}

export interface StudentExtendedProfile {
  photo_data_url?: string | null;
  date_of_birth?: string | null;
  personal_email?: string | null;
  alternate_phone?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  college_name?: string;
  registration_number?: string | null;
  admission_year?: number | null;
  percentage?: number | null;
  history_of_backlogs?: number | null;
  tenth_marks?: string | null;
  inter_diploma_marks?: string | null;
  university_name?: string | null;
  last_approved_at?: string | null;
  last_approved_by_name?: string | null;
}

export interface StudentInternship {
  internship_id?: number;
  student_id?: number;
  company_name: string;
  role: string;
  duration: string;
  start_date: string;
  end_date: string;
  description: string;
  technologies_used: string;
  certificate_name?: string | null;
  certificate_data?: string | null;
}

export interface StudentAchievement {
  achievement_id?: number;
  student_id?: number;
  title: string;
  category:
    | 'Technical Achievement'
    | 'Hackathon'
    | 'Coding Competition'
    | 'Workshop'
    | 'Technical Event'
    | 'Leadership'
    | 'Extracurricular'
    | 'Award & Recognition';
  event_date: string;
  description: string;
}

export interface StudentSocialLinks {
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  personal_website_url?: string | null;
  leetcode_url?: string | null;
  hackerrank_url?: string | null;
  codechef_url?: string | null;
  geeksforgeeks_url?: string | null;
}

export interface StudentResumeInfo {
  resume_id?: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_data_url?: string | null;
  uploaded_at: string;
}

export type ProfileApprovalStatus =
  | 'DRAFT'
  | 'WAITING_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTION_REQUESTED';

export interface ProfileSubmissionDiffItem {
  detail_id?: number;
  section_name: string;
  field_key: string;
  field_label: string;
  previous_value: string;
  new_value: string;
  is_changed: number;
}

export interface ProfileApprovalHistoryItem {
  history_id: number;
  submission_id: number;
  submission_code?: string;
  student_id: number;
  faculty_user_id?: number | null;
  faculty_name: string;
  action: 'DRAFT_SAVED' | 'SUBMITTED' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED';
  remarks?: string | null;
  action_at: string;
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
  projects: Project[];
  certifications: Certification[];
  internships: StudentInternship[];
  achievements: StudentAchievement[];
  socialLinks: StudentSocialLinks;
  resume: StudentResumeInfo | null;
}

export interface ProfileSubmissionRecord {
  submission_id: number;
  submission_code: string;
  student_id: number;
  student_name?: string;
  roll_number?: string;
  branch?: string;
  section?: string;
  assigned_faculty_id?: number | null;
  assigned_faculty_name?: string | null;
  status: ProfileApprovalStatus;
  draft_payload: ProfileDraftPayload;
  previous_snapshot?: ProfileDraftPayload | null;
  changed_fields: ProfileSubmissionDiffItem[];
  submitted_at?: string | null;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  faculty_remarks?: string | null;
  updated_at: string;
}

export interface StudentProfileDossier {
  officialStudent: Student;
  officialDossier: ProfileDraftPayload;
  latestSubmission: ProfileSubmissionRecord | null;
  approvalHistory: ProfileApprovalHistoryItem[];
  assignedFaculty: {
    user_id: number;
    full_name: string;
    email: string;
    employee_id?: string | null;
    assigned_branch?: string | null;
  } | null;
  completionPercentage: number;
  currentApprovalStatus: ProfileApprovalStatus;
}

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

export interface FacultyProfileSubmissionRecord {
  submission_id: number;
  submission_code: string;
  faculty_id: number;
  user_id: number;
  faculty_name?: string;
  employee_id?: string;
  designation?: string;
  department_name?: string;
  status: ProfileApprovalStatus;
  draft_payload: FacultyProfileDraftPayload | null;
  previous_snapshot?: FacultyProfileDraftPayload | null;
  changed_fields: ProfileSubmissionDiffItem[];
  submitted_at?: string | null;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  reviewer_remarks?: string | null;
  updated_at: string;
}

export interface FacultyProfileApprovalHistoryItem {
  history_id: number;
  submission_id: number;
  submission_code?: string;
  faculty_id: number;
  reviewer_user_id?: number | null;
  reviewer_name: string;
  action: 'DRAFT_SAVED' | 'SUBMITTED' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED';
  remarks?: string | null;
  action_at: string;
}

export interface FacultyProfileDossier {
  identity: {
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
  };
  officialProfile: FacultyProfileDraftPayload;
  skills: FacultySkillRecord[];
  lastApprovedAt: string | null;
  lastApprovedByName: string | null;
  latestSubmission: FacultyProfileSubmissionRecord | null;
  approvalHistory: FacultyProfileApprovalHistoryItem[];
  currentApprovalStatus: ProfileApprovalStatus;
}

export interface Student {
  student_id: number;
  user_id?: number | null;
  roll_number: string;
  full_name: string;
  email: string;
  phone: string;
  dept_id: number;
  dept_code?: string;
  dept_name?: string;
  branch_id?: number;
  branch: string;
  academic_year?: string;
  year_of_study?: number;
  semester?: number;
  section?: string;
  graduation_year: number;
  cgpa: number;
  active_backlogs: number;
  gender?: string;
  address?: string;
  resume_url?: string | null;
  profile_photo_url?: string;
  placement_status: 'Unplaced' | 'In Process' | 'Placed';
  skillCount?: number;
  skills?: StudentSkill[];
  projects?: Project[];
  certifications?: Certification[];
  internships?: StudentInternship[];
  achievements?: StudentAchievement[];
  socialLinks?: StudentSocialLinks;
  resumeInfo?: StudentResumeInfo | null;
  extendedProfile?: StudentExtendedProfile | null;
  applications?: Application[];
}

export interface Skill {
  skill_id: number;
  skill_name: string;
  category: string;
  description: string;
}

export interface StudentSkill {
  student_skill_id?: number;
  student_id?: number;
  skill_id?: number;
  skill_name: string;
  category: string;
  proficiency_level: number;
  proficiency_label?: 'Beginner' | 'Intermediate' | 'Advanced';
  experience_duration?: string;
  verified?: number;
}

export interface Project {
  project_id?: number;
  student_id?: number;
  title: string;
  tech_stack: string;
  description: string;
  category?: string;
  duration?: string;
  repo_url?: string;
  live_url?: string;
  team_members?: string;
  role_in_project?: string;
}

export interface Certification {
  cert_id?: number;
  student_id?: number;
  cert_name: string;
  issuing_org: string;
  issue_date: string;
  expiration_date?: string | null;
  credential_id?: string;
  verification_url?: string | null;
  certificate_file_name?: string | null;
  certificate_file_data?: string | null;
}

export interface Company {
  company_id: number;
  company_name: string;
  logo_url?: string | null;
  industry: string;
  official_website: string;
  career_page_url: string;
  headquarters: string;
  description: string;
  is_directory_reference: number;
  contact_person?: string;
  designation?: string;
  contact_email?: string;
  contact_phone?: string;
  driveCount?: number;
  placedCount?: number;
}

export interface DriveRequiredSkill {
  skill_id: number;
  skill_name: string;
  category: string;
  required_level: number;
  weightage: number;
}

export interface PlacementDrive {
  drive_id: number;
  company_id: number;
  company_name: string;
  industry?: string;
  job_role: string;
  job_description: string;
  job_location: string;
  job_type: 'On-Campus Drive' | 'Full-Time' | 'Internship' | 'Internship + Full-Time' | 'Off-Campus';
  salary_package: number;
  compensation_label?: string | null;
  apply_url?: string | null;
  posted_date: string;
  drive_date: string;
  application_deadline: string;
  drive_status: 'Planned' | 'Active' | 'Completed' | 'Cancelled';
  approval_status?: 'Approved' | 'Pending' | 'Rejected';
  min_cgpa: number;
  eligible_branches: string;
  graduation_year: number;
  max_backlogs: number;
  other_criteria?: string;
  requiredSkills: DriveRequiredSkill[];
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

export interface Application {
  application_id: number;
  drive_id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  branch: string;
  cgpa?: number;
  resume_url?: string | null;
  company_name: string;
  job_role: string;
  job_type?: string;
  salary_package: number;
  drive_date?: string;
  interview_date?: string | null;
  interview_mode?: string | null;
  applied_at: string;
  status: 'Applied' | 'Shortlisted' | 'Assessment' | 'Interview' | 'Selected' | 'Rejected';
  remarks?: string;
}

export interface PlacementRecord {
  placement_id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  branch: string;
  drive_id: number;
  company_id: number;
  company_name: string;
  job_role: string;
  package_lpa: number;
  offer_date: string;
  joining_status: 'Offered' | 'Accepted' | 'Joined' | 'Declined';
}

export interface AnnouncementCategory {
  category_id: number;
  category_name: string;
}

export interface AnnouncementSource {
  source_id: number;
  source_name: string;
  base_url: string;
  feed_url?: string | null;
  sync_mode: 'RSS' | 'HTML' | 'MANUAL';
  is_enabled: number;
  sync_interval_minutes: number;
  last_synced_at?: string | null;
  last_sync_status?: string | null;
  itemCount?: number;
}

export interface Announcement {
  announcement_id: number;
  title: string;
  category_id: number;
  category_name: string;
  source_id?: number | null;
  source_name: string;
  source_url: string;
  published_date: string;
  updated_date?: string | null;
  description: string;
  relevant_branches: string;
  department_code?: string | null;
  academic_year: string;
  deadline_date?: string | null;
  has_attachment: number;
  attachment_url?: string | null;
  priority: 'Normal' | 'Important' | 'Urgent';
  is_pinned: number;
  is_archived: number;
  is_verified_source: number;
}

export interface NotificationItem {
  notification_id: number;
  user_id?: number | null;
  title: string;
  message: string;
  category: string;
  link_url?: string | null;
  related_module?: string | null;
  is_read: number;
  created_at: string;
}

export interface AnnouncementSyncLog {
  log_id: number;
  source_id?: number | null;
  source_name: string;
  sync_status: 'SUCCESS' | 'WARNING' | 'FAILED';
  discovered_count: number;
  inserted_count: number;
  message: string;
  synced_at: string;
}

export interface AnnouncementSyncStatus {
  lastSuccessfulSync: string | null;
  hasUnreachableSources: boolean;
  unreachableSources: {
    source_id: number;
    source_name: string;
    sync_status: string;
    message: string;
    synced_at: string;
  }[];
  syncIntervalMinutes: number;
  recentLogs: AnnouncementSyncLog[];
}

export interface SystemStatusData {
  databaseConnected: boolean;
  databaseEngine: string;
  checkedAt: string;
  javaZipAvailable: boolean;
  javaZipSizeBytes: number;
  counts: {
    students: number;
    faculty: number;
    companies: number;
    drives: number;
    applications: number;
    placements: number;
    announcements: number;
    notifications: number;
    unreadNotifications: number;
  };
  syncHealth: AnnouncementSyncStatus;
}

export interface ActivityLogItem {
  log_id: number;
  actor_name: string;
  activity_type: string;
  description: string;
  created_at: string;
}

export interface GlobalSearchResult {
  students: { student_id: number; roll_number: string; full_name: string; branch: string; cgpa: number }[];
  companies: { company_id: number; company_name: string; industry: string; headquarters: string }[];
  drives: { drive_id: number; job_role: string; job_type: string; salary_package: number; company_name: string }[];
  announcements: { announcement_id: number; title: string; source_url: string; published_date: string; category_name: string }[];
}

export interface ApprovalQueues {
  pendingRecruiters: {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    company_id: number | null;
    company_name: string | null;
    phone?: string | null;
    website?: string | null;
    industry?: string | null;
    designation?: string | null;
    approval_status: string;
    created_at: string;
  }[];
  pendingDrives: {
    drive_id: number;
    company_id: number;
    company_name: string;
    job_role: string;
    job_type: string;
    salary_package: number;
    drive_date: string;
    application_deadline: string;
    approval_status: string;
  }[];
  unverifiedSkills: {
    student_skill_id: number;
    student_id: number;
    roll_number: string;
    student_name: string;
    branch: string;
    skill_name: string;
    category: string;
    proficiency_level: number;
  }[];
}

export interface RecruiterOverview {
  company: Company | null;
  approvalStatus: 'Approved' | 'Pending' | 'Rejected';
  drives: PlacementDrive[];
  applications: Application[];
  eligibleCandidateCount: number;
  shortlistedCount: number;
  interviewCount: number;
  selectedCount: number;
}

export interface PublicOverview {
  stats: {
    totalStudents: number;
    registeredCompanies: number;
    activeDrives: number;
    totalBranches: number;
    totalAnnouncements: number;
    studentsPlaced: number;
  };
  branches: Branch[];
  companies: Company[];
  announcements: Announcement[];
  drives: PlacementDrive[];
}

export interface AnalyticsData {
  totalStudents: number;
  registeredCompanies: number;
  activeDrives: number;
  studentsPlaced: number;
  totalApplications: number;
  eligibleStudents: number;
  upcomingInterviews: number;
  pendingApprovals: number;
  totalAnnouncements: number;
  totalBranches: number;
  placementPercentage: number;
  branchDistribution: { label: string; branch_name?: string; degree_level?: string; count: number; placed: number }[];
  skillDistribution: { label: string; category: string; count: number; avgLevel: number }[];
  applicationOutcomes: { label: string; count: number }[];
  companyPlacements: { label: string; count: number; avgPackage: number }[];
  upcomingDrives: {
    drive_id: number;
    company_name: string;
    job_role: string;
    job_type: string;
    job_location: string;
    salary_package: number;
    compensation_label?: string;
    drive_date: string;
    application_deadline: string;
    drive_status: string;
  }[];
  recentApplications: {
    application_id: number;
    student_name: string;
    roll_number: string;
    branch: string;
    company_name: string;
    job_role: string;
    status: string;
    applied_at: string;
  }[];
  recentPlacements: {
    placement_id: number;
    student_name: string;
    roll_number: string;
    branch: string;
    company_name: string;
    job_role: string;
    package_lpa: number;
    offer_date: string;
    joining_status: string;
  }[];
  activityLogs: ActivityLogItem[];
}

export type ModuleId =
  | 'dashboard'
  | 'campus-connect'
  | 'approvals'
  | 'profile-approvals'
  | 'user-management'
  | 'students'
  | 'profile'
  | 'faculty-profile'
  | 'skill-matrix'
  | 'companies'
  | 'drives'
  | 'eligibility'
  | 'skill-gap'
  | 'matching'
  | 'applications'
  | 'announcements'
  | 'department-notices'
  | 'notifications'
  | 'branches'
  | 'placements'
  | 'reports'
  | 'settings';
