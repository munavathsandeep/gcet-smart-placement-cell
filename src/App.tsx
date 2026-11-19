import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Building,
  Users,
  UserCircle,
  SlidersHorizontal,
  Building2,
  Briefcase,
  GitBranch,
  ShieldCheck,
  GitCompare,
  Sparkles,
  FileCheck2,
  Award,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  CheckCheck,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  Database,
  ClipboardCheck,
  Compass,
  UserCog,
  UserCheck,
} from 'lucide-react';
import { apiRequest, clearAuthToken, clearLegacyPasswordStorage, onUnauthorized, updateStoredAuthToken } from './api';
import {
  AuthUser,
  formatRoleLabel,
  GlobalSearchResult,
  isExecutiveRole,
  isFacultyRole,
  isPlacementAdminRole,
  isSystemAdminRole,
  ModuleId,
  NotificationItem,
  UserRole,
} from './types';

function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'PRINCIPAL':
      return '/principal/dashboard';
    case 'VICE_CHAIRMAN':
      return '/vice-chairman/dashboard';
    case 'CHAIRMAN':
      return '/chairman/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'PLACEMENT_OFFICER':
      return '/placement-officer/dashboard';
    case 'FACULTY_COORDINATOR':
      return '/faculty-coordinator/dashboard';
    case 'FACULTY':
      return '/faculty/dashboard';
    case 'RECRUITER':
      return '/recruiter/dashboard';
    case 'STUDENT':
    default:
      return '/student/dashboard';
  }
}

const PROTECTED_ROLE_PREFIXES = [
  '/principal',
  '/vice-chairman',
  '/chairman',
  '/executive',
  '/admin',
  '/placement-officer',
  '/faculty-coordinator',
  '/faculty',
  '/student',
  '/recruiter',
];
import { inputCls, labelCls, Modal, ToastProvider, useToast } from './components/SharedUI';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { DashboardView } from './components/DashboardView';
import { CampusConnectView } from './components/CampusConnectView';
import { ApprovalCenterView } from './components/ApprovalCenterView';
import { FacultyProfileApprovalsView } from './components/FacultyProfileApprovalsView';
import { UserManagementView } from './components/UserManagementView';
import { NotificationsView } from './components/NotificationsView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { BranchesView } from './components/BranchesView';
import { StudentsView } from './components/StudentsView';
import { StudentProfileView } from './components/StudentProfileView';
import { FacultyProfileView } from './components/FacultyProfileView';
import { SkillMatrixView } from './components/SkillMatrixView';
import { CompaniesView } from './components/CompaniesView';
import { DrivesView } from './components/DrivesView';
import { EligibilityView, SkillGapView, MatchingView } from './components/IntelligenceViews';
import { ApplicationsView, PlacementsView, ReportsView, SettingsView } from './components/OperationsViews';

const THEME_STORAGE_KEY = 'gcet_spc_theme';

interface NavItem {
  id: ModuleId;
  label: string;
  icon: typeof LayoutDashboard;
  visibility: 'all' | 'admin-tpo' | 'system-admin' | 'non-recruiter-staff' | 'student-only' | 'non-recruiter';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visibility: 'all' },
  { id: 'campus-connect', label: 'Campus Connect', icon: Compass, visibility: 'all' },
  { id: 'approvals', label: 'Approval Center', icon: ClipboardCheck, visibility: 'admin-tpo' },
  { id: 'profile-approvals', label: 'Student Profile Approvals', icon: UserCheck, visibility: 'non-recruiter-staff' },
  { id: 'user-management', label: 'User & Faculty Accounts', icon: UserCog, visibility: 'system-admin' },
  { id: 'students', label: 'Student Management', icon: Users, visibility: 'non-recruiter-staff' },
  { id: 'profile', label: 'My Profile', icon: UserCircle, visibility: 'student-only' },
  { id: 'skill-matrix', label: 'Skill Matrix', icon: SlidersHorizontal, visibility: 'non-recruiter' },
  { id: 'companies', label: 'Company Directory', icon: Building2, visibility: 'all' },
  { id: 'drives', label: 'Jobs & Drives', icon: Briefcase, visibility: 'all' },
  { id: 'eligibility', label: 'Eligibility Checker', icon: ShieldCheck, visibility: 'non-recruiter' },
  { id: 'skill-gap', label: 'Skill Gap Analysis', icon: GitCompare, visibility: 'non-recruiter' },
  { id: 'matching', label: 'Company Matching', icon: Sparkles, visibility: 'non-recruiter' },
  { id: 'applications', label: 'Applications', icon: FileCheck2, visibility: 'all' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, visibility: 'all' },
  { id: 'department-notices', label: 'Department Notices', icon: Building, visibility: 'non-recruiter' },
  { id: 'notifications', label: 'Notifications', icon: Bell, visibility: 'all' },
  { id: 'branches', label: 'Branches & Depts', icon: GitBranch, visibility: 'non-recruiter' },
  { id: 'placements', label: 'Placement Tracking', icon: Award, visibility: 'non-recruiter' },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, visibility: 'non-recruiter' },
  { id: 'settings', label: 'Settings', icon: Settings, visibility: 'all' },
];

