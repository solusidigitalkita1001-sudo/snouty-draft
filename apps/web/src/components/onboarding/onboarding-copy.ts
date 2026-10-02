/**
 * Seluruh teks onboarding, apa adanya dari desain (layar 14, prototipe baru) —
 * satu modul siap i18n, bukan literal yang tersebar (docs/DESIGN_IMPLEMENTATION.md §10).
 *
 * Empat butir penjelas lokasi TIDAK BOLEH diparafrase: kalimatnya membawa janji
 * kebijakan (docs/PRIVACY.md §4), bukan sekadar redaksi.
 */

export const ONBOARDING_COPY = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },

  steps: [
    {
      kicker: 'KENALAN',
      bubble: 'Halo! Aku Snouty, konsultan pipa kamu.',
      title: 'Kenalan dengan SNOUTY',
      body: 'Asisten pintar Pralon yang membantu Anda mencari informasi produk dan solusi perpipaan sesuai kebutuhan.',
    },
    {
      kicker: 'CERITA',
      bubble: 'Cerita saja, aku yang terjemahkan ke ukuran pipa.',
      title: 'Ceritakan kebutuhan Anda dengan cara biasa',
      body: 'Anda tidak perlu memahami istilah teknis perpipaan. Ceritakan kondisi rumah atau bangunan Anda seperti sedang berbicara dengan konsultan.',
    },
    {
      kicker: 'PRODUK',
      bubble: 'Semua saranku dari katalog Pralon, lengkap dengan alasannya.',
      title: 'Temukan produk Pralon yang sesuai',
      body: 'SNOUTY akan membantu memahami kebutuhan Anda dan mencocokkannya dengan produk Pralon yang relevan.',
    },
    {
      kicker: 'LOKASI',
      bubble: 'Opsional kok. Tanpa lokasi aku tetap bekerja penuh.',
      title: 'Bantu kami memahami kebutuhan di wilayah Anda',
      body: 'Dengan mengaktifkan lokasi, SNOUTY dapat membantu Pralon memahami pola kebutuhan produk berdasarkan wilayah dan meningkatkan analisis pasar.',
    },
    {
      kicker: 'AKUN',
      bubble: 'Simpan konsultasimu biar bisa dilanjut kapan saja.',
      title: 'Ingin pengalaman yang lebih lengkap?',
      body: 'Daftar akun untuk menyimpan percakapan, melihat kembali konsultasi, dan mencoba analisis studi kasus yang lebih lengkap.',
    },
  ],

  step1Capabilities: [
    { n: '01', title: 'Pahami kebutuhan', detail: 'Dari cerita Anda, bukan formulir.' },
    { n: '02', title: 'Rekomendasi Pralon', detail: 'Produk, ukuran, dan alasannya.' },
    { n: '03', title: 'Skema & estimasi', detail: 'Gambaran jalur dan material.' },
  ],

  step2: {
    chatTitle: 'Konsultasi · contoh',
    chatTag: 'TANPA ISTILAH TEKNIS',
    userMessage: 'Rumah 2 lantai, 3 kamar mandi, 4 wastafel. Pipa apa yang saya butuhkan?',
    assistantMessage: 'Siap! Satu hal dulu, sumber airnya dari mana?',
    chips: ['Toren', 'Pompa', 'PDAM', 'Belum tahu'],
    points: [
      { n: '01', label: 'Tulis bebas' },
      { n: '02', label: 'Jawab dengan satu klik' },
      { n: '03', label: 'Lampirkan denah bila ada' },
    ],
  },

  step3: {
    columns: [
      {
        kicker: '01 · CERITA ANDA',
        title: 'Kebutuhan',
        detail: 'Rumah 2 lantai, 3 kamar mandi, toren atap.',
      },
      {
        kicker: '02 · SNOUTY',
        title: 'Analisis',
        detail: 'Titik air, jalur utama, cabang, dan ukuran pipa.',
      },
      {
        kicker: '03 · HASIL',
        title: 'Produk Pralon',
        detail: 'PVC AW 1" & 3/4", fitting sepadan, alasannya jelas.',
      },
    ],
    footer:
      'Rekomendasi hanya diambil dari katalog Pralon, dan setiap saran disertai alasan teknisnya.',
  },

  step4: {
    knowTitle: 'YANG PERLU ANDA TAHU',
    // Janji kebijakan — jangan diparafrase.
    points: [
      'Berbagi lokasi bersifat opsional.',
      'SNOUTY tetap bisa digunakan tanpa lokasi.',
      'Data wilayah dipakai untuk analisis kebutuhan pasar, bukan untuk menentukan rekomendasi.',
      'Tingkat detail cukup di level kota/kabupaten.',
    ],
    granted: {
      title: 'Lokasi berhasil diaktifkan',
      body: 'Terima kasih. Informasi wilayah membantu meningkatkan insight kebutuhan pasar. Bisa dinonaktifkan kapan saja dari pengaturan.',
    },
    denied: {
      title: 'Tidak masalah, kita lanjut saja',
      body: 'SNOUTY tetap bekerja penuh tanpa lokasi. Anda bisa mengaktifkannya nanti dari menu bantuan.',
    },
    blocked: {
      title: 'Izin lokasi diblokir oleh browser',
      body: 'Anda tetap dapat menggunakan SNOUTY. Bila ingin mengaktifkannya, ubah izin lokasi untuk situs ini pada pengaturan browser.',
    },
  },

  step5: {
    footer:
      'Analisis studi kasus dan pembuatan skema tersedia pada pengalaman terdaftar. Tanpa akun, Anda tetap bisa berkonsultasi dan melihat rekomendasi produk.',
  },

  actions: {
    skip: 'Lewati',
    skipLast: 'Lewati untuk sekarang',
    back: 'Kembali',
    next: 'Lanjut',
    enableLocation: 'Aktifkan Lokasi',
    requesting: 'Meminta izin…',
    later: 'Nanti Saja',
    register: 'Daftar Akun',
    continueAsGuest: 'Lanjut sebagai Tamu',
    close: 'Tutup onboarding',
  },
} as const;
