const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for backend API
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
    })
  );

  // Proxy for ML server
  app.use(
    '/ml-api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      pathRewrite: {
        '^/ml-api': '/api', // rewrite /ml-api/extract-marks to /api/extract-marks
      },
    })
  );
};
