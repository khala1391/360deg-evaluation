const nodemailer = require('nodemailer');

// ========================
// Provider Management
// ========================

let providerInitialized = false;
let emailProvider = 'none'; // 'brevo' | 'resend' | 'smtp' | 'none'
let smtpTransporter = null;

function initProvider() {
  if (providerInitialized) return;
  providerInitialized = true;

  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();

  // 1) Brevo HTTP API — recommended for cloud platforms (free 300 emails/day)
  if (explicit === 'brevo' || (!explicit && process.env.BREVO_API_KEY)) {
    if (process.env.BREVO_API_KEY) {
      emailProvider = 'brevo';
      console.log('✅ Email: Brevo HTTP API (free 300/day)');
      return;
    }
    console.warn('⚠️  EMAIL_PROVIDER=brevo but BREVO_API_KEY is missing');
  }

  // 2) Resend HTTP API
  if (explicit === 'resend' || (!explicit && process.env.RESEND_API_KEY)) {
    if (process.env.RESEND_API_KEY) {
      emailProvider = 'resend';
      console.log('✅ Email: Resend HTTP API');
      return;
    }
    console.warn('⚠️  EMAIL_PROVIDER=resend but RESEND_API_KEY is missing');
  }

  // 3) SMTP (may fail on cloud platforms that block ports 465/587)
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    smtpTransporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      ...(process.env.SMTP_SECURE !== 'true' && { requireTLS: true }),
      tls: { rejectUnauthorized: false }
    });
    emailProvider = 'smtp';
    console.log(`✅ Email: SMTP (${host}:${process.env.SMTP_PORT || '587'})`);
    return;
  }

  emailProvider = 'none';
  console.log('⚠️  No email provider configured.');
  console.log('   → Recommended: Set EMAIL_PROVIDER=brevo + BREVO_API_KEY (free 300/day)');
  console.log('   → Or set SMTP_HOST + SMTP_USER + SMTP_PASS');
}

function isEmailEnabled() {
  initProvider();
  return emailProvider !== 'none';
}

function getProviderInfo() {
  initProvider();
  return {
    enabled: emailProvider !== 'none',
    provider: emailProvider,
    label: {
      brevo: 'Brevo HTTP API',
      resend: 'Resend HTTP API',
      smtp: `SMTP (${process.env.SMTP_HOST || '?'})`,
      none: 'ยังไม่ได้ตั้งค่า'
    }[emailProvider]
  };
}

// ========================
// Transport: Brevo HTTP API
// ========================

async function sendViaBrevo(to, subject, htmlContent) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@360eval.app';
  const senderName = process.env.EMAIL_FROM_NAME || '360° Evaluation System';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent
    })
  });

  if (!res.ok) {
    const body = await res.text();
    let msg;
    try { msg = JSON.parse(body).message; } catch { msg = body; }
    throw new Error(`Brevo ${res.status}: ${msg}`);
  }
  return res.json();
}

// ========================
// Transport: Resend HTTP API
// ========================

async function sendViaResend(to, subject, htmlContent) {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || 'noreply@360eval.app';
  const senderName = process.env.EMAIL_FROM_NAME || '360° Evaluation System';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [to],
      subject,
      html: htmlContent
    })
  });

  if (!res.ok) {
    const body = await res.text();
    let msg;
    try { msg = JSON.parse(body).message; } catch { msg = body; }
    throw new Error(`Resend ${res.status}: ${msg}`);
  }
  return res.json();
}

// ========================
// Transport: SMTP
// ========================

async function sendViaSMTP(to, subject, htmlContent) {
  if (!smtpTransporter) throw new Error('SMTP transporter not initialized');
  const senderEmail = process.env.SMTP_USER;
  const senderName = process.env.EMAIL_FROM_NAME || '360° Evaluation System';
  await smtpTransporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject,
    html: htmlContent
  });
}

// ========================
// Generic send
// ========================

