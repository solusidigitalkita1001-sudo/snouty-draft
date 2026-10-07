/**
 * Seluruh teks onboarding, apa adanya dari desain (layar 14, prototipe baru) —
 * satu modul siap i18n, bukan literal yang tersebar (docs/DESIGN_IMPLEMENTATION.md §10).
 *
 * Empat butir penjelas lokasi TIDAK BOLEH diparafrase: kalimatnya membawa janji
 * kebijakan (docs/PRIVACY.md §4), bukan sekadar redaksi.
 */

import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

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

export const ONBOARDING_COPY_EN: CopyShape<typeof ONBOARDING_COPY> = {
  brand: { name: 'SNOUTY', kicker: 'PRALON ASSISTANT' },

  steps: [
    {
      kicker: 'MEET',
      bubble: "Hi! I'm Snouty, your piping consultant.",
      title: 'Meet SNOUTY',
      body: "Pralon's smart assistant that helps you find product information and piping solutions for your needs.",
    },
    {
      kicker: 'STORY',
      bubble: "Just tell me your story, and I'll turn it into pipe sizes.",
      title: 'Describe your needs in your own words',
      body: "You don't need to know any piping jargon. Describe your home or building as if you were talking to a consultant.",
    },
    {
      kicker: 'PRODUCTS',
      bubble: 'Every suggestion comes from the Pralon catalog, with the reasons included.',
      title: 'Find the right Pralon products',
      body: 'SNOUTY helps understand your needs and matches them with the relevant Pralon products.',
    },
    {
      kicker: 'LOCATION',
      bubble: "It's optional. Without location, I still work fully.",
      title: 'Help us understand demand in your area',
      body: 'By enabling location, SNOUTY can help Pralon understand product demand patterns by region and improve market analysis.',
    },
    {
      kicker: 'ACCOUNT',
      bubble: 'Save your consultation so you can continue anytime.',
      title: 'Want a fuller experience?',
      body: 'Sign up to save conversations, revisit consultations, and try more complete case-study analysis.',
    },
  ],

  step1Capabilities: [
    { n: '01', title: 'Understand your needs', detail: 'From your story, not a form.' },
    { n: '02', title: 'Pralon recommendations', detail: 'Products, sizes, and the reasons.' },
    { n: '03', title: 'Schematic & estimate', detail: 'An overview of routes and materials.' },
  ],

  step2: {
    chatTitle: 'Consultation · example',
    chatTag: 'NO TECHNICAL TERMS',
    userMessage: 'A 2-storey house, 3 bathrooms, 4 sinks. What pipes do I need?',
    assistantMessage: 'Sure! One thing first: where does the water come from?',
    chips: ['Rooftop tank', 'Pump', 'Municipal supply', 'Not sure'],
    points: [
      { n: '01', label: 'Write freely' },
      { n: '02', label: 'Answer with one click' },
      { n: '03', label: 'Attach a floor plan if you have one' },
    ],
  },

  step3: {
    columns: [
      {
        kicker: '01 · YOUR STORY',
        title: 'Requirements',
        detail: '2-storey house, 3 bathrooms, rooftop tank.',
      },
      {
        kicker: '02 · SNOUTY',
        title: 'Analysis',
        detail: 'Outlets, main route, branches, and pipe sizes.',
      },
      {
        kicker: '03 · RESULT',
        title: 'Pralon products',
        detail: 'PVC AW 1" & 3/4", matching fittings, clear reasons.',
      },
    ],
    footer:
      'Recommendations come only from the Pralon catalog, and every suggestion comes with its technical reasons.',
  },

  step4: {
    knowTitle: 'WHAT YOU SHOULD KNOW',
    points: [
      'Sharing your location is optional.',
      'SNOUTY can still be used without location.',
      'Regional data is used for market-demand analysis, not to determine recommendations.',
      'City/regency level of detail is enough.',
    ],
    granted: {
      title: 'Location enabled',
      body: 'Thank you. Regional information helps improve market-demand insight. You can turn it off anytime in settings.',
    },
    denied: {
      title: "No problem, let's continue",
      body: 'SNOUTY works fully without location. You can enable it later from the help menu.',
    },
    blocked: {
      title: 'Location permission is blocked by the browser',
      body: 'You can still use SNOUTY. If you want to enable it, change the location permission for this site in your browser settings.',
    },
  },

  step5: {
    footer:
      'Case-study analysis and schematic generation are available in the registered experience. Without an account, you can still consult and view product recommendations.',
  },

  actions: {
    skip: 'Skip',
    skipLast: 'Skip for now',
    back: 'Back',
    next: 'Next',
    enableLocation: 'Enable Location',
    requesting: 'Requesting permission…',
    later: 'Maybe Later',
    register: 'Sign Up',
    continueAsGuest: 'Continue as Guest',
    close: 'Close onboarding',
  },
};

export function onboardingCopy(locale: Locale): CopyShape<typeof ONBOARDING_COPY> {
  return pickCopy(locale, ONBOARDING_COPY, ONBOARDING_COPY_EN);
}
