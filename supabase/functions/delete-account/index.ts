import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Metoden tillåts inte." }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const { confirmation } = await req.json();
    if (confirmation !== "RADERA") throw new Error("Bekräftelsen stämmer inte.");
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Du är inte inloggad.");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("Ogiltig inloggning.");
    await admin.from("digihits_profiles").delete().eq("user_id", user.id);
    await admin.from("online_players").delete().eq("user_id", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Kunde inte radera kontot." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