async function sendEmail(to, subject, htmlContent) {
  initProvider();
  switch (emailProvider) {
    case 'brevo':  return sendViaBrevo(to, subject, htmlContent);
    case 'resend': return sendViaResend(to, subject, htmlContent);
    case 'smtp':   return sendViaSMTP(to, subject, htmlContent);
    default: throw new Error('ยังไม่ได้ตั้งค่าระบบส่งอีเมล');
  }
}

// ========================
// High-level email functions
// ========================

async function sendPasswordEmail(toEmail, password, cycleName) {
  if (!isEmailEnabled()) {
    return { success: false, email: toEmail, error: 'ยังไม่ได้ตั้งค่าระบบส่งอีเมล – ดูรหัสผ่านได้ที่หน้า Admin', noSmtp: true };
  }

  const subject = `[360° Evaluation] รหัสผ่านสำหรับแบบประเมิน 360 องศา - ${cycleName}`;
  const html = `
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
  `;

  try {
    await sendEmail(toEmail, subject, html);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error(`Failed to send email to ${toEmail}:`, error.message);
    return { success: false, email: toEmail, error: error.message };
  }
}

async function sendReminderEmail(toEmail, cycleName, endDate) {
  if (!isEmailEnabled()) {
    return { success: false, email: toEmail, error: 'ยังไม่ได้ตั้งค่าระบบส่งอีเมล', noSmtp: true };
  }

  const subject = `[แจ้งเตือน] กรุณาทำแบบประเมิน 360 องศา - ${cycleName}`;
  const html = `
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
  `;

  try {
    await sendEmail(toEmail, subject, html);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error(`Failed to send reminder to ${toEmail}:`, error.message);
    return { success: false, email: toEmail, error: error.message };
  }
}

async function sendReportEmail(toEmail, cycleName, reportHtml) {
  if (!isEmailEnabled()) {
    return { success: false, email: toEmail, error: 'ยังไม่ได้ตั้งค่าระบบส่งอีเมล', noSmtp: true };
  }

  const subject = `[360° Evaluation] รายงานผลการประเมิน 360 องศา - ${cycleName}`;
  try {
    await sendEmail(toEmail, subject, reportHtml);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error(`Failed to send report to ${toEmail}:`, error.message);
    return { success: false, email: toEmail, error: error.message };
  }
}

// ========================
// Verify & Test
// ========================

async function verifyConnection() {
  initProvider();
  if (emailProvider === 'smtp') {
    if (!smtpTransporter) throw new Error('SMTP not configured');
    return smtpTransporter.verify();
  }
  if (emailProvider === 'brevo') {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': process.env.BREVO_API_KEY }
    });
    if (!res.ok) throw new Error(`Brevo API key ไม่ถูกต้อง (${res.status})`);
    const data = await res.json();
    return { verified: true, email: data.email, plan: data.plan?.[0]?.type || 'free' };
  }
  if (emailProvider === 'resend') {
    const res = await fetch('https://api.resend.com/api-keys', {
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` }
    });
    if (!res.ok) throw new Error(`Resend API key ไม่ถูกต้อง (${res.status})`);
    return { verified: true };
  }
  throw new Error('ยังไม่ได้ตั้งค่าระบบส่งอีเมล');
}

async function sendTestEmail(toEmail) {
  if (!isEmailEnabled()) {
    return { success: false, error: 'ยังไม่ได้ตั้งค่าระบบส่งอีเมล', noSmtp: true };
  }

  const subject = '[Test] Email Connection Test - 360° Evaluation';
  const html = '<p>✅ <strong>ระบบส่งอีเมลทำงานปกติ!</strong></p><p>อีเมลทดสอบนี้ส่งสำเร็จจาก 360° Evaluation System</p>';

  try {
    await sendEmail(toEmail, subject, html);
    console.log(`✅ Test email sent to ${toEmail}`);
    return { success: true, email: toEmail };
  } catch (error) {
    console.error('❌ Test email failed:', error);
    return { success: false, email: toEmail, error: error.message };
  }
}

module.exports = {
  sendPasswordEmail,
  sendReminderEmail,
  sendReportEmail,
  isEmailEnabled,
  getProviderInfo,
  verifyConnection,
  sendTestEmail
};
