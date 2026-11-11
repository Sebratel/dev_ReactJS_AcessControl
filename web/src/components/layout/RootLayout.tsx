import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useNewProtocolAlerts } from '../../hooks/useNewProtocolAlerts';
import { LoadingState } from '../ui/States';
import { TopBar } from './TopBar';

/**
 * Shell igual ao da logisticDashboard: topo (com as abas) e a tela abaixo.
 * Cada tela monta o próprio `<main className="page">`.
 */
export function RootLayout() {
  useNewProtocolAlerts();
  return (
    <>
      <TopBar />
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
    </>
  );
}
