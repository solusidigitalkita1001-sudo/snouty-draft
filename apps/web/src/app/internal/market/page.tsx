/** Pasar: agregat kebutuhan tanpa identitas (P26-07). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { MarketPanel } from '../../../components/dashboard/market-panel';

export default function Page() {
  return (
    <DashboardShell section="market">
      <MarketPanel />
    </DashboardShell>
  );
}
