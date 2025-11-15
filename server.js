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

// Debug middleware to log session and cookie info and fix session loading
// This MUST run AFTER express-session middleware
app.use((req, res, next) => {
    // Log cookie parsing
    const cookies = req.headers.cookie || '';
    const sessionCookieMatch = cookies.match(/study\.sid=([^;]+)/);
    let cookieSessionId = sessionCookieMatch ? sessionCookieMatch[1] : 'none';
    
    // Decode URL-encoded cookie value (browsers may encode + as %2B or space as +)
    if (cookieSessionId !== 'none') {
        try {
            cookieSessionId = decodeURIComponent(cookieSessionId);
        } catch (e) {
            // If decoding fails, use original value
            console.log(`[Request ${req.path}] Cookie decode failed, using original`);
        }
    }
    
    console.log(`[Request ${req.path}] Cookie session ID:`, cookieSessionId);
    console.log(`[Request ${req.path}] Express session ID:`, req.sessionID);
    console.log(`[Request ${req.path}] Session is new:`, req.session.isNew);
    console.log(`[Request ${req.path}] Session passport:`, req.session.passport);
    
    // If we have a signed cookie, try to unsign it
    if (cookieSessionId !== 'none' && cookieSessionId.includes('.')) {
        const cookieSignature = require('cookie-signature');
        const secret = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
        const unsigned = cookieSignature.unsign(cookieSessionId, secret);
        
        if (unsigned) {
            console.log(`[Request ${req.path}] Cookie unsigned successfully: ${unsigned}`);
            
            // Check if express-session loaded the session correctly
            const hasPassport = req.session.passport && req.session.passport.user;
            const sessionIdMatches = (req.sessionID === unsigned);
            const isNewSession = req.session.isNew === true || req.session.isNew === undefined;
            
            console.log(`[Request ${req.path}] Session check - ID matches: ${sessionIdMatches}, isNew: ${req.session.isNew}, hasPassport: ${hasPassport}`);
            
            // If session ID doesn't match OR session is new/undefined OR no passport data, try to load from store
            if (!sessionIdMatches || (isNewSession && !hasPassport)) {
                console.log(`[Request ${req.path}] *** SESSION MISMATCH DETECTED *** Cookie: ${unsigned}, Express: ${req.sessionID}, isNew: ${req.session.isNew}, hasPassport: ${hasPassport}. Checking store...`);
                
                sessionStore.get(unsigned, (err, session) => {
                    if (err) {
                        console.error(`[Request ${req.path}] Error loading session from store:`, err);
                        return next();
                    }
                    
                    if (session) {
                        console.log(`[Request ${req.path}] *** SESSION FOUND IN STORE! *** Loading it...`);
                        console.log(`[Request ${req.path}] Stored session passport:`, session.passport);
                        
                        // Force the session ID to match the cookie
                        req.sessionID = unsigned;
                        
                        // Merge stored session data into req.session, preserving methods
                        Object.assign(req.session, session);
                        req.session.isNew = false;
                        
                        // Ensure cookie is preserved
                        if (session.cookie) {
                            Object.assign(req.session.cookie, session.cookie);
                        }
                        
                        console.log(`[Request ${req.path}] *** SESSION LOADED! *** New session ID: ${req.sessionID}, passport:`, req.session.passport);
                        
                        // CRITICAL: Trigger Passport to deserialize the user after loading the session
                        // Passport middleware already ran, so we need to manually trigger deserialization
                        if (req.session.passport && req.session.passport.user) {
                            const passport = require('passport');
                            passport.deserializeUser(req.session.passport.user, (err, user) => {
                                if (err) {
                                    console.error(`[Request ${req.path}] Error deserializing user after session recovery:`, err);
                                } else if (user) {
                                    // Manually set req.user since Passport middleware already ran
                                    req.user = user;
                                    console.log(`[Request ${req.path}] *** USER DESERIALIZED! *** User:`, user);
                                } else {
                                    console.warn(`[Request ${req.path}] User not found during deserialization:`, req.session.passport.user);
                                }
                                next();
                            });
                        } else {
                            next();
                        }
                    } else {
                        console.log(`[Request ${req.path}] *** SESSION NOT FOUND IN STORE *** Session ID: ${unsigned}`);
                        next();
                    }
                });
            } else {
                // Session is correctly loaded
                console.log(`[Request ${req.path}] Session correctly loaded, no recovery needed`);
                next();
            }
        } else {
            // Cookie couldn't be unsigned - invalid signature
            console.log(`[Request ${req.path}] *** COOKIE SIGNATURE INVALID *** Cookie value: ${cookieSessionId.substring(0, 50)}...`);
            next();
        }
    } else {
        // No cookie or unsigned cookie
        next();
    }
});

// Debug middleware to log Set-Cookie headers
app.use((req, res, next) => {
    const originalEnd = res.end;
    const originalRedirect = res.redirect;
    const originalSetHeader = res.setHeader;
    
    // Track if Set-Cookie was set
    let setCookieHeader = null;
    
    // Override setHeader to capture Set-Cookie
    res.setHeader = function(name, value) {
        if (name.toLowerCase() === 'set-cookie') {
            setCookieHeader = value;
            console.log(`[${req.path}] Set-Cookie header set:`, Array.isArray(value) ? value : [value]);
        }
        return originalSetHeader.call(this, name, value);
    };
    
    // Override redirect to log headers
    res.redirect = function(url) {
        const headers = res.getHeaders();
        const setCookie = res.getHeader('Set-Cookie') || setCookieHeader;
        console.log(`[${req.path}] Redirecting to:`, url);
        console.log(`[${req.path}] Response headers:`, Object.keys(headers));
        if (setCookie) {
            console.log(`[${req.path}] Set-Cookie header:`, Array.isArray(setCookie) ? setCookie : [setCookie]);
        } else {
            console.log(`[${req.path}] WARNING: No Set-Cookie header!`);
        }
        return originalRedirect.call(this, url);
    };
    
    // Override end to log headers when response is actually sent
    res.end = function(chunk, encoding) {
        const setCookie = res.getHeader('Set-Cookie') || setCookieHeader;
        if (setCookie) {
            console.log(`[${req.path}] Response Set-Cookie header (in end):`, Array.isArray(setCookie) ? setCookie : [setCookie]);
        } else if (req.path.includes('/auth/google/callback')) {
            console.log(`[${req.path}] WARNING: No Set-Cookie header in OAuth callback response (in end)!`);
        }
        return originalEnd.call(this, chunk, encoding);
    };
    
    next();
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

// Export sessionStore for use in routes
module.exports.sessionStore = sessionStore;
module.exports = app;

