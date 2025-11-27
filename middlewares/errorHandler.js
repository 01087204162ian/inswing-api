// middlewares/errorHandler.js

module.exports = (err, req, res, next) => {
  // 1) 서버 로그 (개발자는 이걸 보고 디버깅)
  console.error('❌ [ERROR]', {
    message: err.message,
    path: req.path,
    method: req.method,
    userId: req.user?.id || null,
    stack: err.stack,
  });

  // 2) 클라이언트에게 줄 HTTP status (없으면 500)
  const status = err.status || 500;

  // 3) 사용자에게 보여줄 메시지 (없으면 기본 문구)
  const clientMessage =
    err.clientMessage || '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

  // 4) 응답 형식 통일
  res.status(status).json({
    ok: false,
    error: clientMessage,
  });
};
