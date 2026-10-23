/** Katalog produk (P29-02). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { CatalogPanel } from '../../../components/dashboard/catalog-panel';

export default function Page() {
  return (
    <DashboardShell section="catalog">
      <CatalogPanel />
    </DashboardShell>
  );
}
