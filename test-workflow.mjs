import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

async function run() {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("=== USER WORKFLOW ===");
  console.log("Placing a star in Supabase...");
  const starId = crypto.randomUUID();
  const { data: star, error } = await supabaseAdmin
    .from("stars")
    .insert({
      id: starId,
      name: "Workflow Tester",
      message: "Testing the entire end-to-end flow.",
      category: "lokiai-waitlist",
      x: 15,
      y: 25,
      z: 35,
      color: "#ff8a5c",
      size: 1.5,
    })
    .select("id, name, message, category")
    .single();

  if (error) {
    console.error("❌ Supabase stars insert failed:", error);
    process.exit(1);
  }
  console.log("✅ Star placed successfully:", star.name);

  console.log("Saving email for the star...");
  const { error: emailError } = await supabaseAdmin
    .from("star_emails")
    .insert({ star_id: star.id, email: "laukikxrajput@gmail.com" });

  if (emailError) {
    console.error("❌ Supabase star_emails insert failed:", emailError);
    process.exit(1);
  }
  console.log("✅ Email saved securely");

  console.log("Sending email to user...");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const colors = { bg: "#0A0A0A", text: "#F2F2F2", accent: "#1F3D2E", secondary: "#2B2B2B" };
  const html = `
    <div style="background-color: ${colors.bg}; color: ${colors.text}; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid ${colors.secondary};">
      <h1 style="color: ${colors.text}; text-align: center; font-weight: 300; margin-top: 0;">The Shriks Universe</h1>
      <div style="background-color: ${colors.secondary}; height: 1px; margin: 30px 0;"></div>
      <h2 style="color: ${colors.accent}; font-weight: 400;">Your star is born, ${star.name}.</h2>
      <p style="line-height: 1.6;">Thank you for placing your star in The Shriks Universe and joining the LokiAI waitlist.</p>
      <blockquote style="border-left: 3px solid ${colors.accent}; margin: 20px 0; padding-left: 15px; font-style: italic; color: #aaa;">"${star.message}"</blockquote>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"The Shriks" <${process.env.SMTP_USER}>`,
      to: "laukikxrajput@gmail.com",
      subject: "Welcome to the LokiAI Waitlist",
      html,
    });
    console.log("✅ Automated Email sent successfully to laukikxrajput@gmail.com");
  } catch (e) {
    console.error("❌ Email sending failed:", e);
    process.exit(1);
  }
  
  console.log("\n=== ADMIN WORKFLOW ===");
  console.log("Fetching dashboard data securely...");
  const { data: dashboardData, error: dashError } = await supabaseAdmin
    .from("stars")
    .select("*, star_emails(email)")
    .order("created_at", { ascending: false });

  if (dashError) {
    console.error("❌ Failed to fetch dashboard data:", dashError);
    process.exit(1);
  }

  console.log("✅ Dashboard data fetched successfully. Records found:", dashboardData.length);
  if (dashboardData.length > 0) {
    const latest = dashboardData[0];
    console.log("Latest entry on dashboard:");
    console.log(`- Name: ${latest.name}`);
    console.log(`- Email: ${latest.star_emails?.email || "Unknown"}`);
    console.log(`- Category: ${latest.category}`);
    console.log(`- Message: ${latest.message}`);
  }
  
  console.log("\n✅ All workflows tested successfully!");
}

run();
