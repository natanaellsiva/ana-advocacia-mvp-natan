-- ============================================================
-- ANA — A Nova Advocacia | Phase 2: Schema + Authorization
-- Run this script once in the Supabase SQL Editor.
-- Creates: enums, tables, GRANTs, RLS policies, helper
-- functions, workflow RPCs and triggers. No demo data.
-- ============================================================

-- ---------- Enums ----------
create type public.office_role as enum ('admin', 'coordinator', 'lawyer');
create type public.demand_status as enum ('nova', 'em_andamento', 'em_revisao', 'concluida', 'cancelada');
create type public.task_status as enum ('pendente', 'em_andamento', 'em_revisao', 'correcao', 'concluida');
create type public.priority as enum ('baixa', 'media', 'alta', 'urgente');

-- ---------- Tables ----------

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.office_members (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.office_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, user_id)
);
create index office_members_user_idx on public.office_members(user_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, name)
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  name text not null,
  document text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_office_name_idx on public.clients(office_id, name);

create table public.demands (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  description text,
  priority public.priority not null default 'media',
  status public.demand_status not null default 'nova',
  responsible_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  due_date date,
  cancel_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'cancelada' or cancel_reason is not null)
);
create index demands_office_status_idx on public.demands(office_id, status);
create index demands_responsible_idx on public.demands(responsible_id);
create index demands_client_idx on public.demands(client_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  demand_id uuid not null references public.demands(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid not null references public.profiles(id),
  due_date date not null,
  required boolean not null default true,
  status public.task_status not null default 'pendente',
  submission_note text,
  review_comment text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_demand_idx on public.tasks(demand_id);
create index tasks_office_assignee_status_idx on public.tasks(office_id, assignee_id, status);
create index tasks_due_date_idx on public.tasks(due_date);

create table public.demand_history (
  id bigint generated always as identity primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  demand_id uuid not null references public.demands(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  actor_id uuid references public.profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index demand_history_demand_idx on public.demand_history(demand_id, created_at);

-- ---------- GRANTs ----------
-- anon gets nothing. authenticated gets row-level access via RLS.

grant select, update on public.offices to authenticated;
grant all on public.offices to service_role;

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select, insert, update, delete on public.office_members to authenticated;
grant all on public.office_members to service_role;

grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;

grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

grant select, insert, update on public.demands to authenticated;
grant all on public.demands to service_role;

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

grant select on public.demand_history to authenticated;
grant all on public.demand_history to service_role;

-- ---------- RLS ----------
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.office_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.clients enable row level security;
alter table public.demands enable row level security;
alter table public.tasks enable row level security;
alter table public.demand_history enable row level security;

-- ---------- Helper functions (SECURITY DEFINER, fixed search_path) ----------

create or replace function public.is_office_member(_office_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.office_members
    where office_id = _office_id and user_id = auth.uid() and active
  )
$$;

create or replace function public.office_role_of(_office_id uuid)
returns public.office_role
language sql stable security definer
set search_path = public
as $$
  select role from public.office_members
  where office_id = _office_id and user_id = auth.uid() and active
  limit 1
$$;

create or replace function public.has_office_role(_office_id uuid, _roles public.office_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.office_members
    where office_id = _office_id and user_id = auth.uid() and active
      and role = any(_roles)
  )
$$;

create or replace function public.can_view_demand(_demand_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.demands d
    where d.id = _demand_id
      and (
        public.has_office_role(d.office_id, array['admin','coordinator']::public.office_role[])
        or d.responsible_id = auth.uid()
        or exists (
          select 1 from public.tasks t
          where t.demand_id = d.id and t.assignee_id = auth.uid()
        )
      )
  )
$$;

-- ---------- RLS policies ----------

-- offices
create policy "Members can view their office"
  on public.offices for select to authenticated
  using (public.is_office_member(id));
create policy "Admins can update their office"
  on public.offices for update to authenticated
  using (public.has_office_role(id, array['admin']::public.office_role[]))
  with check (public.has_office_role(id, array['admin']::public.office_role[]));

-- profiles
create policy "Users can view profiles in their offices"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.office_members m1
      join public.office_members m2 on m2.office_id = m1.office_id
      where m1.user_id = auth.uid() and m1.active
        and m2.user_id = profiles.id and m2.active
    )
  );
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- office_members
create policy "Members can view membership of their office"
  on public.office_members for select to authenticated
  using (public.is_office_member(office_id));
create policy "Admins can add members"
  on public.office_members for insert to authenticated
  with check (public.has_office_role(office_id, array['admin']::public.office_role[]));
create policy "Admins can update members, not themselves"
  on public.office_members for update to authenticated
  using (
    public.has_office_role(office_id, array['admin']::public.office_role[])
    and user_id <> auth.uid()
  )
  with check (
    public.has_office_role(office_id, array['admin']::public.office_role[])
    and user_id <> auth.uid()
  );
create policy "Admins can remove members, not themselves"
  on public.office_members for delete to authenticated
  using (
    public.has_office_role(office_id, array['admin']::public.office_role[])
    and user_id <> auth.uid()
  );

-- teams
create policy "Members can view teams"
  on public.teams for select to authenticated
  using (public.is_office_member(office_id));
create policy "Admins can manage teams"
  on public.teams for all to authenticated
  using (public.has_office_role(office_id, array['admin']::public.office_role[]))
  with check (public.has_office_role(office_id, array['admin']::public.office_role[]));

-- team_members
create policy "Members can view team members"
  on public.team_members for select to authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_id and public.is_office_member(t.office_id)
  ));
