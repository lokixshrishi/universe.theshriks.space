import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { starSchema } from "./star-utils";
import { z } from "zod";

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

    return star;
  });
