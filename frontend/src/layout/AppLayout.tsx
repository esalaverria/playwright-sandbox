import PersonIcon from '@mui/icons-material/Person';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmailIcon from '@mui/icons-material/Email';
import LogoutIcon from '@mui/icons-material/Logout';
import PaymentIcon from '@mui/icons-material/Payment';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Badge,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const drawerWidth = 260;

const nav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/transfer', label: 'Transfer', icon: <SwapHorizIcon /> },
  { to: '/payees', label: 'Payees', icon: <PeopleIcon /> },
  { to: '/bills', label: 'Bill pay', icon: <PaymentIcon /> },
  { to: '/statements', label: 'Statements', icon: <ReceiptLongIcon /> },
  { to: '/messages', label: 'Messages', icon: <EmailIcon /> },
  { to: '/cards', label: 'Cards', icon: <CreditCardIcon /> },
  { to: '/profile', label: 'Profile', icon: <PersonIcon /> },
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'primary.dark' }}
        elevation={0}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            NorthPeak
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user.fullName}
          </Typography>
          <IconButton color="inherit" onClick={logout} aria-label="logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: 'none' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', px: 1, pt: 2 }}>
          <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', letterSpacing: 1 }}>
            MENU
          </Typography>
          <List>
            {nav.map((item) => (
              <ListItemButton
                key={item.to}
                component={RouterLink}
                to={item.to}
                selected={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
                {item.to === '/messages' && unread ? (
                  <Badge badgeContent={unread} color="secondary" />
                ) : null}
              </ListItemButton>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>
            Signed in as
          </Typography>
          <Typography variant="body2" sx={{ px: 2, mb: 1 }}>
            {user.email}
          </Typography>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: `calc(100% - ${drawerWidth}px)` }}>
        <Toolbar />
        {children ?? <Outlet />}
      </Box>
    </Box>
  );
}
