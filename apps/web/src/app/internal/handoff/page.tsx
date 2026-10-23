/** Antrean teknis (P29-01). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { HandoffQueuePanel } from '../../../components/dashboard/handoff-queue';

export default function Page() {
  return (
    <DashboardShell section="handoff">
      <HandoffQueuePanel />
    </DashboardShell>
  );
}
