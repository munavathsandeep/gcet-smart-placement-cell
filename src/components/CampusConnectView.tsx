import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  Cpu,
  ExternalLink,
  GraduationCap,
  RefreshCw,
  Search,
  Trophy,
  Award,
} from 'lucide-react';
import { apiRequest } from '../api';
import { Announcement, AuthUser, ModuleId } from '../types';
import { cardCls, inputCls, StatusText, useToast } from './SharedUI';

interface CampusConnectViewProps {
  user: AuthUser;
  onNavigate: (module: ModuleId) => void;
}

const HUB_CHANNELS = [
  {
    id: 'ALL',
    label: 'All Campus Feeds',
    icon: Bell,
    categories: [] as string[],
  },
  {
    id: 'college',
    label: 'College & Placement',
    icon: GraduationCap,
    categories: ['College Announcements', 'Placement Notifications', 'Internship Opportunities', 'Job Notifications', 'Important Student Notices'],
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: BookOpen,
    categories: ['Department Notifications'],
  },
  {
    id: 'academics',
    label: 'Academic & Exams',
    icon: Calendar,
    categories: ['Examination Notifications', 'Academic Circulars', 'Internal Assessment Notifications', 'Semester Examination Timetables', 'Results Notifications'],
  },
  {
    id: 'events',
    label: 'Tech Events & Hackathons',
    icon: Cpu,
    categories: ['Workshop Announcements', 'Technical Events', 'Hackathons', 'Seminars and Guest Lectures', 'Competition Announcements'],
  },
  {
    id: 'scholarships',
    label: 'Scholarships & Govt',
    icon: Award,
    categories: ['Scholarships', 'Government Notifications'],
  },
];

export function CampusConnectView({ user, onNavigate }: CampusConnectViewProps) {
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [channel, setChannel] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(user.assignedBranch || 'ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const list = await apiRequest<Announcement[]>('/api/announcements');
      setAnnouncements(list);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to load Campus Connect feed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const isStaff = user.role !== 'STUDENT' && user.role !== 'RECRUITER';

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiRequest<{ totalImported: number }>('/api/announcements/sync', { method: 'POST', body: JSON.stringify({}) });
      showToast(`Official feeds synced (${res.totalImported} new notices imported).`);
      loadFeed();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Feed sync failed.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    const activeChannel = HUB_CHANNELS.find((c) => c.id === channel);
    return announcements.filter((a) => {
      if (activeChannel && activeChannel.categories.length > 0 && !activeChannel.categories.includes(a.category_name)) {
        return false;
      }
      if (branchFilter !== 'ALL') {
        const branches = (a.relevant_branches || 'ALL').toUpperCase();
        const dept = (a.department_code || '').toUpperCase();
        if (branches !== 'ALL' && !branches.includes(branchFilter.toUpperCase()) && dept !== branchFilter.toUpperCase()) {
          return false;
        }
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.source_name.toLowerCase().includes(q) ||
          a.category_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [announcements, channel, branchFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${cardCls} p-6 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">
            GCET Campus Connect Portal
          </p>
          <h2 className="text-xl font-bold text-[#101A35] dark:text-white mt-1">
            Official College Circulars, Exams, Events &amp; Scholarships
          </h2>
          <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
            Direct verified announcements across all 12 GCET departments, JNTU Hyderabad examination portals, workshops, hackathons, and student scholarships.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="https://gcet.edu.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#172B50] transition-colors"
          >
            <span>GCET Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {isStaff && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Official Feeds...' : 'Sync Official Feeds'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('announcements')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#101A35] dark:bg-[#172B50] text-white hover:opacity-95 transition-opacity"
          >
            <Trophy className="w-3.5 h-3.5 text-[#20C5E8]" />
            <span>Manage Announcements</span>
          </button>
        </div>
      </div>

      {/* Category Channel Tabs + Search & Branch Filter */}
      <div className={`${cardCls} p-4 space-y-4`}>
        <div className="flex flex-wrap gap-2">
          {HUB_CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const active = channel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? 'bg-[#246BFD] border-[#246BFD] text-white'
                    : 'bg-white dark:bg-[#101827] border-slate-200 dark:border-slate-700 text-[#718096] dark:text-slate-300 hover:border-[#246BFD]/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements, exam circulars, hackathons, scholarships..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={inputCls}>
            <option value="ALL">All GCET Departments</option>
            {['CSE', 'CSE-AIML', 'CSE-DS', 'CSE-CS', 'CSE-IoT', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'MBA', 'M.Tech CSE'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notices Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${cardCls} h-40 bg-slate-100 dark:bg-slate-800/40`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} p-10 text-center text-sm text-[#718096] dark:text-slate-400`}>
          No Campus Connect notices match your current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((a) => (
            <div key={a.announcement_id} className={`${cardCls} p-5 flex flex-col justify-between gap-4`}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#246BFD]">{a.category_name}</span>
                  <div className="flex items-center gap-2">
                    <StatusText status={a.is_verified_source ? 'Verified Source Sync' : a.priority} />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-[#172033] dark:text-white leading-snug">{a.title}</h3>
                <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">{a.description}</p>
                <p className="text-[11px] text-[#718096] dark:text-slate-400 font-mono">
                  Published: {a.published_date} · Branches: {a.relevant_branches}
                  {a.deadline_date ? ` · Deadline: ${a.deadline_date}` : ''}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/70 text-xs">
                <span className="text-[#718096] dark:text-slate-400 truncate">Source: {a.source_name}</span>
                <a
                  href={a.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#246BFD] hover:underline shrink-0"
                >
                  <span>Read Full Notification</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
