# GCET Placement Hub — Java, JDBC, MySQL & Apache Tomcat Setup Guide

## 1. Prerequisites
- **JDK 17+** (Oracle JDK or OpenJDK)
- **MySQL Server 8.0+** & **MySQL Workbench**
- **Apache Tomcat 10.1+** (Jakarta EE 10 / `jakarta.servlet.*`)
- **Apache Maven 3.8+** (or IDE import into IntelliJ IDEA / Eclipse / NetBeans)

## 2. MySQL Database Setup
1. Open **MySQL Workbench** and connect to your local MySQL instance (`localhost:3306`).
2. Open `sql/gcet_placement_hub.sql`.
3. Execute the entire script. It creates:
   - Database `gcet_placement_hub`
   - All 27 relational tables (including `users`, `roles`, `faculty`, `students`, `recruiter_profiles`, `login_attempts`, `password_reset_requests`, `seed_history`) with primary keys, foreign keys, unique constraints, and indexes
   - All 12 distinct GCET branches (`CSE`, `CSE-AIML`, `CSE-DS`, `CSE-CS`, `CSE-IoT`, `ECE`, `EEE`, `ME`, `CE`, `IT`, `MBA`, `M.Tech CSE`)
   - All 16 preloaded recruiter directory entries + Demo Recruiter, 25 master skills, 18 official announcement categories, and 5 verified source websites
   - On Tomcat startup, `InitialAccountSeeder` runs once via `seed_history` to hash and initialize initial accounts with BCrypt.

## 3. JDBC Configuration
Configure database credentials using environment variables or JVM system properties:
- `GCET_DB_URL` (default: `jdbc:mysql://localhost:3306/gcet_placement_hub?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata`)
- `GCET_DB_USER` (default: `root`)
- `GCET_DB_PASS` (your MySQL password)

Alternatively, update `src/main/resources/db.properties` before building the WAR.

## 4. Build & Deploy on Apache Tomcat
```bash
cd java-tomcat-portal
mvn clean package
```
Copy `target/gcet-placement-portal.war` into `$TOMCAT_HOME/webapps/`.
Start Tomcat:
```bash
$TOMCAT_HOME/bin/startup.sh   # or startup.bat on Windows
```
Open: `http://localhost:8080/gcet-placement-portal/`

## 5. OOP Architecture Overview
- `edu.gcet.placement.model`: Interfaces (`Identifiable`, `Evaluatable`), abstract base class (`User`), polymorphic subclasses (`Student`, `Admin`, `PlacementOfficer`, `Faculty`, `Recruiter`), domain entities (`Branch`, `Company`, `Skill`, `PlacementDrive` with `approvalStatus`, `Application` with `interviewDate`/`interviewMode`, `Announcement`, `AnnouncementSource`, `Notification`, etc.).
- `edu.gcet.placement.dao`: `GenericDAO<T, ID>` interface and JDBC `PreparedStatement` implementations (`BranchDAO`, `StudentDAO`, `CompanyDAO`, `PlacementDriveDAO`, `AnnouncementDAO`, `AnalyticsDAO`, etc.).
- `edu.gcet.placement.service`: Business logic, `EligibilityService`, `SkillGapService`, `CompanyMatchingService`, `AnnouncementSyncService` (HTTP + RSS/HTML sync scheduler).
- `edu.gcet.placement.controller`: Jakarta HttpServlet REST endpoints (`/api/auth`, `/api/branches`, `/api/announcements`, `/api/notifications`, `/api/saved-jobs`, `/api/students`, `/api/skills`, `/api/companies`, `/api/drives`, `/api/eligibility`, `/api/skill-gap`, `/api/matching`, `/api/applications`, `/api/placements`, `/api/analytics`).
- `edu.gcet.placement.filter`: `AuthFilter` (RBAC session enforcement) & `SecurityHeaderFilter`.
