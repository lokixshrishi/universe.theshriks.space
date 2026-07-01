import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { starSchema } from "./star-utils";
import { z } from "zod";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="background-color: #07070a; color: #ffffff; font-family: 'Inter', sans-serif; padding: 40px 20px; margin: 0; line-height: 1.6;">
        <div style="max-w: 500px; margin: 0 auto; border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px; border-radius: 4px;">
          <h2 style="color: #1f8f5d; font-weight: 300; letter-spacing: 1px; margin-top: 0; margin-bottom: 24px;">${title}</h2>
          <p style="color: rgba(255, 255, 255, 0.8); font-size: 15px;">${message}</p>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; margin: 0;">&copy; The Shriks. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  
  return { title, html };
}

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
      // Don't fail the whole flow — star is born; email storage is best-effort.
    }

    if (data.email) {
      try {
        const { title, html } = getEmailContent(data.category, data.name);
        await transporter.sendMail({
          from: `"The Shriks Universe" <${process.env.SMTP_USER}>`,
          to: data.email,
          subject: title,
          html: html,
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    }

    return star;
  });
