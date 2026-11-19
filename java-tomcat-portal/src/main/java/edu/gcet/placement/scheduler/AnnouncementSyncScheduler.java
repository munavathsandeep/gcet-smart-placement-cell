package edu.gcet.placement.scheduler;

import edu.gcet.placement.config.DatabaseConfig;
import edu.gcet.placement.dao.AnnouncementDAO;
import edu.gcet.placement.service.AnnouncementSyncService;
import edu.gcet.placement.service.NotificationService;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Background scheduler starting with Apache Tomcat context initialization.
 * Periodically synchronizes verified GCET &amp; JNTUH official announcement feeds
 * and triggers approaching drive deadline notifications for eligible students.
 */
@WebListener
public class AnnouncementSyncScheduler implements ServletContextListener {
    private ScheduledExecutorService executor;
    private final AnnouncementSyncService syncService = new AnnouncementSyncService();
    private final AnnouncementDAO announcementDAO = new AnnouncementDAO();
    private final NotificationService notificationService = new NotificationService();

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        long intervalMinutes = 60;
        try {
            if (!DatabaseConfig.hasPlaceholderCredentials()) {
                intervalMinutes = Math.max(15, announcementDAO.getConfiguredSyncIntervalMinutes());
            }
        } catch (Exception ignored) {
        }

        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "gcet-announcement-sync-scheduler");
            t.setDaemon(true);
            return t;
        });

        executor.scheduleAtFixedRate(() -> {
            if (DatabaseConfig.hasPlaceholderCredentials()) {
                return;
            }
            try {
                syncService.syncAllEnabledSources();
                notificationService.checkUpcomingDriveDeadlines();
            } catch (Exception ignored) {
                // Keep background scheduler resilient if external network is offline
            }
        }, 2, intervalMinutes, TimeUnit.MINUTES);
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        if (executor != null) {
            executor.shutdownNow();
        }
        DatabaseConfig.shutdown();
    }
}
