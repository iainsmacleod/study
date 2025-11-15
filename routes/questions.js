const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

// GET /api/questions - Get questions with optional filters
router.get('/', (req, res, next) => {
    const db = getDB();
    const { course, categories, count, random } = req.query;
    
    let query = `
        SELECT q.id, q.question_text, q.answer, q.normalized_answer, q.question_number,
               c.id as category_id, c.name as category_name, c.description as category_description,
               co.id as course_id, co.name as course_name
        FROM questions q
        JOIN categories c ON q.category_id = c.id
        JOIN courses co ON q.course_id = co.id
    `;
    
    const params = [];
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
    
    // Random order if requested
    if (random === 'true' || categories === 'random') {
        query += ' ORDER BY RANDOM()';
    } else {
        query += ' ORDER BY q.question_number';
    }
    
    // Limit count
    if (count && count !== 'all') {
        const limit = parseInt(count);
        if (!isNaN(limit) && limit > 0) {
            query += ` LIMIT ${limit}`;
        }
    }
    
    db.all(query, params, (err, rows) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        // Transform data to match frontend expectations
        const questions = rows.map(row => ({
            id: row.id,
            num: row.question_number,
            question: row.question_text,
            answer: row.answer,
            normalized: row.normalized_answer,
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
        db.close();
        
        if (err) {
            return next(err);
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        res.json({
            id: row.id,
            num: row.question_number,
            question: row.question_text,
            answer: row.answer,
            normalized: row.normalized_answer,
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

module.exports = router;

