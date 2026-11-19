import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Plus,
  Pin,
  Archive,
  Search,
  Globe,
  Paperclip,
  CalendarClock,
  Settings2,
  CheckCircle2,
  MailOpen,
  AlertTriangle,
  Clock3,
} from 'lucide-react';
import { apiRequest } from '../api';
import {
  Announcement,
  AnnouncementCategory,
  AnnouncementSource,
  AnnouncementSyncStatus,
  AuthUser,
  Branch,
  isFacultyRole,
  isPlacementAdminRole,
} from '../types';
import { cardCls, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

function normalizeBranchToken(token?: string | null): string {
  const upper = String(token || '').trim().toUpperCase();
  if (upper === 'CSE-IOT') return 'IOT';
  if (upper === 'CSE-CS') return 'CS';
  if (upper === 'ME') return 'MECH';
  if (upper === 'CE') return 'CIVIL';
  return upper;
}

interface AnnouncementsViewProps {
  user: AuthUser;
  departmentMode?: boolean;
}

export function AnnouncementsView({ user, departmentMode = false }: AnnouncementsViewProps) {
  const isStaff = user.role !== 'STUDENT' && user.role !== 'RECRUITER';
  const isFaculty = isFacultyRole(user.role);
  const isAdminOrTpo = isPlacementAdminRole(user.role);
  const facultyAssignedBranches =
    user.assignedBranches && user.assignedBranches.length > 0
      ? user.assignedBranches
      : (user.assignedBranch || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  const facultyAssignedSet = new Set(facultyAssignedBranches.map((b) => normalizeBranchToken(b)));
  const { showToast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<AnnouncementCategory[]>([]);
  const [sources, setSources] = useState<AnnouncementSource[]>([]);
  const [syncHealth, setSyncHealth] = useState<AnnouncementSyncStatus | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [readIds, setReadIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(`gcet_read_notices_${user.userId}`);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  });

  const toggleNoticeRead = (id: number) => {
    setReadIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(`gcet_read_notices_${user.userId}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Filters
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [priority, setPriority] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeBranchTab, setActiveBranchTab] = useState<string>('ALL');

  // Publish Modal
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubCatId, setPubCatId] = useState('14');
  const [pubUrl, setPubUrl] = useState('https://gcet.edu.in/');
  const [pubDesc, setPubDesc] = useState('');
  const [pubBranches, setPubBranches] = useState(
    isFaculty && facultyAssignedBranches.length > 0 ? facultyAssignedBranches.join(', ') : 'ALL'
  );
  const [pubDeptCode, setPubDeptCode] = useState(
    isFaculty && facultyAssignedBranches.length > 0 ? facultyAssignedBranches[0] : ''
  );
  const [pubDeadline, setPubDeadline] = useState('');
  const [pubAttachment, setPubAttachment] = useState('');
  const [pubPriority, setPubPriority] = useState<'Normal' | 'Important' | 'Urgent'>('Important');
  const [pubPinned, setPubPinned] = useState(false);

  // Sources Manager Modal
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [newSrcName, setNewSrcName] = useState('');
  const [newSrcUrl, setNewSrcUrl] = useState('');
  const [newSrcFeed, setNewSrcFeed] = useState('');
  const [newSrcMode, setNewSrcMode] = useState<'HTML' | 'RSS'>('HTML');

  const loadMeta = () => {
    apiRequest<AnnouncementCategory[]>('/api/announcements/categories').then(setCategories).catch(() => {});
    apiRequest<AnnouncementSource[]>('/api/announcements/sources').then(setSources).catch(() => {});
    apiRequest<AnnouncementSyncStatus>('/api/announcements/sync-status').then(setSyncHealth).catch(() => {});
    apiRequest<Branch[]>('/api/branches').then(setBranches).catch(() => {});
  };

  const loadAnnouncements = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (categoryId) params.set('categoryId', categoryId);
    if (sourceId) params.set('sourceId', sourceId);
    if (priority) params.set('priority', priority);
    if (academicYear) params.set('academicYear', academicYear);
    if (pinnedOnly) params.set('pinnedOnly', 'true');
    if (showArchived) params.set('archived', 'true');
    if (activeBranchTab && activeBranchTab !== 'ALL') {
      if (departmentMode) params.set('departmentCode', activeBranchTab);
      else params.set('branch', activeBranchTab);
    }

    apiRequest<Announcement[]>(`/api/announcements?${params.toString()}`)
      .then(setAnnouncements)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const visibleBranches =
    isFaculty && facultyAssignedSet.size > 0
      ? branches.filter((b) => facultyAssignedSet.has(normalizeBranchToken(b.branch_code)))
      : branches;

  useEffect(() => {
    if (isFaculty) {
      setActiveBranchTab('ALL');
      setPubBranches(facultyAssignedBranches.join(', ') || 'CSE');
      setPubDeptCode(visibleBranches[0]?.branch_code || facultyAssignedBranches[0] || '');
    } else if (!departmentMode) {
      setActiveBranchTab('ALL');
    }
  }, [departmentMode, user.userId, branches.length]);

  useEffect(() => {
    const t = setTimeout(loadAnnouncements, 120);
    return () => clearTimeout(t);
  }, [q, categoryId, sourceId, priority, academicYear, pinnedOnly, showArchived, activeBranchTab, departmentMode]);

  const handleManualSync = async (targetSourceId?: number) => {
    setSyncing(true);
    try {
      const res = await apiRequest<{ totalInserted: number; results: { sourceName: string; status: string }[] }>(
        '/api/announcements/sync',
        { method: 'POST', body: JSON.stringify(targetSourceId ? { sourceId: targetSourceId } : {}) }
      );
      showToast(
        `Official sync complete: ${res.totalInserted} new circular${res.totalInserted === 1 ? '' : 's'} added.`,
        'success'
      );
      loadMeta();
      loadAnnouncements();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: pubTitle,
          categoryId: Number(pubCatId),
          sourceUrl: pubUrl,
          description: pubDesc,
          relevantBranches: pubBranches || 'ALL',
          departmentCode: pubDeptCode || null,
          deadlineDate: pubDeadline || null,
          attachmentUrl: pubAttachment || null,
          priority: pubPriority,
          isPinned: pubPinned,
        }),
      });
      setPublishOpen(false);
      setPubTitle('');
      setPubDesc('');
      setPubDeadline('');
      setPubAttachment('');
      showToast('Admin Verified Notice published successfully.');
      loadAnnouncements();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish notice', 'error');
    }
  };

  const togglePin = async (a: Announcement) => {
    await apiRequest(`/api/announcements/${a.announcement_id}`, {
      method: 'PUT',
      body: JSON.stringify({ isPinned: !a.is_pinned }),
    });
    showToast(a.is_pinned ? 'Notice unpinned.' : 'Notice pinned to top.');
    loadAnnouncements();
  };

  const toggleArchive = async (a: Announcement) => {
    await apiRequest(`/api/announcements/${a.announcement_id}`, {
      method: 'PUT',
      body: JSON.stringify({ isArchived: !a.is_archived }),
    });
    showToast(a.is_archived ? 'Notice restored.' : 'Notice archived.');
    loadAnnouncements();
  };

  const handleToggleSource = async (src: AnnouncementSource) => {
    await apiRequest(`/api/announcements/sources/${src.source_id}`, {
      method: 'PUT',
      body: JSON.stringify({ isEnabled: !src.is_enabled }),
    });
    showToast(`${src.source_name} ${src.is_enabled ? 'disabled' : 'enabled'}.`);
    loadMeta();
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/announcements/sources', {
        method: 'POST',
        body: JSON.stringify({
          sourceName: newSrcName,
          baseUrl: newSrcUrl,
          feedUrl: newSrcFeed || newSrcUrl,
          syncMode: newSrcMode,
        }),
      });
      setNewSrcName('');
      setNewSrcUrl('');
      setNewSrcFeed('');
      showToast('Official announcement source registered.');
      loadMeta();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add source', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F2140] dark:text-white">
              {isFaculty
                ? `${user.departmentName || 'Department'} Announcements & Circulars`
                : departmentMode
                ? 'Department-Wise Announcements & Circulars'
                : 'Official Announcements & Notification Center'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFaculty
                ? `Scoped notices for your assigned branches: ${facultyAssignedBranches.join(', ') || user.assignedBranch || 'Department'}`
                : departmentMode
                ? 'Dedicated feeds across all 12 GCET branches and specializations with direct official links'
                : 'Verified circulars synchronized from gcet.edu.in, gcetece.org, blog.gcet.edu.in, geethanjaliinstitutions.com & jntuh.ac.in'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAdminOrTpo && (
              <button
                type="button"
                onClick={() => setSourcesOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#243552] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16233B] whitespace-nowrap"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Manage Sources ({sources.length})</span>
              </button>
            )}
            {isStaff && (
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleManualSync()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#243552] text-[#0F2140] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#16233B] disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing Sources...' : 'Sync Official Sources'}</span>
              </button>
            )}
            {isStaff && (
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Verified Notice</span>
              </button>
            )}
          </div>
        </div>

        {/* Official Sync Health & Fallback Status Strip */}
        {syncHealth && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0A1120] border border-slate-200 dark:border-[#1E2D45] text-[11px] text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Clock3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Last Verified Sync:{' '}
                  <strong className="font-mono text-[#0F2140] dark:text-white">
                    {syncHealth.lastSuccessfulSync || 'Seeded Baseline'}
                  </strong>
                </span>
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400">
                Auto-Sync Interval: Every {syncHealth.syncIntervalMinutes} mins · Cached Database Active
              </span>
            </div>

            {syncHealth.hasUnreachableSources && (
              <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Source Reachability Notice:</strong>{' '}
                  {syncHealth.unreachableSources.map((s) => s.source_name).join(', ')} could not be reached on the last check. Cached database circulars remain available, and staff can publish manual verified circulars at any time.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Dedicated Branch Tabs in Department Mode (or compact Branch filter in main mode) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveBranchTab('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeBranchTab === 'ALL'
                ? 'bg-[#246BFD] text-white'
                : 'bg-slate-100 dark:bg-[#101827] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#172B50]'
            }`}
          >
            {isFaculty ? 'All Assigned Branches' : 'All Departments'}
          </button>
          {visibleBranches.map((b) => (
            <button
              key={b.branch_code}
              type="button"
              onClick={() => setActiveBranchTab(b.branch_code)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeBranchTab === b.branch_code
                  ? 'bg-[#246BFD] text-white'
                  : 'bg-slate-100 dark:bg-[#101827] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#172B50]'
              }`}
            >
              {b.branch_code}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notices, keywords..."
              className={`${inputCls} pl-9`}
            />
          </div>

          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">All 18 Categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </select>

          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputCls}>
            <option value="">All Official Sources</option>
            {sources.map((s) => (
              <option key={s.source_id} value={s.source_id}>
                {s.source_name}
              </option>
            ))}
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
            <option value="">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="Important">Important</option>
            <option value="Normal">Normal</option>
          </select>

          <div className="flex items-center gap-3 px-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={pinnedOnly}
                onChange={(e) => setPinnedOnly(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
              />
              <span>Pinned</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
              />
              <span>Archived</span>
            </label>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${cardCls} h-32 bg-slate-100 dark:bg-slate-800/50`} />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className={`${cardCls} p-10 text-center space-y-2`}>
          <p className="text-sm font-medium text-[#0F2140] dark:text-white">No announcements match the selected filters</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try switching to &ldquo;All Departments&rdquo; or clearing the category/search filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.filter((x) => x.deadline_date).length > 0 && (
            <div className={`${cardCls} px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800`}>
              <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4" />
                <span>Deadline Reminders:</span>
              </span>
              <span className="text-amber-900 dark:text-amber-200">
                {announcements
                  .filter((x) => x.deadline_date)
                  .slice(0, 2)
                  .map((x) => `${x.title} (Due ${x.deadline_date})`)
                  .join(' · ')}
              </span>
            </div>
          )}

          {announcements.map((a) => {
            const isNoticeRead = readIds.includes(a.announcement_id);
            return (
              <article key={a.announcement_id} className={`${cardCls} p-5 space-y-3 ${!isNoticeRead ? 'ring-1 ring-[#246BFD]/25' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {!isNoticeRead && (
                        <>
                          <span className="font-semibold text-[#246BFD]">Unread</span>
                          <span>·</span>
                        </>
                      )}
                      {Boolean(a.is_pinned) && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#246BFD]">
                          <Pin className="w-3 h-3" /> Pinned
                        </span>
                      )}
                      {Boolean(a.is_pinned) && <span>·</span>}
                      <span className="font-semibold text-[#172033] dark:text-slate-200">{a.category_name}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{a.published_date}</span>
                      <span>·</span>
                      <span>Branches: {a.relevant_branches}</span>
                      {a.department_code && (
                        <>
                          <span>·</span>
                          <span className="font-mono font-medium">{a.department_code}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[#172033] dark:text-white leading-snug">
                      {a.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusText status={a.is_verified_source ? 'Verified Source Sync' : 'Admin Verified Notice'} />
                    {a.priority !== 'Normal' && <StatusText status={a.priority} />}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{a.description}</p>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Source: {a.source_name}</span>
                    </span>
                    {a.deadline_date && (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span className="font-mono">Deadline: {a.deadline_date}</span>
                      </span>
                    )}
                    {Boolean(a.has_attachment) && a.attachment_url && (
                      <a
                        href={a.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#246BFD] hover:underline font-medium"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Direct PDF / Attachment</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleNoticeRead(a.announcement_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#246BFD]"
                    >
                      {isNoticeRead ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <MailOpen className="w-3.5 h-3.5 text-[#246BFD]" />}
                      <span>{isNoticeRead ? 'Read' : 'Mark Read'}</span>
                    </button>
                    {isStaff && (
                      <>
                        <button
                          type="button"
                          onClick={() => togglePin(a)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#246BFD]"
                          title={a.is_pinned ? 'Unpin' : 'Pin Notice'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArchive(a)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600"
                          title={a.is_archived ? 'Restore' : 'Archive'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <a
                      href={a.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => { if (!isNoticeRead) toggleNoticeRead(a.announcement_id); }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
                    >
                      <span>Read Full Notification</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Publish Admin Verified Notice Modal */}
      <Modal open={publishOpen} title="Publish Admin Verified Notice" onClose={() => setPublishOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={handlePublish} className="space-y-3.5">
          <div>
            <label className={labelCls}>Announcement Title</label>
            <input required value={pubTitle} onChange={(e) => setPubTitle(e.target.value)} placeholder="e.g., CSE Semester VII Mid-Term Examination Circular" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Category (18 Official Categories)</label>
              <select value={pubCatId} onChange={(e) => setPubCatId(e.target.value)} className={inputCls}>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={pubPriority} onChange={(e) => setPubPriority(e.target.value as 'Normal' | 'Important' | 'Urgent')} className={inputCls}>
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Target Department Code {isFaculty ? '(Assigned Scope)' : '(Optional)'}</label>
              <select value={pubDeptCode} onChange={(e) => setPubDeptCode(e.target.value)} className={inputCls}>
                {!isFaculty && <option value="">College-Wide (All Departments)</option>}
                {visibleBranches.map((b) => (
                  <option key={b.branch_code} value={b.branch_code}>
                    {b.branch_code} — {b.branch_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Relevant Branches (Comma Separated or ALL)</label>
              <input value={pubBranches} onChange={(e) => setPubBranches(e.target.value)} placeholder="ALL or CSE,CSE-AIML,ECE" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Official Notification URL</label>
              <input type="url" required value={pubUrl} onChange={(e) => setPubUrl(e.target.value)} placeholder="https://gcet.edu.in/..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Deadline Date (Optional)</label>
              <input type="date" value={pubDeadline} onChange={(e) => setPubDeadline(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>PDF / Attachment Link (Optional)</label>
            <input type="url" value={pubAttachment} onChange={(e) => setPubAttachment(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Detailed Description</label>
            <textarea required rows={3} value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} className={inputCls} />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={pubPinned} onChange={(e) => setPubPinned(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
            <span>Pin this notice to the top of the portal feed</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPublishOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1D4ED8] text-white">Publish Notice</button>
          </div>
        </form>
      </Modal>

      {/* Official Sources Manager Modal */}
      <Modal open={sourcesOpen} title="Official Announcement Sources & Sync Status" onClose={() => setSourcesOpen(false)} maxWidth="max-w-3xl">
        <div className="space-y-5">
          <div className="divide-y divide-slate-100 dark:divide-[#1E2D45]">
            {sources.map((s) => (
              <div key={s.source_id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="min-w-[240px] flex-1">
                  <p className="font-semibold text-[#0F2140] dark:text-white">
                    {s.source_name} <span className="font-mono text-slate-400">({s.sync_mode})</span>
                  </p>
                  <p className="text-blue-700 dark:text-blue-400 font-mono truncate">{s.base_url}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {s.last_sync_status || 'Ready for synchronization'}
                    {s.last_synced_at ? ` · Last synced: ${s.last_synced_at}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleManualSync(s.source_id)}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-[#1E2D45] hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  >
                    Sync Now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSource(s)}
                    className={`px-2.5 py-1.5 rounded-md font-medium ${
                      s.is_enabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {s.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSource} className="pt-4 border-t border-slate-200 dark:border-[#1E2D45] space-y-3">
            <h4 className="text-xs font-semibold text-[#0F2140] dark:text-white">Add New Official Website or RSS Feed</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required value={newSrcName} onChange={(e) => setNewSrcName(e.target.value)} placeholder="Source Name (e.g. AICTE Portal)" className={inputCls} />
              <select value={newSrcMode} onChange={(e) => setNewSrcMode(e.target.value as 'HTML' | 'RSS')} className={inputCls}>
                <option value="HTML">HTML Link Scraper</option>
                <option value="RSS">RSS / Atom Feed</option>
              </select>
              <input type="url" required value={newSrcUrl} onChange={(e) => setNewSrcUrl(e.target.value)} placeholder="Base Website URL (https://...)" className={inputCls} />
              <input type="url" value={newSrcFeed} onChange={(e) => setNewSrcFeed(e.target.value)} placeholder="Optional Feed URL (https://...)" className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1D4ED8] text-white">Add Source</button>
            </div>
          </form>

          {syncHealth && syncHealth.recentLogs.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-[#1E2D45] space-y-2">
              <h4 className="text-xs font-semibold text-[#0F2140] dark:text-white">Recent Synchronization History (announcement_sync_logs)</h4>
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1E2D45] text-[11px] rounded-lg border border-slate-200 dark:border-[#1E2D45]">
                {syncHealth.recentLogs.slice(0, 10).map((log) => (
                  <div key={log.log_id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-[180px] flex-1">
                      <span className="font-semibold text-[#0F2140] dark:text-white">{log.source_name}</span>
                      <span className="text-slate-500 dark:text-slate-400"> — {log.message}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <StatusText status={log.sync_status === 'SUCCESS' ? 'Verified' : log.sync_status === 'WARNING' ? 'Pending' : 'Failed'} />
                      <span className="text-slate-400">{log.synced_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
