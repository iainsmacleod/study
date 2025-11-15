const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { isAuthenticated } = require('../auth');

// Admin password from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Log admin password status (without revealing the actual password)
console.log('[ADMIN] Admin password configured:', ADMIN_PASSWORD ? 'Yes' : 'No');
console.log('[ADMIN] Admin password length:', ADMIN_PASSWORD ? ADMIN_PASSWORD.length : 0);

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    if (req.session.isAdmin === true) {
        return next();
    }
    res.status(403).json({ error: 'Admin access required' });
}

// POST /api/admin/login - Admin login
router.post('/login', (req, res) => {
    const { password } = req.body;
    
    // Trim whitespace from password input
    const trimmedPassword = password ? password.trim() : '';
    const trimmedAdminPassword = ADMIN_PASSWORD ? ADMIN_PASSWORD.trim() : '';
    
    // Debug logging (don't log actual passwords in production)
    console.log('[ADMIN] Login attempt - provided password length:', trimmedPassword.length);
    console.log('[ADMIN] Expected password length:', trimmedAdminPassword.length);
    console.log('[ADMIN] Passwords match:', trimmedPassword === trimmedAdminPassword);
    
    if (trimmedPassword === trimmedAdminPassword) {
        req.session.isAdmin = true;
        console.log('[ADMIN] Login successful, setting isAdmin flag');
        console.log('[ADMIN] Session ID:', req.sessionID);
        
        // Mark session as modified so it gets saved
        req.session.save((err) => {
            if (err) {
                console.error('[ADMIN] Error saving session:', err);
                return res.status(500).json({ success: false, error: 'Failed to save session' });
            }
            console.log('[ADMIN] Session saved with isAdmin flag');
            res.json({ success: true });
        });
    } else {
        console.log('[ADMIN] Login failed - invalid password');
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// GET /api/admin/status - Check admin status
router.get('/status', (req, res) => {
    console.log('[ADMIN] Status check - isAdmin:', req.session.isAdmin);
    console.log('[ADMIN] Status check - session ID:', req.sessionID);
    res.json({ isAdmin: req.session.isAdmin === true });
});

// GET /api/admin/users - List all users (admin only)
router.get('/users', isAdmin, (req, res, next) => {
    const db = getDB();
    
    db.all('SELECT id, email, provider, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        res.json(rows);
    });
});

// GET /api/admin/users/:id/stats - Get stats for specific user (admin only)
router.get('/users/:id/stats', isAdmin, (req, res, next) => {
    const db = getDB();
    const userId = parseInt(req.params.id);
    
    // Get overall stats
    const overallQuery = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM user_progress
        WHERE user_id = ? AND completed_at IS NOT NULL
    `;
    
    // Get stats by course
    const courseQuery = `
        SELECT 
            c.id as courseId,
            c.name as courseName,
            COUNT(*) as total,
            SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM user_progress up
        JOIN questions q ON up.question_id = q.id
        JOIN courses c ON q.course_id = c.id
        WHERE up.user_id = ? AND up.completed_at IS NOT NULL
        GROUP BY c.id, c.name
        ORDER BY c.name
    `;
    
    // Get stats by category
    const categoryQuery = `
        SELECT 
            cat.id as categoryId,
            cat.name as categoryName,
            COUNT(*) as total,
            SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM user_progress up
        JOIN questions q ON up.question_id = q.id
        JOIN categories cat ON q.category_id = cat.id
        WHERE up.user_id = ? AND up.completed_at IS NOT NULL
        GROUP BY cat.id, cat.name
        ORDER BY cat.name
    `;
    
    // Execute all queries
    db.get(overallQuery, [userId], (err, overallRow) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        db.all(courseQuery, [userId], (err, courseRows) => {
            if (err) {
                db.close();
                return next(err);
            }
            
            db.all(categoryQuery, [userId], (err, categoryRows) => {
                db.close();
                
                if (err) {
                    return next(err);
                }
                
                // Calculate overall percentage
                const total = overallRow?.total || 0;
                const correct = overallRow?.correct || 0;
                const percentage = total > 0 ? (correct / total) * 100 : 0;
                
                // Format course stats
                const byCourse = courseRows.map(row => ({
                    courseId: row.courseId,
                    courseName: row.courseName,
                    correct: row.correct,
                    total: row.total,
                    percentage: row.total > 0 ? (row.correct / row.total) * 100 : 0
                }));
                
                // Format category stats
                const byCategory = categoryRows.map(row => ({
                    categoryId: row.categoryId,
                    categoryName: row.categoryName,
                    correct: row.correct,
                    total: row.total,
                    percentage: row.total > 0 ? (row.correct / row.total) * 100 : 0
                }));
                
                res.json({
                    overall: {
                        correct,
                        total,
                        percentage: Math.round(percentage * 100) / 100
                    },
                    byCourse,
                    byCategory
                });
            });
        });
    });
});

// DELETE /api/admin/users/:id - Delete user and all associated progress (admin only)
router.delete('/users/:id', isAdmin, (req, res, next) => {
    const db = getDB();
    const userId = parseInt(req.params.id);
    
    // First delete all user progress
    db.run('DELETE FROM user_progress WHERE user_id = ?', [userId], (err) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        // Then delete the user
        db.run('DELETE FROM users WHERE id = ?', [userId], (deleteErr) => {
            db.close();
            
            if (deleteErr) {
                return next(deleteErr);
            }
            
            res.json({ success: true });
        });
    });
});

module.exports = router;

