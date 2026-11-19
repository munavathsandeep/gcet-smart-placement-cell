import { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../api';
import { AuthUser, Skill, Student, StudentSkill } from '../types';
import { ChartCanvas } from './ChartCanvas';
import { cardCls, inputCls, useToast } from './SharedUI';

interface SkillMatrixViewProps {
  user: AuthUser;
  isDark: boolean;
  selectedStudentId: number | null;
  onSelectStudentId: (id: number) => void;
}

export function SkillMatrixView({ user, isDark, selectedStudentId, onSelectStudentId }: SkillMatrixViewProps) {
  const isStaff = user.role !== 'STUDENT';
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [catalog, setCatalog] = useState<Skill[]>([]);
  const [studentSkills, setStudentSkills] = useState<StudentSkill[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [addSkillId, setAddSkillId] = useState<string>('');
  const [addLevel, setAddLevel] = useState<number>(4);
  const [addVerified, setAddVerified] = useState<boolean>(isStaff);

  const effectiveStudentId = user.role === 'STUDENT' && user.studentId ? user.studentId : selectedStudentId;

  useEffect(() => {
    apiRequest<Skill[]>('/api/skills')
      .then((list) => {
        setCatalog(list);
        if (list.length > 0) setAddSkillId(String(list[0].skill_id));
      })
      .catch(() => {});
    apiRequest<Student[]>('/api/students')
      .then((list) => {
        setStudents(list);
        if (!effectiveStudentId && list.length > 0) {
          onSelectStudentId(list[0].student_id);
        }
      })
      .catch(() => {});
  }, []);

  const loadStudentSkills = (id: number) => {
    apiRequest<StudentSkill[]>(`/api/skills?studentId=${id}`).then(setStudentSkills).catch(() => {});
  };

  useEffect(() => {
    if (effectiveStudentId) loadStudentSkills(effectiveStudentId);
  }, [effectiveStudentId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((s) => set.add(s.category));
    return ['ALL', ...Array.from(set)];
  }, [catalog]);

  const filteredCatalog = useMemo(
    () => (categoryFilter === 'ALL' ? catalog : catalog.filter((s) => s.category === categoryFilter)),
    [catalog, categoryFilter]
  );

  useEffect(() => {
    if (filteredCatalog.length > 0 && !filteredCatalog.some((c) => String(c.skill_id) === addSkillId)) {
      setAddSkillId(String(filteredCatalog[0].skill_id));
    }
  }, [filteredCatalog, addSkillId]);

  const filteredStudentSkills = useMemo(
    () => (categoryFilter === 'ALL' ? studentSkills : studentSkills.filter((s) => s.category === categoryFilter)),
    [studentSkills, categoryFilter]
  );

  const handleUpsert = async (skillId: number, proficiencyLevel: number, verified?: boolean) => {
    if (!effectiveStudentId) return;
    try {
      const updated = await apiRequest<StudentSkill[]>('/api/skills', {
        method: 'POST',
        body: JSON.stringify({
          studentId: effectiveStudentId,
          skillId,
          proficiencyLevel,
          verified: isStaff ? verified : undefined,
        }),
      });
      setStudentSkills(updated);
      showToast('Skill proficiency saved to database.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save skill.', 'error');
    }
  };

  const handleRemove = async (skillId: number) => {
    if (!effectiveStudentId) return;
    try {
      await apiRequest(`/api/skills?studentId=${effectiveStudentId}&skillId=${skillId}`, { method: 'DELETE' });
      showToast('Skill removed from student matrix.', 'info');
      loadStudentSkills(effectiveStudentId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove skill.', 'error');
    }
  };

  const radarConfig = useMemo(() => {
    const source = filteredStudentSkills.length > 0 ? filteredStudentSkills : filteredCatalog.slice(0, 6);
    const labels = source.map((s) => s.skill_name);
    const values =
      filteredStudentSkills.length > 0
        ? filteredStudentSkills.map((s) => s.proficiency_level)
        : labels.map(() => 0);
    return {
      type: 'radar' as const,
      data: {
        labels,
        datasets: [
          {
            label: 'Proficiency (1–5)',
            data: values,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(29, 78, 216, 0.18)',
            borderColor: isDark ? '#3B82F6' : '#246BFD',
            borderWidth: 2,
            pointBackgroundColor: isDark ? '#60A5FA' : '#246BFD',
          },
        ],
      },
    };
  }, [filteredStudentSkills, filteredCatalog, isDark]);

  const currentStudent = students.find((s) => s.student_id === effectiveStudentId);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#172033] dark:text-white">Competency & Skill Matrix</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              25 competencies across 6 categories (1 = Beginner, 5 = Expert) with staff verification support
            </p>
          </div>

          {user.role !== 'STUDENT' ? (
            <select
              value={effectiveStudentId ?? ''}
              onChange={(e) => onSelectStudentId(Number(e.target.value))}
              className={`${inputCls} max-w-xs`}
            >
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {s.roll_number} — {s.full_name} ({s.branch})
                </option>
              ))}
            </select>
          ) : (
            currentStudent && (
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                {currentStudent.roll_number} · {currentStudent.branch} · CGPA {Number(currentStudent.cgpa).toFixed(2)}
              </p>
            )
          )}
        </div>

        {/* 6 Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 rounded-lg w-fit">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-white dark:bg-[#18243A] text-[#172033] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'ALL' ? `All Categories (${catalog.length})` : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add / Update Skill Toolbar */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Select Competency</label>
            <select value={addSkillId} onChange={(e) => setAddSkillId(e.target.value)} className={inputCls}>
              {filteredCatalog.map((c) => (
                <option key={c.skill_id} value={c.skill_id}>
                  {c.skill_name} ({c.category})
                </option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Proficiency Level ({addLevel}/5)
            </label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 rounded-lg">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setAddLevel(lvl)}
                  className={`flex-1 py-1 text-xs font-mono font-medium rounded transition-colors ${
                    addLevel === lvl
                      ? 'bg-[#246BFD] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
          {isStaff && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addVerified}
                onChange={(e) => setAddVerified(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Mark Faculty Verified</span>
            </label>
          )}
          <button
            type="button"
            onClick={() => handleUpsert(Number(addSkillId), addLevel, addVerified)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Update Skill</span>
          </button>
        </div>
      </div>

      {/* Split: Skill Bars & Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${cardCls} p-5 lg:col-span-7 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#172033] dark:text-white">
              Recorded Skill Proficiencies ({filteredStudentSkills.length})
            </h3>
          </div>
          <div className="space-y-4">
            {filteredStudentSkills.map((sk) => (
              <div key={sk.skill_id} className="pb-3 border-b border-slate-100 dark:border-slate-700/70 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-sm font-semibold text-[#172033] dark:text-white">{sk.skill_name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                      · {sk.category}
                      {sk.verified ? ' · Verified' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStaff && sk.skill_id && (
                      <button
                        type="button"
                        onClick={() => handleUpsert(sk.skill_id!, sk.proficiency_level, !sk.verified)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                          sk.verified
                            ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-slate-200 dark:border-slate-700/70 text-slate-500 hover:text-blue-600'
                        }`}
                        title="Toggle Verification Status"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{sk.verified ? 'Verified' : 'Verify'}</span>
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => sk.skill_id && handleUpsert(sk.skill_id, lvl, Boolean(sk.verified))}
                          className={`w-6 h-6 text-[11px] font-mono rounded transition-colors ${
                            sk.proficiency_level === lvl
                              ? 'bg-[#246BFD] text-white font-semibold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-mono tabular-nums font-medium text-slate-700 dark:text-slate-200 w-8 text-right">
                      {sk.proficiency_level}/5
                    </span>
                    {sk.skill_id && (
                      <button
                        type="button"
                        onClick={() => handleRemove(sk.skill_id!)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="Remove skill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#246BFD] dark:bg-blue-500 rounded-full transition-all duration-200"
                    style={{ width: `${(sk.proficiency_level / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {filteredStudentSkills.length === 0 && (
              <p className="text-xs text-slate-500 py-8 text-center">
                No skills recorded in this category yet. Use the selector above to add competencies.
              </p>
            )}
          </div>
        </div>

        <div className={`${cardCls} p-5 lg:col-span-5 flex flex-col`}>
          <h3 className="text-sm font-semibold text-[#172033] dark:text-white mb-1">Competency Radar Profile</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Visual balance across technical and interpersonal domains</p>
          <div className="flex-1 flex items-center">
            <ChartCanvas config={radarConfig} height={310} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  );
}
