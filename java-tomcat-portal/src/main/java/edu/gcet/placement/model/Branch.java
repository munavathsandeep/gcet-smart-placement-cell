package edu.gcet.placement.model;

public class Branch implements Identifiable {
    private int branchId;
    private int deptId;
    private String deptCode;
    private String branchCode;
    private String branchName;
    private String degreeLevel; // B.Tech, M.Tech, MBA
    private boolean active;

    public Branch() {
        this.active = true;
    }

    @Override public int getId() { return branchId; }
    @Override public void setId(int id) { this.branchId = id; }

    public int getBranchId() { return branchId; }
    public void setBranchId(int branchId) { this.branchId = branchId; }
    public int getDeptId() { return deptId; }
    public void setDeptId(int deptId) { this.deptId = deptId; }
    public String getDeptCode() { return deptCode; }
    public void setDeptCode(String deptCode) { this.deptCode = deptCode; }
    public String getBranchCode() { return branchCode; }
    public void setBranchCode(String branchCode) { this.branchCode = branchCode; }
    public String getBranchName() { return branchName; }
    public void setBranchName(String branchName) { this.branchName = branchName; }
    public String getDegreeLevel() { return degreeLevel; }
    public void setDegreeLevel(String degreeLevel) { this.degreeLevel = degreeLevel; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
