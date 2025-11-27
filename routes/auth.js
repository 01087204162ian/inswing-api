const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// 이메일 로그인
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const [rows] = await db.query(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    let userId;
    if (rows.length > 0) {
      userId = rows[0].id;
    } else {
      const [result] = await db.query(
        'INSERT INTO users (email) VALUES (?)',
        [email]
      );
      userId = result.insertId;
    }

    const token = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ ok: true, token, user: { id: userId, email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Google 로그인 시작
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google 콜백
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'https://inswing.ai/app/login.html'
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`https://inswing.ai/app/login.html?token=${token}`);
  }
);

// Kakao 로그인 시작
router.get('/kakao',
  passport.authenticate('kakao')
);

// Kakao 콜백
router.get(
  '/kakao/callback',
  passport.authenticate('kakao', {
    failureRedirect: 'https://inswing.ai/app/login.html'
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`https://inswing.ai/app/login.html?token=${token}`);
  }
);

module.exports = router;
