import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Plus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";
import { Badge, Field, FormError, LoadingBlock, Modal, useMe } from "@/components/ui-kit";
import { roleLabel, type OfficeRole } from "@/hooks/use-current-member";
import { supabase } from "@/integrations/supabase/client";
import { addOfficeMember } from "@/lib/members.functions";
import { btnGhost, fieldClass, friendlyDbError, membersQuery, teamsQuery } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — ANA" },
      { name: "description", content: "Membros da equipe e papéis no escritório." },
      { property: "og:title", content: "Equipe — ANA" },
      { property: "og:description", content: "Membros da equipe e papéis no escritório." },
    ],
  }),
  component: () => (
    <AppShell>
      <TeamPage />
    </AppShell>
  ),
});

const roles: OfficeRole[] = ["admin", "coordinator", "lawyer"];

function TeamPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const members = useQuery(membersQuery(me.officeId));
  const teams = useQuery(teamsQuery(me.officeId));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members", me.officeId] });
    qc.invalidateQueries({ queryKey: ["teams", me.officeId] });
  };

  const updateMember = useMutation({
    mutationFn: async (v: { id: string; role?: OfficeRole; active?: boolean }) => {
      const { error } = await supabase.from("office_members").update({ ...(v.role && { role: v.role }), ...(v.active !== undefined && { active: v.active }) }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Membro atualizado."); },
    onError: (e) => toast.error(friendlyDbError(e)),
  });

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Membros do escritório, papéis e times de trabalho."
        action={me.isAdmin && <button className="btn-cta" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Adicionar membro</button>}
      />

      <section aria-labelledby="members-h" className="mb-10">
        <h2 id="members-h" className="mb-3 text-lg font-semibold">Membros</h2>
        {members.isLoading ? <LoadingBlock /> : members.error ? (
          <EmptyState icon={Users} title="Erro ao carregar membros" description={friendlyDbError(members.error)} />
        ) : (
          <div className="surface-card overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3 font-medium">Nome</th><th className="px-5 py-3 font-medium">Papel</th><th className="px-5 py-3 font-medium">Situação</th>{me.isAdmin && <th className="px-5 py-3 font-medium text-right">Ações</th>}</tr>
              </thead>
              <tbody>
                {members.data?.map((m) => {
                  const self = m.user_id === me.userId;
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-5 py-3"><p className="font-medium">{m.profiles?.full_name}{self && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}</p><p className="text-xs text-muted-foreground">{m.profiles?.email}</p></td>
                      <td className="px-5 py-3">
                        {me.isAdmin && !self ? (
                          <select aria-label={`Papel de ${m.profiles?.full_name}`} className={`${fieldClass} h-9 w-40`} value={m.role} onChange={(e) => updateMember.mutate({ id: m.id, role: e.target.value as OfficeRole })}>
                            {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                          </select>
                        ) : roleLabel[m.role]}
                      </td>
                      <td className="px-5 py-3"><Badge className={m.active ? "bg-success/15 text-success" : "bg-elevated text-muted-foreground"}>{m.active ? "Ativo" : "Inativo"}</Badge></td>
                      {me.isAdmin && (
                        <td className="px-5 py-3 text-right">
                          {!self && <button className={btnGhost} onClick={() => updateMember.mutate({ id: m.id, active: !m.active })}>{m.active ? "Desativar" : "Reativar"}</button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="teams-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="teams-h" className="text-lg font-semibold">Times</h2>
          {me.isAdmin && <NewTeam officeId={me.officeId} onDone={refresh} />}
        </div>
        {teams.isLoading ? <LoadingBlock /> : !teams.data?.length ? (
          <EmptyState icon={Users} title="Nenhum time criado" description={me.isAdmin ? "Crie times para agrupar advogados por área de atuação." : "Os times do escritório aparecerão aqui."} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.data.map((t) => (
              <TeamCard key={t.id} team={t} canEdit={me.isAdmin} members={(members.data ?? []).filter((m) => m.active)} onChange={refresh} />
            ))}
          </div>
        )}
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar membro">
        <AddMemberForm officeId={me.officeId} onDone={() => { setAddOpen(false); refresh(); }} />
      </Modal>
    </>
  );
}

function NewTeam({ officeId, onDone }: { officeId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("teams").insert({ office_id: officeId, name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); onDone(); toast.success("Time criado."); },
    onError: (e) => toast.error(friendlyDbError(e)),
  });
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate(); }}>
      <input aria-label="Nome do novo time" placeholder="Nome do time" maxLength={80} className={`${fieldClass} w-48`} value={name} onChange={(e) => setName(e.target.value)} />
      <button className={btnGhost} disabled={!name.trim() || m.isPending}><Plus className="h-4 w-4" /> Criar</button>
    </form>
  );
}

type Team = { id: string; name: string; team_members: { id: string; user_id: string; profiles: { full_name: string } | null }[] };
type Member = { user_id: string; profiles: { full_name: string } | null };

function TeamCard({ team, canEdit, members, onChange }: { team: Team; canEdit: boolean; members: Member[]; onChange: () => void }) {
  const [pick, setPick] = useState("");
  const inTeam = new Set(team.team_members.map((m) => m.user_id));
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_members").insert({ team_id: team.id, user_id: pick });
      if (error) throw error;
    },
    onSuccess: () => { setPick(""); onChange(); },
    onError: (e) => toast.error(friendlyDbError(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e) => toast.error(friendlyDbError(e)),
  });
  return (
    <div className="surface-card p-5">
      <h3 className="font-semibold">{team.name}</h3>
      <p className="text-xs text-muted-foreground">{team.team_members.length} membro(s)</p>
      <ul className="mt-4 space-y-2">
        {team.team_members.map((tm) => (
          <li key={tm.id} className="flex items-center justify-between gap-2 rounded-field bg-elevated px-3 py-2 text-sm">
            {tm.profiles?.full_name ?? "—"}
            {canEdit && <button aria-label={`Remover ${tm.profiles?.full_name}`} onClick={() => remove.mutate(tm.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
          </li>
        ))}
        {!team.team_members.length && <li className="text-sm text-muted-foreground">Nenhum membro no time.</li>}
      </ul>
      {canEdit && (
        <div className="mt-4 flex gap-2">
          <select aria-label={`Adicionar ao time ${team.name}`} className={fieldClass} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Adicionar membro…</option>
            {members.filter((m) => !inTeam.has(m.user_id)).map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name}</option>)}
          </select>
          <button className={btnGhost} disabled={!pick || add.isPending} onClick={() => add.mutate()}>Adicionar</button>
        </div>
      )}
    </div>
  );
}

function AddMemberForm({ officeId, onDone }: { officeId: string; onDone: () => void }) {
  const addFn = useServerFn(addOfficeMember);
  const [f, setF] = useState({ fullName: "", email: "", role: "lawyer" as OfficeRole, password: "" });
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => addFn({ data: { officeId, ...f } }),
    onSuccess: (r) => { toast.success(r.created ? "Conta criada e adicionada ao escritório." : "Usuário existente adicionado ao escritório."); onDone(); },
    onError: (e) => setErr(friendlyDbError(e)),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.fullName.trim() || !f.email.trim()) return setErr("Informe nome e e-mail.");
    m.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nome completo *" htmlFor="m-name"><input id="m-name" maxLength={120} className={fieldClass} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
      <Field label="E-mail *" htmlFor="m-email"><input id="m-email" type="email" maxLength={255} className={fieldClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Papel" htmlFor="m-role">
        <select id="m-role" className={fieldClass} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as OfficeRole })}>
          {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
        </select>
      </Field>
      <Field label="Senha provisória" htmlFor="m-pass" hint="Obrigatória para novas contas (mín. 8 caracteres). Ignorada se o e-mail já tiver conta.">
        <input id="m-pass" type="password" autoComplete="new-password" className={fieldClass} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <FormError message={err} />
      <button type="submit" className="btn-cta w-full" disabled={m.isPending}>{m.isPending ? "Adicionando…" : "Adicionar membro"}</button>
    </form>
  );
}
