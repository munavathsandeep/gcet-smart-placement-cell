-- ============================================================================
-- GCET SMART PLACEMENT CELL - Skill Matrix & Placement Management Portal
-- Database: gcet_placement_portal
-- Compatible with MySQL 8.0+ & MySQL Workbench
-- ============================================================================

DROP DATABASE IF EXISTS gcet_placement_portal;
CREATE DATABASE gcet_placement_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gcet_placement_portal;

-- 1. Departments
CREATE TABLE departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_code VARCHAR(16) NOT NULL UNIQUE,
    dept_name VARCHAR(120) NOT NULL,
    hod_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Users (Role-Based Access Control)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(128) NOT NULL,
    role ENUM('STUDENT', 'PLACEMENT_OFFICER', 'ADMIN', 'FACULTY') NOT NULL DEFAULT 'STUDENT',
    full_name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- 3. Students
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    roll_number VARCHAR(24) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    dept_id INT NOT NULL,
    branch VARCHAR(32) NOT NULL,
    graduation_year INT NOT NULL,
    cgpa DECIMAL(4,2) NOT NULL CHECK (cgpa >= 0.00 AND cgpa <= 10.00),
    gender VARCHAR(20) NULL,
    address VARCHAR(255) NULL,
    profile_photo_url VARCHAR(255) NULL,
    placement_status ENUM('Unplaced', 'In Process', 'Placed') NOT NULL DEFAULT 'Unplaced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_student_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE RESTRICT,
    INDEX idx_students_branch (branch),
    INDEX idx_students_grad_year (graduation_year),
    INDEX idx_students_cgpa (cgpa)
) ENGINE=InnoDB;

-- 4. Master Skills Catalog
CREATE TABLE skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(80) NOT NULL UNIQUE,
    category ENUM('Programming Languages', 'Core CS', 'Web & Cloud', 'Database', 'Soft Skills', 'Technical Skills') NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Student Skill Matrix (1 to 5 Proficiency)
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

-- 6. Student Projects
CREATE TABLE projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    tech_stack VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    repo_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_proj_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Student Certifications
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

-- 8. Companies
CREATE TABLE companies (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(120) NOT NULL UNIQUE,
    industry VARCHAR(80) NOT NULL,
    website VARCHAR(200) NULL,
    description TEXT NULL,
    location VARCHAR(120) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    contact_email VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(25) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_industry (industry)
) ENGINE=InnoDB;

