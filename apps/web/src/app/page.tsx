import { ChatWorkspace } from '../components/chat/chat-workspace';
import { Onboarding } from '../components/onboarding/onboarding';

/**
 * Layar 01 — welcome. Di prototipe, welcome bukan layar tersendiri melainkan state
 * awal ruang konsultasi (`isWelcome`), dengan onboarding (layar 14) melayang di
 * atasnya saat server bilang `pending`. Jadi beranda adalah `ChatWorkspace` yang sama
 * dengan `/consultation`; yang membedakan hanya onboarding.
 */
export default function Home() {
  return (
    <>
      <Onboarding />
      <ChatWorkspace />
    </>
  );
}
