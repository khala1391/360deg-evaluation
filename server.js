require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database');
const email = require('./email');
const { EVALUATION_TOPICS, OPENENDED_ASPECTS, RATING_SCALE } = require('./evaluationData');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render/Heroku/etc
app.set('trust proxy', 1);

// Initialize database
db.initialize();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    secure: 'auto',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ========================
// Auth Middleware
// ========================

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized - Admin access required' });
}

function requireUser(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized - Please login' });
}

// ========================
// API: Evaluation Data (public)
// ========================

app.get('/api/evaluation-data', (req, res) => {
  res.json({ topics: EVALUATION_TOPICS, aspects: OPENENDED_ASPECTS, ratingScale: RATING_SCALE });
});

// ========================
// API: Admin Authentication
// ========================

app.post('/api/admin/login', (req, res) => {
  const { email: adminEmail, password } = req.body;
  if (adminEmail === (process.env.ADMIN_EMAIL || 'admin@365holding.co.th') &&
      password === (process.env.ADMIN_PASSWORD || 'admin360eval')) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

app.get('/api/admin/email-status', requireAdmin, (req, res) => {
  res.json({ emailEnabled: email.isEmailEnabled() });
});

// SMTP connection verify — ทดสอบว่า connect ได้หรือไม่
app.post('/api/admin/test-smtp', requireAdmin, async (req, res) => {
  if (!email.isEmailEnabled()) {
    return res.json({
      success: false,
      error: 'SMTP ยังไม่ได้ตั้งค่า (SMTP_HOST / SMTP_USER / SMTP_PASS ว่าง)',
      config: {
        host: process.env.SMTP_HOST || '(not set)',
        port: process.env.SMTP_PORT || '465',
        secure: process.env.SMTP_SECURE !== 'false' ? 'true (SSL)' : 'false (STARTTLS)',
        user: process.env.SMTP_USER ? '***configured***' : '(not set)'
      }
    });
  }
  try {
    const info = await email.verifyConnection();
    res.json({ success: true, message: 'SMTP connection OK ✅', info });
  } catch (err) {
    console.error('SMTP verify failed:', err);
    res.json({
      success: false,
      error: err.message,
      code: err.code,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || '465',
        secure: process.env.SMTP_SECURE !== 'false' ? 'true (SSL)' : 'false (STARTTLS)',
        user: process.env.SMTP_USER ? '***configured***' : '(not set)'
      }
    });
  }
});

// ส่งอีเมลทดสอบ
app.post('/api/admin/test-email', requireAdmin, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'กรุณาระบุอีเมลปลายทาง' });
  if (!email.isEmailEnabled()) {
    return res.json({ success: false, error: 'SMTP ยังไม่ได้ตั้งค่า' });
  }
  try {
    const result = await email.sendTestEmail(to);
    res.json(result);
  } catch (err) {
    console.error('Test email failed:', err);
    res.json({ success: false, error: err.message, code: err.code });
  }
});

// ========================
// API: Cycle Management (Admin)
// ========================

app.post('/api/admin/cycles', requireAdmin, (req, res) => {
  const { cycleName, startDate, endDate } = req.body;
  if (!cycleName || !startDate || !endDate) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }
  const cycleId = db.createCycle(cycleName, startDate, endDate);
  res.json({ success: true, cycleId });
});

app.get('/api/admin/cycles', requireAdmin, (req, res) => {
  const cycles = db.getAllCycles();
  const activeCycle = db.getActiveCycle();
  res.json({ cycles, activeCycle, isActive: activeCycle ? db.isCycleActive(activeCycle) : false });
});

app.put('/api/admin/cycles/:id', requireAdmin, (req, res) => {
  const { startDate, endDate } = req.body;
  db.updateCycleDates(parseInt(req.params.id), startDate, endDate);
  res.json({ success: true });
});

