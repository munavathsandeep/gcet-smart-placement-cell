import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Search,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api';
import {
  AuthUser,
  FacultyProfileApprovalHistoryItem,
  FacultyProfileDraftPayload,
  FacultyProfileSubmissionRecord,
  FacultySkillRecord,
  isFacultyRole,
  isPlacementAdminRole,
  ProfileApprovalHistoryItem,
  ProfileApprovalStatus,
  ProfileDraftPayload,
  ProfileSubmissionRecord,
} from '../types';
import { cardCls, inputCls, labelCls, Modal, useToast } from './SharedUI';
import { ProfileApprovalBadge, ProfileProgressTimeline } from './ProfileStatusWidgets';

interface FacultyQueueRow {
  submission_id: number;
  submission_code: string;
  faculty_id: number;
  user_id: number;
  faculty_name: string;
  employee_id: string;
  designation: string;
  department_name: string;
  status: ProfileApprovalStatus;
  changedCount: number;
  submitted_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  reviewer_remarks: string | null;
  updated_at: string;
}

interface FacultySubmissionDetailResponse {
  submission: FacultyProfileSubmissionRecord;
  officialProfile: FacultyProfileDraftPayload | null;
  skills: FacultySkillRecord[];
  approvalHistory: FacultyProfileApprovalHistoryItem[];
}

interface QueueRow {
  submission_id: number;
  submission_code: string;
  student_id: number;
  student_name: string;
  roll_number: string;
  branch: string;
  section: string;
  cgpa: number;
  assigned_faculty_id: number | null;
  assigned_faculty_name: string | null;
  status: ProfileApprovalStatus;
  changedCount: number;
  submitted_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  faculty_remarks: string | null;
  updated_at: string;
}

interface SubmissionDetailResponse {
  submission: ProfileSubmissionRecord;
  officialDossier: ProfileDraftPayload | null;
  approvalHistory: ProfileApprovalHistoryItem[];
}

interface FacultyProfileApprovalsViewProps {
  user: AuthUser;
  onPendingCountChange?: (count: number) => void;
}

