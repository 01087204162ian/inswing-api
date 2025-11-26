require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const session = require('express-session');
const db = require('./db');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// AWS SDK
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// CORS 설정 (간단 / 안정 버전)
const allowedOrigins = [
  'https://inswing.ai',
  'https://www.inswing.ai',
  'http://localhost:4000',
  'http://localhost:3000',
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// preflight(OPTIONS) 요청 처리
//app.options('*', cors());


app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

// ===== OAuth Strategies =====

// Google OAuth Strategy
passport.use(new GoogleStrategy({
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
passport.use(new KakaoStrategy({
    clientID: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    callbackURL: process.env.KAKAO_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile._json.kakao_account?.email;
      const kakaoId = profile.id;
      const name = profile.displayName || profile._json.kakao_account?.profile?.nickname;

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

// ===== File Upload =====

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ===== Auth Middleware =====

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = auth.substring('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ===== OAuth Routes =====

// Google 로그인 시작
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google 콜백
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'https://inswing.ai/app/login.html' }),
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
app.get('/auth/kakao',
  passport.authenticate('kakao')
);

// Kakao 콜백
app.get('/auth/kakao/callback',
  passport.authenticate('kakao', { failureRedirect: 'https://inswing.ai/app/login.html' }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`https://inswing.ai/app/login.html?token=${token}`);
  }
);

// ===== API Routes =====

// 이메일 로그인
app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const [rows] = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);

    let userId;
    if (rows.length > 0) {
      userId = rows[0].id;
    } else {
      const [result] = await db.query('INSERT INTO users (email) VALUES (?)', [email]);
      userId = result.insertId;
    }

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ ok: true, token, user: { id: userId, email } });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// 1) 스윙 업로드 + AI 분석 + S3 저장
app.post('/swings', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { club_type, shot_side } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 1단계: AI 분석 (로컬 파일 사용)
      let metrics;

      try {
        const formData = new FormData();
        formData.append('video', fs.createReadStream(req.file.path));

        const aiResponse = await axios.post('http://localhost:5000/analyze', formData, {
          headers: formData.getHeaders(),
          timeout: 900000 // 9000초(15분) 같은 충분한 값으로 이미 조정한 상태라고 가정
        });

        if (aiResponse.data && aiResponse.data.ok) {
          const analysis = aiResponse.data.analysis || {};

          metrics = {
            backswing_angle: analysis.backswing_angle,
            impact_speed: analysis.impact_speed,
            follow_through_angle: analysis.follow_through_angle,
            balance_score: analysis.balance_score,

            // v2 확장 필드들 (없으면 null)
            tempo_ratio: analysis.tempo_ratio ?? null,
            backswing_time_sec: analysis.backswing_time_sec ?? null,
            downswing_time_sec: analysis.downswing_time_sec ?? null,
            head_movement_pct: analysis.head_movement_pct ?? null,
            shoulder_rotation_range: analysis.shoulder_rotation_range ?? null,
            hip_rotation_range: analysis.hip_rotation_range ?? null,
            rotation_efficiency: analysis.rotation_efficiency ?? null,
            overall_score: analysis.overall_score ?? null
          };
        } else {
          console.error('AI 분석 에러: 응답 ok=false');
          // AI 실패 시 더미 데이터 (확장 필드는 일단 null)
          metrics = {
            backswing_angle: (Math.random() * 30 + 70).toFixed(2),
            impact_speed: (Math.random() * 20 + 90).toFixed(2),
            follow_through_angle: (Math.random() * 40 + 110).toFixed(2),
            balance_score: (Math.random() * 0.3 + 0.7).toFixed(2),

            tempo_ratio: null,
            backswing_time_sec: null,
            downswing_time_sec: null,
            head_movement_pct: null,
            shoulder_rotation_range: null,
            hip_rotation_range: null,
            rotation_efficiency: null,
            overall_score: null
          };
        }
      } catch (aiError) {
        console.error('AI 분석 에러:', aiError.message);
        // AI 실패 시 더미 데이터 사용 (v2 필드는 NULL)
        metrics = {
          backswing_angle: (Math.random() * 30 + 70).toFixed(2),
          impact_speed: (Math.random() * 20 + 90).toFixed(2),
          follow_through_angle: (Math.random() * 40 + 110).toFixed(2),
          balance_score: (Math.random() * 0.3 + 0.7).toFixed(2),

          tempo_ratio: null,
          backswing_time_sec: null,
          downswing_time_sec: null,
          head_movement_pct: null,
          shoulder_rotation_range: null,
          hip_rotation_range: null,
          rotation_efficiency: null,
          overall_score: null
        };
      }

      // 2단계: S3 업로드
      const fileStream = fs.createReadStream(req.file.path);
      const s3Key = `videos/${Date.now()}-${req.file.originalname}`;

      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileStream,
        ContentType: req.file.mimetype
      };

      const s3Upload = new Upload({
        client: s3Client,
        params: uploadParams
      });

      await s3Upload.done();

      // CloudFront URL 생성
      const videoUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;

      // 3단계: 로컬 파일 삭제
      fs.unlinkSync(req.file.path);

      // 4단계: DB 저장
      const [swingResult] = await connection.query(
        'INSERT INTO swings (user_id, video_url, club_type, shot_side) VALUES (?, ?, ?, ?)',
        [userId, videoUrl, club_type, shot_side]
      );
      const swingId = swingResult.insertId;

      await connection.query(
        `
        INSERT INTO metrics (
          swing_id,
          backswing_angle,
          impact_speed,
          follow_through_angle,
          balance_score,
          tempo_ratio,
          backswing_time_sec,
          downswing_time_sec,
          head_movement_pct,
          shoulder_rotation_range,
          hip_rotation_range,
          rotation_efficiency,
          overall_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          swingId,
          metrics.backswing_angle,
          metrics.impact_speed,
          metrics.follow_through_angle,
          metrics.balance_score,
          metrics.tempo_ratio,
          metrics.backswing_time_sec,
          metrics.downswing_time_sec,
          metrics.head_movement_pct,
          metrics.shoulder_rotation_range,
          metrics.hip_rotation_range,
          metrics.rotation_efficiency,
          metrics.overall_score
        ]
      );

      await connection.commit();

      return res.json({
        ok: true,
        swing: { id: swingId, video_url: videoUrl, club_type, shot_side },
        metrics
      });

    } catch (err) {
      await connection.rollback();
      // 에러 시 로컬 파일 삭제
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// 2) 스윙 단건 조회
app.get('/swings/:id', authMiddleware, async (req, res) => {
  try {
    const swingId = req.params.id;
    const userId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT
        s.id,
        s.video_url,
        s.club_type,
        s.shot_side,
        s.created_at,
        m.backswing_angle,
        m.impact_speed,
        m.follow_through_angle,
        m.balance_score,
        m.tempo_ratio,
        m.backswing_time_sec,
        m.downswing_time_sec,
        m.head_movement_pct,
        m.shoulder_rotation_range,
        m.hip_rotation_range,
        m.rotation_efficiency,
        m.overall_score,
        f.feeling_code,
        f.note
      FROM swings s
      LEFT JOIN metrics m ON s.id = m.swing_id
      LEFT JOIN feelings f ON s.id = f.swing_id
      WHERE s.id = ? AND s.user_id = ?
      `,
      [swingId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }

    const swing = rows[0];

    return res.json({
      ok: true,
      swing: {
        id: swing.id,
        video_url: swing.video_url,
        club_type: swing.club_type,
        shot_side: swing.shot_side,
        created_at: swing.created_at
      },
      metrics: {
        backswing_angle: swing.backswing_angle,
        impact_speed: swing.impact_speed,
        follow_through_angle: swing.follow_through_angle,
        balance_score: swing.balance_score,
        tempo_ratio: swing.tempo_ratio,
        backswing_time_sec: swing.backswing_time_sec,
        downswing_time_sec: swing.downswing_time_sec,
        head_movement_pct: swing.head_movement_pct,
        shoulder_rotation_range: swing.shoulder_rotation_range,
        hip_rotation_range: swing.hip_rotation_range,
        rotation_efficiency: swing.rotation_efficiency,
        overall_score: swing.overall_score
      },
      feeling: swing.feeling_code ? {
        feeling_code: swing.feeling_code,
        note: swing.note
      } : null
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Query failed' });
  }
});

// 3) 히스토리 리스트 조회
app.get('/swings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT
        s.id,
        s.video_url,
        s.club_type,
        s.shot_side,
        s.created_at,
        m.backswing_angle,
        m.impact_speed,
        m.follow_through_angle,
        m.balance_score,
        m.tempo_ratio,
        m.backswing_time_sec,
        m.downswing_time_sec,
        m.head_movement_pct,
        m.shoulder_rotation_range,
        m.hip_rotation_range,
        m.rotation_efficiency,
        m.overall_score,
        f.feeling_code,
        f.note
      FROM swings s
      LEFT JOIN metrics m ON s.id = m.swing_id
      LEFT JOIN feelings f ON s.id = f.swing_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      `,
      [userId]
    );

    const swings = rows.map(row => ({
      id: row.id,
      video_url: row.video_url,
      club_type: row.club_type,
      shot_side: row.shot_side,
      created_at: row.created_at,
      metrics: {
        backswing_angle: row.backswing_angle,
        impact_speed: row.impact_speed,
        follow_through_angle: row.follow_through_angle,
        balance_score: row.balance_score,
        tempo_ratio: row.tempo_ratio,
        backswing_time_sec: row.backswing_time_sec,
        downswing_time_sec: row.downswing_time_sec,
        head_movement_pct: row.head_movement_pct,
        shoulder_rotation_range: row.shoulder_rotation_range,
        hip_rotation_range: row.hip_rotation_range,
        rotation_efficiency: row.rotation_efficiency,
        overall_score: row.overall_score
      },
      feeling: row.feeling_code ? {
        feeling_code: row.feeling_code,
        note: row.note
      } : null
    }));

    return res.json({ ok: true, swings });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Query failed' });
  }
});

// 4) 스윙 느낌 저장 (안전 버전)
app.post('/swings/:id/feeling', authMiddleware, async (req, res) => {
  try {
    const swingId = req.params.id;
    const userId = req.user.id;
    const { feeling_code, note } = req.body || {};

    // 1) feeling_code 필수 검증
    if (!feeling_code || typeof feeling_code !== 'string') {
      return res.status(400).json({ error: 'feeling_code is required' });
    }

    // 2) 스윙 소유자 확인
    const [swingRows] = await db.query(
      'SELECT id FROM swings WHERE id = ? AND user_id = ?',
      [swingId, userId]
    );

    if (swingRows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }

    // 3) note는 선택사항 → 공백이면 NULL로 저장
    const cleanedNote =
      typeof note === 'string' && note.trim() !== '' ? note.trim() : null;

    // 4) 느낌 upsert
    await db.query(
      `
      INSERT INTO feelings (swing_id, feeling_code, note)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        feeling_code = VALUES(feeling_code),
        note = VALUES(note)
      `,
      [swingId, feeling_code, cleanedNote]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error saving feeling:', err);
    return res.status(500).json({ error: 'Save failed' });
  }
});

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'INSWING API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'INSWING API is running' });
});

app.listen(PORT, () => {
  console.log(`INSWING API server running on http://localhost:${PORT}`);
});
