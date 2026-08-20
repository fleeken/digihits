import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

Deno.serve(async (request) => {
  if (request.headers.get("x-digihits-push-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const payload = await request.json();
  const match = payload.record || payload;
  const previous = payload.old_record || {};
  if (!match?.id || !match.current_user_id || String(match.current_user_id) === String(previous.current_user_id)) return Response.json({ skipped: true });
  const { data: players = [] } = await supabase.from("online_players").select("user_id,display_name").eq("match_id", String(match.id)).eq("active", true);
  const target = players.find((player) => String(player.user_id) === String(match.current_user_id));
  const opponent = players.find((player) => String(player.user_id) !== String(match.current_user_id));
  if (!target) return Response.json({ skipped: true });
  const { data: subscriptions = [] } = await supabase.from("push_subscriptions").select("endpoint,subscription").eq("user_id", String(target.user_id));
  const message = JSON.stringify({ title: "Din tur i Digihits", body: `Det är din tur mot ${opponent?.display_name || "din motspelare"}.`, url: "./?matches=1#home" });
  await Promise.all(subscriptions.map(async (item) => {
    try { await webpush.sendNotification(item.subscription, message); }
    catch (error) { if ([404, 410].includes(Number(error?.statusCode))) await supabase.from("push_subscriptions").delete().eq("endpoint", item.endpoint); }
  }));
  return Response.json({ sent: subscriptions.length });
});
