# Phase 2 — Database schema and authorization plan (no SQL executed yet)

## Current database state (verified from project metadata)
- No application tables, no triggers, no storage buckets.
- A function `rls_auto_enable()` exists (an event trigger that turns RLS on for new public tables). RLS being ON only means "deny by default" — it grants nothing. Every table below still gets explicit policies and GRANTs, and every migration will explicitly run `ENABLE ROW LEVEL SECURITY` so we don't depend on that trigger.
- After the migration, the Supabase linter plus direct queries (as each role and as anonymous) will confirm actual behavior.

## Key design decisions
1. **Roles live in a separate table** (`office_members`), never on `profiles`. A user cannot edit their own role, which blocks privilege escalation. This is the one supporting table added beyond your list.
2. **Tenant isolation**: every business row carries `office_id`. Policies check "is the current user a member of this row's office?" through a `SECURITY DEFINER` helper function (avoids recursive RLS).
3. **Workflow changes only through database functions (RPCs)**. Users can edit descriptive fields (title, description) directly, but `status`, approvals, assignments and cancellation go through functions that check role + valid transition and write history in the same transaction. Column-level GRANTs remove direct UPDATE on `status` columns.
4. **History is append-only**: no INSERT/UPDATE/DELETE grants for app users; rows are written only by triggers/RPCs.

## Enums
- `office_role`: `admin`, `coordinator`, `lawyer`
- `demand_status`: `nova`, `em_andamento`, `em_revisao`, `concluida`, `cancelada`
- `task_status`: `pendente`, `em_andamento`, `em_revisao`, `correcao`, `concluida`
- `priority`: `baixa`, `media`, `alta`, `urgente`

## Tables

### offices — law firms (tenants)
`id uuid PK`, `name text NOT NULL`, `created_at`, `updated_at`.

### profiles — public user info
`id uuid PK → auth.users(id) ON DELETE CASCADE`, `full_name text NOT NULL`, `email text NOT NULL`, timestamps. Created automatically by a trigger on sign-up.

### office_members — membership + role (authorization source)
`id PK`, `office_id → offices CASCADE`, `user_id → profiles CASCADE`, `role office_role NOT NULL`, `active bool default true`, timestamps. `UNIQUE(office_id, user_id)`; index on `user_id`.

### teams — groups inside an office
`id PK`, `office_id → offices CASCADE`, `name text NOT NULL`, timestamps. `UNIQUE(office_id, name)`.

### team_members
`id PK`, `team_id → teams CASCADE`, `user_id → profiles CASCADE`, `created_at`. `UNIQUE(team_id, user_id)`. A trigger ensures the user is a member of the team's office.

### clients — fictitious clients
`id PK`, `office_id → offices CASCADE`, `name text NOT NULL`, `document text` (CPF/CNPJ, synthetic), `email`, `phone`, `notes`, timestamps. Index `(office_id, name)`.

### demands
`id PK`, `office_id → offices`, `client_id → clients RESTRICT`, `title NOT NULL`, `description`, `priority NOT NULL default media`, `status demand_status default nova`, `responsible_id → profiles`, `team_id → teams NULL`, `due_date date`, `cancel_reason text`, `created_by → profiles`, timestamps. Indexes: `(office_id, status)`, `responsible_id`, `client_id`. Trigger checks client, team and responsible belong to the same office. CHECK: `status <> 'cancelada' OR cancel_reason IS NOT NULL`.

### tasks
`id PK`, `office_id` (copied from demand by trigger), `demand_id → demands CASCADE`, `title NOT NULL`, `description`, `assignee_id → profiles NOT NULL`, `due_date date NOT NULL`, `required bool default true`, `status task_status default pendente`, `submission_note text`, `review_comment text`, `submitted_at`, `reviewed_by`, `reviewed_at`, timestamps. Indexes: `demand_id`, `(office_id, assignee_id, status)`, `due_date`.

### demand_history — audit log
`id bigint identity PK`, `office_id`, `demand_id → demands CASCADE`, `task_id → tasks SET NULL`, `actor_id → profiles`, `action text NOT NULL` (e.g. `demand_created`, `status_changed`, `task_assigned`, `task_submitted`, `task_rejected`, `task_approved`, `demand_cancelled`), `details jsonb` (from/to, comment, reason), `created_at`. Index `(demand_id, created_at)`.

```text
offices ─┬─< office_members >── profiles
         ├─< teams ─< team_members >── profiles
         ├─< clients ─< demands ─< tasks
         └─────────────── demands ─< demand_history
```

## Role-permission matrix (inside the user's own office only)

