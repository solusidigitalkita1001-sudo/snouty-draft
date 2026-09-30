#!/usr/bin/env node
// CI tidak pernah boleh terhubung ke MySQL bersama di 192.168.1.136 (SPEC §31c).
// Konfigurasi bisa salah; assertion tidak.
const SHARED_HOST = '192.168.1.136';
const host = process.env.DB_HOST ?? '';

if (host.includes(SHARED_HOST)) {
  console.error(
    `DB_HOST mengarah ke server bersama (${SHARED_HOST}).\n` +
      'Tes integrasi wajib memakai kontainer MySQL sekali pakai — server itu memuat\n' +
      'tujuh database aplikasi lain (docs/DATABASE.md §1).',
  );
  process.exit(1);
}
console.log(`DB_HOST aman untuk CI: ${host || '(kosong)'} ✓`);