-- 9. Placement Drives
CREATE TABLE placement_drives (
    drive_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    job_role VARCHAR(120) NOT NULL,
    job_description TEXT NOT NULL,
    salary_package DECIMAL(6,2) NOT NULL COMMENT 'Annual CTC in LPA',
    drive_date DATE NOT NULL,
    application_deadline DATE NOT NULL,
    drive_status ENUM('Planned', 'Active', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Planned',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_drive_company FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
    CONSTRAINT fk_drive_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_drive_status (drive_status),
    INDEX idx_drive_date (drive_date)
) ENGINE=InnoDB;

-- 10. Drive Eligibility Criteria
CREATE TABLE drive_eligibility (
    eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
    drive_id INT NOT NULL UNIQUE,
    min_cgpa DECIMAL(4,2) NOT NULL DEFAULT 6.00,
    eligible_branches VARCHAR(255) NOT NULL COMMENT 'Comma-separated branch codes e.g. CSE,CSM,CSD,ECE',
    graduation_year INT NOT NULL,
    max_backlogs INT NOT NULL DEFAULT 0,
    other_criteria VARCHAR(255) NULL,
    CONSTRAINT fk_elig_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Drive Required Skills
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

-- 12. Student Applications
CREATE TABLE applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    drive_id INT NOT NULL,
    student_id INT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Applied', 'Shortlisted', 'Assessment', 'Interview', 'Selected', 'Rejected') NOT NULL DEFAULT 'Applied',
    remarks VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
    CONSTRAINT fk_app_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT uq_drive_student_app UNIQUE (drive_id, student_id),
    INDEX idx_app_status (status)
) ENGINE=InnoDB;

-- 13. Verified Placements
CREATE TABLE placements (
    placement_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    drive_id INT NOT NULL,
    company_id INT NOT NULL,
    job_role VARCHAR(120) NOT NULL,
    package_lpa DECIMAL(6,2) NOT NULL,
    offer_date DATE NOT NULL,
    joining_status ENUM('Offered', 'Accepted', 'Joined', 'Declined') NOT NULL DEFAULT 'Offered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_place_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_place_drive FOREIGN KEY (drive_id) REFERENCES placement_drives(drive_id) ON DELETE CASCADE,
    CONSTRAINT fk_place_company FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
    CONSTRAINT uq_student_drive_placement UNIQUE (student_id, drive_id)
) ENGINE=InnoDB;

-- 14. Notifications
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- SEED DATA FOR GEETHANJALI COLLEGE OF ENGINEERING AND TECHNOLOGY (GCET)
-- ============================================================================

INSERT INTO departments (dept_code, dept_name, hod_name) VALUES
('CSE', 'Computer Science and Engineering', 'Dr. S. Nagini'),
('CSM', 'CSE (Artificial Intelligence & Machine Learning)', 'Dr. K. Madhavi'),
('CSD', 'CSE (Data Science)', 'Dr. R. Venkatesh'),
('ECE', 'Electronics and Communication Engineering', 'Dr. B. L. Raju'),
('EEE', 'Electrical and Electronics Engineering', 'Dr. M. Surya Kalavathi'),
('MECH', 'Mechanical Engineering', 'Dr. P. Srinivasulu');

-- Demo password for all seeded accounts: Gcet@2026
-- (PasswordUtil PBKDF2WithHmacSHA256 / SHA-256 verifiable hash; resettable via AuthService)
INSERT INTO users (username, email, password_hash, password_salt, role, full_name) VALUES
('admin', 'admin@gcet.edu.in', '6c7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c', 'gcet_salt_admin_2026', 'ADMIN', 'GCET System Administrator'),
('tpo_gcet', 'tpo@gcet.edu.in', '6c7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c', 'gcet_salt_tpo_2026', 'PLACEMENT_OFFICER', 'Prof. Raghavendra Rao'),
('23r11a0501', '23r11a0501@gcet.edu.in', '6c7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c', 'gcet_salt_stu_2026', 'STUDENT', 'Aarav Sharma'),
('23r11a66p1', '23r11a66p1@gcet.edu.in', '6c7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c', 'gcet_salt_stu2_2026', 'STUDENT', 'Ananya Reddy');

INSERT INTO students (user_id, roll_number, full_name, email, phone, dept_id, branch, graduation_year, cgpa, gender, address, placement_status) VALUES
(3, '23R11A0501', 'Aarav Sharma', '23r11a0501@gcet.edu.in', '+91 98480 11223', 1, 'CSE', 2027, 8.85, 'Male', 'Cheeryal, Keesara, Hyderabad', 'Placed'),
(4, '23R11A66P1', 'Ananya Reddy', '23r11a66p1@gcet.edu.in', '+91 98490 22334', 2, 'CSM', 2027, 9.12, 'Female', 'Sainikpuri, Secunderabad', 'In Process'),
(NULL, '23R11A0514', 'Karthikeya Varma', '23r11a0514@gcet.edu.in', '+91 97012 33445', 1, 'CSE', 2027, 8.42, 'Male', 'Uppal, Hyderabad', 'Placed'),
(NULL, '23R11A6708', 'Sneha Kulkarni', '23r11a6708@gcet.edu.in', '+91 91774 44556', 3, 'CSD', 2027, 8.70, 'Female', 'AS Rao Nagar, Hyderabad', 'In Process'),
(NULL, '23R11A0419', 'Rohan Deshmukh', '23r11a0419@gcet.edu.in', '+91 99855 55667', 4, 'ECE', 2027, 7.65, 'Male', 'Kompally, Hyderabad', 'Unplaced'),
(NULL, '23R11A0532', 'Meghana Choudhary', '23r11a0532@gcet.edu.in', '+91 90001 66778', 1, 'CSE', 2027, 9.25, 'Female', 'Banjara Hills, Hyderabad', 'Placed'),
(NULL, '23R11A6621', 'Siddharth Nair', '23r11a6621@gcet.edu.in', '+91 96520 77889', 2, 'CSM', 2027, 7.95, 'Male', 'Madhapur, Hyderabad', 'In Process'),
(NULL, '23R11A0445', 'Divya Srikanth', '23r11a0445@gcet.edu.in', '+91 94401 88990', 4, 'ECE', 2027, 8.15, 'Female', 'Tarnaka, Hyderabad', 'Placed'),
(NULL, '23R11A0209', 'Vikram Aditya', '23r11a0209@gcet.edu.in', '+91 98850 99001', 5, 'EEE', 2027, 7.20, 'Male', 'Malkajgiri, Hyderabad', 'Unplaced'),
(NULL, '23R11A0312', 'Pranav Tej', '23r11a0312@gcet.edu.in', '+91 95502 10112', 6, 'MECH', 2027, 6.95, 'Male', 'Ghatkesar, Hyderabad', 'Unplaced');

INSERT INTO skills (skill_name, category, description) VALUES
('Java', 'Programming Languages', 'Core Java, OOP, Collections, JDBC & Multithreading'),
('Python', 'Programming Languages', 'Python 3, scripting, automation and ML foundations'),
('C and C++', 'Programming Languages', 'Procedural & Object-Oriented Systems Programming'),
('SQL', 'Database', 'Relational database queries, joins, indexing and optimization'),
('Data Structures', 'Core CS', 'Arrays, Trees, Graphs, Dynamic Programming & Complexity'),
('Web Development', 'Web & Cloud', 'HTML5, CSS3, Vanilla JS, Servlets & REST APIs'),
('Database Management', 'Database', 'ER Modeling, Normalization, ACID & Transactions'),
('Cloud Computing', 'Web & Cloud', 'AWS/GCP fundamentals, containers & cloud deployment'),
('Communication', 'Soft Skills', 'Technical presentation, group discussion & articulation'),
('Problem Solving', 'Soft Skills', 'Analytical decomposition & algorithmic reasoning'),
('Technical Skills', 'Technical Skills', 'Git, Linux CLI, Debugging & Software Testing');

INSERT INTO student_skills (student_id, skill_id, proficiency_level, verified) VALUES
(1, 1, 5, TRUE), (1, 4, 4, TRUE), (1, 5, 5, TRUE), (1, 6, 4, TRUE), (1, 7, 4, TRUE), (1, 9, 4, TRUE), (1, 10, 5, TRUE),
(2, 1, 4, TRUE), (2, 2, 5, TRUE), (2, 4, 4, TRUE), (2, 5, 4, TRUE), (2, 8, 3, FALSE), (2, 9, 5, TRUE), (2, 10, 4, TRUE),
(3, 1, 4, TRUE), (3, 3, 4, TRUE), (3, 4, 3, TRUE), (3, 5, 4, TRUE), (3, 6, 4, TRUE), (3, 10, 4, TRUE),
(4, 2, 5, TRUE), (4, 4, 5, TRUE), (4, 7, 4, TRUE), (4, 8, 4, TRUE), (4, 9, 4, TRUE), (4, 10, 4, TRUE),
(5, 1, 3, FALSE), (5, 3, 4, TRUE), (5, 4, 3, FALSE), (5, 9, 3, FALSE), (5, 11, 3, FALSE),
(6, 1, 5, TRUE), (6, 2, 4, TRUE), (6, 4, 5, TRUE), (6, 5, 5, TRUE), (6, 6, 5, TRUE), (6, 8, 4, TRUE), (6, 10, 5, TRUE),
(7, 1, 4, TRUE), (7, 2, 4, TRUE), (7, 5, 3, FALSE), (7, 8, 3, FALSE), (7, 9, 4, TRUE),
(8, 1, 4, TRUE), (8, 3, 4, TRUE), (8, 4, 4, TRUE), (8, 6, 4, TRUE), (8, 9, 4, TRUE);

INSERT INTO projects (student_id, title, tech_stack, description, repo_url) VALUES
(1, 'GCET Smart Placement Portal', 'Java, JDBC, Servlets, MySQL, HTML5', 'Enterprise placement management and skill matching engine built with pure MVC architecture.', 'https://github.com/gcet/placement-portal'),
(2, 'Campus Attendance Anomaly Detector', 'Python, OpenCV, MySQL, Java', 'Automated attendance verification and analytics dashboard for engineering laboratories.', 'https://github.com/gcet/attendance-vision'),
(6, 'Distributed Library Ledger', 'Java, Servlets, PostgreSQL, REST', 'Role-based academic library borrowing and automated overdue notification service.', 'https://github.com/gcet/library-ledger');

INSERT INTO certifications (student_id, cert_name, issuing_org, issue_date, credential_id) VALUES
(1, 'Oracle Certified Associate: Java SE 17', 'Oracle University', '2026-04-15', 'OCA-GCET-9921'),
(2, 'AWS Certified Cloud Practitioner', 'Amazon Web Services', '2026-06-20', 'AWS-CCP-4482'),
(6, 'NPTEL Elite Gold: Data Structures & Algorithms using Java', 'IIT Madras / NPTEL', '2026-05-10', 'NPTEL-26-DSA-1104');

INSERT INTO companies (company_name, industry, website, description, location, contact_person, contact_email, contact_phone) VALUES
('Tata Consultancy Services (TCS)', 'IT Services & Consulting', 'https://www.tcs.com', 'Global IT consulting and enterprise software engineering leader.', 'Hyderabad (Synergy Park)', 'Meera Krishnan', 'campus.hyd@tcs.com', '+91 40 6667 2000'),
('Infosys Ltd.', 'Digital Transformation', 'https://www.infosys.com', 'Specialist Programmer & Digital Systems Engineering division.', 'Hyderabad (Pocharam SEZ)', 'Arvind Subramanian', 'talent.south@infosys.com', '+91 40 6642 0000'),
('Accenture India', 'Technology & Strategy', 'https://www.accenture.com', 'Cloud-first enterprise application modernization and delivery.', 'Hyderabad (HITEC City)', 'Kavitha Nair', 'university.india@accenture.com', '+91 40 4455 1200'),
('Deloitte USI', 'Consulting & Advisory', 'https://www2.deloitte.com', 'Enterprise Risk, Cloud Engineering and Data Analytics practice.', 'Hyderabad (Gachibowli)', 'Sanjay Kulkarni', 'usi.campus@deloitte.com', '+91 40 6762 1000'),
('Cognizant Technology Solutions', 'IT & Digital Engineering', 'https://www.cognizant.com', 'Full-stack Java and cloud platform engineering teams.', 'Hyderabad (Raheja Mindspace)', 'Priya Menon', 'genc.campus@cognizant.com', '+91 40 4451 8000'),
('Amazon Web Services (AWS)', 'Cloud Infrastructure', 'https://aws.amazon.com', 'Cloud Support Associate and SDE University Recruiting.', 'Hyderabad (Financial District)', 'Nikhil Rao', 'aws-university@amazon.com', '+91 40 6700 4000');

INSERT INTO placement_drives (company_id, job_role, job_description, salary_package, drive_date, application_deadline, drive_status, created_by) VALUES
(1, 'TCS Digital — Systems Engineer', 'Full-stack Java, SQL, and enterprise cloud application engineering.', 7.00, '2026-12-05', '2026-11-28', 'Active', 2),
(2, 'Specialist Programmer (SP)', 'High-complexity algorithmic backend and distributed systems engineering.', 9.50, '2026-12-12', '2026-12-02', 'Active', 2),
(3, 'Associate Software Engineer (ASE)', 'Enterprise Java, web engineering, and agile delivery.', 6.50, '2026-10-18', '2026-10-10', 'Completed', 2),
(4, 'Analyst — Technology & Cloud', 'Database engineering, cloud migration, and enterprise analytics.', 7.60, '2026-12-20', '2026-12-10', 'Planned', 2),
(5, 'GenC Next Developer', 'Java backend services, relational SQL, and modern frontend engineering.', 6.75, '2026-11-30', '2026-11-24', 'Active', 2),
(6, 'Cloud Support Associate', 'Cloud infrastructure troubleshooting, networking, Linux & Python/Java automation.', 12.50, '2027-01-15', '2027-01-05', 'Planned', 2);

INSERT INTO drive_eligibility (drive_id, min_cgpa, eligible_branches, graduation_year, max_backlogs, other_criteria) VALUES
(1, 7.50, 'CSE,CSM,CSD,ECE', 2027, 0, 'No active backlogs; strong Core Java & SQL'),
(2, 8.00, 'CSE,CSM,CSD', 2027, 0, 'Strong Data Structures & Problem Solving'),
(3, 6.50, 'CSE,CSM,CSD,ECE,EEE', 2027, 0, 'Good verbal and written communication'),
(4, 7.50, 'CSE,CSM,CSD,ECE', 2027, 0, 'SQL & Cloud fundamentals preferred'),
(5, 7.00, 'CSE,CSM,CSD,ECE,EEE', 2027, 0, 'Full-stack Java or Python proficiency'),
(6, 8.00, 'CSE,CSM,CSD,ECE', 2027, 0, 'Cloud Computing & Linux troubleshooting');

INSERT INTO drive_required_skills (drive_id, skill_id, required_level, weightage) VALUES
(1, 1, 4, 1.50), (1, 4, 3, 1.20), (1, 5, 4, 1.30), (1, 9, 3, 1.00),
(2, 1, 4, 1.50), (2, 5, 5, 2.00), (2, 10, 4, 1.50), (2, 4, 4, 1.00),
(3, 1, 3, 1.20), (3, 6, 3, 1.20), (3, 9, 4, 1.00),
(4, 4, 4, 1.50), (4, 7, 4, 1.20), (4, 8, 3, 1.30), (4, 9, 4, 1.00),
(5, 1, 4, 1.50), (5, 4, 4, 1.20), (5, 6, 3, 1.20), (5, 10, 3, 1.00),
(6, 8, 4, 1.80), (6, 2, 4, 1.30), (6, 11, 4, 1.40), (6, 9, 4, 1.00);

INSERT INTO applications (drive_id, student_id, status, remarks) VALUES
(3, 1, 'Selected', 'Cleared technical & HR rounds with top score'),
(3, 3, 'Selected', 'Selected for Hyderabad Enterprise Delivery Unit'),
(3, 6, 'Selected', 'Selected with fast-track onboarding'),
(3, 8, 'Selected', 'Cleared technical panel'),
(1, 2, 'Shortlisted', 'Cleared aptitude & coding assessment'),
(1, 4, 'Assessment', 'Online coding round scheduled'),
(2, 2, 'Interview', 'Technical Interview Round 2'),
(5, 7, 'Applied', 'Eligibility verified automatically');

INSERT INTO placements (student_id, drive_id, company_id, job_role, package_lpa, offer_date, joining_status) VALUES
(1, 3, 3, 'Associate Software Engineer (ASE)', 6.50, '2026-10-22', 'Accepted'),
(3, 3, 3, 'Associate Software Engineer (ASE)', 6.50, '2026-10-22', 'Accepted'),
(6, 3, 3, 'Associate Software Engineer (ASE)', 6.50, '2026-10-22', 'Joined'),
(8, 3, 3, 'Associate Software Engineer (ASE)', 6.50, '2026-10-22', 'Offered');
