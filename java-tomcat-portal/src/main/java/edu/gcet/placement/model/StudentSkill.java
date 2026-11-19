package edu.gcet.placement.model;

public class StudentSkill implements Identifiable {
    private int studentSkillId;
    private int studentId;
    private int skillId;
    private String skillName;
    private String category;
    private int proficiencyLevel; // 1 to 5
    private boolean verified;

    public StudentSkill() {}

    public StudentSkill(int studentId, int skillId, String skillName, String category, int proficiencyLevel, boolean verified) {
        this.studentId = studentId;
        this.skillId = skillId;
        this.skillName = skillName;
        this.category = category;
        this.proficiencyLevel = Math.max(1, Math.min(5, proficiencyLevel));
        this.verified = verified;
    }

    @Override public int getId() { return studentSkillId; }
    @Override public void setId(int id) { this.studentSkillId = id; }

    public int getStudentSkillId() { return studentSkillId; }
    public void setStudentSkillId(int studentSkillId) { this.studentSkillId = studentSkillId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public int getSkillId() { return skillId; }
    public void setSkillId(int skillId) { this.skillId = skillId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public int getProficiencyLevel() { return proficiencyLevel; }
    public void setProficiencyLevel(int proficiencyLevel) { this.proficiencyLevel = Math.max(1, Math.min(5, proficiencyLevel)); }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
}
