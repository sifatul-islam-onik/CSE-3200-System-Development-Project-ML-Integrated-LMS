const { createProxyMiddleware } = require('http-proxy-middleware');

const API_TARGET = process.env.REACT_APP_API_URL || process.env.API_TARGET || 'http://localhost:5000';
const ML_API_TARGET = process.env.REACT_APP_ML_API_TARGET || process.env.ML_API_TARGET || 'http://localhost:8000';

module.exports = function(app) {
  // Proxy for backend API
  app.use(
    '/api',
    createProxyMiddleware({
      target: API_TARGET,
      changeOrigin: true,
    })
  );

  // Proxy for ML server
  app.use(
    '/ml-api',
    createProxyMiddleware({
      target: ML_API_TARGET,
      changeOrigin: true,
      pathRewrite: {
        '^/ml-api': '/api', // rewrite /ml-api/extract-marks to /api/extract-marks
      },
    })
  );
};
