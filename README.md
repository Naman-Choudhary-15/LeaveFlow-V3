# LeaveFlow V3 — Backend + Database

## What changed
V3 replaces browser-only LocalStorage persistence with a Node.js/Express API and SQLite database.

### Architecture
Browser UI → Express REST API → SQLite database
The DSA layer remains in `js/dsa.js` for the PBL demonstration.

## Requirements
- Node.js 22.5+ (the backend uses the built-in `node:sqlite` module)
- Internet access once to install npm dependencies

## Run
1. Open a terminal in `backend/`
2. Run: `npm install`
3. Run: `npm start`
4. Open: http://localhost:3000

## Local demo credentials
These passwords are for local development only. The Render deployment prompts for separate student and administrator passwords and uses signed, expiring sessions.

## API
- POST `/api/login`
- GET `/api/applications`
- POST `/api/applications`
- PATCH `/api/applications/:id/status`
- DELETE `/api/applications/:id`
- GET `/api/history`
- GET `/api/stats`

## Database
SQLite file: `backend/leaveflow.db` (created automatically on first run).

## Academic note
This prototype is for the DSA PBL. The local demo credentials are intentionally simple. Passwords are stored using Node.js scrypt hashing, and authenticated API requests use signed expiring tokens. Use a persistent database and review the security model before using real employee data.


## Deploy to Render

1. Create a new Blueprint from this GitHub repository and select `render.yaml`.
2. Set separate passwords of at least 12 characters for `LEAVEFLOW_STUDENT_PASSWORD` and `LEAVEFLOW_ADMIN_PASSWORD` when prompted. Render generates `SESSION_SECRET` automatically.
3. Deploy the `leaveflow-v3` web service and open its generated `onrender.com` URL.

The included free preview uses SQLite on an ephemeral filesystem. Render may erase demo requests after a restart, spin-down, or redeploy. Persistent records require a persistent disk or a managed database and a paid/persistent hosting setup. Do not use real employee or student records in this preview.

