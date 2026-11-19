import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  GraduationCap,
  History,
  Link as LinkIcon,
  Plus,
  Save,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api';
import {
  AuthUser,
  FacultyProfileDraftPayload,
  FacultyProfileDossier,
  FacultySkillRecord,
  Skill,
} from '../types';
import { cardCls, inputCls, labelCls, Modal, useToast } from './SharedUI';
import { ProfileApprovalBadge, ProfileProgressTimeline } from './ProfileStatusWidgets';

type FacultySectionId = 'personal' | 'academic' | 'skills' | 'links' | 'history';

const SECTION_NAV: { id: FacultySectionId; code: string; label: string; icon: typeof User }[] = [
  { id: 'personal', code: 'A', label: 'Personal & Contact', icon: User },
  { id: 'academic', code: 'B', label: 'Academic & Research', icon: GraduationCap },
  { id: 'skills', code: 'C', label: 'Faculty Skills', icon: SlidersHorizontal },
  { id: 'links', code: 'D', label: 'Academic Links', icon: LinkIcon },
  { id: 'history', code: 'E', label: 'Approval History', icon: History },
];

export function FacultyProfileView({ user }: { user: AuthUser }) {
  const { showToast } = useToast();
  const [dossier, setDossier] = useState<FacultyProfileDossier | null>(null);
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionStorageKey = `gcet_spc_faculty_section_${user.userId}`;
  const [activeSection, setActiveSection] = useState<FacultySectionId>(() => {
    try {
      const saved = sessionStorage.getItem(sectionStorageKey) as FacultySectionId | null;
      if (saved && SECTION_NAV.some((s) => s.id === saved)) return saved;
    } catch {
      // ignore storage errors
    }
    return 'personal';
  });
  const [viewScope, setViewScope] = useState<'official' | 'pending'>('official');

  // Profile Edit / Draft / Submit state
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<FacultyProfileDraftPayload | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Direct Faculty Skills CRUD state
  const [skills, setSkills] = useState<FacultySkillRecord[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Programming Languages');
  const [newSkillLevel, setNewSkillLevel] = useState<number>(4);
  const [newSkillExp, setNewSkillExp] = useState('');
  const [savingSkill, setSavingSkill] = useState(false);
  const [skillError, setSkillError] = useState('');

  const [editSkillModal, setEditSkillModal] = useState<FacultySkillRecord | null>(null);
  const [editSkillName, setEditSkillName] = useState('');
  const [editSkillCategory, setEditSkillCategory] = useState('Programming Languages');
  const [editSkillLevel, setEditSkillLevel] = useState<number>(4);
  const [editSkillExp, setEditSkillExp] = useState('');
  const [updatingSkill, setUpdatingSkill] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(sectionStorageKey, activeSection);
    } catch {
      // ignore storage errors
    }
  }, [activeSection, sectionStorageKey]);

  const loadProfile = () => {
    setLoading(true);
    apiRequest<FacultyProfileDossier>('/api/faculty/my-profile')
      .then((res) => {
        setDossier(res);
        setSkills(res.skills || []);
        setIsEditing(false);
        setEditDraft(null);
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : 'Unable to load faculty profile.', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProfile();
    apiRequest<Skill[]>('/api/skills').then(setSkillCatalog).catch(() => {});
  }, [user.userId]);

  const startEditing = () => {
    if (!dossier) return;
    const base =
      dossier.latestSubmission &&
      ['DRAFT', 'CORRECTION_REQUESTED', 'REJECTED', 'WAITING_FOR_APPROVAL'].includes(dossier.latestSubmission.status) &&
      dossier.latestSubmission.draft_payload
        ? dossier.latestSubmission.draft_payload
        : dossier.officialProfile;
    setEditDraft(JSON.parse(JSON.stringify(base)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditDraft(null);
  };

  const handleSaveDraft = async () => {
    if (!editDraft) return;
    setSavingDraft(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/faculty/my-profile/draft', {
        method: 'POST',
        body: JSON.stringify(editDraft),
      });
      showToast(res.message);
      setViewScope('pending');
      loadProfile();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save draft.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!editDraft) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/faculty/my-profile/submit', {
        method: 'POST',
        body: JSON.stringify(editDraft),
      });
      showToast(res.message);
      setViewScope('official');
      loadProfile();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit profile for approval.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = (file: File | null) => {
    if (!file || !editDraft) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid PNG, JPG, or WebP image.', 'error');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      showToast('Profile photograph must be 1.5 MB or smaller.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditDraft((prev) =>
        prev ? { ...prev, personal: { ...prev.personal, photo_data_url: String(reader.result) } } : prev
      );
    };
    reader.readAsDataURL(file);
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSkillError('');
    if (!newSkillName.trim()) {
      const msg = 'Please enter a skill name.';
      setSkillError(msg);
      showToast(msg, 'error');
      return;
    }
    setSavingSkill(true);
    try {
      const res = await apiRequest<{ skills: FacultySkillRecord[]; message: string }>('/api/faculty/skills', {
        method: 'POST',
        body: JSON.stringify({
          skillName: newSkillName.trim(),
          category: newSkillCategory,
          proficiencyLevel: newSkillLevel,
          experienceDuration: newSkillExp.trim(),
        }),
      });
      setSkills(res.skills);
      setDossier((prev) => (prev ? { ...prev, skills: res.skills } : prev));
      setNewSkillName('');
      setNewSkillExp('');
      setNewSkillLevel(4);
      showToast(res.message || 'Faculty skill saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to add skill.';
      setSkillError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingSkill(false);
    }
  };

  const handleUpdateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSkillModal || !editSkillName.trim()) return;
    setSkillError('');
    setUpdatingSkill(true);
    try {
      const res = await apiRequest<{ skills: FacultySkillRecord[]; message: string }>(
        `/api/faculty/skills/${editSkillModal.faculty_skill_id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            skillName: editSkillName.trim(),
            category: editSkillCategory,
            proficiencyLevel: editSkillLevel,
            experienceDuration: editSkillExp.trim(),
          }),
        }
      );
      setSkills(res.skills);
      setDossier((prev) => (prev ? { ...prev, skills: res.skills } : prev));
      setEditSkillModal(null);
      showToast(res.message || 'Faculty skill updated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update skill.';
      setSkillError(msg);
      showToast(msg, 'error');
    } finally {
      setUpdatingSkill(false);
    }
  };

  const handleDeleteSkill = async (sk: FacultySkillRecord) => {
    setSkillError('');
    try {
      const res = await apiRequest<{ skills: FacultySkillRecord[]; message: string }>(
        `/api/faculty/skills/${sk.faculty_skill_id}`,
        { method: 'DELETE' }
      );
      setSkills(res.skills);
      setDossier((prev) => (prev ? { ...prev, skills: res.skills } : prev));
      showToast(res.message || 'Skill removed.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to remove skill.';
      setSkillError(msg);
      showToast(msg, 'error');
    }
  };

  const displayedProfile: FacultyProfileDraftPayload | null = useMemo(() => {
    if (!dossier) return null;
    if (isEditing && editDraft) return editDraft;
    if (
      viewScope === 'pending' &&
      dossier.latestSubmission &&
      dossier.latestSubmission.status !== 'APPROVED' &&
      dossier.latestSubmission.draft_payload
    ) {
      return dossier.latestSubmission.draft_payload;
    }
    return dossier.officialProfile;
  }, [dossier, isEditing, editDraft, viewScope]);

  const hasPendingOrReviewRevision = Boolean(
    dossier?.latestSubmission && dossier.latestSubmission.status !== 'APPROVED'
  );

  if (loading || !dossier || !displayedProfile) {
    return (
      <div className={`${cardCls} p-8 text-center text-xs text-slate-500 dark:text-slate-400`}>
        Loading Faculty Profile &amp; Skills workspace...
      </div>
    );
  }

  const academicLinks: {
    key: keyof FacultyProfileDraftPayload['socialLinks'];
    label: string;
    placeholder: string;
  }[] = [
    { key: 'linkedin_url', label: 'LinkedIn Profile', placeholder: 'https://www.linkedin.com/in/username' },
    { key: 'google_scholar_url', label: 'Google Scholar Profile', placeholder: 'https://scholar.google.com/citations?user=...' },
    { key: 'orcid_url', label: 'ORCID iD URL', placeholder: 'https://orcid.org/0000-0000-0000-0000' },
    { key: 'github_url', label: 'GitHub / Research Repo', placeholder: 'https://github.com/username' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Faculty Summary Card */}
      <div className={`${cardCls} p-6 space-y-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#101A35] text-white flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
              {displayedProfile.personal.photo_data_url ? (
                <img
                  src={displayedProfile.personal.photo_data_url}
                  alt={displayedProfile.personal.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold">{dossier.identity.full_name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[#101A35] dark:text-white truncate">
                  {dossier.identity.full_name}
                </h2>
                <ProfileApprovalBadge status={dossier.currentApprovalStatus} />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                <span className="font-mono font-semibold">{dossier.identity.employee_id || dossier.identity.username}</span>
                {dossier.identity.designation ? ` · ${dossier.identity.designation}` : ''}
                {dossier.identity.department_name ? ` · ${dossier.identity.department_name}` : ''}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Assigned Branches:{' '}
                <span className="font-semibold text-[#172033] dark:text-slate-200">
                  {dossier.identity.assigned_branches.length > 0
                    ? dossier.identity.assigned_branches.join(', ')
                    : 'Not assigned yet'}
                </span>
                {' · '}
                Faculty Skills:{' '}
                <span className="font-mono font-semibold text-[#246BFD] dark:text-[#20C5E8]">{skills.length}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEditing && hasPendingOrReviewRevision && (
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-[#101827]">
                <button
                  type="button"
                  onClick={() => setViewScope('official')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewScope === 'official'
                      ? 'bg-white dark:bg-[#18243A] text-[#101A35] dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-[#172033] dark:hover:text-white'
                  }`}
                >
                  Official Profile
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('pending')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewScope === 'pending'
                      ? 'bg-white dark:bg-[#18243A] text-amber-700 dark:text-amber-300 shadow-sm'
                      : 'text-slate-500 hover:text-[#172033] dark:hover:text-white'
                  }`}
                >
                  Pending / Draft Revision
                </button>
              </div>
            )}

            {!isEditing ? (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>
                  {dossier.currentApprovalStatus === 'REJECTED' ||
                  dossier.currentApprovalStatus === 'CORRECTION_REQUESTED'
                    ? 'Edit & Resubmit Profile'
                    : 'Edit Faculty Profile'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#101827]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingDraft}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#246BFD] text-[#246BFD] dark:text-[#20C5E8] dark:border-[#20C5E8] hover:bg-[#246BFD]/10 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingDraft ? 'Saving...' : 'Save as Draft'}</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitForApproval}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit for Approval'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/70">
          <ProfileProgressTimeline
            status={isEditing ? 'DRAFT' : dossier.currentApprovalStatus}
            hasAnySubmission={Boolean(dossier.latestSubmission)}
          />
        </div>

        {isEditing && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 text-xs text-blue-900 dark:text-blue-200">
            <strong>Editing Draft Mode:</strong> Profile details stay in staging until submitted and approved by Administration / Principal. Note: Your <strong>Faculty Skills</strong> list updates live in the Skills tab so you can add, edit, or delete skills directly anytime.
          </div>
        )}

        {!isEditing && dossier.latestSubmission?.status === 'WAITING_FOR_APPROVAL' && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/80 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                WAITING FOR ADMINISTRATION APPROVAL — Official Profile Preserved
              </span>
              <span className="font-mono">{dossier.latestSubmission.submission_code}</span>
            </div>
            <p>
              Submitted on{' '}
              <span className="font-mono">
                {dossier.latestSubmission.submitted_at ? String(dossier.latestSubmission.submitted_at).slice(0, 16) : '—'}
              </span>{' '}
              ({dossier.latestSubmission.changed_fields.length} modified field(s)). Currently viewing{' '}
              <strong>{viewScope === 'official' ? 'Official Profile' : 'Pending Submitted Revision'}</strong>.
            </p>
          </div>
        )}

        {!isEditing && dossier.latestSubmission?.status === 'REJECTED' && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/80 text-xs text-red-900 dark:text-red-200 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>
                Submission {dossier.latestSubmission.submission_code} Rejected — Official Profile Remains Unchanged
              </span>
            </p>
            <p>
              <strong>Reviewer Remarks:</strong> {dossier.latestSubmission.reviewer_remarks || 'No reason provided.'}
            </p>
          </div>
        )}

        {!isEditing && dossier.latestSubmission?.status === 'CORRECTION_REQUESTED' && (
          <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700/80 text-xs text-orange-900 dark:text-orange-200 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>
                Corrections Requested on {dossier.latestSubmission.submission_code} — Official Profile Remains Unchanged
              </span>
            </p>
            <p>
              <strong>Reviewer Comments:</strong> {dossier.latestSubmission.reviewer_remarks}
            </p>
          </div>
        )}

        {!isEditing && dossier.latestSubmission?.status === 'APPROVED' && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Approved ({dossier.latestSubmission.submission_code}) by{' '}
              <strong>{dossier.lastApprovedByName || dossier.latestSubmission.reviewed_by_name || 'Administration'}</strong>. Official profile is active.
            </span>
            <span className="font-mono text-[11px]">
              {dossier.lastApprovedAt ? String(dossier.lastApprovedAt).slice(0, 16) : ''}
            </span>
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className={`${cardCls} p-2 lg:col-span-3 flex lg:flex-col gap-1 overflow-x-auto`}>
          {SECTION_NAV.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#246BFD] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#101827]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {sec.code}
                </span>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{sec.label}</span>
              </button>
            );
          })}
        </aside>

        <div className={`${cardCls} p-6 lg:col-span-9 space-y-6`}>
          {/* SECTION A: PERSONAL & CONTACT */}
          {activeSection === 'personal' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                <h3 className="text-base font-bold text-[#101A35] dark:text-white">A. Personal &amp; Contact Information</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shows only verified details entered by you. Leave optional fields blank if not yet added.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#101A35] text-white flex items-center justify-center shrink-0">
                  {displayedProfile.personal.photo_data_url ? (
                    <img src={displayedProfile.personal.photo_data_url} alt="Faculty" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs font-semibold text-[#172033] dark:text-white">Faculty Profile Photograph</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">PNG/JPG/WebP up to 1.5 MB</p>
                </div>
                {isEditing && (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#18243A] border border-slate-300 dark:border-slate-600 text-xs font-semibold text-[#246BFD] hover:bg-slate-50">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.personal.full_name}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, full_name: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Institutional Email</label>
                  <input disabled value={dossier.identity.email} className={`${inputCls} opacity-75`} />
                </div>
                <div>
                  <label className={labelCls}>Employee ID</label>
                  <input disabled value={dossier.identity.employee_id || 'Not assigned yet'} className={`${inputCls} opacity-75 font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Personal Email</label>
                  <input
                    type="email"
                    disabled={!isEditing}
                    value={displayedProfile.personal.personal_email}
                    placeholder={isEditing ? 'Enter personal email' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, personal_email: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mobile Number</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.personal.phone}
                    placeholder={isEditing ? 'Enter contact number' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, phone: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Alternate Phone</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.personal.alternate_phone}
                    placeholder={isEditing ? 'Enter alternate phone' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, alternate_phone: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Office / Cabin Room</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.personal.office_room}
                    placeholder={isEditing ? 'e.g. Block II, Room 204' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, office_room: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION B: ACADEMIC & RESEARCH */}
          {activeSection === 'academic' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                <h3 className="text-base font-bold text-[#101A35] dark:text-white">B. Academic Qualifications &amp; Research</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Institutional designation and assigned branches follow directory policy; academic and research details are user-controlled.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Designation</label>
                  <input disabled value={dossier.identity.designation || 'Not assigned'} className={`${inputCls} opacity-75`} />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <input disabled value={dossier.identity.department_name || 'Not assigned'} className={`${inputCls} opacity-75`} />
                </div>
                <div>
                  <label className={labelCls}>Assigned Branches</label>
                  <input
                    disabled
                    value={dossier.identity.assigned_branches.join(', ') || 'None'}
                    className={`${inputCls} opacity-75`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Highest Qualification</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.academic.qualification}
                    placeholder={isEditing ? 'e.g. M.Tech / Ph.D. in CSE' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, qualification: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Specialization</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.academic.specialization}
                    placeholder={isEditing ? 'e.g. Distributed Systems & Cloud' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, specialization: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="60"
                    disabled={!isEditing}
                    value={displayedProfile.academic.experience_years ?? ''}
                    placeholder={isEditing ? 'Years of experience' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) =>
                        p
                          ? {
                              ...p,
                              academic: {
                                ...p.academic,
                                experience_years: e.target.value === '' ? null : Number(e.target.value),
                              },
                            }
                          : p
                      )
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Professional Biography</label>
                  <textarea
                    rows={3}
                    disabled={!isEditing}
                    value={displayedProfile.academic.bio}
                    placeholder={isEditing ? 'Summarize your teaching, mentoring, and placement coordination experience' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, bio: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Research Interests</label>
                  <input
                    disabled={!isEditing}
                    value={displayedProfile.academic.research_interests}
                    placeholder={isEditing ? 'Areas of research and technical mentorship' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, research_interests: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Publications &amp; Patents</label>
                  <textarea
                    rows={2}
                    disabled={!isEditing}
                    value={displayedProfile.academic.publications_summary}
                    placeholder={isEditing ? 'Journals, conferences, or patents' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, publications_summary: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Certifications &amp; FDPs</label>
                  <textarea
                    rows={2}
                    disabled={!isEditing}
                    value={displayedProfile.academic.certifications_summary}
                    placeholder={isEditing ? 'Completed FDPs, NPTEL, industry certifications' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, certifications_summary: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelCls}>Awards &amp; Institutional Recognition</label>
                  <textarea
                    rows={2}
                    disabled={!isEditing}
                    value={displayedProfile.academic.achievements_summary}
                    placeholder={isEditing ? 'Academic awards, funded grants, coordinator recognitions' : 'Not added yet'}
                    onChange={(e) =>
                      setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, achievements_summary: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION C: FACULTY SKILLS (DIRECT PERSISTENT CRUD) */}
          {activeSection === 'skills' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                  C. Faculty Technical &amp; Mentorship Skills ({skills.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add, edit, or remove your skills directly. Duplicate skills are prevented and all changes persist across refreshes.
                </p>
              </div>

              <form
                onSubmit={handleAddSkill}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-3">
                  <label className={labelCls}>Skill Name</label>
                  <input
                    required
                    list="gcet-faculty-skill-catalog"
                    value={newSkillName}
                    onChange={(e) => {
                      setNewSkillName(e.target.value);
                      if (skillError) setSkillError('');
                    }}
                    placeholder="e.g. Data Structures"
                    className={inputCls}
                  />
                  <datalist id="gcet-faculty-skill-catalog">
                    {skillCatalog.map((sc) => (
                      <option key={sc.skill_id} value={sc.skill_name} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-3">
                  <label className={labelCls}>Category</label>
                  <select value={newSkillCategory} onChange={(e) => setNewSkillCategory(e.target.value)} className={inputCls}>
                    <option value="Programming Languages">Programming Languages</option>
                    <option value="Web & Full-Stack">Web &amp; Full-Stack</option>
                    <option value="Database & Backend">Database &amp; Backend</option>
                    <option value="Cloud & DevOps">Cloud &amp; DevOps</option>
                    <option value="Data Science & AI">Data Science &amp; AI</option>
                    <option value="Core CS & Research">Core CS &amp; Research</option>
                    <option value="Mentorship & Soft Skills">Mentorship &amp; Soft Skills</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Level (1–5)</label>
                  <select value={newSkillLevel} onChange={(e) => setNewSkillLevel(Number(e.target.value))} className={inputCls}>
                    <option value={1}>1 — Beginner</option>
                    <option value={2}>2 — Intermediate</option>
                    <option value={3}>3 — Intermediate+</option>
                    <option value={4}>4 — Advanced</option>
                    <option value={5}>5 — Expert</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Experience (Optional)</label>
                  <input
                    value={newSkillExp}
                    onChange={(e) => setNewSkillExp(e.target.value)}
                    placeholder="e.g. 5 Years"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingSkill}
                    className="w-full py-2 px-3 rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                    title="Save faculty skill"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>{savingSkill ? 'Saving...' : 'Add Skill'}</span>
                  </button>
                </div>
              </form>

              {skillError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                  {skillError}
                </div>
              )}

              <div className="space-y-3">
                {skills.map((sk) => (
                  <div
                    key={sk.faculty_skill_id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#172033] dark:text-white">{sk.skill_name}</p>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">· {sk.category}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Level: <span className="font-semibold text-[#246BFD] dark:text-[#20C5E8]">{sk.proficiency_label}</span> ({sk.proficiency_level}/5)
                        {sk.experience_duration ? ` · Experience: ${sk.experience_duration}` : ''}
                      </p>
                      <div className="h-1.5 w-full max-w-md rounded-full bg-slate-100 dark:bg-slate-800 mt-2 overflow-hidden">
                        <div className="h-full bg-[#246BFD] rounded-full" style={{ width: `${(sk.proficiency_level / 5) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditSkillModal(sk);
                          setEditSkillName(sk.skill_name);
                          setEditSkillCategory(sk.category);
                          setEditSkillLevel(sk.proficiency_level);
                          setEditSkillExp(sk.experience_duration || '');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-[#246BFD]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(sk)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
                {skills.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                    No skills added yet. Use the form above to add your technical and mentoring skills.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SECTION D: ACADEMIC & RESEARCH LINKS */}
          {activeSection === 'links' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                <h3 className="text-base font-bold text-[#101A35] dark:text-white">D. Professional &amp; Academic Links</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Optional external academic and engineering profile URLs
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {academicLinks.map((item) => {
                  const val = displayedProfile.socialLinks[item.key] || '';
                  return (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className={labelCls}>{item.label}</label>
                        {!isEditing && val && (
                          <a
                            href={val}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#246BFD] dark:text-[#20C5E8] hover:underline"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <input
                        disabled={!isEditing}
                        value={val}
                        placeholder={isEditing ? item.placeholder : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  socialLinks: { ...p.socialLinks, [item.key]: e.target.value },
                                }
                              : p
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION E: APPROVAL HISTORY */}
          {activeSection === 'history' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                <h3 className="text-base font-bold text-[#101A35] dark:text-white">E. Profile Approval Audit History</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every draft save, submission, approval, or rejection is logged with reviewer timestamps.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Submission ID</th>
                      <th className="py-2.5 px-4 font-medium">Action</th>
                      <th className="py-2.5 px-4 font-medium">Actor / Reviewer</th>
                      <th className="py-2.5 px-4 font-medium">Remarks</th>
                      <th className="py-2.5 px-4 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {dossier.approvalHistory.map((h) => (
                      <tr key={h.history_id}>
                        <td className="py-2.5 px-4 font-mono">{h.submission_code || '—'}</td>
                        <td className="py-2.5 px-4 font-semibold">{h.action.replace(/_/g, ' ')}</td>
                        <td className="py-2.5 px-4">{h.reviewer_name}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{h.remarks || '—'}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{String(h.action_at).slice(0, 16)}</td>
                      </tr>
                    ))}
                    {dossier.approvalHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          No faculty profile submissions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Faculty Skill Modal */}
      <Modal
        open={Boolean(editSkillModal)}
        title={`Edit Faculty Skill${editSkillModal ? ` — ${editSkillModal.skill_name}` : ''}`}
        onClose={() => setEditSkillModal(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateSkill} className="space-y-4">
          <div>
            <label className={labelCls}>Skill Name</label>
            <input
              required
              value={editSkillName}
              onChange={(e) => setEditSkillName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select value={editSkillCategory} onChange={(e) => setEditSkillCategory(e.target.value)} className={inputCls}>
              <option value="Programming Languages">Programming Languages</option>
              <option value="Web & Full-Stack">Web &amp; Full-Stack</option>
              <option value="Database & Backend">Database &amp; Backend</option>
              <option value="Cloud & DevOps">Cloud &amp; DevOps</option>
              <option value="Data Science & AI">Data Science &amp; AI</option>
              <option value="Core CS & Research">Core CS &amp; Research</option>
              <option value="Mentorship & Soft Skills">Mentorship &amp; Soft Skills</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Proficiency Level</label>
              <select
                value={editSkillLevel}
                onChange={(e) => setEditSkillLevel(Number(e.target.value))}
                className={inputCls}
              >
                <option value={1}>1 — Beginner</option>
                <option value={2}>2 — Intermediate</option>
                <option value={3}>3 — Intermediate+</option>
                <option value={4}>4 — Advanced</option>
                <option value={5}>5 — Expert</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Experience (Optional)</label>
              <input
                value={editSkillExp}
                onChange={(e) => setEditSkillExp(e.target.value)}
                placeholder="e.g. 4 Years"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditSkillModal(null)}
              className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingSkill}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {updatingSkill ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
