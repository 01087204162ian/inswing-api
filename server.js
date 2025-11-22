const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = 4000;
const JWT_SECRET = 'inswing-secret-key-2025';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// 인증 미들웨어
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

// 로그인 API
app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // 사용자 조회 또는 생성
    const [rows] = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);
    
    let userId;
    if (rows.length > 0) {
      userId = rows[0].id;
    } else {
      const [result] = await db.query('INSERT INTO users (email) VALUES (?)', [email]);
      userId = result.insertId;
    }

    // JWT 발급
    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ ok: true, token, user: { id: userId, email } });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// 1) 스윙 업로드 + AI 분석
app.post('/swings', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { club_type, shot_side } = req.body;
    const videoPath = req.file ? `https://api.inswing.ai/uploads/${req.file.filename}` : null;

    if (!videoPath) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    // 트랜잭션 시작
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // swings 테이블 삽입
      const [swingResult] = await connection.query(
        'INSERT INTO swings (user_id, video_url, club_type, shot_side) VALUES (?, ?, ?, ?)',
        [userId, videoPath, club_type, shot_side]
      );
      const swingId = swingResult.insertId;

      // 가짜 AI 분석 결과
      const metrics = {
        backswing_angle: (Math.random() * 30 + 70).toFixed(2),
        impact_speed: (Math.random() * 20 + 90).toFixed(2),
        follow_through_angle: (Math.random() * 40 + 110).toFixed(2),
        balance_score: (Math.random() * 0.3 + 0.7).toFixed(2)
      };

      // metrics 테이블 삽입
      await connection.query(
        'INSERT INTO metrics (swing_id, backswing_angle, impact_speed, follow_through_angle, balance_score) VALUES (?, ?, ?, ?, ?)',
        [swingId, metrics.backswing_angle, metrics.impact_speed, metrics.follow_through_angle, metrics.balance_score]
      );

      await connection.commit();

      return res.json({
        ok: true,
        swing: { id: swingId, video_url: videoPath, club_type, shot_side },
        metrics
      });

    } catch (err) {
      await connection.rollback();
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

    const [rows] = await db.query(`
      SELECT 
        s.id, s.video_url, s.club_type, s.shot_side, s.created_at,
        m.backswing_angle, m.impact_speed, m.follow_through_angle, m.balance_score,
        f.feeling_code, f.note
      FROM swings s
      LEFT JOIN metrics m ON s.id = m.swing_id
      LEFT JOIN feelings f ON s.id = f.swing_id
      WHERE s.id = ? AND s.user_id = ?
    `, [swingId, userId]);

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
        balance_score: swing.balance_score
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
// 3) 히스토리 리스트 조회
app.get('/swings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        s.id, s.video_url, s.club_type, s.shot_side, s.created_at,
        m.backswing_angle, m.impact_speed, m.follow_through_angle, m.balance_score,
        f.feeling_code, f.note
      FROM swings s
      LEFT JOIN metrics m ON s.id = m.swing_id
      LEFT JOIN feelings f ON s.id = f.swing_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `, [userId]);

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
        balance_score: row.balance_score
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

// 4) 스윙 느낌 저장
app.post('/swings/:id/feeling', authMiddleware, async (req, res) => {
  try {
    const swingId = req.params.id;
    const userId = req.user.id;
    const { feeling_code, note } = req.body;

    // 스윙 소유 확인
    const [swing] = await db.query('SELECT id FROM swings WHERE id = ? AND user_id = ?', [swingId, userId]);
    if (swing.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }

    // INSERT or UPDATE
    await db.query(`
      INSERT INTO feelings (swing_id, feeling_code, note)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE feeling_code = ?, note = ?
    `, [swingId, feeling_code, note, feeling_code, note]);

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
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
