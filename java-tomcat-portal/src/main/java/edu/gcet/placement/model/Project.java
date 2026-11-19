package edu.gcet.placement.model;

public class Project implements Identifiable {
    private int projectId;
    private int studentId;
    private String title;
    private String techStack;
    private String description;
    private String repoUrl;

    public Project() {}

    @Override public int getId() { return projectId; }
    @Override public void setId(int id) { this.projectId = id; }

    public int getProjectId() { return projectId; }
    public void setProjectId(int projectId) { this.projectId = projectId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getTechStack() { return techStack; }
    public void setTechStack(String techStack) { this.techStack = techStack; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRepoUrl() { return repoUrl; }
    public void setRepoUrl(String repoUrl) { this.repoUrl = repoUrl; }
}
