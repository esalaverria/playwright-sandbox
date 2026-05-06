import { ChevronRight } from 'lucide-react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const ROUTE_LABELS: Record<string, string> = {
  accounts: 'Accounts',
  activity: 'Activity',
  transfer: 'Transfer',
  payees: 'Payees',
  bills: 'Bill pay',
  statements: 'Statements',
  messages: 'Messages',
  cards: 'Cards',
  profile: 'Profile',
};

function looksLikeCuid(segment: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(segment);
}

export function PageBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: { to: string; label: string; last?: boolean }[] = [{ to: '/', label: 'Dashboard' }];

  if (pathname === '/' && segments.length === 0) {
    return (
      <nav className="mb-4 text-sm" aria-label="Breadcrumb">
        <span className="font-semibold text-foreground">Dashboard</span>
      </nav>
    );
  }

  let acc = '';
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === segments.length - 1;
    const label = looksLikeCuid(seg)
      ? 'Account'
      : ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ to: acc, label, last: isLast });
  });

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((c, idx) =>
        c.last ? (
          <span key={`${c.to}-${idx}`} className="font-semibold text-foreground">
            {c.label}
          </span>
        ) : (
          <span key={`${c.to}-${idx}`} className="flex items-center gap-1">
            <RouterLink to={c.to} className="font-medium text-indigo-600 hover:underline">
              {c.label}
            </RouterLink>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted opacity-70" aria-hidden />
          </span>
        ),
      )}
    </nav>
  );
}