create policy "Admins can manage team members"
  on public.team_members for all to authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_id
      and public.has_office_role(t.office_id, array['admin']::public.office_role[])
  ))
  with check (exists (
    select 1 from public.teams t
    where t.id = team_id
      and public.has_office_role(t.office_id, array['admin']::public.office_role[])
  ));

-- clients
create policy "Members can view clients"
  on public.clients for select to authenticated
  using (public.is_office_member(office_id));
create policy "Admins and coordinators can create clients"
  on public.clients for insert to authenticated
  with check (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]));
create policy "Admins and coordinators can update clients"
  on public.clients for update to authenticated
  using (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]))
  with check (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]));
create policy "Admins can delete clients"
  on public.clients for delete to authenticated
  using (public.has_office_role(office_id, array['admin']::public.office_role[]));

-- demands
create policy "Users can view visible demands"
  on public.demands for select to authenticated
  using (public.can_view_demand(id));
create policy "Admins and coordinators can create demands"
  on public.demands for insert to authenticated
  with check (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]));
create policy "Admins and coordinators can update demands"
  on public.demands for update to authenticated
  using (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]))
  with check (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]));

-- tasks
create policy "Users can view tasks of visible demands"
  on public.tasks for select to authenticated
  using (public.can_view_demand(demand_id));
create policy "Admins and coordinators can create tasks"
  on public.tasks for insert to authenticated
  with check (public.has_office_role(office_id, array['admin','coordinator']::public.office_role[]));
create policy "Assignee or managers can update tasks"
  on public.tasks for update to authenticated
  using (
    assignee_id = auth.uid()
    or public.has_office_role(office_id, array['admin','coordinator']::public.office_role[])
  )
  with check (
    assignee_id = auth.uid()
    or public.has_office_role(office_id, array['admin','coordinator']::public.office_role[])
  );
create policy "Managers can delete incomplete tasks"
  on public.tasks for delete to authenticated
  using (
    public.has_office_role(office_id, array['admin','coordinator']::public.office_role[])
    and status <> 'concluida'
  );

-- demand_history (append-only: select only, no insert/update/delete policies)
create policy "Users can view history of visible demands"
  on public.demand_history for select to authenticated
  using (public.can_view_demand(demand_id));

-- ---------- Column-level protection: status columns only via RPCs ----------
revoke update (status) on public.demands from authenticated;
revoke update (status, assignee_id, reviewed_by, reviewed_at, submitted_at, review_comment) on public.tasks from authenticated;

-- ---------- Triggers ----------

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.offices
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.office_members
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.demands
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- team_members: user must belong to the team's office
create or replace function public.check_team_member_office()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  _office_id uuid;
begin
  select office_id into _office_id from public.teams where id = new.team_id;
  if not exists (
    select 1 from public.office_members
    where office_id = _office_id and user_id = new.user_id and active
  ) then
    raise exception 'User must be an active member of the team''s office';
  end if;
  return new;
end;
$$;

create trigger check_team_member_office before insert or update on public.team_members
  for each row execute function public.check_team_member_office();

-- demands: client, team and responsible must belong to the same office
create or replace function public.check_demand_refs()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.clients where id = new.client_id and office_id = new.office_id) then
    raise exception 'Client does not belong to this office';
  end if;
  if new.team_id is not null and not exists (
    select 1 from public.teams where id = new.team_id and office_id = new.office_id
  ) then
    raise exception 'Team does not belong to this office';
  end if;
  if new.responsible_id is not null and not exists (
    select 1 from public.office_members
    where office_id = new.office_id and user_id = new.responsible_id and active
  ) then
    raise exception 'Responsible must be an active member of this office';
  end if;
  return new;
