/**
 * Port penyimpanan pengguna — konteks identity.
 */

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly tier: 'registered' | 'advanced';
  readonly status: 'active' | 'disabled';
  readonly roles: readonly string[];
}

export interface NewUser {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
}

export interface UserRepository {
  /** Pencarian selalu atas email yang sudah dinormalkan huruf kecil. */
  findByEmail(email: string): Promise<UserRow | null>;
  findById(id: string): Promise<UserRow | null>;
  /** Melempar `EmailAlreadyRegisteredError` pada email ganda — bukan mengembalikan flag. */
  create(user: NewUser): Promise<void>;
  touchLastSeen(id: string): Promise<void>;
  /** Halaman akun (OQ-53): nama tampilan diganti pengguna sendiri. */
  updateName(id: string, name: string): Promise<void>;
  /** Hash baru menggantikan yang lama; sesi refresh lain TIDAK dicabut di sini (keputusan pemanggil). */
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}
