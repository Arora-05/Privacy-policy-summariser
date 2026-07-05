/**
 * What it does: Global Express error handling middleware that intercepts unhandled route and service errors.
 * Why it exists: Ensures consistent JSON error responses across all API endpoints without leaking sensitive server stack traces.
 * Connects to: Express application in server.js (mounted as the final middleware after all routes).
 */

function errorHandler(err, req, res, next) {
  const errorStatus = err.status || err.statusCode || 500;
  const errorMessage = err.message || 'An unexpected internal server error occurred.';

  console.error(`[Error] ${req.method} ${req.originalUrl} - Status: ${errorStatus} - Message: ${errorMessage}`);

  res.status(errorStatus).json({
    error: errorMessage,
    status: errorStatus
  });
}

module.exports = errorHandler;
