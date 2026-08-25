-- Kör en gång i Supabase SQL Editor för att avveckla gamla blockeringar helt.
delete from public.digihits_match_join_requests;
delete from public.digihits_blocks;
