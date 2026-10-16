
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const requiredProductionEnv = ["SESSION_SECRET", "LEAVEFLOW_STUDENT_PASSWORD", "LEAVEFLOW_ADMIN_PASSWORD"];
if (isProduction && requiredProductionEnv.some((key) => !process.env[key])) {
  throw new Error(`Production requires these environment variables: ${requiredProductionEnv.join(", ")}`);
}
if (isProduction && [process.env.LEAVEFLOW_STUDENT_PASSWORD, process.env.LEAVEFLOW_ADMIN_PASSWORD].some((value) => value.length < 12)) {
  throw new Error("Production student and administrator passwords must be at least 12 characters long");
}
const sessionSecret = process.env.SESSION_SECRET || "leaveflow-local-development-only-change-in-production";
const dataDir = process.env.LEAVEFLOW_DATA_DIR || __dirname;
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "leaveflow.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','admin')),
  name TEXT NOT NULL,
  roll_no TEXT
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  admin_remark TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  student TEXT NOT NULL,
  remark TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
`);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
const updatePassword = db.prepare("UPDATE users SET password=? WHERE id=?");
db.prepare("SELECT id,password FROM users").all().forEach((user) => {
  if (!String(user.password).startsWith("scrypt$")) updatePassword.run(hashPassword(user.password), user.id);
});
const seedUser = db.prepare(`INSERT OR IGNORE INTO users(username,password,role,name,roll_no) VALUES(?,?,?,?,?)`);
seedUser.run("student",hashPassword(process.env.LEAVEFLOW_STUDENT_PASSWORD || "1234"),"student","Alex Morgan","DEMO-001");
seedUser.run("admin",hashPassword(process.env.LEAVEFLOW_ADMIN_PASSWORD || "admin123"),"admin","Administrator",null);

const count = db.prepare("SELECT COUNT(*) AS c FROM applications").get().c;
if(count===0){
  const now=new Date().toISOString();
const ins = db.prepare(`
  INSERT INTO applications
  (
    id,
    user_id,
    name,
    roll_no,
    leave_type,
    start_date,
    end_date,
    reason,
    status,
    admin_remark,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

ins.run(
  101,
  1,
  "Alex Morgan",
  "DEMO-001",
  "Medical",
  "2026-09-15",
  "2026-09-17",
  "Medical appointment.",
  "Pending",
  "",
  now,
  now
);

ins.run(
  102,
  1,
  "Rahul Sharma",
  "2501331540181",
  "Casual",
  "2026-09-12",
  "2026-09-13",
  "Family function.",
  "Approved",
  "Approved for the requested dates.",
  now,
  now
);

ins.run(
  103,
  1,
  "Aman Verma",
  "2501331540190",
  "Emergency",
  "2026-09-10",
  "2026-09-10",
  "Urgent personal work.",
  "Rejected",
  "Insufficient supporting details.",
  now,
  now
);
}

app.use(express.json());
app.use(express.static(path.join(__dirname,"..")));

function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function auth(req,res,next){
  const token = (req.headers.authorization || "").match(/^Bearer (.+)$/i)?.[1];
  if (!token) return res.status(401).json({error:"Authentication required"});
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return res.status(401).json({error:"Invalid session"});
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return res.status(401).json({error:"Invalid session"}); }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return res.status(401).json({error:"Invalid session"});
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return res.status(401).json({error:"Invalid session"}); }
  if (!Number.isInteger(claims.sub) || claims.exp <= Math.floor(Date.now() / 1000)) return res.status(401).json({error:"Session expired. Sign in again."});
  const user = db.prepare("SELECT id,username,role,name,roll_no FROM users WHERE id=?").get(claims.sub);
  if (!user) return res.status(401).json({error:"Invalid session"});
  req.user=user; next();
}
function admin(req,res,next){if(req.user.role!=="admin")return res.status(403).json({error:"Administrator access required"});next()}

