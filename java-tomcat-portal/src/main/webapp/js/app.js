const REPORT_ELIGIBLE_ROLES = new Set([
  'PRINCIPAL',
  'VICE_CHAIRMAN',
  'CHAIRMAN',
  'FACULTY_COORDINATOR',
  'FACULTY'
]);

const BASE_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'announcements', label: 'Announcements & Sync' },
  { id: 'students', label: 'Student Directory' },
  { id: 'approvals', label: 'Profile Approvals' },
  { id: 'companies', label: 'Companies Directory' },
  { id: 'drives', label: 'Placement Drives' },
  { id: 'applications', label: 'Applications' },
  { id: 'placements', label: 'Placements' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'diagnostics', label: 'System Diagnostics' }
];

const AUTH_EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-recruiter',
  '/api/auth/forgot-password',
  '/api/auth/change-password',
  '/api/auth/session'
];

let currentUser = null;
let currentModule = 'dashboard';
let activeBranchChart = null;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getVisibleModules(user) {
  const list = [...BASE_MODULES];
  if (user && REPORT_ELIGIBLE_ROLES.has(user.role)) {
    list.splice(9, 0, { id: 'reports', label: 'Registration Reports' });
  }
  return list;
}

function resolveAppUrl(path) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(cleanPath, document.baseURI).toString();
}

function syncRoleUrl(user) {
  if (!user || !user.dashboardPath) return;
  try {
    const targetUrl = resolveAppUrl(user.dashboardPath);
    const parsed = new URL(targetUrl);
    if (window.location.pathname !== parsed.pathname) {
      window.history.replaceState(null, '', parsed.pathname);
    }
  } catch {
    // Ignore history API issues in restricted contexts
  }
}

function applyTheme() {
  const saved = localStorage.getItem('gcet_spc_theme') || 'light';
  document.documentElement.classList.toggle('dark', saved === 'dark');
}

function toggleTheme() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('gcet_spc_theme', next);
  applyTheme();
}

function clearLegacySensitiveStorage() {
  ['password', 'savedPassword', 'gcet_password', 'userPassword'].forEach((k) => {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch {
      // Ignore storage access restrictions
    }
  });
}

function resetToLoginView(message) {
  currentUser = null;
  document.getElementById('force-pwd-modal')?.classList.add('hidden');
  document.getElementById('portal-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.remove('hidden');
  if (message) {
    const errEl = document.getElementById('login-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.remove('hidden');
    }
  }
}

async function api(path, options = {}) {
  const url = resolveAppUrl(path);
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  const isAuthExempt = AUTH_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (res.status === 401 && !isAuthExempt) {
    resetToLoginView('Your institutional session has expired. Please sign in again.');
    throw new Error(json?.error || 'Session expired.');
  }

  if (!res.ok || !json || !json.success) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json.data;
}

async function refreshNotificationBadge() {
  try {
    const data = await api('/api/notifications');
    const badge = document.getElementById('notif-badge');
    if (badge) badge.textContent = String(data.unreadCount ?? 0);
  } catch {
    // Ignore badge polling error on unauthenticated views
  }
}

function renderSidebarNav(user) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const visible = getVisibleModules(user);
  nav.innerHTML = visible
    .map((m) => `<button class="nav-btn" data-id="${m.id}" type="button">${esc(m.label)}</button>`)
    .join('');
  nav.querySelectorAll('.nav-btn').forEach((btn) =>
    btn.addEventListener('click', () => loadModule(btn.dataset.id))
  );
}

