import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FolderGit2,
  Github,
  Globe,
  GraduationCap,
  History,
  Linkedin,
  Link as LinkIcon,
  Plus,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Trophy,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api';
import {
  AuthUser,
  Branch,
  ProfileDraftPayload,
  Skill,
  Student,
  StudentAchievement,
  StudentInternship,
  StudentProfileDossier,
} from '../types';
import { cardCls, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';
import { ProfileApprovalBadge, ProfileProgressTimeline } from './ProfileStatusWidgets';

type ProfileSectionId =
  | 'personal'
  | 'academic'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'internships'
  | 'achievements'
  | 'social'
  | 'resume'
  | 'history';

interface StudentProfileViewProps {
  user: AuthUser;
  selectedStudentId: number | null;
  onSelectStudentId: (id: number) => void;
}

function isValidHttpUrlInput(v: string | null | undefined): boolean {
  if (!v || !v.trim()) return true;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const SECTION_NAV: { id: ProfileSectionId; code: string; label: string; icon: typeof User }[] = [
  { id: 'personal', code: 'A', label: 'Personal Information', icon: User },
  { id: 'academic', code: 'B', label: 'Academic Information', icon: GraduationCap },
  { id: 'skills', code: 'C', label: 'Technical Skills', icon: SlidersHorizontal },
  { id: 'projects', code: 'D', label: 'Projects', icon: FolderGit2 },
  { id: 'certifications', code: 'E', label: 'Certifications', icon: Award },
  { id: 'internships', code: 'F', label: 'Internships & Experience', icon: Briefcase },
  { id: 'achievements', code: 'G', label: 'Achievements & Activities', icon: Trophy },
  { id: 'social', code: 'H', label: 'Professional Social Links', icon: LinkIcon },
  { id: 'resume', code: 'I', label: 'Resume Management', icon: FileText },
  { id: 'history', code: 'J', label: 'Approval History & Diffs', icon: History },
];

export function StudentProfileView({ user, selectedStudentId, onSelectStudentId }: StudentProfileViewProps) {
  const { showToast } = useToast();
  const [directory, setDirectory] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);
  const [dossierData, setDossierData] = useState<StudentProfileDossier | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<ProfileSectionId>('personal');
  const [viewScope, setViewScope] = useState<'official' | 'pending'>('official');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ProfileDraftPayload | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Resume preview modal
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('Resume.pdf');

  // Temporary inline forms for C, D, E, F, G when editing
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Programming Languages');
  const [newSkillLevel, setNewSkillLevel] = useState<number>(3);
  const [newSkillExp, setNewSkillExp] = useState('');
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null);

  const [projModalOpen, setProjModalOpen] = useState(false);
  const [editingProjIdx, setEditingProjIdx] = useState<number | null>(null);
  const [projForm, setProjForm] = useState({
    title: '',
    tech_stack: '',
    description: '',
    category: '',
    duration: '',
    repo_url: '',
    live_url: '',
    team_members: '',
    role_in_project: '',
  });

  const [certModalOpen, setCertModalOpen] = useState(false);
  const [editingCertIdx, setEditingCertIdx] = useState<number | null>(null);
  const [certForm, setCertForm] = useState({
    cert_name: '',
    issuing_org: '',
    issue_date: '2026-08-15',
    expiration_date: '',
    credential_id: '',
    verification_url: '',
    certificate_file_name: '' as string | null,
    certificate_file_data: '' as string | null,
  });

  const [internModalOpen, setInternModalOpen] = useState(false);
  const [editingInternIdx, setEditingInternIdx] = useState<number | null>(null);
  const [internForm, setInternForm] = useState<StudentInternship>({
    company_name: '',
    role: '',
    duration: '8 Weeks',
    start_date: '2026-05-10',
    end_date: '2026-07-05',
    description: '',
    technologies_used: '',
    certificate_name: null,
    certificate_data: null,
  });

  const [achModalOpen, setAchModalOpen] = useState(false);
  const [editingAchIdx, setEditingAchIdx] = useState<number | null>(null);
  const [achForm, setAchForm] = useState<StudentAchievement>({
    title: '',
    category: 'Hackathon',
    event_date: '2026-02-20',
    description: '',
  });

  const effectiveId = user.role === 'STUDENT' && user.studentId ? user.studentId : selectedStudentId;
  const isOwnerStudent = user.role === 'STUDENT' && user.studentId === dossierData?.officialStudent?.student_id;

  useEffect(() => {
    apiRequest<Branch[]>('/api/branches').then(setBranches).catch(() => {});
    apiRequest<Skill[]>('/api/skills').then(setSkillCatalog).catch(() => {});
    if (user.role !== 'STUDENT') {
      apiRequest<Student[]>('/api/students')
        .then((list) => {
          setDirectory(list);
          if (!effectiveId && list.length > 0) {
            onSelectStudentId(list[0].student_id);
          }
        })
        .catch(() => {});
    }
  }, []);

  const loadDossier = (id: number) => {
    setLoading(true);
    apiRequest<StudentProfileDossier>(`/api/student-profile/${id}`)
      .then((res) => {
        setDossierData(res);
        setIsEditing(false);
        setEditDraft(null);
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : 'Unable to load profile dossier.', 'error');
        setDossierData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (effectiveId) loadDossier(effectiveId);
  }, [effectiveId]);

  const startEditing = () => {
    if (!dossierData) return;
    const base =
      dossierData.latestSubmission &&
      ['DRAFT', 'CORRECTION_REQUESTED', 'REJECTED', 'WAITING_FOR_APPROVAL'].includes(dossierData.latestSubmission.status) &&
      dossierData.latestSubmission.draft_payload
        ? dossierData.latestSubmission.draft_payload
        : dossierData.officialDossier;
    setEditDraft(JSON.parse(JSON.stringify(base)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditDraft(null);
  };

  const handleSaveDraft = async () => {
    if (!dossierData || !editDraft) return;
    setSavingDraft(true);
    try {
      const res = await apiRequest<{ message: string; submissionCode: string }>(
        `/api/student-profile/${dossierData.officialStudent.student_id}/draft`,
        {
          method: 'POST',
          body: JSON.stringify(editDraft),
        }
      );
      showToast(res.message);
      loadDossier(dossierData.officialStudent.student_id);
      setViewScope('pending');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save draft.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!dossierData || !editDraft) return;
    setSubmittingApproval(true);
    try {
      const res = await apiRequest<{ message: string; submissionCode: string }>(
        `/api/student-profile/${dossierData.officialStudent.student_id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify(editDraft),
        }
      );
      showToast(res.message);
      loadDossier(dossierData.officialStudent.student_id);
      setViewScope('official');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Validation failed. Please review your entries.', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handlePhotoUpload = (file: File | null) => {
    if (!file || !editDraft) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid JPG, PNG, or WebP image.', 'error');
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

  const handleResumeUpload = (file: File | null) => {
    if (!file || !editDraft) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      showToast('Only PDF (.pdf) resume files are allowed.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Resume PDF must be 2 MB or smaller.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditDraft((prev) =>
        prev
          ? {
              ...prev,
              resume: {
                file_name: file.name,
                file_size: file.size,
                mime_type: 'application/pdf',
                file_data_url: String(reader.result),
                uploaded_at: new Date().toISOString(),
              },
            }
          : prev
      );
      showToast(`Attached "${file.name}". Save Draft or Submit for Approval to apply.`);
    };
    reader.readAsDataURL(file);
  };

  const displayedDossier: ProfileDraftPayload | null = useMemo(() => {
    if (!dossierData) return null;
    if (isEditing && editDraft) return editDraft;
    if (
      viewScope === 'pending' &&
      dossierData.latestSubmission &&
      dossierData.latestSubmission.status !== 'APPROVED' &&
      dossierData.latestSubmission.draft_payload
    ) {
      return dossierData.latestSubmission.draft_payload;
    }
    return dossierData.officialDossier;
  }, [dossierData, isEditing, editDraft, viewScope]);

  const hasPendingOrReviewRevision = Boolean(
    dossierData?.latestSubmission && dossierData.latestSubmission.status !== 'APPROVED'
  );

  // Skill CRUD helpers inside editDraft
  const handleSaveSkill = () => {
    if (!editDraft || !newSkillName.trim()) {
      showToast('Please enter or select a skill name.', 'error');
      return;
    }
    const label: 'Beginner' | 'Intermediate' | 'Advanced' =
      newSkillLevel >= 4 ? 'Advanced' : newSkillLevel >= 2 ? 'Intermediate' : 'Beginner';
    const matchedCatalog = skillCatalog.find(
      (s) => s.skill_name.toLowerCase() === newSkillName.trim().toLowerCase()
    );
    const nextSkill = {
      skill_id: matchedCatalog?.skill_id,
      skill_name: matchedCatalog?.skill_name || newSkillName.trim(),
      category: matchedCatalog?.category || newSkillCategory,
      proficiency_level: newSkillLevel,
      proficiency_label: label,
      experience_duration: newSkillExp.trim(),
      verified: 0,
    };
    setEditDraft((prev) => {
      if (!prev) return prev;
      const list = [...prev.skills];
      if (editingSkillIdx !== null) {
        list[editingSkillIdx] = nextSkill;
      } else {
        const dupIdx = list.findIndex((x) => x.skill_name.toLowerCase() === nextSkill.skill_name.toLowerCase());
        if (dupIdx >= 0) list[dupIdx] = nextSkill;
        else list.push(nextSkill);
      }
      return { ...prev, skills: list };
    });
    setNewSkillName('');
    setNewSkillLevel(3);
    setNewSkillExp('');
    setEditingSkillIdx(null);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;
    if (!isValidHttpUrlInput(projForm.repo_url) || !isValidHttpUrlInput(projForm.live_url)) {
      showToast('Project GitHub and Live URLs must start with http:// or https://.', 'error');
      return;
    }
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.projects];
      if (editingProjIdx !== null) next[editingProjIdx] = { ...next[editingProjIdx], ...projForm };
      else next.unshift({ ...projForm });
      return { ...prev, projects: next };
    });
    setProjModalOpen(false);
    setEditingProjIdx(null);
  };

  const handleSaveCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;
    if (!isValidHttpUrlInput(certForm.verification_url)) {
      showToast('Verification URL must start with http:// or https://.', 'error');
      return;
    }
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.certifications];
      if (editingCertIdx !== null) next[editingCertIdx] = { ...next[editingCertIdx], ...certForm };
      else next.unshift({ ...certForm });
      return { ...prev, certifications: next };
    });
    setCertModalOpen(false);
    setEditingCertIdx(null);
  };

  const handleSaveIntern = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.internships];
      if (editingInternIdx !== null) next[editingInternIdx] = { ...next[editingInternIdx], ...internForm };
      else next.unshift({ ...internForm });
      return { ...prev, internships: next };
    });
    setInternModalOpen(false);
    setEditingInternIdx(null);
  };

  const handleSaveAch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.achievements];
      if (editingAchIdx !== null) next[editingAchIdx] = { ...next[editingAchIdx], ...achForm };
      else next.unshift({ ...achForm });
      return { ...prev, achievements: next };
    });
    setAchModalOpen(false);
    setEditingAchIdx(null);
  };

  const socialItems: {
    key: keyof ProfileDraftPayload['socialLinks'];
    label: string;
    placeholder: string;
    icon: typeof Linkedin;
    accent: string;
  }[] = [
    { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/username', icon: Linkedin, accent: 'text-[#0A66C2]' },
    { key: 'github_url', label: 'GitHub', placeholder: 'https://github.com/username', icon: Github, accent: 'text-[#172033] dark:text-white' },
    { key: 'portfolio_url', label: 'Portfolio Website', placeholder: 'https://portfolio.example.com', icon: Sparkles, accent: 'text-[#246BFD]' },
    { key: 'personal_website_url', label: 'Personal Website', placeholder: 'https://yourwebsite.com', icon: Globe, accent: 'text-[#20C5E8]' },
    { key: 'leetcode_url', label: 'LeetCode', placeholder: 'https://leetcode.com/u/username', icon: Code2, accent: 'text-amber-600' },
    { key: 'hackerrank_url', label: 'HackerRank', placeholder: 'https://www.hackerrank.com/profile/username', icon: Terminal, accent: 'text-emerald-600' },
    { key: 'codechef_url', label: 'CodeChef', placeholder: 'https://www.codechef.com/users/username', icon: Trophy, accent: 'text-orange-600' },
    { key: 'geeksforgeeks_url', label: 'GeeksforGeeks', placeholder: 'https://www.geeksforgeeks.org/user/username', icon: Code2, accent: 'text-emerald-700' },
  ];

  return (
    <div className="space-y-6">
      {/* Staff Student Selector */}
      {user.role !== 'STUDENT' && (
        <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <h2 className="text-sm font-semibold text-[#172033] dark:text-white">Select Student Profile Dossier</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect verified official student records, social profiles, resume PDF, and approval history
            </p>
          </div>
          <select
            value={effectiveId ?? ''}
            onChange={(e) => onSelectStudentId(Number(e.target.value))}
            className={`${inputCls} max-w-sm`}
          >
            {directory.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.roll_number} — {s.full_name} ({s.branch})
              </option>
            ))}
          </select>
        </div>
      )}

      {loading || !dossierData || !displayedDossier ? (
        <div className={`${cardCls} p-8 text-center text-xs text-slate-500`}>Loading GCET Student Profile Dossier...</div>
      ) : (
        <>
          {/* Top Profile Summary + Workflow Status Banner */}
          <div className={`${cardCls} p-6 space-y-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#101A35] text-white flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                  {displayedDossier.personal.photo_data_url ? (
                    <img
                      src={displayedDossier.personal.photo_data_url}
                      alt={displayedDossier.personal.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold">
                      {displayedDossier.personal.full_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-[#101A35] dark:text-white truncate">
                      {dossierData.officialStudent.full_name}
                    </h2>
                    <ProfileApprovalBadge status={dossierData.currentApprovalStatus} />
                    <StatusText status={dossierData.officialStudent.placement_status} />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    <span className="font-mono font-semibold">{dossierData.officialStudent.roll_number}</span> ·{' '}
                    {dossierData.officialStudent.branch} · Year {dossierData.officialStudent.year_of_study ?? 4} · Semester{' '}
                    {dossierData.officialStudent.semester ?? 7} · Sec {dossierData.officialStudent.section ?? 'A'} · CGPA{' '}
                    <span className="font-mono font-bold text-[#246BFD] dark:text-[#20C5E8]">
                      {Number(dossierData.officialStudent.cgpa).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Assigned Faculty Reviewer:{' '}
                    <span className="font-medium text-[#172033] dark:text-slate-200">
                      {dossierData.assignedFaculty
                        ? `${dossierData.assignedFaculty.full_name} (${dossierData.assignedFaculty.assigned_branch || 'Dept'})`
                        : 'Department Placement Coordinator'}
                    </span>{' '}
                    · Profile Completeness:{' '}
                    <span className="font-mono font-semibold">{dossierData.completionPercentage}%</span>
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {!isEditing && hasPendingOrReviewRevision && (
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-[#101827]">
                    <button
                      type="button"
                      onClick={() => setViewScope('official')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
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
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        viewScope === 'pending'
                          ? 'bg-white dark:bg-[#18243A] text-amber-700 dark:text-amber-300 shadow-sm'
                          : 'text-slate-500 hover:text-[#172033] dark:hover:text-white'
                      }`}
                    >
                      Pending / Draft Revision
                    </button>
                  </div>
                )}

                {isOwnerStudent && !isEditing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>
                      {dossierData.currentApprovalStatus === 'REJECTED' ||
                      dossierData.currentApprovalStatus === 'CORRECTION_REQUESTED'
                        ? 'Edit & Resubmit Profile'
                        : 'Edit Profile'}
                    </span>
                  </button>
                )}

                {isEditing && (
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
                      disabled={submittingApproval}
                      onClick={handleSubmitForApproval}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingApproval ? 'Submitting...' : 'Submit for Approval'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 5-Stage Approval Progress Timeline */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/70">
              <ProfileProgressTimeline
                status={isEditing ? 'DRAFT' : dossierData.currentApprovalStatus}
                hasAnySubmission={Boolean(dossierData.latestSubmission)}
              />
            </div>

            {/* Contextual Status Banner (Waiting / Rejected / Correction Requested / Editing Mode) */}
            {isEditing && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between gap-3">
                <div>
                  <strong>Editing Draft Mode:</strong> Any updates you make across Sections A–I will NOT overwrite your Official Profile until reviewed and approved by your Faculty Coordinator.
                </div>
              </div>
            )}

            {!isEditing && dossierData.latestSubmission?.status === 'WAITING_FOR_APPROVAL' && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/80 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    WAITING FOR FACULTY APPROVAL — Official Profile Preserved
                  </span>
                  <span className="font-mono">{dossierData.latestSubmission.submission_code}</span>
                </div>
                <p>
                  Submitted on{' '}
                  <span className="font-mono">
                    {dossierData.latestSubmission.submitted_at
                      ? String(dossierData.latestSubmission.submitted_at).slice(0, 16)
                      : '—'}
                  </span>{' '}
                  to{' '}
                  <strong>
                    {dossierData.latestSubmission.assigned_faculty_name ||
                      dossierData.assignedFaculty?.full_name ||
                      'Assigned Faculty'}
                  </strong>{' '}
                  ({dossierData.latestSubmission.changed_fields.length} modified field(s)). Currently viewing{' '}
                  <strong>{viewScope === 'official' ? 'Official Live Profile' : 'Pending Submitted Revision'}</strong>.
                </p>
              </div>
            )}

            {!isEditing && dossierData.latestSubmission?.status === 'REJECTED' && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/80 text-xs text-red-900 dark:text-red-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>
                    Submission {dossierData.latestSubmission.submission_code} Rejected — Official Profile Remains Unchanged
                  </span>
                </p>
                <p>
                  <strong>Faculty Reason:</strong> {dossierData.latestSubmission.faculty_remarks || 'No reason specified.'}
                </p>
              </div>
            )}

            {!isEditing && dossierData.latestSubmission?.status === 'CORRECTION_REQUESTED' && (
              <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700/80 text-xs text-orange-900 dark:text-orange-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span>
                    Corrections Requested on {dossierData.latestSubmission.submission_code} — Official Profile Remains Unchanged
                  </span>
                </p>
                <p>
                  <strong>Faculty Comments:</strong> {dossierData.latestSubmission.faculty_remarks}
                </p>
              </div>
            )}

            {!isEditing && dossierData.latestSubmission?.status === 'APPROVED' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Latest Submission ({dossierData.latestSubmission.submission_code}) Approved by{' '}
                  <strong>{dossierData.latestSubmission.reviewed_by_name || 'Faculty'}</strong>. Official Profile is up to date.
                </span>
                <span className="font-mono text-[11px]">
                  {dossierData.latestSubmission.reviewed_at ? String(dossierData.latestSubmission.reviewed_at).slice(0, 16) : ''}
                </span>
              </div>
            )}
          </div>

          {/* Main Left-Nav + Section Body Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Section Navigation */}
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

            {/* Active Section Content */}
            <div className={`${cardCls} p-6 lg:col-span-9 space-y-6`}>
              {/* SECTION A: PERSONAL INFORMATION */}
              {activeSection === 'personal' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#101A35] dark:text-white">A. Personal Information</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Identity, contact details, residential address, and institutional profile photograph
                      </p>
                    </div>
                  </div>

                  {/* Photo Upload / Preview */}
                  <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#101A35] text-white flex items-center justify-center shrink-0">
                      {displayedDossier.personal.photo_data_url ? (
                        <img src={displayedDossier.personal.photo_data_url} alt="Student" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-xs font-semibold text-[#172033] dark:text-white">Profile Photograph</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Formal passport-style photo (PNG/JPG/WebP, max 1.5 MB)
                      </p>
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
                        value={displayedDossier.personal.full_name}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, full_name: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Roll Number (Institutional ID)</label>
                      <input disabled value={dossierData.officialStudent.roll_number} className={`${inputCls} opacity-75 font-mono`} />
                    </div>
                    <div>
                      <label className={labelCls}>Date of Birth</label>
                      <input
                        type={isEditing || displayedDossier.personal.date_of_birth ? 'date' : 'text'}
                        disabled={!isEditing}
                        value={displayedDossier.personal.date_of_birth}
                        placeholder={isEditing ? '' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, date_of_birth: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select
                        disabled={!isEditing}
                        value={displayedDossier.personal.gender}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, gender: e.target.value } } : p))
                        }
                        className={inputCls}
                      >
                        <option value="">{isEditing ? 'Select' : 'Not added yet'}</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>College Email (Official)</label>
                      <input disabled value={dossierData.officialStudent.email} className={`${inputCls} opacity-75`} />
                    </div>
                    <div>
                      <label className={labelCls}>Personal Email</label>
                      <input
                        type="email"
                        disabled={!isEditing}
                        value={displayedDossier.personal.personal_email}
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
                        value={displayedDossier.personal.phone}
                        placeholder={isEditing ? 'Enter mobile number' : 'Not added yet'}
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
                        value={displayedDossier.personal.alternate_phone}
                        placeholder={isEditing ? 'Enter alternate phone' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, alternate_phone: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>City</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.personal.city}
                        placeholder={isEditing ? 'Enter city' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, city: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>State</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.personal.state}
                        placeholder={isEditing ? 'Enter state' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, state: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>PIN Code</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.personal.pin_code}
                        placeholder={isEditing ? 'Enter PIN code' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, pin_code: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className={labelCls}>Residential Address</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.personal.address}
                        placeholder={isEditing ? 'Enter residential address' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, personal: { ...p.personal, address: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION B: ACADEMIC INFORMATION */}
              {activeSection === 'academic' && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <h3 className="text-base font-bold text-[#101A35] dark:text-white">B. Academic Information</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Institutional academic credentials, CGPA, backlogs, and prior schooling records
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>College Name</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.college_name}
                        placeholder={isEditing ? 'Enter college name' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, college_name: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>University Details</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.university_name}
                        placeholder={isEditing ? 'Enter university details' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, university_name: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Department</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.dept_name}
                        placeholder={isEditing ? 'Enter department' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, dept_name: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Branch</label>
                      <select
                        disabled={!isEditing}
                        value={displayedDossier.academic.branch}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, branch: e.target.value } } : p))
                        }
                        className={inputCls}
                      >
                        {branches.map((b) => (
                          <option key={b.branch_id} value={b.branch_code}>
                            {b.branch_code} — {b.branch_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Registration Number</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.registration_number}
                        placeholder={isEditing ? 'Enter registration number' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, registration_number: e.target.value } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Admission Year</label>
                      <input
                        type="number"
                        disabled={!isEditing}
                        value={displayedDossier.academic.admission_year || ''}
                        placeholder={isEditing ? 'Enter admission year' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, admission_year: Number(e.target.value) } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Current Academic Year</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.academic_year}
                        placeholder={isEditing ? 'Enter academic year' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, academic_year: e.target.value } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Current Year of Study</label>
                      <select
                        disabled={!isEditing}
                        value={displayedDossier.academic.year_of_study}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, year_of_study: Number(e.target.value) } } : p))
                        }
                        className={inputCls}
                      >
                        {[1, 2, 3, 4].map((y) => (
                          <option key={y} value={y}>Year {y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Current Semester</label>
                      <select
                        disabled={!isEditing}
                        value={displayedDossier.academic.semester}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, semester: Number(e.target.value) } } : p))
                        }
                        className={inputCls}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                          <option key={sem} value={sem}>Semester {sem}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Section</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.section}
                        placeholder={isEditing ? 'Enter section' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, section: e.target.value } } : p))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Graduation Batch Year</label>
                      <input
                        type="number"
                        disabled={!isEditing}
                        value={displayedDossier.academic.graduation_year || ''}
                        placeholder={isEditing ? 'Enter graduation year' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, graduation_year: Number(e.target.value) } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>CGPA (0.00 – 10.00)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        disabled={!isEditing}
                        value={displayedDossier.academic.cgpa}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, cgpa: Number(e.target.value) } } : p))
                        }
                        className={`${inputCls} font-mono font-semibold`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Equivalent Percentage (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        disabled={!isEditing}
                        value={displayedDossier.academic.percentage || ''}
                        placeholder={isEditing ? 'Enter percentage' : 'Not added yet'}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, percentage: Number(e.target.value) } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Active Backlogs</label>
                      <input
                        type="number"
                        min="0"
                        disabled={!isEditing}
                        value={displayedDossier.academic.active_backlogs}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, active_backlogs: Number(e.target.value) } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>History of Backlogs</label>
                      <input
                        type="number"
                        min="0"
                        disabled={!isEditing}
                        value={displayedDossier.academic.history_of_backlogs}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, history_of_backlogs: Number(e.target.value) } } : p))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>10th Standard Marks / GPA</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.tenth_marks}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, tenth_marks: e.target.value } } : p))
                        }
                        placeholder={isEditing ? 'Enter 10th marks / GPA' : 'Not added yet'}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Intermediate / Diploma Marks</label>
                      <input
                        disabled={!isEditing}
                        value={displayedDossier.academic.inter_diploma_marks}
                        onChange={(e) =>
                          setEditDraft((p) => (p ? { ...p, academic: { ...p.academic, inter_diploma_marks: e.target.value } } : p))
                        }
                        placeholder={isEditing ? 'Enter Intermediate / Diploma marks' : 'Not added yet'}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION C: TECHNICAL SKILLS */}
              {activeSection === 'skills' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                        C. Technical Skills ({displayedDossier.skills.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Add unlimited skills with proficiency levels (1–5 / Beginner–Advanced) and experience duration
                      </p>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4">
                        <label className={labelCls}>Skill Name (Catalog or Custom)</label>
                        <input
                          list="gcet-skill-catalog"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          placeholder="e.g. Java, Spring Boot, React, SQL"
                          className={inputCls}
                        />
                        <datalist id="gcet-skill-catalog">
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
                          <option value="Core CS & Tools">Core CS &amp; Tools</option>
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
                        <label className={labelCls}>Experience</label>
                        <input
                          value={newSkillExp}
                          onChange={(e) => setNewSkillExp(e.target.value)}
                          placeholder="18 Months"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <button
                          type="button"
                          onClick={handleSaveSkill}
                          className="w-full py-2 px-3 rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center"
                        >
                          {editingSkillIdx !== null ? 'Save' : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {displayedDossier.skills.map((sk, idx) => (
                      <div
                        key={`${sk.skill_name}-${idx}`}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="min-w-[180px] flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[#172033] dark:text-white">{sk.skill_name}</p>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">· {sk.category}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Level: <span className="font-semibold text-[#246BFD] dark:text-[#20C5E8]">{sk.proficiency_label}</span> ({sk.proficiency_level}/5)
                            {sk.experience_duration ? ` · Experience: ${sk.experience_duration}` : ''}
                          </p>
                          <div className="h-1.5 w-full max-w-md rounded-full bg-slate-100 dark:bg-slate-800 mt-2 overflow-hidden">
                            <div
                              className="h-full bg-[#246BFD] rounded-full"
                              style={{ width: `${(sk.proficiency_level / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                        {isEditing && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSkillIdx(idx);
                                setNewSkillName(sk.skill_name);
                                setNewSkillCategory(sk.category);
                                setNewSkillLevel(sk.proficiency_level);
                                setNewSkillExp(sk.experience_duration || '');
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#246BFD]"
                              title="Edit skill"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditDraft((p) =>
                                  p ? { ...p, skills: p.skills.filter((_, i) => i !== idx) } : p
                                )
                              }
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Remove skill"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {displayedDossier.skills.length === 0 && (
                      <p className="text-xs text-slate-500 py-4">No technical skills added yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION D: PROJECTS */}
              {activeSection === 'projects' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                        D. Academic &amp; Engineering Projects ({displayedDossier.projects.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Showcase software architectures, team roles, GitHub repositories, and live deployments
                      </p>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProjIdx(null);
                          setProjForm({
                            title: '',
                            tech_stack: '',
                            description: '',
                            category: '',
                            duration: '',
                            repo_url: '',
                            live_url: '',
                            team_members: '',
                            role_in_project: '',
                          });
                          setProjModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Project</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {displayedDossier.projects.map((p, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#172033] dark:text-white">{p.title}</h4>
                            <p className="text-xs text-[#246BFD] dark:text-[#20C5E8] font-medium mt-0.5">
                              {p.tech_stack}
                              {p.category ? ` · ${p.category}` : ''}
                              {p.duration ? ` · ${p.duration}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.repo_url && (
                              <a
                                href={p.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#246BFD] hover:underline"
                              >
                                <Github className="w-3.5 h-3.5" />
                                <span>GitHub</span>
                              </a>
                            )}
                            {p.live_url && (
                              <a
                                href={p.live_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Live</span>
                              </a>
                            )}
                            {isEditing && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProjIdx(idx);
                                    setProjForm({
                                      title: p.title,
                                      tech_stack: p.tech_stack,
                                      description: p.description,
                                      category: p.category || '',
                                      duration: p.duration || '',
                                      repo_url: p.repo_url || '',
                                      live_url: p.live_url || '',
                                      team_members: p.team_members || '',
                                      role_in_project: p.role_in_project || '',
                                    });
                                    setProjModalOpen(true);
                                  }}
                                  className="p-1 text-slate-500 hover:text-[#246BFD]"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditDraft((prev) =>
                                      prev ? { ...prev, projects: prev.projects.filter((_, i) => i !== idx) } : prev
                                    )
                                  }
                                  className="p-1 text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{p.description}</p>
                        {(p.role_in_project || p.team_members) && (
                          <p className="text-[11px] text-slate-500">
                            {p.role_in_project ? (
                              <>
                                Role: <span className="font-medium">{p.role_in_project}</span>
                              </>
                            ) : null}
                            {p.role_in_project && p.team_members ? ' · ' : ''}
                            {p.team_members ? `Team: ${p.team_members}` : ''}
                          </p>
                        )}
                      </div>
                    ))}
                    {displayedDossier.projects.length === 0 && (
                      <p className="text-xs text-slate-500 py-4">No projects added yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION E: CERTIFICATIONS */}
              {activeSection === 'certifications' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                        E. Certifications ({displayedDossier.certifications.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Industry credentials, verification links, and certificate file attachments
                      </p>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCertIdx(null);
                          setCertForm({
                            cert_name: '',
                            issuing_org: '',
                            issue_date: '2026-08-15',
                            expiration_date: '',
                            credential_id: '',
                            verification_url: '',
                            certificate_file_name: null,
                            certificate_file_data: null,
                          });
                          setCertModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Certification</span>
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {displayedDossier.certifications.map((c, idx) => (
                      <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#172033] dark:text-white">{c.cert_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {c.issuing_org} · Issued <span className="font-mono">{c.issue_date}</span>
                            {c.expiration_date ? ` · Expires ${c.expiration_date}` : ''}
                            {c.credential_id ? ` · ID: ${c.credential_id}` : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            {c.verification_url && (
                              <a
                                href={c.verification_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#246BFD] hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Verify Credential</span>
                              </a>
                            )}
                            {c.certificate_file_data && c.certificate_file_name && (
                              <a
                                href={c.certificate_file_data}
                                download={c.certificate_file_name}
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                              >
                                <Download className="w-3 h-3" />
                                <span>{c.certificate_file_name}</span>
                              </a>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCertIdx(idx);
                                setCertForm({
                                  cert_name: c.cert_name,
                                  issuing_org: c.issuing_org,
                                  issue_date: c.issue_date,
                                  expiration_date: c.expiration_date || '',
                                  credential_id: c.credential_id || '',
                                  verification_url: c.verification_url || '',
                                  certificate_file_name: c.certificate_file_name || null,
                                  certificate_file_data: c.certificate_file_data || null,
                                });
                                setCertModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-[#246BFD]"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditDraft((p) =>
                                  p ? { ...p, certifications: p.certifications.filter((_, i) => i !== idx) } : p
                                )
                              }
                              className="p-1 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {displayedDossier.certifications.length === 0 && (
                      <p className="text-xs text-slate-500 py-4">No certifications added yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION F: INTERNSHIP & EXPERIENCE */}
              {activeSection === 'internships' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                        F. Internship &amp; Industry Experience ({displayedDossier.internships.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Verified summer internships, industrial training, and technical work experience
                      </p>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInternIdx(null);
                          setInternForm({
                            company_name: '',
                            role: '',
                            duration: '8 Weeks',
                            start_date: '2026-05-10',
                            end_date: '2026-07-05',
                            description: '',
                            technologies_used: '',
                            certificate_name: null,
                            certificate_data: null,
                          });
                          setInternModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Internship</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {displayedDossier.internships.map((intern, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-1.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                              {intern.role} — {intern.company_name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {intern.duration} (<span className="font-mono">{intern.start_date}</span> to{' '}
                              <span className="font-mono">{intern.end_date}</span>)
                            </p>
                          </div>
                          {isEditing && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInternIdx(idx);
                                  setInternForm({ ...intern });
                                  setInternModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-[#246BFD]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDraft((p) =>
                                    p ? { ...p, internships: p.internships.filter((_, i) => i !== idx) } : p
                                  )
                                }
                                className="p-1 text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-[#246BFD] dark:text-[#20C5E8] font-medium">
                          Technologies: {intern.technologies_used}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{intern.description}</p>
                        {intern.certificate_data && intern.certificate_name && (
                          <a
                            href={intern.certificate_data}
                            download={intern.certificate_name}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline pt-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Certificate: {intern.certificate_name}</span>
                          </a>
                        )}
                      </div>
                    ))}
                    {displayedDossier.internships.length === 0 && (
                      <p className="text-xs text-slate-500 py-4">No internship records added yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION G: ACHIEVEMENTS & ACTIVITIES */}
              {activeSection === 'achievements' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                        G. Achievements &amp; Co-Curricular Activities ({displayedDossier.achievements.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Hackathons, coding competitions, workshops, leadership roles, and awards
                      </p>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAchIdx(null);
                          setAchForm({
                            title: '',
                            category: 'Hackathon',
                            event_date: '2026-02-20',
                            description: '',
                          });
                          setAchModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Achievement</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {displayedDossier.achievements.map((ach, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#172033] dark:text-white">{ach.title}</h4>
                            <p className="text-xs text-[#246BFD] dark:text-[#20C5E8] font-medium">
                              {ach.category} · <span className="font-mono">{ach.event_date}</span>
                            </p>
                          </div>
                          {isEditing && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAchIdx(idx);
                                  setAchForm({ ...ach, category: ach.category as StudentAchievement['category'] });
                                  setAchModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-[#246BFD]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDraft((p) =>
                                    p ? { ...p, achievements: p.achievements.filter((_, i) => i !== idx) } : p
                                  )
                                }
                                className="p-1 text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ach.description}</p>
                      </div>
                    ))}
                    {displayedDossier.achievements.length === 0 && (
                      <p className="text-xs text-slate-500 py-4">No achievements or activities added yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION H: PROFESSIONAL SOCIAL LINKS (COMPULSORY SECTION) */}
              {activeSection === 'social' && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                      H. Professional Social &amp; Coding Platform Links
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Compulsory section: Provide verified HTTP/HTTPS profile links for recruiter &amp; faculty inspection.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {socialItems.map((item) => {
                      const Icon = item.icon;
                      const val = displayedDossier.socialLinks[item.key] || '';
                      const isValidUrl = isValidHttpUrlInput(val);
                      return (
                        <div key={item.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${item.accent}`} />
                              <span className="text-xs font-semibold text-[#172033] dark:text-white">{item.label}</span>
                            </div>
                            {val && isValidUrl && (
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#246BFD] dark:text-[#20C5E8] hover:underline"
                              >
                                <span>Open Profile</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <input
                            type="url"
                            disabled={!isEditing}
                            value={val}
                            onChange={(e) =>
                              setEditDraft((p) =>
                                p ? { ...p, socialLinks: { ...p.socialLinks, [item.key]: e.target.value } } : p
                              )
                            }
                            placeholder={item.placeholder}
                            className={`${inputCls} text-xs ${!isValidUrl ? 'border-red-500 focus:border-red-500' : ''}`}
                          />
                          {!isValidUrl && (
                            <p className="text-[11px] text-red-600 dark:text-red-400">
                              Invalid URL format. Must begin with http:// or https://
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION I: RESUME MANAGEMENT */}
              {activeSection === 'resume' && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <h3 className="text-base font-bold text-[#101A35] dark:text-white">I. Resume Management (PDF)</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Upload your formatted institutional resume in PDF format (maximum 2 MB), preview inline, or replace.
                    </p>
                  </div>

                  {displayedDossier.resume ? (
                    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[#246BFD]/10 text-[#246BFD] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#172033] dark:text-white truncate">
                            {displayedDossier.resume.file_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            PDF · <span className="font-mono">{Math.round(displayedDossier.resume.file_size / 1024)} KB</span> ·
                            Latest upload:{' '}
                            <span className="font-mono">{String(displayedDossier.resume.uploaded_at).slice(0, 16)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {displayedDossier.resume.file_data_url && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPdfPreviewTitle(displayedDossier.resume!.file_name);
                                setPdfPreviewUrl(displayedDossier.resume!.file_data_url || null);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview PDF</span>
                            </button>
                            <a
                              href={displayedDossier.resume.file_data_url}
                              download={displayedDossier.resume.file_name}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-[#172033] dark:text-slate-200 hover:bg-white dark:hover:bg-[#18243A]"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                      No PDF resume uploaded yet. Click <strong>Edit Profile</strong> to upload your PDF resume.
                    </div>
                  )}

                  {isEditing && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs">
                        <p className="font-semibold text-[#172033] dark:text-white">
                          {displayedDossier.resume ? 'Replace Existing Resume PDF' : 'Upload Resume PDF'}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">Only .pdf files up to 2 MB are accepted.</p>
                      </div>
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white text-xs font-semibold">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{displayedDossier.resume ? 'Replace PDF' : 'Choose PDF File'}</span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={(e) => handleResumeUpload(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION J: APPROVAL HISTORY & PENDING DIFFS */}
              {activeSection === 'history' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-100 dark:border-slate-700/70 pb-3">
                    <h3 className="text-base font-bold text-[#101A35] dark:text-white">
                      J. Profile Approval History &amp; Submission Diffs
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Complete audit trail of profile submissions, faculty verification actions, and changed fields
                    </p>
                  </div>

                  {dossierData.latestSubmission && dossierData.latestSubmission.changed_fields.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[#101A35] dark:text-white">
                        Latest Submission Changes ({dossierData.latestSubmission.submission_code})
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/70">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                            <tr>
                              <th className="py-2 px-3 font-medium">Section</th>
                              <th className="py-2 px-3 font-medium">Field</th>
                              <th className="py-2 px-3 font-medium">Previous Official</th>
                              <th className="py-2 px-3 font-medium">Submitted Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {dossierData.latestSubmission.changed_fields.map((d, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 text-slate-500">{d.section_name}</td>
                                <td className="py-2 px-3 font-semibold text-[#172033] dark:text-white">{d.field_label}</td>
                                <td className="py-2 px-3 text-slate-500">{d.previous_value || '—'}</td>
                                <td className="py-2 px-3 font-semibold text-[#246BFD] dark:text-[#20C5E8]">{d.new_value || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-[#101A35] dark:text-white">Approval Audit Timeline</h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/70">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
                          <tr>
                            <th className="py-2.5 px-3 font-medium">Submission ID</th>
                            <th className="py-2.5 px-3 font-medium">Action</th>
                            <th className="py-2.5 px-3 font-medium">Reviewer / Actor</th>
                            <th className="py-2.5 px-3 font-medium">Remarks</th>
                            <th className="py-2.5 px-3 font-medium">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {dossierData.approvalHistory.map((h) => (
                            <tr key={h.history_id}>
                              <td className="py-2.5 px-3 font-mono text-[#246BFD] dark:text-[#20C5E8]">
                                {h.submission_code || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">{h.action.replace(/_/g, ' ')}</td>
                              <td className="py-2.5 px-3">{h.faculty_name}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{h.remarks || '—'}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{String(h.action_at).slice(0, 16)}</td>
                            </tr>
                          ))}
                          {dossierData.approvalHistory.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-500">
                                No profile revision submissions recorded yet. Baseline official profile is active.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Project Modal */}
      <Modal
        open={projModalOpen}
        title={editingProjIdx !== null ? 'Edit Project' : 'Add Academic / Engineering Project'}
        onClose={() => setProjModalOpen(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveProject} className="space-y-3.5">
          <div>
            <label className={labelCls}>Project Title</label>
            <input required value={projForm.title} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <input value={projForm.category} onChange={(e) => setProjForm({ ...projForm, category: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Duration</label>
              <input value={projForm.duration} onChange={(e) => setProjForm({ ...projForm, duration: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Technologies Used</label>
            <input required value={projForm.tech_stack} onChange={(e) => setProjForm({ ...projForm, tech_stack: e.target.value })} placeholder="Java, JDBC, Servlets, MySQL" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea required rows={3} value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>GitHub Repository Link</label>
              <input type="url" value={projForm.repo_url} onChange={(e) => setProjForm({ ...projForm, repo_url: e.target.value })} placeholder="https://github.com/..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Live Link (Optional)</label>
              <input type="url" value={projForm.live_url} onChange={(e) => setProjForm({ ...projForm, live_url: e.target.value })} placeholder="https://..." className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Project Role</label>
              <input value={projForm.role_in_project} onChange={(e) => setProjForm({ ...projForm, role_in_project: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Team Members</label>
              <input value={projForm.team_members} onChange={(e) => setProjForm({ ...projForm, team_members: e.target.value })} placeholder="Solo or 3 Members" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setProjModalOpen(false)} className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white">Save to Draft</button>
          </div>
        </form>
      </Modal>

      {/* Certification Modal */}
      <Modal
        open={certModalOpen}
        title={editingCertIdx !== null ? 'Edit Certification' : 'Add Certification'}
        onClose={() => setCertModalOpen(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveCert} className="space-y-3.5">
          <div>
            <label className={labelCls}>Certification Name</label>
            <input required value={certForm.cert_name} onChange={(e) => setCertForm({ ...certForm, cert_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Issuing Organization</label>
            <input required value={certForm.issuing_org} onChange={(e) => setCertForm({ ...certForm, issuing_org: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" required value={certForm.issue_date} onChange={(e) => setCertForm({ ...certForm, issue_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expiration Date (Optional)</label>
              <input type="date" value={certForm.expiration_date} onChange={(e) => setCertForm({ ...certForm, expiration_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Certificate ID</label>
              <input value={certForm.credential_id} onChange={(e) => setCertForm({ ...certForm, credential_id: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Verification URL</label>
              <input type="url" value={certForm.verification_url} onChange={(e) => setCertForm({ ...certForm, verification_url: e.target.value })} placeholder="https://..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Certificate File Upload (Optional PDF/Image ≤ 2MB)</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  showToast('File size must be 2 MB or smaller.', 'error');
                  return;
                }
                const r = new FileReader();
                r.onload = () => setCertForm({ ...certForm, certificate_file_name: f.name, certificate_file_data: String(r.result) });
                r.readAsDataURL(f);
              }}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCertModalOpen(false)} className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white">Save to Draft</button>
          </div>
        </form>
      </Modal>

      {/* Internship Modal */}
      <Modal
        open={internModalOpen}
        title={editingInternIdx !== null ? 'Edit Internship' : 'Add Internship / Industry Experience'}
        onClose={() => setInternModalOpen(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveIntern} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Company Name</label>
              <input required value={internForm.company_name} onChange={(e) => setInternForm({ ...internForm, company_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <input required value={internForm.role} onChange={(e) => setInternForm({ ...internForm, role: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Duration</label>
              <input required value={internForm.duration} onChange={(e) => setInternForm({ ...internForm, duration: e.target.value })} placeholder="8 Weeks" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" required value={internForm.start_date} onChange={(e) => setInternForm({ ...internForm, start_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" required value={internForm.end_date} onChange={(e) => setInternForm({ ...internForm, end_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Technologies Used</label>
            <input required value={internForm.technologies_used} onChange={(e) => setInternForm({ ...internForm, technologies_used: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description &amp; Responsibilities</label>
            <textarea required rows={3} value={internForm.description} onChange={(e) => setInternForm({ ...internForm, description: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Internship Certificate Upload (Optional ≤ 2MB)</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  showToast('File size must be 2 MB or smaller.', 'error');
                  return;
                }
                const r = new FileReader();
                r.onload = () => setInternForm({ ...internForm, certificate_name: f.name, certificate_data: String(r.result) });
                r.readAsDataURL(f);
              }}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setInternModalOpen(false)} className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white">Save to Draft</button>
          </div>
        </form>
      </Modal>

      {/* Achievement Modal */}
      <Modal
        open={achModalOpen}
        title={editingAchIdx !== null ? 'Edit Achievement / Activity' : 'Add Achievement / Activity'}
        onClose={() => setAchModalOpen(false)}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveAch} className="space-y-3.5">
          <div>
            <label className={labelCls}>Title</label>
            <input required value={achForm.title} onChange={(e) => setAchForm({ ...achForm, title: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={achForm.category}
                onChange={(e) => setAchForm({ ...achForm, category: e.target.value as StudentAchievement['category'] })}
                className={inputCls}
              >
                {[
                  'Technical Achievement',
                  'Hackathon',
                  'Coding Competition',
                  'Workshop',
                  'Technical Event',
                  'Leadership',
                  'Extracurricular',
                  'Award & Recognition',
                ].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" required value={achForm.event_date} onChange={(e) => setAchForm({ ...achForm, event_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea required rows={3} value={achForm.description} onChange={(e) => setAchForm({ ...achForm, description: e.target.value })} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAchModalOpen(false)} className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white">Save to Draft</button>
          </div>
        </form>
      </Modal>

      {/* Inline PDF Resume Preview Modal */}
      <Modal
        open={Boolean(pdfPreviewUrl)}
        title={`Resume Preview — ${pdfPreviewTitle}`}
        onClose={() => setPdfPreviewUrl(null)}
        maxWidth="max-w-4xl"
      >
        {pdfPreviewUrl && (
          <div className="space-y-3">
            <iframe
              src={pdfPreviewUrl}
              title={pdfPreviewTitle}
              className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-700"
            />
            <div className="flex justify-end">
              <a
                href={pdfPreviewUrl}
                download={pdfPreviewTitle}
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