app.post("/api/login",(req,res)=>{
  const {username,password,role}=req.body||{};
  const user=db.prepare("SELECT id,username,role,name,roll_no,password FROM users WHERE username=? AND role=?").get(username,role);
  if(!user || typeof password !== "string" || !verifyPassword(password,user.password))return res.status(401).json({error:"Invalid credentials"});
  delete user.password;
  res.json({ ...user, token: createSessionToken(user) });
});

app.get("/api/health",(req,res)=>res.json({status:"ok"}));

app.get("/api/applications",auth,(req,res)=>{
  const rows=req.user.role==="admin"
    ? db.prepare("SELECT * FROM applications ORDER BY id DESC").all()
    : db.prepare("SELECT * FROM applications WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  res.json(rows);
});

app.post("/api/applications", auth, (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({
      error: "Only students can submit applications"
    });
  }

  const { leaveType, startDate, endDate, reason } = req.body || {};

  if (!leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({
      error: "All fields are required"
    });
  }

  if (endDate < startDate) {
    return res.status(400).json({
      error: "End date cannot be before start date"
    });
  }

  const duplicate = db.prepare(`
    SELECT id
    FROM applications
    WHERE user_id = ?
      AND start_date = ?
      AND end_date = ?
      AND status = 'Pending'
  `).get(
    req.user.id,
    startDate,
    endDate
  );

  if (duplicate) {
    return res.status(409).json({
      error: "A similar pending application already exists"
    });
  }

  const result = db.prepare(
    "SELECT COALESCE(MAX(id), 100) AS id FROM applications"
  ).get();

  const next = Number(result.id) + 1;
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO applications (
      id,
      user_id,
      name,
      roll_no,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      admin_remark,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    next,
    req.user.id,
    req.user.name,
    req.user.roll_no,
    leaveType,
    startDate,
    endDate,
    reason,
    "Pending",
    "",
    now,
    now
  );

  const application = db.prepare(
    "SELECT * FROM applications WHERE id = ?"
  ).get(next);

  console.log("Application created:", application);

  res.status(201).json(application);
});

app.patch("/api/applications/:id/status",auth,admin,(req,res)=>{
  const id=Number(req.params.id), {status,remark=""}=req.body||{};
  if(!["Approved","Rejected"].includes(status))return res.status(400).json({error:"Status must be Approved or Rejected"});
  const a=db.prepare("SELECT * FROM applications WHERE id=?").get(id);
  if(!a)return res.status(404).json({error:"Application not found"});
  if(a.status!=="Pending")return res.status(409).json({error:"Only pending applications can be processed"});
  const now=new Date().toISOString();
  db.prepare("UPDATE applications SET status=?,admin_remark=?,updated_at=? WHERE id=?").run(status,String(remark||""),now,id);
  db.prepare("INSERT INTO history(application_id,action,student,remark,created_at) VALUES(?,?,?,?,?)").run(id,status,a.name,String(remark||""),now);
  res.json(db.prepare("SELECT * FROM applications WHERE id=?").get(id));
});

app.delete("/api/applications/:id",auth,admin,(req,res)=>{
  const id=Number(req.params.id);
  const a=db.prepare("SELECT id FROM applications WHERE id=?").get(id);
  if(!a)return res.status(404).json({error:"Application not found"});
  db.prepare("DELETE FROM history WHERE application_id=?").run(id);
  db.prepare("DELETE FROM applications WHERE id=?").run(id);
  res.json({success:true});
});

app.get("/api/history",auth,admin,(req,res)=>{
  res.json(db.prepare("SELECT * FROM history ORDER BY id DESC").all());
});

app.get("/api/stats",auth,(req,res)=>{
  const base=req.user.role==="admin"?"":" WHERE user_id="+Number(req.user.id);
  const rows=db.prepare(`SELECT status,COUNT(*) AS count FROM applications${base} GROUP BY status`).all();
  const out={total:0,Pending:0,Approved:0,Rejected:0};
  rows.forEach(r=>{out[r.status]=r.count;out.total+=r.count});
  res.json(out);
});

app.listen(PORT,()=>console.log(`LeaveFlow V3 running at http://localhost:${PORT}`));

console.log("LeaveFlow backend file loaded - VERSION 3.1");
