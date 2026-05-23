# Story 10 — Configurações como Submenu na Sidebar

## Contexto

A página `/settings` usa navegação interna própria (menu lateral esquerdo dentro da page). O resultado é dupla navegação: sidebar principal + nav interno da settings page. A UX fica inconsistente com o restante do app.

**Objetivo:** mover os itens de navegação de Configurações para um submenu expansível diretamente na sidebar principal (`AppLayout`). A `SettingsPage` deixa de ter nav interno e passa a ser apenas um `<Outlet />`.

---

## Estado Atual

### `AppLayout.tsx` — sidebar
```
Dashboard
Casas
Filhos
Servos
Grupos de Apoio
Configurações  →  /settings  (link único)
```

### `SettingsPage.tsx` — nav interno
```
Templates de documentos  →  /settings/templates
Permissões               →  /settings/permissions
App para filhos          →  /settings/app-filhos
```

---

## Estado Desejado

### `AppLayout.tsx` — sidebar com submenu
```
Dashboard
Casas
Filhos
Servos
Grupos de Apoio
▾ Configurações          (expansível; expande se rota começa com /settings)
    Templates de documentos  →  /settings/templates
    Permissões               →  /settings/permissions
    App para filhos          →  /settings/app-filhos
```

### `SettingsPage.tsx`
Remove nav interno. Renderiza apenas `<Outlet />` (ou remove a page e achata as rotas diretamente no router).

---

## Comportamento do Submenu

| Condição | Estado |
|---|---|
| Rota atual começa com `/settings` | Submenu aberto automaticamente |
| Usuário clica em "Configurações" | Toggle: abre/fecha submenu |
| Usuário clica num item filho | Fecha sidebar mobile; submenu permanece aberto |
| Rota muda para fora de `/settings` | Submenu fecha |

> Usar `useLocation` + `pathname.startsWith('/settings')` para controlar abertura automática.

---

## Arquivos Críticos

| Arquivo | Mudança |
|---|---|
| `apps/adm.fonte/src/components/layout/AppLayout.tsx` | Adicionar estado `settingsOpen`, render do submenu expansível com os 3 itens filhos |
| `apps/adm.fonte/src/features/settings/pages/SettingsPage.tsx` | Remover `<nav>` interno e `NAV_ITEMS`. Manter apenas redirect `/settings` → `/settings/templates` + `<Outlet />` (ou remover a page e aplainar rotas) |

---

## Implementação — `AppLayout.tsx`

### Novo estado
```ts
const location = useLocation();
const [settingsOpen, setSettingsOpen] = useState(
  location.pathname.startsWith('/settings')
);
```

Sincronizar com rota (fechar ao sair de `/settings`):
```ts
useEffect(() => {
  if (!location.pathname.startsWith('/settings')) {
    setSettingsOpen(false);
  }
}, [location.pathname]);
```

### Render do submenu

Substituir o `<Link to="/settings">` atual por:

```tsx
{isAdminOrCoordinator && (
  <div>
    <button
      onClick={() => setSettingsOpen((v) => !v)}
      className={cn(navLinkClass, 'w-full justify-between')}
    >
      <span className="flex items-center gap-3">
        <Settings size={16} />
        Configurações
      </span>
      <ChevronDown
        size={14}
        className={cn('transition-transform', settingsOpen && 'rotate-180')}
      />
    </button>

    {settingsOpen && (
      <div className="ml-6 mt-1 space-y-1">
        <NavLink to="/settings/templates" onClick={closeSidebar} className={subNavLinkClass}>
          Templates de documentos
        </NavLink>
        <NavLink to="/settings/permissions" onClick={closeSidebar} className={subNavLinkClass}>
          Permissões
        </NavLink>
        <NavLink to="/settings/app-filhos" onClick={closeSidebar} className={subNavLinkClass}>
          App para filhos
        </NavLink>
      </div>
    )}
  </div>
)}
```

### Novo `subNavLinkClass`

```ts
const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block px-3 py-1.5 rounded-md text-sm transition-colors',
    isActive
      ? 'bg-accent font-medium text-foreground'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
  );
```

> Importar `ChevronDown` e `NavLink` além dos ícones já existentes.

---

## Implementação — `SettingsPage.tsx`

Duas opções (escolher a mais simples):

### Opção A — manter page mínima (recomendada)

```tsx
import { Outlet, Navigate, useLocation } from 'react-router-dom';

export function SettingsPage() {
  const { pathname } = useLocation();
  if (pathname === '/settings' || pathname === '/settings/') {
    return <Navigate to="/settings/templates" replace />;
  }
  return <Outlet />;
}
```

### Opção B — remover `SettingsPage` e achatar rotas no router

No arquivo de rotas, mover `DocumentTemplatesPage`, `PermissionsPage`, `ChildAppSettingsPage` como filhos diretos de `/settings` sem wrapper page.

---

## Checklist

- [ ] `ChevronDown` importado de `lucide-react` em `AppLayout.tsx`
- [ ] `NavLink` importado de `react-router-dom` em `AppLayout.tsx`
- [ ] `useEffect` sincroniza `settingsOpen` com mudança de rota
- [ ] Submenu abre automaticamente ao navegar para `/settings/*` por link externo (ex: deep link)
- [ ] `SettingsPage.tsx` sem nav interno
- [ ] Sidebar mobile fecha ao clicar num item filho (`onClick={closeSidebar}`)
- [ ] Item ativo destaca corretamente (`NavLink` com `isActive`)
- [ ] Sem regressão em outras rotas da sidebar

---

## Sem mudança de backend

Mudança puramente de UI/navegação. Nenhum endpoint, DTO, migration ou tipo novo.
