import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  // Fetch stars and left join star_emails
  const { data, error } = await supabaseAdmin
    .from("stars")
    .select(`
      *,
      star_emails(email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw new Error("Could not load dashboard data");
  }

  return data.map((d: any) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    message: d.message,
    created_at: d.created_at,
    email: d.star_emails?.email || "Unknown",
  }));
});
