require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

// 설정/미들웨어/라우트
const corsMiddleware = require('./config/cors');
const passport = require('./config/passport');
const authMiddleware = require('./middlewares/auth');

const authRoutes = require('./routes/auth');
const swingRoutes = require('./routes/swings');
const feelingRoutes = require('./routes/feelings');

const app = express();
const PORT = 4000;

// CORS
app.use(corsMiddleware);

// JSON 파싱
app.use(express.json());

// 정적 파일 (업로드된 원본 접근용 - 필요 시 유지)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 세션 (OAuth용)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // HTTPS + 프록시 구성 후 true 고려
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// ===== 라우트 설정 =====

// /auth/*  → 로그인, OAuth 관련
app.use('/auth', authRoutes);

// /swings/* → JWT 인증 필요
app.use('/swings', authMiddleware, swingRoutes);

// /swings/:id/feeling → JWT 인증 필요
app.use('/swings', authMiddleware, feelingRoutes);

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'INSWING API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'INSWING API is running' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`INSWING API server running on http://localhost:${PORT}`);
});
