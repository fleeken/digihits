import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

async function send(userId: string, message: Record<string, unknown>) {
  const { data: subscriptions = [] } = await supabase.from("push_subscriptions").select("endpoint,subscription").eq("user_id", userId);
  await Promise.all(subscriptions.map(async (item) => {
    try { await webpush.sendNotification(item.subscription, JSON.stringify(message)); }
    catch (error) { if ([404, 410].includes(Number(error?.statusCode))) await supabase.from("push_subscriptions").delete().eq("endpoint", item.endpoint); }
  }));
}

Deno.serve(async (request) => {
  if (request.headers.get("x-digihits-push-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const now = Date.now(), fortyEightHours = 48 * 60 * 60 * 1000, seventyTwoHours = 72 * 60 * 60 * 1000;
  const { data: matches = [] } = await supabase.from("online_matches").select("id,code,current_user_id,turn_started_at,turn_reminder_sent_at").eq("status", "active").not("code", "like", "S0%").not("current_user_id", "is", null);
  let reminders = 0, timeouts = 0;
  for (const match of matches) {
    const started = new Date(match.turn_started_at || 0).getTime();
    if (!started || now - started < fortyEightHours) continue;
    const { data: players = [] } = await supabase.from("online_players").select("id,user_id,display_name,turn_order").eq("match_id", String(match.id)).eq("active", true).order("turn_order");
    const currentIndex = players.findIndex((player) => String(player.user_id) === String(match.current_user_id));
    const current = players[currentIndex], next = players[(currentIndex + 1) % players.length];
    if (!current || !next || String(next.user_id) === String(current.user_id)) continue;
    const opponent = players.find((player) => String(player.user_id) !== String(current.user_id))?.display_name || "din motspelare";
    if (now - started >= seventyTwoHours) {
      const issuedAt = new Date().toISOString();
      await supabase.from("online_players").update({ current_card: null, turn_cards: [], updated_at: issuedAt }).eq("id", current.id);
      await supabase.from("online_matches").update({ current_user_id: next.user_id, turn_started_at: issuedAt, turn_reminder_sent_at: null, turn_notice: { type: "timeout", user_id: current.user_id, opponent_name: opponent, match_code: match.code, issued_at: issuedAt }, updated_at: issuedAt }).eq("id", match.id).eq("current_user_id", current.user_id);
      await send(String(current.user_id), { title: "Turen har gått över", body: `Du har varit inaktiv i matchen mot ${opponent} med matchkod ${match.code} i 72 timmar. Turen går nu automatiskt över till nästa spelare.`, url: "./?matches=1#home" });
      timeouts += 1;
    } else if (!match.turn_reminder_sent_at) {
      const issuedAt = new Date().toISOString();
      await supabase.from("online_matches").update({ turn_reminder_sent_at: issuedAt, turn_notice: { type: "reminder", user_id: current.user_id, opponent_name: opponent, match_code: match.code, issued_at: issuedAt }, updated_at: issuedAt }).eq("id", match.id).is("turn_reminder_sent_at", null);
      await send(String(current.user_id), { title: "Din tur väntar i Digihits", body: `Det har gått 48 timmar sedan du spelade i matchen mot ${opponent} med matchkod ${match.code}. Efter ytterligare 24 timmars inaktivitet i denna match går turen automatiskt över till nästa spelare.`, url: "./?matches=1#home" });
      reminders += 1;
    }
  }
  return Response.json({ reminders, timeouts });
});
