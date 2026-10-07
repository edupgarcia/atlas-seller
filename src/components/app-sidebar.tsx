import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useSeller } from "@/hooks/use-seller";
import { logoutSeller } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

// Link só para exibição; a área /admin é protegida no servidor (requireAdmin).
const ADMIN_ITEM = { to: "/admin", label: "Usuários", icon: ShieldCheck } as const;

function getInitials(seller: { name?: string | null; email?: string | null } | null | undefined) {
  return (seller?.name ?? seller?.email ?? "AS")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SidebarBody({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { seller } = useSeller();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const initials = getInitials(seller);

  return (
    <>
      <div className={cn("flex items-center gap-2 py-5", collapsed ? "justify-center px-3" : "px-5")}>
        <div className="h-8 w-8 shrink-0 rounded-md bg-gradient-gold" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">Atlas Seller</p>
            <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              Inteligência de dados
            </p>
          </div>
        )}
      </div>

      {!collapsed ? (
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-gradient-gold text-xs font-bold text-[color:var(--primary-foreground)]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {seller?.name ?? seller?.email ?? "Seller"}
            </p>
            <p className="text-xs text-muted-foreground">Conta Principal</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto mb-3 mt-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-gold text-[10px] font-bold text-[color:var(--primary-foreground)]">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {[...NAV, ...(seller?.access?.is_admin ? [ADMIN_ITEM] : [])].map((n) => {
          const active = pathname.startsWith(n.to);
          const link = (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <n.icon className="h-4 w-4 shrink-0" />
              {!collapsed && n.label}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={n.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{n.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className={cn("space-y-2 border-t border-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full text-muted-foreground"
                aria-label="Sair"
                onClick={() => {
                  logoutSeller();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => {
              logoutSeller();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        )}
      </div>
    </>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("atlas.sidebar.collapsed") === "1";
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("atlas.sidebar.collapsed", next ? "1" : "0");
      }
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
        <SidebarBody collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
}

export function MobileTopbar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-r border-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <TooltipProvider delayDuration={100}>
            <div className="flex h-full flex-col">
              <SidebarBody collapsed={false} onNavigate={() => setOpen(false)} />
            </div>
          </TooltipProvider>
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-gradient-gold" />
        <span className="text-sm font-bold tracking-tight">Atlas Seller</span>
      </div>
    </div>
  );
}
