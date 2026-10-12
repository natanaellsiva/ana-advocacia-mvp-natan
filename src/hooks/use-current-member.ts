import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OfficeRole = "admin" | "coordinator" | "lawyer";

export const roleLabel: Record<OfficeRole, string> = {
  admin: "Administrador",
  coordinator: "Coordenador",
  lawyer: "Advogado",
};

export const currentMemberQuery = queryOptions({
  queryKey: ["current-member"],
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Sessão expirada");
    const userId = auth.user.id;

    const [profileRes, memberRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle(),
      supabase
        .from("office_members")
        .select("office_id, role, active, offices(name)")
        .eq("user_id", userId)
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (memberRes.error) throw memberRes.error;

    const m = memberRes.data as { office_id: string; role: OfficeRole; offices: { name: string } | null } | null;
    return {
      userId,
      email: profileRes.data?.email ?? auth.user.email ?? "",
      fullName: profileRes.data?.full_name ?? auth.user.email ?? "",
      officeId: m?.office_id ?? null,
      officeName: m?.offices?.name ?? null,
      role: (m?.role ?? null) as OfficeRole | null,
    };
  },
  staleTime: 60_000,
});

export function useCurrentMember() {
  return useQuery(currentMemberQuery);
}
