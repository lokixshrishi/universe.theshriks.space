import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { starSchema } from "./star-utils";
import { z } from "zod";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
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
      // Don't fail the whole flow — star is born; email storage is best-effort.
    } else if (data.email) {
      let subject = "";
      let html = "";
      const colors = {
        bg: "#0A0A0A",
        text: "#F2F2F2",
        accent: "#1F3D2E",
        secondary: "#2B2B2B"
      };
      
      const baseHtml = (content: string) => `
        <div style="background-color: ${colors.bg}; color: ${colors.text}; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid ${colors.secondary};">
          <h1 style="color: ${colors.text}; text-align: center; font-weight: 300; margin-top: 0;">The Shriks Universe</h1>
          <div style="background-color: ${colors.secondary}; height: 1px; margin: 30px 0;"></div>
          ${content}
          <div style="background-color: ${colors.secondary}; height: 1px; margin: 30px 0;"></div>
          <p style="text-align: center; color: #888; font-size: 12px; margin-bottom: 0;">From the void, your star shines.</p>
        </div>
      `;

      if (data.category === "lokiai-waitlist") {
        subject = "Welcome to the LokiAI Waitlist";
        html = baseHtml(`
          <h2 style="color: ${colors.accent}; font-weight: 400;">Your star is born, ${data.name}.</h2>
          <p style="line-height: 1.6;">Thank you for placing your star in The Shriks Universe and joining the LokiAI waitlist.</p>
          <p style="line-height: 1.6;">We have recorded your mark. We will reach out when the cosmos aligns.</p>
          <blockquote style="border-left: 3px solid ${colors.accent}; margin: 20px 0; padding-left: 15px; font-style: italic; color: #aaa;">"${data.message}"</blockquote>
        `);
      } else if (data.category === "feedback") {
        subject = "Thank you for your feedback";
        html = baseHtml(`
          <h2 style="color: ${colors.accent}; font-weight: 400;">Your voice is heard, ${data.name}.</h2>
          <p style="line-height: 1.6;">Thank you for your valuable feedback. It helps shape the universe.</p>
          <blockquote style="border-left: 3px solid ${colors.accent}; margin: 20px 0; padding-left: 15px; font-style: italic; color: #aaa;">"${data.message}"</blockquote>
        `);
      } else if (data.category === "reach-out") {
        subject = "We have received your signal";
        html = baseHtml(`
          <h2 style="color: ${colors.accent}; font-weight: 400;">Signal received, ${data.name}.</h2>
          <p style="line-height: 1.6;">Thank you for reaching out to us. We will get back to you shortly.</p>
          <blockquote style="border-left: 3px solid ${colors.accent}; margin: 20px 0; padding-left: 15px; font-style: italic; color: #aaa;">"${data.message}"</blockquote>
        `);
      }

      if (subject) {
        try {
          await transporter.sendMail({
            from: `"The Shriks" <${process.env.SMTP_USER}>`,
            to: data.email,
            subject,
            html,
          });
        } catch (e) {
          console.error("Failed to send email", e);
        }
      }
    }

    return star;
  });
