let role = "student";
let currentUser = null;
let currentPage = "dashboard";
let applications = [];
let historyRows = [];
let busy = false;
let sortState = { key: "id", direction: "desc" };

const list = new LeaveLinkedList();
const queue = new LeaveQueue();
const history = new HistoryStack();
const $ = (id) => document.getElementById(id);
const navConfig = {
  dashboard: { icon: "grid", label: "Overview", eyebrow: "WORKSPACE", title: "Overview" },
  apply: { icon: "plus", label: "Apply for leave", eyebrow: "EMPLOYEE", title: "Apply for leave" },
  myLeaves: { icon: "file", label: "My applications", eyebrow: "EMPLOYEE", title: "My applications" },
  applications: { icon: "inbox", label: "Applications", eyebrow: "ADMINISTRATION", title: "Applications" },
  dsa: { icon: "code", label: "DSA operations", eyebrow: "PROJECT", title: "DSA operations" },
  history: { icon: "clock", label: "Approval history", eyebrow: "ADMINISTRATION", title: "Approval history" }
};

function iconSvg(name) {
  const paths = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    file: '<path d="M13.5 3.5h-7A2.5 2.5 0 0 0 4 6v12a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18V10z"/><path d="M13 3.8V10h6.3M8 14h8M8 17h8"/>',
    inbox: '<path d="M4 4.5h16v15H4z"/><path d="M4 14h4l1.5 2h5L16 14h4M8 8h8M8 11h5"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    total: '<path d="M6 3.5h9l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14.5 3.8V8H19M8 12h8M8 16h8"/>',
    pending: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    approved: '<path d="m5 12.5 4.5 4.5L19.5 7"/>',
    rejected: '<path d="m7 7 10 10M17 7 7 17"/>'
  };
  return `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.valueOf()) ? escapeHtml(value) : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}
function formatTimestamp(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? escapeHtml(value) : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function statusBadge(status) {
  const key = ["Pending", "Approved", "Rejected"].includes(status) ? status.toLowerCase() : "pending";
  return `<span class="badge ${key}">${escapeHtml(status || "Pending")}</span>`;
}
function showToast(message, kind = "info") {
  const item = document.createElement("div");
  item.className = `toast ${kind}`;
  item.setAttribute("role", kind === "error" ? "alert" : "status");
  item.textContent = message;
  $("toastRegion").appendChild(item);
  window.setTimeout(() => item.remove(), 4300);
}
function setLoading(target, text = "Loading applications…") {
  target.innerHTML = `<div class="loading"><span class="spinner" aria-hidden="true"></span>${escapeHtml(text)}</div>`;
}
function friendlyError(error) {
  return error?.message || "Something went wrong. Please try again.";
}

document.querySelectorAll(".role-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".role-btn").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    role = button.dataset.role;
    $("username").value = role === "admin" ? "admin" : "student";
  });
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  busy = true;
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    const user = await api("/api/login", "POST", {
      username: $("username").value.trim(), password: $("password").value, role
    });
    currentUser = user;
    role = user.role;
    localStorage.setItem("leaveFlowUser", JSON.stringify(user));
    await enterApp();
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

$("logoutBtn").addEventListener("click", logout);
$("menuToggle").addEventListener("click", () => {
  if (window.innerWidth > 760) {
    const collapsed = $("sidebar").classList.toggle("collapsed");
    $("mainContent").classList.toggle("sidebar-collapsed", collapsed);
    $("menuToggle").setAttribute("aria-expanded", String(!collapsed));
    $("menuToggle").setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
  } else {
    const open = $("sidebar").classList.toggle("open");
    $("menuToggle").setAttribute("aria-expanded", String(open));
    $("menuToggle").setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    $("mobileScrim").hidden = !open;
  }
});
$("mobileScrim").addEventListener("click", closeMobileNav);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileNav();
    closeModal();
  }
});

async function api(url, method = "GET", body = null) {
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (currentUser) options.headers["x-username"] = currentUser.username;
  if (body !== null) options.body = JSON.stringify(body);
  let response;
  try { response = await fetch(url, options); }
  catch { throw new Error("Can’t reach LeaveFlow. Check that the server is running and try again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request could not be completed (${response.status}).`);
  return data;
}

