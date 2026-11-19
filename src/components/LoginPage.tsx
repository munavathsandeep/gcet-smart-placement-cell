import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../api';
import { AuthUser, Branch, UserRole } from '../types';
import { inputCls, labelCls, Modal } from './SharedUI';

interface LoginPageProps {
  onSuccess: (user: AuthUser) => void;
  onBackToLanding: () => void;
  initialRole?: UserRole;
  initialMode?: 'login' | 'register' | 'recruiter-register';
  isDark: boolean;
  onToggleTheme: () => void;
}

interface PublicStats {
  totalStudents: number;
  registeredCompanies: number;
  activeDrives: number;
  totalBranches: number;
  totalAnnouncements: number;
  studentsPlaced: number;
}

const ROLE_TABS: { id: UserRole; label: string; subtitle: string; placeholder: string }[] = [
  {
    id: 'ADMIN',
    label: 'ADMIN',
    subtitle: 'Executive & Admin Authority · Principal, Vice Chairman, Chairman, System Administrator, Placement Officer',
    placeholder: 'principal.sagar, admin@gcet.edu.in, or username',
  },
  {
    id: 'FACULTY',
    label: 'FACULTY',
    subtitle: 'Official Department Placement Coordinators (CSE, IOT/IT/CS, EEE/ECE/MECH/CIVIL)',
    placeholder: 'faculty_lavanya, faculty_aparna, or faculty_rajashakar',
  },
  {
    id: 'STUDENT',
    label: 'STUDENTS',
    subtitle: 'GCET Undergraduate & Postgraduate Student Portal (Roll Number or Email)',
    placeholder: '23r11a0501@gcet.edu.in or roll number',
  },
  {
    id: 'RECRUITER',
    label: 'RECRUITERS',
    subtitle: 'Verified Corporate Campus Hiring & Talent Acquisition Partner Portal',
    placeholder: 'campus@company.com',
  },
];