// ========================
// API: User Management (Admin)
// ========================

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { users: userList } = req.body;
  const cycle = db.getActiveCycle();
  if (!cycle) return res.status(400).json({ error: 'กรุณาสร้างรอบการประเมินก่อน' });

  const results = [];
  for (const entry of userList) {
    const emailAddr = (entry.email || '').trim();
    const displayName = (entry.name || '').trim();
    if (!emailAddr) continue;
    const user = db.addUser(emailAddr, cycle.id, displayName);
    if (user) {
      results.push(user);
    } else {
      results.push({ email: emailAddr, error: 'มีอยู่ในระบบแล้ว' });
    }
  }
  res.json({ success: true, results });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.json({ users: [], cycle: null });
  const users = db.getUsersByCycle(cycle.id);
  res.json({ users, cycle });
});

app.put('/api/admin/users/:id/name', requireAdmin, (req, res) => {
  const { displayName } = req.body;
  db.updateUserDisplayName(parseInt(req.params.id), displayName || '');
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  db.deleteUser(parseInt(req.params.id));
  res.json({ success: true });
});

app.post('/api/admin/users/:id/reset', requireAdmin, (req, res) => {
  const user = db.resetUserPassword(parseInt(req.params.id));
  res.json({ success: true, user });
});

// ========================
// API: Send Emails (Admin)
// ========================

app.post('/api/admin/send-passwords', requireAdmin, async (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.status(400).json({ error: 'ไม่มีรอบการประเมินที่ active' });

  const users = db.getUsersByCycle(cycle.id);
  let sent = 0, failed = 0;
  const results = [];
  for (const user of users) {
    console.log(`📧 Sending password to ${user.email}...`);
    const result = await email.sendPasswordEmail(user.email, user.password, cycle.cycle_name);
    if (result.success) sent++; else failed++;
    results.push(result);
  }
  console.log(`📊 Email results: ${sent} sent, ${failed} failed out of ${users.length}`);
  res.json({ success: true, results, summary: { total: users.length, sent, failed } });
});

app.post('/api/admin/send-password/:id', requireAdmin, async (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.status(400).json({ error: 'ไม่มีรอบการประเมินที่ active' });

  const user = db.getUserById(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

  const result = await email.sendPasswordEmail(user.email, user.password, cycle.cycle_name);
  res.json(result);
});

app.post('/api/admin/send-reminders', requireAdmin, async (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.status(400).json({ error: 'ไม่มีรอบการประเมินที่ active' });

  const users = db.getUsersByCycle(cycle.id).filter(u => !u.has_submitted);
  const results = [];
  for (const user of users) {
    const result = await email.sendReminderEmail(user.email, cycle.cycle_name, cycle.end_date);
    results.push(result);
  }
  res.json({ success: true, results, count: users.length });
});

// ========================
// API: Evaluation Progress (Admin)
// ========================

app.get('/api/admin/progress', requireAdmin, (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.json({ users: [], cycle: null });
  const progress = db.getEvaluationProgress(cycle.id);
  const total = progress.length;
  const submitted = progress.filter(u => u.has_submitted).length;
  res.json({ users: progress, cycle, total, submitted });
});

// ========================
// API: Reports (Admin)
// ========================

app.get('/api/admin/report/:userId', requireAdmin, (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.status(400).json({ error: 'ไม่มีรอบการประเมิน' });

  const userId = parseInt(req.params.userId);
  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

  const ratings = db.getRatingsForUser(cycle.id, userId);
  const openEnded = db.getOpenEndedForUser(cycle.id, userId);
  const averages = db.getAverageScoresForUser(cycle.id, userId);
  const topicAverages = db.getTopicAverages(cycle.id, userId);

  res.json({
    user: { id: user.id, email: user.email, display_name: user.display_name },
    cycle,
    ratings,
    openEnded,
    averages,
    topicAverages,
    topics: EVALUATION_TOPICS,
    aspects: OPENENDED_ASPECTS,
    ratingScale: RATING_SCALE
  });
});

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const cycle = db.getActiveCycle();
  if (!cycle) return res.json({ reports: [], cycle: null });

  const users = db.getUsersByCycle(cycle.id);
  const reports = users.map(user => {
    const topicAverages = db.getTopicAverages(cycle.id, user.id);
    const overallAvg = topicAverages.length > 0
      ? topicAverages.reduce((sum, t) => sum + t.avg_score, 0) / topicAverages.length
      : 0;
    return {
      user: { id: user.id, email: user.email, display_name: user.display_name },
      topicAverages,
      overallAvg: Math.round(overallAvg * 100) / 100
    };
  });
  res.json({ reports, cycle });
});

