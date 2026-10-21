/** Tim sales: anggota yang menerima prospek (P26-05). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { TeamPanel } from '../../../components/dashboard/team-panel';

export default function Page() {
  return (
    <DashboardShell section="team">
      <TeamPanel />
    </DashboardShell>
  );
}
