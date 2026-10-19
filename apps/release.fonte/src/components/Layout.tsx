import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-title">Fonte de Misericórdia</span>
          <span className="brand-subtitle">Versões da plataforma</span>
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <NavLink to="/" end>
            Início
          </NavLink>
          <NavLink to="/changelog">Changelog</NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