export function FacultyProfileApprovalsView({ user, onPendingCountChange }: FacultyProfileApprovalsViewProps) {
  const { showToast } = useToast();
  const canReviewFaculty = isPlacementAdminRole(user.role);
  const [queueType, setQueueType] = useState<'students' | 'faculty'>('students');

  const [rows, setRows] = useState<QueueRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [facultyRows, setFacultyRows] = useState<FacultyQueueRow[]>([]);
  const [facultyPendingCount, setFacultyPendingCount] = useState(0);
  const [facultyLoading, setFacultyLoading] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<SubmissionDetailResponse | null>(null);
  const [selectedFacultyDetail, setSelectedFacultyDetail] = useState<FacultySubmissionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Review action modal / remarks
  const [decisionMode, setDecisionMode] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION' | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Resume preview modal
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [resumePreviewName, setResumePreviewName] = useState('Resume.pdf');

  const loadQueue = async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== 'ALL' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await apiRequest<{ submissions: QueueRow[]; pendingCount: number }>(
        `/api/faculty/profile-approvals${qs}`
      );
      setRows(res.submissions);
      setPendingCount(res.pendingCount);
      onPendingCountChange?.(res.pendingCount);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load student profile submissions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadFacultyQueue = async () => {
    if (!canReviewFaculty) return;
    setFacultyLoading(true);
    try {
      const qs = statusFilter !== 'ALL' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await apiRequest<{ submissions: FacultyQueueRow[]; pendingCount: number }>(
        `/api/faculty/profile-approvals/faculty${qs}`
      );
      setFacultyRows(res.submissions);
      setFacultyPendingCount(res.pendingCount);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load faculty profile submissions.', 'error');
    } finally {
      setFacultyLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    if (canReviewFaculty) {
      loadFacultyQueue();
    }
  }, [statusFilter, canReviewFaculty]);

  const openInspector = async (submissionId: number) => {
    setDetailLoading(true);
    try {
      const res = await apiRequest<SubmissionDetailResponse>(`/api/faculty/profile-approvals/${submissionId}`);
      setSelectedDetail(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load submission comparison.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || !decisionMode) return;
    if ((decisionMode === 'REJECT' || decisionMode === 'REQUEST_CORRECTION') && decisionRemarks.trim().length < 3) {
      showToast(
        decisionMode === 'REJECT'
          ? 'Please provide a clear rejection reason.'
          : 'Please enter correction instructions for the student.',
        'error'
      );
      return;
    }
    setSubmittingDecision(true);
    try {
      const res = await apiRequest<{ status: string; submissionCode: string; message: string }>(
        `/api/faculty/profile-approvals/${selectedDetail.submission.submission_id}/decision`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision: decisionMode,
            remarks: decisionRemarks.trim(),
          }),
        }
      );
      showToast(res.message);
      setDecisionMode(null);
      setDecisionRemarks('');
      await Promise.all([loadQueue(), openInspector(selectedDetail.submission.submission_id)]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to process review decision.', 'error');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const openFacultyInspector = async (submissionId: number) => {
    setDetailLoading(true);
    try {
      const res = await apiRequest<FacultySubmissionDetailResponse>(`/api/faculty/profile-approvals/faculty/${submissionId}`);
      setSelectedFacultyDetail(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load faculty submission comparison.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFacultyDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyDetail || !decisionMode) return;
    if ((decisionMode === 'REJECT' || decisionMode === 'REQUEST_CORRECTION') && decisionRemarks.trim().length < 3) {
      showToast(
        decisionMode === 'REJECT'
          ? 'Please provide a clear rejection reason.'
          : 'Please enter correction instructions for the faculty member.',
        'error'
      );
      return;
    }
    setSubmittingDecision(true);
    try {
      const res = await apiRequest<{ status: string; submissionCode: string; message: string }>(
        `/api/faculty/profile-approvals/faculty/${selectedFacultyDetail.submission.submission_id}/decision`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision: decisionMode,
            remarks: decisionRemarks.trim(),
          }),
        }
      );
      showToast(res.message);
      setDecisionMode(null);
      setDecisionRemarks('');
      await Promise.all([loadFacultyQueue(), openFacultyInspector(selectedFacultyDetail.submission.submission_id)]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to process review decision.', 'error');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleOpenResume = (resume: ProfileDraftPayload['resume']) => {
    if (!resume?.file_data_url) {
      showToast('No PDF data available for preview.', 'info');
      return;
    }
    setResumePreviewName(resume.file_name);
    setResumePreviewUrl(resume.file_data_url);
  };

  const filteredRows = rows.filter((r) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      r.student_name.toLowerCase().includes(q) ||
      r.roll_number.toLowerCase().includes(q) ||
      r.branch.toLowerCase().includes(q) ||
      r.submission_code.toLowerCase().includes(q)
    );
  });

  const filteredFacultyRows = facultyRows.filter((r) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      r.faculty_name.toLowerCase().includes(q) ||
      r.employee_id.toLowerCase().includes(q) ||
      r.designation.toLowerCase().includes(q) ||
      r.submission_code.toLowerCase().includes(q)
    );
  });

  if (selectedFacultyDetail) {
    const sub = selectedFacultyDetail.submission;
    const isPending = sub.status === 'WAITING_FOR_APPROVAL';
    const isSelf = sub.user_id === user.userId;

    return (
      <div className="space-y-6">
        <div className={`${cardCls} p-5 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedFacultyDetail(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101827]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Queue</span>
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#101A35] dark:text-white">
                    {sub.faculty_name} ({sub.employee_id || 'Faculty'})
                  </h2>
                  <ProfileApprovalBadge status={sub.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Submission ID: <span className="font-mono font-semibold">{sub.submission_code}</span> ·{' '}
                  {sub.designation || 'Faculty'} · {sub.department_name || 'GCET'} · Submitted:{' '}
                  <span className="font-mono">{sub.submitted_at ? String(sub.submitted_at).slice(0, 16) : '—'}</span>
                </p>
              </div>
            </div>

            {isPending && !isSelf && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDecisionMode('APPROVE');
                    setDecisionRemarks('Verified and approved for official GCET faculty profile.');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>APPROVE PROFILE</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionMode('REQUEST_CORRECTION');
                    setDecisionRemarks('');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>REQUEST CORRECTIONS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionMode('REJECT');
                    setDecisionRemarks('');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>REJECT PROFILE</span>
                </button>
              </div>
            )}
            {isPending && isSelf && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Self-approval blocked: another authorized administrator must review this submission.
              </p>
            )}
          </div>

          <ProfileProgressTimeline status={sub.status} />

          {sub.reviewer_remarks && (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] text-xs">
              <span className="font-semibold text-[#101A35] dark:text-white">Latest Reviewer Remarks:</span>{' '}
              <span className="text-slate-600 dark:text-slate-300">{sub.reviewer_remarks}</span>
            </div>
          )}
        </div>

        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                Side-by-Side Comparison: Official vs Submitted Faculty Changes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official faculty profile records only update once approved.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">
              {sub.changed_fields.length} Changed Field(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Section</th>
                  <th className="py-2.5 px-4 font-medium">Field</th>
                  <th className="py-2.5 px-4 font-medium">Previous Official Value</th>
                  <th className="py-2.5 px-4 font-medium">Newly Submitted Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {sub.changed_fields.map((d, idx) => (
                  <tr key={`${d.field_key}-${idx}`} className="bg-amber-50/40 dark:bg-amber-950/10">
                    <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{d.section_name}</td>
                    <td className="py-3 px-4 font-semibold text-[#172033] dark:text-white whitespace-nowrap">{d.field_label}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs break-words">{d.previous_value || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-800 dark:text-emerald-300 max-w-xs break-words">{d.new_value || '—'}</td>
                  </tr>
                ))}
                {sub.changed_fields.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No field differences detected vs official faculty snapshot.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/70">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Faculty Approval Audit History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Submission ID</th>
                  <th className="py-2.5 px-4 font-medium">Action</th>
                  <th className="py-2.5 px-4 font-medium">Reviewer / Actor</th>
                  <th className="py-2.5 px-4 font-medium">Remarks</th>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {selectedFacultyDetail.approvalHistory.map((h) => (
                  <tr key={h.history_id}>
                    <td className="py-2.5 px-4 font-mono">{h.submission_code || '—'}</td>
                    <td className="py-2.5 px-4 font-semibold">{h.action.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-4">{h.reviewer_name}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{h.remarks || '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{String(h.action_at).slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          open={Boolean(decisionMode)}
          title={
            decisionMode === 'APPROVE'
              ? `Approve Faculty Profile — ${sub.submission_code}`
              : decisionMode === 'REJECT'
              ? `Reject Faculty Profile — ${sub.submission_code}`
              : `Request Corrections — ${sub.submission_code}`
          }
          onClose={() => setDecisionMode(null)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleFacultyDecisionSubmit} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {decisionMode === 'APPROVE'
                ? `Approving will immediately update ${sub.faculty_name}'s Official Faculty Profile with all ${sub.changed_fields.length} submitted change(s).`
                : decisionMode === 'REJECT'
                ? `Rejecting will keep ${sub.faculty_name}'s Official Faculty Profile unchanged and notify them with your reason.`
                : `Requesting corrections will keep the Official Faculty Profile unchanged and return the submission to ${sub.faculty_name}.`}
            </p>
            <div>
              <label className={labelCls}>
                {decisionMode === 'APPROVE'
                  ? 'Verification Remarks (Optional)'
                  : decisionMode === 'REJECT'
                  ? 'Rejection Reason (Mandatory)'
                  : 'Correction Instructions (Mandatory)'}
              </label>
              <textarea
                required={decisionMode !== 'APPROVE'}
                rows={3}
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder={
                  decisionMode === 'APPROVE'
                    ? 'Verified faculty profile updates.'
                    : decisionMode === 'REJECT'
                    ? 'State clearly why this faculty profile revision cannot be approved...'
                    : 'Specify exact fields needing correction...'
                }
                className={inputCls}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionMode(null)}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDecision}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-60 ${
                  decisionMode === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionMode === 'REJECT'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {submittingDecision
                  ? 'Processing...'
                  : decisionMode === 'APPROVE'
                  ? 'Confirm & Update Official Profile'
                  : decisionMode === 'REJECT'
                  ? 'Confirm Rejection'
                  : 'Send Correction Request'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  if (selectedDetail) {
    const sub = selectedDetail.submission;
    const oldData = sub.previous_snapshot ?? selectedDetail.officialDossier;
    const newData = sub.draft_payload;
    const isPending = sub.status === 'WAITING_FOR_APPROVAL';

    const socialEntries: [string, string | null | undefined][] = newData
      ? [
          ['LinkedIn', newData.socialLinks.linkedin_url],
          ['GitHub', newData.socialLinks.github_url],
          ['Portfolio', newData.socialLinks.portfolio_url],
          ['Personal Website', newData.socialLinks.personal_website_url],
          ['LeetCode', newData.socialLinks.leetcode_url],
          ['HackerRank', newData.socialLinks.hackerrank_url],
          ['CodeChef', newData.socialLinks.codechef_url],
          ['GeeksforGeeks', newData.socialLinks.geeksforgeeks_url],
        ]
      : [];

    return (
      <div className="space-y-6">
        {/* Back + Submission Header */}
        <div className={`${cardCls} p-5 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101827]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Queue</span>
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#101A35] dark:text-white">
                    {sub.student_name} ({sub.roll_number})
                  </h2>
                  <ProfileApprovalBadge status={sub.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Submission ID: <span className="font-mono font-semibold">{sub.submission_code}</span> · Branch:{' '}
                  <span className="font-semibold">{sub.branch}</span> · Section {sub.section || 'A'} · Submitted:{' '}
                  <span className="font-mono">{sub.submitted_at ? String(sub.submitted_at).slice(0, 16) : '—'}</span>
                </p>
              </div>
            </div>

            {isPending && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDecisionMode('APPROVE');
                    setDecisionRemarks('Verified and approved for official GCET student profile.');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>APPROVE PROFILE</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionMode('REQUEST_CORRECTION');
                    setDecisionRemarks('');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>REQUEST CORRECTIONS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionMode('REJECT');
                    setDecisionRemarks('');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>REJECT PROFILE</span>
                </button>
              </div>
            )}
          </div>

          <ProfileProgressTimeline status={sub.status} />

          {sub.faculty_remarks && (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] text-xs">
              <span className="font-semibold text-[#101A35] dark:text-white">Latest Faculty Remarks:</span>{' '}
              <span className="text-slate-600 dark:text-slate-300">{sub.faculty_remarks}</span>
            </div>
          )}
        </div>

        {/* Highlighted Field-by-Field Diff Comparison */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                Side-by-Side Comparison: Official vs Submitted Profile Changes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only approved changes overwrite the official student record. Modified fields are highlighted below.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">
              {sub.changed_fields.length} Changed Field(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Section</th>
                  <th className="py-2.5 px-4 font-medium">Field</th>
                  <th className="py-2.5 px-4 font-medium">Previous Official Value</th>
                  <th className="py-2.5 px-4 font-medium">Newly Submitted Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {sub.changed_fields.map((d, idx) => (
                  <tr key={`${d.field_key}-${idx}`} className="bg-amber-50/40 dark:bg-amber-950/10">
                    <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{d.section_name}</td>
                    <td className="py-3 px-4 font-semibold text-[#172033] dark:text-white whitespace-nowrap">{d.field_label}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs break-words">{d.previous_value || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-800 dark:text-emerald-300 max-w-xs break-words">{d.new_value || '—'}</td>
                  </tr>
                ))}
                {sub.changed_fields.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No field differences detected vs official snapshot (verification request).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Submitted Snapshot Cards (Academic, Skills, Projects, Social Links, Resume) */}
        {newData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Academic & Personal Comparison Summary */}
            <div className={`${cardCls} p-5 space-y-4`}>
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                Submitted Academic &amp; Personal Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827]">
                  <p className="text-slate-500 dark:text-slate-400">Full Name</p>
                  <p className="font-semibold text-[#172033] dark:text-white mt-0.5">{newData.personal.full_name}</p>
                  {oldData && oldData.personal.full_name !== newData.personal.full_name && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">Prev: {oldData.personal.full_name}</p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827]">
                  <p className="text-slate-500 dark:text-slate-400">Branch · Sem · Sec</p>
                  <p className="font-semibold text-[#172033] dark:text-white mt-0.5">
                    {newData.academic.branch} · Sem {newData.academic.semester} · Sec {newData.academic.section}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827]">
                  <p className="text-slate-500 dark:text-slate-400">CGPA / Percentage</p>
                  <p className="font-mono font-bold text-[#172033] dark:text-white mt-0.5">
                    {Number(newData.academic.cgpa).toFixed(2)} ({newData.academic.percentage}%)
                  </p>
                  {oldData && Number(oldData.academic.cgpa) !== Number(newData.academic.cgpa) && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      Prev CGPA: {Number(oldData.academic.cgpa).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827]">
                  <p className="text-slate-500 dark:text-slate-400">Backlogs (Active / History)</p>
                  <p className="font-mono font-bold text-[#172033] dark:text-white mt-0.5">
                    {newData.academic.active_backlogs} / {newData.academic.history_of_backlogs}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827]">
                  <p className="text-slate-500 dark:text-slate-400">10th / Inter-Diploma Marks</p>
                  <p className="font-medium text-[#172033] dark:text-white mt-0.5">
                    {newData.academic.tenth_marks || '—'} · {newData.academic.inter_diploma_marks || '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827]">
                  <p className="text-slate-500 dark:text-slate-400">Mobile &amp; Location</p>
                  <p className="font-medium text-[#172033] dark:text-white mt-0.5 truncate">
                    {newData.personal.phone} · {newData.personal.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Uploaded Resume PDF & Professional Social Links */}
            <div className={`${cardCls} p-5 space-y-4`}>
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                Submitted Resume &amp; Professional Social Links
              </h3>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-[#246BFD] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172033] dark:text-white truncate">
                      {newData.resume ? newData.resume.file_name : 'No PDF Resume Uploaded'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {newData.resume
                        ? `${Math.round(newData.resume.file_size / 1024)} KB · Uploaded ${String(newData.resume.uploaded_at).slice(0, 10)}`
                        : 'Student has not attached a resume PDF'}
                    </p>
                  </div>
                </div>
                {newData.resume?.file_data_url && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenResume(newData.resume)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#246BFD] text-white hover:bg-blue-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <a
                      href={newData.resume.file_data_url}
                      download={newData.resume.file_name}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 text-[#172033] dark:text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {socialEntries.map(([label, url]) => (
                  <div
                    key={label}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#246BFD] dark:text-[#20C5E8] font-medium hover:underline truncate max-w-[160px]"
                      >
                        <span className="truncate">Open Link</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Skills & Projects */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                Submitted Technical Skills ({newData.skills.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
                {newData.skills.map((sk, idx) => (
                  <div
                    key={`${sk.skill_name}-${idx}`}
                    className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-[#172033] dark:text-white">{sk.skill_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {sk.category} · {sk.experience_duration || '—'}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">
                      {sk.proficiency_level}/5 ({sk.proficiency_label})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects, Certifications, Internships & Achievements Count */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">
                Submitted Projects ({newData.projects.length}), Certifications ({newData.certifications.length}), Internships ({newData.internships.length}), Achievements ({newData.achievements.length})
              </h3>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 text-xs">
                {newData.projects.map((p, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#101827]">
                    <p className="font-semibold text-[#172033] dark:text-white">{p.title}</p>
                    <p className="text-[11px] text-[#246BFD] dark:text-[#20C5E8]">{p.tech_stack}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{p.description}</p>
                  </div>
                ))}
                {newData.internships.map((i, idx) => (
                  <div key={`int-${idx}`} className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#101827]">
                    <p className="font-semibold text-[#172033] dark:text-white">
                      Internship: {i.company_name} — {i.role}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {i.duration} ({i.start_date} to {i.end_date}) · {i.technologies_used}
                    </p>
                  </div>
                ))}
                {newData.certifications.map((c, idx) => (
                  <div key={`cert-${idx}`} className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#101827]">
                    <p className="font-semibold text-[#172033] dark:text-white">Cert: {c.cert_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.issuing_org} · {c.issue_date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Approval Audit History */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/70">
            <h3 className="text-sm font-semibold text-[#101A35] dark:text-white">Student Profile Approval History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Submission ID</th>
                  <th className="py-2.5 px-4 font-medium">Action</th>
                  <th className="py-2.5 px-4 font-medium">Reviewer / Actor</th>
                  <th className="py-2.5 px-4 font-medium">Remarks</th>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {selectedDetail.approvalHistory.map((h) => (
                  <tr key={h.history_id}>
                    <td className="py-2.5 px-4 font-mono">{h.submission_code || '—'}</td>
                    <td className="py-2.5 px-4 font-semibold">{h.action.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-4">{h.faculty_name}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{h.remarks || '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{String(h.action_at).slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Decision Confirmation Modal */}
        <Modal
          open={Boolean(decisionMode)}
          title={
            decisionMode === 'APPROVE'
              ? `Approve Profile Revision — ${sub.submission_code}`
              : decisionMode === 'REJECT'
              ? `Reject Profile Revision — ${sub.submission_code}`
              : `Request Corrections — ${sub.submission_code}`
          }
          onClose={() => setDecisionMode(null)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleDecisionSubmit} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {decisionMode === 'APPROVE'
                ? `Approving will immediately update ${sub.student_name}'s Official Student Profile with all ${sub.changed_fields.length} submitted change(s) and notify the student.`
                : decisionMode === 'REJECT'
                ? `Rejecting will keep ${sub.student_name}'s Official Student Profile unchanged and notify the student with your reason.`
                : `Requesting corrections will keep the Official Student Profile unchanged and return the submission to ${sub.student_name} for updates.`}
            </p>
            <div>
              <label className={labelCls}>
                {decisionMode === 'APPROVE'
                  ? 'Verification Remarks (Optional)'
                  : decisionMode === 'REJECT'
                  ? 'Rejection Reason (Mandatory)'
                  : 'Correction Instructions for Student (Mandatory)'}
              </label>
              <textarea
                required={decisionMode !== 'APPROVE'}
                rows={3}
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder={
                  decisionMode === 'APPROVE'
                    ? 'Verified academic & portfolio updates.'
                    : decisionMode === 'REJECT'
                    ? 'State clearly why this profile revision cannot be approved...'
                    : 'Specify exact fields/documents that need correction...'
                }
                className={inputCls}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionMode(null)}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDecision}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-60 ${
                  decisionMode === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionMode === 'REJECT'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {submittingDecision
                  ? 'Processing...'
                  : decisionMode === 'APPROVE'
                  ? 'Confirm & Update Official Profile'
                  : decisionMode === 'REJECT'
                  ? 'Confirm Rejection'
                  : 'Send Correction Request'}
              </button>
            </div>
          </form>
        </Modal>

        {/* PDF Preview Modal */}
        <Modal
          open={Boolean(resumePreviewUrl)}
          title={`Resume Preview — ${resumePreviewName}`}
          onClose={() => setResumePreviewUrl(null)}
          maxWidth="max-w-4xl"
        >
          {resumePreviewUrl && (
            <div className="space-y-3">
              <iframe src={resumePreviewUrl} title={resumePreviewName} className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-700" />
              <div className="flex justify-end">
                <a
                  href={resumePreviewUrl}
                  download={resumePreviewName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#246BFD]/10 text-[#246BFD] dark:text-[#20C5E8] flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#101A35] dark:text-white">
              {queueType === 'faculty' ? 'FACULTY PROFILE APPROVALS' : 'STUDENT PROFILE APPROVALS'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {queueType === 'faculty'
                ? 'Review and verify profile updates submitted by GCET Faculty Coordinators and Faculty members.'
                : isFacultyRole(user.role)
                ? `Review profile changes submitted by students assigned to ${(user.assignedBranches || []).join(', ') || user.assignedBranch || 'your department'} (${user.designation || 'Faculty Coordinator'}).`
                : 'Institutional oversight of student profile verification submissions across GCET branches.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {canReviewFaculty && (
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-[#101827]">
              <button
                type="button"
                onClick={() => setQueueType('students')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  queueType === 'students'
                    ? 'bg-white dark:bg-[#18243A] text-[#101A35] dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-[#172033] dark:hover:text-white'
                }`}
              >
                Student Profiles ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setQueueType('faculty')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  queueType === 'faculty'
                    ? 'bg-white dark:bg-[#18243A] text-[#101A35] dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-[#172033] dark:hover:text-white'
                }`}
              >
                Faculty Profiles ({facultyPendingCount})
              </button>
            </div>
          )}
          <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70">
            <span className="text-amber-800 dark:text-amber-300 font-semibold font-mono">
              {queueType === 'faculty' ? facultyPendingCount : pendingCount}
            </span>{' '}
            <span className="text-amber-700 dark:text-amber-400">Waiting for Approval</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              queueType === 'faculty'
                ? 'Search by Faculty Name, Employee ID, Designation, or Submission ID...'
                : 'Search by Student Name, Roll No, Branch, or Submission ID...'
            }
            className={`${inputCls} pl-8 text-xs`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ['ALL', 'All Submissions'],
            ['WAITING_FOR_APPROVAL', 'Waiting for Approval'],
            ['CORRECTION_REQUESTED', 'Corrections Requested'],
            ['APPROVED', 'Approved'],
            ['REJECTED', 'Rejected'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === key
                  ? 'bg-[#246BFD] text-white'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#101827]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Submissions Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          {queueType === 'faculty' && canReviewFaculty ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                <tr>
                  <th className="py-3 px-4 font-medium">Faculty Name</th>
                  <th className="py-3 px-4 font-medium">Employee ID</th>
                  <th className="py-3 px-4 font-medium">Designation &amp; Dept</th>
                  <th className="py-3 px-4 font-medium">Submission ID</th>
                  <th className="py-3 px-4 font-medium">Submitted Date</th>
                  <th className="py-3 px-4 font-medium">Changes</th>
                  <th className="py-3 px-4 font-medium">Approval Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {facultyLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Loading faculty profile submissions...
                    </td>
                  </tr>
                ) : filteredFacultyRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No faculty profile submissions found matching this filter.
                    </td>
                  </tr>
                ) : (
                  filteredFacultyRows.map((r) => (
                    <tr key={r.submission_id} className="hover:bg-slate-50/70 dark:hover:bg-[#101827]/50">
                      <td className="py-3 px-4 font-semibold text-[#172033] dark:text-white">{r.faculty_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{r.employee_id || '—'}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {r.designation || 'Faculty'}{r.department_name ? ` · ${r.department_name}` : ''}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">
                        {r.submission_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {r.submitted_at ? String(r.submitted_at).slice(0, 16) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono">{r.changedCount} field(s)</td>
                      <td className="py-3 px-4">
                        <ProfileApprovalBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={detailLoading}
                          onClick={() => openFacultyInspector(r.submission_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                <tr>
                  <th className="py-3 px-4 font-medium">Student Name</th>
                  <th className="py-3 px-4 font-medium">Roll Number</th>
                  <th className="py-3 px-4 font-medium">Branch &amp; Sec</th>
                  <th className="py-3 px-4 font-medium">Submission ID</th>
                  <th className="py-3 px-4 font-medium">Submitted Date</th>
                  <th className="py-3 px-4 font-medium">Changes</th>
                  <th className="py-3 px-4 font-medium">Approval Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Loading profile submissions...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No student profile submissions found matching this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.submission_id} className="hover:bg-slate-50/70 dark:hover:bg-[#101827]/50">
                      <td className="py-3 px-4 font-semibold text-[#172033] dark:text-white">{r.student_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{r.roll_number}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {r.branch} · Sec {r.section}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">
                        {r.submission_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {r.submitted_at ? String(r.submitted_at).slice(0, 16) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono">{r.changedCount} field(s)</td>
                      <td className="py-3 px-4">
                        <ProfileApprovalBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={detailLoading}
                          onClick={() => openInspector(r.submission_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
