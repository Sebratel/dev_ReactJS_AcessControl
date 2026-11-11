import { Clock3, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { SUPPORT_EMAIL } from '../../config';
import { useSession } from '../../context/SessionContext';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.25 1.3-1 2.4-2.1 3.1l3.4 2.6c2-1.8 3.1-4.5 3.1-7.7 0-.75-.07-1.5-.2-2.2H12z" />
      <path fill="#34A853" d="M5.8 14.1l-.9.7-2.5 1.9C4.2 20.8 7.9 23 12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.1 1-3.9 1-3 0-5.5-2-6.4-4.7z" />
      <path fill="#FBBC05" d="M5.5 9.3 2.9 7.1C1.1 10.4 1.1 14.3 2.9 17.6l2.6-2c-.4-1.2-.4-2.5 0-3.7z" />
      <path fill="#4285F4" d="M12 5.8c1.7 0 3.2.6 4.4 1.8l3.3-3.3C16.5 2.1 14.4 1 12 1 7.9 1 4.2 3.2 2.9 7.1l2.6 2C6.5 7.4 9.1 5.8 12 5.8z" />
    </svg>
  );
}

/** Tela de login — a mesma da logisticDashboard, com o texto desta aplicação. */
export default function LoginPage() {
  const { config, signIn, endReason, bootError } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domain = config?.allowedDomain || 'sebratel.com.br';

  const click = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-arte" aria-hidden="true">
        <div className="brilho brilho-1" />
        <div className="brilho brilho-2" />
      </div>
      <div className="login-conteudo">
        <section className="login-marca">
          <div className="login-marca-topo">
            <img src="/logo-circular-sebratel.png" alt="" width={46} height={46} />
            <span>Controle de Acessos</span>
          </div>
          <h2>Protocolos, acessos e permissões <span>dos HUBs, DataHub, AppSheet e UpValue</span></h2>
          <p>Quem tem acesso a quê, com cada liberação e remoção registrada — a fila do Voalle em tempo real</p>
        </section>
        <section className="login-card-wrap">
          <div className="login-card">
            <header>
              <span className="etiqueta">Controle de Acessos</span>
              <h1>Acessar a aplicação</h1>
              <p>Entre com a sua conta Google corporativa.</p>
            </header>
            {endReason === 'EXPIRED' && !error && (
              <div className="login-aviso">
                <div className="icone"><Clock3 size={17} /></div>
                <div>Sua sessão expirou. Entre novamente para continuar.</div>
              </div>
            )}
            <div className="login-aviso">
              <div className="icone"><Lock size={17} /></div>
              <div>
                Domínio liberado: <b>@{domain}</b>
                <span>Não é a sua conta? Saia do Google antes de entrar.</span>
              </div>
            </div>
            {(error || bootError) && (
              <div className="banner error" role="alert"><TriangleAlert size={14} /> {error ?? bootError}</div>
            )}
            <button type="button" className="botao-google" onClick={click} disabled={busy || !config?.clientId}>
              <span className="marca">{busy ? <span className="spin"><RefreshCw size={16} /></span> : <GoogleMark />}</span>
              {busy ? 'Autenticando…' : 'Entrar com Google'}
            </button>
            <p className="login-rodape">
              Problemas para acessar? Fale com <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </div>
        </section>
      </div>
      <footer className="login-barra">
        <Lock size={13} /> Ambiente seguro e monitorado · Inteligência de Dados Sebratel
      </footer>
    </div>
  );
}
