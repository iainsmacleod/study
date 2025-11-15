const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

// GET /api/courses - Get all courses
router.get('/', (req, res, next) => {
    const db = getDB();
    
    db.all('SELECT id, name FROM courses ORDER BY name', (err, rows) => {
        if (err) {
            db.close();
            return next(err);
        }
        
        db.close();
        res.json(rows);
    });
});

// GET /api/courses/:id - Get single course
router.get('/:id', (req, res, next) => {
    const db = getDB();
    const courseId = parseInt(req.params.id);
    
    db.get('SELECT id, name FROM courses WHERE id = ?', [courseId], (err, row) => {
        db.close();
        
        if (err) {
            return next(err);
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        res.json(row);
    });
});

module.exports = router;

