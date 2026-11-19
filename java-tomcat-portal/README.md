# GCET PLACEMENT HUB — Java Full-Stack Edition

**Smart Placement Cell & Skill Matrix Portal**  
Geethanjali College of Engineering and Technology (GCET), Cheeryal (V), Keesara (M), Hyderabad

> **Your Skills. Your Opportunities. Your Future.**

This downloadable package contains the complete VS Code–ready **Java 17 + Jakarta Servlets 6.0 + JSP + JDBC (HikariCP) + MySQL 8 + Apache Tomcat 10.1+** MVC codebase alongside JUnit 5 unit tests and database setup scripts.

---

## 1. Prerequisites

Install the following tools locally before running the project:

1. **JDK 17 or newer** (`java -version`)
2. **Apache Maven 3.9+** (`mvn -version`)
3. **MySQL Server 8.0+** (or MySQL Workbench)
4. **Apache Tomcat 10.1+** *(Jakarta EE 10 / `jakarta.servlet.*` required — Tomcat 9 uses `javax.servlet.*` and is not compatible)*
5. **Visual Studio Code** with **Extension Pack for Java** (`vscjava.vscode-java-pack`) & **Community Server Connectors** (`redhat.vscode-server-connector`)

---

## 2. Database Setup (MySQL 8)

### Option A — Modular Scripts (`database/`)
Run these three SQL files in order inside MySQL Workbench or `mysql` CLI:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
mysql -u root -p < database/sample_data.sql
```

### Option B — Single Consolidated Script (`sql/`)
```bash
mysql -u root -p < sql/gcet_placement_hub.sql
```

This creates the `gcet_placement_hub` database with all **38 relational tables**, 7 departments, all 12 GCET branches, 9 RBAC roles, 18 official announcement categories, 5 announcement sources, 25 skills, and 20 company records (19 GCET directory references + Acme Demo Partner).

---

## 3. Configure Database Credentials

Open `src/main/resources/database.properties` (and `src/main/resources/db.properties`) and replace the placeholder credentials with your local MySQL credentials (or pass `DB_USERNAME` / `DB_PASSWORD` via environment variables / `.env`):

```properties
db.url=jdbc:mysql://localhost:3306/gcet_placement_hub?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata
db.username=YOUR_MYSQL_USERNAME
db.password=YOUR_MYSQL_PASSWORD
```

> **Note:** Startup explicitly validates that placeholder tokens (`YOUR_MYSQL_USERNAME` / `YOUR_MYSQL_PASSWORD`) have been replaced before creating the HikariCP pool.

---

## 4. Build, Test & Deploy

### Run Unit Tests
```bash
mvn clean test
```
Runs JUnit 5 test suites under `tests/`:
- `authentication/AuthServiceTest.java` — BCrypt password hashing/verification & RBAC hierarchy checks
- `student/StudentEligibilityTest.java` — Deterministic CGPA, branch, batch, backlog, and skill checks
- `faculty/FacultyIsolationTest.java` — Department branch isolation across official coordinators
- `placement/CompanyMatchingTest.java` — Weighted match scoring and ranking verification
- `announcements/AnnouncementClassifierTest.java` — Keyword categorization across official notice categories

### Package `.war` Archive
```bash
mvn clean package
```
Generates `target/gcet-placement-hub.war`.

### Deploy on Apache Tomcat 10.1+
1. Copy `target/gcet-placement-hub.war` into `<TOMCAT_HOME>/webapps/ROOT.war` *(recommended for clean root context URLs)* **or** `<TOMCAT_HOME>/webapps/gcet-placement-hub.war`.
2. Start Tomcat (`bin/startup.bat` or `bin/startup.sh`) or start Tomcat directly from VS Code.
3. Open `http://localhost:8080/` (or `http://localhost:8080/gcet-placement-hub/`).

---

## 5. Initial Institutional Accounts (Seeded Automatically on First Boot)

`InitialAccountSeeder` runs automatically on servlet context startup (`@WebListener` in `AnnouncementSyncScheduler` / `InitialAccountSeeder.seedOnce()`) and creates BCrypt-hashed accounts idempotently:

### Executive & Admin Portal (`ADMIN` Tab)
| Role | Username | Purpose |
| :--- | :--- | :--- |
| `PRINCIPAL` | `principal.sagar` | Principal executive oversight |
| `VICE_CHAIRMAN` | `vc.harishchandra` | Vice Chairman governance |
| `CHAIRMAN` | `chairman.ravinder` | Chairman governance |
| `ADMIN` | `admin` | System Administrator |

### Official Faculty Coordinators (`FACULTY` Tab — Strict Department Isolation)
| Coordinator | Username | Assigned Branches |
| :--- | :--- | :--- |
| B. Laxmi Lavanya | `faculty_lavanya` | `CSE`, `CSE-AIML`, `CSE-DS` |
| P. Aparna | `faculty_aparna` | `IOT`, `IT`, `CS` |
| S. Raja Shakar Reddy | `faculty_rajashakar` | `EEE`, `ECE`, `MECH`, `CIVIL` |

### Corporate Recruiters (`RECRUITER` Tab)
- `recruiter_tcs` (`campus@tcs.com`) — Approved TCS Recruiter
- `recruiter@acme.example` — Approved Demo Recruiter
- Public recruiter registration via **New Recruiter Registration** creates a `Pending` account until approved by Admin.

### Students (`STUDENT` Tab)
- Seeded institutional sample students (e.g., `23r11a0501`, `25r11a66p1`) plus self-registration for new GCET students.

---

## 6. Automated Background Scheduler

`AnnouncementSyncScheduler` (`@WebListener`) runs on Tomcat startup using `ScheduledExecutorService`:
1. Polls enabled institutional feeds (`gcet.edu.in`, `gcetece.org`, `blog.gcet.edu.in`, `geethanjaliinstitutions.com`, `jntuh.ac.in`), persisting outcomes in `announcement_sync_logs` without overwriting cached circulars if external sites are unreachable.
2. Evaluates upcoming placement drive deadlines (`<= 14 days`) and delivers deduplicated reminder notifications to eligible students who have not yet applied.
3. Supports dynamic interval tuning from Admin **System Diagnostics** (`PUT /api/admin/system-status/sync-interval`).
