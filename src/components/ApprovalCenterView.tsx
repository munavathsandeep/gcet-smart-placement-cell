import { useEffect, useState } from 'react';
import { Award, Briefcase, Building2, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { apiRequest } from '../api';
import { ApprovalQueues, UserRole } from '../types';
import { cardCls, ConfirmDialog, StatusText, useToast } from './SharedUI';

export function ApprovalCenterView({ userRole = 'ADMIN' }: { userRole?: UserRole }) {
  const canDecide = userRole !== 'VICE_CHAIRMAN';
  const { showToast } = useToast();
  const [queues, setQueues] = useState<ApprovalQueues | null>(null);
  const [tab, setTab] = useState<'recruiters' | 'drives' | 'skills'>('recruiters');
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<{
    type: 'recruiter' | 'drive' | 'skill';
    id: number;
    decision: 'Approved' | 'Rejected';
    label: string;
  } | null>(null);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<ApprovalQueues>('/api/approvals');
      setQueues(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to load approval queues.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const executeDecision = async () => {
    if (!pendingAction) return;
    try {
      await apiRequest(`/api/approvals/${pendingAction.type}/${pendingAction.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: pendingAction.decision }),
      });
      showToast(`${pendingAction.label} marked as ${pendingAction.decision}.`);
      setPendingAction(null);
      loadApprovals();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Decision failed.', 'error');
    }
  };

  const recCount = queues?.pendingRecruiters.length ?? 0;
  const drvCount = queues?.pendingDrives.length ?? 0;
  const skCount = queues?.unverifiedSkills.length ?? 0;

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">
            Placement Cell Governance
          </p>
          <h2 className="text-xl font-bold text-[#101A35] dark:text-white mt-1">
            Approval Center — Recruiters, Drives &amp; Skill Verification
          </h2>
          <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
            Review corporate recruiter registrations, recruiter-submitted campus drives, and unverified student skill matrix claims.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {!canDecide && (
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
              Executive Audit View (Read-Only)
            </div>
          )}
          <div className="px-3.5 py-2 rounded-lg bg-[#F4F7FB] dark:bg-[#101827] border border-slate-200 dark:border-slate-700">
            <span className="text-[#718096] dark:text-slate-400">Total Pending: </span>
            <span className="font-mono font-bold text-[#101A35] dark:text-white">{recCount + drvCount + skCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('recruiters')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
            tab === 'recruiters'
              ? 'bg-[#246BFD] border-[#246BFD] text-white'
              : 'bg-white dark:bg-[#18243A] border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Recruiter Accounts ({recCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('drives')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
            tab === 'drives'
              ? 'bg-[#246BFD] border-[#246BFD] text-white'
              : 'bg-white dark:bg-[#18243A] border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Recruiter Drives ({drvCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('skills')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
            tab === 'skills'
              ? 'bg-[#246BFD] border-[#246BFD] text-white'
              : 'bg-white dark:bg-[#18243A] border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Skill Verifications ({skCount})</span>
        </button>
      </div>

      {loading ? (
        <div className={`${cardCls} p-8 text-center text-sm text-[#718096]`}>Loading approval queues...</div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          {tab === 'recruiters' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-700/70">
              {recCount === 0 ? (
                <div className="p-8 text-center text-sm text-[#718096] dark:text-slate-400">
                  All corporate recruiter registrations have been reviewed.
                </div>
              ) : (
                queues!.pendingRecruiters.map((r) => (
                  <div key={r.user_id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#172033] dark:text-white">{r.full_name}</h3>
                        <StatusText status={r.approval_status} />
                      </div>
                      <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
                        Company: <span className="font-medium text-[#172033] dark:text-slate-200">{r.company_name || 'Partner Organization'}</span>
                        {r.industry ? ` (${r.industry})` : ''} · Email: {r.email}
                        {r.phone ? ` · Phone: ${r.phone}` : ''} · Username: <span className="font-mono">{r.username}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canDecide ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'recruiter',
                                id: r.user_id,
                                decision: 'Approved',
                                label: `${r.full_name} (${r.company_name || 'Recruiter'})`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'recruiter',
                                id: r.user_id,
                                decision: 'Rejected',
                                label: `${r.full_name} (${r.company_name || 'Recruiter'})`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Pending Authority Decision</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'drives' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-700/70">
              {drvCount === 0 ? (
                <div className="p-8 text-center text-sm text-[#718096] dark:text-slate-400">
                  No recruiter-submitted placement drives are awaiting approval.
                </div>
              ) : (
                queues!.pendingDrives.map((d) => (
                  <div key={d.drive_id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#172033] dark:text-white">
                          {d.company_name} — {d.job_role}
                        </h3>
                        <StatusText status={d.approval_status} />
                      </div>
                      <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
                        {d.job_type} · <span className="font-mono font-semibold">{Number(d.salary_package).toFixed(2)} LPA</span> · Drive: {d.drive_date} · Deadline: {d.application_deadline}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canDecide ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'drive',
                                id: d.drive_id,
                                decision: 'Approved',
                                label: `${d.company_name} — ${d.job_role}`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve &amp; Activate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'drive',
                                id: d.drive_id,
                                decision: 'Rejected',
                                label: `${d.company_name} — ${d.job_role}`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Pending Authority Decision</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'skills' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-700/70">
              {skCount === 0 ? (
                <div className="p-8 text-center text-sm text-[#718096] dark:text-slate-400">
                  No unverified student skill claims are pending review.
                </div>
              ) : (
                queues!.unverifiedSkills.map((sk) => (
                  <div key={sk.student_skill_id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#172033] dark:text-white">
                          {sk.student_name} ({sk.roll_number}) · {sk.branch}
                        </h3>
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
                        Skill: <span className="font-semibold text-[#246BFD]">{sk.skill_name}</span> ({sk.category}) · Claimed Proficiency: <span className="font-mono">{sk.proficiency_level}/5</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canDecide ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'skill',
                                id: sk.student_skill_id,
                                decision: 'Approved',
                                label: `${sk.student_name} — ${sk.skill_name}`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify Skill</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                type: 'skill',
                                id: sk.student_skill_id,
                                decision: 'Rejected',
                                label: `${sk.student_name} — ${sk.skill_name}`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Claim</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Pending Verification</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={`Confirm ${pendingAction?.decision || 'Decision'}`}
        message={`Are you sure you want to mark "${pendingAction?.label}" as ${pendingAction?.decision}? The account holder will receive an instant portal notification.`}
        confirmLabel={pendingAction?.decision === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
        onConfirm={executeDecision}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
