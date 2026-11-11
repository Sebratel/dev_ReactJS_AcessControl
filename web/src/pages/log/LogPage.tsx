import { EventLog } from '../../components/events/EventLog';

/** Log de adições e remoções — o título fica no topo (como na logisticDashboard). */
export default function LogPage() {
  return (
    <main className="page">
      <EventLog />
    </main>
  );
}
