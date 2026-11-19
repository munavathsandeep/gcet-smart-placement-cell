import React, { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Sun, Moon, ShieldCheck, Database, RefreshCw, FileText, FileSpreadsheet } from 'lucide-react';
import { apiRequest, downloadAuthenticatedFile } from '../api';
import {
  AnalyticsData,
  Application,
  AuthUser,
  formatRoleLabel,
  InstitutionalRegistrationReport,
  isExecutiveRole,
  isFacultyRole,
  isPlacementAdminRole,
  PlacementDrive,
  PlacementRecord,
  Student,
  SystemStatusData,
} from '../types';
import { ChartCanvas } from './ChartCanvas';
import { cardCls, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

/* ==================== 1. APPLICATIONS MANAGEMENT ==================== */
export function ApplicationsView({ user }: { user: AuthUser }) {
  const canUpdateStage =
    isPlacementAdminRole(user.role) ||
    (user.role === 'RECRUITER' && user.approvalStatus === 'Approved');
  const isStaff = user.role !== 'STUDENT' && user.role !== 'RECRUITER';
  const { showToast } = useToast();

  const [apps, setApps] = useState<Application[]>([]);
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [applyDriveId, setApplyDriveId] = useState('');
  const [applyStudentId, setApplyStudentId] = useState('');

  const [interviewModalApp, setInterviewModalApp] = useState<Application | null>(null);
  const [interviewDate, setInterviewDate] = useState('2026-12-16 11:00 AM');
  const [interviewMode, setInterviewMode] = useState('Online Technical Panel');
  const [interviewRemarks, setInterviewRemarks] = useState('');

  const loadApps = () => {
    apiRequest<Application[]>('/api/applications').then(setApps).catch(() => {});
  };

  useEffect(() => {
    loadApps();
    apiRequest<PlacementDrive[]>('/api/drives')
      .then((list) => {
        const active = list.filter((d) => d.drive_status === 'Active');
        setDrives(active);
        if (active.length > 0) setApplyDriveId(String(active[0].drive_id));
      })
      .catch(() => {});
    if (isStaff) {
      apiRequest<Student[]>('/api/students')
        .then((list) => {
          setStudents(list);
          if (list.length > 0) setApplyStudentId(String(list[0].student_id));
        })
        .catch(() => {});
    } else if (user.studentId) {
      setApplyStudentId(String(user.studentId));
    }
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ studentId: Number(applyStudentId), driveId: Number(applyDriveId) }),
      });
      showToast('Application submitted successfully after eligibility verification.');
      loadApps();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to submit application', 'error');
    }
  };

  const handleStatusChange = async (app: Application, status: Application['status']) => {
    if (status === 'Interview') {
      setInterviewModalApp(app);
      setInterviewDate(app.interview_date || '2026-12-16 11:00 AM');
      setInterviewMode(app.interview_mode || 'Online Technical Panel');
      setInterviewRemarks(app.remarks || 'Technical interview round scheduled');
      return;
    }
    try {
      await apiRequest(`/api/applications/${app.application_id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, remarks: `Updated to ${status}` }),
      });
      showToast(`Application moved to ${status} stage.`);
      loadApps();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to update application stage', 'error');
    }
  };

  const handleScheduleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewModalApp) return;
    try {
      await apiRequest(`/api/applications/${interviewModalApp.application_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Interview',
          interviewDate,
          interviewMode,
          remarks: interviewRemarks,
        }),
      });
      showToast(`Interview scheduled for ${interviewModalApp.student_name}.`);
      setInterviewModalApp(null);
      loadApps();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to schedule interview', 'error');
    }
  };

  const pipelineStages: Application['status'][] = ['Applied', 'Shortlisted', 'Assessment', 'Interview', 'Selected', 'Rejected'];
  const filtered = statusFilter === 'ALL' ? apps : apps.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Quick Apply Bar (Students & Academic Staff only; hidden for Recruiters) */}
      {user.role !== 'RECRUITER' && (
        <div className={`${cardCls} p-5`}>
          <h2 className="text-base font-semibold text-[#101A35] dark:text-white mb-1">Submit Placement Drive Application</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Automatically prevents duplicate applications, checks deadlines, and verifies CGPA, distinct branch, backlogs &amp; skill eligibility
          </p>

          <form onSubmit={handleApply} className="flex flex-wrap items-end gap-3">
            {isStaff && (
              <div className="min-w-[220px] flex-1">
                <label className={labelCls}>Student</label>
                <select value={applyStudentId} onChange={(e) => setApplyStudentId(e.target.value)} className={inputCls}>
                  {students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>{s.roll_number} — {s.full_name} ({s.branch})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="min-w-[260px] flex-1">
              <label className={labelCls}>Active Placement Opportunity</label>
              <select value={applyDriveId} onChange={(e) => setApplyDriveId(e.target.value)} className={inputCls}>
                {drives.map((d) => (
                  <option key={d.drive_id} value={d.drive_id}>
                    {d.company_name} — {d.job_role} ({d.compensation_label || `${Number(d.salary_package).toFixed(2)} LPA`})
                  </option>
                ))}
                {drives.length === 0 && <option value="">No Active Drives Open</option>}
              </select>
            </div>
            <button
              type="submit"
              disabled={!applyDriveId}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white disabled:opacity-50 whitespace-nowrap"
            >
              Submit Application
            </button>
          </form>
        </div>
      )}

      {/* Filter & Applications Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Application Tracking &amp; Interview Pipeline</h3>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700 rounded-lg">
            {['ALL', ...pipelineStages].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#172B50] text-[#101A35] dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 font-medium">Student</th>
                <th className="py-3 px-4 font-medium">Company &amp; Role</th>
                <th className="py-3 px-4 font-medium">Applied / Interview</th>
                <th className="py-3 px-4 font-medium">Current Status</th>
                {canUpdateStage && <th className="py-3 px-4 font-medium">Update Stage</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.map((a) => (
                <tr key={a.application_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#172033] dark:text-white">{a.student_name}</p>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{a.roll_number} · {a.branch}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#172033] dark:text-slate-100">{a.company_name}</p>
                    <p className="text-slate-500 dark:text-slate-400">{a.job_role}</p>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    <div>{String(a.applied_at).slice(0, 10)}</div>
                    {a.interview_date && (
                      <div className="text-[11px] text-[#246BFD] mt-0.5">
                        {a.interview_date} ({a.interview_mode || 'Panel'})
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4"><StatusText status={a.status} /></td>
                  {canUpdateStage && (
                    <td className="py-3 px-4">
                      <select
                        value={a.status}
                        onChange={(e) => handleStatusChange(a, e.target.value as Application['status'])}
                        className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#101827]"
                      >
                        {pipelineStages.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={canUpdateStage ? 5 : 4} className="py-8 text-center text-slate-500">No applications found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(interviewModalApp)}
        title={`Schedule Interview — ${interviewModalApp?.student_name || ''}`}
        onClose={() => setInterviewModalApp(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleScheduleInterviewSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Interview Date &amp; Time</label>
            <input required value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className={inputCls} />
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
            <button type="button" onClick={() => setInterviewModalApp(null)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700">
              Confirm Interview
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ==================== 2. PLACEMENT TRACKING ==================== */
export function PlacementsView({ user }: { user: AuthUser }) {
  const canManage = isPlacementAdminRole(user.role) && user.role !== 'VICE_CHAIRMAN';
  const { showToast } = useToast();

  const [placements, setPlacements] = useState<PlacementRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [driveId, setDriveId] = useState('');
  const [packageLpa, setPackageLpa] = useState('7.00');
  const [offerDate, setOfferDate] = useState('2026-11-14');
  const [joiningStatus, setJoiningStatus] = useState<PlacementRecord['joining_status']>('Offered');
  const [err, setErr] = useState('');

  const loadData = () => {
    apiRequest<PlacementRecord[]>('/api/placements').then(setPlacements).catch(() => {});
  };

  useEffect(() => {
    loadData();
    if (canManage) {
      apiRequest<Student[]>('/api/students')
        .then((l) => {
          setStudents(l);
          if (l.length > 0) setStudentId(String(l[0].student_id));
        })
        .catch(() => {});
      apiRequest<PlacementDrive[]>('/api/drives')
        .then((l) => {
          setDrives(l);
          if (l.length > 0) {
            setDriveId(String(l[0].drive_id));
            setPackageLpa(String(l[0].salary_package));
          }
        })
        .catch(() => {});
    }
  }, [canManage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await apiRequest('/api/placements', {
        method: 'POST',
        body: JSON.stringify({
          studentId: Number(studentId),
          driveId: Number(driveId),
          packageLpa: Number(packageLpa),
          offerDate,
          joiningStatus,
        }),
      });
      showToast('Placement offer recorded successfully.');
      setModalOpen(false);
      loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unable to record placement');
    }
  };

  const handleStatusUpdate = async (id: number, status: PlacementRecord['joining_status']) => {
    try {
      await apiRequest(`/api/placements/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ joiningStatus: status }),
      });
      showToast(`Joining status updated to ${status}.`);
      loadData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to update placement', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">Placement Offer & Joining Tracker</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified student selections, compensation packages, and onboarding status
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setErr('');
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-800 text-white whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Record Placement Offer</span>
          </button>
        )}
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#0A1120] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D45]">
              <tr>
                <th className="py-3 px-4 font-medium">Student</th>
                <th className="py-3 px-4 font-medium">Company</th>
                <th className="py-3 px-4 font-medium">Job Role</th>
                <th className="py-3 px-4 font-medium text-right">Package (LPA)</th>
                <th className="py-3 px-4 font-medium">Offer Date</th>
                <th className="py-3 px-4 font-medium">Status</th>
                {canManage && <th className="py-3 px-4 font-medium">Update</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D45]">
              {placements.map((p) => (
                <tr key={p.placement_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#0F2140] dark:text-white">{p.student_name}</p>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{p.roll_number} · {p.branch}</p>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#0F2140] dark:text-slate-200">{p.company_name}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{p.job_role}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {Number(p.package_lpa).toFixed(2)} LPA
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">{p.offer_date}</td>
                  <td className="py-3 px-4"><StatusText status={p.joining_status} /></td>
                  {canManage && (
                    <td className="py-3 px-4">
                      <select
                        value={p.joining_status}
                        onChange={(e) => handleStatusUpdate(p.placement_id, e.target.value as PlacementRecord['joining_status'])}
                        className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-[#243552] bg-white dark:bg-[#0A1120]"
                      >
                        <option value="Offered">Offered</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Joined">Joined</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {placements.length === 0 && (
                <tr><td colSpan={canManage ? 7 : 6} className="py-8 text-center text-slate-500">No placement records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} title="Record Placement Selection" onClose={() => setModalOpen(false)} maxWidth="max-w-md">
        <form onSubmit={handleCreate} className="space-y-3.5">
          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
          <div>
            <label className={labelCls}>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>{s.roll_number} — {s.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Placement Drive</label>
            <select
              value={driveId}
              onChange={(e) => {
                setDriveId(e.target.value);
                const found = drives.find((d) => String(d.drive_id) === e.target.value);
                if (found) setPackageLpa(String(found.salary_package));
              }}
              className={inputCls}
            >
              {drives.map((d) => (
                <option key={d.drive_id} value={d.drive_id}>{d.company_name} — {d.job_role}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Package (LPA)</label>
              <input type="number" step="0.05" required value={packageLpa} onChange={(e) => setPackageLpa(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Offer Date</label>
              <input type="date" required value={offerDate} onChange={(e) => setOfferDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Joining Status</label>
            <select value={joiningStatus} onChange={(e) => setJoiningStatus(e.target.value as PlacementRecord['joining_status'])} className={inputCls}>
              <option value="Offered">Offered</option>
              <option value="Accepted">Accepted</option>
              <option value="Joined">Joined</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white">Save Offer</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ==================== 3. REPORTS & ANALYTICS ==================== */
export function ReportsView({ user, isDark }: { user: AuthUser; isDark: boolean }) {
  const isFaculty = isFacultyRole(user.role);
  const canViewRegistrationReport = isExecutiveRole(user.role) || isFacultyRole(user.role);
  const { showToast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [regReport, setRegReport] = useState<InstitutionalRegistrationReport | null>(null);
  const [loadingRegReport, setLoadingRegReport] = useState(false);
  const [exportingFmt, setExportingFmt] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);

  const loadRegReport = () => {
    if (!canViewRegistrationReport) return;
    setLoadingRegReport(true);
    apiRequest<InstitutionalRegistrationReport>('/api/reports/registrations')
      .then(setRegReport)
      .catch((err) => {
        showToast(err instanceof Error ? err.message : 'Unable to load registration statistics', 'error');
      })
      .finally(() => setLoadingRegReport(false));
  };

  useEffect(() => {
    apiRequest<AnalyticsData>('/api/analytics').then(setData).catch(() => {});
    if (canViewRegistrationReport) {
      loadRegReport();
    }
  }, [canViewRegistrationReport]);

  const handleExportRegistrationReport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    setExportingFmt(format);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      await downloadAuthenticatedFile(
        `/api/reports/registrations/export?format=${format}`,
        `gcet-registration-report-${dateStamp}.${format}`
      );
      showToast(`Downloaded institutional registration report (${format.toUpperCase()}).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export registration report', 'error');
    } finally {
      setExportingFmt(null);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      'Branch,Branch Name,Degree,Total Students,Placed Students',
      ...data.branchDistribution.map(
        (b) => `${b.label},"${b.branch_name || b.label}",${b.degree_level || 'B.Tech'},${b.count},${b.placed}`
      ),
      '',
      'Company,Hired Count,Average Package (LPA)',
      ...data.companyPlacements.map((c) => `"${c.label}",${c.count},${c.avgPackage}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcet-career-connect-analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Analytics CSV report downloaded.', 'info');
  };

  const outcomesChart = useMemo(() => {
    if (!data) return null;
    return {
      type: 'doughnut' as const,
      data: {
        labels: data.applicationOutcomes.map((o) => o.label),
        datasets: [
          {
            data: data.applicationOutcomes.map((o) => o.count),
            backgroundColor: ['#246BFD', '#D97706', '#0284C7', '#7C3AED', '#16A34A', '#DC2626'],
            borderWidth: 0,
          },
        ],
      },
      options: { plugins: { legend: { position: 'right' as const } } },
    };
  }, [data]);

  const companyChart = useMemo(() => {
    if (!data) return null;
    const activeCompanies = data.companyPlacements.filter((c) => c.count > 0);
    const source = activeCompanies.length > 0 ? activeCompanies : data.companyPlacements.slice(0, 8);
    return {
      type: 'bar' as const,
      data: {
        labels: source.map((c) => c.label.split(' ')[0]),
        datasets: [
          {
            label: 'Students Placed',
            data: source.map((c) => c.count),
            backgroundColor: isDark ? '#3B82F6' : '#246BFD',
            borderRadius: 4,
          },
        ],
      },
    };
  }, [data, isDark]);

  if (!data) {
    return <div className={`${cardCls} p-8 text-center text-xs text-slate-500`}>Generating analytics report...</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">
            {isFaculty ? 'Department Placement Reports & Analytics' : 'Placement Reports & Analytics'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isFaculty
              ? `Live database aggregations for ${user.departmentName || 'Assigned Department'} (${(user.assignedBranches || []).join(', ') || user.assignedBranch || 'Department'})`
              : 'Live database aggregations across all 12 GCET branches, recruiters, and competency benchmarks'}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-800 text-white whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Export Analytics CSV</span>
        </button>
      </div>

      {canViewRegistrationReport && (
        <div className={`${cardCls} p-5 space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#1E2D45]">
            <div>
              <h3 className="text-sm font-semibold text-[#0F2140] dark:text-white">
                Automatic Institutional Registration Statistics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live deduplicated database counts across all 9 roles and 7 GCET departments ·{' '}
                <span className="font-mono">
                  Last Updated: {regReport?.lastUpdated ? new Date(regReport.lastUpdated).toLocaleString() : 'Refreshing...'}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadRegReport}
                disabled={loadingRegReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#243552] hover:bg-slate-50 dark:hover:bg-[#16233B] disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRegReport ? 'animate-spin' : ''}`} />
                <span>Refresh Statistics</span>
              </button>
              <button
                type="button"
                disabled={exportingFmt !== null}
                onClick={() => handleExportRegistrationReport('pdf')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{exportingFmt === 'pdf' ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                disabled={exportingFmt !== null}
                onClick={() => handleExportRegistrationReport('xlsx')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{exportingFmt === 'xlsx' ? 'Generating...' : 'Download Excel (.xlsx)'}</span>
              </button>
              <button
                type="button"
                disabled={exportingFmt !== null}
                onClick={() => handleExportRegistrationReport('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#101A35] dark:bg-[#246BFD] hover:opacity-95 text-white disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingFmt === 'csv' ? 'Generating...' : 'Download CSV'}</span>
              </button>
            </div>
          </div>

          {regReport ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                {[
                  ['Total Members', regReport.totalRegisteredMembers],
                  ['Active Accounts', regReport.totalActiveUsers],
                  ['Student Profiles', regReport.totalStudentProfiles],
                  ['Faculty Coords', regReport.totalFacultyMembers],
                  ['Executive Leaders', regReport.totalExecutiveLeadership],
                  ['Recruiters', regReport.totalRecruiters],
                  ['Pending Approvals', regReport.approvalStatusCounts.Pending],
                ].map(([label, val]) => (
                  <div key={String(label)} className="p-3 rounded-lg bg-slate-50 dark:bg-[#0A1120] border border-slate-200 dark:border-[#1E2D45]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{label}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-[#0F2140] dark:text-white mt-0.5">{val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#1E2D45]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0A1120] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D45]">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Role Code</th>
                        <th className="py-2.5 px-3 font-medium">Role Designation</th>
                        <th className="py-2.5 px-3 font-medium text-right">Active</th>
                        <th className="py-2.5 px-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D45]">
                      {regReport.roleCounts.map((r) => (
                        <tr key={r.role}>
                          <td className="py-2 px-3 font-mono font-semibold text-[#0F2140] dark:text-white">{r.role}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{r.label}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{r.activeCount}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{r.totalCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#1E2D45]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0A1120] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D45]">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Dept</th>
                        <th className="py-2.5 px-3 font-medium">Department Name</th>
                        <th className="py-2.5 px-3 font-medium text-right">Faculty</th>
                        <th className="py-2.5 px-3 font-medium text-right">Students</th>
                        <th className="py-2.5 px-3 font-medium text-right">Placed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D45]">
                      {regReport.departmentStats.map((d) => (
                        <tr key={d.deptId}>
                          <td className="py-2 px-3 font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">{d.deptCode}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{d.deptName}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{d.facultyCount}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{d.studentCount}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{d.placedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Loading institutional registration statistics...</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Placement Percentage</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#246BFD] dark:text-blue-400 mt-1">{data.placementPercentage}%</p>
        </div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Registered Students</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0F2140] dark:text-white mt-1">{data.totalStudents}</p>
        </div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Active Opportunities</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0F2140] dark:text-white mt-1">{data.activeDrives}</p>
        </div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Applications</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0F2140] dark:text-white mt-1">{data.totalApplications}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${cardCls} p-5`}>
          <h3 className="text-sm font-semibold text-[#0F2140] dark:text-white mb-4">Application Pipeline Outcomes</h3>
          {outcomesChart && <ChartCanvas config={outcomesChart} height={260} isDark={isDark} />}
        </div>
        <div className={`${cardCls} p-5`}>
          <h3 className="text-sm font-semibold text-[#0F2140] dark:text-white mb-4">Company-Wise Selections</h3>
          {companyChart && <ChartCanvas config={companyChart} height={260} isDark={isDark} />}
        </div>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E2D45]">
          <h3 className="text-sm font-semibold text-[#0F2140] dark:text-white">
            {isFaculty
              ? `Branch-Wise Placement Summary (${(user.assignedBranches || []).join(', ') || user.assignedBranch || 'Assigned Branches'})`
              : 'Branch-Wise Placement Summary (All 12 GCET Branches)'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#0A1120] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D45]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Branch Code</th>
                <th className="py-2.5 px-4 font-medium">Program & Degree</th>
                <th className="py-2.5 px-4 font-medium text-right">Total Students</th>
                <th className="py-2.5 px-4 font-medium text-right">Placed</th>
                <th className="py-2.5 px-4 font-medium text-right">Placement Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D45]">
              {data.branchDistribution.map((b) => {
                const rate = b.count > 0 ? ((b.placed / b.count) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={b.label}>
                    <td className="py-3 px-4 font-mono font-semibold text-[#0F2140] dark:text-white">{b.label}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {b.branch_name || b.label} · {b.degree_level || 'B.Tech'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{b.count}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{b.placed}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ==================== 4. SETTINGS ==================== */
export function SettingsView({
  user,
  isDark,
  onToggleTheme,
  onUserUpdated,
}: {
  user: AuthUser;
  isDark: boolean;
  onToggleTheme: () => void;
  onUserUpdated?: (updated: AuthUser) => void;
}) {
  const { showToast } = useToast();
  const isAdminStaff = isPlacementAdminRole(user.role);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [syncInterval, setSyncInterval] = useState('60');
  const [savingInterval, setSavingInterval] = useState(false);

  const loadSystemStatus = () => {
    if (!isAdminStaff) return;
    apiRequest<SystemStatusData>('/api/admin/system-status')
      .then((data) => {
        setSystemStatus(data);
        setSyncInterval(String(data.syncHealth.syncIntervalMinutes || 60));
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadSystemStatus();
  }, [isAdminStaff]);

  const handleUpdateInterval = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInterval(true);
    try {
      await apiRequest('/api/admin/system-status/sync-interval', {
        method: 'PUT',
        body: JSON.stringify({ syncIntervalMinutes: Number(syncInterval) }),
      });
      showToast(`Sync scheduler interval updated to ${syncInterval} minutes.`);
      loadSystemStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update interval', 'error');
    } finally {
      setSavingInterval(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showToast('New password must be at least 8 characters and include both letters and numbers.', 'error');
      return;
    }
    if (newPassword === currentPassword) {
      showToast('New password must differ from your current password.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }
    setSavingPwd(true);
    try {
      const res = await apiRequest<AuthUser & { message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast(res.message || 'Password updated securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onUserUpdated?.(res);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to update password', 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${cardCls} p-6 space-y-5`}>
          <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">Portal Appearance & Account</h2>

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-[#0A1120] border border-slate-200 dark:border-[#1E2D45]">
            <div>
              <p className="text-sm font-medium text-[#0F2140] dark:text-white">Interface Theme</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saved automatically to browser localStorage</p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E]"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
            </button>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#1E2D45]">
            <h3 className="text-sm font-semibold text-[#0F2140] dark:text-white">Update Account Password</h3>
            {user.mustChangePassword && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                Your temporary/initial password is still active{user.passwordChangeDismissed ? ' (first-login prompt dismissed)' : ''}. Set a personal password below to secure your account.
              </div>
            )}
            <div>
              <label className={labelCls}>Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars (letters & numbers)"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPwd}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {savingPwd ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        <div className={`${cardCls} p-6 space-y-4`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">Institution & RBAC Session Summary</h2>
          </div>
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <p><span className="font-medium text-[#0F2140] dark:text-white">Institution:</span> Geethanjali College of Engineering and Technology (GCET), Hyderabad</p>
            <p><span className="font-medium text-[#0F2140] dark:text-white">Signed-In User:</span> {user.fullName}</p>
            <p><span className="font-medium text-[#0F2140] dark:text-white">Institutional Email:</span> {user.email}</p>
            <p><span className="font-medium text-[#0F2140] dark:text-white">Authorized Role:</span> {formatRoleLabel(user.role)}</p>
            {user.employeeId && (
              <p><span className="font-medium text-[#0F2140] dark:text-white">Employee ID:</span> <span className="font-mono">{user.employeeId}</span></p>
            )}
            {user.assignedBranch && (
              <p><span className="font-medium text-[#0F2140] dark:text-white">Assigned Branch Scope:</span> {user.assignedBranch}</p>
            )}
          </div>
        </div>
      </div>

      {isAdminStaff && systemStatus && (
        <div className={`${cardCls} p-6 space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">System Diagnostics & Scheduler Status</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {systemStatus.databaseEngine} · Status: {systemStatus.databaseConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadSystemStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#243552] hover:bg-slate-50 dark:hover:bg-[#16233B]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Diagnostics</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            {[
              ['Students', systemStatus.counts.students],
              ['Faculty', systemStatus.counts.faculty],
              ['Companies', systemStatus.counts.companies],
              ['Drives', systemStatus.counts.drives],
              ['Applications', systemStatus.counts.applications],
              ['Placements', systemStatus.counts.placements],
              ['Circulars', systemStatus.counts.announcements],
              ['Unread Alerts', systemStatus.counts.unreadNotifications],
            ].map(([label, val]) => (
              <div key={String(label)} className="p-3 rounded-lg bg-slate-50 dark:bg-[#0A1120] border border-slate-200 dark:border-[#1E2D45]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-base font-bold font-mono text-[#0F2140] dark:text-white mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-[#1E2D45]">
            <form onSubmit={handleUpdateInterval} className="space-y-2.5">
              <label className={labelCls}>Automated Announcement Sync Interval</label>
              <div className="flex items-center gap-2">
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value)}
                  disabled={user.role !== 'ADMIN'}
                  className={inputCls}
                >
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every 60 minutes (Default)</option>
                  <option value="180">Every 3 hours</option>
                  <option value="360">Every 6 hours</option>
                </select>
                {user.role === 'ADMIN' && (
                  <button
                    type="submit"
                    disabled={savingInterval}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white whitespace-nowrap disabled:opacity-50"
                  >
                    {savingInterval ? 'Saving...' : 'Apply'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Last verified sync: <span className="font-mono">{systemStatus.syncHealth.lastSuccessfulSync || 'Seeded Baseline'}</span>
              </p>
            </form>

            <div className="lg:col-span-2 space-y-2">
              <p className={labelCls}>Recent Official Source Sync Logs</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-[#1E2D45] divide-y divide-slate-100 dark:divide-[#1E2D45] text-[11px]">
                {systemStatus.syncHealth.recentLogs.slice(0, 6).map((log) => (
                  <div key={log.log_id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-[180px]">
                      <span className="font-semibold text-[#0F2140] dark:text-white">{log.source_name}</span>
                      <span className="text-slate-500 dark:text-slate-400"> · {log.message}</span>
                    </div>
                    <span className="font-mono text-slate-400">{log.sync_status} · {log.synced_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

