import { BootGate } from '../components/boot/boot';
import { ChatWorkspace } from '../components/chat/chat-workspace';
import { Onboarding } from '../components/onboarding/onboarding';

/**
 * Layar 01 — welcome. Di prototipe, welcome bukan layar tersendiri melainkan state
 * awal ruang konsultasi (`isWelcome`), dengan onboarding (layar 14) melayang di
 * atasnya saat server bilang `pending`. Jadi beranda adalah `ChatWorkspace` yang sama
 * dengan `/consultation`; yang membedakan hanya onboarding.
 *
 * `BootGate` menahan keduanya sampai sesi dipulihkan dan keadaan onboarding diketahui
 * (P27-05) — sebelumnya ruang kosong tampil dulu dan wizard berkedip di atasnya.
 */
export default function Home() {
  return (
    <BootGate>
      <Onboarding />
      <ChatWorkspace />
    </BootGate>
  );
}
