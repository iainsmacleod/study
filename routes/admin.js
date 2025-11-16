const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { isAuthenticated } = require('../auth');

// Admin password from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Log admin password status on startup (without revealing the actual password)
if (ADMIN_PASSWORD && ADMIN_PASSWORD !== 'admin') {
    console.log('[ADMIN] Admin password is configured (length: ' + ADMIN_PASSWORD.length + ')');
} else {
    console.warn('[ADMIN] Using default admin password. Set ADMIN_PASSWORD environment variable for production.');
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    // Debug logging
    console.log('[ADMIN] isAdmin check - session ID:', req.sessionID);
    console.log('[ADMIN] isAdmin check - isAdmin value:', req.session.isAdmin);
    console.log('[ADMIN] isAdmin check - session keys:', Object.keys(req.session || {}));
    
    if (req.session.isAdmin === true) {
        return next();
    }
    console.log('[ADMIN] Access denied - isAdmin is not true');
    res.status(403).json({ error: 'Admin access required' });
}

// POST /api/admin/login - Admin login
router.post('/login', (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required' });
    }
    
    const trimmedPassword = String(password).trim();
    const trimmedAdminPassword = String(ADMIN_PASSWORD || '').trim();
    
    // Debug logging (without revealing actual passwords)
    console.log('[ADMIN] Login attempt - provided password length:', trimmedPassword.length);
    console.log('[ADMIN] Expected password length:', trimmedAdminPassword.length);
    console.log('[ADMIN] Passwords match:', trimmedPassword === trimmedAdminPassword);
    
    if (trimmedPassword === trimmedAdminPassword && trimmedAdminPassword.length > 0) {
        // Set isAdmin flag
        req.session.isAdmin = true;
        
        // Log session state before save
        console.log('[ADMIN] Before save - session ID:', req.sessionID);
        console.log('[ADMIN] Before save - isAdmin:', req.session.isAdmin);
        console.log('[ADMIN] Before save - session keys:', Object.keys(req.session));
        
        // Force session to be saved (mark as modified)
        req.session.touch();
        
        req.session.save((err) => {
            if (err) {
                console.error('[ADMIN] Error saving session:', err);
                return res.status(500).json({ success: false, error: 'Failed to save session' });
            }
            
            console.log('[ADMIN] Login successful, session saved - session ID:', req.sessionID);
            console.log('[ADMIN] After save - isAdmin:', req.session.isAdmin);
            console.log('[ADMIN] After save - session keys:', Object.keys(req.session));
            
            // Manually set the cookie header to ensure it's sent correctly
            // This is similar to what we do in the OAuth callback
            const cookieSignature = require('cookie-signature');
            const secret = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
            const signedValue = cookieSignature.sign(req.sessionID, secret);
            
            const cookieConfig = req.session.cookie;
            const isProduction = process.env.NODE_ENV === 'production';
            
            // Build cookie string manually - DO NOT URL-encode the signed value
            let cookieString = `study.sid=${signedValue}; Path=${cookieConfig.path || '/'}`;
            
            if (cookieConfig.maxAge) {
                const expires = new Date(Date.now() + cookieConfig.maxAge);
                cookieString += `; Expires=${expires.toUTCString()}`;
                cookieString += `; Max-Age=${Math.floor(cookieConfig.maxAge / 1000)}`;
            }
            
            if (cookieConfig.httpOnly !== false) {
                cookieString += `; HttpOnly`;
            }
            
            if (cookieConfig.secure || isProduction) {
                cookieString += `; Secure`;
            }
            
            if (cookieConfig.sameSite) {
                cookieString += `; SameSite=${cookieConfig.sameSite}`;
            }
            
            // Set the cookie header manually
            res.setHeader('Set-Cookie', cookieString);
            
            console.log('[ADMIN] Cookie set manually:', cookieString.substring(0, 50) + '...');
            
            res.json({ success: true });
        });
    } else {
        console.log('[ADMIN] Login failed - password mismatch');
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// GET /api/admin/status - Check admin status
router.get('/status', (req, res) => {
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

// POST /api/admin/users/:id/reset - Reset user's active progress (keeps history)
router.post('/users/:id/reset', isAdmin, (req, res, next) => {
    const db = getDB();
    const userId = parseInt(req.params.id);
    
    // Delete only from user_progress (active progress), keep user_progress_history
    db.run('DELETE FROM user_progress WHERE user_id = ?', [userId], (err) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        res.json({ success: true });
    });
});

// DELETE /api/admin/users/:id - Delete user and all associated data (admin only)
router.delete('/users/:id', isAdmin, (req, res, next) => {
    const db = getDB();
    const userId = parseInt(req.params.id);
    
    // Delete from user_progress_history first
    db.run('DELETE FROM user_progress_history WHERE user_id = ?', [userId], (err) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        // Then delete from user_progress
        db.run('DELETE FROM user_progress WHERE user_id = ?', [userId], (err) => {
            if (err) {
                db.close();
                return next(err);
            }
            
            // Finally delete the user
            db.run('DELETE FROM users WHERE id = ?', [userId], (deleteErr) => {
                db.close();
                
                if (deleteErr) {
                    return next(deleteErr);
                }
                
                res.json({ success: true });
            });
        });
    });
});

// GET /api/admin/reports - List all reports (admin only)
router.get('/reports', isAdmin, (req, res, next) => {
    const db = getDB();
    
    const query = `
        SELECT 
            qr.id,
            qr.question_id,
            qr.user_id,
            qr.issue_type,
            qr.description,
            qr.reported_at,
            qr.acknowledged_at,
            qr.acknowledged_by,
            q.question_text,
            q.answer,
            u.email as reporter_email,
            ack.email as acknowledged_by_email
        FROM question_reports qr
        JOIN questions q ON qr.question_id = q.id
        LEFT JOIN users u ON qr.user_id = u.id
        LEFT JOIN users ack ON qr.acknowledged_by = ack.id
        WHERE qr.acknowledged_at IS NULL
        ORDER BY qr.reported_at DESC
    `;
    
    db.all(query, (err, rows) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        res.json(rows);
    });
});

// DELETE /api/admin/reports/:id - Acknowledge/Delete a report (admin only)
router.delete('/reports/:id', isAdmin, (req, res, next) => {
    const db = getDB();
    const reportId = parseInt(req.params.id);
    const adminUserId = req.user ? req.user.id : null;
    
    db.run(
        'UPDATE question_reports SET acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = ? WHERE id = ?',
        [adminUserId, reportId],
        function(err) {
            db.close();
            
            if (err) {
                return next(err);
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }
            
            res.json({ success: true });
        }
    );
});

// GET /api/admin/questions/:id - Get question for editing (admin only)
router.get('/questions/:id', isAdmin, (req, res, next) => {
    const db = getDB();
    const questionId = parseInt(req.params.id);
    
    // Get question details
    const questionQuery = `
        SELECT 
            q.id,
            q.question_text,
            q.answer,
            q.normalized_answer,
            q.category_id,
            q.course_id,
            q.question_number
        FROM questions q
        WHERE q.id = ?
    `;
    
    db.get(questionQuery, [questionId], (err, question) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        if (!question) {
            db.close();
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Get alternative answers
        db.all(
            'SELECT id, normalized_answer FROM question_alternative_answers WHERE question_id = ?',
            [questionId],
            (altErr, alternatives) => {
                db.close();
                
                if (altErr) {
                    return next(altErr);
                }
                
                res.json({
                    ...question,
                    alternativeAnswers: alternatives
                });
            }
        );
    });
});

// PUT /api/admin/questions/:id - Update question (admin only)
router.put('/questions/:id', isAdmin, (req, res, next) => {
    const db = getDB();
    const questionId = parseInt(req.params.id);
    const { questionText, answer, normalizedAnswer, categoryId, courseId, alternativeAnswers } = req.body;
    
    // Validate required fields
    if (!questionText || !answer || !normalizedAnswer || !categoryId || !courseId) {
        db.close();
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Update question
    db.run(
        'UPDATE questions SET question_text = ?, answer = ?, normalized_answer = ?, category_id = ?, course_id = ? WHERE id = ?',
        [questionText, answer, normalizedAnswer, categoryId, courseId, questionId],
        function(err) {
            if (err) {
                db.close();
                return next(err);
            }
            
            if (this.changes === 0) {
                db.close();
                return res.status(404).json({ error: 'Question not found' });
            }
            
            // Delete existing alternative answers
            db.run('DELETE FROM question_alternative_answers WHERE question_id = ?', [questionId], (delErr) => {
                if (delErr) {
                    db.close();
                    return next(delErr);
                }
                
                // Insert new alternative answers if provided
                if (alternativeAnswers && Array.isArray(alternativeAnswers) && alternativeAnswers.length > 0) {
                    // Insert alternative answers sequentially
                    let index = 0;
                    
                    function insertNext() {
                        if (index >= alternativeAnswers.length) {
                            db.close();
                            return res.json({ success: true });
                        }
                        
                        const altAnswer = alternativeAnswers[index];
                        db.run(
                            'INSERT INTO question_alternative_answers (question_id, normalized_answer) VALUES (?, ?)',
                            [questionId, altAnswer.normalizedAnswer],
                            (insertErr) => {
                                if (insertErr) {
                                    db.close();
                                    return next(insertErr);
                                }
                                
                                index++;
                                insertNext();
                            }
                        );
                    }
                    
                    insertNext();
                } else {
                    db.close();
                    res.json({ success: true });
                }
            });
        }
    );
});

module.exports = router;

