const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

exports.sendVerificationEmail = async (email, name, otp) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Email Verification OTP - LMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1E3A8A; margin-bottom: 20px;">Email Verification</h2>
            <p style="color: #333; font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              Thank you for registering with our Learning Management System.
            </p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              Your verification code is:
            </p>
            <div style="background-color: #f0f4ff; border: 2px solid #1E3A8A; border-radius: 8px; 
                        padding: 20px; margin: 25px 0; text-align: center;">
              <h1 style="color: #1E3A8A; font-size: 36px; letter-spacing: 8px; margin: 0;">
                ${otp}
              </h1>
            </div>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              <strong>Note:</strong> After email verification, your account will need to be approved by an administrator before you can access the system.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This code will expire in <strong>15 minutes</strong>.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              If you did not create an account, please ignore this email.
            </p>
          </div>
        </div>
      `
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('--- DEVELOPMENT MODE: MOCK EMAIL SENDING ---');
      console.log(`To: ${email}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Verification OTP: ${otp}`);
      console.log('--------------------------------------------');
    }

    try {
      await transporter.sendMail(mailOptions);
    } catch (sendError) {
      console.error('SMTP Send Error (falling back to mock):', sendError.message);
      console.log(`Verification OTP for ${email}: ${otp}`);
    }
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

exports.sendApprovalEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Account Approved - LMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Account Approved</h2>
          <p>Hello ${name},</p>
          <p>Great news! Your account has been approved by an administrator.</p>
          <p>You can now log in and access the Learning Management System.</p>
          <a href="${process.env.CLIENT_URL}/login" 
             style="display: inline-block; padding: 12px 24px; margin: 20px 0; 
                    background-color: #28a745; color: white; text-decoration: none; 
                    border-radius: 4px;">
            Login Now
          </a>
          <p>Thank you for joining us!</p>
        </div>
      `
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('--- DEVELOPMENT MODE: MOCK EMAIL SENDING ---');
      console.log(`To: ${email}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log('--------------------------------------------');
    }

    try {
       await transporter.sendMail(mailOptions);
    } catch (sendError) {
       console.error('SMTP Send Error (falling back to mock):', sendError.message);
    }
    return true;
  } catch (error) {
    console.error('Error sending approval email:', error);
    throw new Error('Failed to send approval email');
  }
};

exports.sendPasswordResetEmail = async (email, name, otp) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Password Reset OTP - LMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1E3A8A; margin-bottom: 20px;">Reset Your Password</h2>
            <p style="color: #333; font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              We received a request to reset your password.
            </p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              Use this 6-digit code to reset your password:
            </p>
            <div style="background-color: #f0f4ff; border: 2px solid #1E3A8A; border-radius: 8px;
                        padding: 20px; margin: 25px 0; text-align: center;">
              <h1 style="color: #1E3A8A; font-size: 36px; letter-spacing: 8px; margin: 0;">
                ${otp}
              </h1>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This code will expire in <strong>15 minutes</strong>.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              If you did not request a password reset, please ignore this email.
            </p>
          </div>
        </div>
      `
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('--- DEVELOPMENT MODE: MOCK EMAIL SENDING ---');
      console.log(`To: ${email}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Password Reset OTP: ${otp}`);
      console.log('--------------------------------------------');
    }

    try {
      await transporter.sendMail(mailOptions);
    } catch (sendError) {
      console.error('SMTP Send Error (falling back to mock):', sendError.message);
      console.log(`Password Reset OTP for ${email}: ${otp}`);
    }
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};
