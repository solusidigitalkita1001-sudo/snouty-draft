/**
 * Tautan bagikan baca-saja (P24-03): `/shared?t=<token>`. Komponennya klien karena mengambil solusi
 * dari API; halaman ini hanya cangkang, seperti `/schematic`.
 */
import { SharedSolutionPage } from '../../components/library/shared-solution-page';

export const metadata = { robots: { index: false, follow: false } };

export default function SharedPage() {
  return <SharedSolutionPage />;
}
