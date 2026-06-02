import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Building2,
  ChevronDown,
  HandHeart,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Receipt,
  Settings,
  Sun,
  UserCircle,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Role } from "@fonte/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinkClass =
  "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors";

const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block px-3 py-1.5 rounded-md text-sm transition-colors",
    isActive
      ? "bg-accent font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
  );

interface SettingsSubmenuProps {
  closeSidebar: () => void;
}

function SettingsSubmenu({ closeSidebar }: SettingsSubmenuProps) {
  const location = useLocation();
  const inSettings = location.pathname.startsWith("/settings");
  const [open, setOpen] = useState(inSettings);

  useEffect(() => {
    if (!location.pathname.startsWith("/settings")) {
      setOpen(false);
    }
  }, [location.pathname]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          navLinkClass,
          "w-full justify-between",
          inSettings && "bg-accent text-foreground font-medium",
        )}
      >
        <span className="flex items-center gap-3">
          <Settings size={16} />
          Configurações
        </span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="ml-6 mt-1 space-y-1">
          <NavLink
            to="/settings/templates"
            onClick={closeSidebar}
            className={subNavLinkClass}
          >
            Templates de documentos
          </NavLink>
          <NavLink
            to="/settings/permissions"
            onClick={closeSidebar}
            className={subNavLinkClass}
          >
            Permissões
          </NavLink>
          <NavLink
            to="/settings/app-filhos"
            onClick={closeSidebar}
            className={subNavLinkClass}
          >
            App para filhos
          </NavLink>
        </div>
      )}
    </div>
  );
}

function FaturamentoSubmenu({ closeSidebar }: SettingsSubmenuProps) {
  const location = useLocation();
  const inBilling = location.pathname.startsWith("/billing");
  const [open, setOpen] = useState(inBilling);

  useEffect(() => {
    if (!location.pathname.startsWith("/billing")) {
      setOpen(false);
    }
  }, [location.pathname]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          navLinkClass,
          "w-full justify-between",
          inBilling && "bg-accent text-foreground font-medium",
        )}
      >
        <span className="flex items-center gap-3">
          <Receipt size={16} />
          Faturamento
        </span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="ml-6 mt-1 space-y-1">
          <NavLink to="/billing/filhos" onClick={closeSidebar} className={subNavLinkClass}>
            Filhos
          </NavLink>
          <NavLink to="/billing/pizza" onClick={closeSidebar} className={subNavLinkClass}>
            Pizza
          </NavLink>
          <NavLink to="/billing/bread" onClick={closeSidebar} className={subNavLinkClass}>
            Pão
          </NavLink>
          <NavLink to="/billing/associados" onClick={closeSidebar} className={subNavLinkClass}>
            Associados
          </NavLink>
        </div>
      )}
    </div>
  );
}

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
            <Link to="/residents" onClick={closeSidebar} className={navLinkClass}>
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
            <Link to="/support-groups" onClick={closeSidebar} className={navLinkClass}>
              <HandHeart size={16} />
              Grupos de Apoio
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link to="/bible-courses" onClick={closeSidebar} className={navLinkClass}>
              <BookOpen size={16} />
              Curso Bíblico
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link to="/messages" onClick={closeSidebar} className={navLinkClass}>
              <MessageSquare size={16} />
              Mensagens
            </Link>
          )}
          {isAdminOrCoordinator && <FaturamentoSubmenu closeSidebar={closeSidebar} />}
          {isAdminOrCoordinator && <SettingsSubmenu closeSidebar={closeSidebar} />}
        </nav>

        <div className="p-4 border-t space-y-1">
          <NavLink
            to="/profile"
            onClick={closeSidebar}
            className={({ isActive }) =>
              cn(
                navLinkClass,
                isActive && "bg-accent text-foreground font-medium",
              )
            }
          >
            <UserCircle size={16} />
            Meu Perfil
          </NavLink>
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
