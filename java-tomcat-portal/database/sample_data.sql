-- ============================================================================
-- GCET PLACEMENT HUB — SAMPLE DIRECTORY & VERIFIED PORTAL DATA
-- Step 3 of 3: Execute after seed.sql
-- Note: User accounts (Admin, 3 Faculty Coordinators, Recruiters, Sample Students)
-- are seeded automatically at application startup with BCrypt hashes by InitialAccountSeeder.java.
-- ============================================================================

USE gcet_placement_hub;

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

INSERT INTO announcements (
    title, category_id, source_id, source_name, source_url,
    published_date, description, relevant_branches, department_code,
    academic_year, deadline_date, priority, is_pinned, is_verified_source
) VALUES
(
    'B.Tech Campus Placement Readiness & Skill Matrix Verification Schedule (2026-27)',
    2, 1, 'GCET Official Website', 'https://gcet.edu.in/',
    CURDATE(),
    'All final-year and pre-final-year students are advised to update their Skill Matrix, resume PDF, and project portfolio and submit for faculty coordinator approval.',
    'ALL', 'ALL', '2026-27', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Important', TRUE, TRUE
),
(
    'Academic Calendar & Semester Examination Schedule Circular — JNTUH Autonomous',
    5, 5, 'JNTUH Official Portal', 'https://jntuh.ac.in/',
    CURDATE(),
    'Students should review the upcoming end-semester examination timetable and ensure zero active academic backlogs prior to campus placement drives.',
    'ALL', 'ALL', '2026-27', DATE_ADD(CURDATE(), INTERVAL 21 DAY), 'Normal', FALSE, TRUE
);

INSERT INTO announcement_sync_logs (source_id, source_name, sync_status, items_fetched, items_inserted, error_message) VALUES
(1, 'GCET Official Website', 'SUCCESS', 1, 0, 'Initial verified institutional portal seed checkpoint.');
