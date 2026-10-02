/**
 * Layar 09 — skema penuh. Rute terpisah karena ia dibuka dari layar 06 ("Lihat skema"),
 * dan juga perlu bisa dibagikan sebagai tautan sendiri.
 *
 * Komponennya klien karena ia mengambil topologi dari API; halaman ini hanya cangkang.
 */
import { SchematicPage } from '../../components/schematic/schematic-page';

export default function SkemaPage() {
  return <SchematicPage />;
}
