
const express = require("express");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const app = express();
const PORT = process.env.PORT || 3000;
const db = new DatabaseSync(path.join(__dirname, "leaveflow.db"));
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

const seedUser = db.prepare(`INSERT OR IGNORE INTO users(username,password,role,name,roll_no) VALUES(?,?,?,?,?)`);
seedUser.run("student","1234","student","Naman Choudhary","2501331540177");
seedUser.run("admin","admin123","admin","Administrator",null);

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
  "Naman Choudhary",
  "2501331540177",
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

function auth(req,res,next){
  const username=req.headers["x-username"];
  const user=db.prepare("SELECT id,username,role,name,roll_no FROM users WHERE username=?").get(username);
  if(!user)return res.status(401).json({error:"Authentication required"});
  req.user=user; next();
}
function admin(req,res,next){if(req.user.role!=="admin")return res.status(403).json({error:"Administrator access required"});next()}

app.post("/api/login",(req,res)=>{
  const {username,password,role}=req.body||{};
  const user=db.prepare("SELECT id,username,role,name,roll_no FROM users WHERE username=? AND password=? AND role=?").get(username,password,role);
  if(!user)return res.status(401).json({error:"Invalid credentials"});
  res.json(user);
});

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
