import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api';
import {
  AuthUser,
  CompanyMatch,
  EligibilityResult,
  PlacementDrive,
  SkillGapReport,
  Student,
} from '../types';
import { ChartCanvas } from './ChartCanvas';
import { cardCls, inputCls, StatusText, useToast } from './SharedUI';

function useStudentAndDriveSelectors(user: AuthUser) {
  const [students, setStudents] = useState<Student[]>([]);
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [studentId, setStudentId] = useState<number | null>(
    user.role === 'STUDENT' && user.studentId ? user.studentId : null
  );
  const [driveId, setDriveId] = useState<number | null>(null);

  useEffect(() => {
    apiRequest<Student[]>('/api/students')
      .then((list) => {
        setStudents(list);
        if (!studentId && list.length > 0) setStudentId(list[0].student_id);
      })
      .catch(() => {});
    apiRequest<PlacementDrive[]>('/api/drives')
      .then((list) => {
        setDrives(list);
        if (list.length > 0) setDriveId(list[0].drive_id);
      })
      .catch(() => {});
  }, []);

  return { students, drives, studentId, setStudentId, driveId, setDriveId };
}

/* ==================== 1. ELIGIBILITY CHECKER ==================== */
export function EligibilityView({ user }: { user: AuthUser }) {
  const { students, drives, studentId, setStudentId, driveId, setDriveId } = useStudentAndDriveSelectors(user);
  const [results, setResults] = useState<EligibilityResult[]>([]);
  const [checkAllDrives, setCheckAllDrives] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    if (checkAllDrives) {
      apiRequest<EligibilityResult[]>(`/api/eligibility?studentId=${studentId}`).then(setResults).catch(() => {});
    } else if (driveId) {
      apiRequest<EligibilityResult>(`/api/eligibility?studentId=${studentId}&driveId=${driveId}`)
        .then((r) => setResults([r]))
        .catch(() => {});
    }
  }, [studentId, driveId, checkAllDrives]);

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-5 flex flex-wrap items-end justify-between gap-4`}>
        <div>
          <h2 className="text-base font-semibold text-[#172033] dark:text-white">Eligibility Verification Engine</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluates CGPA, distinct branch specialization, active backlogs, graduation batch, and skill thresholds
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user.role !== 'STUDENT' && (
            <select value={studentId ?? ''} onChange={(e) => setStudentId(Number(e.target.value))} className={`${inputCls} w-64`}>
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {s.roll_number} — {s.full_name} ({s.branch}, {Number(s.cgpa).toFixed(2)})
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 rounded-lg">
            <button
              type="button"
              onClick={() => setCheckAllDrives(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${checkAllDrives ? 'bg-white dark:bg-[#18243A] text-[#172033] dark:text-white shadow-sm' : 'text-slate-500'}`}
            >
              All Drives
            </button>
            <button
              type="button"
              onClick={() => setCheckAllDrives(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${!checkAllDrives ? 'bg-white dark:bg-[#18243A] text-[#172033] dark:text-white shadow-sm' : 'text-slate-500'}`}
            >
              Single Drive
            </button>
          </div>

          {!checkAllDrives && (
            <select value={driveId ?? ''} onChange={(e) => setDriveId(Number(e.target.value))} className={`${inputCls} w-64`}>
              {drives.map((d) => (
                <option key={d.drive_id} value={d.drive_id}>{d.company_name} — {d.job_role}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {results.map((r) => (
          <div key={r.driveId} className={`${cardCls} p-5 space-y-4`}>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/70">
              <div>
                <p className="text-xs font-medium text-[#246BFD] dark:text-[#20C5E8]">{r.companyName}</p>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white mt-0.5">{r.jobRole}</h3>
              </div>
              <StatusText status={r.eligible ? 'Eligible' : 'Not Eligible'} />
            </div>

            {r.metCriteria.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Satisfied Criteria</p>
                <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {r.metCriteria.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.rejectionReasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">Reasons for Rejection & Missing Requirements</p>
                <ul className="space-y-1 text-xs text-red-700 dark:text-red-300">
                  {r.rejectionReasons.map((rej, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      <span>{rej}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== 2. SKILL GAP ANALYSIS ==================== */
export function SkillGapView({ user, isDark }: { user: AuthUser; isDark: boolean }) {
  const { students, drives, studentId, setStudentId, driveId, setDriveId } = useStudentAndDriveSelectors(user);
  const [report, setReport] = useState<SkillGapReport | null>(null);

  useEffect(() => {
    if (studentId && driveId) {
      apiRequest<SkillGapReport>(`/api/skill-gap?studentId=${studentId}&driveId=${driveId}`).then(setReport).catch(() => {});
    }
  }, [studentId, driveId]);

  const chartConfig = useMemo(() => {
    if (!report) return null;
    return {
      type: 'bar' as const,
      data: {
        labels: report.comparisons.map((c) => c.skillName),
        datasets: [
          {
            label: 'Student Proficiency',
            data: report.comparisons.map((c) => c.studentLevel),
            backgroundColor: isDark ? '#3B82F6' : '#246BFD',
            borderRadius: 4,
          },
          {
            label: 'Company Requirement',
            data: report.comparisons.map((c) => c.requiredLevel),
            backgroundColor: isDark ? '#64748B' : '#94A3B8',
            borderRadius: 4,
          },
        ],
      },
      options: {
        scales: { y: { max: 5, beginAtZero: true } },
      },
    };
  }, [report, isDark]);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 flex flex-wrap items-end justify-between gap-4`}>
        <div>
          <h2 className="text-base font-semibold text-[#172033] dark:text-white">Skill Gap Analysis</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compare student proficiency levels against company drive benchmarks and identify learning priorities
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user.role !== 'STUDENT' && (
            <select value={studentId ?? ''} onChange={(e) => setStudentId(Number(e.target.value))} className={`${inputCls} w-60`}>
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>{s.roll_number} — {s.full_name}</option>
              ))}
            </select>
          )}
          <select value={driveId ?? ''} onChange={(e) => setDriveId(Number(e.target.value))} className={`${inputCls} w-72`}>
            {drives.map((d) => (
              <option key={d.drive_id} value={d.drive_id}>{d.company_name} — {d.job_role}</option>
            ))}
          </select>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`${cardCls} p-5 lg:col-span-7 overflow-hidden`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#172033] dark:text-white">
                  {report.companyName} — {report.jobRole}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Student: {report.studentName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Skill Readiness</p>
                <p className="text-xl font-bold font-mono tabular-nums text-[#246BFD] dark:text-blue-400">
                  {report.readinessPercentage}%
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Required Skill</th>
                    <th className="py-2.5 px-3 font-medium text-right">Student</th>
                    <th className="py-2.5 px-3 font-medium text-right">Target</th>
                    <th className="py-2.5 px-3 font-medium text-right">Gap</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 px-3 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                  {report.comparisons.map((c) => (
                    <tr key={c.skillId}>
                      <td className="py-3 px-3 font-medium text-[#172033] dark:text-white">{c.skillName}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">{c.studentLevel}/5</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">{c.requiredLevel}/5</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                        {c.gap > 0 ? `-${c.gap}` : '0'}
                      </td>
                      <td className="py-3 px-3"><StatusText status={c.status} /></td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{c.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardCls} p-5 lg:col-span-5 space-y-5`}>
            <div>
              <h3 className="text-sm font-semibold text-[#172033] dark:text-white mb-3">Proficiency Comparison Chart</h3>
              {chartConfig && <ChartCanvas config={chartConfig} height={220} isDark={isDark} />}
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/70">
              <h4 className="text-xs font-semibold text-[#172033] dark:text-white mb-2">Recommended Learning Priorities</h4>
              {report.recommendedActions.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {report.recommendedActions.map((act, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  All required skill proficiencies meet or exceed this company&apos;s benchmark.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 3. COMPANY MATCHING ==================== */
export function MatchingView({ user }: { user: AuthUser }) {
  const { students, studentId, setStudentId } = useStudentAndDriveSelectors(user);
  const { showToast } = useToast();
  const [matches, setMatches] = useState<CompanyMatch[]>([]);

  useEffect(() => {
    if (studentId) {
      apiRequest<CompanyMatch[]>(`/api/matching?studentId=${studentId}`).then(setMatches).catch(() => {});
    }
  }, [studentId]);

  const handleApply = async (driveId: number) => {
    try {
      await apiRequest('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ studentId, driveId }),
      });
      showToast('Application submitted for matched placement drive.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to apply', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-semibold text-[#172033] dark:text-white">Intelligent Company Matching</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic algorithm: Weighted Skill Alignment (60%) + CGPA Margin (25%) + Branch & Batch Fit (15%)
          </p>
        </div>

        {user.role !== 'STUDENT' && (
          <select value={studentId ?? ''} onChange={(e) => setStudentId(Number(e.target.value))} className={`${inputCls} w-64`}>
            {students.map((s) => (
              <option key={s.student_id} value={s.student_id}>{s.roll_number} — {s.full_name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-4">
        {matches.map((m) => (
          <div key={m.driveId} className={`${cardCls} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-[#172033] dark:text-white">{m.companyName}</h3>
                  <StatusText status={m.eligible ? 'Eligible' : 'Not Eligible'} />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {m.jobRole} · {m.jobType} · <span className="font-mono tabular-nums font-medium">{Number(m.salaryPackage).toFixed(2)} LPA</span> · {m.driveStatus}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Match Score</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#246BFD] dark:text-blue-400">
                    {m.matchPercentage}%
                  </p>
                </div>
                {m.eligible && m.driveStatus === 'Active' && (
                  <button
                    type="button"
                    onClick={() => handleApply(m.driveId)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white whitespace-nowrap"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden my-3.5">
              <div
                className="h-full bg-[#246BFD] dark:bg-blue-500 rounded-full"
                style={{ width: `${m.matchPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Matching Skills: </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {m.matchingSkills.length > 0 ? m.matchingSkills.join(', ') : 'None met yet'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-red-700 dark:text-red-400">Missing / Below Target: </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {m.missingSkills.length > 0 ? m.missingSkills.join(', ') : 'All required skills satisfied'}
                </span>
              </div>
            </div>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-2">
              Breakdown: {m.algorithmBreakdown}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
