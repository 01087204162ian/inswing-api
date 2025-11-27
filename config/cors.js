const cors = require('cors');

const allowedOrigins = [
  'https://inswing.ai',
  'https://www.inswing.ai'
];

module.exports = cors({
  origin: function (origin, callback) {
    // Postman 같은 툴은 origin이 undefined일 수 있음 → 허용
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // 필요하면 개발용 로컬도 허용할 수 있음 (예: http://localhost:3000)
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});
