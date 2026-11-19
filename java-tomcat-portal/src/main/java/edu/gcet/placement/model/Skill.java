package edu.gcet.placement.model;

public class Skill implements Identifiable {
    private int skillId;
    private String skillName;
    private String category;
    private String description;

    public Skill() {}

    public Skill(int skillId, String skillName, String category, String description) {
        this.skillId = skillId;
        this.skillName = skillName;
        this.category = category;
        this.description = description;
    }

    @Override public int getId() { return skillId; }
    @Override public void setId(int id) { this.skillId = id; }

    public int getSkillId() { return skillId; }
    public void setSkillId(int skillId) { this.skillId = skillId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
