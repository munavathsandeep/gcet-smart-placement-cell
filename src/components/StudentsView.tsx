import React, { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, UserRound, Upload, Download } from 'lucide-react';
import { apiRequest } from '../api';
import { AuthUser, Branch, Department, isFacultyRole, Student } from '../types';
import { cardCls, ConfirmDialog, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

function normalizeBranchToken(token?: string | null): string {
  const upper = String(token || '').trim().toUpperCase();
  if (upper === 'CSE-IOT') return 'IOT';
  if (upper === 'CSE-CS') return 'CS';
  if (upper === 'ME') return 'MECH';
  if (upper === 'CE') return 'CIVIL';
  return upper;
}

interface StudentsViewProps {
  user: AuthUser;
  onOpenProfile: (studentId: number) => void;
}

const SAMPLE_CSV = `roll_number,full_name,email,phone,branch,graduation_year,cgpa,semester,section,active_backlogs
23R11A05A1,Karthikeya Sharma,23r11a05a1@gcet.edu.in,+91 98490 21001,CSE,2027,8.75,7,A,0
23R11A66A2,Spandana Reddy,23r11a66a2@gcet.edu.in,+91 98490 21002,CSE-AIML,2027,8.40,7,B,0`;

export function StudentsView({ user, onOpenProfile }: StudentsViewProps) {
  const isStaff = user.role !== 'STUDENT';
  const isFaculty = isFacultyRole(user.role);
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [deptId, setDeptId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [minCgpa, setMinCgpa] = useState('');

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [formRoll, setFormRoll] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBranch, setFormBranch] = useState('CSE');
  const [formAcademicYear, setFormAcademicYear] = useState('2026-27');
  const [formYearOfStudy, setFormYearOfStudy] = useState('4');
  const [formSemester, setFormSemester] = useState('7');
  const [formSection, setFormSection] = useState('A');
  const [formGradYear, setFormGradYear] = useState('2027');
  const [formCgpa, setFormCgpa] = useState('8.00');
  const [formBacklogs, setFormBacklogs] = useState('0');
  const [formGender, setFormGender] = useState('Male');
  const [formAddress, setFormAddress] = useState('');
  const [formResumeUrl, setFormResumeUrl] = useState('');
  const [formStatus, setFormStatus] = useState<'Unplaced' | 'In Process' | 'Placed'>('Unplaced');
  const [formErr, setFormErr] = useState('');

  // CSV Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [importing, setImporting] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const loadStudents = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (branch) params.set('branch', branch);
    if (deptId) params.set('deptId', deptId);
    if (academicYear) params.set('academicYear', academicYear);
    if (gradYear) params.set('gradYear', gradYear);
    if (semester) params.set('semester', semester);
    if (section) params.set('section', section);
    if (minCgpa) params.set('minCgpa', minCgpa);

    apiRequest<Student[]>(`/api/students?${params.toString()}`)
      .then(setStudents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load students'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiRequest<Department[]>('/api/departments').then(setDepartments).catch(() => {});
    apiRequest<Branch[]>('/api/branches').then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadStudents, 150);
    return () => clearTimeout(t);
  }, [q, branch, deptId, academicYear, gradYear, semester, section, minCgpa]);

  const facultyAssignedNormalized = new Set(
    (user.assignedBranches && user.assignedBranches.length > 0
      ? user.assignedBranches
      : (user.assignedBranch || '').split(',').map((s) => s.trim()).filter(Boolean)
    ).map((b) => normalizeBranchToken(b))
  );

  const visibleBranches =
    isFaculty && facultyAssignedNormalized.size > 0
      ? branches.filter((b) => facultyAssignedNormalized.has(normalizeBranchToken(b.branch_code)))
      : branches;

  const openAdd = () => {
    setEditing(null);
    setFormRoll('');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormBranch(branch || visibleBranches[0]?.branch_code || 'CSE');
    setFormAcademicYear('2026-27');
    setFormYearOfStudy('4');
    setFormSemester('7');
    setFormSection('A');
    setFormGradYear('2027');
    setFormCgpa('8.00');
    setFormBacklogs('0');
    setFormGender('Male');
    setFormAddress('');
    setFormResumeUrl('');
    setFormStatus('Unplaced');
    setFormErr('');
    setModalOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setFormRoll(s.roll_number);
    setFormName(s.full_name);
    setFormEmail(s.email);
    setFormPhone(s.phone);
    setFormBranch(s.branch);
    setFormAcademicYear(s.academic_year || '2026-27');
    setFormYearOfStudy(String(s.year_of_study ?? 4));
    setFormSemester(String(s.semester ?? 7));
    setFormSection(s.section || 'A');
    setFormGradYear(String(s.graduation_year));
    setFormCgpa(String(s.cgpa));
    setFormBacklogs(String(s.active_backlogs ?? 0));
    setFormGender(s.gender || 'Male');
    setFormAddress(s.address || '');
    setFormResumeUrl(s.resume_url || '');
    setFormStatus(s.placement_status);
    setFormErr('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    try {
      const selectedBranchObj = branches.find((b) => b.branch_code === formBranch);
      const payload = {
        rollNumber: formRoll,
        fullName: formName,
        email: formEmail,
        phone: formPhone,
        branchId: selectedBranchObj?.branch_id,
        branch: formBranch,
        academicYear: formAcademicYear,
        yearOfStudy: Number(formYearOfStudy),
        semester: Number(formSemester),
        section: formSection,
        graduationYear: Number(formGradYear),
        cgpa: Number(formCgpa),
        activeBacklogs: Number(formBacklogs) || 0,
        gender: formGender,
        address: formAddress,
        resumeUrl: formResumeUrl.trim() || null,
        placementStatus: formStatus,
      };
      if (editing) {
        await apiRequest(`/api/students/${editing.student_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated record for ${formName}.`);
      } else {
        await apiRequest('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Added ${formName} (${formBranch}) to directory.`);
      }
      setModalOpen(false);
      loadStudents();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Unable to save student');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    try {
      const res = await apiRequest<{ imported: number; skipped: number }>('/api/students/import', {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      });
      showToast(`Imported ${res.imported} student(s) (${res.skipped} skipped).`);
      setImportOpen(false);
      loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'CSV import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCsvText(reader.result);
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    const header = 'Roll Number,Full Name,Email,Phone,Branch,Academic Year,Semester,Section,Graduation Year,CGPA,Backlogs,Placement Status';
    const rows = students.map((s) =>
      [
        s.roll_number,
        `"${s.full_name}"`,
        s.email,
        `"${s.phone}"`,
        s.branch,
        s.academic_year || '2026-27',
        s.semester ?? 7,
        s.section || 'A',
        s.graduation_year,
        Number(s.cgpa).toFixed(2),
        s.active_backlogs ?? 0,
        s.placement_status,
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcet-students-${branch || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${students.length} student record(s) to CSV.`, 'info');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/students/${deleteTarget.student_id}`, { method: 'DELETE' });
      showToast(`Deleted ${deleteTarget.full_name} (${deleteTarget.roll_number}).`, 'info');
      setDeleteTarget(null);
      loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete student', 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Bar */}
      <div className={`${cardCls} p-4 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#172033] dark:text-white">
              {isFaculty ? `${user.departmentName || 'Department'} Student Directory` : 'College-Wide Student Directory'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFaculty
                ? `${students.length} assigned student record(s) across ${(user.assignedBranches || []).join(', ') || user.assignedBranch || 'your branches'}`
                : `${students.length} student record(s) across ${branches.length || 12} distinct GCET branches`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            {isStaff && (
              <>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import CSV</span>
                </button>
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Student</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, roll no, email..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.dept_id} value={d.dept_id}>
                {d.dept_code} — {d.dept_name}
              </option>
            ))}
          </select>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inputCls}>
            <option value="">{isFaculty ? 'All Assigned Branches' : 'All 12 Branches'}</option>
            {visibleBranches.map((b) => (
              <option key={b.branch_id} value={b.branch_code}>
                {b.branch_code} — {b.branch_name}
              </option>
            ))}
          </select>
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputCls}>
            <option value="">All Academic Years</option>
            <option value="2026-27">2026-27</option>
            <option value="2025-26">2025-26</option>
            <option value="2027-28">2027-28</option>
          </select>
          <select value={gradYear} onChange={(e) => setGradYear(e.target.value)} className={inputCls}>
            <option value="">All Graduation Batches</option>
            <option value="2026">2026 Batch</option>
            <option value="2027">2027 Batch</option>
            <option value="2028">2028 Batch</option>
            <option value="2029">2029 Batch</option>
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className={inputCls}>
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
          <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls}>
            <option value="">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
            <option value="D">Section D</option>
          </select>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={minCgpa}
            onChange={(e) => setMinCgpa(e.target.value)}
            placeholder="Min CGPA (e.g. 7.5)"
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">
              <tr>
                <th className="py-3 px-4 font-medium">Roll Number</th>
                <th className="py-3 px-4 font-medium">Student Name</th>
                <th className="py-3 px-4 font-medium">Branch · Sem · Sec</th>
                <th className="py-3 px-4 font-medium text-right">CGPA</th>
                <th className="py-3 px-4 font-medium text-right">Backlogs</th>
                <th className="py-3 px-4 font-medium text-right">Skills</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-[#172033] dark:text-slate-200">
                      {s.roll_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#172033] dark:text-white">{s.full_name}</p>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">{s.email} · {s.phone}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-[#172033] dark:text-white">{s.branch}</span> · Sem{' '}
                      <span className="font-mono">{s.semester ?? 7}</span> · Sec{' '}
                      <span className="font-mono">{s.section || 'A'}</span> ·{' '}
                      <span className="font-mono tabular-nums">{s.graduation_year}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#172033] dark:text-white">
                      {Number(s.cgpa).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.active_backlogs ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.skillCount ?? 0}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={s.placement_status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(s.student_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="View Complete Profile"
                        >
                          <UserRound className="w-3.5 h-3.5" />
                          <span>Profile</span>
                        </button>
                        {isStaff && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Student"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(s)}
                              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Delete Student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} title={editing ? `Edit Student — ${editing.roll_number}` : 'Add New Student'} onClose={() => setModalOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          {formErr && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{formErr}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Roll Number</label>
              <input required disabled={Boolean(editing)} value={formRoll} onChange={(e) => setFormRoll(e.target.value)} placeholder="23R11A05XX" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Full Name</label>
              <input required value={formName} onChange={(e) => setFormName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" required value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input required value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>GCET Branch</label>
              <select value={formBranch} onChange={(e) => setFormBranch(e.target.value)} className={inputCls}>
                {visibleBranches.map((b) => (
                  <option key={b.branch_id} value={b.branch_code}>
                    {b.branch_code} — {b.branch_name} ({b.degree_level})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Academic Year</label>
              <input required value={formAcademicYear} onChange={(e) => setFormAcademicYear(e.target.value)} placeholder="2026-27" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Year of Study</label>
              <select value={formYearOfStudy} onChange={(e) => setFormYearOfStudy(e.target.value)} className={inputCls}>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Semester & Section</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={formSemester} onChange={(e) => setFormSemester(e.target.value)} className={inputCls}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Sem {s}</option>
                  ))}
                </select>
                <select value={formSection} onChange={(e) => setFormSection(e.target.value)} className={inputCls}>
                  <option value="A">Sec A</option>
                  <option value="B">Sec B</option>
                  <option value="C">Sec C</option>
                  <option value="D">Sec D</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Graduation Year</label>
              <input type="number" required value={formGradYear} onChange={(e) => setFormGradYear(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CGPA (0.00 – 10.00)</label>
              <input type="number" step="0.01" min="0" max="10" required value={formCgpa} onChange={(e) => setFormCgpa(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Active Backlogs</label>
              <input type="number" min="0" max="20" required value={formBacklogs} onChange={(e) => setFormBacklogs(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Placement Status</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as Student['placement_status'])} className={inputCls}>
                <option value="Unplaced">Unplaced</option>
                <option value="In Process">In Process</option>
                <option value="Placed">Placed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select value={formGender} onChange={(e) => setFormGender(e.target.value)} className={inputCls}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Resume URL (Optional)</label>
              <input value={formResumeUrl} onChange={(e) => setFormResumeUrl(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700">
              {editing ? 'Update Student' : 'Create Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal open={importOpen} title="Bulk Student CSV Import" onClose={() => setImportOpen(false)} maxWidth="max-w-xl">
        <form onSubmit={handleImportCsv} className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 space-y-1">
            <p className="font-semibold text-[#172033] dark:text-white">Expected CSV Column Order</p>
            <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">
              roll_number,full_name,email,phone,branch,graduation_year,cgpa,semester,section,active_backlogs
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Valid branches: {visibleBranches.map((b) => b.branch_code).join(', ')}
            </p>
          </div>

          <div>
            <label className={labelCls}>Upload .CSV File (Optional)</label>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Or Paste CSV Rows</label>
            <textarea
              rows={6}
              required
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className={`${inputCls} font-mono text-[11px]`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={importing} className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700 disabled:opacity-50">
              {importing ? 'Importing...' : 'Import Students'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Student Record"
        message={`Are you sure you want to remove ${deleteTarget?.full_name} (${deleteTarget?.roll_number})? This deletes their skill matrix and application records.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
