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

## Demo
Student: `student` / `1234`
Admin: `admin` / `admin123`

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
This prototype is for the DSA PBL. The demo credentials are intentionally simple; production authentication should use password hashing, sessions/JWT, authorization controls, and HTTPS.

