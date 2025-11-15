const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { isAuthenticated } = require('../auth');

// All progress routes require authentication
router.use(isAuthenticated);

// GET /api/progress - Get user's progress
router.get('/', (req, res, next) => {
    const db = getDB();
    const userId = req.user.id;
    
    const query = `
        SELECT up.question_id, up.is_correct, up.attempts, up.completed_at,
               q.question_number, q.normalized_answer,
               c.name as category_name
        FROM user_progress up
        JOIN questions q ON up.question_id = q.id
        JOIN categories c ON q.category_id = c.id
        WHERE up.user_id = ?
    `;
    
    db.all(query, [userId], (err, rows) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        const progress = rows.map(row => ({
            questionId: row.question_id,
            questionNumber: row.question_number,
            category: row.category_name,
            isCorrect: row.is_correct === 1,
            attempts: row.attempts,
            completedAt: row.completed_at
        }));
        
        res.json(progress);
    });
});

// GET /api/progress/:questionId - Get progress for specific question
router.get('/:questionId', (req, res, next) => {
    const db = getDB();
    const userId = req.user.id;
    const questionId = parseInt(req.params.questionId);
    
    db.get(
        'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
        [userId, questionId],
        (err, row) => {
            db.close();
            
            if (err) {
                return next(err);
            }
            
            if (!row) {
                return res.json(null);
            }
            
            res.json({
                questionId: row.question_id,
                isCorrect: row.is_correct === 1,
                attempts: row.attempts,
                completedAt: row.completed_at
            });
        }
    );
});

// POST /api/progress - Save or update progress
router.post('/', (req, res, next) => {
    const db = getDB();
    const userId = req.user.id;
    const { questionId, isCorrect, attempts } = req.body;
    
    if (!questionId || typeof isCorrect !== 'boolean' || typeof attempts !== 'number') {
        return res.status(400).json({ error: 'Invalid request data' });
    }
    
    // Check if progress exists
    db.get(
        'SELECT * FROM user_progress WHERE user_id = ? AND question_id = ?',
        [userId, questionId],
        (err, existing) => {
            if (err) {
                db.close();
                return next(err);
            }
            
            const completedAt = isCorrect || attempts >= 3 ? new Date().toISOString() : null;
            
            if (existing) {
                // Update existing progress
                db.run(
                    'UPDATE user_progress SET is_correct = ?, attempts = ?, completed_at = ? WHERE user_id = ? AND question_id = ?',
                    [isCorrect ? 1 : 0, attempts, completedAt, userId, questionId],
                    (updateErr) => {
                        db.close();
                        if (updateErr) return next(updateErr);
                        res.json({ success: true });
                    }
                );
            } else {
                // Insert new progress
                db.run(
                    'INSERT INTO user_progress (user_id, question_id, is_correct, attempts, completed_at) VALUES (?, ?, ?, ?, ?)',
                    [userId, questionId, isCorrect ? 1 : 0, attempts, completedAt],
                    (insertErr) => {
                        db.close();
                        if (insertErr) return next(insertErr);
                        res.json({ success: true });
                    }
                );
            }
        }
    );
});

module.exports = router;

