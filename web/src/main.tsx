import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { applyInitialTheme } from './utils/theme';
import './index.css';
import './styles/shell.css';
import './styles/login.css';

// antes do primeiro render: sem isto a tela pisca clara antes de escurecer
applyInitialTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      // com 'always' a falha da API vira erro visível em vez de consulta pausada
      networkMode: 'always',
      staleTime: 15_000,
    },
    mutations: { networkMode: 'always' },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('elemento #root não encontrado');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <SessionProvider>
              <App />
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
