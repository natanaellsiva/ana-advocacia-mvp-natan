import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Building2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";
import { Field, FormError, LoadingBlock, Modal, useMe } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { clientsQuery, fieldClass, friendlyDbError, textareaClass } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ANA" },
      { name: "description", content: "Cadastro de clientes do escritório." },
      { property: "og:title", content: "Clientes — ANA" },
      { property: "og:description", content: "Cadastro de clientes do escritório." },
    ],
  }),
  component: () => (
    <AppShell>
      <ClientsPage />
    </AppShell>
  ),
});

function ClientsPage() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery(clientsQuery(me.officeId));
  const list = (data ?? []).filter((c) =>
    [c.name, c.document, c.email].some((v) => v?.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Clientes associados às demandas do escritório."
        action={me.isManager && <button className="btn-cta" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo cliente</button>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input aria-label="Buscar clientes" placeholder="Buscar por nome, documento ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className={`${fieldClass} pl-9`} />
      </div>
      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState icon={Building2} title="Erro ao carregar clientes" description={friendlyDbError(error)} />
      ) : list.length === 0 ? (
        <EmptyState icon={Building2} title={q ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"} description={me.isManager ? "Cadastre o primeiro cliente para começar a abrir demandas." : "Os clientes cadastrados pelo escritório aparecerão aqui."} />
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-3 font-medium">Nome</th><th className="px-5 py-3 font-medium">CPF/CNPJ</th><th className="px-5 py-3 font-medium">E-mail</th><th className="px-5 py-3 font-medium">Telefone</th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{c.name}{c.notes && <p className="mt-0.5 line-clamp-1 text-xs font-normal text-muted-foreground">{c.notes}</p>}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.document ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo cliente">
        <ClientForm officeId={me.officeId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function ClientForm({ officeId, onDone }: { officeId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", document: "", email: "", phone: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      const clean = (v: string) => v.trim() || null;
      const { error } = await supabase.from("clients").insert({
        office_id: officeId, name: f.name.trim(), document: clean(f.document), email: clean(f.email), phone: clean(f.phone), notes: clean(f.notes),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients", officeId] });
      toast.success("Cliente cadastrado.");
      onDone();
    },
    onError: (e) => setErr(friendlyDbError(e)),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.name.trim()) return setErr("Informe o nome do cliente.");
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr("E-mail inválido.");
    m.mutate();
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nome *" htmlFor="c-name"><input id="c-name" maxLength={160} className={fieldClass} value={f.name} onChange={set("name")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CPF/CNPJ" htmlFor="c-doc"><input id="c-doc" maxLength={20} className={fieldClass} value={f.document} onChange={set("document")} /></Field>
        <Field label="Telefone" htmlFor="c-phone"><input id="c-phone" maxLength={30} className={fieldClass} value={f.phone} onChange={set("phone")} /></Field>
      </div>
      <Field label="E-mail" htmlFor="c-email"><input id="c-email" type="email" maxLength={255} className={fieldClass} value={f.email} onChange={set("email")} /></Field>
      <Field label="Observações" htmlFor="c-notes"><textarea id="c-notes" maxLength={2000} className={textareaClass} value={f.notes} onChange={set("notes")} /></Field>
      <FormError message={err} />
      <button type="submit" className="btn-cta w-full" disabled={m.isPending}>{m.isPending ? "Salvando…" : "Cadastrar cliente"}</button>
    </form>
  );
}