async function enterApp() {
  $("loginScreen").classList.add("hidden");
  $("app").classList.remove("hidden");
  buildNav();
  $("userName").textContent = currentUser.name;
  $("avatar").textContent = (currentUser.name || "U").trim().charAt(0).toUpperCase();
  $("userRole").textContent = role === "admin" ? "ADMINISTRATOR" : "EMPLOYEE";
  setLoading($("content"), "Loading your workspace…");
  try {
    await refreshData();
    go("dashboard");
  } catch (error) {
    showToast(friendlyError(error), "error");
    $("content").innerHTML = `<div class="panel empty"><strong>Could not load your workspace</strong>${escapeHtml(friendlyError(error))}<br><button class="secondary" style="margin-top:12px" onclick="retryLoad()">Try again</button></div>`;
  }
}
async function retryLoad() {
  try { await refreshData(); go(currentPage); }
  catch (error) { showToast(friendlyError(error), "error"); }
}
function logout() {
  localStorage.removeItem("leaveFlowUser");
  currentUser = null;
  applications = [];
  historyRows = [];
  $("app").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  $("password").value = "";
  closeMobileNav();
}
async function refreshData() {
  applications = await api("/api/applications");
  list.head = null;
  list.size = 0;
  queue.items = [];
  applications.forEach((item) => list.append({ ...item, id: Number(item.id) }));
  applications.filter((item) => item.status === "Pending").forEach((item) => queue.enqueue(item));
  if (role === "admin") {
    historyRows = await api("/api/history");
    history.items = [];
    historyRows.forEach((item) => history.push(item));
  }
}
function buildNav() {
  const pages = role === "admin" ? ["dashboard", "applications", "dsa", "history"] : ["dashboard", "apply", "myLeaves"];
  $("portalLabel").textContent = role === "admin" ? "ADMIN WORKSPACE" : "EMPLOYEE WORKSPACE";
  $("nav").innerHTML = pages.map((page) => {
    const item = navConfig[page];
    return `<button class="nav-btn" type="button" data-page="${page}"><span class="nav-icon">${iconSvg(item.icon)}</span><span>${item.label}</span></button>`;
  }).join("");
  document.querySelectorAll(".nav-btn").forEach((button) => button.addEventListener("click", () => go(button.dataset.page)));
}
function go(page) {
  const employeePages = ["dashboard", "apply", "myLeaves"];
  const adminPages = ["dashboard", "applications", "dsa", "history"];
  if (!(role === "admin" ? adminPages : employeePages).includes(page)) return;
  currentPage = page;
  document.querySelectorAll(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
  closeMobileNav();
  const meta = navConfig[page];
  $("pageEyebrow").textContent = meta.eyebrow;
  $("pageTitle").textContent = meta.title;
  if (page === "dashboard") dashboard();
  else if (page === "apply") applyPage();
  else if (page === "myLeaves") myLeaves();
  else if (page === "applications") applicationsPage();
  else if (page === "dsa") dsaPage();
  else if (page === "history") historyPage();
}
function closeMobileNav() {
  $("sidebar").classList.remove("open");
  $("mobileScrim").hidden = true;
  const desktopExpanded = window.innerWidth > 760 && !$("sidebar").classList.contains("collapsed");
  $("menuToggle").setAttribute("aria-expanded", String(desktopExpanded));
  $("menuToggle").setAttribute("aria-label", window.innerWidth > 760 ? (desktopExpanded ? "Collapse navigation" : "Expand navigation") : "Open navigation");
}
function stats() {
  return {
    total: applications.length,
    pending: applications.filter((item) => item.status === "Pending").length,
    approved: applications.filter((item) => item.status === "Approved").length,
    rejected: applications.filter((item) => item.status === "Rejected").length
  };
}
function statCard(label, value, icon, extra = "") {
  return `<article class="stat ${extra}"><div class="stat-label">${label}</div><div class="stat-row"><div class="stat-num">${value}</div><span class="stat-icon" aria-hidden="true">${icon}</span></div></article>`;
}
function pageIntro(title, subtitle, action = "") {
  return `<div class="page-intro"><div><h2>${title}</h2><p>${subtitle}</p></div>${action ? `<div class="page-actions">${action}</div>` : ""}</div>`;
}
function dashboard() {
  const counts = stats();
  const recent = [...applications].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
  const isAdmin = role === "admin";
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const firstName = String(currentUser?.name || "there").trim().split(/\s+/)[0];
  const statusTotal = counts.approved + counts.pending + counts.rejected;
  const approvedDeg = statusTotal ? counts.approved / statusTotal * 360 : 0;
  const pendingDeg = statusTotal ? counts.pending / statusTotal * 360 : 0;
  const ringStyle = statusTotal
    ? `background:conic-gradient(#21865b 0deg ${approvedDeg}deg,#d89b2b ${approvedDeg}deg ${approvedDeg + pendingDeg}deg,#c75151 ${approvedDeg + pendingDeg}deg 360deg)`
    : "background:#dce3ed";
  const ring = `<div class="status-ring" style="${ringStyle}" role="img" aria-label="${counts.approved} approved, ${counts.pending} pending, ${counts.rejected} rejected"><div class="status-ring-center"><strong>${counts.total}</strong><span>requests</span></div></div>`;
  const statusLegend = `<div class="status-legend"><div><i class="approved-dot"></i><span>Approved</span><strong>${counts.approved}</strong></div><div><i class="pending-dot"></i><span>Pending</span><strong>${counts.pending}</strong></div><div><i class="rejected-dot"></i><span>Rejected</span><strong>${counts.rejected}</strong></div></div>`;
  const requestRows = (rows) => rows.length ? rows.map((item) => `<article class="request-row"><div class="request-id">#${escapeHtml(item.id)}</div><div class="request-main"><strong>${escapeHtml(item.leave_type)} leave</strong><span>${formatDate(item.start_date)} <i>to</i> ${formatDate(item.end_date)}</span></div><div class="request-status">${statusBadge(item.status)}</div><button class="icon-action" type="button" aria-label="View application ${escapeHtml(item.id)}" onclick="viewApplication(${Number(item.id)})">↗</button></article>`).join("") : `<div class="dash-empty"><span class="empty-mark">—</span><strong>No applications yet</strong><p>Once a request is submitted, its progress will appear here.</p></div>`;
  const metric = (label, value, note, kind) => `<article class="metric-card ${kind}"><span class="metric-icon">${iconSvg(kind === "metric-total" ? "total" : kind === "metric-pending" ? "pending" : kind === "metric-approved" ? "approved" : "rejected")}</span><div><span>${label}</span><strong>${value}</strong><small>${note}</small></div></article>`;
  const dateLine = `<div class="dashboard-date"><span class="date-pip"></span>${today}<span class="date-divider"></span>${isAdmin ? "LEAVE OPERATIONS" : "MY LEAVE"}</div>`;
  const employeeView = `<section class="employee-welcome"><div><span class="welcome-kicker">PERSONAL WORKSPACE</span><h2>Welcome back, ${escapeHtml(firstName)}</h2><p>Your leave at a glance. Pick up where you left off.</p></div><button class="primary" onclick="go('apply')"><span aria-hidden="true">＋</span> New leave request</button><div class="welcome-decoration" aria-hidden="true"><span></span><span></span><span></span></div></section>
    <div class="employee-metrics">${metric("All requests", counts.total, "Submitted by you", "metric-total")}${metric("In review", counts.pending, "Awaiting a decision", "metric-pending")}${metric("Approved", counts.approved, "Confirmed requests", "metric-approved")}${metric("Declined", counts.rejected, "Review decision details", "metric-rejected")}</div>
    <div class="employee-board"><section class="dash-panel request-panel"><div class="dash-panel-head"><div><span class="section-kicker">YOUR ACTIVITY</span><h3>Recent requests</h3></div><button class="text-link" onclick="go('myLeaves')">All applications <span aria-hidden="true">→</span></button></div><div class="request-list">${requestRows(recent)}</div></section><aside class="employee-side"><section class="dash-panel status-panel"><div class="dash-panel-head"><div><span class="section-kicker">STATUS BREAKDOWN</span><h3>Request outcomes</h3></div></div><div class="status-chart-row">${ring}${statusLegend}</div><p class="panel-footnote">Summary of your recorded applications.</p></section><section class="next-step-panel"><span class="next-step-icon" aria-hidden="true">＋</span><div><span class="section-kicker">NEED TIME AWAY?</span><h3>Plan your next request</h3><p>Choose your dates and add a short reason. You can follow the decision here.</p><button class="focus-link" onclick="go('apply')">Apply for leave <span aria-hidden="true">→</span></button></div></section></aside></div>`;
  const pending = applications.filter((item) => item.status === "Pending").sort((a, b) => Number(a.id) - Number(b.id));
  const queueRows = pending.length ? pending.slice(0, 4).map((item) => `<article class="queue-row"><div class="queue-avatar" aria-hidden="true">${escapeHtml(String(item.name || "?").trim().charAt(0).toUpperCase())}</div><div class="queue-main"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.roll_no || "Employee")} <i>·</i> ${escapeHtml(item.leave_type)} leave</span><small>${formatDate(item.start_date)} – ${formatDate(item.end_date)}</small></div><button class="small-btn view-btn" type="button" onclick="viewApplication(${Number(item.id)})">Review</button></article>`).join("") : `<div class="dash-empty queue-empty"><span class="empty-mark">✓</span><strong>Queue is clear</strong><p>There are no pending applications to review.</p></div>`;
  const recentDecisions = [...historyRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  const decisionRows = recentDecisions.length ? recentDecisions.map((item) => `<article class="decision-row"><span class="decision-mark ${String(item.action).toLowerCase() === "approved" ? "decision-approved" : "decision-rejected"}" aria-hidden="true">${String(item.action).toLowerCase() === "approved" ? "✓" : "×"}</span><div><strong>${escapeHtml(item.action)} · Application #${escapeHtml(item.application_id)}</strong><span>${escapeHtml(item.student || "Employee")} · ${formatTimestamp(item.created_at)}</span></div></article>`).join("") : `<div class="decision-empty">No decisions have been recorded yet.</div>`;
  const adminView = `<section class="admin-welcome"><div class="admin-welcome-copy"><span class="welcome-kicker">ADMINISTRATION</span><h2>Leave operations</h2><p>Review requests, record decisions, and keep the team moving.</p></div><div class="review-priority"><div class="priority-count">${counts.pending}</div><div><strong>${counts.pending === 1 ? "request" : "requests"} awaiting review</strong><span>${counts.pending ? "Your next decision is ready." : "You’re all caught up."}</span></div><button class="primary" onclick="go('applications');setStatusFilter('Pending')">Open queue <span aria-hidden="true">→</span></button></div><div class="admin-orbit" aria-hidden="true"></div></section>
    <div class="admin-metrics">${metric("Total applications", counts.total, "All employee requests", "metric-total")}${metric("Pending review", counts.pending, "Needs administrator action", "metric-pending")}${metric("Approved", counts.approved, "Decision recorded", "metric-approved")}${metric("Rejected", counts.rejected, "Decision recorded", "metric-rejected")}</div>
    <div class="admin-board"><section class="dash-panel queue-panel"><div class="dash-panel-head"><div><span class="section-kicker">ACTION REQUIRED</span><h3>Review queue</h3></div><button class="text-link" onclick="go('applications');setStatusFilter('Pending')">Manage queue <span aria-hidden="true">→</span></button></div><div class="queue-list">${queueRows}</div></section><aside class="admin-side"><section class="dash-panel status-panel"><div class="dash-panel-head"><div><span class="section-kicker">ORGANIZATION SNAPSHOT</span><h3>Request outcomes</h3></div></div><div class="status-chart-row">${ring}${statusLegend}</div><p class="panel-footnote">Live totals from the application register.</p></section><section class="dash-panel decisions-panel"><div class="dash-panel-head"><div><span class="section-kicker">AUDIT TRAIL</span><h3>Recent decisions</h3></div><button class="text-link" onclick="go('history')">History <span aria-hidden="true">→</span></button></div><div class="decision-list">${decisionRows}</div></section></aside></div>`;
  $("content").innerHTML = `${dateLine}${isAdmin ? adminView : employeeView}`;
}
function table(rows, admin = false, withSort = false) {
  if (!rows.length) return `<div class="empty"><strong>No applications yet</strong>${admin ? "New requests will appear here." : "When you submit a leave request, it will appear here."}</div>`;
  const cell = (label, value) => `<td data-label="${label}">${value}</td>`;
  const heading = (key, label) => withSort ? `<th><button class="sort-btn" onclick="sortApplications('${key}')">${label}${sortState.key === key ? (sortState.direction === "asc" ? " ↑" : " ↓") : " ↕"}</button></th>` : `<th>${label}</th>`;
  return `<div class="table-wrap"><table class="table"><thead><tr>${heading("id", "Application")}${heading("name", admin ? "Employee" : "Applicant")}${heading("leave_type", "Leave type")}${heading("start_date", "Dates")}${heading("created_at", "Submitted")}${heading("status", "Status")}${admin ? "<th>Actions</th>" : "<th>Details</th>"}</tr></thead><tbody>${rows.map((item) => {
    const id = Number(item.id);
    const identity = `<strong>#${escapeHtml(id)}</strong>`;
    const person = `<strong>${escapeHtml(item.name)}</strong>${item.roll_no ? `<br><small>${escapeHtml(item.roll_no)}</small>` : ""}`;
    const dates = `${formatDate(item.start_date)}<br><small>to ${formatDate(item.end_date)}</small>`;
    const submitted = item.created_at ? formatTimestamp(item.created_at) : "—";
    const actions = admin && item.status === "Pending"
      ? `<div class="actions"><button class="small-btn view-btn" onclick="viewApplication(${id})">View</button><button class="small-btn approve" onclick="openDecision(${id},'Approved')">Approve</button><button class="small-btn reject" onclick="openDecision(${id},'Rejected')">Reject</button></div>`
      : `<button class="small-btn view-btn" onclick="viewApplication(${id})">View details</button>`;
    return `<tr>${cell("Application", identity)}${cell(admin ? "Employee" : "Applicant", person)}${cell("Leave type", escapeHtml(item.leave_type))}${cell("Dates", dates)}${cell("Submitted", submitted)}${cell("Status", statusBadge(item.status))}${cell("Actions", actions)}</tr>`;
  }).join("")}</tbody></table></div>`;
}

function applyPage() {
  const today = new Date().toISOString().slice(0, 10);
  $("content").innerHTML = `<div class="page-heading-block"><div><span class="section-kicker">EMPLOYEE SELF SERVICE</span><h2>Request time away</h2><p>Share a few details so your approver can review your request.</p></div><span class="form-step">01 <i>/</i> 01</span></div>
    <div class="apply-layout"><div class="panel form-panel"><div class="form-panel-heading"><div class="form-step-icon">01</div><div><h3>Request details</h3><p>Complete the information below to submit your request.</p></div></div>
    <form id="leaveForm" novalidate><div class="form-grid">
      <div class="field"><label for="employeeName">Employee name</label><input id="employeeName" class="form-control" value="${escapeHtml(currentUser.name)}" readonly></div>
      <div class="field"><label for="rollNumber">Roll number</label><input id="rollNumber" class="form-control" value="${escapeHtml(currentUser.roll_no || "")}" readonly></div>
      <div class="field"><label for="leaveType">Leave type <span aria-hidden="true">*</span></label><select id="leaveType" class="form-control" required><option value="">Select a leave type</option><option>Casual</option><option>Medical</option><option>Emergency</option><option>Academic</option><option>Other</option></select><p class="form-error" id="leaveTypeError" hidden></p></div>
      <div class="field"><label for="startDate">Start date <span aria-hidden="true">*</span></label><input id="startDate" class="form-control" type="date" min="${today}" required><p class="form-error" id="startDateError" hidden></p></div>
      <div class="field"><label for="endDate">End date <span aria-hidden="true">*</span></label><input id="endDate" class="form-control" type="date" min="${today}" required><p class="form-error" id="endDateError" hidden></p></div>
      <div class="field full-field"><label for="reason">Reason for leave <span aria-hidden="true">*</span></label><textarea id="reason" class="form-control textarea" maxlength="250" placeholder="Briefly describe why you need leave" required aria-describedby="reasonHint charCount"></textarea><p class="field hint" id="reasonHint">Do not include sensitive medical details.</p><p class="form-error" id="reasonError" hidden></p><div id="charCount" class="char-count">0 / 250</div></div>
    </div><div class="form-footer"><p><span aria-hidden="true">◷</span> Your request will be sent to your approver for review.</p><button id="submitLeave" class="primary" type="submit">Submit request <span aria-hidden="true">→</span></button></div></form></div>
    <aside class="apply-aside"><div class="apply-aside-top"><span class="aside-label">BEFORE YOU SUBMIT</span><span class="aside-mini-mark">LF</span></div><h3>A clear request moves faster.</h3><p>Choose accurate dates and include the context your approver needs.</p><div class="apply-checklist"><div><span>01</span><span><strong>Choose your leave type</strong><small>Select the option that best fits.</small></span></div><div><span>02</span><span><strong>Confirm your dates</strong><small>End date can match the start date.</small></span></div><div><span>03</span><span><strong>Add a short reason</strong><small>A brief explanation is enough.</small></span></div></div><div class="privacy-note"><span aria-hidden="true">⌑</span><span>Avoid sharing sensitive medical details in the reason field.</span></div></aside></div>`;
  const form = $("leaveForm");
  $("reason").addEventListener("input", () => { $("charCount").textContent = `${$("reason").value.length} / 250`; });
  $("startDate").addEventListener("change", () => { $("endDate").min = $("startDate").value || today; validateDates(false); });
  $("endDate").addEventListener("change", () => validateDates(false));
  form.addEventListener("submit", submitLeave);
}
function setFieldError(field, message) {
  const input = $(field);
  const error = $(`${field}Error`);
  if (!input || !error) return;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  error.textContent = message;
  error.hidden = !message;
}
function validateDates(showRequired = true) {
  const start = $("startDate")?.value || "";
  const end = $("endDate")?.value || "";
  let valid = true;
  if (showRequired && !start) { setFieldError("startDate", "Choose a start date."); valid = false; }
  else setFieldError("startDate", "");
  if (showRequired && !end) { setFieldError("endDate", "Choose an end date."); valid = false; }
  else if (start && end && end < start) { setFieldError("endDate", "End date must be on or after the start date."); valid = false; }
  else setFieldError("endDate", "");
  return valid;
}
async function submitLeave(event) {
  event.preventDefault();
  if (busy) return;
  const type = $("leaveType").value;
  const reason = $("reason").value.trim();
  setFieldError("leaveType", type ? "" : "Choose a leave type.");
  setFieldError("reason", reason ? "" : "Add a short reason for your request.");
  const validDates = validateDates(true);
  if (!type || !reason || !validDates) return;
  const button = $("submitLeave");
  busy = true;
  button.disabled = true;
  button.innerHTML = `<span class="spinner" aria-hidden="true"></span> Submitting…`;
  try {
    await api("/api/applications", "POST", {
      leaveType: type, startDate: $("startDate").value, endDate: $("endDate").value, reason
    });
    await refreshData();
    showToast("Your leave request was submitted.", "success");
    go("myLeaves");
  } catch (error) {
    showToast(friendlyError(error), "error");
    button.disabled = false;
    button.textContent = "Submit request";
  } finally { busy = false; }
}
function myLeaves() {
  const action = `<button class="primary" onclick="go('apply')">＋ Apply for leave</button>`;
  const counts = stats();
  $("content").innerHTML = `<div class="page-heading-block"><div><span class="section-kicker">EMPLOYEE SELF SERVICE</span><h2>My applications</h2><p>Track each request and review the decision details.</p></div>${action}</div><div class="mini-summary"><div><span>Total requests</span><strong>${counts.total}</strong></div><div><span>In review</span><strong>${counts.pending}</strong></div><div><span>Approved</span><strong>${counts.approved}</strong></div><div><span>Rejected</span><strong>${counts.rejected}</strong></div></div><div class="activity-panel applications-list-panel"><div class="section-heading"><div><span class="section-kicker">REQUEST REGISTER</span><h3>All applications</h3></div><span class="register-count">${applications.length} total</span></div>${table([...applications].sort((a, b) => Number(b.id) - Number(a.id)), false, false)}</div>`;
}
function applicationsPage() {
  const rows = getSortedApplications(applications.filter(matchesFilters));
  $("content").innerHTML = `${pageIntro("Application queue", "Search requests and review pending decisions.")}
    <div class="panel"><div class="table-toolbar"><div class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><input id="searchBox" class="form-control" type="search" aria-label="Search applications" placeholder="Search ID, name or roll number"></div>
      <select id="statusFilter" class="filter" aria-label="Filter by status"><option value="All">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select>
      <select id="typeFilter" class="filter" aria-label="Filter by leave type"><option value="All Types">All leave types</option><option>Casual</option><option>Medical</option><option>Emergency</option><option>Academic</option><option>Other</option></select>
      <button class="secondary" type="button" onclick="clearFilters()">Clear</button></div>
      <div class="panel-heading"><div><h3>All requests</h3><p id="resultCount">${rows.length} application${rows.length === 1 ? "" : "s"}</p></div></div><div id="adminTable">${table(rows, true, true)}</div></div>`;
  $("searchBox").addEventListener("input", filterApps);
  $("statusFilter").addEventListener("change", filterApps);
  $("typeFilter").addEventListener("change", filterApps);
}
function matchesFilters(item) {
  const query = $("searchBox")?.value.trim().toLowerCase() || "";
  const status = $("statusFilter")?.value || "All";
  const type = $("typeFilter")?.value || "All Types";
  return (status === "All" || item.status === status) && (type === "All Types" || item.leave_type === type) &&
    (!query || String(item.id).includes(query) || String(item.name || "").toLowerCase().includes(query) || String(item.roll_no || "").toLowerCase().includes(query));
}
function getSortedApplications(rows) {
  return rows.sort((a, b) => {
    let left = a[sortState.key] ?? "";
    let right = b[sortState.key] ?? "";
    if (sortState.key === "id") { left = Number(left); right = Number(right); }
    else { left = String(left).toLowerCase(); right = String(right).toLowerCase(); }
    const result = left < right ? -1 : left > right ? 1 : 0;
    return sortState.direction === "asc" ? result : -result;
  });
}
function sortApplications(key) {
  sortState.direction = sortState.key === key && sortState.direction === "asc" ? "desc" : "asc";
  sortState.key = key;
  filterApps();
}
function filterApps() {
  const rows = getSortedApplications(applications.filter(matchesFilters));
  if ($("resultCount")) $("resultCount").textContent = `${rows.length} application${rows.length === 1 ? "" : "s"}`;
  if ($("adminTable")) $("adminTable").innerHTML = table(rows, true, true);
}
function clearFilters() {
  $("searchBox").value = "";
  $("statusFilter").value = "All";
  $("typeFilter").value = "All Types";
  filterApps();
}
function setStatusFilter(status) {
  if ($("statusFilter")) { $("statusFilter").value = status; filterApps(); }
}

function findApplication(id) {
  return applications.find((item) => Number(item.id) === Number(id));
}
function viewApplication(id) {
  const item = findApplication(id);
  if (!item) return;
  const matchingHistory = role === "admin" ? historyRows.filter((row) => Number(row.application_id) === Number(id)) : [];
  const historyHtml = matchingHistory.length ? `<div class="detail detail-wide"><label>Decision history</label><div class="history-list">${matchingHistory.map((row) => `<div class="history-item"><strong>${escapeHtml(row.action)}${row.remark ? ` · ${escapeHtml(row.remark)}` : ""}</strong><small>${formatTimestamp(row.created_at)}</small></div>`).join("")}</div></div>` : "";
  $("modalRoot").innerHTML = `<div class="modal-backdrop" role="presentation" onclick="if(event.target===this)closeModal()"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><div class="modal-head"><div><div class="eyebrow">APPLICATION #${escapeHtml(item.id)}</div><h2 id="detailTitle">${escapeHtml(item.name)}</h2><p>${escapeHtml(item.roll_no || "")}</p></div><button class="close" type="button" onclick="closeModal()" aria-label="Close details">×</button></div>
    <div class="detail-grid"><div class="detail"><label>Leave type</label>${escapeHtml(item.leave_type)}</div><div class="detail"><label>Status</label>${statusBadge(item.status)}</div><div class="detail"><label>Start date</label>${formatDate(item.start_date)}</div><div class="detail"><label>End date</label>${formatDate(item.end_date)}</div><div class="detail"><label>Submitted</label>${formatTimestamp(item.created_at)}</div><div class="detail"><label>Last updated</label>${formatTimestamp(item.updated_at)}</div></div>
    <div class="detail detail-wide"><label>Reason</label>${escapeHtml(item.reason)}</div>${item.admin_remark ? `<div class="detail detail-wide"><label>Administrator remarks</label>${escapeHtml(item.admin_remark)}</div>` : ""}${historyHtml}
    ${role === "admin" && item.status === "Pending" ? `<div class="modal-actions"><button class="small-btn reject" onclick="closeModal();openDecision(${Number(item.id)},'Rejected')">Reject request</button><button class="primary" onclick="closeModal();openDecision(${Number(item.id)},'Approved')">Approve request</button></div>` : ""}</section></div>`;
  $("modalRoot").querySelector(".close")?.focus();
}
function closeModal() { $("modalRoot").innerHTML = ""; }
function openDecision(id, status) {
  const item = findApplication(id);
  if (!item || item.status !== "Pending" || busy) return;
  const action = status === "Approved" ? "Approve" : "Reject";
  $("modalRoot").innerHTML = `<div class="modal-backdrop" role="presentation" onclick="if(event.target===this)closeModal()"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="decisionTitle"><div class="modal-head"><div><div class="eyebrow">APPLICATION #${escapeHtml(item.id)}</div><h2 id="decisionTitle">${action} this request?</h2><p>${escapeHtml(item.name)} · ${escapeHtml(item.leave_type)} · ${formatDate(item.start_date)} to ${formatDate(item.end_date)}</p></div><button class="close" type="button" onclick="closeModal()" aria-label="Close confirmation">×</button></div>
    <p class="confirm-copy">The request status will update after the server confirms your decision.</p><label for="decisionRemark" class="field label">Administrator remarks</label><textarea id="decisionRemark" class="form-control textarea" maxlength="500" placeholder="Add context for the employee (optional)"></textarea><div class="modal-actions"><button class="secondary" type="button" onclick="closeModal()">Cancel</button><button id="confirmDecision" class="${status === "Approved" ? "primary" : "small-btn reject"}" type="button" onclick="changeStatus(${Number(item.id)},'${status}')">${action} request</button></div></section></div>`;
  $("modalRoot").querySelector(".close")?.focus();
}
async function changeStatus(id, status) {
  if (busy) return;
  const item = findApplication(id);
  if (!item || item.status !== "Pending") return;
  const button = $("confirmDecision");
  const remark = $("decisionRemark")?.value.trim() || "";
  busy = true;
  if (button) { button.disabled = true; button.textContent = "Saving decision…"; }
  try {
    // Keep the table unchanged until the API confirms the persisted decision.
    const updated = await api(`/api/applications/${id}/status`, "PATCH", { status, remark });
    applications = applications.map((row) => Number(row.id) === Number(id) ? updated : row);
    await refreshData();
    closeModal();
    showToast(`Application #${id} marked ${status.toLowerCase()}.`, "success");
    go(currentPage);
  } catch (error) {
    showToast(friendlyError(error), "error");
    if (button) { button.disabled = false; button.textContent = `${status === "Approved" ? "Approve" : "Reject"} request`; }
  } finally { busy = false; }
}

