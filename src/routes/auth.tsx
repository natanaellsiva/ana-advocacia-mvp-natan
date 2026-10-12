import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Search = { redirect?: string | undefined };

function safeRedirect(path?: string) {
  return path && path.startsWith("/") && !path.startsWith("//") && path !== "/auth" ? path : "/painel";
}

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Verifique os dados e tente novamente.";
  if (m.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("fetch") || m.includes("network")) return "Não foi possível conectar ao servidor. Verifique sua conexão.";
  return "Não foi possível entrar. Tente novamente.";
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: safeRedirect(search.redirect), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Entrar — ANA | A Nova Advocacia" },
      { name: "description", content: "Acesse o painel de gestão de demandas do seu escritório." },
      { property: "og:title", content: "Entrar — ANA | A Nova Advocacia" },
      { property: "og:description", content: "Acesse o painel de gestão de demandas do seu escritório." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    navigate({ to: safeRedirect(search.redirect), replace: true });
  }

  const field =
    "mt-1.5 block h-11 w-full rounded-field border bg-elevated px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-app-aurora px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-field bg-accent text-primary">
            <Scale className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Entrar na ANA</h1>
          <p className="mt-1 text-sm text-muted-foreground">A Nova Advocacia — gestão de demandas</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="surface-card space-y-4 p-6">
          <div>
            <label htmlFor="email" className="text-sm font-medium">E-mail</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="voce@escritorio.com.br" aria-invalid={!!error} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Senha</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} aria-invalid={!!error} />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-field border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-cta w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…</> : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          O acesso é criado pelo administrador do escritório.
        </p>
      </div>
    </div>
  );
}
