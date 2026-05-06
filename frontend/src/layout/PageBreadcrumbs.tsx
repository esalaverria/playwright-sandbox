import { Breadcrumbs, Link, Typography } from '@mui/material';
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

  if (pathname === '/' && segments.length === 0) {
    return (
      <Breadcrumbs sx={{ mb: 2 }} aria-label="breadcrumb">
        <Typography color="text.primary" fontWeight={600}>
          Dashboard
        </Typography>
      </Breadcrumbs>
    );
  }

  const crumbs: { to: string; label: string; last?: boolean }[] = [
    { to: '/', label: 'Dashboard' },
  ];

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
    <Breadcrumbs sx={{ mb: 2 }} aria-label="breadcrumb">
      {crumbs.map((c, idx) =>
        c.last ? (
          <Typography key={`${c.to}-${idx}`} color="text.primary" fontWeight={600}>
            {c.label}
          </Typography>
        ) : (
          <Link
            key={`${c.to}-${idx}`}
            component={RouterLink}
            to={c.to}
            underline="hover"
            color="inherit"
            fontWeight={idx === 0 ? 500 : 400}
          >
            {c.label}
          </Link>
        ),
      )}
    </Breadcrumbs>
  );
}
