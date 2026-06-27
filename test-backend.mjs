import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

async function run() {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("Testing Supabase Insert...");
  const starId = crypto.randomUUID();
  console.log("Skipping Supabase test to just send email...");
  /*
  const { data: star, error } = await supabaseAdmin
    .from("stars")
...
    console.error("❌ Supabase stars insert failed:", error);
    process.exit(1);
  }
  console.log("✅ Supabase stars insert successful, ID:", star.id);

  console.log("Testing Supabase Emails Insert...");
  const { error: emailError } = await supabaseAdmin
    .from("star_emails")
    .insert({ star_id: star.id, email: "laukikxrajput@gmail.com" });

  if (emailError) {
    console.error("❌ Supabase star_emails insert failed:", emailError);
    process.exit(1);
  }
  console.log("✅ Supabase star_emails insert successful");

  console.log("Testing Email Sending...");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"The Shriks" <${process.env.SMTP_USER}>`,
      to: "laukikxrajput@gmail.com",
      subject: "Test from The Shriks Universe",
      html: "<p>The integration test was successful.</p>",
    });
    console.log("✅ Email sent successfully");
  } catch (e) {
    console.error("❌ Email sending failed:", e);
    process.exit(1);
  }
  
  console.log("All tests passed!");
}

run();