// ========================
// API: User Authentication
// ========================

app.post('/api/user/login', (req, res) => {
  const { email: userEmail, password } = req.body;
  const cycle = db.getActiveCycle();

  if (!cycle) {
    return res.status(403).json({ error: 'ขณะนี้ไม่มีรอบการประเมินที่เปิดอยู่ กรุณาติดต่อผู้ดูแลระบบ' });
  }

  if (!db.isCycleActive(cycle)) {
    return res.status(403).json({ error: 'รอบการประเมินสิ้นสุดแล้ว กรุณาติดต่อผู้ดูแลระบบสำหรับข้อมูลเพิ่มเติม' });
  }

  const user = db.getUserByEmailAndCycle(userEmail, cycle.id);
  if (!user) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  if (user.has_submitted) {
    return res.status(403).json({ error: 'ท่านได้ทำแบบประเมินเรียบร้อยแล้ว หากต้องการแก้ไข กรุณาติดต่อผู้ดูแลระบบ' });
  }

  req.session.userId = user.id;
  req.session.cycleId = cycle.id;
  res.json({
    success: true,
    user: { id: user.id, email: user.email, display_name: user.display_name }
  });
});

app.post('/api/user/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/user/check', (req, res) => {
  if (req.session && req.session.userId) {
    const user = db.getUserById(req.session.userId);
    if (user) {
      return res.json({ loggedIn: true, user: { id: user.id, email: user.email, display_name: user.display_name } });
    }
  }
  res.json({ loggedIn: false });
});

// ========================
// API: Evaluation (User)
// ========================

app.get('/api/user/evaluatees', requireUser, (req, res) => {
  const cycleId = req.session.cycleId;
  const userId = req.session.userId;
  const allUsers = db.getUsersByCycle(cycleId);
  // Exclude self
  const evaluatees = allUsers
    .filter(u => u.id !== userId)
    .map(u => ({ id: u.id, email: u.email, display_name: u.display_name }));
  res.json({ evaluatees });
});

app.post('/api/user/submit-evaluation', requireUser, (req, res) => {
  const cycleId = req.session.cycleId;
  const evaluatorId = req.session.userId;
  const { evaluations } = req.body;

  const user = db.getUserById(evaluatorId);
  if (user.has_submitted) {
    return res.status(403).json({ error: 'ท่านได้ทำแบบประเมินเรียบร้อยแล้ว' });
  }

  try {
    db.saveBulkEvaluation(cycleId, evaluatorId, evaluations);
    db.markUserSubmitted(evaluatorId);
    // Destroy session after submission
    req.session.destroy();
    res.json({ success: true, message: 'บันทึกแบบประเมินเรียบร้อยแล้ว ขอบคุณที่สละเวลา' });
  } catch (error) {
    console.error('Error saving evaluation:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง' });
  }
});

// ========================
// Serve HTML pages
// ========================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/evaluate', (req, res) => res.sendFile(path.join(__dirname, 'public', 'evaluate.html')));
app.get('/report', (req, res) => res.sendFile(path.join(__dirname, 'public', 'report.html')));
app.get('/report/:userId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'report.html')));

// ========================
// Start Server
// ========================

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  360° Evaluation System`);
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin`);
  console.log(`========================================\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit();
});
