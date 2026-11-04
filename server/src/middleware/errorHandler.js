function errorHandler(err, req, res, next) {
  console.error('Unhandled Application Error:', err);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // User-facing safe message
  let message = err.message || 'Internal Server Error';
  if (err.name === 'SyntaxError' || message.includes('regular expression')) {
    message = 'Invalid request parameters or format.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = { errorHandler };
