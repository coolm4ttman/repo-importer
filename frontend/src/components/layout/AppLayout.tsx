import { Outlet, Link, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FolderOpen,
  FileCode,
  BarChart3,
  Zap,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "All Projects", icon: FolderOpen, path: "/projects" },
];

const PROJECT_NAV = [
  { label: "Overview", icon: FileCode, path: "" },
  { label: "Dashboard", icon: BarChart3, path: "/dashboard" },
  { label: "Batch Migration", icon: Zap, path: "/batch" },
  { label: "AI Assistant", icon: Sparkles, path: "/assistant" },
];

export function AppLayout() {
  const { id } = useParams();
  const location = useLocation();

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => fetch("/api/v1/health").then(r => r.ok ? r.json() as Promise<{ status: string; version: string }> : Promise.reject()),
    refetchInterval: 30_000,
    retry: 1,
  });

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <img src="/reforge-logo.png" alt="Reforge" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg" style={{ fontFamily: "'Crimson Text', serif" }}>Reforge AI</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          {id && (
            <>
              <div className="h-px bg-border my-3" />
              <div className="px-3 mb-2">
                <Link
                  to="/projects"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back to projects
                </Link>
              </div>
              {PROJECT_NAV.map((item) => {
                const fullPath = `/projects/${id}${item.path}`;
                const active = location.pathname === fullPath;
                return (
                  <Link
                    key={item.path}
                    to={fullPath}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <span className={cn(
              "size-2 rounded-full",
              healthQuery.isSuccess ? "bg-emerald-500" : healthQuery.isLoading ? "bg-amber-500 animate-pulse" : "bg-red-500"
            )} />
            <span className="text-xs text-muted-foreground">
              {healthQuery.isSuccess ? `v${healthQuery.data?.version}` : healthQuery.isLoading ? "Connecting..." : "Offline"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
