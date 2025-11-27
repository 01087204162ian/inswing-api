const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const db = require('../db');

// Google OAuth Strategy
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const googleId = profile.id;
      const name = profile.displayName;

      const [rows] = await db.query(
        'SELECT id, email FROM users WHERE oauth_provider = ? AND oauth_id = ?',
        ['google', googleId]
      );

      let userId;
      if (rows.length > 0) {
        userId = rows[0].id;
      } else {
        const [emailRows] = await db.query(
          'SELECT id FROM users WHERE email = ?',
          [email]
        );

        if (emailRows.length > 0) {
          userId = emailRows[0].id;
          await db.query(
            'UPDATE users SET oauth_provider = ?, oauth_id = ?, name = ? WHERE id = ?',
            ['google', googleId, name, userId]
          );
        } else {
          const [result] = await db.query(
            'INSERT INTO users (email, oauth_provider, oauth_id, name) VALUES (?, ?, ?, ?)',
            [email, 'google', googleId, name]
          );
          userId = result.insertId;
        }
      }

      return done(null, { id: userId, email, name });
    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err);
    }
  }
));

// Kakao OAuth Strategy
passport.use(new KakaoStrategy(
  {
    clientID: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    callbackURL: process.env.KAKAO_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile._json.kakao_account?.email;
      const kakaoId = profile.id;
      const name =
        profile.displayName ||
        profile._json.kakao_account?.profile?.nickname;

      const userEmail = email || `kakao_${kakaoId}@inswing.temp`;

      const [rows] = await db.query(
        'SELECT id, email FROM users WHERE oauth_provider = ? AND oauth_id = ?',
        ['kakao', kakaoId]
      );

      let userId;
      if (rows.length > 0) {
        userId = rows[0].id;
      } else {
        const [emailRows] = await db.query(
          'SELECT id FROM users WHERE email = ?',
          [userEmail]
        );

        if (emailRows.length > 0) {
          userId = emailRows[0].id;
          await db.query(
            'UPDATE users SET oauth_provider = ?, oauth_id = ?, name = ? WHERE id = ?',
            ['kakao', kakaoId, name, userId]
          );
        } else {
          const [result] = await db.query(
            'INSERT INTO users (email, oauth_provider, oauth_id, name) VALUES (?, ?, ?, ?)',
            [userEmail, 'kakao', kakaoId, name]
          );
          userId = result.insertId;
        }
      }

      return done(null, { id: userId, email: userEmail, name });
    } catch (err) {
      console.error('Kakao OAuth error:', err);
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
