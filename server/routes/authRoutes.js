const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateUser } = require('../middlewares/authMiddleware');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please try again in 15 minutes.' }
});

const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or Roll Number is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

router.post('/login', loginLimiter, loginValidation, authController.login);

router.post('/verify-email', otpLimiter, authController.verifyEmail);
router.post('/resend-otp', otpLimiter, authController.resendOTP);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', otpLimiter, authController.resetPassword);

router.put('/profile/update', authenticateUser, authController.updateProfile);
router.get('/profile', authenticateUser, authController.getProfile);

module.exports = router;
