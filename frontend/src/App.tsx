import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Skeleton, Stack } from '@mui/material';
import { api } from './api/client';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { TransferPage } from './pages/TransferPage';
import { ProfilePage } from './pages/ProfilePage';
import { PayeesPage } from './pages/PayeesPage';
import { BillsPage } from './pages/BillsPage';
import { StatementsPage } from './pages/StatementsPage';
import { MessagesPage } from './pages/MessagesPage';
import { CardsPage } from './pages/CardsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ActivityPage } from './pages/ActivityPage';

function useSession() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{ user: { id: string; email: string; fullName: string } | null }>(
        '/auth/me',
      );
      return data.user;
    },
    retry: false,
  });
}

function ProtectedLayout() {
  const { data: user, isLoading, isError } = useSession();

  if (isLoading) {
    return (
      <Box
        data-testid="session-loading"
        sx={{
          p: 4,
          minHeight: '60vh',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.light}33 0%, ${t.palette.secondary.light}22 100%)`,
        }}
      >
        <Stack spacing={2} maxWidth={560} sx={{ mx: 'auto' }}>
          <Skeleton variant="rounded" height={56} sx={{ borderRadius: 3 }} animation="wave" />
          <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} animation="wave" />
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} animation="wave" />
        </Stack>
      </Box>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout user={user}>
      <Outlet />
    </AppLayout>
  );
}


export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:id" element={<AccountPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/transfer" element={<TransferPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/payees" element={<PayeesPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/statements" element={<StatementsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/cards" element={<CardsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
