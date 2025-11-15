const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

// GET /api/categories - Get all categories (optionally filtered by course)
router.get('/', (req, res, next) => {
    const db = getDB();
    const { course } = req.query;
    
    let query = 'SELECT DISTINCT c.id, c.name, c.description FROM categories c';
    const params = [];
    
    if (course) {
        query += ' JOIN questions q ON c.id = q.category_id JOIN courses co ON q.course_id = co.id WHERE co.name = ?';
        params.push(course);
    }
    
    query += ' ORDER BY c.id';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        db.close();
        res.json(rows);
    });
});

// GET /api/categories/:id - Get single category
router.get('/:id', (req, res, next) => {
    const db = getDB();
    const categoryId = parseInt(req.params.id);
    
    db.get('SELECT id, name, description FROM categories WHERE id = ?', [categoryId], (err, row) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json(row);
    });
});

module.exports = router;

