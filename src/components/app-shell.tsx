import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Building2, FolderKanban, LayoutGrid, LogOut, Menu, Scale, UserCircle2, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useCurrentMember } from "@/hooks/use-current-member";

const nav = [
  { to: "/painel", label: "Painel", icon: LayoutGrid },
  { to: "/demandas", label: "Demandas", icon: FolderKanban },
  { to: "/clientes", label: "Clientes", icon: Building2 },
  { to: "/equipe", label: "Equipe", icon: Users },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-3">
      {nav.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: true }}
          className="flex min-h-11 items-center gap-3 rounded-field px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          activeProps={{ className: "bg-accent !text-primary font-medium" }}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-field bg-accent text-primary">
        <Scale className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="font-display text-base font-bold leading-tight">ANA</p>
        <p className="truncate text-xs text-muted-foreground">A Nova Advocacia</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const member = useCurrentMember();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex min-h-screen w-full bg-deepest">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-deepest md:flex">
        <Brand />
        <NavLinks />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-deepest/80" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col border-r bg-deepest">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="grid h-11 w-11 place-items-center rounded-field hover:bg-elevated">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-background bg-app-aurora">
        <header className="flex h-16 items-center justify-between gap-3 border-b px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="grid h-11 w-11 place-items-center rounded-field hover:bg-elevated md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-sm text-muted-foreground">
              {member.isLoading ? "Carregando…" : member.data?.officeName ?? "Sem escritório vinculado"}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium">{member.data?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{member.data?.role ? roleLabel[member.data.role] : "Sem perfil de acesso"}</p>
            </div>
            <button onClick={signOut} aria-label="Sair" title="Sair" className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-elevated hover:text-foreground">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 md:px-8">
          {member.isLoading || !member.data && !member.isError ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : member.data && !member.data.officeId ? (
            <EmptyState icon={UserCircle2} title="Acesso pendente" description="Sua conta ainda não está vinculada a um escritório. Peça ao administrador para adicioná-lo à equipe." />
          ) : member.isError ? (
            <EmptyState icon={UserCircle2} title="Não foi possível carregar seu perfil" description="Tente recarregar a página." />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: typeof LayoutGrid; title: string; description: string }) {
  return (
    <div className="surface-card flex flex-col items-center px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-field bg-accent text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
