/**
 * Layar 02 — konsultasi aktif. Beranda (`/`) merender workspace yang sama ditambah
 * onboarding; rute ini tanpa onboarding, untuk tujuan setelah masuk/daftar.
 */
import { BootGate } from '../../components/boot/boot';
import { ChatWorkspace } from '../../components/chat/chat-workspace';

export default function KonsultasiPage() {
  return (
    <BootGate steps={['session']}>
      <ChatWorkspace />
    </BootGate>
  );
}
