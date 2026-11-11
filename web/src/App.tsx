import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_PATH, COVER_PATH, LOG_PATH, PEOPLE_PATH, PROTOCOLS_PATH } from './components/layout/pages';
import { RootLayout } from './components/layout/RootLayout';
import { ErrorState, LoadingState } from './components/ui/States';
import { useSession } from './context/SessionContext';
import LoginPage from './pages/login/LoginPage';

// cada tela num pedaço próprio do bundle
const CoverPage = lazy(() => import('./pages/cover/CoverPage'));
const ProtocolsPage = lazy(() => import('./pages/protocols/ProtocolsPage'));
const PlatformPage = lazy(() => import('./pages/platform/PlatformPage'));
const PeoplePage = lazy(() => import('./pages/people/PeoplePage'));
const PersonPage = lazy(() => import('./pages/people/PersonPage'));
const LogPage = lazy(() => import('./pages/log/LogPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

export default function App() {
  const { user, loading, bootError, config } = useSession();

  if (loading) return <LoadingState label="Carregando sessão…" className="min-h-dvh" />;
  if (!user) {
    // sem configuração nenhuma: o servidor está fora
    if (bootError && !config) return <div className="grid min-h-dvh place-items-center p-4"><ErrorState message={bootError} /></div>;
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path={COVER_PATH} element={<CoverPage />} />
        <Route path={PROTOCOLS_PATH} element={<ProtocolsPage />} />
        <Route path="/plataformas/:slug" element={<PlatformPage />} />
        <Route path={PEOPLE_PATH} element={<PeoplePage />} />
        <Route path={`${PEOPLE_PATH}/:id`} element={<PersonPage />} />
        <Route path={LOG_PATH} element={<LogPage />} />
        <Route path={ADMIN_PATH} element={<AdminPage />} />
        <Route path="*" element={<Navigate to={COVER_PATH} replace />} />
      </Route>
    </Routes>
  );
}
