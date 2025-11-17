const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

// GET /api/questions - Get questions with optional filters
router.get('/', (req, res, next) => {
    const db = getDB();
    const { course, categories, count, random } = req.query;
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const userId = isAuthenticated && req.user ? req.user.id : null;
    
    let query = `
        SELECT q.id, q.question_text, q.answer, q.normalized_answer, q.question_number,
               c.id as category_id, c.name as category_name, c.description as category_description,
               co.id as course_id, co.name as course_name`;
    
    // Add is_correct column only if authenticated
    if (userId) {
        query += `, up.is_correct`;
    }
    
    query += `
        FROM questions q
        JOIN categories c ON q.category_id = c.id
        JOIN courses co ON q.course_id = co.id
    `;
    
    // LEFT JOIN user_progress if authenticated
    if (userId) {
        query += ` LEFT JOIN user_progress up ON q.id = up.question_id AND up.user_id = ?`;
    }
    
    const params = [];
    if (userId) {
        params.push(userId);
    }
    
    const conditions = [];
    
    // Filter by course (required)
    if (course) {
        conditions.push(`co.name = ?`);
        params.push(course);
    }
    
    // Filter by categories
    if (categories && categories !== 'random') {
        const categoryList = Array.isArray(categories) ? categories : categories.split(',');
        const placeholders = categoryList.map(() => '?').join(',');
        conditions.push(`c.name IN (${placeholders})`);
        params.push(...categoryList);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Order by unanswered first (if authenticated), then by random/question_number
    if (userId) {
        // Prioritize unanswered: is_correct != 1 or is_correct IS NULL
        query += ' ORDER BY CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END';
        if (random === 'true' || categories === 'random') {
            query += ', RANDOM()';
        } else {
            query += ', q.question_number';
        }
    } else {
        // Guest users: no prioritization
        if (random === 'true' || categories === 'random') {
            query += ' ORDER BY RANDOM()';
        } else {
            query += ' ORDER BY q.question_number';
        }
    }
    
    // For count limits, we need to handle unanswered vs answered separately
    const requestedCount = count && count !== 'all' ? parseInt(count) : null;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        if (rows.length === 0) {
            db.close();
            return res.json([]);
        }
        
        // If authenticated, separate unanswered and answered questions
        let unansweredQuestions = [];
        let answeredQuestions = [];
        
        if (userId) {
            rows.forEach(row => {
                // Unanswered: is_correct != 1 or is_correct IS NULL
                if (row.is_correct !== 1) {
                    unansweredQuestions.push(row);
                } else {
                    answeredQuestions.push(row);
                }
            });
            
            // Check if all questions are answered
            if (unansweredQuestions.length === 0 && answeredQuestions.length > 0) {
                db.close();
                return res.json({ questions: [], allAnswered: true });
            }
            
            // If count is specified, prioritize unanswered, then fill with answered
            if (requestedCount && !isNaN(requestedCount) && requestedCount > 0) {
                const selected = [];
                // Take up to requestedCount from unanswered
                selected.push(...unansweredQuestions.slice(0, requestedCount));
                // Fill remaining slots with answered questions
                if (selected.length < requestedCount) {
                    const remaining = requestedCount - selected.length;
                    selected.push(...answeredQuestions.slice(0, remaining));
                }
                rows = selected;
            } else {
                // For "All", show unanswered first, then answered
                rows = [...unansweredQuestions, ...answeredQuestions];
            }
        }
        
        // Get alternative answers for all questions
        const questionIds = rows.map(r => r.id);
        const placeholders = questionIds.map(() => '?').join(',');
        const altQuery = `SELECT question_id, normalized_answer FROM question_alternative_answers WHERE question_id IN (${placeholders})`;
        
        db.all(altQuery, questionIds, (altErr, altRows) => {
            db.close();
            
            if (altErr) {
                return next(altErr);
            }
            
            // Build map of alternative answers
            const alternativeAnswersMap = {};
            altRows.forEach(alt => {
                if (!alternativeAnswersMap[alt.question_id]) {
                    alternativeAnswersMap[alt.question_id] = [];
                }
                alternativeAnswersMap[alt.question_id].push(alt.normalized_answer);
            });
            
            // Transform data to match frontend expectations
            const questions = rows.map(row => ({
                id: row.id,
                num: row.question_number,
                question: row.question_text,
                answer: row.answer,
                normalized: row.normalized_answer,
                alternativeAnswers: alternativeAnswersMap[row.id] || [],
                category: {
                    id: row.category_id,
                    name: row.category_name,
                    description: row.category_description
                },
                course: {
                    id: row.course_id,
                    name: row.course_name
                }
            }));
            
            res.json(questions);
        });
    });
});

// GET /api/questions/:id - Get single question
router.get('/:id', (req, res, next) => {
    const db = getDB();
    const questionId = parseInt(req.params.id);
    
    const query = `
        SELECT q.id, q.question_text, q.answer, q.normalized_answer, q.question_number,
               c.id as category_id, c.name as category_name, c.description as category_description,
               co.id as course_id, co.name as course_name
        FROM questions q
        JOIN categories c ON q.category_id = c.id
        JOIN courses co ON q.course_id = co.id
        WHERE q.id = ?
    `;
    
    db.get(query, [questionId], (err, row) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        if (!row) {
            db.close();
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Get alternative answers for this question
        db.all('SELECT normalized_answer FROM question_alternative_answers WHERE question_id = ?', [questionId], (altErr, altRows) => {
            db.close();
            
            if (altErr) {
                return next(altErr);
            }
            
            const alternativeAnswers = altRows.map(alt => alt.normalized_answer);
            
            res.json({
                id: row.id,
                num: row.question_number,
                question: row.question_text,
                answer: row.answer,
                normalized: row.normalized_answer,
                alternativeAnswers: alternativeAnswers,
                category: {
                    id: row.category_id,
                    name: row.category_name,
                    description: row.category_description
                },
                course: {
                    id: row.course_id,
                    name: row.course_name
                }
            });
        });
    });
});

module.exports = router;

