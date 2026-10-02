/**
 * Penegakan entitlement di API — lapis kedua dari tiga (docs/SECURITY.md §4):
 * UI menyembunyikan, API menolak, perakitan respons menyaring.
 *
 * Satu fungsi kecil, bukan guard dekoratif, karena kapabilitas yang dibutuhkan
 * sering bergantung pada aksinya (menyimpan percakapan vs membacanya) — dan
 * fungsi di dalam controller lebih mudah dilihat kebenarannya daripada metadata
 * yang terpasang di tempat lain.
 */
import { isEntitled, type Capability, type Tier } from '../../modules/policy/entitlements.js';
import { NotEntitledCapabilityError } from './api-errors.js';

export function requireEntitled(tier: Tier, capability: Capability): void {
  if (!isEntitled(tier, capability)) throw new NotEntitledCapabilityError(capability);
}
