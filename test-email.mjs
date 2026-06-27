import nodemailer from "nodemailer";

async function run() {
  console.log("Testing Email Sending...");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const colors = {
    bg: "#0A0A0A",
    text: "#F2F2F2",
    accent: "#1F3D2E",
    secondary: "#2B2B2B"
  };

  const html = `
    <div style="background-color: ${colors.bg}; color: ${colors.text}; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid ${colors.secondary};">
      <h1 style="color: ${colors.text}; text-align: center; font-weight: 300; margin-top: 0;">The Shriks Universe</h1>
      <div style="background-color: ${colors.secondary}; height: 1px; margin: 30px 0;"></div>
      <h2 style="color: ${colors.accent}; font-weight: 400;">Signal received, Test User.</h2>
      <p style="line-height: 1.6;">Thank you for reaching out to us. We will get back to you shortly.</p>
      <blockquote style="border-left: 3px solid ${colors.accent}; margin: 20px 0; padding-left: 15px; font-style: italic; color: #aaa;">"This is a test of the email system!"</blockquote>
      <div style="background-color: ${colors.secondary}; height: 1px; margin: 30px 0;"></div>
      <p style="text-align: center; color: #888; font-size: 12px; margin-bottom: 0;">From the void, your star shines.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"The Shriks" <${process.env.SMTP_USER}>`,
      to: "laukikxrajput@gmail.com",
      subject: "Test from The Shriks Universe",
      html,
    });
    console.log("✅ Email sent successfully");
  } catch (e) {
    console.error("❌ Email sending failed:", e);
    process.exit(1);
  }
}

run();
