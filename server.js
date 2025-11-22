// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// JWT Secret (실제 운영에서는 환경변수로 관리)
const JWT_SECRET = 'inswing-secret-key-2025'; // TODO: 환경변수로 변경
// 업로드 파일을 저장할 로컬 폴더 (임시용)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const unique = Date.now();
    cb(null, base + '-' + unique + ext);
  },
});
const upload = multer({ storage });

const app = express();
const PORT = process.env.PORT || 4000;

// CORS 허용 (프론트에서 호출 가능하도록)
app.use(cors());
app.use(express.json());
// 로그인 API
app.post('/api/auth/login', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // 간단한 이메일 검증
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // 임시: 이메일을 user_id로 해싱 (실제로는 DB 조회)
    const userId = Math.abs(
      email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % 10000;

    // JWT 토큰 발급
    const token = jwt.sign(
      { 
        userId, 
        email 
      },
      JWT_SECRET,
      { expiresIn: '7d' } // 7일 유효
    );

    return res.json({
      ok: true,
      token,
      user: { id: userId, email }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});
// 메모리 상에 스윙 데이터 저장 (임시 DB 역할)
let swings = [];       // { id, user_id, created_at, video_url, club_type, shot_side }
let metricsMap = {};   // swing_id -> { rotation_efficiency, ... }
let feelingsMap = {};  // swing_id -> { feeling_code, note }

// 토큰 확인 - JWT 검증으로 변경
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
    // JWT 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// 헬퍼: 가짜 AI 분석 결과 만들기
function generateFakeMetrics() {
  function rand(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 10) / 10;
  }
  return {
    rotation_efficiency: rand(60, 100),
    balance_stability: rand(50, 95),
    head_movement_pct: rand(5, 25),
    tempo_ratio: Math.round((Math.random() * 0.6 + 0.2) * 100) / 100, // 0.2~0.8
    impact_rhythm_score: rand(50, 100),
  };
}

// 1) 스윙 업로드 + 분석 (가짜 메트릭)
app.post('/api/swings', authMiddleware, upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'video file is required' });
    }

    const clubType = req.body.club_type || null;
    const shotSide = req.body.shot_side || null;

    const id = swings.length + 1;
    const now = new Date().toISOString();

    // 지금은 로컬 파일 경로를 video_url로 사용 (나중에 S3 URL로 교체)
    const video_url = `/uploads/${req.file.filename}`;

    const swing = {
      id,
      user_id: req.user.id,
      created_at: now,
      video_url,
      club_type: clubType,
      shot_side: shotSide,
      ai_status: 'completed',
    };
    swings.push(swing);

    const metrics = generateFakeMetrics();
    metricsMap[id] = metrics;

    return res.json({
      swing,
      metrics,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// 2) 스윙 단건 조회
app.get('/api/swings/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const swing = swings.find((s) => s.id === id && s.user_id === req.user.id);
  if (!swing) {
    return res.status(404).json({ error: 'swing not found' });
  }

  const metrics = metricsMap[id] || null;
  const feeling = feelingsMap[id] || null;

  return res.json({
    swing,
    metrics,
    feeling,
  });
});

// 3) 히스토리 리스트 조회
app.get('/api/swings', authMiddleware, (req, res) => {
  const userSwings = swings.filter((s) => s.user_id === req.user.id);
  const items = userSwings.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    thumbnail_url: null, // 나중에 썸네일 추가
    club_type: s.club_type,
    ai_status: s.ai_status,
    metrics: metricsMap[s.id] || null,
    feeling_code: (feelingsMap[s.id] && feelingsMap[s.id].feeling_code) || null,
  }));

  return res.json({
    items,
    total: items.length,
  });
});

// 4) 스윙 느낌 저장
app.post('/api/swings/:id/feeling', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const swing = swings.find((s) => s.id === id && s.user_id === req.user.id);
  if (!swing) {
    return res.status(404).json({ error: 'swing not found' });
  }

  const { feeling_code, note } = req.body || {};
  if (!feeling_code) {
    return res.status(400).json({ error: 'feeling_code is required' });
  }

  feelingsMap[id] = {
    feeling_code,
    note: note || '',
    created_at: new Date().toISOString(),
  };

  return res.json({
    swing_id: id,
    ...feelingsMap[id],
  });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'INSWING API is running' });
});

// 옵션: 혹시 나중에 직접 4000 포트로 테스트할 때를 대비해서
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'INSWING API is running (api path)' });
});
// 업로드된 파일 서빙 (테스트용)
// 실제 프로덕션에서는 Nginx나 S3를 통해 제공하는 게 안전함
app.use('/uploads', express.static(UPLOAD_DIR));

app.listen(PORT, () => {
  console.log(`INSWING API server running on http://localhost:${PORT}`);
});
