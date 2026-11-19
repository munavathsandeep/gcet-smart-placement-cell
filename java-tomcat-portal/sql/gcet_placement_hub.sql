-- ============================================================================
-- GCET PLACEMENT HUB
-- Smart Placement Cell & Skill Matrix Portal
-- Geethanjali College of Engineering and Technology (GCET), Hyderabad
-- Database: gcet_placement_hub (MySQL 8.0+ / MySQL Workbench Compatible)
-- ============================================================================

DROP DATABASE IF EXISTS gcet_placement_hub;
CREATE DATABASE gcet_placement_hub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gcet_placement_hub;

-- 1. Departments
CREATE TABLE departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_code VARCHAR(20) NOT NULL UNIQUE,
    dept_name VARCHAR(140) NOT NULL,
    hod_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Branches (Every GCET Engineering & PG Specialization Kept Distinct)
CREATE TABLE branches (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    branch_code VARCHAR(24) NOT NULL UNIQUE,
    branch_name VARCHAR(140) NOT NULL,
    degree_level ENUM('B.Tech', 'M.Tech', 'MBA') NOT NULL DEFAULT 'B.Tech',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_branch_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 3. Institutional Role Catalog
CREATE TABLE roles (
    role_code VARCHAR(32) PRIMARY KEY,
    role_title VARCHAR(80) NOT NULL,
    dashboard_route ENUM('EXECUTIVE', 'ADMIN', 'FACULTY', 'STUDENT', 'RECRUITER') NOT NULL,
    hierarchy_level TINYINT NOT NULL DEFAULT 5
) ENGINE=InnoDB;

-- 4. Users (Role-Based Access Control including Executive Governance, Faculty Coordinators & Recruiter Approval)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(128) NOT NULL,
    role ENUM('PRINCIPAL', 'VICE_CHAIRMAN', 'CHAIRMAN', 'ADMIN', 'PLACEMENT_OFFICER', 'FACULTY_COORDINATOR', 'FACULTY', 'STUDENT', 'RECRUITER') NOT NULL DEFAULT 'STUDENT',
    full_name VARCHAR(120) NOT NULL,
    employee_id VARCHAR(40) NULL UNIQUE,
    assigned_branch VARCHAR(120) NULL,
    designation VARCHAR(120) NULL,
    department_name VARCHAR(120) NULL,
    company_id INT NULL,
    approval_status ENUM('Approved', 'Pending', 'Rejected') NOT NULL DEFAULT 'Approved',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    password_change_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    password_change_dismissed_at TIMESTAMP NULL,
    created_by INT NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_email (email),
    INDEX idx_users_approval (approval_status),
    CONSTRAINT fk_user_role FOREIGN KEY (role) REFERENCES roles(role_code) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5. Faculty Coordinators
CREATE TABLE faculty (
    faculty_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    employee_id VARCHAR(40) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    dept_id INT NULL,
    branch_code VARCHAR(120) NULL,
    department_name VARCHAR(120) NULL,
    designation VARCHAR(120) NOT NULL DEFAULT 'Faculty Coordinator',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faculty_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_faculty_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL,
    INDEX idx_faculty_branch (branch_code)
) ENGINE=InnoDB;

-- 5b. Normalized Faculty Coordinator Branch Assignments (Official Department Isolation)
CREATE TABLE faculty_branch_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_user_id INT NOT NULL,
    branch_code VARCHAR(24) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fba_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT uq_faculty_branch UNIQUE (faculty_user_id, branch_code),
    INDEX idx_fba_branch (branch_code)
) ENGINE=InnoDB;

