package edu.gcet.placement.service;

import edu.gcet.placement.dao.AnnouncementDAO;
import edu.gcet.placement.model.Announcement;
import edu.gcet.placement.model.AnnouncementSource;
import edu.gcet.placement.util.PortalException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Date;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Synchronizes publicly accessible RSS feeds and announcement/circular/PDF pages
 * from official GCET and JNTUH sources, deduplicating by original source_url.
 */
public class AnnouncementSyncService {
    private static final Pattern ANCHOR_PATTERN = Pattern.compile(
            "<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)</a>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern RSS_ITEM_PATTERN = Pattern.compile(
            "<item>([\\s\\S]*?)</item>",
            Pattern.CASE_INSENSITIVE
    );

    private final AnnouncementDAO announcementDAO = new AnnouncementDAO();
    private final NotificationService notificationService = new NotificationService();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public void startPeriodicSync(long intervalMinutes) {
        scheduler.scheduleAtFixedRate(() -> {
            try {
                syncAllEnabledSources();
            } catch (Exception ignored) {}
        }, intervalMinutes, intervalMinutes, TimeUnit.MINUTES);
    }

    public Map<String, Object> syncAllEnabledSources() throws PortalException {
        List<AnnouncementSource> sources = announcementDAO.findAllSources();
        int totalInserted = 0;
        List<Map<String, Object>> results = new ArrayList<>();

        for (AnnouncementSource src : sources) {
            if (!src.isEnabled() || "MANUAL".equalsIgnoreCase(src.getSyncMode())) continue;
            Map<String, Object> report = syncSource(src);
            totalInserted += (int) report.get("inserted");
            results.add(report);
        }

        if (totalInserted > 0) {
            notificationService.notifyBroadcast(
                    totalInserted + " New Verified Source Update" + (totalInserted > 1 ? "s" : ""),
                    "Official portal synchronization added " + totalInserted + " verified circular(s) to GCET Placement Hub.",
                    "College Announcements",
                    "announcements"
            );
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalInserted", totalInserted);
        summary.put("sources", results);
        summary.put("health", announcementDAO.getSyncHealthSummary());
        return summary;
    }

    private Map<String, Object> syncSource(AnnouncementSource src) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("sourceId", src.getSourceId());
        report.put("sourceName", src.getSourceName());
        int inserted = 0;
        int discovered = 0;
        String syncStatus = "SUCCESS";
        String msg;

        try {
            String target = (src.getFeedUrl() != null && !src.getFeedUrl().isBlank()) ? src.getFeedUrl() : src.getBaseUrl();
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(target))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "GCET-Placement-Hub/1.0")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                String body = resp.body();
                if ("RSS".equalsIgnoreCase(src.getSyncMode()) || body.contains("<rss") || body.contains("<feed")) {
                    inserted = parseRssAndSave(src, body);
                } else {
                    inserted = parseHtmlLinksAndSave(src, body);
                }
                discovered = inserted;
                if (inserted > 0) {
                    syncStatus = "SUCCESS";
                    msg = "Synced HTTP " + resp.statusCode() + " (" + inserted + " new items)";
                } else {
                    syncStatus = "WARNING";
                    msg = "Reachable HTTP " + resp.statusCode() + " (0 new static links found)";
                }
            } else {
                syncStatus = "FAILED";
                msg = "HTTP " + resp.statusCode() + " returned by source (cached notices preserved)";
            }
        } catch (Exception e) {
            syncStatus = "FAILED";
            msg = "Source unreachable or protected; cached notices preserved & manual admin notice mode active";
        }

        try {
            announcementDAO.updateSourceSyncStatus(src.getSourceId(), msg);
            announcementDAO.recordSyncLog(src.getSourceId(), src.getSourceName(), syncStatus, discovered, inserted, msg);
        } catch (PortalException ignored) {}

        report.put("syncStatus", syncStatus);
        report.put("status", msg);
        report.put("inserted", inserted);
        return report;
    }

    private int parseRssAndSave(AnnouncementSource src, String xml) throws PortalException {
        int count = 0;
        Matcher m = RSS_ITEM_PATTERN.matcher(xml);
        while (m.find() && count < 10) {
            String item = m.group(1);
            String title = extractTag(item, "title");
            String link = extractTag(item, "link");
            String desc = extractTag(item, "description").replaceAll("<[^>]+>", " ").trim();
            if (!title.isBlank() && !link.isBlank() && !announcementDAO.existsBySourceUrl(link)) {
                Announcement a = buildSyncedAnnouncement(src, title, link, desc);
                announcementDAO.save(a);
                count++;
            }
        }
        return count;
    }

    private int parseHtmlLinksAndSave(AnnouncementSource src, String html) throws PortalException {
        int count = 0;
        URI base = URI.create(src.getBaseUrl());
        Matcher m = ANCHOR_PATTERN.matcher(html);
        while (m.find() && count < 12) {
            String href = m.group(1).trim();
            String text = m.group(2).replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
            if (text.length() < 12 || href.startsWith("#") || href.startsWith("javascript")) continue;
            String combined = (href + " " + text).toLowerCase();
            if (!combined.matches(".*(notif|circular|exam|result|placement|workshop|event|fdp|pdf|newsletter|student-services|evaluation).*")) {
                continue;
            }
            try {
                String resolved = base.resolve(href).toString();
                if (!announcementDAO.existsBySourceUrl(resolved)) {
                    Announcement a = buildSyncedAnnouncement(src, text, resolved,
                            "Official item synchronized from " + src.getSourceName());
                    announcementDAO.save(a);
                    count++;
                }
            } catch (Exception ignored) {}
        }
        return count;
    }

    private Announcement buildSyncedAnnouncement(AnnouncementSource src, String title, String url, String desc) {
        Announcement a = new Announcement();
        a.setTitle(title.length() > 240 ? title.substring(0, 240) : title);
        a.setCategoryId(classifyCategory(title + " " + url));
        a.setSourceId(src.getSourceId());
        a.setSourceName(src.getSourceName());
        a.setSourceUrl(url);
        a.setPublishedDate(Date.valueOf(LocalDate.now()));
        a.setDescription(desc.isBlank() ? title : desc);
        a.setRelevantBranches(src.getSourceName().contains("ECE") ? "ECE" : "ALL");
        a.setDepartmentCode(src.getSourceName().contains("ECE") ? "ECE" : null);
        a.setAcademicYear("2026-27");
        a.setHasAttachment(url.toLowerCase().endsWith(".pdf"));
        a.setAttachmentUrl(url.toLowerCase().endsWith(".pdf") ? url : null);
        a.setPriority("Normal");
        a.setVerifiedSource(true);
        return a;
    }

    public int classifyCategory(String text) {
        String t = text == null ? "" : text.toLowerCase();
        if (t.contains("result")) return 9;
        if (t.contains("timetable")) return 8;
        if (t.contains("exam") || t.contains("evaluation")) return 5;
        if (t.contains("intern")) return 3;
        if (t.contains("placement") || t.contains("finishing")) return 2;
        if (t.contains("workshop") || t.contains("fdp")) return 10;
        if (t.contains("hackathon")) return 12;
        if (t.contains("seminar")) return 13;
        if (t.contains("circular") || t.contains(".pdf")) return 6;
        return 1;
    }

    private String extractTag(String xml, String tag) {
        Matcher m = Pattern.compile("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", Pattern.CASE_INSENSITIVE).matcher(xml);
        if (!m.find()) return "";
        return m.group(1).replace("<![CDATA[", "").replace("]]>", "").trim();
    }
}
