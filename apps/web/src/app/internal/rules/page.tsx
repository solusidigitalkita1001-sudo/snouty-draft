/** Validasi aturan teknik (P31-82). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { RuleBoardPanel } from '../../../components/dashboard/rule-board';

export default function Page() {
  return (
    <DashboardShell section="rules">
      <RuleBoardPanel />
    </DashboardShell>
  );
}
