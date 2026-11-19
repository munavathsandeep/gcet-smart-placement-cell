package edu.gcet.placement.model;

import java.sql.Date;

public class Announcement implements Identifiable {
    private int announcementId;
    private String title;
    private int categoryId;
    private String categoryName;
    private Integer sourceId;
    private String sourceName;
    private String sourceUrl;
    private Date publishedDate;
    private Date updatedDate;
    private String description;
    private String relevantBranches;
    private String departmentCode;
    private String academicYear;
    private Date deadlineDate;
    private boolean hasAttachment;
    private String attachmentUrl;
    private String priority; // Normal, Important, Urgent
    private boolean pinned;
    private boolean archived;
    private boolean verifiedSource;

    @Override public int getId() { return announcementId; }
    @Override public void setId(int id) { this.announcementId = id; }

    public int getAnnouncementId() { return announcementId; }
    public void setAnnouncementId(int announcementId) { this.announcementId = announcementId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getCategoryId() { return categoryId; }
    public void setCategoryId(int categoryId) { this.categoryId = categoryId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public Integer getSourceId() { return sourceId; }
    public void setSourceId(Integer sourceId) { this.sourceId = sourceId; }
    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public Date getPublishedDate() { return publishedDate; }
    public void setPublishedDate(Date publishedDate) { this.publishedDate = publishedDate; }
    public Date getUpdatedDate() { return updatedDate; }
    public void setUpdatedDate(Date updatedDate) { this.updatedDate = updatedDate; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRelevantBranches() { return relevantBranches; }
    public void setRelevantBranches(String relevantBranches) { this.relevantBranches = relevantBranches; }
    public String getDepartmentCode() { return departmentCode; }
    public void setDepartmentCode(String departmentCode) { this.departmentCode = departmentCode; }
    public String getAcademicYear() { return academicYear; }
    public void setAcademicYear(String academicYear) { this.academicYear = academicYear; }
    public Date getDeadlineDate() { return deadlineDate; }
    public void setDeadlineDate(Date deadlineDate) { this.deadlineDate = deadlineDate; }
    public boolean isHasAttachment() { return hasAttachment; }
    public void setHasAttachment(boolean hasAttachment) { this.hasAttachment = hasAttachment; }
    public String getAttachmentUrl() { return attachmentUrl; }
    public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public boolean isVerifiedSource() { return verifiedSource; }
    public void setVerifiedSource(boolean verifiedSource) { this.verifiedSource = verifiedSource; }
}