const FACULTY_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visibility: 'all' },
  { id: 'faculty-profile', label: 'My Profile & Skills', icon: UserCircle, visibility: 'non-recruiter-staff' },
  { id: 'students', label: 'Assigned Students', icon: Users, visibility: 'non-recruiter-staff' },
  { id: 'profile', label: 'Student Profiles', icon: UserCircle, visibility: 'non-recruiter-staff' },
  { id: 'profile-approvals', label: 'Profile Approvals', icon: UserCheck, visibility: 'non-recruiter-staff' },
  { id: 'skill-matrix', label: 'Skill Matrix', icon: SlidersHorizontal, visibility: 'non-recruiter' },
  { id: 'reports', label: 'Department Reports', icon: BarChart3, visibility: 'non-recruiter' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, visibility: 'all' },
  { id: 'notifications', label: 'Notifications', icon: Bell, visibility: 'all' },
  { id: 'settings', label: 'My Account', icon: Settings, visibility: 'all' },
];

function isNavVisibleForRole(item: NavItem, role: UserRole): boolean {
  switch (item.visibility) {
    case 'all':
      return true;
    case 'admin-tpo':
      return isPlacementAdminRole(role);
    case 'system-admin':
      return isSystemAdminRole(role);
    case 'non-recruiter-staff':
      return isPlacementAdminRole(role) || isFacultyRole(role);
    case 'student-only':
      return role === 'STUDENT';
    case 'non-recruiter':
      return role !== 'RECRUITER';
    default:
      return true;
  }
}