-- 6. Students
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    roll_number VARCHAR(24) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    dept_id INT NOT NULL,
    branch_id INT NOT NULL,
    branch_code VARCHAR(24) NOT NULL,
    academic_year VARCHAR(16) NOT NULL DEFAULT '2026-27',
    year_of_study TINYINT NOT NULL DEFAULT 4,
    semester TINYINT NOT NULL DEFAULT 7,
    section VARCHAR(8) NOT NULL DEFAULT 'A',
    graduation_year INT NOT NULL,
    cgpa DECIMAL(4,2) NOT NULL CHECK (cgpa >= 0.00 AND cgpa <= 10.00),
    active_backlogs INT NOT NULL DEFAULT 0,
    gender VARCHAR(20) NULL,
    address VARCHAR(255) NULL,
    resume_url VARCHAR(255) NULL,
    profile_photo_url VARCHAR(255) NULL,
    placement_status ENUM('Unplaced', 'In Process', 'Placed') NOT NULL DEFAULT 'Unplaced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_student_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE RESTRICT,
    INDEX idx_students_branch (branch_code),
    INDEX idx_students_grad (graduation_year),
    INDEX idx_students_cgpa (cgpa)
) ENGINE=InnoDB;

-- 7. Companies
CREATE TABLE companies (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(120) NOT NULL UNIQUE,
    logo_url VARCHAR(255) NULL,
    industry VARCHAR(100) NOT NULL,
    official_website VARCHAR(220) NOT NULL,
    career_page_url VARCHAR(255) NOT NULL,
    headquarters VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    is_directory_reference BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_industry (industry)
) ENGINE=InnoDB;