export function LoginPage({
  onSuccess,
  onBackToLanding,
  initialRole = 'STUDENT',
  initialMode = 'login',
  isDark,
  onToggleTheme,
}: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'recruiter-register'>(initialMode);
  const [role, setRole] = useState<UserRole>(
    initialRole === 'PLACEMENT_OFFICER' ||
      initialRole === 'PRINCIPAL' ||
      initialRole === 'VICE_CHAIRMAN' ||
      initialRole === 'CHAIRMAN'
      ? 'ADMIN'
      : initialRole
  );
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRecPass, setShowRecPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingNotice, setPendingNotice] = useState('');
  const [regSuccessNotice, setRegSuccessNotice] = useState('');
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Student registration state
  const [regRoll, setRegRoll] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBranch, setRegBranch] = useState('CSE');
  const [regAcademicYear, setRegAcademicYear] = useState('2026-27');
  const [regGradYear, setRegGradYear] = useState('2027');
  const [regSemester, setRegSemester] = useState('7');
  const [regSection, setRegSection] = useState('A');
  const [regCgpa, setRegCgpa] = useState('8.20');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [showRegConfirmPass, setShowRegConfirmPass] = useState(false);

  // Recruiter registration state
  const [recCompany, setRecCompany] = useState('');
  const [recIndustry, setRecIndustry] = useState('IT Services & Software');
  const [recWebsite, setRecWebsite] = useState('');
  const [recHq, setRecHq] = useState('Hyderabad, India');
  const [recName, setRecName] = useState('');
  const [recDesignation, setRecDesignation] = useState('Campus Talent Lead');
  const [recEmail, setRecEmail] = useState('');
  const [recPhone, setRecPhone] = useState('');
  const [recPass, setRecPass] = useState('');

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotErr, setForgotErr] = useState('');

  useEffect(() => {
    apiRequest<PublicStats>('/api/public-stats').then(setStats).catch(() => {});
    apiRequest<Branch[]>('/api/public-branches').then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    setRole(
      initialRole === 'PLACEMENT_OFFICER' ||
        initialRole === 'PRINCIPAL' ||
        initialRole === 'VICE_CHAIRMAN' ||
        initialRole === 'CHAIRMAN'
        ? 'ADMIN'
        : initialRole
    );
  }, [initialRole]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const activeTabInfo = ROLE_TABS.find((t) => t.id === role) || ROLE_TABS[2];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingNotice('');
    setRegSuccessNotice('');
    if (!identifier.trim() || !password) {
      setError('Please enter your institutional username/email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await apiRequest<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, role, rememberMe }),
      });
      setAuthToken(user.token, rememberMe);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingNotice('');
    setRegSuccessNotice('');

    const cleanRoll = regRoll.trim().toUpperCase();
    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPhone = regPhone.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    const numCgpa = Number(regCgpa);

    if (!/^[A-Z0-9]{6,20}$/.test(cleanRoll)) {
      setError('Student Roll Number must be 6–20 alphanumeric characters (e.g., 25R11A0501).');
      return;
    }
    if (cleanName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid institutional or personal email address.');
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError('Mobile number must contain 10 to 15 digits.');
      return;
    }
    if (Number.isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
      setError('CGPA must be between 0.00 and 10.00.');
      return;
    }
    if (regPass.length < 8 || !/[A-Za-z]/.test(regPass) || !/\d/.test(regPass)) {
      setError('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }
    if (regPass !== regConfirmPass) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{
        registered?: boolean;
        rollNumber?: string;
        email?: string;
        fullName?: string;
        branch?: string;
        message?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          rollNumber: cleanRoll,
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          branch: regBranch,
          academicYear: regAcademicYear,
          graduationYear: Number(regGradYear),
          semester: Number(regSemester),
          section: regSection.trim().toUpperCase() || 'A',
          cgpa: numCgpa,
          password: regPass,
          confirmPassword: regConfirmPass,
        }),
      });
      setRegSuccessNotice(
        res.message ||
          `Registration successful for ${cleanName} (${cleanRoll}). Please sign in with your roll number or email and password.`
      );
      setRole('STUDENT');
      setIdentifier(cleanRoll);
      setPassword('');
      setMode('login');
      setRegRoll('');
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegPass('');
      setRegConfirmPass('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Student registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecruiterRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingNotice('');
    setRegSuccessNotice('');
    if (recPass.length < 8 || !/[A-Za-z]/.test(recPass) || !/\d/.test(recPass)) {
      setError('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRequest<{
        pendingApproval?: boolean;
        message?: string;
        email?: string;
        companyName?: string;
      }>('/api/auth/register-recruiter', {
        method: 'POST',
        body: JSON.stringify({
          companyName: recCompany,
          industry: recIndustry,
          officialWebsite: recWebsite,
          headquarters: recHq,
          fullName: recName,
          designation: recDesignation,
          email: recEmail,
          phone: recPhone,
          password: recPass,
        }),
      });
      setPendingNotice(
        result.message ||
          `Registration received for ${recCompany}. Your recruiter account is Pending administrator approval before sign-in.`
      );
      setRole('RECRUITER');
      setIdentifier(recEmail);
      setPassword('');
      setMode('login');
      setRecCompany('');
      setRecWebsite('');
      setRecName('');
      setRecEmail('');
      setRecPhone('');
      setRecPass('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recruiter registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');
    if (forgotNewPass.length < 8 || !/[A-Za-z]/.test(forgotNewPass) || !/\d/.test(forgotNewPass)) {
      setForgotErr('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPass }),
      });
      setForgotMsg(res.message);
    } catch (err) {
      setForgotErr(err instanceof Error ? err.message : 'Reset failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#101827] text-[#172033] dark:text-slate-100 flex flex-col">
      {/* Top Institutional Auth Header */}
      <header className="bg-white dark:bg-[#101A35] border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_7c4eaab7.png"
              alt="GCET Official Logo"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div>
              <p className="text-sm font-bold text-[#101A35] dark:text-white tracking-tight">
                GCET PLACEMENT HUB
              </p>
              <p className="text-[11px] text-[#718096] dark:text-slate-400">
                Institutional Auth · Geethanjali College of Engineering and Technology
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#172B50] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Portal</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#172B50] transition-colors whitespace-nowrap"
              aria-label="Toggle Light or Dark theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Institutional Campus Showcase */}
        <div className="relative lg:col-span-6 min-h-[300px] flex flex-col justify-between bg-[#101A35] overflow-hidden">
          <img
            src="/assets/aistudio/image_7a3f3ea7.png"
            alt="Geethanjali College of Engineering and Technology Campus"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101A35]/95 via-[#101A35]/78 to-[#101A35]/55" />

          <div className="relative z-10 p-8 lg:p-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#20C5E8]">
              UGC Autonomous · NAAC A+ · JNTUH Affiliated
            </p>
            <h2 className="text-xl font-bold text-white mt-1.5">
              Geethanjali College of Engineering and Technology
            </h2>
            <p className="text-xs text-slate-300 mt-1">Cheeryal (V), Keesara (M), Hyderabad</p>
          </div>

          <div className="relative z-10 p-8 lg:p-12 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Institutional Portal Gateway
              </h1>
              <p className="text-sm text-blue-100 mt-2 leading-relaxed max-w-lg">
                Sign in with your verified GCET credentials or register as a Student or Corporate Recruiter to access placement drives, skill matrix tracking, and official announcements.
              </p>
            </div>

            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-white/15">
                <div>
                  <p className="text-2xl font-bold text-white font-mono tabular-nums">{stats.totalBranches}</p>
                  <p className="text-xs text-slate-300 mt-0.5">College Branches</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white font-mono tabular-nums">{stats.registeredCompanies}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Recruiters</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white font-mono tabular-nums">{stats.activeDrives}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Active Drives</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#20C5E8] font-mono tabular-nums">{stats.studentsPlaced}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Students Placed</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Authentication & Role Selection Panel */}
        <div className="lg:col-span-6 flex flex-col justify-center p-6 sm:p-10 lg:p-12 bg-white dark:bg-[#18243A]">
          <div className="w-full max-w-lg mx-auto">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">
                Role-Based Institutional Authentication
              </p>
              <h2 className="text-2xl font-bold text-[#101A35] dark:text-white mt-1">
                {mode === 'login'
                  ? 'Sign In to GCET Placement Hub'
                  : mode === 'register'
                  ? 'New Student Registration'
                  : 'Authorized Recruiter Registration'}
              </h2>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F4F7FB] dark:bg-[#101827] border border-slate-200 dark:border-slate-700 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white dark:bg-[#172B50] text-[#101A35] dark:text-white shadow-sm'
                    : 'text-[#718096] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-white dark:bg-[#172B50] text-[#101A35] dark:text-white shadow-sm'
                    : 'text-[#718096] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Student</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('recruiter-register'); setError(''); }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'recruiter-register'
                    ? 'bg-white dark:bg-[#172B50] text-[#101A35] dark:text-white shadow-sm'
                    : 'text-[#718096] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Recruiter Sign Up</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {regSuccessNotice && (
              <div className="mb-4 px-3.5 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                <p className="font-semibold">Student Account Created Successfully</p>
                <p className="mt-0.5">{regSuccessNotice}</p>
              </div>
            )}

            {pendingNotice && (
              <div className="mb-4 px-3.5 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <p className="font-semibold">Recruiter Registration Pending Approval</p>
                <p className="mt-0.5">{pendingNotice}</p>
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <span className={labelCls}>Select Role Gateway</span>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#F4F7FB] dark:bg-[#101827] border border-slate-200 dark:border-slate-700 rounded-lg">
                    {ROLE_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => { setRole(tab.id); setError(''); }}
                        className={`py-2 px-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          role === tab.id
                            ? 'bg-[#246BFD] text-white'
                            : 'text-[#718096] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#718096] dark:text-slate-400 mt-2">
                    {activeTabInfo.subtitle}
                  </p>
                </div>

                <div>
                  <label className={labelCls} htmlFor="login-identifier">Username or Institutional Email</label>
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={activeTabInfo.placeholder}
                    className={inputCls}
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="login-password">Password</label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`${inputCls} pr-10`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="inline-flex items-center gap-2 text-[#718096] dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-[#246BFD] focus:ring-[#246BFD]"
                    />
                    <span>Remember me on this device</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotOpen(true); setForgotErr(''); setForgotMsg(''); }}
                    className="text-[#246BFD] dark:text-[#20C5E8] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
                >
                  <span>{loading ? 'Authenticating...' : `Sign In to ${activeTabInfo.label} Portal`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/70 flex items-center gap-2 text-[11px] text-[#718096] dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-[#246BFD] shrink-0" />
                  <span>
                    Institutional authentication is verified via server-side password hashing and role-level authorization.
                  </span>
                </div>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleStudentRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Roll Number</label>
                    <input required value={regRoll} onChange={(e) => setRegRoll(e.target.value)} placeholder="25R11A05XX" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Branch</label>
                    <select value={regBranch} onChange={(e) => setRegBranch(e.target.value)} className={inputCls}>
                      {branches.length > 0 ? (
                        branches.map((b) => (
                          <option key={b.branch_code} value={b.branch_code}>
                            {b.branch_code} ({b.degree_level})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CSE">CSE</option>
                          <option value="CSE-AIML">CSE-AIML</option>
                          <option value="CSE-DS">CSE-DS</option>
                          <option value="CSE-CS">CSE-CS</option>
                          <option value="CSE-IoT">CSE-IoT</option>
                          <option value="ECE">ECE</option>
                          <option value="EEE">EEE</option>
                          <option value="ME">ME</option>
                          <option value="CE">CE</option>
                          <option value="IT">IT</option>
                          <option value="MBA">MBA</option>
                          <option value="M.Tech CSE">M.Tech CSE</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Student Full Name" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>GCET Email</label>
                    <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="rollno@gcet.edu.in" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input required value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+91 98480 00000" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelCls}>Academic Year</label>
                    <select value={regAcademicYear} onChange={(e) => setRegAcademicYear(e.target.value)} className={inputCls}>
                      <option value="2026-27">2026-27</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2027-28">2027-28</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Grad Year</label>
                    <input type="number" min={2020} max={2035} required value={regGradYear} onChange={(e) => setRegGradYear(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Semester</label>
                    <select value={regSemester} onChange={(e) => setRegSemester(e.target.value)} className={inputCls}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>Sem {s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Section</label>
                    <input required value={regSection} onChange={(e) => setRegSection(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Current CGPA (0.00 – 10.00)</label>
                  <input type="number" step="0.01" min="0" max="10" required value={regCgpa} onChange={(e) => setRegCgpa(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Password</label>
                    <div className="relative">
                      <input
                        type={showRegPass ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        placeholder="8+ chars, letter & number"
                        className={`${inputCls} pr-10`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label={showRegPass ? 'Hide password' : 'Show password'}
                      >
                        {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showRegConfirmPass ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={regConfirmPass}
                        onChange={(e) => setRegConfirmPass(e.target.value)}
                        placeholder="Re-enter password"
                        className={`${inputCls} pr-10`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPass((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label={showRegConfirmPass ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showRegConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
                >
                  {loading ? 'Creating Student Account...' : 'Create Student Portal Account'}
                </button>
              </form>
            )}

            {mode === 'recruiter-register' && (
              <form onSubmit={handleRecruiterRegister} className="space-y-3">
                <p className="text-xs text-[#718096] dark:text-slate-400">
                  Create Recruiter Account — new corporate registrations remain <strong>Pending</strong> until verified and approved by a GCET Administrator.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Company Name</label>
                    <input required value={recCompany} onChange={(e) => setRecCompany(e.target.value)} placeholder="e.g., Infosys Ltd" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Industry</label>
                    <input required value={recIndustry} onChange={(e) => setRecIndustry(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Website</label>
                    <input type="url" value={recWebsite} onChange={(e) => setRecWebsite(e.target.value)} placeholder="https://company.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Headquarters / City</label>
                    <input required value={recHq} onChange={(e) => setRecHq(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Contact Person</label>
                    <input required value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="Talent Acquisition Lead" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Designation</label>
                    <input required value={recDesignation} onChange={(e) => setRecDesignation(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Official Company Email</label>
                    <input type="email" required value={recEmail} onChange={(e) => setRecEmail(e.target.value)} placeholder="campus@company.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input required value={recPhone} onChange={(e) => setRecPhone(e.target.value)} placeholder="+91 40 0000 0000" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <div className="relative">
                    <input
                      type={showRecPass ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={recPass}
                      onChange={(e) => setRecPass(e.target.value)}
                      placeholder="Minimum 8 chars (letters & numbers)"
                      className={`${inputCls} pr-10`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label={showRecPass ? 'Hide password' : 'Show password'}
                    >
                      {showRecPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
                >
                  {loading ? 'Submitting Recruiter Request...' : 'Create Recruiter Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal open={forgotOpen} title="Reset Account Password" onClose={() => setForgotOpen(false)} maxWidth="max-w-md">
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <p className="text-xs text-[#718096] dark:text-slate-300">
            Enter your registered institutional or recruiter email address and set a new password.
          </p>
          {forgotErr && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{forgotErr}</p>}
          {forgotMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{forgotMsg}</p>}
          <div>
            <label className={labelCls}>Registered Email</label>
            <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="user@gcet.edu.in" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>New Password</label>
            <input type="password" required minLength={8} value={forgotNewPass} onChange={(e) => setForgotNewPass(e.target.value)} placeholder="Minimum 8 chars (letters & numbers)" className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setForgotOpen(false)} className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700">
              Close
            </button>
            <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