end;
$$;

create trigger check_demand_refs before insert or update on public.demands
  for each row execute function public.check_demand_refs();

-- tasks: copy office_id from demand; assignee must be office member
create or replace function public.check_task_refs()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  _office_id uuid;
begin
  select office_id into _office_id from public.demands where id = new.demand_id;
  new.office_id := _office_id;
  if not exists (
    select 1 from public.office_members
    where office_id = _office_id and user_id = new.assignee_id and active
  ) then
    raise exception 'Assignee must be an active member of this office';
  end if;
  return new;
end;
$$;

create trigger check_task_refs before insert or update on public.tasks
  for each row execute function public.check_task_refs();

-- history: demand creation, responsible change, task creation
create or replace function public.log_demand_created()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.demand_history (office_id, demand_id, actor_id, action, details)
  values (new.office_id, new.id, new.created_by, 'demand_created',
          jsonb_build_object('title', new.title, 'priority', new.priority));
  return new;
end;
$$;

create trigger log_demand_created after insert on public.demands
  for each row execute function public.log_demand_created();

create or replace function public.log_responsible_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.responsible_id is distinct from old.responsible_id then
    insert into public.demand_history (office_id, demand_id, actor_id, action, details)
    values (new.office_id, new.id, auth.uid(), 'responsible_changed',
            jsonb_build_object('from', old.responsible_id, 'to', new.responsible_id));
  end if;
  return new;
end;
$$;

create trigger log_responsible_change after update on public.demands
  for each row execute function public.log_responsible_change();

create or replace function public.log_task_created()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.demand_history (office_id, demand_id, task_id, actor_id, action, details)
  values (new.office_id, new.demand_id, new.id, auth.uid(), 'task_assigned',
          jsonb_build_object('title', new.title, 'assignee_id', new.assignee_id, 'due_date', new.due_date));
  return new;
end;
$$;

create trigger log_task_created after insert on public.tasks
  for each row execute function public.log_task_created();

-- ---------- Workflow RPCs ----------

create or replace function public.assign_task(_task_id uuid, _assignee_id uuid, _due_date date)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _task public.tasks%rowtype;
begin
  select * into _task from public.tasks where id = _task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.has_office_role(_task.office_id, array['admin','coordinator']::public.office_role[]) then
    raise exception 'Only admins and coordinators can assign tasks';
  end if;
  if not exists (
    select 1 from public.office_members
    where office_id = _task.office_id and user_id = _assignee_id and active
  ) then
    raise exception 'Assignee must be an active member of this office';
  end if;
  update public.tasks
  set assignee_id = _assignee_id, due_date = _due_date, status = 'pendente',
      submission_note = null, review_comment = null, submitted_at = null,
      reviewed_by = null, reviewed_at = null
  where id = _task_id;
  insert into public.demand_history (office_id, demand_id, task_id, actor_id, action, details)
  values (_task.office_id, _task.demand_id, _task_id, auth.uid(), 'task_assigned',
          jsonb_build_object('assignee_id', _assignee_id, 'due_date', _due_date));
end;
$$;