async function historyPage() {
  const items = [...historyRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $("content").innerHTML = `${pageIntro("Approval history", "A record of decisions made on leave requests.")}
    <div class="panel"><div class="panel-heading"><div><h3>Recent decisions</h3><p>Decision records returned by the existing server</p></div></div>${items.length ? `<div class="history-list">${items.map((row) => `<article class="history-item"><strong>Application #${escapeHtml(row.application_id)} · ${escapeHtml(row.action)}</strong><p>${escapeHtml(row.student)}${row.remark ? ` — ${escapeHtml(row.remark)}` : ""}</p><small>${formatTimestamp(row.created_at)}</small></article>`).join("")}</div>` : `<div class="empty"><strong>No decisions recorded</strong>Approval and rejection history will appear here.</div>`}</div>`;
}
function dsaPage() {
  const records = list.toArray();
  const pending = queue.toArray();
  const stack = history.toArray();
  $("content").innerHTML = `${pageIntro("Data structure operations", "Explore the structures used in the LeaveFlow academic demonstration.")}
    <p class="info">The interface continues to use the backend for stored records; these structures support the project's DSA demonstration.</p>
    <div class="dsa-grid"><article class="dsa-card"><h3>Linked list · Applications</h3><div class="structure">HEAD → ${records.map((item) => `[${escapeHtml(item.id)}]`).join(" → ") || "NULL"} → NULL</div><p class="info" style="margin-top:10px">${records.length} records loaded</p><div class="op-row"><button class="small-btn" onclick="dsaSearch()">Linear search</button><button class="small-btn" onclick="dsaSort()">Bubble sort by ID</button></div></article>
    <article class="dsa-card"><h3>Queue · Pending</h3><div class="structure">FRONT → ${pending.map((item) => `[${escapeHtml(item.id)}]`).join(" → ") || "EMPTY"}${pending.length ? " ← REAR" : ""}</div><p class="info" style="margin-top:10px">First in, first out</p></article>
    <article class="dsa-card"><h3>Stack · History</h3><div class="structure">TOP<br>↓<br>${stack.slice(0, 5).map((row) => `[${escapeHtml(row.action)} #${escapeHtml(row.application_id)}]`).join("<br>↓<br>") || "EMPTY"}</div><p class="info" style="margin-top:10px">Last in, first out</p></article></div>
    <div class="panel" style="margin-top:16px"><div class="panel-heading"><div><h3>Complexity reference</h3><p>Time complexity of the demonstrated operations</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Operation</th><th>Time</th><th>Space</th></tr></thead><tbody><tr><td data-label="Operation">Linked list search</td><td data-label="Time">O(n)</td><td data-label="Space">O(1)</td></tr><tr><td data-label="Operation">Queue enqueue / dequeue</td><td data-label="Time">O(1)</td><td data-label="Space">O(n)</td></tr><tr><td data-label="Operation">Stack push / pop</td><td data-label="Time">O(1)</td><td data-label="Space">O(n)</td></tr><tr><td data-label="Operation">Linear search</td><td data-label="Time">O(n)</td><td data-label="Space">O(1)</td></tr></tbody></table></div></div>`;
}
function dsaSearch() {
  const query = window.prompt("Enter an application ID, name or roll number:");
  if (query === null) return;
  if (!query.trim()) { showToast("Enter an application ID, name or roll number.", "error"); return; }
  const found = linearSearch(list.toArray(), query.trim());
  if (found) showToast(`Found application #${found.id} for ${found.name}.`, "success");
  else showToast("No matching application was found.");
}
function dsaSort() {
  applications = bubbleSort(applications, "id");
  list.head = null;
  list.size = 0;
  applications.forEach((item) => list.append(item));
  showToast("Applications sorted by ID in the DSA demonstration.", "success");
  dsaPage();
}

(async function restoreSession() {
  const saved = localStorage.getItem("leaveFlowUser");
  if (!saved) return;
  try {
    currentUser = JSON.parse(saved);
    if (!currentUser?.username || !["student", "admin"].includes(currentUser.role)) throw new Error("Invalid session");
    role = currentUser.role;
    await enterApp();
  } catch {
    logout();
  }
})();

