/** Prospek yang ditugaskan ke sales dan ringkasannya (P26-06). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { SalesDashboard } from '../../../components/dashboard/sales-dashboard';

export default function Page() {
  return (
    <DashboardShell section="leads">
      <SalesDashboard />
    </DashboardShell>
  );
}
