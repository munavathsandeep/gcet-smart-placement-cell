-- ============================================================================
-- GCET PLACEMENT HUB — MASTER INSTITUTIONAL SEED DATA
-- Step 2 of 3: Execute after schema.sql
-- ============================================================================

USE gcet_placement_hub;

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

INSERT INTO app_settings (setting_key, setting_value) VALUES
('sync_interval_minutes', '60');
