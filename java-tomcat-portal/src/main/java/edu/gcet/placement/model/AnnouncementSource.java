package edu.gcet.placement.model;

import java.sql.Timestamp;

public class AnnouncementSource implements Identifiable {
    private int sourceId;
    private String sourceName;
    private String baseUrl;
    private String feedUrl;
    private String syncMode; // RSS, HTML, MANUAL
    private boolean enabled;
    private int syncIntervalMinutes;
    private Timestamp lastSyncedAt;
    private String lastSyncStatus;

    @Override public int getId() { return sourceId; }
    @Override public void setId(int id) { this.sourceId = id; }

    public int getSourceId() { return sourceId; }
    public void setSourceId(int sourceId) { this.sourceId = sourceId; }
    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getFeedUrl() { return feedUrl; }
    public void setFeedUrl(String feedUrl) { this.feedUrl = feedUrl; }
    public String getSyncMode() { return syncMode; }
    public void setSyncMode(String syncMode) { this.syncMode = syncMode; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getSyncIntervalMinutes() { return syncIntervalMinutes; }
    public void setSyncIntervalMinutes(int syncIntervalMinutes) { this.syncIntervalMinutes = syncIntervalMinutes; }
    public Timestamp getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Timestamp lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
    public String getLastSyncStatus() { return lastSyncStatus; }
    public void setLastSyncStatus(String lastSyncStatus) { this.lastSyncStatus = lastSyncStatus; }
}
