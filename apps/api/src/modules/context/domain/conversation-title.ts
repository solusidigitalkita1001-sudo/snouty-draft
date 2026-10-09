/**
 * Judul riwayat dari ISI percakapan, bukan dari kalimat pertama (laporan pemilik 2026-10-09:
 * riwayat berisi "Hai", "Halo", "Hai" — semua percakapan dibuka dengan sapaan). **Fungsi murni**
 * atas state dan subjek yang sudah tersimpan: "Rumah 3 lantai", "Produk HDPE", "PVC vs HDPE",
 * "Tentang PT Pralon". `null` bila belum ada isi — pemanggil membiarkan judul yang ada.
 */
import { caseProfileLabel, isCaseId } from '@snouty/engineering';
import type { Locale, RequirementState } from '@snouty/shared-types';

export function conversationTitle(state: RequirementState | null, locale: Locale): string | null {
  if (state === null) return null;
  const en = locale === 'en';
  const subject = state.subject;

  // Kasus bangunan yang sudah tercatat paling menggambarkan percakapannya — pertanyaan produk atau
  // perusahaan di tengahnya tidak menggantinya (dry run 2026-10-09: rencana rumah 2 lantai sempat
  // berjudul "Tentang PT Pralon").
  const forCase = caseTitle(state, en);
  if (forCase !== null) return forCase;
  if (subject?.kind === 'company') return en ? 'About PT Pralon' : 'Tentang PT Pralon';
  if (subject?.kind === 'product') return productTitle(subject.entity, subject.topic, en);
  return null;
}

/** Entitas subjek yang bukan nama produk: Pralon umum, kasus, atau ID kasus teknis. */
const NOT_A_PRODUCT = new Set(['pralon', 'pt pralon', 'building', 'irrigation']);

/**
 * `null` untuk subjek produk yang umum ("Pralon"): judul kalimat pertama ("Kalau pipa bocor di
 * dalam tembok…") lebih jelas daripada "Produk Pralon".
 */
function productTitle(entity: string, topic: string, en: boolean): string | null {
  const names = entity
    .split(/\s+dan\s+/i)
    .map((e) => e.trim())
    .filter((e) => e !== '' && !NOT_A_PRODUCT.has(e.toLowerCase()) && !isCaseId(e));
  if (names.length === 0) return null;
  const upper = names.map((n) => n.toUpperCase());
  if (topic === 'comparison' && upper.length > 1) return upper.join(' vs ');
  return en ? `${upper.join(' and ')} products` : `Produk ${upper.join(' dan ')}`;
}

function caseTitle(state: RequirementState, en: boolean): string | null {
  const useCase = state.useCase;
  if (useCase?.kind === 'irrigation') return en ? 'Land irrigation' : 'Irigasi lahan';
  if (useCase?.kind === 'technical' && isCaseId(useCase.caseId)) {
    return caseProfileLabel(useCase.caseId, en ? 'en' : 'id');
  }
  const type = state.building.type.value;
  const floors = state.building.floors.value;
  const storeys = (n: number) => (en ? `${n}-storey` : `${n} lantai`);
  switch (type) {
    case 'residential':
      return floors !== null
        ? en
          ? `${storeys(floors)} house`
          : `Rumah ${storeys(floors)}`
        : en
          ? 'House'
          : 'Rumah tinggal';
    case 'boarding_house':
      return floors !== null
        ? en
          ? `${storeys(floors)} boarding house`
          : `Rumah kos ${storeys(floors)}`
        : en
          ? 'Boarding house'
          : 'Rumah kos';
    case 'light_commercial':
      return floors !== null
        ? en
          ? `${storeys(floors)} building`
          : `Bangunan ${storeys(floors)}`
        : en
          ? 'Commercial building'
          : 'Bangunan komersial';
    case 'industrial':
      return en ? 'Factory' : 'Pabrik';
    default:
      return floors !== null
        ? en
          ? `${storeys(floors)} building`
          : `Bangunan ${storeys(floors)}`
        : null;
  }
}
