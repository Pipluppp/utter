-- Phase 05: Task polling helpers

create or replace function public.increment_task_modal_poll_count(
  p_task_id uuid,
  p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  update public.tasks
  set modal_poll_count = modal_poll_count + 1
  where id = p_task_id
    and user_id = p_user_id;

  select modal_poll_count
  into next_count
  from public.tasks
  where id = p_task_id
    and user_id = p_user_id;

  return next_count;
end;
$$;

revoke all on function public.increment_task_modal_poll_count(uuid, uuid) from public;
grant execute on function public.increment_task_modal_poll_count(uuid, uuid) to service_role;
