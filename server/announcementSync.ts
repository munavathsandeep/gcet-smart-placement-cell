import type { Database } from 'sql.js';
import { executeSql, queryAll, queryOne } from './db.ts';

interface SourceRow {
  source_id: number;
  source_name: string;
  base_url: string;
  feed_url: string | null;
  sync_mode: 'RSS' | 'HTML' | 'MANUAL';
  is_enabled: number;
  sync_interval_minutes: number;
}

interface CategoryRow {
  category_id: number;
  category_name: string;
}

export interface SyncSourceSummary {
  sourceId: number;
  sourceName: string;
  status: string;
  syncStatus: 'SUCCESS' | 'WARNING' | 'FAILED';
  discovered: number;
  inserted: number;
}

export interface SyncHealthSummary {
  lastSuccessfulSync: string | null;
  hasUnreachableSources: boolean;
  unreachableSources: { source_id: number; source_name: string; sync_status: string; message: string; synced_at: string }[];
  syncIntervalMinutes: number;
  recentLogs: {
    log_id: number;
    source_id: number | null;
    source_name: string;
    sync_status: 'SUCCESS' | 'WARNING' | 'FAILED';
    discovered_count: number;
    inserted_count: number;
    message: string;
    synced_at: string;
  }[];
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let lastSchedulerRunAt = 0;

function stripHtml(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyAnnouncement(
  title: string,
  url: string,
  sourceName: string
): { categoryName: string; branches: string; deptCode: string | null; priority: 'Normal' | 'Important' | 'Urgent' } {
  const haystack = `${title} ${url} ${sourceName}`.toLowerCase();

  let categoryName = 'College Announcements';
  if (haystack.includes('result') || haystack.includes('grade') || haystack.includes('marks')) {
    categoryName = 'Results Notifications';
  } else if (haystack.includes('timetable') || haystack.includes('time-table') || haystack.includes('time table') || haystack.includes('schedule')) {
    categoryName = 'Semester Examination Timetables';
  } else if (haystack.includes('internal') || haystack.includes('mid-') || haystack.includes('mid ')) {
    categoryName = 'Internal Assessment Notifications';
  } else if (haystack.includes('exam') || haystack.includes('evaluation') || haystack.includes('hallticket')) {
    categoryName = 'Examination Notifications';
  } else if (haystack.includes('intern')) {
    categoryName = 'Internship Opportunities';
  } else if (haystack.includes('placement') || haystack.includes('recruit') || haystack.includes('career')) {
    categoryName = 'Placement Notifications';
  } else if (haystack.includes('job') || haystack.includes('hiring') || haystack.includes('vacancy')) {
    categoryName = 'Job Notifications';
  } else if (haystack.includes('hackathon')) {
    categoryName = 'Hackathons';
  } else if (haystack.includes('workshop') || haystack.includes('fdp') || haystack.includes('finishing-school')) {
    categoryName = 'Workshop Announcements';
  } else if (haystack.includes('seminar') || haystack.includes('guest') || haystack.includes('conference')) {
    categoryName = 'Seminars and Guest Lectures';
  } else if (haystack.includes('competition') || haystack.includes('contest') || haystack.includes('coding')) {
    categoryName = 'Competition Announcements';
  } else if (haystack.includes('tech') || haystack.includes('fest') || haystack.includes('symposium')) {
    categoryName = 'Technical Events';
  } else if (haystack.includes('scholarship') || haystack.includes('fellowship')) {
    categoryName = 'Scholarships';
  } else if (haystack.includes('govt') || haystack.includes('government') || haystack.includes('aicte') || haystack.includes('ugc')) {
    categoryName = 'Government Notifications';
  } else if (url.toLowerCase().endsWith('.pdf') || haystack.includes('circular') || haystack.includes('notification') || haystack.includes('admission')) {
    categoryName = 'Academic Circulars';
  } else if (haystack.includes('ece') || haystack.includes('cse') || haystack.includes('eee') || haystack.includes('department')) {
    categoryName = 'Department Notifications';
  }

  let deptCode: string | null = null;
  let branches = 'ALL';
  if (sourceName.toLowerCase().includes('ece') || haystack.includes('gcetece')) {
    deptCode = 'ECE';
    branches = 'ECE,ALL';
  } else if (haystack.includes('aiml') || haystack.includes('ai&ml')) {
    deptCode = 'CSE-AIML';
    branches = 'CSE-AIML';
  } else if (haystack.includes('data science') || haystack.includes('cse-ds')) {
    deptCode = 'CSE-DS';
    branches = 'CSE-DS';
  } else if (haystack.includes('cyber')) {
    deptCode = 'CSE-CS';
    branches = 'CSE-CS';
  } else if (haystack.includes('iot')) {
    deptCode = 'CSE-IoT';
    branches = 'CSE-IoT';
  } else if (haystack.includes('cse')) {
    deptCode = 'CSE';
    branches = 'CSE';
  } else if (haystack.includes('eee')) {
    deptCode = 'EEE';
    branches = 'EEE';
  } else if (haystack.includes('mechanical') || haystack.includes('/me/')) {
    deptCode = 'ME';
    branches = 'ME';
  } else if (haystack.includes('civil')) {
    deptCode = 'CE';
    branches = 'CE';
  } else if (haystack.includes('mba')) {
    deptCode = 'MBA';
    branches = 'MBA';
  }

  let priority: 'Normal' | 'Important' | 'Urgent' = 'Normal';
  if (haystack.includes('urgent') || haystack.includes('last date') || haystack.includes('timetable') || haystack.includes('evaluation')) {
    priority = 'Important';
  }

  return { categoryName, branches, deptCode, priority };
}

function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
      return null;
    }
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function isRelevantAnnouncementLink(title: string, url: string, baseUrl: string): boolean {
  if (title.length < 10 || title.length > 220) return false;
  const lower = `${title} ${url}`.toLowerCase();
  const noiseTerms = [
    'privacy policy',
    'cookie',
    'terms of use',
    'login',
    'sign in',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com',
    'whatsapp',
    'skip to content',
    'read more',
    'home',
    'contact us',
    'about us',
  ];
  if (noiseTerms.some((n) => lower.includes(n))) return false;

  if (url.replace(/\/+$/, '') === baseUrl.replace(/\/+$/, '')) return false;

  const keywords = [
    'notification',
    'circular',
    'exam',
    'result',
    'placement',
    'intern',
    'workshop',
    'seminar',
    'conference',
    'hackathon',
    'scholarship',
    'timetable',
    'schedule',
    'evaluation',
    'admission',
    'finishing',
    'fdp',
    'newsletter',
    'brochure',
    'student',
    'event',
    'notice',
    '.pdf',
  ];
  return keywords.some((k) => lower.includes(k));
}

function parseRssOrAtom(xml: string, baseUrl: string): { title: string; url: string; publishedDate: string; description: string }[] {
  const items: { title: string; url: string; publishedDate: string; description: string }[] = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkHrefMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const linkTextMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateMatch = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
    const descMatch = block.match(/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i);

    const rawTitle = stripHtml(titleMatch ? titleMatch[1] : '');
    const rawUrl = linkHrefMatch ? linkHrefMatch[1] : linkTextMatch ? stripHtml(linkTextMatch[1]) : '';
    const resolved = resolveAbsoluteUrl(rawUrl, baseUrl);
    if (!rawTitle || !resolved) continue;

    let pubDate = new Date().toISOString().slice(0, 10);
    if (dateMatch) {
      const parsed = new Date(stripHtml(dateMatch[1]));
      if (!Number.isNaN(parsed.getTime())) {
        pubDate = parsed.toISOString().slice(0, 10);
      }
    }
    const desc = stripHtml(descMatch ? descMatch[1] : '').slice(0, 320) || `Synced from official feed: ${rawTitle}`;
    items.push({ title: rawTitle.slice(0, 240), url: resolved, publishedDate: pubDate, description: desc });
  }
  return items;
}

