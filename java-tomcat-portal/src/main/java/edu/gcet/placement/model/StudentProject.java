package edu.gcet.placement.model;

/**
 * Extended Student Project model inheriting core fields from Project.
 */
public class StudentProject extends Project {
    private String category;
    private String duration;
    private String liveUrl;
    private String teamMembers;
    private String roleInProject;

    public StudentProject() {
        super();
    }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public String getLiveUrl() { return liveUrl; }
    public void setLiveUrl(String liveUrl) { this.liveUrl = liveUrl; }
    public String getTeamMembers() { return teamMembers; }
    public void setTeamMembers(String teamMembers) { this.teamMembers = teamMembers; }
    public String getRoleInProject() { return roleInProject; }
    public void setRoleInProject(String roleInProject) { this.roleInProject = roleInProject; }
}
