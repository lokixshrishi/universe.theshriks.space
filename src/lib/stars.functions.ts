import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { starSchema } from "./star-utils";
import { z } from "zod";
import nodemailer from "nodemailer";

function getEmailContent(category: string, name: string) {
  let title = "";
  let message = "";

  if (category === "lokiai-waitlist") {
    title = "Welcome to the LokiAI Waitlist";
    message = `Hello ${name},<br><br>Your star has been placed in the universe. We have officially secured your spot on the LokiAI waitlist.<br><br>We're building something that will change the way you interact with the digital world. You will be one of the first to experience it.<br><br>Keep an eye on the stars. We will reach out when it is time.`;
  } else if (category === "feedback") {
    title = "Your Feedback is Received";
    message = `Hello ${name},<br><br>Your star now shines in our universe, carrying your feedback.<br><br>Every suggestion helps us shape what we build next. We deeply appreciate you taking the time to share your thoughts with us.<br><br>Thank you for being part of our journey.`;
  } else {
    title = "We Have Received Your Signal";
    message = `Hello ${name},<br><br>Your star has been placed, and your message has reached us.<br><br>We are grateful you decided to reach out. Our team will review your signal and respond shortly if needed.<br><br>Welcome to the universe.`;
  }

  const html = `<!DOCTYPE html>
<html>
  <body style="background-color:#07070a;color:#ffffff;font-family:'Inter',sans-serif;padding:40px 20px;margin:0;line-height:1.7;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);padding:48px;border-radius:4px;">
      <p style="color:#1f8f5d;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 28px 0;">The Shriks Universe</p>
      <h2 style="color:#ffffff;font-weight:300;font-size:24px;letter-spacing:0.5px;margin:0 0 20px 0;">${title}</h2>
      <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:28px;"></div>
      <p style="color:rgba(255,255,255,0.75);font-size:15px;margin:0 0 32px 0;">${message}</p>
      <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:24px;"></div>
      <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">&copy; The Shriks. All rights reserved.</p>
    </div>
  </body>
</html>`;

  return { title, html };
}

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const createStarInput = starSchema.extend({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().min(0.3).max(3),
});

export const createStar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createStarInput.parse(data))
  .handler(async ({ data }) => {
    const { data: star, error } = await supabaseAdmin
      .from("stars")
      .insert({
        name: data.name,
        message: data.message,
        category: data.category,
        x: data.x,
        y: data.y,
        z: data.z,
        color: data.color,
        size: data.size,
      })
      .select("id, name, message, category, x, y, z, color, size, created_at")
      .single();

    if (error || !star) {
      console.error("createStar insert error:", error);
      throw new Error("Could not birth your star");
    }

    const { error: emailError } = await supabaseAdmin
      .from("star_emails")
      .insert({ star_id: star.id, email: data.email });

    if (emailError) {
      console.error("star_emails insert error:", emailError);
    }

    if (data.email) {
      try {
        const { title, html } = getEmailContent(data.category, data.name);
        await mailer.sendMail({
          from: `"The Shriks Universe" <${process.env.SMTP_USER}>`,
          to: data.email,
          subject: title,
          html,
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    }

    return star;
  });
