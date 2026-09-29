-- Run once after supabase_room_lobby_setup.sql to lock names and avatars
-- for participants who have joined a multi-device room match.
revoke all on function public.digihits_update_room_profile(text,text,text,integer)
  from public, anon, authenticated;
