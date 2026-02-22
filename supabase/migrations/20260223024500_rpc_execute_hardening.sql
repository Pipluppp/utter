-- Explicitly lock down RPC execution to service_role only.
-- Revoke from all callable roles to avoid default grant drift in managed environments.
revoke all on function public.increment_task_modal_poll_count(uuid, uuid) from public;
revoke execute on function public.increment_task_modal_poll_count(uuid, uuid) from anon;
revoke execute on function public.increment_task_modal_poll_count(uuid, uuid) from authenticated;
grant execute on function public.increment_task_modal_poll_count(uuid, uuid) to service_role;
