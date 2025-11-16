const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

// POST /api/reports - Submit a report about a question
router.post('/', (req, res, next) => {
    const db = getDB();
    const { questionId, issueType, description } = req.body;
    const userId = req.user ? req.user.id : null; // Optional - works for both logged-in and guest users
    
    // Validate input
    if (!questionId || !issueType || !description) {
        db.close();
        return res.status(400).json({ error: 'Missing required fields: questionId, issueType, description' });
    }
    
    // Validate issue type
    const validIssueTypes = ['wrong_answer', 'answer_should_be_accepted', 'other'];
    if (!validIssueTypes.includes(issueType)) {
        db.close();
        return res.status(400).json({ error: 'Invalid issue type. Must be one of: wrong_answer, answer_should_be_accepted, other' });
    }
    
    // Insert report
    db.run(
        'INSERT INTO question_reports (question_id, user_id, issue_type, description) VALUES (?, ?, ?, ?)',
        [questionId, userId, issueType, description],
        function(err) {
            db.close();
            
            if (err) {
                return next(err);
            }
            
            res.json({ success: true, reportId: this.lastID });
        }
    );
});

module.exports = router;

