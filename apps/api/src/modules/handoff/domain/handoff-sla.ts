/**
 * Tenggat "1×24 jam kerja" (P29-01).
 *
 * Janji itu dibuat kepada pengguna di kartu validasi teknis, jadi antrean tim teknis harus
 * bisa menunjukkan kasus mana yang sudah melewatinya. Tanpa diukur, janjinya kosong
 * (docs/BACKOFFICE.md §4.3).
 *
 * **Yang dihitung hanya hari kerja.** Sabtu dan Minggu tidak memakan jam: kasus yang masuk
 * Jumat sore tidak boleh terlihat terlambat pada Senin pagi, karena memang tidak ada yang
 * bekerja di antaranya. Hari libur nasional belum ikut — sistem tidak punya kalendernya, dan
 * menebak-nebak tanggalnya lebih buruk daripada mengakui batasnya (OQ-78).
 *
 * Batas harinya memakai WIB (+07:00). Indonesia tidak punya daylight saving, jadi offset
 * tetap di sini **persis**, bukan pendekatan.
 *
 * Fungsi murni: tidak membaca jam sendiri. "Sekarang" selalu datang dari pemanggil, supaya
 * tesnya tidak bergantung pada kapan ia dijalankan.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isWeekendInWib(instant: number): boolean {
  const day = new Date(instant + WIB_OFFSET_MS).getUTCDay();
  return day === 0 || day === 6;
}

/** Awal hari WIB berikutnya, dinyatakan sebagai instant UTC. */
function nextWibMidnight(instant: number): number {
  const wib = instant + WIB_OFFSET_MS;
  const startOfDay = Math.floor(wib / DAY_MS) * DAY_MS;
  return startOfDay + DAY_MS - WIB_OFFSET_MS;
}

/**
 * Kapan kasus yang masuk pada `createdAt` melewati janjinya, bila yang berjalan hanya
 * jam di hari kerja.
 */
export function slaDueAt(createdAt: Date, slaHours: number): Date {
  let cursor = createdAt.getTime();
  let remaining = slaHours * 60 * 60 * 1000;

  // Setiap putaran memakan paling banyak sisa satu hari, jadi ia selalu maju dan selalu
  // berhenti — hari libur akhir pekan dilewati tanpa mengurangi sisa.
  while (remaining > 0) {
    const boundary = nextWibMidnight(cursor);
    if (isWeekendInWib(cursor)) {
      cursor = boundary;
      continue;
    }
    const usable = boundary - cursor;
    if (usable >= remaining) return new Date(cursor + remaining);
    remaining -= usable;
    cursor = boundary;
  }
  return new Date(cursor);
}

/** Sudah lewat tenggat? Dipakai antrean untuk menandai kasus yang menunggu terlalu lama. */
export function isOverdue(createdAt: Date, slaHours: number, now: Date): boolean {
  return now.getTime() > slaDueAt(createdAt, slaHours).getTime();
}
