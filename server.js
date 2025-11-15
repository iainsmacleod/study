require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { getDB, initSchema, needsSeeding } = require('./database');
const { seedDatabase } = require('./init-db');
const { passport } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
app.use(cors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site in production
        domain: process.env.COOKIE_DOMAIN || undefined, // Set if needed for subdomain sharing
        path: '/' // Ensure cookie is available for all paths
    },
    name: 'study.sid' // Custom session name
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Initialize database
async function initializeDatabase() {
    const db = getDB();
    try {
        await initSchema(db);
        const needsSeed = await needsSeeding(db);
        
        // Close connection properly
        await new Promise((resolve) => {
            db.close((err) => {
                if (err) console.error('Error closing database:', err);
                resolve();
            });
        });
        
        if (needsSeed) {
            console.log('Database needs seeding, running seed script...');
            await seedDatabase();
        } else {
            console.log('Database already initialized');
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        db.close((err) => {
            if (err) console.error('Error closing database:', err);
        });
        process.exit(1);
    }
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/progress', require('./routes/progress'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Initialize database and start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;

