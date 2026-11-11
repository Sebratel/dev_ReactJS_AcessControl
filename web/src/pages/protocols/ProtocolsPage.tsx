import { ProtocolQueue } from '../../components/protocols/ProtocolQueue';

/** Fila de protocolos — o título fica no topo (como na logisticDashboard). */
export default function ProtocolsPage() {
  return (
    <main className="page">
      <ProtocolQueue />
    </main>
  );
}
