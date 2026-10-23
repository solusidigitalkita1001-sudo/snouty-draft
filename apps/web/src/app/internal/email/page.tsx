/** Peninjauan email (P29-03). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { ToolNote } from '../../../components/dashboard/tool-note';

export default function Page() {
  return (
    <DashboardShell section="email">
      <ToolNote section="email" />
    </DashboardShell>
  );
}
