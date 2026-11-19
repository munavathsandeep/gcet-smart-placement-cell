import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ExternalLink, MailOpen, Search } from 'lucide-react';
import { apiRequest } from '../api';
import { ModuleId, NotificationItem } from '../types';
import { cardCls, inputCls, useToast } from './SharedUI';

interface NotificationsViewProps {
  onNavigate: (module: ModuleId) => void;
  onSyncUnreadCount: () => void;
}

export function NotificationsView({ onNavigate, onSyncUnreadCount }: NotificationsViewProps) {
  const { showToast } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications');
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to load notifications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const toggleRead = async (n: NotificationItem) => {
    const nextIsRead = !n.is_read;
    try {
      await apiRequest(`/api/notifications/${n.notification_id}/read`, {
        method: 'PUT',
        body: JSON.stringify({ isRead: nextIsRead }),
      });
      await loadNotifications();
      onSyncUnreadCount();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update status.', 'error');
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'PUT' });
      showToast('All notifications marked as read.');
      await loadNotifications();
      onSyncUnreadCount();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to mark notifications.', 'error');
    }
  };

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filterMode === 'unread' && n.is_read) return false;
      if (categoryFilter !== 'ALL' && n.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, filterMode, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Alerts &amp; Activity</p>
          <h2 className="text-xl font-bold text-[#101A35] dark:text-white mt-1">
            Notification History ({unreadCount} Unread)
          </h2>
          <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
            Real-time placement alerts, interview schedules, verification updates, and institutional circulars.
          </p>
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filters */}
      <div className={`${cardCls} p-4 grid grid-cols-1 md:grid-cols-4 gap-3`}>
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notification title or message..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F4F7FB] dark:bg-[#101827] border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`text-xs font-medium rounded-md py-1.5 ${
              filterMode === 'all' ? 'bg-white dark:bg-[#172B50] text-[#101A35] dark:text-white shadow-sm' : 'text-[#718096]'
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unread')}
            className={`text-xs font-medium rounded-md py-1.5 ${
              filterMode === 'unread' ? 'bg-white dark:bg-[#172B50] text-[#101A35] dark:text-white shadow-sm' : 'text-[#718096]'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      <div className={`${cardCls} divide-y divide-slate-200 dark:divide-slate-700/70`}>
        {loading ? (
          <div className="p-8 text-center text-sm text-[#718096]">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#718096] dark:text-slate-400">
            No notifications match your selection.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.notification_id}
              className={`p-5 flex flex-wrap items-start justify-between gap-4 ${
                !n.is_read ? 'bg-[#246BFD]/[0.04] dark:bg-[#246BFD]/[0.08]' : ''
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg bg-[#F4F7FB] dark:bg-[#101827] border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className={`w-4 h-4 ${!n.is_read ? 'text-[#246BFD]' : 'text-[#718096]'}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#246BFD]">{n.category}</span>
                    <span className="text-[#718096] dark:text-slate-400 font-mono">
                      {String(n.created_at).slice(0, 16)}
                    </span>
                    {!n.is_read && <span className="text-[11px] font-semibold text-[#246BFD]">· Unread</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-[#172033] dark:text-white mt-1">{n.title}</h3>
                  <p className="text-xs text-[#718096] dark:text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.related_module && (
                  <button
                    type="button"
                    onClick={() => onNavigate(n.related_module as ModuleId)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:border-[#246BFD]"
                  >
                    Open Module
                  </button>
                )}
                {n.link_url && (
                  <a
                    href={n.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#246BFD]/30 text-[#246BFD] hover:bg-[#246BFD]/10"
                  >
                    <span>Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => toggleRead(n)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-[#718096] dark:text-slate-300 hover:text-[#172033] dark:hover:text-white"
                >
                  <MailOpen className="w-3.5 h-3.5" />
                  <span>{n.is_read ? 'Mark Unread' : 'Mark Read'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
