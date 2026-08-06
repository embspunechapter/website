# IEEE EMBS Pune Chapter — Internship Portal

A role-based engineering research workspace, roadmap, and progress tracking portal designed for the **IEEE EMBS Pune Chapter**. This application connects Student Interns, Mentors (Guides), and the Program Coordinator (Admin) to manage project milestones, report vetting workflows, meeting logs, and dynamic dual-signed certificate generation.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite, React Router v6)
* **Design & Styling**: Custom Responsive CSS (featuring glassmorphism, animated gradients, and EMBS branding elements)
* **Backend & Auth**: Supabase (PostgreSQL, Auth Engine, Storage, and Realtime Publications)
* **Utilities**: `xlsx` (spreadsheet parses), `lucide-react` (icons)

---

## 🚀 Local Installation & Setup

### 1. Clone the Project & Install Dependencies
Ensure you have Node.js (version 18+ recommended) installed, then run:
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory. You can copy the template from `.env.example`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Start Development Server
Launch the local dev build with:
```bash
npm run dev
```
The site will run on `http://localhost:5173`. Quick demo logins (Autofill cards) are displayed in the login screen *only* during development mode.

---

## 🗄️ Database Architecture (Supabase Schema)

Execute the migrations located in the `supabase/migrations/` directory to configure the PostgreSQL database. Key tables and RLS rules include:

### 1. Core Schema Tables
* **`profiles`**: User records mapped to Supabase Auth UUIDs. Contains fields for `role` (`student`, `mentor`, `admin`), assigned `group_id`, `domain`, and `is_lead` (defines the group's Team Lead).
* **`groups`**: Contains Group IDs (e.g. `EMBS-TEAM-01`), domain focus, and `mentor_id`.
* **`milestones`**: Project roadmap checkpoints with statuses (`not_started`, `in_progress`, `submitted`, `approved`).
* **`meetings`**: Logs of scheduled or conducted mentorship meetings, attendance lists, and video conferencing links.
* **`reports`**: Uploaded student reports, submission files, and review remarks.
* **`certificates`**: Digitally verifiable certificates of completion (for students) and appreciation (for mentors) with verification codes.
* **`notifications`**: User-specific alerts sent in realtime via Supabase postgres replication channels.

### 2. Key Row Level Security (RLS) Rules
* Users can view their own notifications and profiles.
* Only the designated **Team Lead** of a student group is authorized to upload report revisions.
* Mentors and Coordinators are granted RLS `INSERT` privileges to notify students about scheduled sessions.

---

## 📂 Project Structure

```text
├── supabase/
│   ├── migrations/             # SQL migration files for Supabase DDL
│   └── functions/              # Supabase Edge Functions (e.g., bulk provisioning)
├── src/
│   ├── components/
│   │   ├── Navbar.jsx          # Top navigation & realtime notification bell
│   │   └── CertificatePreviewModal.jsx  # Modular landscape preview component
│   ├── lib/
│   │   ├── AuthContext.jsx     # Handles authentication locks & session flows
│   │   └── supabase.js         # Supabase client instantiation
│   ├── pages/
│   │   ├── Landing.jsx         # Public landing page with dynamic statistics
│   │   ├── Login.jsx           # Secured login form with password reset request
│   │   ├── ResetPassword.jsx   # Credentials update page
│   │   ├── StudentDashboard.jsx# Student workspace, stepper & report uploads
│   │   ├── MentorDashboard.jsx # Mentor review panels & meeting schedulers
│   │   ├── AdminDashboard.jsx  # Admin analytics & group progress trackers
│   │   └── NotFound.jsx        # Custom 404 page
│   ├── App.jsx                 # Route declarations & protected route wrappers
│   └── index.css               # Main engineering grids & biotech styling
```

---

## ⚙️ Core Workflows

### 🛡️ Secure Auth & Recovery
* **Secure Production Login**: All mock/demo login helper credentials are automatically hidden from the public production login form using Vite build environment checks.
* **Forgot Password Recovery**: Click "Forgot?" to send a secure recovery link to your email. You will be redirected to the secure `/reset-password` page to update your password credentials.

### 📊 Dynamic Group Progress Tracking
* The **Admin Hub** contains a live progress tracker.
* Progress percentages are calculated in real time by evaluating how many roadmaps checkpoints (`milestones`) are set by the group's mentor and marked as `'approved'`.
* Admin can click "Show Roadmap Milestones" to see individual task statuses.

### 📄 Vetted Report Evaluation
1. Only the designated group **Team Lead** can submit a report.
2. Once submitted, the report status updates to `'submitted'` and notifies the group's mentor.
3. The mentor inspects the file, provides remarks, and sets the status to `'approved'`.
4. Only after mentor approval is the report visible on the coordinator's (Admin) review panel.
