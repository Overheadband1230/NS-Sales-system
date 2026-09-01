begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'editor@example.com', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'inactive@example.com', '{}'::jsonb);

update public.profiles set active = true, role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set active = true, role = 'editor' where id = '00000000-0000-0000-0000-000000000002';

insert into public.shipments (id, train_id, customer_name, origin_name, destination_name, draft_data, created_by, updated_by)
values (
  '10000000-0000-0000-0000-000000000001', 'TEST-1', 'Test Customer', 'Origin', 'Destination',
  '{"schemaVersion":2,"trainId":"TEST-1","customer":"Test Customer","stops":[{"id":"a","name":"Origin","internalNote":"secret"},{"id":"b","name":"Destination","internalNote":"secret"}]}'::jsonb,
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
);

select ok(public.is_active_staff('00000000-0000-0000-0000-000000000001'), 'admin is active');
select ok(public.is_admin('00000000-0000-0000-0000-000000000001'), 'admin role is recognized');
select ok(public.is_active_staff('00000000-0000-0000-0000-000000000002'), 'editor is active');
select is(public.is_admin('00000000-0000-0000-0000-000000000002'), false, 'editor is not admin');
select is(public.is_active_staff('00000000-0000-0000-0000-000000000003'), false, 'inactive profile is blocked');
select is(jsonb_path_exists(public.customer_snapshot((select draft_data from public.shipments limit 1)), '$.stops[*].internalNote'), false, 'publication sanitizer removes internal notes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq('select count(*) from public.shipments', array[1::bigint], 'active editor reads the shared workspace');
select throws_ok('update public.shipments set train_id = ''bypass''', '42501', null, 'direct draft updates are denied');

select * from finish();
rollback;