async function loadModule(modId) {
  currentModule = modId;
  const visible = getVisibleModules(currentUser);
  document.getElementById('breadcrumb-title').textContent =
    visible.find((m) => m.id === modId)?.label || 'Dashboard';
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.id === modId)
  );
  const container = document.getElementById('module-content');
  container.innerHTML = '<div class="card">Loading from Java 21 Servlet API...</div>';

  try {
    if (modId === 'dashboard') {
      const data = await api('/api/analytics');
      const roleLabel = esc((currentUser?.designation || currentUser?.role || '').replace(/_/g, ' '));
      const reportCta = REPORT_ELIGIBLE_ROLES.has(currentUser?.role)
        ? `<div style="margin-top:8px;"><button id="dash-open-reports-btn" type="button" class="btn-outline">Registration Statistics &amp; Exports (PDF / Excel / CSV)</button></div>`
        : '';
      container.innerHTML = `
        <div class="card hero-welcome-card">
          <div class="hero-welcome-copy">
            <span class="badge-info">Geethanjali College of Engineering and Technology</span>
            <h2>Welcome back, ${esc(currentUser?.fullName || 'Portal User')}</h2>
            <p class="muted"><strong>${roleLabel}</strong> · GCET Placement Hub</p>
            <p class="muted">Your Skills. Your Opportunities. Your Future. Cheeryal (V), Keesara (M), Hyderabad · UGC Autonomous &amp; NAAC A+ (subject to verification).</p>
            ${reportCta}
          </div>
          <div class="hero-welcome-media">
            <img src="images/gcet-campus.png" alt="GCET Campus" />
          </div>
        </div>
        <div class="kpi-grid">
          <div class="card"><p class="muted">Total Students</p><h2>${esc(data.totalStudents)}</h2></div>
          <div class="card"><p class="muted">Partner Companies</p><h2>${esc(data.registeredCompanies)}</h2></div>
          <div class="card"><p class="muted">Active Drives</p><h2>${esc(data.activeDrives)}</h2></div>
          <div class="card"><p class="muted">Students Placed</p><h2>${esc(data.studentsPlaced)}</h2></div>
          <div class="card"><p class="muted">Total Applications</p><h2>${esc(data.totalApplications)}</h2></div>
          <div class="card"><p class="muted">Eligible Students</p><h2>${esc(data.eligibleStudents)}</h2></div>
        </div>
        <div class="card"><h3>Branch Distribution</h3><canvas id="branchChart" height="100"></canvas></div>
      `;
      document.getElementById('dash-open-reports-btn')?.addEventListener('click', () => loadModule('reports'));
      if (window.Chart && Array.isArray(data.branchDistribution)) {
        if (activeBranchChart) activeBranchChart.destroy();
        activeBranchChart = new Chart(document.getElementById('branchChart'), {
          type: 'bar',
          data: {
            labels: data.branchDistribution.map((b) => b.label),
            datasets: [
              {
                label: 'Students',
                data: data.branchDistribution.map((b) => b.count),
                backgroundColor: '#1d4ed8'
              }
            ]
          }
        });
      }
    } else if (modId === 'reports') {
      const stats = await api('/api/reports/registrations');
      const roleRows = (stats.roleBreakdown || [])
        .map(
          (r) =>
            `<tr><td><strong>${esc(String(r.role).replace(/_/g, ' '))}</strong></td><td>${esc(r.activeCount)}</td><td>${esc(r.approvedCount)}</td><td>${esc(r.pendingCount)}</td></tr>`
        )
        .join('');
      const deptRows = (stats.departmentBreakdown || [])
        .map(
          (d) =>
            `<tr><td><strong>${esc(d.departmentName)}</strong> <span class="muted">(${esc(d.departmentCode)})</span></td><td>${esc(d.facultyCount)}</td><td>${esc(d.assignedCoordinatorCount)}</td><td>${esc(d.studentCount)}</td></tr>`
        )
        .join('');
      const pdfUrl = resolveAppUrl('/api/reports/registrations/export?format=pdf');
      const xlsxUrl = resolveAppUrl('/api/reports/registrations/export?format=xlsx');
      const csvUrl = resolveAppUrl('/api/reports/registrations/export?format=csv');
      container.innerHTML = `
        <div class="card">
          <div class="report-header-row">
            <div>
              <span class="badge-info">Automatic Institutional Reporting</span>
              <h3 style="margin-top:6px;">Registered Members &amp; Department Statistics</h3>
              <p class="muted">${esc(stats.collegeTitle)} · Last Updated: <strong>${esc(stats.lastUpdated)}</strong></p>
            </div>
            <div class="report-actions">
              <button id="refresh-reg-stats-btn" type="button" class="btn-outline">Refresh Statistics</button>
              <a class="btn-primary" href="${esc(pdfUrl)}" target="_blank" rel="noopener">Download PDF</a>
              <a class="btn-outline" href="${esc(xlsxUrl)}" target="_blank" rel="noopener">Download Excel (.xlsx)</a>
              <a class="btn-outline" href="${esc(csvUrl)}" target="_blank" rel="noopener">Download CSV</a>
            </div>
          </div>
        </div>
        <div class="kpi-grid">
          <div class="card"><p class="muted">Total Active Accounts</p><h2>${esc(stats.totalRegisteredMembers)}</h2></div>
          <div class="card"><p class="muted">Total Student Profiles</p><h2>${esc(stats.totalStudentProfiles)}</h2></div>
          <div class="card"><p class="muted">Active Faculty</p><h2>${esc(stats.facultyCoordinatorsCount)}</h2></div>
          <div class="card"><p class="muted">Recruiters</p><h2>${esc(stats.recruitersCount)}</h2></div>
          <div class="card"><p class="muted">Approved / Pending</p><h2>${esc(stats.approvedUsersCount)} / ${esc(stats.pendingUsersCount)}</h2></div>
        </div>
        <div class="two-col-grid">
          <div class="card">
            <h4>Role-Wise Registered Accounts</h4>
            <table>
              <thead><tr><th>Role</th><th>Active</th><th>Approved</th><th>Pending</th></tr></thead>
              <tbody>${roleRows}</tbody>
            </table>
          </div>
          <div class="card">
            <h4>Department-Wise Faculty &amp; Student Counts</h4>
            <table>
              <thead><tr><th>Department</th><th>Primary Faculty</th><th>Branch Coordinators</th><th>Students</th></tr></thead>
              <tbody>${deptRows}</tbody>
            </table>
          </div>
        </div>
      `;
      document.getElementById('refresh-reg-stats-btn')?.addEventListener('click', () => loadModule('reports'));
    } else if (modId === 'announcements') {
      const [rows, health] = await Promise.all([
        api('/api/announcements'),
        api('/api/announcements/sync-status').catch(() => null)
      ]);
      const statusHtml = health
        ? `<div class="card"><strong>Official Sync Status:</strong> Last Verified Sync ${esc(health.lastSuccessfulSync || 'Pending')} · Interval: ${esc(health.intervalMinutes)} mins ${health.unreachableCount > 0 ? '· <span class="alert-error">External source fallback active (cached circulars preserved)</span>' : ''}</div>`
        : '';
      container.innerHTML = `${statusHtml}<div class="card"><h3>Institutional Announcements</h3><table><thead><tr><th>Title</th><th>Category</th><th>Source</th><th>Published</th><th>Priority</th></tr></thead><tbody>${rows
        .map(
          (a) =>
            `<tr><td>${esc(a.title)}</td><td>${esc(a.categoryName)}</td><td>${esc(a.sourceName)}</td><td>${esc(a.publishedDate)}</td><td>${esc(a.priority)}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'students') {
      const rows = await api('/api/students');
      container.innerHTML = `<div class="card"><h3>Student Directory (${rows.length})</h3><table><thead><tr><th>Roll No</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Status</th></tr></thead><tbody>${rows
        .map(
          (s) =>
            `<tr><td>${esc(s.rollNumber)}</td><td>${esc(s.fullName)}</td><td>${esc(s.branch)}</td><td>${esc(s.cgpa)}</td><td>${esc(s.placementStatus)}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'approvals') {
      const rows = await api('/api/faculty/profile-approvals');
      container.innerHTML = `<div class="card"><h3>Student Profile Approvals Queue</h3><table><thead><tr><th>Submission Code</th><th>Student</th><th>Branch</th><th>Status</th></tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr><td>${esc(r.submissionCode)}</td><td>${esc(r.studentName)} (${esc(r.rollNumber)})</td><td>${esc(r.branchCode)}</td><td>${esc(r.status)}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'companies') {
      const rows = await api('/api/companies');
      container.innerHTML = `<div class="card"><h3>Partner &amp; Directory Companies</h3><table><thead><tr><th>Company</th><th>Industry</th><th>HQ</th><th>Type</th></tr></thead><tbody>${rows
        .map(
          (c) =>
            `<tr><td>${esc(c.companyName)}</td><td>${esc(c.industry)}</td><td>${esc(c.headquarters || c.location)}</td><td>${c.directoryReference ? 'Directory Reference' : 'Verified Partner'}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'drives') {
      const rows = await api('/api/drives');
      container.innerHTML = `<div class="card"><h3>Placement Drives</h3><table><thead><tr><th>Company</th><th>Role</th><th>Package</th><th>Min CGPA</th><th>Status</th></tr></thead><tbody>${rows
        .map(
          (d) =>
            `<tr><td>${esc(d.companyName)}</td><td>${esc(d.jobRole)}</td><td>${esc(d.salaryPackage)} LPA</td><td>${esc(d.minCgpa)}</td><td>${esc(d.driveStatus)}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'applications') {
      const rows = await api('/api/applications');
      container.innerHTML = `<div class="card"><h3>Applications</h3><table><thead><tr><th>Student</th><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>${rows
        .map(
          (a) =>
            `<tr><td>${esc(a.studentName)} (${esc(a.rollNumber)})</td><td>${esc(a.companyName)}</td><td>${esc(a.jobRole)}</td><td>${esc(a.status)}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'placements') {
      const rows = await api('/api/placements');
      container.innerHTML = `<div class="card"><h3>Placement Offers</h3><table><thead><tr><th>Student</th><th>Company</th><th>Role</th><th>Package</th><th>Status</th></tr></thead><tbody>${rows
        .map(
          (p) =>
            `<tr><td>${esc(p.studentName)}</td><td>${esc(p.companyName)}</td><td>${esc(p.jobRole)}</td><td>${esc(p.packageLpa)} LPA</td><td>${esc(p.joiningStatus)}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'notifications') {
      const data = await api('/api/notifications');
      const items = data.notifications || [];
      container.innerHTML = `<div class="card"><h3>Notifications (${esc(data.unreadCount)} unread)</h3><table><thead><tr><th>Title</th><th>Category</th><th>Message</th><th>Status</th></tr></thead><tbody>${items
        .map(
          (n) =>
            `<tr><td>${esc(n.title)}</td><td>${esc(n.category)}</td><td>${esc(n.message)}</td><td>${n.read ? 'Read' : 'Unread'}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
    } else if (modId === 'diagnostics') {
      const diag = await api('/api/admin/system-status');
      const counts = diag.counts || {};
      container.innerHTML = `
        <div class="card">
          <h3>System Diagnostics &amp; Scheduler Health</h3>
          <p class="muted">Database: <strong>${diag.dbConnected ? 'MySQL Connected' : 'Disconnected'}</strong> · Sync Interval: <strong>${esc(diag.syncIntervalMinutes)} mins</strong> · Last Successful Sync: <strong>${esc(diag.lastSuccessfulSync || 'Pending')}</strong></p>
        </div>
        <div class="kpi-grid">
          <div class="card"><p class="muted">Students</p><h2>${esc(counts.students ?? 0)}</h2></div>
          <div class="card"><p class="muted">Faculty</p><h2>${esc(counts.faculty ?? 0)}</h2></div>
          <div class="card"><p class="muted">Companies</p><h2>${esc(counts.companies ?? 0)}</h2></div>
          <div class="card"><p class="muted">Drives</p><h2>${esc(counts.drives ?? 0)}</h2></div>
          <div class="card"><p class="muted">Announcements</p><h2>${esc(counts.announcements ?? 0)}</h2></div>
          <div class="card"><p class="muted">Notifications</p><h2>${esc(counts.notifications ?? 0)}</h2></div>
        </div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="alert-error">${esc(err.message)}</p></div>`;
  }
}

function showAuthenticatedPortal(user) {
  currentUser = user;
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('portal-view').classList.remove('hidden');
  document.getElementById('user-display').textContent = `${user.fullName} (${user.role})`;
  renderSidebarNav(user);
  syncRoleUrl(user);

  if (user.mustChangePassword && !user.passwordChangeDismissed) {
    const modal = document.getElementById('force-pwd-modal');
    if (modal) modal.classList.remove('hidden');
    document.getElementById('module-content').innerHTML =
      '<div class="card"><h3>Password Update Required</h3><p class="muted">Please update your initial password in the modal or dismiss it to continue to your dashboard.</p></div>';
    return;
  }

  document.getElementById('force-pwd-modal')?.classList.add('hidden');
  refreshNotificationBadge();
  loadModule('dashboard');
}

function bindPasswordToggle(btn, input) {
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const nextType = input.type === 'password' ? 'text' : 'password';
    input.type = nextType;
    btn.textContent = nextType === 'text' ? 'Hide' : 'Show';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  clearLegacySensitiveStorage();

  document.getElementById('login-theme-btn').onclick = toggleTheme;
  document.getElementById('theme-toggle-btn').onclick = toggleTheme;

  bindPasswordToggle(
    document.getElementById('toggle-pwd-btn'),
    document.getElementById('login-password')
  );
  bindPasswordToggle(
    document.getElementById('toggle-reg-pwd-btn'),
    document.getElementById('reg-password')
  );
  document.querySelectorAll('.btn-pwd-toggle[data-target]').forEach((btn) => {
    bindPasswordToggle(btn, document.getElementById(btn.dataset.target));
  });

  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('student-register-form');
  document.getElementById('show-register-btn')?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
  });
  document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
    regForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  const notifQuick = document.getElementById('notif-quick-btn');
  if (notifQuick) {
    notifQuick.addEventListener('click', () => loadModule('notifications'));
  }

  document.querySelectorAll('.role-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('login-role').value = tab.dataset.role;
    });
  });

  try {
    const existingUser = await api('/api/auth/session');
    if (existingUser) {
      showAuthenticatedPortal(existingUser);
    }
  } catch {
    // Unauthenticated initial visit
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const okEl = document.getElementById('login-success');
    const submitBtn = document.getElementById('login-submit-btn');
    errEl.classList.add('hidden');
    okEl?.classList.add('hidden');

    const prevText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';
    try {
      const user = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: document.getElementById('login-identifier').value.trim(),
          password: document.getElementById('login-password').value,
          role: document.getElementById('login-role').value
        })
      });
      showAuthenticatedPortal(user);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  });

  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('register-error');
    const submitBtn = document.getElementById('register-submit-btn');
    errEl.classList.add('hidden');

    const prevText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
    try {
      const created = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          rollNumber: document.getElementById('reg-roll').value.trim(),
          fullName: document.getElementById('reg-name').value.trim(),
          email: document.getElementById('reg-email').value.trim(),
          phone: document.getElementById('reg-phone').value.trim(),
          branch: document.getElementById('reg-branch').value,
          graduationYear: Number(document.getElementById('reg-grad-year').value),
          cgpa: Number(document.getElementById('reg-cgpa').value),
          password: document.getElementById('reg-password').value
        })
      });
      regForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      showAuthenticatedPortal(created);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  });

  document.getElementById('force-pwd-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('force-pwd-error');
    const btn = document.getElementById('force-pwd-submit-btn');
    errEl.classList.add('hidden');
    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const updatedUser = await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: document.getElementById('force-current-pwd').value,
          newPassword: document.getElementById('force-new-pwd').value
        })
      });
      document.getElementById('force-pwd-modal').classList.add('hidden');
      showAuthenticatedPortal({ ...currentUser, ...updatedUser, mustChangePassword: false, passwordChangeDismissed: false });
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  });

  document.getElementById('force-pwd-close-btn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('force-pwd-error');
    const closeBtn = document.getElementById('force-pwd-close-btn');
    errEl?.classList.add('hidden');
    if (closeBtn) closeBtn.disabled = true;
    try {
      const updatedUser = await api('/api/auth/dismiss-password-prompt', { method: 'POST' });
      document.getElementById('force-pwd-modal')?.classList.add('hidden');
      showAuthenticatedPortal({ ...currentUser, ...updatedUser, passwordChangeDismissed: true });
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    } finally {
      if (closeBtn) closeBtn.disabled = false;
    }
  });

  const handleLogout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = resolveAppUrl('/');
  };

  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('force-pwd-logout-btn')?.addEventListener('click', handleLogout);
});
