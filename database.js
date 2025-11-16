const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'study.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
function getDB() {
    return new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });
}

// Initialize database schema
function initSchema(db) {
    return new Promise((resolve, reject) => {
        const operations = [
            `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                answer TEXT NOT NULL,
                normalized_answer TEXT NOT NULL,
                question_number INTEGER,
                FOREIGN KEY (course_id) REFERENCES courses(id),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`,
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                provider TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, provider_id)
            )`,
            `CREATE TABLE IF NOT EXISTS user_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                is_correct INTEGER DEFAULT 0,
                attempts INTEGER DEFAULT 0,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id),
                UNIQUE(user_id, question_id)
            )`,
            `CREATE TABLE IF NOT EXISTS question_alternative_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                normalized_answer TEXT NOT NULL,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
                UNIQUE(question_id, normalized_answer)
            )`,
            `CREATE TABLE IF NOT EXISTS user_progress_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                is_correct INTEGER DEFAULT 0,
                attempts INTEGER DEFAULT 0,
                answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id)
            )`,
            `CREATE TABLE IF NOT EXISTS question_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                user_id INTEGER,
                issue_type TEXT NOT NULL,
                description TEXT NOT NULL,
                reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                acknowledged_at DATETIME,
                acknowledged_by INTEGER,
                FOREIGN KEY (question_id) REFERENCES questions(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (acknowledged_by) REFERENCES users(id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_id)`,
            `CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_progress_question ON user_progress(question_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_progress_history_user ON user_progress_history(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_progress_history_question ON user_progress_history(question_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_progress_history_answered_at ON user_progress_history(answered_at)`,
            `CREATE INDEX IF NOT EXISTS idx_question_reports_question ON question_reports(question_id)`,
            `CREATE INDEX IF NOT EXISTS idx_question_reports_user ON question_reports(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_question_reports_reported_at ON question_reports(reported_at)`
        ];

        // Execute operations sequentially to ensure tables are created before indexes
        let index = 0;
        
        function executeNext() {
            if (index >= operations.length) {
                resolve();
                return;
            }
            
            const sql = operations[index];
            db.run(sql, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                index++;
                executeNext();
            });
        }
        
        executeNext();
    });
}

// Check if database needs seeding
function needsSeeding(db) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
            if (err) reject(err);
            else resolve(row.count === 0);
        });
    });
}

module.exports = {
    getDB,
    initSchema,
    needsSeeding,
    DB_PATH
};

