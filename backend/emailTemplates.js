const getBaseStyles = () => `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); padding: 30px 20px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
  .content { padding: 40px 30px; }
  .greeting { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #2d3436; }
  .message { margin-bottom: 25px; color: #636e72; font-size: 16px; }
  .button-container { text-align: center; margin: 30px 0; }
  .button { display: inline-block; padding: 14px 30px; background-color: #FF6B6B; color: #ffffff !important; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3); transition: transform 0.2s; }
  .footer { background-color: #f1f2f6; padding: 20px; text-align: center; font-size: 12px; color: #b2bec3; }
  .footer a { color: #FF6B6B; text-decoration: none; }
  .highlight { color: #FF6B6B; font-weight: 600; }
`;

const getWelcomeEmailTemplate = (fullName, loginUrl) => `
<!DOCTYPE html>
<html>
<head>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to EndOfHunger! 🍔</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${fullName},</div>
      <p class="message">
        We are absolutely thrilled to have you join the <strong>EndOfHunger</strong> family! Your journey to delicious food and seamless dining experiences starts right here.
      </p>
      <p class="message">
        We've set up your account and you're all ready to go. Explore the best menus, manage your orders, and satisfy those cravings!
      </p>
      <div class="button-container">
        <a href="${loginUrl}" class="button">Start Dining Now</a>
      </div>
      <p class="message">
        If you have any questions, feel free to reply to this email. We're here to help!
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} EndOfHunger. All rights reserved.</p>
      <p>Made with ❤️ for food lovers.</p>
    </div>
  </div>
</body>
</html>
`;

const getForgotPasswordTemplate = (resetUrl) => `
<!DOCTYPE html>
<html>
<head>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request 🔐</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi there,</div>
      <p class="message">
        We received a request to reset the password for your <strong>EndOfHunger</strong> account. Don't worry, it happens to the best of us!
      </p>
      <p class="message">
        Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.
      </p>
      <div class="button-container">
        <a href="${resetUrl}" class="button">Reset My Password</a>
      </div>
      <p class="message" style="font-size: 14px; color: #999;">
        If you didn't request a password reset, you can safely ignore this email. Your account remains secure.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} EndOfHunger. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const getPasswordResetSuccessTemplate = (loginUrl) => `
<!DOCTYPE html>
<html>
<head>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Changed Successfully ✅</h1>
    </div>
    <div class="content">
      <div class="greeting">Success!</div>
      <p class="message">
        Your password has been successfully updated. You can now log in with your new password.
      </p>
      <p class="message">
        If you did not make this change, please contact our support team immediately.
      </p>
      <div class="button-container">
        <a href="${loginUrl}" class="button">Log In to Your Account</a>
      </div>
    </div>
    </div>
  </div>
</body>
</html>
`;

const getWelcomeEmailText = (fullName, loginUrl) => `
Hello ${fullName},

Welcome to EndOfHunger! 🍔

We are absolutely thrilled to have you join the EndOfHunger family! Your journey to delicious food and seamless dining experiences starts right here.

    We've set up your account and you're all ready to go.

Start Dining Now: ${loginUrl}

If you have any questions, feel free to reply to this email.We're here to help!

© ${new Date().getFullYear()} EndOfHunger.All rights reserved.
`;

const getForgotPasswordText = (resetUrl) => `
Password Reset Request 🔐

Hi there,

    We received a request to reset the password for your EndOfHunger account.

Reset your password by visiting this link:
${resetUrl}

This link is valid for 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your account remains secure.

© ${new Date().getFullYear()} EndOfHunger.All rights reserved.
`;

const getPasswordResetSuccessText = (loginUrl) => `
Password Changed Successfully ✅

Success!

Your password has been successfully updated.You can now log in with your new password.

Log In to Your Account: ${loginUrl}

If you did not make this change, please contact our support team immediately.

© ${new Date().getFullYear()} EndOfHunger.All rights reserved.
`;

const getSupportTicketTemplate = (ticketId, name, subject, message) => `
<!DOCTYPE html>
<html>
<head>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);">
      <h1>Support Ticket #${ticketId} 🎫</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${name},</div>
      <p class="message">
        We have received your support request. Our team is looking into it and will get back to you shortly.
      </p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0;">
        <p style="margin: 0 0 5px; font-weight: bold; color: #475569;">Subject: ${subject}</p>
        <p style="margin: 0; color: #64748b;">${message}</p>
      </div>
       <p class="message" style="font-size: 14px; color: #999;">
        You can reply directly to this email to add more details.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} EndOfHunger Support.</p>
    </div>
  </div>
</body>
</html>
`;

const getSupportReplyTemplate = (ticketId, name, message, replyMessage) => `
<!DOCTYPE html>
<html>
<head>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);">
      <h1>Reply to Ticket #${ticketId} 💬</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${name},</div>
      <p class="message">
        New reply to your ticket:
      </p>
       <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0;">
        <p style="margin: 0; color: #1e293b;">${replyMessage}</p>
      </div>
      <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Previous Message:</p>
         <p style="font-size: 13px; color: #64748b; font-style: italic;">"${message}"</p>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} EndOfHunger Support.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = {
  getWelcomeEmailTemplate,
  getForgotPasswordTemplate,
  getPasswordResetSuccessTemplate,
  getWelcomeEmailText,
  getForgotPasswordText,
  getPasswordResetSuccessText,
  getSupportTicketTemplate,
  getSupportReplyTemplate
};
