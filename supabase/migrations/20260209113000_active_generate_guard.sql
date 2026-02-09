-- Prevent duplicate in-flight generate jobs per user.
-- If duplicates already exist, keep the newest active task per user and fail older ones.

with ranked_active as (
  select
    id,
    generation_id,
    row_number() over (
      partition by user_id
      order by created_at desc, id desc
    ) as rn
  from public.tasks
  where type = 'generate'
    and status in ('pending', 'processing')
)
update public.tasks t
set
  status = 'failed',
  error = 'Superseded by a newer generation request.',
  completed_at = now()
from ranked_active r
where t.id = r.id
  and r.rn > 1;

with superseded_generations as (
  select distinct generation_id
  from public.tasks
  where type = 'generate'
    and status = 'failed'
    and error = 'Superseded by a newer generation request.'
    and generation_id is not null
)
update public.generations g
set
  status = 'failed',
  error_message = 'Superseded by a newer generation request.',
  completed_at = now()
from superseded_generations s
where g.id = s.generation_id
  and g.status in ('pending', 'processing');

create unique index if not exists idx_tasks_generate_one_active_per_user
on public.tasks (user_id)
where type = 'generate'
  and status in ('pending', 'processing');
