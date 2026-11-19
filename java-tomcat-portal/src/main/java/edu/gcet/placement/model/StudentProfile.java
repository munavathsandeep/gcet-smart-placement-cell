package edu.gcet.placement.model;

/**
 * Extended Official Student Profile (Sections A, B, H, I) stored separately from pending revisions.
 */
public class StudentProfile implements Identifiable {
    private int profileId;
    private int studentId;
    private String photoDataUrl;
    private String dateOfBirth;
    private String personalEmail;
    private String alternatePhone;
    private String city;
    private String state;
    private String pinCode;
    private String collegeName = "Geethanjali College of Engineering and Technology";
    private String registrationNumber;
    private int admissionYear;
    private double percentage;
    private int historyOfBacklogs;
    private String tenthMarks;
    private String interDiplomaMarks;
    private String universityName = "JNTU Hyderabad (UGC Autonomous)";

    // Section H: Professional Social Links
    private String linkedinUrl;
    private String githubUrl;
    private String portfolioUrl;
    private String personalWebsiteUrl;
    private String leetcodeUrl;
    private String hackerrankUrl;
    private String codechefUrl;
    private String geeksforgeeksUrl;

    // Section I: Resume PDF metadata
    private String resumeFileName;
    private int resumeFileSize;
    private String resumeDataUrl;

    @Override public int getId() { return profileId; }
    @Override public void setId(int id) { this.profileId = id; }

    public int getProfileId() { return profileId; }
    public void setProfileId(int profileId) { this.profileId = profileId; }
    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }
    public String getPhotoDataUrl() { return photoDataUrl; }
    public void setPhotoDataUrl(String photoDataUrl) { this.photoDataUrl = photoDataUrl; }
    public String getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getPersonalEmail() { return personalEmail; }
    public void setPersonalEmail(String personalEmail) { this.personalEmail = personalEmail; }
    public String getAlternatePhone() { return alternatePhone; }
    public void setAlternatePhone(String alternatePhone) { this.alternatePhone = alternatePhone; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPinCode() { return pinCode; }
    public void setPinCode(String pinCode) { this.pinCode = pinCode; }
    public String getCollegeName() { return collegeName; }
    public void setCollegeName(String collegeName) { this.collegeName = collegeName; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public int getAdmissionYear() { return admissionYear; }
    public void setAdmissionYear(int admissionYear) { this.admissionYear = admissionYear; }
    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }
    public int getHistoryOfBacklogs() { return historyOfBacklogs; }
    public void setHistoryOfBacklogs(int historyOfBacklogs) { this.historyOfBacklogs = historyOfBacklogs; }
    public String getTenthMarks() { return tenthMarks; }
    public void setTenthMarks(String tenthMarks) { this.tenthMarks = tenthMarks; }
    public String getInterDiplomaMarks() { return interDiplomaMarks; }
    public void setInterDiplomaMarks(String interDiplomaMarks) { this.interDiplomaMarks = interDiplomaMarks; }
    public String getUniversityName() { return universityName; }
    public void setUniversityName(String universityName) { this.universityName = universityName; }
    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String linkedinUrl) { this.linkedinUrl = linkedinUrl; }
    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }
    public String getPortfolioUrl() { return portfolioUrl; }
    public void setPortfolioUrl(String portfolioUrl) { this.portfolioUrl = portfolioUrl; }
    public String getPersonalWebsiteUrl() { return personalWebsiteUrl; }
    public void setPersonalWebsiteUrl(String personalWebsiteUrl) { this.personalWebsiteUrl = personalWebsiteUrl; }
    public String getLeetcodeUrl() { return leetcodeUrl; }
    public void setLeetcodeUrl(String leetcodeUrl) { this.leetcodeUrl = leetcodeUrl; }
    public String getHackerrankUrl() { return hackerrankUrl; }
    public void setHackerrankUrl(String hackerrankUrl) { this.hackerrankUrl = hackerrankUrl; }
    public String getCodechefUrl() { return codechefUrl; }
    public void setCodechefUrl(String codechefUrl) { this.codechefUrl = codechefUrl; }
    public String getGeeksforgeeksUrl() { return geeksforgeeksUrl; }
    public void setGeeksforgeeksUrl(String geeksforgeeksUrl) { this.geeksforgeeksUrl = geeksforgeeksUrl; }
    public String getResumeFileName() { return resumeFileName; }
    public void setResumeFileName(String resumeFileName) { this.resumeFileName = resumeFileName; }
    public int getResumeFileSize() { return resumeFileSize; }
    public void setResumeFileSize(int resumeFileSize) { this.resumeFileSize = resumeFileSize; }
    public String getResumeDataUrl() { return resumeDataUrl; }
    public void setResumeDataUrl(String resumeDataUrl) { this.resumeDataUrl = resumeDataUrl; }
}
