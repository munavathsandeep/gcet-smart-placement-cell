import React, { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Bookmark,
  BookmarkCheck,
  MapPin,
  ExternalLink,
  Eye,
  Briefcase,
} from 'lucide-react';
import { apiRequest } from '../api';
import { AuthUser, Branch, Company, isPlacementAdminRole, PlacementDrive, Skill } from '../types';
import { cardCls, ConfirmDialog, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

const JOB_TYPES: PlacementDrive['job_type'][] = [
  'On-Campus Drive',
  'Full-Time',
  'Internship',
  'Internship + Full-Time',
  'Off-Campus',
];

export function DrivesView({ user }: { user: AuthUser }) {
  const isPlacementStaff = isPlacementAdminRole(user.role) && user.role !== 'VICE_CHAIRMAN';
  const isApprovedRecruiter = user.role === 'RECRUITER' && user.approvalStatus === 'Approved';
  const canManage = isPlacementStaff || isApprovedRecruiter;
  const { showToast } = useToast();

  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [branchesList, setBranchesList] = useState<Branch[]>([]);
  const [savedDriveIds, setSavedDriveIds] = useState<Set<number>>(new Set());

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [savedOnly, setSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const [detailsDrive, setDetailsDrive] = useState<PlacementDrive | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlacementDrive | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLocation, setJobLocation] = useState('Hyderabad');
  const [jobType, setJobType] = useState<PlacementDrive['job_type']>('On-Campus Drive');
  const [salaryPackage, setSalaryPackage] = useState('7.00');
  const [compensationLabel, setCompensationLabel] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [driveDate, setDriveDate] = useState('2026-12-15');
  const [deadline, setDeadline] = useState('2026-12-08');
  const [driveStatus, setDriveStatus] = useState<PlacementDrive['drive_status']>('Active');
  const [minCgpa, setMinCgpa] = useState('7.00');
  const [eligibleBranches, setEligibleBranches] = useState('CSE,CSE-AIML,CSE-DS,CSE-CS,IT,ECE');
  const [gradYear, setGradYear] = useState('2027');
  const [maxBacklogs, setMaxBacklogs] = useState('0');
  const [otherCriteria, setOtherCriteria] = useState('');
  const [reqSkillLevels, setReqSkillLevels] = useState<Record<number, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlacementDrive | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      apiRequest<PlacementDrive[]>('/api/drives'),
      apiRequest<Company[]>('/api/companies'),
      apiRequest<Skill[]>('/api/skills'),
      apiRequest<Branch[]>('/api/branches'),
      apiRequest<PlacementDrive[]>('/api/saved-jobs').catch(() => [] as PlacementDrive[]),
    ])
      .then(([dList, cList, sList, bList, savedList]) => {
        setDrives(dList);
        setCompanies(cList);
        setSkills(sList);
        setBranchesList(bList);
        setSavedDriveIds(new Set(savedList.map((s) => s.drive_id)));
        if (cList.length > 0 && !companyId) setCompanyId(String(cList[0].company_id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openAdd = () => {
    setEditing(null);
    if (user.role === 'RECRUITER' && user.companyId) {
      setCompanyId(String(user.companyId));
    } else if (companies.length > 0) {
      setCompanyId(String(companies[0].company_id));
    }
    setJobRole('');
    setJobDescription('');
    setJobLocation('Hyderabad');
    setJobType('On-Campus Drive');
    setSalaryPackage('7.50');
    setCompensationLabel('7.50 LPA');
    setApplyUrl('');
    setDriveDate('2026-12-18');
    setDeadline('2026-12-10');
    setDriveStatus(user.role === 'RECRUITER' ? 'Planned' : 'Active');
    setMinCgpa('7.00');
    setEligibleBranches('CSE,CSE-AIML,CSE-DS,CSE-CS,IT,ECE');
    setGradYear('2027');
    setMaxBacklogs('0');
    setOtherCriteria('');
    setReqSkillLevels({ 1: 4, 9: 3 });
    setModalOpen(true);
  };

  const openEdit = (d: PlacementDrive) => {
    setEditing(d);
    setCompanyId(String(d.company_id));
    setJobRole(d.job_role);
    setJobDescription(d.job_description);
    setJobLocation(d.job_location || 'Hyderabad');
    setJobType(d.job_type || 'On-Campus Drive');
    setSalaryPackage(String(d.salary_package));
    setCompensationLabel(d.compensation_label || `${Number(d.salary_package).toFixed(2)} LPA`);
    setApplyUrl(d.apply_url || '');
    setDriveDate(d.drive_date);
    setDeadline(d.application_deadline);
    setDriveStatus(d.drive_status);
    setMinCgpa(String(d.min_cgpa));
    setEligibleBranches(d.eligible_branches);
    setGradYear(String(d.graduation_year));
    setMaxBacklogs(String(d.max_backlogs ?? 0));
    setOtherCriteria(d.other_criteria || '');
    const map: Record<number, number> = {};
    for (const rs of d.requiredSkills) map[rs.skill_id] = rs.required_level;
    setReqSkillLevels(map);
    setModalOpen(true);
  };

  const toggleSkill = (skillId: number) => {
    setReqSkillLevels((prev) => {
      const next = { ...prev };
      if (next[skillId]) delete next[skillId];
      else next[skillId] = 3;
      return next;
    });
  };

  const toggleBranchToken = (code: string) => {
    const current = eligibleBranches
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = current.includes(code);
    const next = exists ? current.filter((b) => b !== code) : [...current, code];
    setEligibleBranches(next.join(','));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredSkills = Object.entries(reqSkillLevels).map(([sid, lvl]) => ({
      skillId: Number(sid),
      requiredLevel: lvl,
      weightage: 1.2,
    }));
    const payload = {
      companyId: Number(companyId),
      jobRole,
      jobDescription,
      jobLocation,
      jobType,
      salaryPackage: Number(salaryPackage),
      compensationLabel: compensationLabel || `${Number(salaryPackage).toFixed(2)} LPA`,
      applyUrl: applyUrl.trim() || null,
      driveDate,
      applicationDeadline: deadline,
      driveStatus,
      minCgpa: Number(minCgpa),
      eligibleBranches,
      graduationYear: Number(gradYear),
      maxBacklogs: Number(maxBacklogs) || 0,
      otherCriteria,
      requiredSkills,
    };
    try {
      if (editing) {
        await apiRequest(`/api/drives/${editing.drive_id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast(`${jobRole} opportunity updated.`);
      } else {
        await apiRequest('/api/drives', { method: 'POST', body: JSON.stringify(payload) });
        showToast(
          user.role === 'RECRUITER'
            ? `Submitted "${jobRole}" to GCET Placement Cell Approval Center.`
            : `Published ${jobRole} opportunity.`
        );
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save placement opportunity.', 'error');
    }
  };

  const handleApply = async (driveId: number) => {
    try {
      await apiRequest('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ studentId: user.studentId, driveId }),
      });
      showToast('Application submitted and eligibility verified.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Application failed.', 'error');
    }
  };

  const handleToggleSave = async (driveId: number) => {
    const isSaved = savedDriveIds.has(driveId);
    try {
      if (isSaved) {
        await apiRequest(`/api/saved-jobs/${driveId}`, { method: 'DELETE' });
        setSavedDriveIds((prev) => {
          const next = new Set(prev);
          next.delete(driveId);
          return next;
        });
        showToast('Removed from saved opportunities.', 'info');
      } else {
        await apiRequest('/api/saved-jobs', {
          method: 'POST',
          body: JSON.stringify({ driveId }),
        });
        setSavedDriveIds((prev) => new Set(prev).add(driveId));
        showToast('Opportunity saved to your bookmarks.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update bookmark.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/drives/${deleteTarget.drive_id}`, { method: 'DELETE' });
      showToast(`${deleteTarget.company_name} — ${deleteTarget.job_role} removed.`, 'info');
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
      setDeleteTarget(null);
    }
  };

  const filtered = drives.filter((d) => {
    if (typeFilter !== 'ALL' && d.job_type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && d.drive_status !== statusFilter) return false;
    if (savedOnly && !savedDriveIds.has(d.drive_id)) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header & Opportunity Filters */}
      <div className={`${cardCls} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">Placement Opportunities & Job Board</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              On-campus drives, internships, full-time roles, cutoffs, deadlines, and required skill profiles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${inputCls} w-36`}
              aria-label="Filter by drive status"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Planned">Planned</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={() => setSavedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                savedOnly
                  ? 'bg-[#246BFD] text-white border-[#246BFD]'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved ({savedDriveIds.size})</span>
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Post Opportunity</span>
              </button>
            )}
          </div>
        </div>

        {/* Job Type Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#0A1120] border border-slate-200 dark:border-[#1E2D45] rounded-lg w-fit">
          {['ALL', ...JOB_TYPES].map((jt) => (
            <button
              key={jt}
              type="button"
              onClick={() => setTypeFilter(jt)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                typeFilter === jt
                  ? 'bg-white dark:bg-[#16233B] text-[#0F2140] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {jt === 'ALL' ? 'All Opportunities' : jt}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} p-8 text-center text-xs text-slate-500`}>Loading placement opportunities...</div>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} p-10 text-center text-xs text-slate-500 dark:text-slate-400`}>
          No opportunities match the active filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((d) => {
            const isSaved = savedDriveIds.has(d.drive_id);
            return (
              <div key={d.drive_id} className={`${cardCls} p-5 flex flex-col justify-between space-y-4`}>
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                        {d.company_name} · {d.job_type}
                      </p>
                      <h3 className="text-base font-bold text-[#0F2140] dark:text-white mt-0.5">{d.job_role}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{d.job_location}</span>
                        <span>· Posted {d.posted_date}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusText status={d.approval_status === 'Pending' ? 'Pending' : d.drive_status} />
                      <button
                        type="button"
                        onClick={() => handleToggleSave(d.drive_id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isSaved
                            ? 'border-blue-300 dark:border-blue-700 text-[#246BFD] bg-blue-50 dark:bg-blue-950/30'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#246BFD]'
                        }`}
                        title={isSaved ? 'Remove Bookmark' : 'Save Opportunity'}
                      >
                        {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed line-clamp-2">
                    {d.job_description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-[#1E2D45] text-xs">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Compensation</p>
                      <p className="font-mono tabular-nums font-semibold text-[#0F2140] dark:text-white mt-0.5">
                        {d.compensation_label || `${Number(d.salary_package).toFixed(2)} LPA`}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Min CGPA</p>
                      <p className="font-mono tabular-nums font-semibold text-[#0F2140] dark:text-white mt-0.5">
                        {Number(d.min_cgpa).toFixed(2)} · Max {d.max_backlogs ?? 0} BL
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Deadline</p>
                      <p className="font-mono tabular-nums text-[#0F2140] dark:text-slate-200 mt-0.5">{d.application_deadline}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Drive Date</p>
                      <p className="font-mono tabular-nums text-[#0F2140] dark:text-slate-200 mt-0.5">{d.drive_date}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Eligible Branches:</span>{' '}
                    <span className="font-mono">{d.eligible_branches}</span> · Batch{' '}
                    <span className="font-mono">{d.graduation_year}</span>
                  </div>

                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Required Skills:</span>{' '}
                    {d.requiredSkills.length > 0
                      ? d.requiredSkills.map((rs) => `${rs.skill_name} (${rs.required_level}/5)`).join(' · ')
                      : 'Standard technical & aptitude evaluation'}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#1E2D45] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailsDrive(d)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {d.apply_url && (
                      <a
                        href={d.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#243552] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span>Career Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {user.role === 'STUDENT' && d.drive_status === 'Active' && (
                      <button
                        type="button"
                        onClick={() => handleApply(d.drive_id)}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white"
                      >
                        Apply Now
                      </button>
                    )}
                    {(isPlacementStaff || (isApprovedRecruiter && d.company_id === user.companyId)) && (
                      <>
                        <button type="button" onClick={() => openEdit(d)} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#246BFD]" title="Edit Opportunity">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {isPlacementStaff && (
                          <button type="button" onClick={() => setDeleteTarget(d)} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600" title="Delete Opportunity">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Opportunity Details Modal */}
      <Modal
        open={Boolean(detailsDrive)}
        title={detailsDrive ? `${detailsDrive.company_name} — ${detailsDrive.job_role}` : ''}
        onClose={() => setDetailsDrive(null)}
        maxWidth="max-w-xl"
      >
        {detailsDrive && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#1E2D45]">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">{detailsDrive.job_type}</span>
                <span>·</span>
                <span>{detailsDrive.job_location}</span>
              </div>
              <StatusText status={detailsDrive.drive_status} />
            </div>

            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{detailsDrive.job_description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-[#0A1120] border border-slate-200 dark:border-[#1E2D45]">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Compensation</p>
                <p className="font-mono font-semibold text-[#0F2140] dark:text-white mt-0.5">
                  {detailsDrive.compensation_label || `${Number(detailsDrive.salary_package).toFixed(2)} LPA`}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Minimum CGPA</p>
                <p className="font-mono font-semibold text-[#0F2140] dark:text-white mt-0.5">{Number(detailsDrive.min_cgpa).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Max Active Backlogs</p>
                <p className="font-mono font-semibold text-[#0F2140] dark:text-white mt-0.5">{detailsDrive.max_backlogs ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Graduation Batch</p>
                <p className="font-mono font-semibold text-[#0F2140] dark:text-white mt-0.5">{detailsDrive.graduation_year}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Apply By</p>
                <p className="font-mono font-semibold text-[#0F2140] dark:text-white mt-0.5">{detailsDrive.application_deadline}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Drive Date</p>
                <p className="font-mono font-semibold text-[#0F2140] dark:text-white mt-0.5">{detailsDrive.drive_date}</p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-[#0F2140] dark:text-white mb-1">Eligible Branches</p>
              <p className="font-mono text-slate-600 dark:text-slate-300">{detailsDrive.eligible_branches}</p>
            </div>

            <div>
              <p className="font-semibold text-[#0F2140] dark:text-white mb-1">Required Skill Benchmarks</p>
              <p className="text-slate-600 dark:text-slate-300">
                {detailsDrive.requiredSkills.length > 0
                  ? detailsDrive.requiredSkills.map((rs) => `${rs.skill_name} (Level ${rs.required_level}/5)`).join(' · ')
                  : 'No mandatory technical matrix threshold specified.'}
              </p>
            </div>

            {detailsDrive.other_criteria && (
              <div>
                <p className="font-semibold text-[#0F2140] dark:text-white mb-1">Additional Guidelines</p>
                <p className="text-slate-600 dark:text-slate-300">{detailsDrive.other_criteria}</p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-[#1E2D45] flex flex-wrap items-center justify-end gap-2">
              {detailsDrive.apply_url && (
                <a
                  href={detailsDrive.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>External Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {user.role === 'STUDENT' && detailsDrive.drive_status === 'Active' && (
                <button
                  type="button"
                  onClick={() => handleApply(detailsDrive.drive_id)}
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold"
                >
                  Apply Through Portal
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Opportunity Modal */}
      <Modal open={modalOpen} title={editing ? 'Edit Placement Opportunity' : 'Post Placement Opportunity'} onClose={() => setModalOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Company</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={user.role === 'RECRUITER'}
                className={inputCls}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Job / Role Title</label>
              <input required value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="Software Engineer" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Opportunity Type</label>
              <select value={jobType} onChange={(e) => setJobType(e.target.value as PlacementDrive['job_type'])} className={inputCls}>
                {JOB_TYPES.map((jt) => (
                  <option key={jt} value={jt}>{jt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Job Location</label>
              <input required value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} placeholder="Hyderabad / Bengaluru" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Package (Numeric LPA)</label>
              <input type="number" step="0.05" required value={salaryPackage} onChange={(e) => setSalaryPackage(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Compensation Display Label</label>
              <input value={compensationLabel} onChange={(e) => setCompensationLabel(e.target.value)} placeholder="7.50 LPA or 35,000/mo + PPO" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Application Deadline</label>
              <input type="date" required value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Drive / Assessment Date</label>
              <input type="date" required value={driveDate} onChange={(e) => setDriveDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Minimum CGPA</label>
              <input type="number" step="0.1" min="0" max="10" required value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Active Backlogs</label>
              <input type="number" min="0" max="10" required value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Graduation Year</label>
              <input type="number" required value={gradYear} onChange={(e) => setGradYear(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={driveStatus} onChange={(e) => setDriveStatus(e.target.value as PlacementDrive['drive_status'])} className={inputCls}>
                <option value="Planned">Planned</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>External Apply / Company Registration URL (Optional)</label>
            <input type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://careers.company.com/..." className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Eligible GCET Branches (Select or Edit)</label>
            <input required value={eligibleBranches} onChange={(e) => setEligibleBranches(e.target.value)} placeholder="CSE,CSE-AIML,CSE-DS,ECE" className={inputCls} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {branchesList.map((b) => {
                const selected = eligibleBranches
                  .split(',')
                  .map((s) => s.trim())
                  .includes(b.branch_code);
                return (
                  <button
                    key={b.branch_id}
                    type="button"
                    onClick={() => toggleBranchToken(b.branch_code)}
                    className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
                      selected
                        ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                        : 'bg-slate-50 dark:bg-[#0A1120] border-slate-200 dark:border-[#1E2D45] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {b.branch_code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Job Description</label>
              <textarea rows={2} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Additional Criteria / Notes</label>
              <textarea rows={2} value={otherCriteria} onChange={(e) => setOtherCriteria(e.target.value)} placeholder="60% throughout academics, no gap > 1 yr..." className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Required Skills & Target Proficiency (1–5)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 rounded-lg border border-slate-200 dark:border-[#1E2D45]">
              {skills.map((sk) => {
                const selected = Boolean(reqSkillLevels[sk.skill_id]);
                return (
                  <div key={sk.skill_id} className="flex items-center justify-between gap-2 text-xs p-1.5 rounded bg-slate-50 dark:bg-[#0A1120]">
                    <button
                      type="button"
                      onClick={() => toggleSkill(sk.skill_id)}
                      className="flex items-center gap-2 text-left font-medium text-[#0F2140] dark:text-slate-200"
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {selected && <Check className="w-3 h-3" />}
                      </span>
                      <span className="truncate">{sk.skill_name}</span>
                    </button>
                    {selected && (
                      <select
                        value={reqSkillLevels[sk.skill_id]}
                        onChange={(e) => setReqSkillLevels((p) => ({ ...p, [sk.skill_id]: Number(e.target.value) }))}
                        className="px-1.5 py-0.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E]"
                      >
                        {[1, 2, 3, 4, 5].map((l) => (
                          <option key={l} value={l}>{l}/5</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1D4ED8] text-white hover:bg-blue-800">Save Opportunity</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Placement Opportunity"
        message={`Delete ${deleteTarget?.company_name} — ${deleteTarget?.job_role}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
