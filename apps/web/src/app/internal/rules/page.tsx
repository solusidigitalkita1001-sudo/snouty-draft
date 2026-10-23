/** Validasi aturan teknik (P29-03). Akses diperiksa API per peran. */
import { DashboardShell } from '../../../components/dashboard/dashboard-shell';
import { ToolNote } from '../../../components/dashboard/tool-note';

export default function Page() {
  return (
    <DashboardShell section="rules">
      <ToolNote section="rules" />
    </DashboardShell>
  );
}
