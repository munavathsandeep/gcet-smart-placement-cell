# 🎓 GCET Smart Placement Cell

### Smart Campus Recruitment & Placement Management System

A comprehensive digital placement management platform developed for **Geethanjali College of Engineering and Technology (GCET)** to simplify and streamline campus recruitment activities.

The platform connects students, faculty coordinators, placement administrators, institutional leadership, and recruiters through dedicated portals and role-based dashboards.

---

## 🌟 Project Overview

GCET Smart Placement Cell aims to digitize the complete campus placement process, from student registration and profile management to company recruitment, placement drives, applications, and selection tracking.

It provides a centralized platform for managing recruitment activities efficiently, securely, and transparently.

## ✨ Key Features

### 👨‍🎓 Student Portal
- Student registration and secure login.
- Student profile management.
- Academic and skill information.
- Placement drive exploration.
- Job application tracking.
- Application status updates.

### 🏢 Recruiter Portal
- Recruiter authentication.
- Company profile management.
- Placement drive coordination.
- Student application management.
- Candidate recruitment activities.

### 👩‍🏫 Faculty Portal
- Faculty coordinator access.
- Student profile coordination.
- Faculty profile and skill management.
- Student profile approval workflows.

### 🛡️ Administration Portal
- System administrator dashboard.
- Principal dashboard.
- Chairman dashboard.
- Vice Chairman dashboard.
- Placement officer dashboard.
- User and role management.
- Account approval and management.
- Placement activity monitoring.

### 🔐 Security & Authentication
- Secure password hashing using BCrypt.
- Role-based access control.
- Session management and revocation.
- Login attempt protection.
- First-login password change workflow.
- Protected API endpoints.
- CORS and secure cookie configuration.

---

## 🛠️ Technologies Used

### Main Web Application

| Technology | Purpose |
|---|---|
| React 19 | Frontend development |
| TypeScript | Type-safe development |
| Vite | Build and development |
| Node.js | Runtime environment |
| Express.js | Backend API |
| SQLite | Database |
| SQL.js | SQLite integration |
| Tailwind CSS | UI styling |
| BCrypt.js | Password hashing |
| Chart.js | Data visualization |
| Lucide React | Icons |

### Java Companion Project

The repository also includes a separate Java implementation under `java-tomcat-portal/`.

- Java
- Maven
- Jakarta Servlets
- JSP
- JDBC
- HikariCP
- MySQL 8.0
- Apache Tomcat 10.1

**Note:** The React/Express application and Java/Tomcat application are separate implementations with separate databases.

---

## 📂 Project Structure

```text
gcet-smart-placement-cell/
│
├── data/
│   └── SQLite database storage
│
├── java-tomcat-portal/
│   └── Java / Jakarta Servlet application
│
├── public/
│   └── Public assets
│
├── server/
│   └── Backend services and database logic
│
├── src/
│   └── React frontend source code
│
├── .env.example
├── .gitignore
├── DEPLOYMENT.md
├── package.json
├── server.ts
├── index.html
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites

Install the following:

- Node.js
- npm
- Visual Studio Code
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/munavathsandeep/gcet-smart-placement-cell.git
```

### Step 2: Open the Project

```bash
cd gcet-smart-placement-cell
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

Copy the example environment file.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the required environment variables:

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=YOUR_SECURE_RANDOM_SECRET
DB_PATH=./data/gcet_career_connect.db
```

Keep all secrets private. Never commit your actual `.env` file.

### Step 5: Start the Development Server

```bash
npm run dev
```

### Step 6: Open the Application

```text
http://localhost:3000
```

### Step 7: Verify Backend Health

```text
http://localhost:3000/api/health
```

---

## 🚀 Production Build

Build the frontend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

For cloud deployment, configure a persistent disk for the SQLite database so that application data survives server restarts.

Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for deployment configuration.

---

## 🗄️ Database Information

### Main Application

- Database: SQLite
- Default database file: `data/gcet_career_connect.db`
- Database location can be configured using `DB_PATH`.
- Relational data storage with foreign-key enforcement.

### Java Application

- Database: MySQL 8.0
- Database name: `gcet_placement_hub`
- Java backend uses JDBC for database communication.

**Important:** The SQLite and MySQL databases are independent and do not automatically synchronize.

---

## 🧪 Testing & Quality

Available project scripts:

```bash
npm run build
npm run lint
```

The application should be tested for:

- Authentication and authorization.
- Student registration and login.
- Recruiter and faculty access.
- Administrative role permissions.
- Session persistence.
- Password change and recovery.
- Database persistence.
- API functionality.

---

## 🔒 Security Guidelines

- Never upload `.env` files.
- Never publish passwords or session secrets.
- Never commit real student personal information.
- Use secure password hashing.
- Configure HTTPS for production.
- Use persistent database storage.
- Restrict access to administrative functions.
- Use separate credentials for each authorized account.

---

## 🎯 Project Objectives

1. Digitize campus placement activities.
2. Simplify student registration and profile management.
3. Improve communication between students, faculty, and recruiters.
4. Centralize placement drive information.
5. Improve recruitment coordination and tracking.
6. Provide secure role-based access.
7. Maintain reliable placement records.

---

## 🏫 Institution

**Geethanjali College of Engineering and Technology (GCET)**

Cheeryal, Keesara, Medchal District, Hyderabad, Telangana, India.

---

## 👨‍💻 Developer

**Developed as an academic project for GCET.**

GitHub: [@munavathsandeep](https://github.com/munavathsandeep)

Project Repository: [GCET Smart Placement Cell](https://github.com/munavathsandeep/gcet-smart-placement-cell)

---

## 📜 License

This project is currently maintained as an academic project. All rights reserved unless a license is added to this repository.

---

⭐ If you find this project useful, consider giving the repository a star!

**GCET Smart Placement Cell – Connecting Talent with Opportunity.**
