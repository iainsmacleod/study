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

// Trust proxy - important for cookies behind nginx/proxy
app.set('trust proxy', 1);

// Middleware
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
console.log('Frontend URL configured as:', frontendUrl);

app.use(cors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
// Determine cookie settings based on environment
const isProduction = process.env.NODE_ENV === 'production';
console.log('NODE_ENV:', process.env.NODE_ENV, 'isProduction:', isProduction);
let cookieDomain = undefined;

// For same-origin requests, don't set the domain
// Only set domain if you need to share cookies across subdomains
// For OAuth with sameSite: 'none', we typically don't set domain for same-origin
// Setting domain can cause browsers to not send the cookie back
if (isProduction && frontendUrl && process.env.COOKIE_DOMAIN) {
    // Only set domain if explicitly configured
    cookieDomain = process.env.COOKIE_DOMAIN;
    console.log('Cookie domain set to:', cookieDomain);
} else {
    console.log('Cookie domain not set (using default - same-origin only)');
}

// Build cookie config - only include domain if explicitly set
// Note: sameSite 'lax' works for same-origin and top-level navigations
// 'none' is only needed for true cross-site requests (like iframes)
const cookieConfig = {
    secure: isProduction, // Requires HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // 'lax' works for OAuth redirects and same-origin requests
    path: '/' // Ensure cookie is available for all paths
};

// Only set domain if explicitly configured (for subdomain sharing)
// Not setting domain allows cookie to work for same-origin requests
if (cookieDomain) {
    cookieConfig.domain = cookieDomain;
    console.log('Cookie domain will be set to:', cookieDomain);
} else {
    console.log('Cookie domain will NOT be set (same-origin only)');
}

// Create session store - use it directly, don't wrap it
// Wrapping breaks express-session's internal cookie processing
const sessionStore = new session.MemoryStore();

// Session middleware
// express-session automatically signs cookies and sets them on response
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: true, // Save session even if not modified (needed for OAuth flow)
    saveUninitialized: true, // Save uninitialized sessions (needed for OAuth)
    cookie: cookieConfig,
    name: 'study.sid',
    rolling: false // Don't reset expiration on every response
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Session recovery middleware - fixes cases where express-session fails to load valid sessions
// This MUST run AFTER express-session middleware
app.use((req, res, next) => {
    const cookies = req.headers.cookie || '';
    const sessionCookieMatch = cookies.match(/study\.sid=([^;]+)/);
    let cookieSessionId = sessionCookieMatch ? sessionCookieMatch[1] : 'none';
    
    // Decode URL-encoded cookie value
    if (cookieSessionId !== 'none') {
        try {
            cookieSessionId = decodeURIComponent(cookieSessionId);
        } catch (e) {
            // If decoding fails, use original value
        }
    }
    
    // If we have a signed cookie, try to unsign it
    if (cookieSessionId !== 'none' && cookieSessionId.includes('.')) {
        const cookieSignature = require('cookie-signature');
        const secret = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
        const unsigned = cookieSignature.unsign(cookieSessionId, secret);
        
        if (unsigned) {
            // Check if express-session loaded the session correctly
            const hasPassport = req.session.passport && req.session.passport.user;
            const hasAdmin = req.session.isAdmin === true;
            const sessionIdMatches = (req.sessionID === unsigned);
            const isNewSession = req.session.isNew === true || req.session.isNew === undefined;
            
            // Debug logging for admin sessions
            if (req.path && req.path.includes('/admin')) {
                console.log('[Session Recovery] Admin request - session ID:', req.sessionID);
                console.log('[Session Recovery] Cookie session ID:', unsigned);
                console.log('[Session Recovery] Session ID matches:', sessionIdMatches);
                console.log('[Session Recovery] Is new session:', isNewSession);
                console.log('[Session Recovery] Has passport:', hasPassport);
                console.log('[Session Recovery] Has admin:', hasAdmin);
                console.log('[Session Recovery] Current session keys:', Object.keys(req.session || {}));
            }
            
            // Only try to recover if:
            // 1. Session ID doesn't match (cookie doesn't match current session), OR
            // 2. Session is new AND we don't have the data we need (passport or admin)
            // IMPORTANT: For admin requests, if we don't have isAdmin, ALWAYS try recovery
            // This is critical because express-session might load a session but not restore isAdmin
            // even if the session ID matches and the session isn't "new"
            const isAdminRequest = req.path && req.path.includes('/admin');
            
            // For admin requests, always try recovery if isAdmin is missing
            // This handles cases where express-session loaded a session but didn't restore isAdmin
            // even when sessionIdMatches is true (which would normally skip recovery)
            const needsRecovery = !sessionIdMatches || 
                                  (isNewSession && !hasPassport && !hasAdmin) || 
                                  (isAdminRequest && !hasAdmin);
            
            // CRITICAL: For admin requests, if isAdmin is missing, ALWAYS try to recover from store
            // Even if session ID matches and session isn't new, express-session might not have loaded isAdmin
            // This is especially important when user is logged in with Google (has passport but missing isAdmin)
            if (isAdminRequest && !hasAdmin) {
                console.log('[Session Recovery] Admin request without isAdmin - forcing recovery check');
                // Force recovery by setting needsRecovery to true
                const forceRecovery = true;
                
                sessionStore.get(unsigned, (err, session) => {
                    if (err) {
                        console.error(`[Session Recovery] Error loading session for admin:`, err);
                        return next();
                    }
                    
                    if (session && session.isAdmin === true) {
                        console.log('[Session Recovery] Found admin session in store - restoring isAdmin flag');
                        // Preserve current passport if it exists (from Google login)
                        const currentPassport = req.session.passport;
                        
                        // Restore isAdmin flag
                        req.session.isAdmin = true;
                        
                        // Preserve passport - prefer current (from req.session) over stored
                        // This ensures Google login is preserved when adding admin
                        if (currentPassport) {
                            req.session.passport = currentPassport;
                            console.log('[Session Recovery] Preserving current passport data');
                        } else if (session.passport) {
                            req.session.passport = session.passport;
                            console.log('[Session Recovery] Restoring passport from stored session');
                        }
                        
                        // Mark session as modified so it's saved
                        req.session.touch();
                        
                        // Trigger Passport deserialization if passport exists
                        if (req.session.passport && req.session.passport.user) {
                            const passport = require('passport');
                            passport.deserializeUser(req.session.passport.user, (err, user) => {
                                if (err) {
                                    console.error(`[Session Recovery] Error deserializing user:`, err);
                                } else if (user) {
                                    req.user = user;
                                }
                                next();
                            });
                        } else {
                            next();
                        }
                    } else {
                        console.log('[Session Recovery] Admin session not found in store or isAdmin not set');
                        next();
                    }
                });
                return; // Don't continue with normal recovery flow
            }
            
            if (needsRecovery) {
                sessionStore.get(unsigned, (err, session) => {
                    if (err) {
                        console.error(`[Session Recovery] Error loading session:`, err);
                        return next();
                    }
                    
                    if (session) {
                        // Force the session ID to match the cookie
                        req.sessionID = unsigned;
                        
                        // CRITICAL: Save flags BEFORE merging (Object.assign will overwrite them)
                        const storedIsAdmin = session.isAdmin;
                        const storedPassport = session.passport;
                        
                        // Preserve current session flags if they exist (in case stored session is missing them)
                        const currentIsAdmin = req.session.isAdmin;
                        const currentPassport = req.session.passport;
                        
                        // Merge stored session data into req.session, preserving methods
                        Object.assign(req.session, session);
                        req.session.isNew = false;
                        
                        // Ensure cookie is preserved
                        if (session.cookie) {
                            Object.assign(req.session.cookie, session.cookie);
                        }
                        
                        // CRITICAL: Explicitly restore flags - prefer stored values, but keep current if stored is missing
                        // This ensures both passport and isAdmin can coexist
                        if (storedIsAdmin !== undefined) {
                            req.session.isAdmin = storedIsAdmin;
                            console.log('[Session Recovery] Restored isAdmin flag:', storedIsAdmin);
                        } else if (currentIsAdmin !== undefined) {
                            req.session.isAdmin = currentIsAdmin;
                            console.log('[Session Recovery] Preserved current isAdmin flag:', currentIsAdmin);
                        }
                        
                        // Ensure passport is preserved - prefer stored, but keep current if stored is missing
                        if (storedPassport) {
                            req.session.passport = storedPassport;
                            console.log('[Session Recovery] Restored passport data');
                        } else if (currentPassport) {
                            req.session.passport = currentPassport;
                            console.log('[Session Recovery] Preserved current passport data');
                        }
                        
                        // CRITICAL: Trigger Passport to deserialize the user after loading the session
                        if (req.session.passport && req.session.passport.user) {
                            const passport = require('passport');
                            passport.deserializeUser(req.session.passport.user, (err, user) => {
                                if (err) {
                                    console.error(`[Session Recovery] Error deserializing user:`, err);
                                } else if (user) {
                                    req.user = user;
                                }
                                next();
                            });
                        } else {
                            next();
                        }
                    } else {
                        if (req.path && req.path.includes('/admin')) {
                            console.log('[Session Recovery] Session not found in store for admin request');
                        }
                        next();
                    }
                });
            } else {
                // Session is already loaded correctly, just continue
                if (req.path && req.path.includes('/admin')) {
                    console.log('[Session Recovery] Session already loaded correctly, no recovery needed');
                }
                next();
            }
        } else {
            next();
        }
    } else {
        next();
    }
});


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
app.use('/api/stats', require('./routes/stats'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));

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

// Export both app and sessionStore
module.exports = app;
module.exports.sessionStore = sessionStore;

