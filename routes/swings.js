const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const db = require('../db');
const { s3Client, Upload } = require('../config/s3');
const { generateSwingComment } = require('../services/commentService');

const router = express.Router();

// ===== File Upload 설정 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });


// 1) 스윙 업로드 + AI 분석 + S3 저장
router.post('/', upload.single('video'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { club_type, shot_side } = req.body;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No video uploaded' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // ==== AI 분석 ====
      let metrics;
      try {
        const formData = new FormData();
        formData.append('video', fs.createReadStream(req.file.path));

        const aiResponse = await axios.post(
          'http://localhost:5000/analyze',
          formData,
          { headers: formData.getHeaders(), timeout: 900000 }
        );

        const analysis = aiResponse.data?.analysis || {};
        metrics = {
          backswing_angle: analysis.backswing_angle,
          impact_speed: analysis.impact_speed,
          follow_through_angle: analysis.follow_through_angle,
          balance_score: analysis.balance_score,
          tempo_ratio: analysis.tempo_ratio ?? null,
          backswing_time_sec: analysis.backswing_time_sec ?? null,
          downswing_time_sec: analysis.downswing_time_sec ?? null,
          head_movement_pct: analysis.head_movement_pct ?? null,
          shoulder_rotation_range: analysis.shoulder_rotation_range ?? null,
          hip_rotation_range: analysis.hip_rotation_range ?? null,
          rotation_efficiency: analysis.rotation_efficiency ?? null,
          overall_score: analysis.overall_score ?? null
        };
      } catch (err) {
        console.error('AI 서버 오류, 더미 데이터 사용');
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

      // ==== S3 업로드 ====
      const fileStream = fs.createReadStream(req.file.path);
      const s3Key = `videos/${Date.now()}-${req.file.originalname}`;

      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileStream,
        ContentType: req.file.mimetype
      };

      const s3Upload = new Upload({ client: s3Client, params: uploadParams });
      await s3Upload.done();
      const videoUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;

      fs.unlinkSync(req.file.path); // 로컬 파일 삭제

      // ==== 스윙 저장 + 코멘트 생성 ====
      const aiComment = generateSwingComment(metrics, {
        feelingCode: null,
        clubType: club_type,
        shotSide: shot_side
      });

      const [swingResult] = await connection.query(
        'INSERT INTO swings (user_id, video_url, club_type, shot_side, comment) VALUES (?, ?, ?, ?, ?)',
        [userId, videoUrl, club_type, shot_side, aiComment]
      );
      const swingId = swingResult.insertId;

      // metrics 저장
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
        swing: {
          id: swingId,
          video_url: videoUrl,
          club_type,
          shot_side,
          comment: aiComment
        },
        metrics
      });
    } catch (err) {
      await connection.rollback();
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    err.clientMessage = '영상 업로드 중 오류가 발생했습니다.';
    return next(err);
  }
});


// 2) 스윙 단건 조회
// 2) 스윙 단건 조회
router.get('/:id', async (req, res, next) => {
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
        s.comment,
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
    const swings = rows.map(row => ({
      id: row.id,
      video_url: row.video_url,
      club_type: row.club_type,
      shot_side: row.shot_side,
      created_at: row.created_at,
      comment: row.comment,              // 👈 추가
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
      feeling: row.feeling_code
        ? {
            feeling_code: row.feeling_code,
            note: row.note
          }
        : null
    }));
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Swing not found' });
    }

    const row = rows[0];

    const metrics = {
      backswing_angle: row.backswing_angle,
      impact_speed: row.impact_speed,
      follow_through_angle: row.follow_through_angle,
      balance_score: row.balance_score,
      tempo_ratio: row.tempo_ratio,
      backswing_time_sec: row.backswing_time_sec,
      downswing_time_sec: row.downnswing_time_sec,
      head_movement_pct: row.head_movement_pct,
      shoulder_rotation_range: row.shoulder_rotation_range,
      hip_rotation_range: row.hip_rotation_range,
      rotation_efficiency: row.rotation_efficiency,
      overall_score: row.overall_score
    };

    const feeling = row.feeling_code
      ? {
          feeling_code: row.feeling_code,
          note: row.note
        }
      : null;

    // 🔥 여기서 코멘트 생성
    const comment = generateSwingComment(metrics, {
      feelingCode: feeling?.feeling_code || null,
      clubType: row.club_type,
      shotSide: row.shot_side
    });

    return res.json({
      ok: true,
      swing: {
        id: row.id,
        video_url: row.video_url,
        club_type: row.club_type,
        shot_side: row.shot_side,
        created_at: row.created_at
      },
      metrics,
      feeling,
      comment   // 👈 이게 프론트로 간다
    });
  } catch (err) {
    return next(err);
  }
});


// 3) 히스토리 리스트 조회
// 3) 히스토리 리스트 조회
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT
        s.id,
        s.video_url,
        s.club_type,
        s.shot_side,
        s.comment,
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
        f.note,

        -- 🔥 추가: 오늘 스윙 여부
        DATE(s.created_at) = CURDATE() AS is_today,

        -- 🔥 추가: 진행 중 루틴 세션에 포함되는지
        rs.id IS NOT NULL             AS in_active_routine,
        rs.id                         AS routine_session_id

      FROM swings s
      LEFT JOIN metrics  m ON s.id = m.swing_id
      LEFT JOIN feelings f ON s.id = f.swing_id

      -- 🔥 추가: 루틴 세션 조인
      LEFT JOIN routine_sessions rs
        ON rs.user_id = s.user_id
       AND rs.status = 'IN_PROGRESS'
       AND s.created_at >= rs.start_at
       AND (rs.end_at IS NULL OR s.created_at <= rs.end_at)

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
      comment: row.comment,    // AI 코멘트

      // 🔹 오늘/루틴 여부 그대로 보내기 (프론트에서 Boolean으로 써도 됨)
      is_today:          !!row.is_today,
      in_active_routine: !!row.in_active_routine,
      routine_session_id: row.routine_session_id,

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
      feeling: row.feeling_code
        ? {
            feeling_code: row.feeling_code,
            note: row.note
          }
        : null
    }));

    return res.json({ ok: true, swings });
  } catch (err) {
    err.clientMessage = '스윙 히스토리를 불러오는 중 오류가 발생했습니다.';
    return next(err);
  }
});




module.exports = router;
