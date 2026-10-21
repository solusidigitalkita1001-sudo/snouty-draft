/** Papan prospek 5A (P26-05). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { ProspectBoard } from '../../../components/dashboard/prospect-dashboard';

export default function Page() {
  return (
    <DashboardShell section="prospects">
      <ProspectBoard />
    </DashboardShell>
  );
}