function parseHtmlAnchors(html: string, baseUrl: string, sourceName: string): { title: string; url: string; publishedDate: string; description: string }[] {
  const items: { title: string; url: string; publishedDate: string; description: string }[] = [];
  const seenUrls = new Set<string>();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  const today = new Date().toISOString().slice(0, 10);

  while ((match = anchorRegex.exec(html)) !== null) {
    const resolved = resolveAbsoluteUrl(match[1], baseUrl);
    if (!resolved || seenUrls.has(resolved)) continue;
    const title = stripHtml(match[2]);
    if (!isRelevantAnnouncementLink(title, resolved, baseUrl)) continue;
    seenUrls.add(resolved);
    items.push({
      title: title.slice(0, 240),
      url: resolved,
      publishedDate: today,
      description: `Official link synced directly from ${sourceName}. Click "Read Full Notification" to view the source page or document.`,
    });
    if (items.length >= 12) break;
  }
  return items;
}

export async function syncAnnouncementSources(
  db: Database,
  targetSourceId?: number,
  actorName = 'System Sync Scheduler'
): Promise<{ totalInserted: number; results: SyncSourceSummary[]; health: SyncHealthSummary }> {
  const sources = targetSourceId
    ? queryAll<SourceRow>(db, 'SELECT * FROM announcement_sources WHERE source_id = ?', [targetSourceId])
    : queryAll<SourceRow>(db, 'SELECT * FROM announcement_sources WHERE is_enabled = 1 ORDER BY source_id ASC');

  const categories = queryAll<CategoryRow>(db, 'SELECT category_id, category_name FROM announcement_categories');
  const categoryMap = new Map<string, number>();
  for (const c of categories) {
    categoryMap.set(c.category_name, c.category_id);
  }
  const fallbackCategoryId = categoryMap.get('College Announcements') ?? 1;

  const results: SyncSourceSummary[] = [];
  let totalInserted = 0;

  for (const src of sources) {
    const fetchUrl = src.feed_url || src.base_url;
    let discovered = 0;
    let inserted = 0;
    let statusMsg = 'OK';
    let syncStatus: 'SUCCESS' | 'WARNING' | 'FAILED' = 'SUCCESS';

    try {
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'GCET-Placement-Hub-Sync/1.0 (+https://gcet.edu.in/)',
          Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8500),
      });

      if (!response.ok) {
        statusMsg = `HTTP ${response.status} from ${fetchUrl} (cached database circulars preserved)`;
        syncStatus = 'FAILED';
      } else {
        const body = await response.text();
        const isXml =
          src.sync_mode === 'RSS' ||
          body.trimStart().startsWith('<?xml') ||
          body.includes('<rss') ||
          body.includes('<feed');

        const parsedItems = isXml
          ? parseRssOrAtom(body, src.base_url)
          : parseHtmlAnchors(body, src.base_url, src.source_name);

        discovered = parsedItems.length;

        for (const item of parsedItems) {
          const existing = queryOne<{ announcement_id: number }>(
            db,
            'SELECT announcement_id FROM announcements WHERE LOWER(source_url) = LOWER(?) LIMIT 1',
            [item.url]
          );
          if (existing) continue;

          const cls = classifyAnnouncement(item.title, item.url, src.source_name);
          const categoryId = categoryMap.get(cls.categoryName) ?? fallbackCategoryId;
          const isPdf = item.url.toLowerCase().includes('.pdf') ? 1 : 0;

          executeSql(
            db,
            `INSERT INTO announcements (title, category_id, source_id, source_name, source_url, published_date, description, relevant_branches, department_code, academic_year, has_attachment, attachment_url, priority, is_pinned, is_archived, is_verified_source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-27', ?, ?, ?, 0, 0, 1)`,
            [
              item.title,
              categoryId,
              src.source_id,
              src.source_name,
              item.url,
              item.publishedDate,
              item.description,
              cls.branches,
              cls.deptCode,
              isPdf,
              isPdf ? item.url : null,
              cls.priority,
            ]
          );
          inserted++;
        }

        if (discovered > 0) {
          syncStatus = 'SUCCESS';
          statusMsg = `Synced OK · ${discovered} official links scanned, ${inserted} new`;
        } else {
          syncStatus = 'WARNING';
          statusMsg = `Reachable (HTTP 200) · SPA shell or 0 new static links found`;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network timeout';
      syncStatus = 'FAILED';
      statusMsg = `External site temporarily unreachable (${message.slice(0, 75)}). Cached notices remain active.`;
    }

    executeSql(
      db,
      'UPDATE announcement_sources SET last_synced_at = CURRENT_TIMESTAMP, last_sync_status = ? WHERE source_id = ?',
      [statusMsg, src.source_id]
    );

    executeSql(
      db,
      `INSERT INTO announcement_sync_logs (source_id, source_name, sync_status, discovered_count, inserted_count, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [src.source_id, src.source_name, syncStatus, discovered, inserted, statusMsg]
    );

    totalInserted += inserted;
    results.push({
      sourceId: src.source_id,
      sourceName: src.source_name,
      status: statusMsg,
      syncStatus,
      discovered,
      inserted,
    });
  }

  if (totalInserted > 0) {
    executeSql(
      db,
      `INSERT INTO notifications (user_id, title, message, category, related_module)
       VALUES (NULL, ?, ?, 'College Announcements', 'announcements')`,
      [
        `${totalInserted} New Verified Source Update${totalInserted > 1 ? 's' : ''}`,
        `Official portal synchronization added ${totalInserted} verified circular(s) to GCET Placement Hub.`,
      ]
    );
  }

  executeSql(
    db,
    `INSERT INTO activity_logs (user_id, actor_name, activity_type, description)
     VALUES (NULL, ?, 'ANNOUNCEMENT', ?)`,
    [actorName, `Synced ${results.length} official source(s): ${totalInserted} new verified notice(s) added`]
  );

  return { totalInserted, results, health: getSyncHealthSummary(db) };
}

export function getSyncHealthSummary(db: Database): SyncHealthSummary {
  const lastOk = queryOne<{ synced_at: string }>(
    db,
    "SELECT synced_at FROM announcement_sync_logs WHERE sync_status = 'SUCCESS' ORDER BY log_id DESC LIMIT 1"
  );
  const settingRow = queryOne<{ setting_value: string }>(
    db,
    "SELECT setting_value FROM app_settings WHERE setting_key = 'sync_interval_minutes'"
  );
  const sourceInterval = queryOne<{ min_interval: number }>(
    db,
    'SELECT COALESCE(MIN(sync_interval_minutes), 60) AS min_interval FROM announcement_sources WHERE is_enabled = 1'
  );
  const syncIntervalMinutes = Math.max(15, Number(settingRow?.setting_value || sourceInterval?.min_interval || 60));

  const recentLogs = queryAll<SyncHealthSummary['recentLogs'][number]>(
    db,
    'SELECT log_id, source_id, source_name, sync_status, discovered_count, inserted_count, message, synced_at FROM announcement_sync_logs ORDER BY log_id DESC LIMIT 20'
  );

  // Latest log per enabled source
  const latestPerSource = queryAll<{
    source_id: number;
    source_name: string;
    sync_status: string;
    message: string;
    synced_at: string;
  }>(
    db,
    `SELECT l.source_id, l.source_name, l.sync_status, l.message, l.synced_at
     FROM announcement_sync_logs l
     INNER JOIN (
       SELECT source_id, MAX(log_id) AS max_id
       FROM announcement_sync_logs
       WHERE source_id IS NOT NULL
       GROUP BY source_id
     ) m ON l.log_id = m.max_id
     ORDER BY l.source_id ASC`
  );

  const unreachableSources = latestPerSource.filter((r) => r.sync_status === 'FAILED');

  return {
    lastSuccessfulSync: lastOk?.synced_at ?? null,
    hasUnreachableSources: unreachableSources.length > 0,
    unreachableSources,
    syncIntervalMinutes,
    recentLogs,
  };
}

export function checkUpcomingDriveDeadlines(db: Database): number {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const horizonDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const drives = queryAll<{
    drive_id: number;
    company_name: string;
    job_role: string;
    application_deadline: string;
    min_cgpa: number;
    eligible_branches: string;
    max_backlogs: number;
  }>(
    db,
    `SELECT pd.drive_id, c.company_name, pd.job_role, pd.application_deadline,
            de.min_cgpa, de.eligible_branches, de.max_backlogs
     FROM placement_drives pd
     JOIN companies c ON pd.company_id = c.company_id
     JOIN drive_eligibility de ON pd.drive_id = de.drive_id
     WHERE pd.approval_status = 'Approved'
       AND pd.drive_status IN ('Active', 'Planned')
       AND pd.application_deadline >= ?
       AND pd.application_deadline <= ?`,
    [todayIso, horizonDate]
  );

  if (drives.length === 0) return 0;

  const students = queryAll<{
    student_id: number;
    user_id: number | null;
    branch: string;
    cgpa: number;
    active_backlogs: number;
  }>(db, 'SELECT student_id, user_id, branch, cgpa, active_backlogs FROM students WHERE user_id IS NOT NULL');

  let created = 0;
  for (const d of drives) {
    const allowedBranches = String(d.eligible_branches || 'ALL')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    for (const st of students) {
      if (!st.user_id) continue;
      const stuBranch = String(st.branch || '').trim().toUpperCase();
      const branchOk = allowedBranches.includes('ALL') || allowedBranches.includes(stuBranch);
      const cgpaOk = Number(st.cgpa) >= Number(d.min_cgpa);
      const backlogsOk = Number(st.active_backlogs) <= Number(d.max_backlogs);
      if (!branchOk || !cgpaOk || !backlogsOk) continue;

      const applied = queryOne<{ application_id: number }>(
        db,
        'SELECT application_id FROM applications WHERE drive_id = ? AND student_id = ?',
        [d.drive_id, st.student_id]
      );
      if (applied) continue;

      const title = `Deadline Approaching: ${d.company_name} (${d.application_deadline})`;
      const existingNotif = queryOne<{ notification_id: number }>(
        db,
        'SELECT notification_id FROM notifications WHERE user_id = ? AND title = ? LIMIT 1',
        [st.user_id, title]
      );
      if (existingNotif) continue;

      executeSql(
        db,
        `INSERT INTO notifications (user_id, title, message, category, related_module)
         VALUES (?, ?, ?, 'Placement Notifications', 'drives')`,
        [
          st.user_id,
          title,
          `Reminder: You are eligible for ${d.company_name} — ${d.job_role}. Apply before ${d.application_deadline}.`,
        ]
      );
      created++;
    }
  }
  return created;
}

export function startAnnouncementScheduler(getDbFn: () => Promise<Database>): void {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(async () => {
    try {
      const db = await getDbFn();
      const settingRow = queryOne<{ setting_value: string }>(
        db,
        "SELECT setting_value FROM app_settings WHERE setting_key = 'sync_interval_minutes'"
      );
      const row = queryOne<{ min_interval: number }>(
        db,
        'SELECT COALESCE(MIN(sync_interval_minutes), 60) AS min_interval FROM announcement_sources WHERE is_enabled = 1'
      );
      const configuredMins = Number(settingRow?.setting_value || row?.min_interval || 60);
      const intervalMs = Math.max(15, configuredMins) * 60 * 1000;
      if (Date.now() - lastSchedulerRunAt >= intervalMs) {
        lastSchedulerRunAt = Date.now();
        await syncAnnouncementSources(db, undefined, 'Automated Background Sync');
        checkUpcomingDriveDeadlines(db);
      }
    } catch {
      // background scheduler stays resilient
    }
  }, 5 * 60 * 1000);
}

