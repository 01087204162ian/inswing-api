const mysql = require('mysql2/promise');

// MySQL 연결 풀
const pool = mysql.createPool({
  host: 'localhost',
  user: 'inswing_user',
  password: 'inswing2025!',
  database: 'inswing',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;