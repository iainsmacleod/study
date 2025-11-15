const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getDB } = require('./database');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
    const db = getDB();
    db.get('SELECT id, email, provider FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
            db.close();
            console.error('Error deserializing user:', err);
            return done(err);
        }
        if (!user) {
            db.close();
            console.warn('User not found during deserialization:', id);
            return done(null, false);
        }
        db.close();
        done(null, user);
    });
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const db = getDB();
            const email = profile.emails?.[0]?.value;
            
            // Find or create user
            db.get(
                'SELECT * FROM users WHERE provider = ? AND provider_id = ?',
                ['google', profile.id],
                async (err, user) => {
                    if (err) {
                        db.close();
                        return done(err);
                    }
                    
                    if (user) {
                        db.close();
                        return done(null, user);
                    }
                    
                    // Create new user
                    db.run(
                        'INSERT INTO users (email, provider, provider_id) VALUES (?, ?, ?)',
                        [email || '', 'google', profile.id],
                        function(insertErr) {
                            db.close();
                            if (insertErr) return done(insertErr);
                            
                            db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (selectErr, newUser) => {
                                if (selectErr) return done(selectErr);
                                done(null, newUser);
                            });
                        }
                    );
                }
            );
        } catch (error) {
            done(error);
        }
    }));
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}

module.exports = {
    passport,
    isAuthenticated
};

