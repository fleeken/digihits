-- Run only as a developer test. All temporary test matches are rolled back.
begin;
do $$
declare
 h uuid:=gen_random_uuid();g uuid:=gen_random_uuid();o uuid:=gen_random_uuid();
 s jsonb;c text;old_game text;new_game text;i int;
begin
 perform set_config('request.jwt.claim.sub',h::text,true);
 s:=public.radioboll('create',jsonb_build_object('name','Testvärd','skin',0));c:=s->>'code';old_game:=s->>'gameId';
 if s->>'phase'<>'lobby' or jsonb_array_length(s->'players')<>1 then raise exception 'Create failed';end if;
 perform set_config('request.jwt.claim.sub',g::text,true);
 s:=public.radioboll('check',jsonb_build_object('code',c));if not (s->>'canJoin')::boolean then raise exception 'Check failed';end if;
 s:=public.radioboll('join',jsonb_build_object('code',c,'name','Testgäst','skin',5));
 if (s->'players'->1->>'team')::int<>1 then raise exception 'Team balancing failed';end if;
 s:=public.radioboll('join',jsonb_build_object('code',c,'name','Changed','skin',0));
 if s->'players'->1->>'name'<>'Testgäst' or (s->'players'->1->>'skin')::int<>5 then raise exception 'Identity lock failed';end if;
 begin perform public.radioboll('start',jsonb_build_object('code',c));raise exception 'TEST: guest start allowed';exception when raise_exception then if sqlerrm='TEST: guest start allowed' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',o::text,true);
 begin perform public.radioboll('state',jsonb_build_object('code',c));raise exception 'TEST: outsider state allowed';exception when raise_exception then if sqlerrm='TEST: outsider state allowed' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',h::text,true);
 begin perform public.radioboll('start',jsonb_build_object('code',c));raise exception 'TEST: unready start allowed';exception when raise_exception then if sqlerrm='TEST: unready start allowed' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',g::text,true);
 perform public.radioboll('ready',jsonb_build_object('code',c,'ready',true));
 perform public.radioboll('signal',jsonb_build_object('code',c,'gameId',old_game,'target',h,'data',jsonb_build_object('kind','ice','connection','test','candidate','test')));
 perform set_config('request.jwt.claim.sub',h::text,true);
 s:=public.radioboll('state',jsonb_build_object('code',c));if jsonb_array_length(s->'signals')<>1 then raise exception 'Signal inbox failed';end if;
 s:=public.radioboll('state',jsonb_build_object('code',c,'after',s->'signals'->0->>'id'));if jsonb_array_length(s->'signals')<>0 then raise exception 'Signal cursor failed';end if;
 s:=public.radioboll('start',jsonb_build_object('code',c));if s->>'phase'<>'playing' then raise exception 'Start failed';end if;
 perform set_config('request.jwt.claim.sub',g::text,true);
 begin perform public.radioboll('team',jsonb_build_object('code',c,'team',0));raise exception 'TEST: changed teams during game';exception when raise_exception then if sqlerrm='TEST: changed teams during game' then raise;end if;end;
 begin perform public.radioboll('finish',jsonb_build_object('code',c));raise exception 'TEST: guest finish allowed';exception when raise_exception then if sqlerrm='TEST: guest finish allowed' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',h::text,true);
 perform public.radioboll('finish',jsonb_build_object('code',c));
 s:=public.radioboll('restart',jsonb_build_object('code',c));new_game:=s->>'gameId';
 if new_game=old_game or s->>'phase'<>'lobby' or s->'world'<>'null'::jsonb or jsonb_array_length(s->'players')<>2 or (s->'players'->1->>'ready')::boolean then raise exception 'Replay failed';end if;
 if s->'players'->1->>'name'<>'Testgäst' or (s->'players'->1->>'skin')::int<>5 then raise exception 'Replay lost identity';end if;
 perform set_config('request.jwt.claim.sub',g::text,true);
 begin perform public.radioboll('signal',jsonb_build_object('code',c,'gameId',old_game,'target',h,'data',jsonb_build_object('kind','ice')));raise exception 'TEST: old game signal allowed';exception when raise_exception then if sqlerrm='TEST: old game signal allowed' then raise;end if;end;
 s:=public.radioboll('leave',jsonb_build_object('code',c));if not (s->>'left')::boolean then raise exception 'Leave failed';end if;
 if has_table_privilege('authenticated','radioboll.players','SELECT') or has_function_privilege('anon','public.radioboll(text,jsonb)','EXECUTE') then raise exception 'Direct access leaked';end if;
end $$;
rollback;
