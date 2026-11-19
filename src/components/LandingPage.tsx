import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  ExternalLink,
  GraduationCap,
  MapPin,
  Mail,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserPlus,
  Briefcase,
  Bell,
} from 'lucide-react';
import { apiRequest } from '../api';
import { PublicOverview, UserRole } from '../types';

interface LandingPageProps {
  onOpenAuth: (opts?: { role?: UserRole; mode?: 'login' | 'register' | 'recruiter-register' }) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function LandingPage({ onOpenAuth, isDark, onToggleTheme }: LandingPageProps) {
  const [overview, setOverview] = useState<PublicOverview | null>(null);

  useEffect(() => {
    apiRequest<PublicOverview>('/api/public-overview').then(setOverview).catch(() => {});
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#101827] text-[#172033] dark:text-slate-100">
      {/* Top Institutional Information Bar */}
      <div className="bg-[#101A35] text-slate-200 border-b border-white/10">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="font-medium text-slate-200">
            UGC Autonomous · NAAC A+ Grade · NBA Accredited Branches · Affiliated to JNTU Hyderabad · Cheeryal, Hyderabad
          </p>
          <a
            href="https://gcet.edu.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#20C5E8] hover:text-white font-medium transition-colors whitespace-nowrap"
          >
            <span>Official GCET Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#101A35]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Official GCET Image + Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/image_7c4eaab7.png"
              alt="Geethanjali College of Engineering and Technology Logo"
              className="w-11 h-11 rounded-full object-cover bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#101A35] dark:text-white tracking-tight truncate">
                GCET PLACEMENT HUB
              </p>
              <p className="text-[11px] text-[#718096] dark:text-slate-400 truncate">
                Smart Placement Cell &amp; Skill Matrix
              </p>
            </div>
          </div>

          {/* Center: Clean Single-Line Section Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#718096] dark:text-slate-300">
            <button type="button" onClick={() => scrollToSection('about')} className="hover:text-[#246BFD] dark:hover:text-white transition-colors whitespace-nowrap">
              About Cell
            </button>
            <button type="button" onClick={() => scrollToSection('companies')} className="hover:text-[#246BFD] dark:hover:text-white transition-colors whitespace-nowrap">
              Recruiters
            </button>
            <button type="button" onClick={() => scrollToSection('departments')} className="hover:text-[#246BFD] dark:hover:text-white transition-colors whitespace-nowrap">
              Departments
            </button>
            <button type="button" onClick={() => scrollToSection('announcements')} className="hover:text-[#246BFD] dark:hover:text-white transition-colors whitespace-nowrap">
              Announcements
            </button>
            <button type="button" onClick={() => scrollToSection('drives')} className="hover:text-[#246BFD] dark:hover:text-white transition-colors whitespace-nowrap">
              Placement Drives
            </button>
            <button type="button" onClick={() => scrollToSection('contact')} className="hover:text-[#246BFD] dark:hover:text-white transition-colors whitespace-nowrap">
              Contact
            </button>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#172B50] transition-colors"
              aria-label="Toggle Light/Dark theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth({ role: 'STUDENT', mode: 'login' })}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-[#172033] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#172B50] transition-colors whitespace-nowrap"
            >
              Student Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth({ role: 'ADMIN', mode: 'login' })}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              Portal Access
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Official GCET Campus Photograph */}
      <section className="relative min-h-[540px] flex items-center bg-[#101A35] overflow-hidden">
        <img
          src="/assets/aistudio/image_7a3f3ea7.png"
          alt="Geethanjali College of Engineering and Technology Campus"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#101A35]/95 via-[#101A35]/82 to-[#101A35]/55" />

        <div className="relative z-10 max-w-[1320px] mx-auto w-full px-4 sm:px-6 py-16 lg:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#20C5E8]">
              GEETHANJALI COLLEGE OF ENGINEERING AND TECHNOLOGY
            </p>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.12]">
                GCET PLACEMENT HUB
              </h1>
              <p className="text-lg sm:text-xl font-semibold text-blue-100 mt-2">
                Smart Placement Cell &amp; Skill Matrix Portal
              </p>
              <p className="text-base font-medium text-[#20C5E8] mt-1">
                &ldquo;Your Skills. Your Opportunities. Your Future.&rdquo;
              </p>
            </div>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
              Unified institutional platform for placement coordination, branch-wise skill matrix verification, recruiter campus drives, eligibility validation, and official GCET &amp; JNTUH academic notices across all 12 programs.
            </p>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'STUDENT', mode: 'login' })}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
              >
                <span>Student Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'ADMIN', mode: 'login' })}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg bg-[#172B50]/90 hover:bg-[#172B50] border border-white/25 text-white transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#20C5E8]" />
                <span>Portal Access</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'STUDENT', mode: 'register' })}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>New Student Registration</span>
              </button>
              <a
                href="https://gcet.edu.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-blue-100 hover:text-white transition-colors"
              >
                <span>Official GCET Academic Portal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Sections */}
      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12 space-y-14">
        {/* About the Placement Cell & Placement Highlights */}
        <section id="about" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">About the Placement Cell</p>
              <h2 className="text-2xl font-bold text-[#101A35] dark:text-white mt-2">
                Training, Industry Readiness &amp; Career Coordination
              </h2>
              <p className="text-sm text-[#718096] dark:text-slate-300 mt-3 leading-relaxed">
                The Training and Placement Cell at Geethanjali College of Engineering and Technology bridges academic excellence with corporate engineering expectations. Using our structured Skill Matrix, department coordinators and Placement Officers validate technical proficiency, evaluate eligibility transparently, and connect eligible graduates with premier technology and core-engineering recruiters.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700/70">
              <div>
                <p className="text-sm font-semibold text-[#172033] dark:text-white">Role-Based Gateways</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">Admin, Faculty, Student, and Recruiter portals with verified permissions.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#172033] dark:text-white">Skill Matrix Engine</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">Automated eligibility validation, skill gap reports, and company matching.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#172033] dark:text-white">Direct Official Links</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">Verified notices synced directly from GCET and JNTUH academic portals.</p>
              </div>
            </div>
          </div>

          {/* Live Database Highlights */}
          <div className="lg:col-span-5 bg-[#101A35] text-white rounded-xl p-6 sm:p-8 flex flex-col justify-between border border-slate-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#20C5E8]">Placement Highlights</p>
              <h3 className="text-xl font-bold mt-2">Live Institutional Snapshot</h3>
              <p className="text-xs text-slate-300 mt-1">Metrics queried directly from the GCET Placement Hub database.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="p-4 rounded-lg bg-[#172B50]/80 border border-white/10">
                <p className="text-2xl font-bold font-mono tabular-nums">{overview ? overview.stats.totalStudents : '—'}</p>
                <p className="text-xs text-slate-300 mt-1">Registered Students</p>
              </div>
              <div className="p-4 rounded-lg bg-[#172B50]/80 border border-white/10">
                <p className="text-2xl font-bold font-mono tabular-nums">{overview ? overview.stats.registeredCompanies : '—'}</p>
                <p className="text-xs text-slate-300 mt-1">Recruiting Companies</p>
              </div>
              <div className="p-4 rounded-lg bg-[#172B50]/80 border border-white/10">
                <p className="text-2xl font-bold font-mono tabular-nums">{overview ? overview.stats.activeDrives : '—'}</p>
                <p className="text-xs text-slate-300 mt-1">Active Campus Drives</p>
              </div>
              <div className="p-4 rounded-lg bg-[#172B50]/80 border border-white/10">
                <p className="text-2xl font-bold font-mono tabular-nums text-[#20C5E8]">{overview ? overview.stats.studentsPlaced : '—'}</p>
                <p className="text-xs text-slate-300 mt-1">Students Placed</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth({ role: 'RECRUITER', mode: 'recruiter-register' })}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
            >
              Partner With GCET — Recruiter Registration
            </button>
          </div>
        </section>

        {/* Recruiting Companies */}
        <section id="companies" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Campus Recruiter Directory</p>
              <h2 className="text-2xl font-bold text-[#101A35] dark:text-white mt-1">Recruiting Companies</h2>
              <p className="text-sm text-[#718096] dark:text-slate-400 mt-1">
                Verified technology, consulting, and engineering organizations featured in GCET placement publications.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth({ role: 'RECRUITER', mode: 'login' })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#246BFD] hover:underline"
            >
              <span>Recruiter Portal Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(overview?.companies ?? []).slice(0, 12).map((c) => (
              <div
                key={c.company_id}
                className="bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-4 flex flex-col justify-between hover:border-[#246BFD]/50 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 rounded-lg bg-[#F4F7FB] dark:bg-[#101827] border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-[#246BFD]" />
                    </div>
                    <a
                      href={c.career_page_url || c.official_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#246BFD] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Careers</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h3 className="text-sm font-semibold text-[#172033] dark:text-white mt-3">{c.company_name}</h3>
                  <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
                    {c.industry} · {c.headquarters}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All 12 GCET Departments & Branches */}
        <section id="departments" className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Academic Structure</p>
            <h2 className="text-2xl font-bold text-[#101A35] dark:text-white mt-1">
              Departments &amp; Accredited Programs ({overview?.branches.length || 12})
            </h2>
            <p className="text-sm text-[#718096] dark:text-slate-400 mt-1">
              Every engineering specialization and postgraduate program is tracked distinctly for drive eligibility and branch-wise readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(overview?.branches ?? []).map((b) => (
              <div
                key={b.branch_id}
                className="bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold font-mono text-[#246BFD]">{b.branch_code}</span>
                  <span className="text-[11px] font-medium text-[#718096] dark:text-slate-400">{b.degree_level}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#172033] dark:text-white mt-2 line-clamp-2">{b.branch_name}</h3>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-2">
                  HOD: {b.hod_name || 'Department Coordinator'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Placement Drives & Student Opportunities */}
        <section id="drives" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Student Opportunities</p>
              <h2 className="text-2xl font-bold text-[#101A35] dark:text-white mt-1">Upcoming Placement Drives</h2>
              <p className="text-sm text-[#718096] dark:text-slate-400 mt-1">
                Verified campus recruitment tracks, internships, and full-time roles open for eligible GCET students.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth({ role: 'STUDENT', mode: 'login' })}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white transition-colors"
            >
              Sign In to Check Eligibility &amp; Apply
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(overview?.drives ?? []).map((d) => (
              <div
                key={d.drive_id}
                className="bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#718096] dark:text-slate-400">
                    <span className="font-semibold text-[#246BFD]">{d.company_name}</span>
                    <span>{d.job_type} · {d.drive_status}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#172033] dark:text-white mt-2">{d.job_role}</h3>
                  <p className="text-xs text-[#718096] dark:text-slate-400 mt-1.5 line-clamp-2">{d.job_description}</p>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096] dark:text-slate-400">Compensation</span>
                    <span className="font-semibold font-mono text-[#172033] dark:text-white">
                      {d.compensation_label || `${Number(d.salary_package).toFixed(2)} LPA`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096] dark:text-slate-400">Min CGPA · Branches</span>
                    <span className="font-medium text-[#172033] dark:text-slate-200 truncate max-w-[190px]">
                      {Number(d.min_cgpa || 6.5).toFixed(1)}+ · {d.eligible_branches}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096] dark:text-slate-400">Deadline · Drive Date</span>
                    <span className="font-mono text-[#172033] dark:text-slate-200">
                      {d.application_deadline} · {d.drive_date}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Latest Announcements */}
        <section id="announcements" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Campus Connect Notices</p>
              <h2 className="text-2xl font-bold text-[#101A35] dark:text-white mt-1">Latest Announcements &amp; Circulars</h2>
              <p className="text-sm text-[#718096] dark:text-slate-400 mt-1">
                Direct official notifications from GCET portals, departmental desks, and JNTU Hyderabad.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth({ role: 'STUDENT', mode: 'login' })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#246BFD] hover:underline"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>View Full Campus Connect Feed</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(overview?.announcements ?? []).map((a) => (
              <div
                key={a.announcement_id}
                className="bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#718096] dark:text-slate-400">
                    <span className="font-semibold text-[#246BFD]">{a.category_name}</span>
                    <span className="font-mono">{a.published_date} · {a.priority}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#172033] dark:text-white mt-2">{a.title}</h3>
                  <p className="text-xs text-[#718096] dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{a.description}</p>
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
        </section>

        {/* Role Gateways + Contact Information */}
        <section id="contact" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Institutional Gateways</p>
            <h2 className="text-xl font-bold text-[#101A35] dark:text-white mt-1">Select Your Role Portal</h2>
            <p className="text-xs text-[#718096] dark:text-slate-400 mt-1">
              Dedicated access modules tailored for students, department faculty, campus recruiters, and placement administration.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'STUDENT', mode: 'login' })}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#246BFD] text-left transition-colors"
              >
                <GraduationCap className="w-5 h-5 text-[#246BFD]" />
                <p className="text-sm font-semibold text-[#172033] dark:text-white mt-2">Students Portal</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">Skill matrix, eligibility engine, applications &amp; notices</p>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'FACULTY', mode: 'login' })}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#246BFD] text-left transition-colors"
              >
                <Calendar className="w-5 h-5 text-[#246BFD]" />
                <p className="text-sm font-semibold text-[#172033] dark:text-white mt-2">Faculty Portal</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">Department readiness, skill verification &amp; circulars</p>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'RECRUITER', mode: 'login' })}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#246BFD] text-left transition-colors"
              >
                <Briefcase className="w-5 h-5 text-[#246BFD]" />
                <p className="text-sm font-semibold text-[#172033] dark:text-white mt-2">Recruiters Portal</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">Post campus roles, shortlist applicants &amp; schedule interviews</p>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth({ role: 'ADMIN', mode: 'login' })}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#246BFD] text-left transition-colors"
              >
                <ShieldCheck className="w-5 h-5 text-[#246BFD]" />
                <p className="text-sm font-semibold text-[#172033] dark:text-white mt-2">Admin &amp; Placement Cell</p>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">Executive analytics, drive approvals &amp; campus administration</p>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#246BFD]">Contact Information</p>
              <h2 className="text-xl font-bold text-[#101A35] dark:text-white mt-1">
                Training &amp; Placement Cell
              </h2>
              <p className="text-sm font-medium text-[#172033] dark:text-slate-200 mt-3">
                Geethanjali College of Engineering and Technology
              </p>
              <div className="space-y-3 mt-4 text-xs text-[#718096] dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#246BFD] shrink-0 mt-0.5" />
                  <span>Cheeryal (V), Keesara (M), Medchal-Malkajgiri District, Hyderabad - 501301, Telangana</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#246BFD] shrink-0" />
                  <span>placements@gcet.edu.in</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#246BFD] shrink-0" />
                  <span>+91 40 2422 0287 · Campus Placement Desk</span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-3 text-xs">
              <a
                href="https://gcet.edu.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[#246BFD] hover:underline"
              >
                <span>Visit gcet.edu.in</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-[#718096] dark:text-slate-400">UGC Autonomous · NAAC A+</span>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101A35] py-6">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#718096] dark:text-slate-400">
          <p className="font-medium text-[#172033] dark:text-slate-200">
            GCET PLACEMENT HUB · Geethanjali College of Engineering and Technology, Hyderabad
          </p>
          <p>Smart Placement Cell &amp; Skill Matrix Portal · Your Skills. Your Opportunities. Your Future.</p>
        </div>
      </footer>
    </div>
  );
}
