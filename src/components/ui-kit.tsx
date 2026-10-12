import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useCurrentMember } from "@/hooks/use-current-member";
import { cn } from "@/lib/utils";

export function useMe() {
  const { data } = useCurrentMember();
  // AppShell renders pages only after the member (with office) is loaded.
  const me = data!;
  const officeId = me.officeId!;
  const isManager = me.role === "admin" || me.role === "coordinator";
  return { ...me, officeId, isManager, isAdmin: me.role === "admin" };
}

export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string | undefined }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-field border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10" role="dialog" aria-modal="true" aria-label={title}>
      <button className="fixed inset-0 bg-deepest/80" aria-label="Fechar" onClick={onClose} />
      <div className="surface-card relative w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-field hover:bg-elevated">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoadingBlock() {
  return <div className="surface-card px-6 py-12 text-center text-sm text-muted-foreground">Carregando…</div>;
}
