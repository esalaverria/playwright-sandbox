import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Mail,
  Receipt,
  ReceiptText,
  Shuffle,
  Timeline,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@heroui/react';
import { Badge } from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { PageBreadcrumbs } from './PageBreadcrumbs';

const SIDEBAR_W = 260;

const nav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/activity', label: 'Activity', icon: Timeline },
  { to: '/transfer', label: 'Transfer', icon: Shuffle },
  { to: '/payees', label: 'Payees', icon: Users },
  { to: '/bills', label: 'Bill pay', icon: Receipt },
  { to: '/statements', label: 'Statements', icon: ReceiptText },
  { to: '/messages', label: 'Messages', icon: Mail },
  { to: '/cards', label: 'Cards', icon: CreditCard },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function AppLayout({
  user,
  children,
}: {
  user: { id: string; email: string; fullName: string };
  children?: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hideBalances, toggleHideBalances } = usePrivacy();

  const { data: unread } = useQuery({
    queryKey: ['messages-unread'],
    queryFn: async () => {
      const { data } = await api.get<{ messages: { id: string; readAt: string | null }[] }>('/messages');
      return data.messages.filter((m) => !m.readAt).length;
    },
  });

  async function logout() {
    await api.post('/auth/logout');
    await qc.invalidateQueries({ queryKey: ['me'] });
    navigate('/login');
  }

  function navActive(to: string): boolean {
    if (to === '/') return location.pathname === '/';
    if (to === '/accounts') return location.pathname.startsWith('/accounts');
    return location.pathname.startsWith(to);
  }

  const navItems = nav.map((item) => {
    const active = navActive(item.to);
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
          active ? 'bg-white/15 text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 opacity-95" aria-hidden />
        <span className="flex-1 truncate">{item.label}</span>
        {item.to === '/messages' && unread ? (
          <span className="inline-flex min-w-6 justify-center rounded-full bg-fuchsia-500 px-1.5 py-0 text-[11px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </NavLink>
    );
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f3ff' }}>
      <header className="fixed left-0 right-0 top-0 z-[100] flex h-14 shrink-0 items-center gap-2 border-b border-indigo-900/40 bg-gradient-to-r from-indigo-900 to-purple-900 px-4">
        <h1 className="flex flex-1 text-lg font-bold tracking-tight text-white">NorthPeak</h1>
        <Button
          variant="ghost"
          className="!text-white hover:!bg-white/10"
          isIconOnly
          aria-label="toggle balance privacy"
          onPress={toggleHideBalances}
        >
          {hideBalances ? <EyeOff size={22} strokeWidth={1.75} /> : <Eye size={22} strokeWidth={1.75} />}
        </Button>
        <span className="hidden max-w-[200px] truncate text-sm font-medium text-white/90 sm:inline">{user.fullName}</span>
        <Button
          variant="ghost"
          className="!text-white hover:!bg-white/10"
          isIconOnly
          aria-label="logout"
          onPress={() => void logout()}
        >
          <LogOut size={22} strokeWidth={1.75} />
        </Button>
      </header>

      <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-neutral-200/80 bg-white/90 px-2 py-2 md:hidden">
        {nav.map((item) => {
          const active = navActive(item.to);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold ${
                active ? 'bg-indigo-100 text-indigo-900' : 'text-neutral-700'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
              {item.to === '/messages' && unread ? (
                <Badge variant="primary" size="sm" className="min-w-5 justify-center text-[10px]">
                  {unread}
                </Badge>
              ) : null}
            </NavLink>
          );
        })}
      </div>

      <aside
        className="fixed bottom-0 left-0 top-14 z-30 hidden w-[260px] flex-col overflow-y-auto border-r border-neutral-800/60 bg-neutral-950/70 px-2 py-4 backdrop-blur-md md:flex"
        style={{ width: SIDEBAR_W }}
        aria-label="Sidebar"
      >
        <div className="text-muted px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Menu</div>
        <nav className="flex flex-col gap-0.5">{navItems}</nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-white/45">Signed in as</p>
          <p className="truncate px-3 pb-1 text-xs text-white/80">{user.email}</p>
        </div>
      </aside>

      <main
        className="min-h-[calc(100vh-3.5rem)] px-5 py-6 md:ml-[260px] md:pt-8"
      >
        <PageBreadcrumbs />
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
