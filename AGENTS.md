<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Internal pages live under `src/routes/_authenticated/` (client-only gate, redirects to `/auth`); `/` only redirects. Why: the session lives in browser storage, so the server can't check it.
- The signed-in user's office and role come from `office_members` via `src/hooks/use-current-member.ts`; never read roles from user metadata. Why: prevents privilege escalation.
- Database security is enforced by RLS (see `supabase/phase2_schema.sql`); hiding things in the interface is only for convenience. Why: hiding buttons doesn't stop anyone from calling the database directly.
- Pages read and write Supabase directly from the browser (RLS + workflow RPCs enforce the rules); the only server function is adding office members, because creating accounts needs the service key. Why: a single security layer, with no duplicated permission checks.
- Shared data queries, labels and error translations live in `src/lib/domain.ts`. Why: one source for cache keys and Portuguese messages.
