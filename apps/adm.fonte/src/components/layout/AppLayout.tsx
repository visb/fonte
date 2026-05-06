import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Role } from "@fonte/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { logout, role } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdminOrCoordinator = role === Role.ADMIN || role === Role.COORDINATOR;

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkClass =
    "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors";

  return (
    <div className="flex h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r bg-card flex flex-col transition-transform duration-200",
          "md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold">adm.fonte</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSidebar}
              className="md:hidden"
              aria-label="Fechar menu"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link to="/" onClick={closeSidebar} className={navLinkClass}>
            <Home size={16} />
            Dashboard
          </Link>
          {isAdminOrCoordinator && (
            <Link to="/houses" onClick={closeSidebar} className={navLinkClass}>
              <Building2 size={16} />
              Casas
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link
              to="/residents"
              onClick={closeSidebar}
              className={navLinkClass}
            >
              <Users size={16} />
              Filhos
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link to="/staff" onClick={closeSidebar} className={navLinkClass}>
              <UserCog size={16} />
              Servos
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link
              to="/ministries"
              onClick={closeSidebar}
              className={navLinkClass}
            >
              <Briefcase size={16} />
              Ministérios
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link
              to="/settings"
              onClick={closeSidebar}
              className={navLinkClass}
            >
              <Settings size={16} />
              Configurações
            </Link>
          )}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center h-14 px-4 border-b md:hidden shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </Button>
          <span className="ml-2 text-base font-bold">adm.fonte</span>
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
