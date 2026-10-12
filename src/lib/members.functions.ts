import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { officeId: string; email: string; fullName: string; role: "admin" | "coordinator" | "lawyer"; password: string };

export const addOfficeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    const email = String(input.email ?? "").trim().toLowerCase();
    const fullName = String(input.fullName ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw new Error("E-mail inválido.");
    if (!fullName || fullName.length > 120) throw new Error("Informe o nome completo.");
    if (!["admin", "coordinator", "lawyer"].includes(input.role)) throw new Error("Papel inválido.");
    if (!/^[0-9a-f-]{36}$/i.test(String(input.officeId))) throw new Error("Escritório inválido.");
    return { officeId: input.officeId, email, fullName, role: input.role, password: String(input.password ?? "") };
  })
  .handler(async ({ data, context }) => {
    // Caller must be an admin of this office (checked as the caller, under RLS).
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_office_role", {
      _office_id: data.officeId,
      _roles: ["admin"],
    });
    if (roleErr || !isAdmin) throw new Error("Apenas administradores podem adicionar membros.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();

    let userId = existing?.id;
    let created = false;
    if (!userId) {
      if (data.password.length < 8) throw new Error("A senha provisória precisa ter ao menos 8 caracteres.");
      const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error || !u.user) throw new Error("Não foi possível criar a conta: " + (error?.message ?? ""));
      userId = u.user.id;
      created = true;
    }

    // Membership is written as the admin, so the RLS policies still apply.
    const { error: insErr } = await context.supabase
      .from("office_members")
      .upsert({ office_id: data.officeId, user_id: userId, role: data.role, active: true }, { onConflict: "office_id,user_id" });
    if (insErr) throw new Error(insErr.message);
    return { created };
  });
