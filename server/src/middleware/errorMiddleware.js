function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