-- 8. Company Contacts
CREATE TABLE company_contacts (
    contact_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NULL,
    contact_email VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(30) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_cc_company FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Master Skills Catalog
CREATE TABLE skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(80) NOT NULL UNIQUE,
    category ENUM('Programming', 'Web Development', 'Database', 'Core Skills', 'Specialized Skills', 'Soft Skills') NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 10. Student Skills Matrix
CREATE TABLE student_skills (
    student_skill_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    skill_id INT NOT NULL,
    proficiency_level TINYINT NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ss_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_ss_skill FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE,
    CONSTRAINT uq_student_skill UNIQUE (student_id, skill_id)
) ENGINE=InnoDB;

-- 11. Student Projects
CREATE TABLE projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    tech_stack VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    repo_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_proj_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Student Certifications
CREATE TABLE certifications (
    cert_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    cert_name VARCHAR(150) NOT NULL,
    issuing_org VARCHAR(120) NOT NULL,
    issue_date DATE NOT NULL,
    credential_id VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cert_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. Placement Drives & Job Opportunities
CREATE TABLE placement_drives (
    drive_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    job_role VARCHAR(140) NOT NULL,
    job_description TEXT NOT NULL,
    job_location VARCHAR(120) NOT NULL DEFAULT 'Hyderabad',
    job_type ENUM('On-Campus Drive', 'Full-Time', 'Internship', 'Internship + Full-Time', 'Off-Campus') NOT NULL DEFAULT 'On-Campus Drive',
    salary_package DECIMAL(6,2) NOT NULL COMMENT 'Annual CTC in LPA or Stipend equivalent',
    compensation_label VARCHAR(60) NULL,
    apply_url VARCHAR(255) NULL,
    posted_date DATE NOT NULL,
    drive_date DATE NOT NULL,
    application_deadline DATE NOT NULL,
    drive_status ENUM('Planned', 'Active', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Planned',
    approval_status ENUM('Approved', 'Pending', 'Rejected') NOT NULL DEFAULT 'Approved',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_drive_company FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
    CONSTRAINT fk_drive_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_drive_status (drive_status),
    INDEX idx_drive_approval (approval_status),
    INDEX idx_drive_type (job_type)
) ENGINE=InnoDB;

-- 14. Drive Eligibility Criteria
CREATE TABLE drive_eligibility (
    eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
    drive_id INT NOT NULL UNIQUE,
    min_cgpa DECIMAL(4,2) NOT NULL DEFAULT 6.00,
    eligible_branches VARCHAR(255) NOT NULL,
    graduation_year INT NOT NULL,
    max_backlogs INT NOT NULL DEFAULT 0,
    other_criteria VARCHAR(255) NULL,
    CONSTRAINT fk_elig_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Drive Required Skills
CREATE TABLE drive_required_skills (
    drive_skill_id INT AUTO_INCREMENT PRIMARY KEY,
    drive_id INT NOT NULL,
    skill_id INT NOT NULL,
    required_level TINYINT NOT NULL CHECK (required_level BETWEEN 1 AND 5),
    weightage DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    CONSTRAINT fk_drs_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
    CONSTRAINT fk_drs_skill FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE,
    CONSTRAINT uq_drive_skill UNIQUE (drive_id, skill_id)
) ENGINE=InnoDB;

-- 16. Applications
CREATE TABLE applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    drive_id INT NOT NULL,
    student_id INT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Applied', 'Shortlisted', 'Assessment', 'Interview', 'Selected', 'Rejected') NOT NULL DEFAULT 'Applied',
    interview_date VARCHAR(40) NULL,
    interview_mode VARCHAR(80) NULL,
    remarks VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
    CONSTRAINT fk_app_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT uq_drive_student UNIQUE (drive_id, student_id),
    INDEX idx_app_status (status)
) ENGINE=InnoDB;

-- 17. Placements
CREATE TABLE placements (
    placement_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    drive_id INT NOT NULL,
    company_id INT NOT NULL,
    job_role VARCHAR(140) NOT NULL,
    package_lpa DECIMAL(6,2) NOT NULL,
    offer_date DATE NOT NULL,
    joining_status ENUM('Offered', 'Accepted', 'Joined', 'Declined') NOT NULL DEFAULT 'Offered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_place_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_place_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
    CONSTRAINT fk_place_company FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
    CONSTRAINT uq_student_drive_place UNIQUE (student_id, drive_id)
) ENGINE=InnoDB;

-- 18. Saved Jobs
CREATE TABLE saved_jobs (
    saved_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    drive_id INT NOT NULL,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sj_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_sj_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
    CONSTRAINT uq_user_saved_drive UNIQUE (user_id, drive_id)
) ENGINE=InnoDB;

-- 19. Announcement Sources
CREATE TABLE announcement_sources (
    source_id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(120) NOT NULL,
    base_url VARCHAR(255) NOT NULL UNIQUE,
    feed_url VARCHAR(255) NULL,
    sync_mode ENUM('RSS', 'HTML', 'MANUAL') NOT NULL DEFAULT 'HTML',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sync_interval_minutes INT NOT NULL DEFAULT 60,
    last_synced_at TIMESTAMP NULL,
    last_sync_status VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 20. Announcement Categories (All 18 Official Categories)
CREATE TABLE announcement_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 21. Announcements
CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    source_id INT NULL,
    source_name VARCHAR(120) NOT NULL,
    source_url VARCHAR(500) NOT NULL,
    published_date DATE NOT NULL,
    updated_date DATE NULL,
    description TEXT NOT NULL,
    relevant_branches VARCHAR(255) NOT NULL DEFAULT 'ALL',
    department_code VARCHAR(24) NULL,
    academic_year VARCHAR(16) NOT NULL DEFAULT '2026-27',
    deadline_date DATE NULL,
    has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
    attachment_url VARCHAR(500) NULL,
    priority ENUM('Normal', 'Important', 'Urgent') NOT NULL DEFAULT 'Normal',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified_source BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ann_cat FOREIGN KEY (category_id) REFERENCES announcement_categories(category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ann_src FOREIGN KEY (source_id) REFERENCES announcement_sources(source_id) ON DELETE SET NULL,
    CONSTRAINT fk_ann_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_ann_pub (published_date),
    INDEX idx_ann_branch (department_code)
) ENGINE=InnoDB;

-- 22. Notifications
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'General',
    link_url VARCHAR(500) NULL,
    related_module TEXT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 23. Activity Logs
CREATE TABLE activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    actor_name VARCHAR(120) NOT NULL,
    activity_type ENUM('STUDENT', 'COMPANY', 'DRIVE', 'ANNOUNCEMENT', 'APPLICATION') NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 24. Recruiter Profiles (Corporate Partner Verification & Approval Workflow)
CREATE TABLE recruiter_profiles (
    recruiter_profile_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    company_id INT NOT NULL,
    contact_person VARCHAR(120) NOT NULL,
    designation VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    official_email VARCHAR(120) NOT NULL,
    website VARCHAR(220) NULL,
    industry VARCHAR(100) NULL,
    approval_status ENUM('Approved', 'Pending', 'Rejected') NOT NULL DEFAULT 'Pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rp_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_company FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 25. Brute-Force Login Lockout Protection (5 Failed Attempts -> 15-Minute Lockout)
CREATE TABLE login_attempts (
    attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(120) NOT NULL UNIQUE,
    ip_address VARCHAR(64) NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL,
    last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 26. Password Reset & First-Login Audit History
CREATE TABLE password_reset_requests (
    reset_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(120) NOT NULL,
    status ENUM('Pending', 'Completed', 'Expired') NOT NULL DEFAULT 'Completed',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    CONSTRAINT fk_prr_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 27. Idempotent Seed History Tracking
CREATE TABLE seed_history (
    seed_key VARCHAR(80) PRIMARY KEY,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================================
-- PART 7: STUDENT PROFILE EXTENSION & FACULTY APPROVAL WORKFLOW TABLES
-- ============================================================================

-- 28. Extended Student Profiles (Personal & Academic Details)
CREATE TABLE student_profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    photo_data_url MEDIUMTEXT NULL,
    date_of_birth DATE NULL,
    personal_email VARCHAR(120) NULL,
    alternate_phone VARCHAR(30) NULL,
    city VARCHAR(80) NULL,
    state VARCHAR(80) NULL,
    pin_code VARCHAR(16) NULL,
    college_name VARCHAR(160) NOT NULL DEFAULT 'Geethanjali College of Engineering and Technology',
    registration_number VARCHAR(40) NULL,
    admission_year INT NULL,
    percentage DECIMAL(5,2) NULL,
    history_of_backlogs INT NOT NULL DEFAULT 0,
    tenth_marks VARCHAR(40) NULL,
    inter_diploma_marks VARCHAR(40) NULL,
    university_name VARCHAR(140) NOT NULL DEFAULT 'JNTU Hyderabad (UGC Autonomous)',
    last_approved_at TIMESTAMP NULL,
    last_approved_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sp_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_approver FOREIGN KEY (last_approved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE student_skills
    ADD COLUMN proficiency_label ENUM('Beginner', 'Intermediate', 'Advanced') NOT NULL DEFAULT 'Intermediate',
    ADD COLUMN experience_duration VARCHAR(60) NOT NULL DEFAULT '';

ALTER TABLE projects
    ADD COLUMN category VARCHAR(80) NULL DEFAULT '',
    ADD COLUMN duration VARCHAR(60) NULL DEFAULT '',
    ADD COLUMN live_url VARCHAR(255) NULL,
    ADD COLUMN team_members VARCHAR(160) NULL,
    ADD COLUMN role_in_project VARCHAR(100) NULL DEFAULT '';

ALTER TABLE certifications
    ADD COLUMN expiration_date DATE NULL,
    ADD COLUMN verification_url VARCHAR(255) NULL,
    ADD COLUMN certificate_file_name VARCHAR(160) NULL,
    ADD COLUMN certificate_file_data MEDIUMTEXT NULL;

-- 29. Student Internships & Industry Experience
CREATE TABLE student_internships (
    internship_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    company_name VARCHAR(140) NOT NULL,
    role VARCHAR(120) NOT NULL,
    duration VARCHAR(60) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT NOT NULL,
    technologies_used VARCHAR(255) NOT NULL,
    certificate_name VARCHAR(160) NULL,
    certificate_data MEDIUMTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_si_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 30. Student Achievements & Co-Curricular Activities
CREATE TABLE student_achievements (
    achievement_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'Technical Achievement',
    event_date DATE NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sa_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 31. Student Professional Social & Coding Links
CREATE TABLE student_social_links (
    link_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    linkedin_url VARCHAR(255) NULL,
    github_url VARCHAR(255) NULL,
    portfolio_url VARCHAR(255) NULL,
    personal_website_url VARCHAR(255) NULL,
    leetcode_url VARCHAR(255) NULL,
    hackerrank_url VARCHAR(255) NULL,
    codechef_url VARCHAR(255) NULL,
    geeksforgeeks_url VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ssl_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 32. Student Resume PDFs (Max 2 MB)
CREATE TABLE student_resumes (
    resume_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    file_name VARCHAR(180) NOT NULL,
    file_size INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(60) NOT NULL DEFAULT 'application/pdf',
    file_data_url MEDIUMTEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sr_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 33. Faculty-Student Branch/Section Assignments
CREATE TABLE faculty_student_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_user_id INT NOT NULL,
    student_id INT NOT NULL,
    branch_code VARCHAR(24) NOT NULL,
    section VARCHAR(8) NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fsa_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fsa_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT uq_faculty_student UNIQUE (faculty_user_id, student_id)
) ENGINE=InnoDB;

-- 34. Profile Submissions (Staged Pending Revisions — Never Overwrites Official Profile Until Approved)
CREATE TABLE profile_submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_code VARCHAR(40) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    assigned_faculty_id INT NULL,
    status ENUM('DRAFT', 'WAITING_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
    draft_payload_json LONGTEXT NOT NULL,
    previous_snapshot_json LONGTEXT NULL,
    changed_fields_json LONGTEXT NULL,
    submitted_at TIMESTAMP NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    faculty_remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_faculty FOREIGN KEY (assigned_faculty_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_ps_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_ps_status (status),
    INDEX idx_ps_student (student_id)
) ENGINE=InnoDB;

-- 35. Profile Submission Field-Level Diffs
CREATE TABLE profile_submission_details (
    detail_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    section_name VARCHAR(80) NOT NULL,
    field_key VARCHAR(80) NOT NULL,
    field_label VARCHAR(120) NOT NULL,
    previous_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    is_changed BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_psd_submission FOREIGN KEY (submission_id) REFERENCES profile_submissions(submission_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 36. Profile Approval Audit History
CREATE TABLE profile_approval_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    student_id INT NOT NULL,
    faculty_user_id INT NULL,
    faculty_name VARCHAR(120) NOT NULL,
    action ENUM('DRAFT_SAVED', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED') NOT NULL,
    remarks TEXT NULL,
    action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pah_submission FOREIGN KEY (submission_id) REFERENCES profile_submissions(submission_id) ON DELETE CASCADE,
    CONSTRAINT fk_pah_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_pah_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- SEED DATA: ALL 12 GCET BRANCHES, 16 RECRUITERS + DEMO, 25 SKILLS, 18 CATEGORIES, 5 SOURCES
-- ============================================================================

INSERT INTO departments (dept_code, dept_name, hod_name) VALUES
('CSE', 'Computer Science and Engineering', 'Dr. S. Nagini'),
('ECE', 'Electronics and Communication Engineering', 'Dr. B. L. Raju'),
('EEE', 'Electrical and Electronics Engineering', 'Dr. M. Surya Kalavathi'),
('ME', 'Mechanical Engineering', 'Dr. P. Srinivasulu'),
('CE', 'Civil Engineering', 'Dr. V. Mallikarjuna'),
('IT', 'Information Technology', 'Dr. K. Madhavi'),
('MBA', 'Master of Business Administration', 'Dr. A. Padmavathi');

INSERT INTO branches (dept_id, branch_code, branch_name, degree_level) VALUES
(1, 'CSE', 'Computer Science and Engineering', 'B.Tech'),
(1, 'CSE-AIML', 'CSE — Artificial Intelligence and Machine Learning', 'B.Tech'),
(1, 'CSE-DS', 'CSE — Data Science', 'B.Tech'),
(1, 'CSE-CS', 'CSE — Cyber Security', 'B.Tech'),
(1, 'CSE-IoT', 'CSE — Internet of Things', 'B.Tech'),
(2, 'ECE', 'Electronics and Communication Engineering', 'B.Tech'),
(3, 'EEE', 'Electrical and Electronics Engineering', 'B.Tech'),
(4, 'ME', 'Mechanical Engineering', 'B.Tech'),
(5, 'CE', 'Civil Engineering', 'B.Tech'),
(6, 'IT', 'Information Technology', 'B.Tech'),
(7, 'MBA', 'Master of Business Administration', 'MBA'),
(1, 'M.Tech CSE', 'M.Tech Computer Science and Engineering', 'M.Tech');

INSERT INTO announcement_categories (category_name) VALUES
('College Announcements'),
('Placement Notifications'),
('Internship Opportunities'),
('Job Notifications'),
('Examination Notifications'),
('Academic Circulars'),
('Internal Assessment Notifications'),
('Semester Examination Timetables'),
('Results Notifications'),
('Workshop Announcements'),
('Technical Events'),
('Hackathons'),
('Seminars and Guest Lectures'),
('Department Notifications'),
('Scholarships'),
('Government Notifications'),
('Competition Announcements'),
('Important Student Notices');

INSERT INTO announcement_sources (source_name, base_url, feed_url, sync_mode, is_enabled) VALUES
('GCET Official Website', 'https://gcet.edu.in/', 'https://gcet.edu.in/', 'HTML', TRUE),
('GCET ECE Department Website', 'https://www.gcetece.org/', 'https://www.gcetece.org/', 'HTML', TRUE),
('GCET Student Blog', 'https://blog.gcet.edu.in/', 'https://blog.gcet.edu.in/feeds/posts/default?alt=rss', 'RSS', TRUE),
('Geethanjali Institutions', 'https://www.geethanjaliinstitutions.com/', 'https://www.geethanjaliinstitutions.com/', 'HTML', TRUE),
('JNTUH Official Portal', 'https://jntuh.ac.in/', 'https://jntuh.ac.in/', 'HTML', TRUE);

INSERT INTO skills (skill_name, category) VALUES
('Java', 'Programming'),
('Python', 'Programming'),
('C', 'Programming'),
('C++', 'Programming'),
('HTML', 'Web Development'),
('CSS', 'Web Development'),
('JavaScript', 'Web Development'),
('React', 'Web Development'),
('MySQL', 'Database'),
('SQL', 'Database'),
('Database Management', 'Database'),
('Data Structures', 'Core Skills'),
('Algorithms', 'Core Skills'),
('Operating Systems', 'Core Skills'),
('Computer Networks', 'Core Skills'),
('Machine Learning', 'Specialized Skills'),
('Artificial Intelligence', 'Specialized Skills'),
('Data Analytics', 'Specialized Skills'),
('Cyber Security', 'Specialized Skills'),
('Cloud Computing', 'Specialized Skills'),
('IoT', 'Specialized Skills'),
('Communication', 'Soft Skills'),
('Leadership', 'Soft Skills'),
('Problem Solving', 'Soft Skills'),
('Teamwork', 'Soft Skills');

INSERT INTO companies (company_name, industry, official_website, career_page_url, headquarters, description, is_directory_reference) VALUES
('TCS', 'IT Services & Consulting', 'https://www.tcs.com', 'https://www.tcs.com/careers', 'Mumbai, India', 'Directory reference from GCET placement publications. Global IT services, consulting, and business solutions organization.', TRUE),
('Wipro', 'IT Services & Consulting', 'https://www.wipro.com', 'https://careers.wipro.com', 'Bengaluru, India', 'Directory reference from GCET placement publications. Technology services and digital transformation company.', TRUE),
('Cognizant', 'IT & Digital Engineering', 'https://www.cognizant.com', 'https://careers.cognizant.com', 'Teaneck, NJ / India', 'Directory reference from GCET placement publications. Multinational IT consulting and software engineering firm.', TRUE),
('Accenture', 'Technology & Strategy', 'https://www.accenture.com', 'https://www.accenture.com/in-en/careers', 'Dublin / India', 'Directory reference from GCET placement publications. Global professional services and cloud engineering company.', TRUE),
('IBM', 'Enterprise Technology & AI', 'https://www.ibm.com', 'https://www.ibm.com/careers', 'Armonk, NY / India', 'Directory reference from GCET placement publications. Hybrid cloud, enterprise AI, and systems software leader.', TRUE),
('Capgemini', 'Consulting & Technology', 'https://www.capgemini.com', 'https://www.capgemini.com/careers/', 'Paris / India', 'Directory reference from GCET placement publications. Global consulting, engineering, and digital services group.', TRUE),
('CommVault', 'Enterprise Data & Cloud', 'https://www.commvault.com', 'https://careers.commvault.com/', 'Tinton Falls, NJ / Hyderabad', 'Directory reference from GCET placement publications. Cloud data protection and cyber resilience software company.', TRUE),
('Amadeus', 'Travel Technology', 'https://amadeus.com', 'https://jobs.amadeus.com/', 'Madrid / Bengaluru', 'Directory reference from GCET placement publications. Global travel technology and large-scale distributed software provider.', TRUE),
('EPAM', 'Software Product Engineering', 'https://www.epam.com', 'https://www.epam.com/careers', 'Newtown, PA / Hyderabad', 'Directory reference from GCET placement publications. Digital platform engineering and software development services.', TRUE),
('DBS Bank', 'Banking & FinTech', 'https://www.dbs.com', 'https://www.dbs.com/careers', 'Singapore / Hyderabad', 'Directory reference from GCET placement publications. Leading Asian financial services and technology hub.', TRUE),
('Virtusa', 'Digital Engineering', 'https://www.virtusa.com', 'https://www.virtusa.com/careers', 'Southborough, MA / Hyderabad', 'Directory reference from GCET placement publications. Global IT consulting and digital engineering services.', TRUE),
('Tech Mahindra', 'IT & Telecom Engineering', 'https://www.techmahindra.com', 'https://careers.techmahindra.com/', 'Pune / Hyderabad', 'Directory reference from GCET placement publications. Connected world technology, 5G, and enterprise IT solutions.', TRUE),
('ADP', 'HR & Payroll Technology', 'https://www.adp.com', 'https://jobs.adp.com/', 'Roseland, NJ / Hyderabad', 'Directory reference from GCET placement publications. Global human capital management software and cloud solutions.', TRUE),
('ValueLabs', 'Product & Digital Services', 'https://www.valuelabs.com', 'https://www.valuelabs.com/careers/', 'Hyderabad, India', 'Directory reference from GCET placement publications. Software product development, data, and design company.', TRUE),
('Deloitte', 'Consulting & Advisory', 'https://www2.deloitte.com', 'https://www2.deloitte.com/ui/en/careers.html', 'London / Hyderabad USI', 'Directory reference from GCET placement publications. Enterprise technology consulting, cloud, and cyber advisory.', TRUE),
('Infosys', 'IT Services & Digital', 'https://www.infosys.com', 'https://www.infosys.com/careers/', 'Bengaluru / Hyderabad', 'Directory reference from GCET placement publications. Next-generation digital services and consulting leader.', TRUE),
('Amazon', 'Cloud & E-Commerce Technology', 'https://www.amazon.jobs', 'https://www.amazon.jobs/en/teams/university-tech', 'Seattle / Hyderabad', 'Directory reference from GCET placement publications. Software Development Engineer, Cloud Support, and Data Engineering roles.', TRUE),
('Microsoft', 'Enterprise Software & Cloud', 'https://careers.microsoft.com', 'https://careers.microsoft.com/students', 'Redmond / Hyderabad', 'Directory reference from GCET placement publications. Software Engineering, Azure Cloud, and AI Platform opportunities.', TRUE),
('HCLTech', 'IT Engineering & Digital', 'https://www.hcltech.com', 'https://www.hcltech.com/careers', 'Noida / Hyderabad', 'Directory reference from GCET placement publications. Digital engineering, cloud infrastructure, and enterprise IT services.', TRUE),
('Acme Technologies (Demo Recruiter)', 'Enterprise Cloud & AI Solutions', 'https://acme.example', 'https://acme.example/careers', 'Hyderabad, India', 'Approved demo corporate partner organization for GCET Placement Hub verification.', FALSE);

INSERT INTO roles (role_code, role_title, dashboard_route, hierarchy_level) VALUES
('CHAIRMAN', 'Chairman', 'EXECUTIVE', 1),
('VICE_CHAIRMAN', 'Vice Chairman', 'EXECUTIVE', 1),
('PRINCIPAL', 'Principal', 'EXECUTIVE', 1),
('ADMIN', 'System Administrator', 'ADMIN', 2),
('PLACEMENT_OFFICER', 'Placement Officer', 'ADMIN', 2),
('FACULTY_COORDINATOR', 'Faculty Coordinator', 'FACULTY', 3),
('FACULTY', 'Faculty Coordinator (Legacy)', 'FACULTY', 3),
('RECRUITER', 'Corporate Recruiter', 'RECRUITER', 4),
('STUDENT', 'Student', 'STUDENT', 5);

-- 37. Announcement Sync Execution Audit Logs
CREATE TABLE announcement_sync_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    source_id INT NULL,
    source_name VARCHAR(120) NOT NULL,
    sync_status ENUM('SUCCESS', 'WARNING', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
    items_fetched INT NOT NULL DEFAULT 0,
    items_inserted INT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_asl_source FOREIGN KEY (source_id) REFERENCES announcement_sources(source_id) ON DELETE SET NULL,
    INDEX idx_asl_synced_at (synced_at)
) ENGINE=InnoDB;

-- 38. Institutional Portal Configuration Settings
CREATE TABLE app_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO app_settings (setting_key, setting_value) VALUES
('sync_interval_minutes', '60');

INSERT INTO announcement_sync_logs (source_id, source_name, sync_status, items_fetched, items_inserted, error_message) VALUES
(1, 'GCET Official Website', 'SUCCESS', 1, 0, 'Initial verified institutional portal seed checkpoint.');

CREATE TABLE IF NOT EXISTS faculty_profiles (
    faculty_profile_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id INT NOT NULL UNIQUE,
    user_id INT NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    alternate_phone VARCHAR(30) NULL,
    personal_email VARCHAR(120) NULL,
    qualification VARCHAR(160) NULL,
    specialization VARCHAR(160) NULL,
    experience_years DECIMAL(4,1) NULL,
    office_room VARCHAR(80) NULL,
    bio TEXT NULL,
    research_interests TEXT NULL,
    publications_summary TEXT NULL,
    certifications_summary TEXT NULL,
    achievements_summary TEXT NULL,
    linkedin_url VARCHAR(255) NULL,
    google_scholar_url VARCHAR(255) NULL,
    orcid_url VARCHAR(255) NULL,
    github_url VARCHAR(255) NULL,
    photo_data_url MEDIUMTEXT NULL,
    last_approved_at TIMESTAMP NULL,
    last_approved_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fp_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    CONSTRAINT fk_fp_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fp_approver FOREIGN KEY (last_approved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS faculty_skills (
    faculty_skill_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id INT NOT NULL,
    user_id INT NOT NULL,
    skill_id INT NULL,
    skill_name VARCHAR(80) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'Technical',
    proficiency_level TINYINT NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
    proficiency_label ENUM('Beginner', 'Intermediate', 'Advanced') NOT NULL DEFAULT 'Intermediate',
    experience_duration VARCHAR(60) NOT NULL DEFAULT '',
    verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fs_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_skill FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE SET NULL,
    CONSTRAINT uq_faculty_skill UNIQUE (faculty_id, skill_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS faculty_profile_submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_code VARCHAR(40) NOT NULL UNIQUE,
    faculty_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('DRAFT', 'WAITING_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
    draft_payload_json LONGTEXT NOT NULL,
    previous_snapshot_json LONGTEXT NULL,
    changed_fields_json LONGTEXT NULL,
    submitted_at TIMESTAMP NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    reviewer_remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fps_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    CONSTRAINT fk_fps_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fps_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS faculty_profile_approval_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    faculty_id INT NOT NULL,
    reviewer_user_id INT NULL,
    reviewer_name VARCHAR(120) NOT NULL,
    action ENUM('DRAFT_SAVED', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED') NOT NULL,
    remarks TEXT NULL,
    action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fpah_submission FOREIGN KEY (submission_id) REFERENCES faculty_profile_submissions(submission_id) ON DELETE CASCADE,
    CONSTRAINT fk_fpah_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    CONSTRAINT fk_fpah_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

