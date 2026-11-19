import React, { useEffect, useState } from 'react';
import { Plus, Pencil, GitBranch } from 'lucide-react';
import { apiRequest } from '../api';
import { AuthUser, Branch, Department, isPlacementAdminRole } from '../types';
import { cardCls, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

export function BranchesView({ user }: { user: AuthUser }) {
  const canManage = isPlacementAdminRole(user.role) && user.role !== 'VICE_CHAIRMAN';
  const { showToast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [degreeFilter, setDegreeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deptId, setDeptId] = useState('1');
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [degreeLevel, setDegreeLevel] = useState<'B.Tech' | 'M.Tech' | 'MBA'>('B.Tech');
  const [isActive, setIsActive] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiRequest<Branch[]>('/api/branches'),
      apiRequest<Department[]>('/api/departments'),
    ])
      .then(([bList, dList]) => {
        setBranches(bList);
        setDepartments(dList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setDeptId(departments[0] ? String(departments[0].dept_id) : '1');
    setBranchCode('');
    setBranchName('');
    setDegreeLevel('B.Tech');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setDeptId(String(b.dept_id));
    setBranchCode(b.branch_code);
    setBranchName(b.branch_name);
    setDegreeLevel(b.degree_level);
    setIsActive(Boolean(b.is_active));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        deptId: Number(deptId),
        branchCode,
        branchName,
        degreeLevel,
        isActive,
      };
      if (editing) {
        await apiRequest(`/api/branches/${editing.branch_id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast(`Branch ${branchCode} updated.`);
      } else {
        await apiRequest('/api/branches', { method: 'POST', body: JSON.stringify(payload) });
        showToast(`Branch ${branchCode} added.`);
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save branch', 'error');
    }
  };

  const filtered = degreeFilter === 'ALL' ? branches : branches.filter((b) => b.degree_level === degreeFilter);

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-semibold text-[#172033] dark:text-white">College-Wide Branch &amp; Specialization Management</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            All {branches.length} GCET engineering, MBA, and M.Tech programs tracked distinctly without merging specializations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 rounded-lg">
            {['ALL', 'B.Tech', 'M.Tech', 'MBA'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setDegreeFilter(lvl)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  degreeFilter === lvl
                    ? 'bg-white dark:bg-[#18243A] text-[#172033] dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {lvl === 'ALL' ? 'All Programs' : lvl}
              </button>
            ))}
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Branch</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} p-8 text-center text-xs text-slate-500`}>Loading GCET branches...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => {
            const count = b.studentCount ?? 0;
            const placed = b.placedCount ?? 0;
            const rate = count > 0 ? ((placed / count) * 100).toFixed(1) : '0.0';
            return (
              <div key={b.branch_id} className={`${cardCls} p-5 flex flex-col justify-between space-y-4`}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <GitBranch className="w-4 h-4 text-[#246BFD] dark:text-[#20C5E8] shrink-0" />
                      <div>
                        <p className="text-sm font-bold font-mono text-[#172033] dark:text-white">{b.branch_code}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {b.degree_level} · Dept: {b.dept_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusText status={b.is_active ? 'Active' : 'Inactive'} />
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          title="Edit branch"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-3">{b.branch_name}</p>
                  {b.hod_name && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">HOD: {b.hod_name}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/70 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Students</p>
                    <p className="font-mono font-semibold text-[#172033] dark:text-white tabular-nums">{count}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Placed</p>
                    <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{placed}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Rate</p>
                    <p className="font-mono font-semibold text-[#172033] dark:text-white tabular-nums">{rate}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? `Edit Branch — ${editing.branch_code}` : 'Add GCET Branch'} onClose={() => setModalOpen(false)} maxWidth="max-w-md">
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className={labelCls}>Parent Department</label>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls}>
              {departments.map((d) => (
                <option key={d.dept_id} value={d.dept_id}>
                  {d.dept_code} — {d.dept_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Branch Code</label>
              <input required value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="e.g. CSE-AIML" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Degree Level</label>
              <select value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value as Branch['degree_level'])} className={inputCls}>
                <option value="B.Tech">B.Tech</option>
                <option value="M.Tech">M.Tech</option>
                <option value="MBA">MBA</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Full Branch Name</label>
            <input required value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Computer Science & Engineering (...)" className={inputCls} />
          </div>
          {editing && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
              <span>Branch Active</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white">Save Branch</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
