const nodemailer = require('nodemailer');

let transporter = null;
let emailEnabled = false;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.log('⚠️  SMTP not configured. Email sending is disabled.');
      console.log('   Passwords will be shown in Admin Panel instead.');
      emailEnabled = false;
      return null;
    }

    transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',  // true for 465, false for 587
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      ...(process.env.SMTP_SECURE !== 'true' && { requireTLS: true }),
      tls: { rejectUnauthorized: false }
    });
    emailEnabled = true;
    console.log(`✅ SMTP configured: ${host}:${process.env.SMTP_PORT || '587'} (secure=${process.env.SMTP_SECURE === 'true'})`);
  }
  return transporter;
}

function isEmailEnabled() {
  getTransporter(); // trigger init check
  return emailEnabled;
}

async function sendPasswordEmail(toEmail, password, cycleName) {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, email: toEmail, error: 'SMTP ยังไม่ได้ตั้งค่า – ดูรหัสผ่านได้ที่หน้า Admin', noSmtp: true };
  }
  const mailOptions = {
    from: `"360° Evaluation System" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `[360° Evaluation] รหัสผ่านสำหรับแบบประเมิน 360 องศา - ${cycleName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">360° Executive Evaluation</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">แบบประเมินผู้บริหาร 360 องศา</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="color: #333; font-size: 16px;">เรียน ท่านผู้บริหาร,</p>
          <p style="color: #555; line-height: 1.6;">ท่านได้รับเชิญเข้าร่วมการประเมิน 360 องศา รอบ <strong>${cycleName}</strong></p>
          <div style="background: #f5f5f5; border-left: 4px solid #1a237e; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 10px; color: #666; font-size: 14px;">ข้อมูลสำหรับเข้าสู่ระบบ:</p>
            <p style="margin: 5px 0; color: #333;"><strong>อีเมล:</strong> ${toEmail}</p>
            <p style="margin: 5px 0; color: #333;"><strong>รหัสผ่าน:</strong> <code style="background: #e8eaf6; padding: 3px 10px; border-radius: 4px; font-size: 16px; letter-spacing: 2px;">${password}</code></p>
          </div>
          <p style="color: #d32f2f; font-size: 14px;">⚠️ กรุณาทำแบบประเมินให้เสร็จภายในครั้งเดียว เนื่องจากระบบอนุญาตให้ทำได้เพียง 1 ครั้งเท่านั้น</p>
          <p style="color: #555; line-height: 1.6;">ขอบคุณที่สละเวลาในการประเมิน ข้อมูลของท่านจะถูกเก็บรักษาเป็นความลับ</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">อีเมลนี้ส่งจากระบบประเมิน 360° โดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>
      </div>
    `
  };

  try {
    await transport.sendMail(mailOptions);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error(`Failed to send email to ${toEmail}:`, error.message);
    return { success: false, email: toEmail, error: error.message };
  }
}

async function sendReminderEmail(toEmail, cycleName, endDate) {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, email: toEmail, error: 'SMTP ยังไม่ได้ตั้งค่า', noSmtp: true };
  }
  const mailOptions = {
    from: `"360° Evaluation System" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `[แจ้งเตือน] กรุณาทำแบบประเมิน 360 องศา - ${cycleName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: linear-gradient(135deg, #e65100 0%, #f57c00 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⏰ แจ้งเตือนการประเมิน</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">360° Executive Evaluation</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="color: #333; font-size: 16px;">เรียน ท่านผู้บริหาร,</p>
          <p style="color: #555; line-height: 1.6;">ระบบตรวจพบว่าท่านยังไม่ได้ทำแบบประเมิน 360 องศา รอบ <strong>${cycleName}</strong></p>
          <div style="background: #fff3e0; border-left: 4px solid #e65100; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #e65100; font-weight: bold;">📅 กำหนดสิ้นสุดการประเมิน: ${endDate}</p>
          </div>
          <p style="color: #555; line-height: 1.6;">กรุณาเข้าสู่ระบบและทำแบบประเมินก่อนวันสิ้นสุด หากท่านลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">อีเมลนี้ส่งจากระบบประเมิน 360° โดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        </div>
      </div>
    `
  };

  try {
    await transport.sendMail(mailOptions);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error(`Failed to send reminder to ${toEmail}:`, error.message);
    return { success: false, email: toEmail, error: error.message };
  }
}

async function sendReportEmail(toEmail, cycleName, reportHtml) {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, email: toEmail, error: 'SMTP ยังไม่ได้ตั้งค่า', noSmtp: true };
  }
  const mailOptions = {
    from: `"360° Evaluation System" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `[360° Evaluation] รายงานผลการประเมิน 360 องศา - ${cycleName}`,
    html: reportHtml
  };

  try {
    await transport.sendMail(mailOptions);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error(`Failed to send report to ${toEmail}:`, error.message);
    return { success: false, email: toEmail, error: error.message };
  }
}

async function verifyConnection() {
  const transport = getTransporter();
  if (!transport) throw new Error('SMTP not configured');
  return transport.verify();
}

async function sendTestEmail(toEmail) {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: 'SMTP ยังไม่ได้ตั้งค่า', noSmtp: true };
  }
  const mailOptions = {
    from: `"360° Eval Test" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: '[Test] SMTP Connection Test - 360° Evaluation',
    text: 'อีเมลทดสอบนี้ส่งสำเร็จ SMTP ทำงานปกติ \nThis is a test email from 360° Evaluation System.',
    html: '<p>✅ <strong>SMTP ทำงานปกติ!</strong></p><p>อีเมลทดสอบนี้ส่งสำเร็จจาก 360° Evaluation System</p>'
  };
  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Test email sent:', info.messageId);
    return { success: true, email: toEmail, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Test email failed:', error);
    return { success: false, email: toEmail, error: error.message, code: error.code };
  }
}

module.exports = {
  sendPasswordEmail,
  sendReminderEmail,
  sendReportEmail,
  isEmailEnabled,
  verifyConnection,
  sendTestEmail
};
