const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../auth');
const passport = require('passport');

// GET /api/auth/user - Get current user
router.get('/user', (req, res) => {
    if (req.isAuthenticated() && req.user) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                provider: req.user.provider
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// GET /api/auth/google - Google OAuth login
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account' // Force Google to show login/account selection screen
    })
);

// GET /api/auth/google/callback - Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
    (req, res) => {
        const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        
        // Regenerate session to get a fresh session ID
        req.session.regenerate((err) => {
            if (err) {
                console.error('Error regenerating session:', err);
                return res.redirect(redirectUrl);
            }
            
            // Re-establish the passport session in the new session
            req.login(req.user, (loginErr) => {
                if (loginErr) {
                    console.error('Error re-logging in after regenerate:', loginErr);
                    return res.redirect(redirectUrl);
                }
                
                // Save session first
                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('Error saving session:', saveErr);
                        return res.redirect(redirectUrl);
                    }
                    
                    // Express-session doesn't set cookies on redirects, so we must set it manually
                    // IMPORTANT: Don't use res.cookie() as it URL-encodes the value, breaking the signature
                    const cookieSignature = require('cookie-signature');
                    const secret = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
                    const signedValue = cookieSignature.sign(req.sessionID, secret);
                    
                    const cookieConfig = req.session.cookie;
                    const isProduction = process.env.NODE_ENV === 'production';
                    
                    // Build cookie string manually - DO NOT URL-encode the signed value
                    let cookieString = `study.sid=${signedValue}; Path=${cookieConfig.path || '/'}`;
                    
                    if (cookieConfig.maxAge) {
                        const expires = new Date(Date.now() + cookieConfig.maxAge);
                        cookieString += `; Expires=${expires.toUTCString()}`;
                        cookieString += `; Max-Age=${Math.floor(cookieConfig.maxAge / 1000)}`;
                    }
                    
                    if (cookieConfig.httpOnly !== false) {
                        cookieString += `; HttpOnly`;
                    }
                    
                    if (cookieConfig.secure || isProduction) {
                        cookieString += `; Secure`;
                    }
                    
                    if (cookieConfig.sameSite) {
                        cookieString += `; SameSite=${cookieConfig.sameSite}`;
                    }
                    
                    res.setHeader('Set-Cookie', cookieString);
                    res.redirect(redirectUrl);
                });
            });
        });
    }
);

// POST /api/auth/logout - Logout
router.post('/logout', (req, res) => {
    // Get cookie config before destroying session
    const cookieConfig = req.session?.cookie || {};
    const isProduction = process.env.NODE_ENV === 'production';
    
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        
        // Destroy the session to clear it from the store
        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                console.error('Error destroying session:', destroyErr);
                return res.status(500).json({ error: 'Logout failed' });
            }
            
            // Clear the session cookie by setting it to expire immediately
            let cookieString = `study.sid=; Path=${cookieConfig.path || '/'}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
            
            if (cookieConfig.httpOnly !== false) {
                cookieString += `; HttpOnly`;
            }
            
            if (cookieConfig.secure || isProduction) {
                cookieString += `; Secure`;
            }
            
            if (cookieConfig.sameSite) {
                cookieString += `; SameSite=${cookieConfig.sameSite}`;
            }
            
            res.setHeader('Set-Cookie', cookieString);
            res.json({ success: true });
        });
    });
});

module.exports = router;

