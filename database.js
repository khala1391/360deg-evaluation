const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'evaluation.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initialize() {
  const db = getDb();

  db.exec(`
    -- Evaluation cycles/rounds
    CREATE TABLE IF NOT EXISTS evaluation_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Users (evaluators)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      cycle_id INTEGER NOT NULL,
      has_submitted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cycle_id) REFERENCES evaluation_cycles(id),
      UNIQUE(email, cycle_id)
    );

    -- Rating evaluations (Part A)
    CREATE TABLE IF NOT EXISTS rating_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      evaluator_id INTEGER NOT NULL,
      evaluatee_id INTEGER NOT NULL,
      topic_number INTEGER NOT NULL,
      sub_topic_number INTEGER NOT NULL,
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cycle_id) REFERENCES evaluation_cycles(id),
      FOREIGN KEY (evaluator_id) REFERENCES users(id),
      FOREIGN KEY (evaluatee_id) REFERENCES users(id),
      UNIQUE(cycle_id, evaluator_id, evaluatee_id, topic_number, sub_topic_number)
    );

    -- Open-ended evaluations (Part B)
    CREATE TABLE IF NOT EXISTS openended_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      evaluator_id INTEGER NOT NULL,
      evaluatee_id INTEGER NOT NULL,
      aspect_number INTEGER NOT NULL,
      question_number INTEGER NOT NULL,
      answer TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cycle_id) REFERENCES evaluation_cycles(id),
      FOREIGN KEY (evaluator_id) REFERENCES users(id),
      FOREIGN KEY (evaluatee_id) REFERENCES users(id),
      UNIQUE(cycle_id, evaluator_id, evaluatee_id, aspect_number, question_number)
    );
  `);

  console.log('Database initialized successfully.');
}

// ========================
// Cycle Management
// ========================

function createCycle(cycleName, startDate, endDate) {
  const db = getDb();
  // Deactivate all existing cycles
  db.prepare('UPDATE evaluation_cycles SET is_active = 0').run();
  const result = db.prepare(
    'INSERT INTO evaluation_cycles (cycle_name, start_date, end_date, is_active) VALUES (?, ?, ?, 1)'
  ).run(cycleName, startDate, endDate);
  return result.lastInsertRowid;
}

function getActiveCycle() {
  const db = getDb();
  return db.prepare('SELECT * FROM evaluation_cycles WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
}

function getAllCycles() {
  const db = getDb();
  return db.prepare('SELECT * FROM evaluation_cycles ORDER BY id DESC').all();
}

function updateCycleDates(cycleId, startDate, endDate) {
  const db = getDb();
  db.prepare('UPDATE evaluation_cycles SET start_date = ?, end_date = ? WHERE id = ?').run(startDate, endDate, cycleId);
}

function isCycleActive(cycle) {
  if (!cycle || !cycle.is_active) return false;
  const now = new Date();
  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date + 'T23:59:59');
  return now >= start && now <= end;
}

// ========================
// User Management
// ========================

function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function addUser(email, cycleId, displayName = '') {
  const db = getDb();
  const password = generatePassword();
  try {
    const result = db.prepare(
      'INSERT INTO users (email, password, cycle_id, display_name) VALUES (?, ?, ?, ?)'
    ).run(email.trim().toLowerCase(), password, cycleId, displayName || email.split('@')[0]);
    return { id: result.lastInsertRowid, email: email.trim().toLowerCase(), password, displayName: displayName || email.split('@')[0] };
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return null; // User already exists for this cycle
    }
    throw e;
  }
}

function getUsersByCycle(cycleId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE cycle_id = ? ORDER BY email').all(cycleId);
}

function getUserByEmailAndCycle(email, cycleId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ? AND cycle_id = ?').get(email.trim().toLowerCase(), cycleId);
}

function getUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function markUserSubmitted(userId) {
  const db = getDb();
  db.prepare('UPDATE users SET has_submitted = 1 WHERE id = ?').run(userId);
}

