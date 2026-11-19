import React, { useEffect, useState } from 'react';
import { Eye, KeyRound, LockOpen, Plus, Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { apiRequest } from '../api';
import { FacultyCoordinatorSummary, formatRoleLabel, isFacultyRole, ManagedUser, UserRole } from '../types';
import { cardCls, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

export function UserManagementView({
  currentUserId,
  currentUserRole = 'ADMIN',
}: {
  currentUserId: number;
  currentUserRole?: UserRole;
}) {
  const canManageInfra = currentUserRole === 'ADMIN';
  const canToggleStatus = currentUserRole === 'ADMIN' || currentUserRole === 'CHAIRMAN';
  const { showToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [facultyCoordinators, setFacultyCoordinators] = useState<FacultyCoordinatorSummary[]>([]);
  const [detailFaculty, setDetailFaculty] = useState<FacultyCoordinatorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<UserRole>('PLACEMENT_OFFICER');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<{ user_id: number; full_name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, fList] = await Promise.all([
        apiRequest<ManagedUser[]>('/api/admin/users'),
        apiRequest<FacultyCoordinatorSummary[]>('/api/admin/faculty').catch(() => []),
      ]);
      setUsers(uList);
      setFacultyCoordinators(fList);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to load user accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (temporaryPassword.length < 8 || !/[A-Za-z]/.test(temporaryPassword) || !/\d/.test(temporaryPassword)) {
      showToast('Temporary password must be at least 8 characters with letters and numbers.', 'error');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim() || undefined,
          email: email.trim(),
          employeeId: employeeId.trim() || undefined,
          role,
          temporaryPassword,
        }),
      });
      showToast(`Created ${formatRoleLabel(role)} account for ${fullName.trim()}.`);
      setCreateOpen(false);
      setFullName('');
      setUsername('');
      setEmail('');
      setEmployeeId('');
      setTemporaryPassword('');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create account.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userId: number, displayName: string, currentActive: number) => {
    const nextActive = !Boolean(currentActive);
    try {
      await apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextActive }),
      });
      showToast(`${displayName} account ${nextActive ? 'activated' : 'deactivated'}.`);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  };

  const handleUnlock = async (u: ManagedUser) => {
    try {
      await apiRequest(`/api/admin/users/${u.user_id}/unlock`, { method: 'POST' });
      showToast(`Lockout cleared for ${u.full_name}.`);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to unlock account.', 'error');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 8 || !/[A-Za-z]/.test(resetPassword) || !/\d/.test(resetPassword)) {
      showToast('Temporary password must be at least 8 characters with letters and numbers.', 'error');
      return;
    }
    setResetting(true);
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/users/${resetTarget.user_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      showToast(res.message);
      setResetTarget(null);
      setResetPassword('');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reset password.', 'error');
    } finally {
      setResetting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'FACULTY') {
      if (!isFacultyRole(u.role)) return false;
    } else if (roleFilter !== 'ALL' && u.role !== roleFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employee_id || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q)
    );
  });

  const executiveCount = users.filter((u) => ['CHAIRMAN', 'VICE_CHAIRMAN', 'PRINCIPAL', 'ADMIN'].includes(u.role)).length;
  const facultyCount = facultyCoordinators.length;
  const lockedCount = users.filter((u) => u.is_locked).length;

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#246BFD]" />
            <h2 className="text-base font-semibold text-[#101A35] dark:text-white">
              Institutional User &amp; Faculty Coordinator Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Standardized 3-Coordinator department access control, staff account provisioning, password resets, and security lock management
          </p>
        </div>

        {canManageInfra ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Placement Staff / Admin</span>
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
            {canToggleStatus ? 'Chairman Status Governance' : 'Executive Read-Only Directory'}
          </span>
        )}
      </div>

      {/* Official Faculty Coordinators Directory (Strictly 3 Official Coordinators) */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#101A35] dark:text-white">
              Official GCET Faculty Coordinators ({facultyCoordinators.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Department-wise profile approval and student mentorship coordinators. Previous obsolete faculty accounts have been permanently retired.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {facultyCoordinators.map((fc) => (
            <div
              key={fc.user_id}
              className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#101827] p-4 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#101A35] dark:text-white">{fc.full_name}</p>
                    <p className="text-xs font-semibold text-[#246BFD] dark:text-[#20C5E8]">
                      {fc.designation || 'Faculty Coordinator'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {fc.department_name} · <span className="font-mono">@{fc.username}</span>
                    </p>
                  </div>
                  <StatusText status={fc.is_active ? 'Active' : 'Inactive'} />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Assigned Branches
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {fc.assigned_branches.map((br) => (
                      <span
                        key={br}
                        className="px-2 py-0.5 rounded bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-semibold text-[#101A35] dark:text-slate-200"
                      >
                        {br}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/70 text-xs">
                  <div>
                    <p className="text-[11px] text-slate-500">Students</p>
                    <p className="font-mono font-bold text-[#101A35] dark:text-white">{fc.assignedStudentCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Pending</p>
                    <p className="font-mono font-bold text-amber-600 dark:text-amber-400">{fc.pendingApprovalsCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Approved</p>
                    <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{fc.approvedProfilesCount}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/70">
                <button
                  type="button"
                  onClick={() => setDetailFaculty(fc)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-[#246BFD] text-white hover:bg-blue-700"
                >
                  <Eye className="w-3 h-3" />
                  <span>View Details</span>
                </button>
                {canManageInfra && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetTarget({ user_id: fc.user_id, full_name: fc.full_name });
                      setResetPassword('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#18243A]"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Reset Password</span>
                  </button>
                )}
                {canToggleStatus && (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(fc.user_id, fc.full_name, fc.is_active)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md border ${
                      fc.is_active
                        ? 'border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300'
                        : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {fc.is_active ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                    <span>{fc.is_active ? 'Deactivate' : 'Activate'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Executive &amp; System Admins</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#101A35] dark:text-white mt-1">{executiveCount}</p>
        </div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Official Faculty Coordinators</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#246BFD] mt-1">{facultyCount}</p>
        </div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Portal Accounts</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#101A35] dark:text-white mt-1">{users.length}</p>
        </div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">Temporarily Locked</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">{lockedCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, username, employee ID, email, or company..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] text-[#172033] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#246BFD]/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ALL', label: 'All Roles' },
            { id: 'PRINCIPAL', label: 'Principal' },
            { id: 'VICE_CHAIRMAN', label: 'Vice Chairman' },
            { id: 'CHAIRMAN', label: 'Chairman' },
            { id: 'ADMIN', label: 'Sys Admin' },
            { id: 'FACULTY', label: 'Faculty Coordinators' },
            { id: 'RECRUITER', label: 'Recruiters' },
            { id: 'STUDENT', label: 'Students' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                roleFilter === tab.id
                  ? 'bg-[#246BFD] text-white'
                  : 'bg-slate-100 dark:bg-[#101827] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 font-medium">Name &amp; Credentials</th>
                <th className="py-3 px-4 font-medium">Role &amp; Department Scope</th>
                <th className="py-3 px-4 font-medium">Account Status</th>
                <th className="py-3 px-4 font-medium">Last Sign-In</th>
                <th className="py-3 px-4 font-medium text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">Loading directory...</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#172033] dark:text-white">{u.full_name}</p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        @{u.username} · {u.email}
                        {u.employee_id ? ` · ${u.employee_id}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#172033] dark:text-slate-200">
                        {u.designation || formatRoleLabel(u.role)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {u.assigned_branches && u.assigned_branches.length > 0
                          ? `Branches: ${u.assigned_branches.join(', ')}`
                          : u.assigned_branch
                          ? `Branch: ${u.assigned_branch}`
                          : u.company_name
                          ? u.company_name
                          : 'Institution-Wide'}
                      </p>
                    </td>
                    <td className="py-3 px-4 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusText status={u.is_active ? u.approval_status : 'Inactive'} />
                        {u.is_locked && (
                          <span className="text-[11px] font-medium text-red-600 dark:text-red-400">· Locked</span>
                        )}
                      </div>
                      {Boolean(u.must_change_password) && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          {u.password_change_dismissed
                            ? 'Temporary password active (prompt dismissed)'
                            : 'Password update required'}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                      {u.last_login ? String(u.last_login).slice(0, 16) : 'Not yet signed in'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageInfra && u.is_locked && (
                          <button
                            type="button"
                            onClick={() => handleUnlock(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          >
                            <LockOpen className="w-3 h-3" />
                            <span>Unlock</span>
                          </button>
                        )}
                        {canManageInfra && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetTarget({ user_id: u.user_id, full_name: u.full_name });
                              setResetPassword('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Reset Password</span>
                          </button>
                        )}
                        {canToggleStatus && (
                          <button
                            type="button"
                            disabled={u.user_id === currentUserId}
                            onClick={() => handleToggleStatus(u.user_id, u.full_name, u.is_active)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors disabled:opacity-40 ${
                              u.is_active
                                ? 'border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30'
                                : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            {u.is_active ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            <span>{u.is_active ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        )}
                        {!canManageInfra && !canToggleStatus && (
                          <span className="text-[11px] text-slate-400">Read-Only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No matching user accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faculty Coordinator Details Modal */}
      <Modal
        open={Boolean(detailFaculty)}
        title={detailFaculty ? `Coordinator Profile — ${detailFaculty.full_name}` : ''}
        onClose={() => setDetailFaculty(null)}
        maxWidth="max-w-3xl"
      >
        {detailFaculty && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70">
              <div>
                <p className="text-slate-500">Designation &amp; Department</p>
                <p className="font-semibold text-[#101A35] dark:text-white mt-0.5">
                  {detailFaculty.designation} · {detailFaculty.department_name}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Username &amp; Employee ID</p>
                <p className="font-mono font-semibold text-[#101A35] dark:text-white mt-0.5">
                  @{detailFaculty.username} · {detailFaculty.employee_id || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Assigned Branches</p>
                <p className="font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8] mt-0.5">
                  {detailFaculty.assigned_branches.join(', ')}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Approval Statistics</p>
                <p className="font-mono font-semibold text-[#101A35] dark:text-white mt-0.5">
                  {detailFaculty.assignedStudentCount} Students · {detailFaculty.pendingApprovalsCount} Pending ·{' '}
                  {detailFaculty.approvedProfilesCount} Approved · {detailFaculty.rejectedProfilesCount} Rejected ·{' '}
                  {detailFaculty.correctionRequestedCount} Corrections
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-[#101A35] dark:text-white mb-2">Recent Profile Approval Decisions</h4>
              {detailFaculty.recentApprovals.length === 0 ? (
                <p className="text-slate-500">No approval decisions logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700/70 rounded-lg">
                  {detailFaculty.recentApprovals.map((ra) => (
                    <div key={ra.history_id} className="p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#172033] dark:text-white">
                          {ra.student_name} ({ra.roll_number}, {ra.branch}) — {ra.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[11px] text-slate-500">{ra.remarks || 'No remarks'}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {String(ra.action_at).slice(0, 16)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-[#101A35] dark:text-white mb-2">Coordinator Activity Logs</h4>
              {detailFaculty.activityLogs.length === 0 ? (
                <p className="text-slate-500">No coordinator activity logs recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700/70 rounded-lg">
                  {detailFaculty.activityLogs.map((al) => (
                    <div key={al.log_id} className="p-2.5 flex items-center justify-between gap-2">
                      <p className="text-[#172033] dark:text-slate-200">{al.description}</p>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {String(al.created_at).slice(0, 16)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Placement Staff / Admin Modal (Faculty Coordinators are strictly 3 standardized officials) */}
      <Modal
        open={createOpen}
        title="Create Placement Staff / System Admin Account"
        onClose={() => setCreateOpen(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            New accounts are provisioned with BCrypt hashing and flagged for a mandatory password update on first sign-in. Faculty Coordinators are strictly locked to the 3 official GCET department coordinators.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Placement Officer Name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Employee ID (optional)</label>
              <input
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="TPO-GCET-002"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Institutional Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff.name@gcet.edu.in"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Username (optional)</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Defaults to email prefix"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Portal Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
              <option value="PLACEMENT_OFFICER">Placement Officer</option>
              <option value="ADMIN">System Administrator</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Temporary Password (min 8 characters, letters &amp; numbers)</label>
            <input
              type="password"
              required
              minLength={8}
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Assign a secure temporary password"
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Provisioning...' : 'Provision Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Temporary Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        title={`Reset Password — ${resetTarget?.full_name || ''}`}
        onClose={() => setResetTarget(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Issuing a temporary password resets any active login lockouts and prompts the user to choose a new password on their next sign-in.
          </p>
          <div>
            <label className={labelCls}>New Temporary Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Minimum 8 chars (letters & numbers)"
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {resetting ? 'Updating...' : 'Set Temporary Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
