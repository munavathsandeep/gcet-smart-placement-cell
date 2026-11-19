import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Building2,
  Briefcase,
  Award,
  Megaphone,
  ArrowRight,
  Bookmark,
  ExternalLink,
  CheckCircle2,
  CalendarClock,
  ShieldCheck,
  FileCheck2,
  Plus,
  Cpu,
  Clock,
  MapPin,
  UserCog,
} from 'lucide-react';
import { apiRequest } from '../api';
import {
  AnalyticsData,
  Announcement,
  Application,
  AuthUser,
  CompanyMatch,
  FacultyDashboardData,
  formatRoleLabel,
  isExecutiveRole,
  isFacultyRole,
  isSystemAdminRole,
  ModuleId,
  PlacementDrive,
  RecruiterOverview,
  Student,
  StudentProfileDossier,
} from '../types';
import { ChartCanvas } from './ChartCanvas';
import { cardCls, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';
import { ProfileApprovalBadge, ProfileProgressTimeline } from './ProfileStatusWidgets';

interface GcetWelcomeHeroProps {
  user: AuthUser;
  onNavigate: (module: ModuleId) => void;
  contextLine: React.ReactNode;
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  thirdActionLabel?: string;
  thirdActionModule?: ModuleId;
  rightBadgeSlot?: React.ReactNode;
}

function GcetWelcomeHero({
  user,
  onNavigate,
  contextLine,
  secondaryActionLabel = 'Create Placement Drive',
  secondaryActionDisabled = false,
  thirdActionLabel = 'Eligibility Checker',
  thirdActionModule = 'eligibility',
  rightBadgeSlot,
}: GcetWelcomeHeroProps) {
  const roleLabel = formatRoleLabel(user.role);
  const workspaceSubtitle = (() => {
    switch (user.role) {
      case 'PRINCIPAL':
        return 'Principal Executive Placement & Governance Dashboard';
      case 'VICE_CHAIRMAN':
        return 'Vice Chairman Institutional Governance Dashboard';
      case 'CHAIRMAN':
        return 'Chairman Strategic Placement Oversight Dashboard';
      case 'ADMIN':
        return 'System Administration & Security Operations Dashboard';
      case 'PLACEMENT_OFFICER':
        return 'Placement Officer Operations & Drive Management Dashboard';
      case 'FACULTY_COORDINATOR':
      case 'FACULTY':
        return `${user.designation || 'Faculty Coordinator'} · ${user.departmentName || user.assignedBranch || 'Department'} Dashboard`;
      case 'RECRUITER':
        return 'Corporate Recruiter Partnership Workspace';
      case 'STUDENT':
      default:
        return 'Student Career & Skill Matrix Portal';
    }
  })();

  return (
    <section className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#101A35] via-[#132142] to-[#172B50] border border-slate-800/80 dark:border-slate-700/70 text-white shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Section: Institutional Identity, Role Welcome & Quick Actions */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-[#20C5E8]">
                Geethanjali College of Engineering and Technology · GCET Placement Hub
              </p>
              {rightBadgeSlot}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-300">
                {roleLabel} · {workspaceSubtitle}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                Welcome back, {user.fullName}
              </h1>
              <p className="text-sm font-medium text-[#20C5E8]">
                Your Skills. Your Opportunities. Your Future.
              </p>
            </div>

            <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed max-w-2xl">
              Unified institutional platform uniting verified placement drives, corporate recruiter pipelines, student competency matrices, and real-time department analytics.
            </p>

            <div className="space-y-1 pt-0.5 text-xs text-slate-300">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#20C5E8] shrink-0" />
                <span>Cheeryal (V), Keesara (M), Hyderabad, Telangana · Pin 501301</span>
              </p>
              <p className="text-[11px] text-slate-400">
                UGC Autonomous · NAAC A+ Grade · Affiliated to JNTU Hyderabad (Subject to official institutional verification)
              </p>
              <div className="text-xs text-slate-200 pt-1">{contextLine}</div>
            </div>
          </div>

          {/* 3 Primary Quick-Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('campus-connect')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-600 text-white transition-colors whitespace-nowrap"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Campus Connect</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('drives')}
              disabled={secondaryActionDisabled}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{secondaryActionLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(thirdActionModule)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#20C5E8]" />
              <span>{thirdActionLabel}</span>
            </button>
          </div>
        </div>

        {/* Right Section: Official GCET Campus Photograph */}
        <div className="lg:col-span-5 p-3 sm:p-4 lg:pl-0 flex items-stretch">
          <div className="relative w-full aspect-[16/10] lg:aspect-auto lg:min-h-[270px] rounded-xl overflow-hidden border border-white/15 bg-[#0D162C]">
            <img
              src="/assets/aistudio/image_7a3f3ea7.png"
              alt="Geethanjali College of Engineering and Technology Campus, Hyderabad"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#101A35]/70 via-[#101A35]/15 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#101A35]/85 via-[#101A35]/35 to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2 text-[11px] text-white/90">
              <span className="font-medium truncate">GCET Main Campus · Cheeryal, Hyderabad</span>
              <span className="font-mono text-[10px] text-[#20C5E8] shrink-0">Official Campus</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface DashboardViewProps {
  user: AuthUser;
  isDark: boolean;
  onNavigate: (module: ModuleId) => void;
  onOpenProfile?: (studentId: number) => void;
}

export function DashboardView({ user, isDark, onNavigate, onOpenProfile }: DashboardViewProps) {
  const { showToast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [studentDossier, setStudentDossier] = useState<StudentProfileDossier | null>(null);
  const [matches, setMatches] = useState<CompanyMatch[]>([]);
  const [savedJobs, setSavedJobs] = useState<PlacementDrive[]>([]);
  const [allDrives, setAllDrives] = useState<PlacementDrive[]>([]);
  const [facultyStudents, setFacultyStudents] = useState<Student[]>([]);
  const [facultyDashboard, setFacultyDashboard] = useState<FacultyDashboardData | null>(null);
  const [pendingProfileApprovals, setPendingProfileApprovals] = useState<number>(0);
  const [recruiterData, setRecruiterData] = useState<RecruiterOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Recruiter interview scheduling modal
  const [scheduleApp, setScheduleApp] = useState<Application | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<Application['status']>('Interview');
  const [interviewDate, setInterviewDate] = useState('2026-12-16 11:00 AM');
  const [interviewMode, setInterviewMode] = useState('Online Technical Panel');
  const [interviewRemarks, setInterviewRemarks] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      if (user.role === 'RECRUITER') {
        const [rec, anns] = await Promise.all([
          apiRequest<RecruiterOverview>('/api/recruiter/overview'),
          apiRequest<Announcement[]>('/api/announcements'),
        ]);
        setRecruiterData(rec);
        setAnnouncements(anns.slice(0, 4));
      } else {
        const requests: Promise<unknown>[] = [
          apiRequest<AnalyticsData>('/api/analytics').then(setData),
          apiRequest<Announcement[]>('/api/announcements').then((list) => setAnnouncements(list.slice(0, 5))),
        ];

        if (user.role === 'STUDENT' && user.studentId) {
          requests.push(
            apiRequest<Student>(`/api/students/${user.studentId}`).then(setStudentProfile),
            apiRequest<StudentProfileDossier>(`/api/student-profile/${user.studentId}`)
              .then(setStudentDossier)
              .catch(() => setStudentDossier(null)),
            apiRequest<CompanyMatch[]>(`/api/matching?studentId=${user.studentId}`).then((m) => setMatches(m)),
            apiRequest<PlacementDrive[]>('/api/saved-jobs').then(setSavedJobs),
            apiRequest<PlacementDrive[]>('/api/drives').then(setAllDrives)
          );
        } else if (isFacultyRole(user.role)) {
          requests.push(
            apiRequest<Student[]>('/api/students').then(setFacultyStudents),
            apiRequest<FacultyDashboardData>('/api/faculty/dashboard')
              .then((fd) => {
                setFacultyDashboard(fd);
                setPendingProfileApprovals(fd.pendingApprovals);
              })
              .catch(() => setFacultyDashboard(null)),
            apiRequest<{ pendingCount: number }>('/api/faculty/profile-approvals')
              .then((res) => setPendingProfileApprovals(res.pendingCount))
              .catch(() => {})
          );
        }
        await Promise.all(requests);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user.role, user.studentId, user.assignedBranch]);

  const handleRecruiterUpdateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleApp) return;
    try {
      await apiRequest(`/api/applications/${scheduleApp.application_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: interviewStatus,
          interviewDate,
          interviewMode,
          remarks: interviewRemarks,
        }),
      });
      showToast(`Updated ${scheduleApp.student_name} to ${interviewStatus}.`);
      setScheduleApp(null);
      loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update application.', 'error');
    }
  };

  /* --------- 5 REAL CHARTS FOR ADMIN / TPO / FACULTY --------- */
  const branchStudentsChart = useMemo(() => {
    if (!data) return null;
    return {
      type: 'bar' as const,
      data: {
        labels: data.branchDistribution.map((b) => b.label),
        datasets: [
          {
            label: 'Registered Students',
            data: data.branchDistribution.map((b) => b.count),
            backgroundColor: '#246BFD',
            borderRadius: 4,
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    };
  }, [data]);

  const placementStatsChart = useMemo(() => {
    if (!data) return null;
    return {
      type: 'bar' as const,
      data: {
        labels: data.branchDistribution.map((b) => b.label),
        datasets: [
          {
            label: 'Total Cohort',
            data: data.branchDistribution.map((b) => b.count),
            backgroundColor: isDark ? '#334155' : '#CBD5E1',
            borderRadius: 4,
          },
          {
            label: 'Placed Students',
            data: data.branchDistribution.map((b) => b.placed),
            backgroundColor: '#20C5E8',
            borderRadius: 4,
          },
        ],
      },
      options: { plugins: { legend: { position: 'top' as const } } },
    };
  }, [data, isDark]);

  const applicationOutcomesChart = useMemo(() => {
    if (!data) return null;
    return {
      type: 'doughnut' as const,
      data: {
        labels: data.applicationOutcomes.map((o) => o.label),
        datasets: [
          {
            data: data.applicationOutcomes.map((o) => o.count),
            backgroundColor: ['#246BFD', '#20C5E8', '#10B981', '#F59E0B', '#6366F1', '#EF4444'],
            borderWidth: 0,
          },
        ],
      },
      options: { plugins: { legend: { position: 'right' as const } } },
    };
  }, [data]);

  const companyPlacementsChart = useMemo(() => {
    if (!data) return null;
    const top = data.companyPlacements.filter((c) => c.count > 0 || c.avgPackage > 0).slice(0, 6);
    const list = top.length > 0 ? top : data.companyPlacements.slice(0, 6);
    return {
      type: 'bar' as const,
      data: {
        labels: list.map((c) => c.label),
        datasets: [
          {
            label: 'Selected Students',
            data: list.map((c) => c.count),
            backgroundColor: '#246BFD',
            borderRadius: 4,
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    };
  }, [data]);

  const skillChartConfig = useMemo(() => {
    if (!data) return null;
    return {
      type: 'bar' as const,
      data: {
        labels: data.skillDistribution.slice(0, 8).map((s) => s.label),
        datasets: [
          {
            label: 'Avg Proficiency (1–5)',
            data: data.skillDistribution.slice(0, 8).map((s) => s.avgLevel),
            backgroundColor: '#20C5E8',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y' as const,
        scales: { x: { max: 5, beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${cardCls} h-24 bg-slate-100 dark:bg-slate-800/50`} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardCls} h-72 bg-slate-100 dark:bg-slate-800/50`} />
          <div className={`${cardCls} h-72 bg-slate-100 dark:bg-slate-800/50`} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardCls} p-6 text-sm text-red-600 dark:text-red-400`}>
        {error}
      </div>
    );
  }

  /* ================= 1. RECRUITER DASHBOARD ================= */
  if (user.role === 'RECRUITER' && recruiterData) {
    const interviews = recruiterData.applications.filter((a) => a.status === 'Interview');
    const shortlisted = recruiterData.applications.filter((a) => a.status === 'Shortlisted' || a.status === 'Assessment');

    return (
      <div className="space-y-6">
        <GcetWelcomeHero
          user={user}
          onNavigate={onNavigate}
          secondaryActionLabel="Create Placement Drive"
          secondaryActionDisabled={recruiterData.approvalStatus !== 'Approved'}
          thirdActionLabel="Applicant Pipeline"
          thirdActionModule="applications"
          rightBadgeSlot={<StatusText status={recruiterData.approvalStatus} />}
          contextLine={
            <span>
              {recruiterData.company
                ? `${recruiterData.company.company_name} · ${recruiterData.company.industry} · ${recruiterData.company.headquarters}`
                : 'Partner Organization Profile'}
            </span>
          }
        />

        {recruiterData.approvalStatus !== 'Approved' && (
          <div className={`${cardCls} p-4 bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300`}>
            Your recruiter account status is currently <strong>{recruiterData.approvalStatus}</strong>. Once approved by the GCET Placement Cell in Approval Center, you can publish new campus drives directly.
          </div>
        )}

        {/* Recruiter KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className={`${cardCls} p-4`}>
            <p className="text-xs text-[#718096] dark:text-slate-400">Company Drives</p>
            <p className="text-2xl font-bold font-mono text-[#101A35] dark:text-white mt-1">{recruiterData.drives.length}</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <p className="text-xs text-[#718096] dark:text-slate-400">Eligible Candidates Pool</p>
            <p className="text-2xl font-bold font-mono text-[#246BFD] mt-1">{recruiterData.eligibleCandidateCount}</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <p className="text-xs text-[#718096] dark:text-slate-400">Total Applications</p>
            <p className="text-2xl font-bold font-mono text-[#101A35] dark:text-white mt-1">{recruiterData.applications.length}</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <p className="text-xs text-[#718096] dark:text-slate-400">Shortlisted / Assessment</p>
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">{recruiterData.shortlistedCount}</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <p className="text-xs text-[#718096] dark:text-slate-400">Interviews · Selected</p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {recruiterData.interviewCount} · {recruiterData.selectedCount}
            </p>
          </div>
        </div>

        {/* Active Drives & Job Requirements + Interview Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Your Placement Drives &amp; Requirements</h3>
              <button type="button" onClick={() => onNavigate('drives')} className="text-xs font-medium text-[#246BFD] hover:underline">
                Open Drives
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {recruiterData.drives.map((d) => (
                <div key={d.drive_id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#172033] dark:text-white">{d.job_role}</p>
                    <StatusText status={d.approval_status === 'Pending' ? 'Pending' : d.drive_status} />
                  </div>
                  <p className="text-xs text-[#718096] dark:text-slate-400">
                    {d.job_type} · {d.compensation_label || `${Number(d.salary_package).toFixed(2)} LPA`} · Min CGPA {Number(d.min_cgpa).toFixed(1)} · Branches: {d.eligible_branches}
                  </p>
                  <p className="text-[11px] font-mono text-[#718096] dark:text-slate-400">
                    Drive: {d.drive_date} · Deadline: {d.application_deadline}
                  </p>
                </div>
              ))}
              {recruiterData.drives.length === 0 && (
                <p className="text-xs text-[#718096] py-4">No drives published yet for your organization.</p>
              )}
            </div>
          </div>

          <div className={`${cardCls} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Applications, Shortlists &amp; Interview Scheduling</h3>
              <span className="text-xs text-[#718096] dark:text-slate-400">
                {shortlisted.length} shortlisted · {interviews.length} scheduled
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {recruiterData.applications.map((a) => (
                <div key={a.application_id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172033] dark:text-white truncate">
                      {a.student_name} ({a.roll_number}) · {a.branch}
                    </p>
                    <p className="text-xs text-[#718096] dark:text-slate-400">
                      {a.job_role} · CGPA {Number(a.cgpa || 0).toFixed(2)}
                      {a.interview_date ? ` · Interview: ${a.interview_date}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusText status={a.status} />
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleApp(a);
                        setInterviewStatus(a.status);
                        setInterviewDate(a.interview_date || '2026-12-16 11:00 AM');
                        setInterviewMode(a.interview_mode || 'Online Technical Panel');
                        setInterviewRemarks(a.remarks || '');
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 text-[#246BFD] hover:bg-[#246BFD]/10"
                    >
                      Schedule / Update
                    </button>
                  </div>
                </div>
              ))}
              {recruiterData.applications.length === 0 && (
                <p className="text-xs text-[#718096] py-4">No candidate applications received for your drives yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Campus Announcements Preview */}
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">GCET Placement Cell Updates</h3>
            <button type="button" onClick={() => onNavigate('campus-connect')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Campus Connect
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.map((a) => (
              <div key={a.announcement_id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/70">
                <p className="text-[11px] text-[#718096] font-mono">{a.category_name} · {a.published_date}</p>
                <p className="text-xs font-semibold text-[#172033] dark:text-white mt-1">{a.title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recruiter Interview Scheduling Modal */}
        <Modal
          open={Boolean(scheduleApp)}
          title={`Update Applicant — ${scheduleApp?.student_name || ''}`}
          onClose={() => setScheduleApp(null)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRecruiterUpdateApp} className="space-y-4">
            <div>
              <label className={labelCls}>Pipeline Stage</label>
              <select
                value={interviewStatus}
                onChange={(e) => setInterviewStatus(e.target.value as Application['status'])}
                className={inputCls}
              >
                {['Applied', 'Shortlisted', 'Assessment', 'Interview', 'Selected', 'Rejected'].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Interview Date &amp; Time</label>
              <input value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Interview Mode</label>
              <select value={interviewMode} onChange={(e) => setInterviewMode(e.target.value)} className={inputCls}>
                <option value="Online Technical Panel">Online Technical Panel</option>
                <option value="On-Campus GCET Auditorium">On-Campus GCET Auditorium</option>
                <option value="HR & Final Offer Discussion">HR &amp; Final Offer Discussion</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Remarks</label>
              <textarea rows={2} value={interviewRemarks} onChange={(e) => setInterviewRemarks(e.target.value)} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleApp(null)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700">
                Save Update &amp; Notify Student
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  /* ================= 2. STUDENT PERSONALIZED DASHBOARD ================= */
  if (user.role === 'STUDENT' && studentProfile && data) {
    const completionPct =
      studentDossier?.completionPercentage ??
      Math.round(
        ([
          Boolean(studentProfile.phone),
          Boolean(studentProfile.address),
          Boolean(studentProfile.resume_url),
          (studentProfile.skills?.length ?? 0) >= 3,
          (studentProfile.projects?.length ?? 0) >= 1,
          (studentProfile.certifications?.length ?? 0) >= 1,
        ].filter(Boolean).length /
          6) *
          100
      );
    const approvalStatus = studentDossier?.currentApprovalStatus ?? 'APPROVED';
    const eligibleMatches = matches.filter((m) => m.eligible);
    const internships = allDrives.filter((d) => d.job_type.toLowerCase().includes('internship'));
    const interviews = (studentProfile.applications || []).filter((a) => a.status === 'Interview');

    return (
      <div className="space-y-6">
        <GcetWelcomeHero
          user={user}
          onNavigate={onNavigate}
          secondaryActionLabel="Explore Placement Drives"
          thirdActionLabel="My Profile & Resume"
          thirdActionModule="profile"
          rightBadgeSlot={<ProfileApprovalBadge status={approvalStatus} />}
          contextLine={
            <span>
              <span className="font-mono font-semibold">{studentProfile.roll_number}</span> ·{' '}
              {studentProfile.dept_name || studentProfile.branch} ({studentProfile.branch}) ·{' '}
              AY <span className="font-mono">{studentProfile.academic_year || '2026-27'}</span> · Year{' '}
              {studentProfile.year_of_study ?? 4} · CGPA{' '}
              <span className="font-mono font-semibold">{Number(studentProfile.cgpa).toFixed(2)}</span> · Profile{' '}
              <span className="font-mono font-semibold text-[#20C5E8]">{completionPct}%</span> · Readiness:{' '}
              <span className="font-semibold text-white">{studentProfile.placement_status}</span>
            </span>
          }
        />

        {/* Profile Approval Status & 5-Stage Progress Timeline */}
        <div className={`${cardCls} p-5 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-[#101A35] dark:text-white">Profile Verification &amp; Placement Readiness:</span>
              <ProfileApprovalBadge status={approvalStatus} />
              <StatusText status={studentProfile.placement_status} />
              <span className="text-slate-500 dark:text-slate-400">
                · Sem {studentProfile.semester ?? 7} · Sec {studentProfile.section ?? 'A'} · Backlogs:{' '}
                <span className="font-mono">{studentProfile.active_backlogs}</span>
                {studentDossier?.latestSubmission?.submission_code && (
                  <>
                    {' '}
                    · Ref <span className="font-mono font-semibold">{studentDossier.latestSubmission.submission_code}</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex-1 sm:w-40 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#246BFD] rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="text-xs font-semibold text-[#246BFD] hover:underline whitespace-nowrap"
              >
                Open My Profile ({completionPct}%)
              </button>
            </div>
          </div>

          <ProfileProgressTimeline
            status={approvalStatus}
            hasAnySubmission={Boolean(studentDossier?.latestSubmission)}
          />
        </div>

        {/* 6 Required Clickable Student Module Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('skill-matrix')}
            className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors`}
          >
            <p className="text-xs text-[#718096] dark:text-slate-400">Skill Matrix</p>
            <p className="text-2xl font-bold font-mono text-[#101A35] dark:text-white mt-1">
              {studentProfile.skills?.length ?? 0}
            </p>
            <p className="text-[11px] text-[#246BFD] mt-1 font-medium">Manage Competencies →</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('matching')}
            className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors`}
          >
            <p className="text-xs text-[#718096] dark:text-slate-400">Eligible Placement Drives</p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {eligibleMatches.length}
            </p>
            <p className="text-[11px] text-[#246BFD] mt-1 font-medium">Recommended Drives →</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('drives')}
            className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors`}
          >
            <p className="text-xs text-[#718096] dark:text-slate-400">Internship Opportunities</p>
            <p className="text-2xl font-bold font-mono text-[#101A35] dark:text-white mt-1">
              {internships.length}
            </p>
            <p className="text-[11px] text-[#246BFD] mt-1 font-medium">Explore Internships →</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('applications')}
            className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors`}
          >
            <p className="text-xs text-[#718096] dark:text-slate-400">Upcoming Interviews</p>
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {interviews.length}
            </p>
            <p className="text-[11px] text-[#246BFD] mt-1 font-medium">Interview Tracker →</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('drives')}
            className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors`}
          >
            <p className="text-xs text-[#718096] dark:text-slate-400">Saved Opportunities</p>
            <p className="text-2xl font-bold font-mono text-[#101A35] dark:text-white mt-1">
              {savedJobs.length}
            </p>
            <p className="text-[11px] text-[#246BFD] mt-1 font-medium">Bookmarked Drives →</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors flex flex-col justify-between`}
          >
            <p className="text-xs text-[#718096] dark:text-slate-400">Profile Approval Status</p>
            <div className="my-1.5">
              <ProfileApprovalBadge status={approvalStatus} />
            </div>
            <p className="text-[11px] text-[#246BFD] font-medium">Review &amp; Edit Profile →</p>
          </button>
        </div>

        {/* Recommended Companies + Upcoming Interviews & Application History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardCls} p-5 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Recommended Companies &amp; Eligible Drives</h3>
              <button type="button" onClick={() => onNavigate('matching')} className="text-xs font-medium text-[#246BFD] hover:underline">
                View All Matches
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {matches.slice(0, 5).map((m) => (
                <div key={m.driveId} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172033] dark:text-white">{m.companyName} — {m.jobRole}</p>
                    <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                      {m.jobType} · <span className="font-mono">{Number(m.salaryPackage).toFixed(2)} LPA</span> · Match <span className="font-mono font-semibold text-[#246BFD]">{m.matchPercentage}%</span>
                    </p>
                  </div>
                  <StatusText status={m.eligible ? 'Eligible' : 'Not Eligible'} />
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardCls} p-5 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Application History &amp; Interviews</h3>
              <button type="button" onClick={() => onNavigate('applications')} className="text-xs font-medium text-[#246BFD] hover:underline">
                Full Tracker
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {(studentProfile.applications || []).slice(0, 5).map((a) => (
                <div key={a.application_id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172033] dark:text-white">{a.company_name} — {a.job_role}</p>
                    <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                      {a.interview_date ? `Interview: ${a.interview_date} (${a.interview_mode || 'Panel'})` : `Applied: ${String(a.applied_at).slice(0, 10)}`}
                    </p>
                  </div>
                  <StatusText status={a.status} />
                </div>
              ))}
              {(studentProfile.applications?.length ?? 0) === 0 && (
                <p className="text-xs text-[#718096] py-4">No applications submitted yet.</p>
              )}
            </div>

            {savedJobs.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/70">
                <p className="text-xs font-semibold text-[#172033] dark:text-white mb-2 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-[#246BFD]" />
                  <span>Saved Opportunities</span>
                </p>
                <div className="space-y-1.5 text-xs">
                  {savedJobs.map((sj) => (
                    <div key={sj.drive_id} className="flex items-center justify-between text-[#718096] dark:text-slate-300">
                      <span className="truncate">{sj.company_name} — {sj.job_role}</span>
                      <span className="font-mono shrink-0 ml-2">Due {sj.application_deadline}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Campus Announcements */}
        <div className={`${cardCls} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Latest Announcements for {studentProfile.branch}</h3>
            <button type="button" onClick={() => onNavigate('campus-connect')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Open Campus Connect
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.slice(0, 4).map((a) => (
              <div key={a.announcement_id} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/70 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#718096]">
                  <span>{a.category_name}</span>
                  <span className="font-mono">{a.published_date}</span>
                </div>
                <p className="text-xs font-semibold text-[#172033] dark:text-white">{a.title}</p>
                <a
                  href={a.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#246BFD] hover:underline"
                >
                  <span>Read Full Notification</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ================= 3. FACULTY COORDINATOR DASHBOARD ================= */
  if (isFacultyRole(user.role) && data) {
    const coordinator = facultyDashboard?.coordinator;
    const assignedBranches = coordinator?.assignedBranches || user.assignedBranches || (user.assignedBranch ? [user.assignedBranch] : []);
    const deptName = coordinator?.departmentName || user.departmentName || 'Department';
    const designation = coordinator?.designation || user.designation || 'Faculty Coordinator';
    const pendingCount = facultyDashboard?.pendingApprovals ?? pendingProfileApprovals;
    const approvedCount = facultyDashboard?.approvedProfiles ?? 0;
    const rejectedCount = facultyDashboard?.rejectedSubmissions ?? 0;
    const correctionCount = facultyDashboard?.correctionRequests ?? 0;
    const totalStudentsCount = facultyDashboard?.totalAssignedStudents ?? data.totalStudents;
    const recentRegs = facultyDashboard?.recentRegistrations ?? [];
    const recentNotifs = facultyDashboard?.recentNotifications ?? [];

    return (
      <div className="space-y-6">
        <GcetWelcomeHero
          user={user}
          onNavigate={onNavigate}
          secondaryActionLabel="Department Reports"
          thirdActionLabel="Profile Approvals"
          thirdActionModule="profile-approvals"
          rightBadgeSlot={
            <span className="px-2.5 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] font-semibold text-[#20C5E8]">
              {designation}
            </span>
          }
          contextLine={
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Department: <strong className="text-white">{deptName}</strong>
                {user.employeeId ? ` · ID ${user.employeeId}` : ''} · Assigned Branches:
              </span>
              {assignedBranches.map((br, idx) => (
                <span
                  key={`${br}-${idx}`}
                  className="px-2 py-0.5 rounded bg-[#246BFD]/30 border border-[#20C5E8]/40 font-mono text-[11px] font-semibold text-white"
                >
                  {br}
                </span>
              ))}
            </div>
          }
        />

        {/* Quick Coordinator Department Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#718096] dark:text-slate-400">
            Strictly scoped department workspace for <strong>{deptName}</strong> ({assignedBranches.join(', ')}).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile-approvals')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
            >
              Profile Approvals ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white"
            >
              Assigned Students ({totalStudentsCount})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('skill-matrix')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#172B50]"
            >
              Verify Student Skills
            </button>
          </div>
        </div>

        {/* Coordinator Department KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Total Assigned Students', value: totalStudentsCount, icon: Users, module: 'students' as ModuleId },
            { label: 'Pending Profile Approvals', value: pendingCount, icon: Clock, module: 'profile-approvals' as ModuleId },
            { label: 'Approved Student Profiles', value: approvedCount, icon: CheckCircle2, module: 'profile-approvals' as ModuleId },
            { label: 'Rejected Submissions', value: rejectedCount, icon: ShieldCheck, module: 'profile-approvals' as ModuleId },
            { label: 'Correction Requests', value: correctionCount, icon: FileCheck2, module: 'profile-approvals' as ModuleId },
            { label: 'Placed Students', value: facultyDashboard?.placedAssignedStudents ?? data.studentsPlaced, icon: Award, module: 'reports' as ModuleId },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.label}
                type="button"
                onClick={() => onNavigate(k.module)}
                className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors`}
              >
                <Icon className="w-4 h-4 text-[#246BFD] mb-2" />
                <p className="text-2xl font-bold font-mono text-[#101A35] dark:text-white">{k.value}</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-1 truncate">{k.label}</p>
              </button>
            );
          })}
        </div>

        {/* Assigned Branch Summary + Recent Registrations + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`${cardCls} p-5 lg:col-span-7 overflow-x-auto`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                  Recent Student Registrations ({deptName})
                </h3>
                <p className="text-[11px] text-[#718096] dark:text-slate-400">
                  Students auto-assigned to your coordinator queue across {assignedBranches.join(', ')}
                </p>
              </div>
              <button type="button" onClick={() => onNavigate('students')} className="text-xs font-medium text-[#246BFD] hover:underline">
                View All Assigned
              </button>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="border-b border-slate-200 dark:border-slate-700 text-[#718096] dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Roll No</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">CGPA</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {(recentRegs.length > 0 ? recentRegs : facultyStudents.slice(0, 7)).map((st) => (
                  <tr key={st.student_id} className="hover:bg-slate-50/70 dark:hover:bg-[#101827]/40">
                    <td className="py-2.5 pr-3 font-mono text-[#172033] dark:text-slate-200">{st.roll_number}</td>
                    <td className="py-2.5 pr-3 font-medium text-[#172033] dark:text-white">
                      {onOpenProfile ? (
                        <button
                          type="button"
                          onClick={() => onOpenProfile(st.student_id)}
                          className="hover:text-[#246BFD] hover:underline text-left"
                        >
                          {st.full_name}
                        </button>
                      ) : (
                        st.full_name
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[#246BFD] dark:text-[#20C5E8]">{st.branch}</td>
                    <td className="py-2.5 pr-3 font-mono">{Number(st.cgpa).toFixed(2)}</td>
                    <td className="py-2.5"><StatusText status={st.placement_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`${cardCls} p-5 lg:col-span-5 flex flex-col justify-between space-y-4`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Recent Notifications</h3>
                <button type="button" onClick={() => onNavigate('notifications')} className="text-xs font-medium text-[#246BFD] hover:underline">
                  All Alerts
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {recentNotifs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No recent alerts in your coordinator queue.</p>
                ) : (
                  recentNotifs.slice(0, 5).map((n) => (
                    <div key={n.notification_id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                      <p className="font-semibold text-[#172033] dark:text-white">{n.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{String(n.created_at).slice(0, 16)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {facultyDashboard && facultyDashboard.branchBreakdown.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/70">
                <p className="text-xs font-semibold text-[#101A35] dark:text-white mb-2">Assigned Branch Distribution</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {facultyDashboard.branchBreakdown.map((bb, idx) => {
                    const branchCode = bb.branch || bb.label || `Branch ${idx + 1}`;
                    return (
                      <div key={`${branchCode}-${idx}`} className="p-2 rounded-lg bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70">
                        <p className="font-mono font-bold text-[#246BFD] dark:text-[#20C5E8]">{branchCode}</p>
                        <p className="font-mono text-[#172033] dark:text-white mt-0.5">{bb.count} Students</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{bb.placed} Placed</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Skill Matrix Chart + Department Notices */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`${cardCls} p-5 lg:col-span-6`}>
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white mb-3">
              Department Skill Matrix Proficiency
            </h3>
            {skillChartConfig && <ChartCanvas config={skillChartConfig} height={240} isDark={isDark} />}
          </div>

          <div className={`${cardCls} p-5 lg:col-span-6 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Latest Department Circulars</h3>
              <button type="button" onClick={() => onNavigate('announcements')} className="text-xs font-medium text-[#246BFD] hover:underline">
                View Announcements
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {announcements.slice(0, 4).map((a) => (
                <div key={a.announcement_id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                  <p className="text-[11px] text-slate-500 font-mono">{a.category_name} · {a.published_date}</p>
                  <p className="font-semibold text-[#172033] dark:text-white mt-0.5">{a.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= 4. ADMIN & PLACEMENT OFFICER DASHBOARD ================= */
  if (!data) return null;

  const adminKpis = [
    { label: 'Total Students', value: data.totalStudents, icon: Users, module: 'students' as ModuleId },
    { label: 'Registered Companies', value: data.registeredCompanies, icon: Building2, module: 'companies' as ModuleId },
    { label: 'Active Placement Drives', value: data.activeDrives, icon: Briefcase, module: 'drives' as ModuleId },
    { label: 'Students Placed', value: data.studentsPlaced, icon: Award, module: 'placements' as ModuleId },
    { label: 'Total Applications', value: data.totalApplications, icon: FileCheck2, module: 'applications' as ModuleId },
    { label: 'Eligible Students', value: data.eligibleStudents, icon: CheckCircle2, module: 'eligibility' as ModuleId },
    { label: 'Upcoming Interviews', value: data.upcomingInterviews, icon: CalendarClock, module: 'applications' as ModuleId },
    { label: 'Pending Approvals', value: data.pendingApprovals, icon: ShieldCheck, module: 'approvals' as ModuleId },
  ];

  return (
    <div className="space-y-6">
      {/* Split-Layout Welcome Banner with Original GCET Campus Photograph */}
      <GcetWelcomeHero
        user={user}
        onNavigate={onNavigate}
        secondaryActionLabel={user.role === 'VICE_CHAIRMAN' ? 'Browse Active Drives' : 'Create Placement Drive'}
        thirdActionLabel="Eligibility Checker"
        thirdActionModule="eligibility"
        contextLine={
          <span>
            Live Placement Rate:{' '}
            <span className="font-mono font-semibold text-[#20C5E8] tabular-nums">{data.placementPercentage}%</span> ·{' '}
            <span className="font-mono tabular-nums">{data.totalBranches}</span> Accredited Branches ·{' '}
            <span className="font-mono tabular-nums">{data.activeDrives}</span> Active Drives
          </span>
        }
      />

      {/* Secondary Executive / Admin Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#101A35] dark:text-white">
            {isExecutiveRole(user.role)
              ? `${formatRoleLabel(user.role)} Executive Metrics`
              : 'Placement Cell Operational Overview'}
          </h2>
          <p className="text-xs text-[#718096] dark:text-slate-400">
            Real-time database telemetry across all 12 GCET departments and corporate partners
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isExecutiveRole(user.role) && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Registration Reports (PDF / Excel / CSV)</span>
            </button>
          )}
          {isSystemAdminRole(user.role) && (
            <button
              type="button"
              onClick={() => onNavigate('user-management')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#172B50]"
            >
              <UserCog className="w-3.5 h-3.5 text-[#246BFD]" />
              <span>User &amp; Faculty Accounts</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('announcements')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#101A35] dark:bg-[#172B50] text-white hover:opacity-95"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Publish Announcement</span>
          </button>
        </div>
      </div>

      {/* 8 Real Database-Backed KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {adminKpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.label}
              type="button"
              onClick={() => onNavigate(k.module)}
              className={`${cardCls} p-4 text-left hover:border-[#246BFD] transition-colors group`}
            >
              <div className="flex items-center justify-between text-[#718096] dark:text-slate-400 mb-2">
                <Icon className="w-4 h-4 text-[#246BFD]" />
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#246BFD]" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#101A35] dark:text-white">{k.value}</p>
              <p className="text-xs text-[#718096] dark:text-slate-400 mt-1 truncate">{k.label}</p>
            </button>
          );
        })}
      </div>

      {/* 5 Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">1. Branch-Wise Students (12 GCET Branches)</h3>
            <button type="button" onClick={() => onNavigate('branches')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Branches
            </button>
          </div>
          {branchStudentsChart && <ChartCanvas config={branchStudentsChart} height={230} isDark={isDark} />}
        </div>

        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">2. Placement Statistics (Cohort vs Placed)</h3>
            <button type="button" onClick={() => onNavigate('placements')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Placements
            </button>
          </div>
          {placementStatsChart && <ChartCanvas config={placementStatsChart} height={230} isDark={isDark} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">3. Application Outcomes</h3>
            <button type="button" onClick={() => onNavigate('applications')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Pipeline
            </button>
          </div>
          {applicationOutcomesChart && <ChartCanvas config={applicationOutcomesChart} height={220} isDark={isDark} />}
        </div>

        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">4. Company-Wise Placements</h3>
            <button type="button" onClick={() => onNavigate('companies')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Directory
            </button>
          </div>
          {companyPlacementsChart && <ChartCanvas config={companyPlacementsChart} height={220} isDark={isDark} />}
        </div>

        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">5. Skill Matrix Distribution</h3>
            <button type="button" onClick={() => onNavigate('skill-matrix')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Skills
            </button>
          </div>
          {skillChartConfig && <ChartCanvas config={skillChartConfig} height={220} isDark={isDark} />}
        </div>
      </div>

      {/* Recent Activity + Upcoming Events & Deadlines + Latest Circulars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardCls} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Upcoming Events &amp; Deadlines</h3>
            <button type="button" onClick={() => onNavigate('drives')} className="text-xs font-medium text-[#246BFD] hover:underline">
              All Drives
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.upcomingDrives.slice(0, 4).map((d) => (
              <div key={d.drive_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-[#172033] dark:text-white truncate">{d.company_name} — {d.job_role}</p>
                  <p className="text-[11px] text-[#718096] dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Deadline {d.application_deadline} · Drive {d.drive_date}</span>
                  </p>
                </div>
                <StatusText status={d.drive_status} />
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardCls} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Latest Official Circulars</h3>
            <button type="button" onClick={() => onNavigate('campus-connect')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Campus Connect
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {announcements.slice(0, 4).map((a) => (
              <div key={a.announcement_id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                <p className="text-[11px] text-[#718096] dark:text-slate-400">{a.category_name} · {a.published_date}</p>
                <p className="text-xs font-semibold text-[#172033] dark:text-white line-clamp-1">{a.title}</p>
                <a
                  href={a.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#246BFD] hover:underline"
                >
                  <span>Read Full Notification</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardCls} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Recent Activity</h3>
            <button type="button" onClick={() => onNavigate('approvals')} className="text-xs font-medium text-[#246BFD] hover:underline">
              Approvals
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.activityLogs.slice(0, 5).map((log) => (
              <div key={log.log_id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                <p className="text-[#172033] dark:text-slate-200 leading-snug">{log.description}</p>
                <p className="text-[11px] text-[#718096] dark:text-slate-400 mt-0.5">
                  {log.actor_name} · <span className="font-mono">{String(log.created_at).slice(0, 16)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
