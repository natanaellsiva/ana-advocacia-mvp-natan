import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ANA — A Nova Advocacia" },
      { name: "description", content: "Gestão de demandas e tarefas para escritórios de advocacia." },
      { property: "og:title", content: "ANA — A Nova Advocacia" },
      { property: "og:description", content: "Gestão de demandas e tarefas para escritórios de advocacia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/painel" : "/auth", replace: true });
  },
  component: () => null,
});