function AppContent() {
  const { showToast } = useToast();
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [unauthView, setUnauthView] = useState<'landing' | 'auth'>('landing');
  const [authPreset, setAuthPreset] = useState<{
    role?: UserRole;
    mode?: 'login' | 'register' | 'recruiter-register';
  }>({});

  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Database Health State
  const [dbHealth, setDbHealth] = useState<{ status: string; tables?: number } | null>(null);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications dropdown state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile menu dropdown state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // First-login security password update prompt
  const [flDismissing, setFlDismissing] = useState(false);
  const [flCurrentPwd, setFlCurrentPwd] = useState('');
  const [flNewPwd, setFlNewPwd] = useState('');
  const [flConfirmPwd, setFlConfirmPwd] = useState('');
  const [flSaving, setFlSaving] = useState(false);
  const [flError, setFlError] = useState('');

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem(`gcet_spc_active_module_${user.userId}`, activeModule);
    } catch {
      // ignore storage errors
    }
  }, [user, activeModule]);

  useEffect(() => {
    clearLegacyPasswordStorage();
    const unsub = onUnauthorized(() => {
      setUser(null);
      setSelectedStudentId(null);
      setNotifications([]);
      setUnreadCount(0);
      setActiveModule('dashboard');
      setUnauthView('landing');
      if (window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
    });
    apiRequest<AuthUser | null>('/api/auth/session')
      .then((u) => {
        setUser(u);
        if (u?.studentId) setSelectedStudentId(u.studentId);
        if (u) {
          try {
            const savedModule = sessionStorage.getItem(`gcet_spc_active_module_${u.userId}`) as ModuleId | null;
            if (savedModule) {
              const allowedList = isFacultyRole(u.role)
                ? FACULTY_NAV_ITEMS
                : NAV_ITEMS.filter((item) => isNavVisibleForRole(item, u.role));
              if (allowedList.some((item) => item.id === savedModule)) {
                setActiveModule(savedModule);
              }
            }
          } catch {
            // ignore storage errors
          }
        }
      })
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
    return unsub;
  }, []);

  // Enforce role-based dashboard URL routing and block unauthorized URL tampering
  useEffect(() => {
    if (checkingSession) return;
    const enforceRoute = () => {
      const path = window.location.pathname || '/';
      if (!user) {
        if (PROTECTED_ROLE_PREFIXES.some((p) => path.startsWith(p))) {
          window.history.replaceState(null, '', '/');
          setUnauthView('auth');
        }
        return;
      }
      const expectedPath = getRoleDashboardPath(user.role);
      const expectedPrefix = `/${expectedPath.split('/')[1]}`;
      const isAllowedPrefix = (p: string) => {
        if (p === expectedPrefix) return true;
        if (p === '/executive' && isExecutiveRole(user.role)) return true;
        return false;
      };
      const matchesOtherRole = PROTECTED_ROLE_PREFIXES.some(
        (p) => (path === p || path.startsWith(`${p}/`)) && !isAllowedPrefix(p)
      );
      if (matchesOtherRole) {
        showToastRef.current('Unauthorized access blocked: You do not have permission for that role dashboard.', 'error');
        window.history.replaceState(null, '', expectedPath);
        setActiveModule('dashboard');
      } else if (path === '/' || !isAllowedPrefix(`/${path.split('/')[1] || ''}`)) {
        window.history.replaceState(null, '', expectedPath);
      }
    };
    enforceRoute();
    window.addEventListener('popstate', enforceRoute);
    return () => window.removeEventListener('popstate', enforceRoute);
  }, [user, checkingSession]);

  const loadHealth = () => {
    apiRequest<{ status: string; tables: number }>('/api/health')
      .then(setDbHealth)
      .catch(() => setDbHealth({ status: 'Disconnected' }));
  };

  const loadNotifications = () => {
    if (!user) return;
    apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications')
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    loadHealth();
    const timer = setInterval(() => {
      loadNotifications();
      loadHealth();
    }, 60000);
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!user || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<GlobalSearchResult>(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => {
          setSearchResults(res);
          setSearchOpen(true);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const currentUserId = user?.userId;
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearAuthToken();
    if (currentUserId) {
      try {
        sessionStorage.removeItem(`gcet_spc_active_module_${currentUserId}`);
        sessionStorage.removeItem(`gcet_spc_faculty_section_${currentUserId}`);
      } catch {
        // ignore storage errors
      }
    }
    setUser(null);
    setSelectedStudentId(null);
    setNotifications([]);
    setUnreadCount(0);
    setSearchQuery('');
    setSearchResults(null);
    setSearchOpen(false);
    setNotifOpen(false);
    setFlCurrentPwd('');
    setFlNewPwd('');
    setFlConfirmPwd('');
    setFlError('');
    setFlSaving(false);
    setFlDismissing(false);
    setActiveModule('dashboard');
    setUnauthView('landing');
    setProfileMenuOpen(false);
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  };

  const handleOpenProfile = (studentId: number) => {
    setSelectedStudentId(studentId);
    setActiveModule('profile');
  };

  const handleMarkNotificationRead = async (n: NotificationItem) => {
    try {
      if (!n.is_read) {
        await apiRequest(`/api/notifications/${n.notification_id}/read`, {
          method: 'PUT',
          body: JSON.stringify({ isRead: true }),
        });
        loadNotifications();
      }
      if (n.related_module) {
        setActiveModule(n.related_module as ModuleId);
      }
      setNotifOpen(false);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'PUT' });
      loadNotifications();
      showToast('All notifications marked as read.', 'info');
    } catch {
      // ignore
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] dark:bg-[#101827] text-sm font-medium text-[#172033] dark:text-slate-300">
        Loading GCET Placement Hub...
      </div>
    );
  }

  if (!user) {
    if (unauthView === 'auth') {
      return (
        <LoginPage
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          initialRole={authPreset.role}
          initialMode={authPreset.mode}
          onBackToLanding={() => setUnauthView('landing')}
          onSuccess={(u) => {
            try {
              sessionStorage.removeItem(`gcet_spc_active_module_${u.userId}`);
              sessionStorage.removeItem(`gcet_spc_faculty_section_${u.userId}`);
            } catch {
              // ignore storage errors
            }
            setUser(u);
            setFlCurrentPwd('');
            setFlNewPwd('');
            setFlConfirmPwd('');
            setFlError('');
            setFlSaving(false);
            setFlDismissing(false);
            setSelectedStudentId(u.studentId ?? null);
            setActiveModule('dashboard');
          }}
        />
      );
    }

    return (
      <LandingPage
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenAuth={(opts) => {
          setAuthPreset(opts ?? {});
          setUnauthView('auth');
        }}
      />
    );
  }

  const visibleNavItems = isFacultyRole(user.role)
    ? FACULTY_NAV_ITEMS
    : NAV_ITEMS.filter((item) => isNavVisibleForRole(item, user.role));
  const currentNav =
    visibleNavItems.find((n) => n.id === activeModule) ??
    NAV_ITEMS.find((n) => n.id === activeModule) ??
    visibleNavItems[0];

  const hasSearchHits =
    searchResults &&
    ((user.role !== 'STUDENT' && user.role !== 'RECRUITER' && searchResults.students.length > 0) ||
      searchResults.companies.length > 0 ||
      searchResults.drives.length > 0 ||
      searchResults.announcements.length > 0);

  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-[#101A35] text-slate-200 select-none">
      {/* Official GCET Institutional Branding (Circular Crest Logo) */}
      <div className={`border-b border-white/10 ${collapsed ? 'p-3' : 'px-4 py-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <img
              src="/assets/aistudio/image_7c4eaab7.png"
              alt="GCET Official Logo"
              className="w-11 h-11 rounded-full object-cover bg-white p-0.5 border border-white/25 shadow-sm"
            />
            <span className="text-[10px] font-bold tracking-wider text-white">GCET</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_7c4eaab7.png"
              alt="Geethanjali College of Engineering and Technology Logo"
              className="w-12 h-12 rounded-full object-cover bg-white p-0.5 border border-white/25 shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-white leading-snug truncate">
                GCET PLACEMENT HUB
              </h1>
              <p className="text-[11px] text-[#20C5E8] mt-0.5 font-medium truncate">
                {isFacultyRole(user.role) && user.designation
                  ? user.designation
                  : 'Smart Placement Cell & Skill Matrix'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Modules */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveModule(item.id);
                setMobileMenuOpen(false);
              }}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              } py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#246BFD] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-[#172B50] hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Logout Action */}
      <div className="p-2.5 border-t border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? (isFacultyRole(user.role) ? 'Logout' : 'Sign Out') : undefined}
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-2' : 'gap-3 px-3'
          } py-2 rounded-lg text-xs font-medium text-red-300 hover:bg-red-950/50 hover:text-red-200 transition-colors`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{isFacultyRole(user.role) ? 'Logout' : 'Sign Out'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#101827] text-[#172033] dark:text-slate-100 flex">
      {/* Desktop Collapsible Navy Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 border-r border-slate-800 sticky top-0 h-screen transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarContent(sidebarCollapsed)}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#101827]/70" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#101A35] h-full border-r border-white/10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-[#172B50] text-white"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 3-Zone Top Navigation Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#18243A]/95 backdrop-blur border-b border-slate-200 dark:border-slate-700/70 px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Zone 1: Collapse + Branding + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-200"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="hidden lg:inline-flex p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => setActiveModule('dashboard')}
                  className="hidden sm:inline font-semibold text-[#101A35] dark:text-slate-200 hover:text-[#246BFD] transition-colors truncate"
                >
                  GCET Placement Hub
                </button>
                <span className="hidden md:inline text-slate-400">· Cheeryal, Hyderabad</span>
                <span className="hidden sm:inline">/</span>
                <span className="font-semibold text-[#246BFD] dark:text-[#20C5E8] truncate">
                  {activeModule === 'faculty-profile'
                    ? 'My Profile & Skills'
                    : activeModule === 'profile' && user.role !== 'STUDENT'
                    ? 'Student Profiles'
                    : currentNav.label}
                </span>
              </div>
            </div>
          </div>

          {/* Zone 2 & 3: Institutional Status, Search, Alerts, Theme, Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Current Date */}
            <span className="hidden xl:inline-block text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2">
              {formattedDate}
            </span>

            {/* Live DB Health Indicator */}
            {dbHealth && (
              <div
                className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                  dbHealth.status === 'Connected'
                    ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                    : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                }`}
                title={dbHealth.tables ? `SQLite / MySQL-compatible schema (${dbHealth.tables} tables)` : 'Database status'}
              >
                <Database className="w-3 h-3" />
                <span>DB: {dbHealth.status}</span>
              </div>
            )}

            {/* Official GCET Website Shortcut */}
            <a
              href="https://gcet.edu.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#246BFD] dark:hover:text-[#20C5E8] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="Open Official GCET Website"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">GCET Website</span>
            </a>

            {/* Global Search */}
            <div ref={searchRef} className="relative hidden md:block w-52 lg:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search opportunities, companies..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] text-[#172033] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#246BFD]/30"
              />
              {searchOpen && searchQuery.trim() && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
                  {!hasSearchHits ? (
                    <div className="p-4 text-xs text-slate-500 text-center">No matching records found.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/70 text-xs">
                      {searchResults!.announcements.length > 0 && (
                        <div className="p-2.5 space-y-1">
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Announcements</p>
                          {searchResults!.announcements.map((a) => (
                            <button
                              key={a.announcement_id}
                              type="button"
                              onClick={() => {
                                setActiveModule('announcements');
                                setSearchOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#101827]"
                            >
                              <p className="font-medium text-[#172033] dark:text-white line-clamp-1">{a.title}</p>
                              <p className="text-[11px] text-slate-500">{a.category_name} · {a.published_date}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.companies.length > 0 && (
                        <div className="p-2.5 space-y-1">
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Companies</p>
                          {searchResults!.companies.map((c) => (
                            <button
                              key={c.company_id}
                              type="button"
                              onClick={() => {
                                setActiveModule('companies');
                                setSearchOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#101827]"
                            >
                              <p className="font-medium text-[#172033] dark:text-white">{c.company_name}</p>
                              <p className="text-[11px] text-slate-500">{c.industry} · {c.headquarters}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.drives.length > 0 && (
                        <div className="p-2.5 space-y-1">
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Opportunities</p>
                          {searchResults!.drives.map((d) => (
                            <button
                              key={d.drive_id}
                              type="button"
                              onClick={() => {
                                setActiveModule('drives');
                                setSearchOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#101827]"
                            >
                              <p className="font-medium text-[#172033] dark:text-white">{d.company_name} — {d.job_role}</p>
                              <p className="text-[11px] text-slate-500">{d.job_type} · {Number(d.salary_package).toFixed(2)} LPA</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {user.role !== 'STUDENT' && user.role !== 'RECRUITER' && searchResults!.students.length > 0 && (
                        <div className="p-2.5 space-y-1">
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Students</p>
                          {searchResults!.students.map((s) => (
                            <button
                              key={s.student_id}
                              type="button"
                              onClick={() => {
                                handleOpenProfile(s.student_id);
                                setSearchOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#101827]"
                            >
                              <p className="font-medium text-[#172033] dark:text-white">{s.full_name} ({s.roll_number})</p>
                              <p className="text-[11px] text-slate-500">{s.branch} · CGPA {Number(s.cgpa).toFixed(2)}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Bell Dropdown */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  loadNotifications();
                }}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] text-[#172033] dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#172033] dark:text-white">
                      Portal Alerts ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#246BFD] dark:text-[#20C5E8] hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/70">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div
                          key={n.notification_id}
                          className={`p-3.5 text-xs transition-colors ${
                            n.is_read ? 'opacity-70' : 'bg-[#246BFD]/5 dark:bg-[#246BFD]/15'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleMarkNotificationRead(n)}
                              className="text-left flex-1"
                            >
                              <p className="font-semibold text-[#172033] dark:text-white">{n.title}</p>
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {n.category} · {String(n.created_at).slice(0, 10)}
                              </p>
                            </button>
                            {n.link_url && (
                              <a
                                href={n.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-[#246BFD] dark:text-[#20C5E8] hover:bg-blue-50 dark:hover:bg-slate-800 rounded shrink-0"
                                title="Read Full Notification"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-[#101827] text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule('notifications');
                        setNotifOpen(false);
                      }}
                      className="text-xs font-semibold text-[#246BFD] dark:text-[#20C5E8] hover:underline"
                    >
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#101827] text-[#172033] dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              aria-label="Switch theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#101827] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#246BFD] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-[#172033] dark:text-white leading-tight max-w-[140px] truncate">
                    {user.fullName}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[170px] truncate">
                    {user.designation || formatRoleLabel(user.role)}
                    {user.assignedBranch ? ` · ${user.assignedBranch}` : ''}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/70">
                    <p className="font-semibold text-[#172033] dark:text-white truncate">{user.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  {user.role !== 'RECRUITER' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule(isFacultyRole(user.role) ? 'faculty-profile' : 'profile');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101827]"
                    >
                      {isFacultyRole(user.role) ? 'My Profile & Skills' : 'Profile & Academic Dossier'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('notifications');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101827]"
                  >
                    Notification History
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule('settings');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101827]"
                  >
                    Portal Settings &amp; Password
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3.5 py-2 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Direct Logout Icon Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              aria-label="Sign out"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardView
              user={user}
              isDark={isDark}
              onNavigate={setActiveModule}
              onOpenProfile={handleOpenProfile}
            />
          )}
          {activeModule === 'campus-connect' && <CampusConnectView user={user} onNavigate={setActiveModule} />}
          {activeModule === 'approvals' && isPlacementAdminRole(user.role) && (
            <ApprovalCenterView userRole={user.role} />
          )}
          {activeModule === 'profile-approvals' && (isPlacementAdminRole(user.role) || isFacultyRole(user.role)) && (
            <FacultyProfileApprovalsView user={user} />
          )}
          {activeModule === 'user-management' && isSystemAdminRole(user.role) && (
            <UserManagementView currentUserId={user.userId} currentUserRole={user.role} />
          )}
          {activeModule === 'announcements' && <AnnouncementsView user={user} />}
          {activeModule === 'department-notices' && user.role !== 'RECRUITER' && (
            <AnnouncementsView user={user} departmentMode />
          )}
          {activeModule === 'notifications' && (
            <NotificationsView onNavigate={setActiveModule} onSyncUnreadCount={loadNotifications} />
          )}
          {activeModule === 'branches' && user.role !== 'RECRUITER' && <BranchesView user={user} />}
          {activeModule === 'students' && (isPlacementAdminRole(user.role) || isFacultyRole(user.role)) && (
            <StudentsView user={user} onOpenProfile={handleOpenProfile} />
          )}
          {activeModule === 'faculty-profile' && (isFacultyRole(user.role) || isPlacementAdminRole(user.role)) && (
            <FacultyProfileView user={user} />
          )}
          {activeModule === 'profile' && user.role !== 'RECRUITER' && (
            <StudentProfileView
              user={user}
              selectedStudentId={selectedStudentId}
              onSelectStudentId={setSelectedStudentId}
            />
          )}
          {activeModule === 'skill-matrix' && user.role !== 'RECRUITER' && (
            <SkillMatrixView
              user={user}
              isDark={isDark}
              selectedStudentId={selectedStudentId}
              onSelectStudentId={setSelectedStudentId}
            />
          )}
          {activeModule === 'companies' && <CompaniesView user={user} />}
          {activeModule === 'drives' && <DrivesView user={user} />}
          {activeModule === 'eligibility' && user.role !== 'RECRUITER' && <EligibilityView user={user} />}
          {activeModule === 'skill-gap' && user.role !== 'RECRUITER' && <SkillGapView user={user} isDark={isDark} />}
          {activeModule === 'matching' && user.role !== 'RECRUITER' && <MatchingView user={user} />}
          {activeModule === 'applications' && <ApplicationsView user={user} />}
          {activeModule === 'placements' && user.role !== 'RECRUITER' && <PlacementsView user={user} />}
          {activeModule === 'reports' && user.role !== 'RECRUITER' && <ReportsView user={user} isDark={isDark} />}
          {activeModule === 'settings' && (
            <SettingsView
              user={user}
              isDark={isDark}
              onToggleTheme={() => setIsDark((d) => !d)}
              onUserUpdated={(updated) => {
                setUser((prev) =>
                  prev
                    ? {
                        ...prev,
                        ...updated,
                        mustChangePassword: updated.mustChangePassword ?? false,
                        passwordChangeDismissed: updated.passwordChangeDismissed ?? false,
                      }
                    : prev
                );
                if (updated.token) updateStoredAuthToken(updated.token);
              }}
            />
          )}
        </main>
      </div>

      {/* First-Login Mandatory Password Change Modal */}
      <Modal
        key={`first-login-${user.userId}`}
        open={Boolean(user.mustChangePassword && !user.passwordChangeDismissed)}
        title="Mandatory First-Login Password Change"
        onClose={async () => {
          if (flDismissing || flSaving) return;
          setFlError('');
          setFlDismissing(true);
          try {
            const res = await apiRequest<AuthUser & { message?: string }>('/api/auth/dismiss-password-prompt', {
              method: 'POST',
            });
            if (res.token) updateStoredAuthToken(res.token);
            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    ...res,
                    passwordChangeDismissed: true,
                  }
                : prev
            );
            setFlCurrentPwd('');
            setFlNewPwd('');
            setFlConfirmPwd('');
            showToast(
              res.message || 'Password prompt dismissed. Your temporary password remains active until changed in Settings.',
              'info'
            );
          } catch (err) {
            setFlError(err instanceof Error ? err.message : 'Unable to save dismissal preference.');
          } finally {
            setFlDismissing(false);
          }
        }}
        maxWidth="max-w-md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setFlError('');
            if (flNewPwd.length < 8 || !/[A-Za-z]/.test(flNewPwd) || !/\d/.test(flNewPwd)) {
              setFlError('New password must be at least 8 characters and include both letters and numbers.');
              return;
            }
            if (flNewPwd === flCurrentPwd) {
              setFlError('New password must differ from your current password.');
              return;
            }
            if (flNewPwd !== flConfirmPwd) {
              setFlError('New password and confirmation do not match.');
              return;
            }
            setFlSaving(true);
            try {
              const res = await apiRequest<AuthUser & { message: string }>('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: flCurrentPwd, newPassword: flNewPwd }),
              });
              if (res.token) updateStoredAuthToken(res.token);
              setUser((prev) =>
                prev ? { ...prev, ...res, mustChangePassword: false, passwordChangeDismissed: false } : prev
              );
              setFlCurrentPwd('');
              setFlNewPwd('');
              setFlConfirmPwd('');
              showToast(res.message || 'Personal password saved securely.');
            } catch (err) {
              setFlError(err instanceof Error ? err.message : 'Unable to update password.');
            } finally {
              setFlSaving(false);
            }
          }}
          className="space-y-3.5"
        >
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Welcome, <strong>{user.fullName}</strong> ({formatRoleLabel(user.role)}). To secure your institutional account on first login, please set a personal password before entering your dashboard.
          </p>
          {flError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{flError}</p>
          )}
          <div>
            <label className={labelCls}>Current / Initial Password</label>
            <input
              type="password"
              required
              value={flCurrentPwd}
              onChange={(e) => setFlCurrentPwd(e.target.value)}
              placeholder="Enter current password"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>New Personal Password (min 8 chars, letters &amp; numbers)</label>
            <input
              type="password"
              required
              minLength={8}
              value={flNewPwd}
              onChange={(e) => setFlNewPwd(e.target.value)}
              placeholder="Choose a strong personal password"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={flConfirmPwd}
              onChange={(e) => setFlConfirmPwd(e.target.value)}
              placeholder="Confirm new password"
              className={inputCls}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Sign Out
            </button>
            <button
              type="submit"
              disabled={flSaving}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {flSaving ? 'Saving...' : 'Save Password & Continue'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