create or replace function public.start_task(_task_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _task public.tasks%rowtype;
begin
  select * into _task from public.tasks where id = _task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if _task.assignee_id <> auth.uid() then
    raise exception 'Only the assignee can start this task';
  end if;
  if _task.status not in ('pendente', 'correcao') then
    raise exception 'Task cannot be started from status %', _task.status;
  end if;
  update public.tasks set status = 'em_andamento' where id = _task_id;
  update public.demands set status = 'em_andamento'
  where id = _task.demand_id and status = 'nova';
  insert into public.demand_history (office_id, demand_id, task_id, actor_id, action, details)
  values (_task.office_id, _task.demand_id, _task_id, auth.uid(), 'task_started', null);
end;
$$;

create or replace function public.submit_task(_task_id uuid, _note text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _task public.tasks%rowtype;
  _all_done boolean;
begin
  select * into _task from public.tasks where id = _task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if _task.assignee_id <> auth.uid() then
    raise exception 'Only the assignee can submit this task';
  end if;
  if _task.status not in ('em_andamento', 'correcao') then
    raise exception 'Task cannot be submitted from status %', _task.status;
  end if;
  update public.tasks
  set status = 'em_revisao', submission_note = _note, submitted_at = now()
  where id = _task_id;
  insert into public.demand_history (office_id, demand_id, task_id, actor_id, action, details)
  values (_task.office_id, _task.demand_id, _task_id, auth.uid(), 'task_submitted',
          jsonb_build_object('note', _note));
  select not exists (
    select 1 from public.tasks
    where demand_id = _task.demand_id and required
      and status not in ('em_revisao', 'concluida')
  ) into _all_done;
  if _all_done then
    update public.demands set status = 'em_revisao'
    where id = _task.demand_id and status in ('nova', 'em_andamento');
  end if;
end;
$$;

create or replace function public.review_task(_task_id uuid, _approve boolean, _comment text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _task public.tasks%rowtype;
begin
  select * into _task from public.tasks where id = _task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.has_office_role(_task.office_id, array['admin','coordinator']::public.office_role[]) then
    raise exception 'Only admins and coordinators can review tasks';
  end if;
  if _task.assignee_id = auth.uid() then
    raise exception 'You cannot review your own task';
  end if;
  if _task.status <> 'em_revisao' then
    raise exception 'Task is not awaiting review';
  end if;
  if not _approve and (_comment is null or btrim(_comment) = '') then
    raise exception 'A comment is required when rejecting a task';
  end if;
  update public.tasks
  set status = case when _approve then 'concluida'::public.task_status else 'correcao'::public.task_status end,
      review_comment = _comment, reviewed_by = auth.uid(), reviewed_at = now()
  where id = _task_id;
  insert into public.demand_history (office_id, demand_id, task_id, actor_id, action, details)
  values (_task.office_id, _task.demand_id, _task_id, auth.uid(),
          case when _approve then 'task_approved' else 'task_rejected' end,
          jsonb_build_object('comment', _comment));
end;
$$;

create or replace function public.set_demand_status(_demand_id uuid, _status public.demand_status)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _demand public.demands%rowtype;
begin
  select * into _demand from public.demands where id = _demand_id for update;
  if not found then raise exception 'Demand not found'; end if;
  if not public.has_office_role(_demand.office_id, array['admin','coordinator']::public.office_role[]) then
    raise exception 'Only admins and coordinators can change demand status';
  end if;
  if _demand.status in ('concluida', 'cancelada') then
    raise exception 'Cannot change status of a finished demand';
  end if;
  if _status = 'cancelada' then
    raise exception 'Use cancel_demand to cancel a demand';
  end if;
  if _status = 'concluida' and exists (
    select 1 from public.tasks
    where demand_id = _demand_id and required and status <> 'concluida'
  ) then
    raise exception 'All required tasks must be completed before concluding the demand';
  end if;
  update public.demands set status = _status where id = _demand_id;
  insert into public.demand_history (office_id, demand_id, actor_id, action, details)
  values (_demand.office_id, _demand_id, auth.uid(), 'status_changed',
          jsonb_build_object('from', _demand.status, 'to', _status));
end;
$$;

create or replace function public.cancel_demand(_demand_id uuid, _reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _demand public.demands%rowtype;
begin
  select * into _demand from public.demands where id = _demand_id for update;
  if not found then raise exception 'Demand not found'; end if;
  if not public.has_office_role(_demand.office_id, array['admin','coordinator']::public.office_role[]) then
    raise exception 'Only admins and coordinators can cancel demands';
  end if;
  if _demand.status in ('concluida', 'cancelada') then
    raise exception 'Cannot cancel a finished demand';
  end if;
  if _reason is null or btrim(_reason) = '' then
    raise exception 'A reason is required to cancel a demand';
  end if;
  update public.demands set status = 'cancelada', cancel_reason = _reason where id = _demand_id;
  insert into public.demand_history (office_id, demand_id, actor_id, action, details)
  values (_demand.office_id, _demand_id, auth.uid(), 'demand_cancelled',
          jsonb_build_object('reason', _reason));
end;
$$;

-- RPCs are callable by authenticated users; each one re-checks membership/role.
grant execute on function public.assign_task(uuid, uuid, date) to authenticated;
grant execute on function public.start_task(uuid) to authenticated;
grant execute on function public.submit_task(uuid, text) to authenticated;
grant execute on function public.review_task(uuid, boolean, text) to authenticated;
grant execute on function public.set_demand_status(uuid, public.demand_status) to authenticated;
grant execute on function public.cancel_demand(uuid, text) to authenticated;
