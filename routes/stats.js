const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { isAuthenticated } = require('../auth');

// All stats routes require authentication
router.use(isAuthenticated);

// GET /api/stats - Get user statistics
router.get('/', (req, res, next) => {
    const db = getDB();
    const userId = req.user.id;
    
    // Get overall stats
    const overallQuery = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM user_progress
        WHERE user_id = ? AND completed_at IS NOT NULL
    `;
    
    // Get stats by course (with completion percentages)
    const courseQuery = `
        SELECT 
            c.id as courseId,
            c.name as courseName,
            COUNT(DISTINCT up.question_id) as completed,
            COUNT(DISTINCT q.id) as totalQuestions,
            SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM courses c
        LEFT JOIN questions q ON c.id = q.course_id
        LEFT JOIN user_progress up ON q.id = up.question_id AND up.user_id = ? AND up.completed_at IS NOT NULL
        GROUP BY c.id, c.name
        HAVING totalQuestions > 0
        ORDER BY c.name
    `;
    
    // Get stats by category (with completion percentages)
    const categoryQuery = `
        SELECT 
            cat.id as categoryId,
            cat.name as categoryName,
            COUNT(DISTINCT up.question_id) as completed,
            COUNT(DISTINCT q.id) as totalQuestions,
            SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM categories cat
        LEFT JOIN questions q ON cat.id = q.category_id
        LEFT JOIN user_progress up ON q.id = up.question_id AND up.user_id = ? AND up.completed_at IS NOT NULL
        GROUP BY cat.id, cat.name
        HAVING totalQuestions > 0
        ORDER BY cat.name
    `;
    
    // Get multi-attempt questions
    const multiAttemptQuestionsQuery = `
        SELECT 
            up.question_id as questionId,
            up.attempts,
            up.is_correct
        FROM user_progress up
        WHERE up.user_id = ? AND up.attempts > 1 AND up.completed_at IS NOT NULL
        ORDER BY up.attempts DESC
    `;
    
    // Get multi-attempt categories (average attempts per category)
    const multiAttemptCategoriesQuery = `
        SELECT 
            cat.id as categoryId,
            cat.name as categoryName,
            AVG(up.attempts) as avgAttempts,
            COUNT(*) as questionCount
        FROM user_progress up
        JOIN questions q ON up.question_id = q.id
        JOIN categories cat ON q.category_id = cat.id
        WHERE up.user_id = ? AND up.attempts > 1 AND up.completed_at IS NOT NULL
        GROUP BY cat.id, cat.name
        HAVING COUNT(*) > 0
        ORDER BY avgAttempts DESC
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
                if (err) {
                    db.close();
                    return next(err);
                }
                
                db.all(multiAttemptQuestionsQuery, [userId], (err, multiAttemptQuestions) => {
                    if (err) {
                        db.close();
                        return next(err);
                    }
                    
                    db.all(multiAttemptCategoriesQuery, [userId], (err, multiAttemptCategories) => {
                        db.close();
                        
                        if (err) {
                            return next(err);
                        }
                        
                        // Calculate overall percentage
                        const total = overallRow?.total || 0;
                        const correct = overallRow?.correct || 0;
                        const percentage = total > 0 ? (correct / total) * 100 : 0;
                        
                        // Format course stats
                        const byCourse = courseRows.map(row => {
                            const completed = row.completed || 0;
                            const totalQuestions = row.totalQuestions || 0;
                            const correct = row.correct || 0;
                            const completionPercent = totalQuestions > 0 ? (completed / totalQuestions) * 100 : 0;
                            const accuracyPercent = completed > 0 ? (correct / completed) * 100 : 0;
                            
                            return {
                                courseId: row.courseId,
                                courseName: row.courseName,
                                completed: completed,
                                totalQuestions: totalQuestions,
                                correct: correct,
                                completionPercentage: Math.round(completionPercent * 100) / 100,
                                accuracyPercentage: Math.round(accuracyPercent * 100) / 100
                            };
                        });
                        
                        // Format category stats
                        const byCategory = categoryRows.map(row => {
                            const completed = row.completed || 0;
                            const totalQuestions = row.totalQuestions || 0;
                            const correct = row.correct || 0;
                            const completionPercent = totalQuestions > 0 ? (completed / totalQuestions) * 100 : 0;
                            const accuracyPercent = completed > 0 ? (correct / completed) * 100 : 0;
                            
                            return {
                                categoryId: row.categoryId,
                                categoryName: row.categoryName,
                                completed: completed,
                                totalQuestions: totalQuestions,
                                correct: correct,
                                completionPercentage: Math.round(completionPercent * 100) / 100,
                                accuracyPercentage: Math.round(accuracyPercent * 100) / 100
                            };
                        });
                        
                        // Format multi-attempt questions
                        const multiAttemptQuestionsFormatted = multiAttemptQuestions.map(row => ({
                            questionId: row.questionId,
                            attempts: row.attempts,
                            isCorrect: row.is_correct === 1
                        }));
                        
                        // Format multi-attempt categories
                        const multiAttemptCategoriesFormatted = multiAttemptCategories.map(row => ({
                            categoryId: row.categoryId,
                            categoryName: row.categoryName,
                            avgAttempts: Math.round(row.avgAttempts * 100) / 100,
                            questionCount: row.questionCount
                        }));
                        
                        res.json({
                            overall: {
                                correct,
                                total,
                                percentage: Math.round(percentage * 100) / 100
                            },
                            byCourse,
                            byCategory,
                            multiAttempt: {
                                questions: multiAttemptQuestionsFormatted,
                                categories: multiAttemptCategoriesFormatted
                            }
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;

