const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../auth');
const passport = require('passport');

// GET /api/auth/user - Get current user
router.get('/user', (req, res) => {
    console.log('Auth check - isAuthenticated:', req.isAuthenticated());
    console.log('Auth check - session ID:', req.sessionID);
    console.log('Auth check - session passport:', req.session.passport);
    console.log('Auth check - user:', req.user);
    
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
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback - Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
    (req, res) => {
        console.log('Google OAuth callback successful, user:', req.user);
        console.log('Session after login:', req.session);
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:8080');
    }
);

// POST /api/auth/logout - Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

module.exports = router;

