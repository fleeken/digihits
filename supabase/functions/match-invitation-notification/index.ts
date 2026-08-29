import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

Deno.serve(async (request) => {
  if (request.headers.get("x-digihits-push-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  const invite = (await request.json()).record;
  if (!invite?.recipient_id || invite.status !== "pending") return Response.json({ skipped: true });
  const [{ data: sender }, { data: subscriptions = [] }] = await Promise.all([
    supabase.from("digihits_profiles").select("display_name").eq("user_id", String(invite.sender_id)).maybeSingle(),
    supabase.from("push_subscriptions").select("endpoint,subscription").eq("user_id", String(invite.recipient_id))
  ]);
  const message = JSON.stringify({ title: "Ny matchinbjudan", body: `${sender?.display_name || "En vän"} har bjudit in dig till match ${invite.match_code}.`, url: "./?matches=1#home" });
  await Promise.all(subscriptions.map(async (item) => {
    try { await webpush.sendNotification(item.subscription, message); }
    catch (error) { if ([404, 410].includes(Number(error?.statusCode))) await supabase.from("push_subscriptions").delete().eq("endpoint", item.endpoint); }
  }));
  return Response.json({ sent: subscriptions.length });
});