| Action | Admin/Partner | Coordinator | Lawyer |
|---|---|---|---|
| View office, members, teams, profiles | Yes | Yes | Yes |
| Manage members/roles, teams | Yes | No | No |
| View / create / edit clients | Yes | Yes (view/create/edit) | View |
| Delete clients (no demands) | Yes | No | No |
| View demands & tasks | All | All | Demands where responsible or has an assigned task; only those tasks + sibling tasks of that demand |
| Create / edit demand details | Yes | Yes | No |
| Assign demand responsible | Yes | Yes | No |
| Create tasks, set assignee & deadline | Yes | Yes | No |
| Start / submit own task for review | Own tasks | Own tasks | Own tasks |
| Approve / reject task (comment required to reject) | Yes, not own task | Yes, not own task | No |
| Complete demand | Yes | Yes | No |
| Cancel demand (reason required) | Yes | Yes | No |
| Read history | Visible demands | Visible demands | Visible demands |
| Modify / delete history | Nobody | Nobody | Nobody |

## Helper functions (SECURITY DEFINER, fixed search_path)
- `is_office_member(office_id)` → bool
- `office_role_of(office_id)` → role of `auth.uid()`
- `has_office_role(office_id, roles office_role[])` → bool
- `can_view_demand(demand_id)` → bool (applies the lawyer visibility rule)

## Workflow RPCs (validate role + transition, write history atomically)
- `assign_task(task_id, assignee_id, due_date)` — admin/coordinator; assignee must be office member.
- `start_task(task_id)` — assignee; `pendente|correcao → em_andamento`.
- `submit_task(task_id, note)` — assignee; `em_andamento|correcao → em_revisao`; sets demand to `em_revisao` if all required tasks are submitted/completed.
- `review_task(task_id, approve bool, comment)` — admin/coordinator, reviewer ≠ assignee; `em_revisao → concluida` or `→ correcao` (comment mandatory).
- `set_demand_status(demand_id, status)` — admin/coordinator; `concluida` is rejected unless every required task is `concluida` (all approved). Cannot leave `concluida`/`cancelada`.
- `cancel_demand(demand_id, reason)` — admin/coordinator; reason mandatory.
- Triggers: auto-create profile on sign-up; set `updated_at`; history entries on demand creation, responsible change, task creation.

## RLS policies (all `TO authenticated`; anon gets no grants at all)
- **offices**: select if member; update if admin. Insert/delete: none (done by setup script).
- **profiles**: select self or anyone sharing an office; update own `full_name` only.
- **office_members**: select if member of that office; insert/update/delete if admin of that office, and an admin cannot remove or demote themselves (protects against an office with no admin).
- **teams / team_members**: select if member; write if admin.
- **clients**: select if member; insert/update if admin/coordinator; delete if admin.
- **demands**: select if `can_view_demand`; insert/update (non-status columns) if admin/coordinator; delete: none (use cancel).
- **tasks**: select if can view parent demand (lawyers: their demands); insert if admin/coordinator; update of `title/description/submission_note` by assignee or admin/coordinator; `status`, review and assignee columns are not directly updatable (RPCs only); delete if admin/coordinator and task not completed.
- **demand_history**: select if `can_view_demand`; no insert/update/delete grants at all.

## Security risks needing attention
- **Recursive RLS** on `office_members` → solved with SECURITY DEFINER helpers.
- **SECURITY DEFINER RPCs bypass RLS** → each one must re-check `auth.uid()` membership and role itself; will be covered by tests.
- **Cross-office references** (e.g., a demand pointing to another office's client) → same-office validation triggers.
- **Self-approval** → RPC rejects when reviewer = assignee, even for admins.
- **Status bypass via direct UPDATE** → column-level GRANTs exclude status columns.
- **Profile data leakage** → profiles visible only to users sharing an office.
- **Sign-up**: public sign-up would create users without an office (they would see nothing). Recommendation: disable public sign-up in Supabase and create test accounts via the seed step.
- **Service-role key** stays server-only; the frontend uses only the publishable key.

## Verification after the migration (Phase 7 detail, partially now)
- Run the Supabase linter.
- Run direct queries as a lawyer from office A against office B's data (expect 0 rows), anonymous access (expect denial), lawyer calling `review_task` (expect error), completing a demand with a pending task (expect error), and UPDATE/DELETE on `demand_history` (expect denial).

## Delivery
One migration with: enums, tables, GRANTs, RLS enabled, policies, helper functions, RPCs and triggers. SQL is also saved under `supabase/migrations/` for documentation. Demo data comes later in a separate step.
