const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticateUser = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (decoded.role !== user.role) {
        return res.status(403).json({
          success: false,
          message: 'Invalid token. Role mismatch detected.'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive'
        });
      }

      if (user.role !== 'admin') {
        if (!user.isEmailVerified) {
          return res.status(403).json({
            success: false,
            message: 'Email not verified'
          });
        }

        if (!user.isApprovedByAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Account not approved by admin'
          });
        }
      }

      req.user = user;
      next();

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};