function deleteUser(userId) {
  const db = getDb();
  db.prepare('DELETE FROM rating_evaluations WHERE evaluator_id = ? OR evaluatee_id = ?').run(userId, userId);
  db.prepare('DELETE FROM openended_evaluations WHERE evaluator_id = ? OR evaluatee_id = ?').run(userId, userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

function resetUserPassword(userId) {
  const db = getDb();
  const password = generatePassword();
  db.prepare('UPDATE users SET password = ?, has_submitted = 0 WHERE id = ?').run(password, userId);
  const user = getUserById(userId);
  return { ...user, password };
}

// ========================
// Evaluation Data
// ========================

function saveRatingEvaluation(cycleId, evaluatorId, evaluateeId, topicNumber, subTopicNumber, score) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO rating_evaluations (cycle_id, evaluator_id, evaluatee_id, topic_number, sub_topic_number, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cycleId, evaluatorId, evaluateeId, topicNumber, subTopicNumber, score);
}

function saveOpenEndedEvaluation(cycleId, evaluatorId, evaluateeId, aspectNumber, questionNumber, answer) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO openended_evaluations (cycle_id, evaluator_id, evaluatee_id, aspect_number, question_number, answer)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cycleId, evaluatorId, evaluateeId, aspectNumber, questionNumber, answer);
}

function saveBulkEvaluation(cycleId, evaluatorId, evaluations) {
  const db = getDb();
  const insertRating = db.prepare(`
    INSERT OR REPLACE INTO rating_evaluations (cycle_id, evaluator_id, evaluatee_id, topic_number, sub_topic_number, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertOpenEnded = db.prepare(`
    INSERT OR REPLACE INTO openended_evaluations (cycle_id, evaluator_id, evaluatee_id, aspect_number, question_number, answer)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((evals) => {
    for (const ev of evals) {
      if (ev.type === 'rating') {
        insertRating.run(cycleId, evaluatorId, ev.evaluateeId, ev.topicNumber, ev.subTopicNumber, ev.score);
      } else if (ev.type === 'openended') {
        insertOpenEnded.run(cycleId, evaluatorId, ev.evaluateeId, ev.aspectNumber, ev.questionNumber, ev.answer);
      }
    }
  });

  transaction(evaluations);
}

function getRatingsForUser(cycleId, evaluateeId) {
  const db = getDb();
  return db.prepare(`
    SELECT re.*, u.email as evaluator_email, u.display_name as evaluator_name
    FROM rating_evaluations re
    JOIN users u ON re.evaluator_id = u.id
    WHERE re.cycle_id = ? AND re.evaluatee_id = ?
    ORDER BY re.topic_number, re.sub_topic_number
  `).all(cycleId, evaluateeId);
}

function getOpenEndedForUser(cycleId, evaluateeId) {
  const db = getDb();
  return db.prepare(`
    SELECT oe.*, u.email as evaluator_email, u.display_name as evaluator_name
    FROM openended_evaluations oe
    JOIN users u ON oe.evaluator_id = u.id
    WHERE oe.cycle_id = ? AND oe.evaluatee_id = ?
    ORDER BY oe.aspect_number, oe.question_number
  `).all(cycleId, evaluateeId);
}

function getAverageScoresForUser(cycleId, evaluateeId) {
  const db = getDb();
  return db.prepare(`
    SELECT topic_number, sub_topic_number, 
           AVG(score) as avg_score, 
           COUNT(*) as num_evaluators,
           MIN(score) as min_score,
           MAX(score) as max_score
    FROM rating_evaluations 
    WHERE cycle_id = ? AND evaluatee_id = ?
    GROUP BY topic_number, sub_topic_number
    ORDER BY topic_number, sub_topic_number
  `).all(cycleId, evaluateeId);
}

function getTopicAverages(cycleId, evaluateeId) {
  const db = getDb();
  return db.prepare(`
    SELECT topic_number, 
           AVG(score) as avg_score,
           COUNT(DISTINCT evaluator_id) as num_evaluators
    FROM rating_evaluations 
    WHERE cycle_id = ? AND evaluatee_id = ?
    GROUP BY topic_number
    ORDER BY topic_number
  `).all(cycleId, evaluateeId);
}

function getEvaluationProgress(cycleId) {
  const db = getDb();
  const users = getUsersByCycle(cycleId);
  return users.map(user => ({
    ...user,
    password: '••••••••' // Hide password in progress view
  }));
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initialize,
  getDb,
  // Cycles
  createCycle,
  getActiveCycle,
  getAllCycles,
  updateCycleDates,
  isCycleActive,
  // Users
  generatePassword,
  addUser,
  getUsersByCycle,
  getUserByEmailAndCycle,
  getUserById,
  markUserSubmitted,
  deleteUser,
  resetUserPassword,
  // Evaluations
  saveRatingEvaluation,
  saveOpenEndedEvaluation,
  saveBulkEvaluation,
  getRatingsForUser,
  getOpenEndedForUser,
  getAverageScoresForUser,
  getTopicAverages,
  getEvaluationProgress,
  close
};
