import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar, MobileTopbar } from "@/components/app-sidebar";
import { getStoredSeller, refreshSeller } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!getStoredSeller()) {
      throw redirect({ to: "/login" });
    }
    // Revalida a sessão e o acesso no servidor (cookie assinado httpOnly).
    // Os dados em si também são bloqueados no servidor se o acesso não estiver ativo.
    const seller = await refreshSeller().catch(() => null);
    if (!seller) {
      throw redirect({ to: "/login" });
    }
    if (seller.access?.status !== "active") {
      throw redirect({ to: "/sem-acesso" });
    }
    return { seller };
  },
  component: Layout,
});

function Layout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
