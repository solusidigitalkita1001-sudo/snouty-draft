/**
 * Pengetahuan teknik umum tentang pipa — milik kode, bukan model, dan bukan katalog.
 * docs/AI_BEHAVIOR.md §4 (`PRODUCT_FAQ`) · docs/PRODUCT_KNOWLEDGE.md §1 · OQ-45.
 *
 * Tiga sumber yang sengaja dipisah:
 *   - pengetahuan umum (berkas ini): sifat keluarga bahan dan konsep pemipaan, kualitatif;
 *   - katalog Pralon: produk, ukuran, standar, kelas tekanan — selalu bersumber;
 *   - model: hanya merangkai kalimat dari keduanya.
 *
 * Jawaban "apa bedanya PVC dan HDPE?" harus utuh dari berkas ini saja: tanpa katalog, tanpa
 * model. Katalog menambah "yang mana di Pralon", model menambah keluwesan — keduanya opsional.
 *
 * Sengaja tanpa angka, standar, dan merek. Redaksi menunggu tinjauan tim teknis Pralon (OQ-45).
 */

import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';

/** Teks deskriptif satu bahan; satu salinan per bahasa. */
export interface MaterialTexts {
  readonly label: string;
  readonly gist: string;
  readonly bestFor: string;
  readonly notFor: string;
  readonly form: string;
  readonly joining: string;
  readonly durability: string;
  readonly typicalUse: string;
}

export interface MaterialKnowledge {
  readonly family: string;
  readonly label: string;
  readonly pattern: RegExp;
  /** Satu frasa untuk kalimat ringkasan: "PVC kaku dan dipasok batangan". */
  readonly gist: string;
  /** Kondisi yang membuatnya pilihan lazim — untuk kalimat simpulan. */
  readonly bestFor: string;
  /** Kondisi yang membuatnya kurang cocok — "ok nggak?" dijawab dua arah. */
  readonly notFor: string;
  /** Kekakuan dan bentuk pasokan. */
  readonly form: string;
  readonly joining: string;
  readonly durability: string;
  readonly typicalUse: string;
  /** Salinan Inggris — wajib menurut tipe, jadi bahan tanpa terjemahan gagal typecheck. */
  readonly en: MaterialTexts;
}

export interface ConceptKnowledge {
  readonly topic: string;
  readonly pattern: RegExp;
  readonly text: string;
  readonly textEn: string;
}

export const MATERIALS: readonly MaterialKnowledge[] = [
  {
    family: 'PVC',
    label: 'PVC (uPVC)',
    pattern: /\b(u?pvc|paralon|aw|kelas aw|kelas d)\b/i,
    gist: 'kaku dan dipasok batangan',
    bestFor: 'instalasi tetap di dalam dan sekitar bangunan',
    notFor: 'air panas, dan jalur tanam panjang yang tanahnya bergerak',
    form: 'kaku dan ringan, dipasok batangan; belokan dan percabangan memakai fitting',
    joining:
      'lem (solvent cement) atau cincin karet (rubber ring) — cepat, tanpa alat khusus, tetapi sambungan lem tidak bisa dibongkar',
    durability:
      'tahan korosi dan bahan kimia air bersih; getas bila terbentur keras dan melemah bila lama terpapar sinar matahari; bukan untuk air panas',
    typicalUse:
      'jaringan air bersih di dalam dan sekitar bangunan (kelas bertekanan), serta pembuangan dan ventilasi (kelas gravitasi)',
    en: {
      label: 'PVC (uPVC)',
      gist: 'rigid and supplied in straight lengths',
      bestFor: 'fixed installations in and around buildings',
      notFor: 'hot water, and long buried runs where the ground moves',
      form: 'rigid and light, supplied in straight lengths; bends and branches use fittings',
      joining:
        'solvent cement or rubber ring — quick and needs no special tools, but a cemented joint cannot be taken apart',
      durability:
        'resistant to corrosion and to chemicals in clean water; brittle under hard impact and weakens with long exposure to sunlight; not for hot water',
      typicalUse:
        'clean water networks in and around buildings (pressure class), plus drainage and venting (gravity class)',
    },
  },
  {
    family: 'HDPE',
    label: 'HDPE',
    pattern: /\b(hdpe|pe\s?100|pe\s?80|polyethylene|polietilen|poly)\b/i,
    gist: 'lentur dan bisa digulung',
    bestFor: 'jalur panjang, ditanam, atau tanah yang bergerak',
    notFor:
      'instalasi rapi di dalam bangunan dengan banyak belokan pendek — pemasangannya butuh alat las',
    form: 'lentur dan ulet; ukuran kecil dipasok gulungan, ukuran besar batangan — bisa mengikuti kontur tanah dengan sedikit sambungan',
    joining:
      'pemanasan (butt fusion atau electrofusion) sehingga sambungan menyatu dengan pipanya; ukuran kecil bisa memakai fitting kompresi; tidak dilem',
    durability:
      'tahan korosi, benturan, dan pergerakan tanah; warna hitamnya tahan sinar matahari; pemasangan butuh alat las dan operator terlatih',
    typicalUse:
      'jalur tanam dan distribusi di luar bangunan, jaringan jarak panjang, tanah yang bergerak atau lintasan yang berbelok',
    en: {
      label: 'HDPE',
      gist: 'flexible and can be coiled',
      bestFor: 'long runs, buried lines, or ground that moves',
      notFor:
        'neat indoor installations with many short bends — installing it needs welding equipment',
      form: 'flexible and tough; small sizes are supplied in coils, large sizes in straight lengths — it follows the ground contour with few joints',
      joining:
        'heat (butt fusion or electrofusion) so the joint becomes one piece with the pipe; small sizes can use compression fittings; no cement',
      durability:
        'resistant to corrosion, impact, and ground movement; its black colour withstands sunlight; installation needs welding equipment and trained operators',
      typicalUse:
        'buried lines and distribution outside buildings, long-distance networks, ground that moves or routes with turns',
    },
  },
  {
    family: 'PPR',
    label: 'PPR',
    pattern: /\b(ppr|pp-r|polypropylene|polipropilen)\b/i,
    gist: 'kaku dan tahan air panas',
    bestFor: 'instalasi air panas dan dingin di dalam bangunan',
    notFor: 'jalur tanam panjang di luar bangunan',
    form: 'kaku, dipasok batangan, dindingnya relatif tebal',
    joining: 'pemanasan (heat fusion) dengan alat pemanas sehingga sambungan menyatu; tidak dilem',
    durability: 'tahan air panas dan korosi; perlu alat pemanas dan kerapian saat menyambung',
    typicalUse: 'instalasi air panas dan dingin di dalam bangunan',
    en: {
      label: 'PPR',
      gist: 'rigid and hot-water tolerant',
      bestFor: 'hot and cold water installations inside buildings',
      notFor: 'long buried runs outside buildings',
      form: 'rigid, supplied in straight lengths, with relatively thick walls',
      joining: 'heat fusion with a heating tool so the joint becomes one piece; no cement',
      durability:
        'resistant to hot water and corrosion; needs a heating tool and care when joining',
      typicalUse: 'hot and cold water installations inside buildings',
    },
  },
  {
    family: 'Galvanis',
    label: 'pipa galvanis (GIP)',
    pattern: /\b(galvanis|galvanized|gip|besi|baja|iron|steel)\b/i,
    gist: 'kaku, berat, dan berkarat seiring waktu',
    bestFor: 'instalasi lama yang mempertahankan sistem ulir atau las',
    notFor: 'instalasi air bersih baru — lama-kelamaan berkarat dari dalam',
    form: 'kaku dan berat, dipasok batangan',
    joining: 'ulir atau las',
    durability:
      'kuat terhadap benturan dan panas, tetapi lama-kelamaan berkarat dari dalam dan menyempit',
    typicalUse: 'instalasi lama; untuk air bersih kini umumnya digantikan pipa plastik',
    en: {
      label: 'galvanized pipe (GIP)',
      gist: 'rigid, heavy, and rusts over time',
      bestFor: 'older installations that keep a threaded or welded system',
      notFor: 'new clean water installations — it rusts from the inside over time',
      form: 'rigid and heavy, supplied in straight lengths',
      joining: 'threading or welding',
      durability:
        'strong against impact and heat, but over time it rusts from the inside and narrows',
      typicalUse:
        'older installations; for clean water it is now generally replaced by plastic pipe',
    },
  },
];

export const CONCEPTS: readonly ConceptKnowledge[] = [
  {
    topic: 'fitting',
    pattern:
      /\b(fitting|fittings|sambungan pipa|aksesoris pipa|elbow|knee|keni|tee|socket|sok|reducer|coupling)\b/i,
    text: 'Fitting adalah komponen penyambung pipa — sok (socket), tee, elbow/knee, reducer, katup — yang mengubah arah, membagi cabang, mengubah ukuran, atau menyambung dua batang. Fitting dibuat dari bahan yang sama dengan pipanya (PVC untuk PVC, HDPE untuk HDPE) supaya sambungannya cocok.',
    textEn:
      'Fittings are the connecting parts of a pipe run — sockets, tees, elbows, reducers, valves — that change direction, split a branch, change size, or join two lengths. They are made of the same material as the pipe (PVC for PVC, HDPE for HDPE) so the joint matches.',
  },
  {
    topic: 'kelas pvc',
    pattern: /\b(aw|kelas aw|kelas d|pvc d|class aw|class d)\b/i,
    text: 'AW dan D adalah kelas pipa PVC, bukan bahan yang berbeda: AW untuk jalur air bersih bertekanan (dinding lebih tebal), D untuk pembuangan dan ventilasi yang mengalir karena gravitasi (dinding lebih tipis). Jadi "pipa AW" adalah pipa PVC kelas bertekanan.',
    textEn:
      'AW and D are classes of PVC pipe, not different materials: AW for pressurized clean-water lines (thicker wall), D for drainage and venting that flow by gravity (thinner wall). So an "AW pipe" is PVC pipe of the pressure class.',
  },
  {
    topic: 'pipa tanam',
    pattern: /\b(tanam|ditanam|bawah tanah|timbun|urug|buried|underground|backfill)\b/i,
    text: 'Pipa tanam menanggung beban tanah dan pergerakannya. Bahan yang lentur dengan sambungan yang menyatu lebih toleran terhadap tanah yang bergerak; pipa kaku membutuhkan alas (bedding) dan urugan yang rapi agar tidak retak di sambungan.',
    textEn:
      'Buried pipe carries the load of the soil and its movement. A flexible material with fused joints tolerates moving ground better; rigid pipe needs neat bedding and backfill so it does not crack at the joints.',
  },
  {
    topic: 'bertekanan vs gravitasi',
    pattern:
      /\b(bertekanan|tekanan|gravitasi|pembuangan|limbah|pressure|pressurized|gravity|drainage|wastewater)\b/i,
    text: 'Jalur air bersih bertekanan menuntut pipa dan sambungan yang menahan tekanan dari dalam, sehingga memakai kelas pipa yang lebih tebal (pada PVC: kelas AW). Jalur pembuangan mengalir karena gravitasi dan memakai kelas yang lebih tipis (kelas D).',
    textEn:
      'Pressurized clean water lines need pipe and joints that withstand internal pressure, so they use a thicker pipe class (for PVC: class AW). Drainage lines flow by gravity and use a thinner class (class D).',
  },
  {
    topic: 'kaku vs lentur',
    pattern: /\b(kaku|lentur|fleksibel|rigid|flexible)\b/i,
    text: 'Pipa kaku mudah dipasang lurus dan rapi di dalam bangunan, tetapi setiap belokan adalah sambungan. Pipa lentur mengikuti lintasan dengan sambungan lebih sedikit — berguna di luar bangunan dan di bawah tanah.',
    textEn:
      'Rigid pipe is easy to run straight and neat inside a building, but every bend is a joint. Flexible pipe follows the route with fewer joints — useful outside buildings and underground.',
  },
];

export function materialsIn(
  ...texts: readonly (string | null | undefined)[]
): readonly MaterialKnowledge[] {
  const haystack = join(texts);
  return MATERIALS.filter((m) => m.pattern.test(haystack));
}

export function conceptsIn(
  ...texts: readonly (string | null | undefined)[]
): readonly ConceptKnowledge[] {
  const haystack = join(texts);
  return CONCEPTS.filter((c) => c.pattern.test(haystack));
}

/**
 * Teks dirangkai sebagai Markdown ringan — label tebal + butir — karena itulah bentuk yang
 * dirender gelembung asisten (`AssistantMarkdown`) dan bentuk yang diminta dari model.
 * Tanpa model, inilah yang tampil; dengan model, inilah DATA yang dirangkainya ulang.
 */
export function describeMaterial(
  material: MaterialKnowledge,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = textsOf(material, locale);
  // Satu bahan dijawab sebagai PROSA, bukan lembar data: butir hanya untuk perbandingan.
  // "Ok nggak?" dijawab dua arah — kapan cocok, kapan kurang cocok.
  if (locale === 'en') {
    return [
      `**${m.label}** is ${m.gist}: ${m.form}. Its joints use ${m.joining}. On durability, ${m.durability}.`,
      `In general it is **suited to ${m.bestFor}**, and less suited to ${m.notFor}.`,
    ].join('\n\n');
  }
  return [
    `**${m.label}** itu ${m.gist}: ${m.form}. Sambungannya ${m.joining}. Soal ketahanan, ${m.durability}.`,
    `Secara umum **cocok untuk ${m.bestFor}**, dan kurang cocok untuk ${m.notFor}.`,
  ].join('\n\n');
}

/**
 * Penyajian ulang sebagai TABEL (permintaan "bikinin tabelnya dong"): isi yang sama dengan
 * prosa/butir, hanya bentuknya yang berubah — tidak ada fakta baru yang lahir dari format.
 * Sel tabel tidak boleh memuat `|`; teks pengetahuan memang tidak memuatnya.
 */
const TABLE_ROWS: Readonly<Record<Locale, readonly (readonly [string, keyof MaterialTexts])[]>> = {
  id: [
    ['Bentuk', 'form'],
    ['Sambungan', 'joining'],
    ['Ketahanan', 'durability'],
    ['Pemakaian lazim', 'typicalUse'],
    ['Cocok untuk', 'bestFor'],
    ['Kurang cocok untuk', 'notFor'],
  ],
  en: [
    ['Form', 'form'],
    ['Joints', 'joining'],
    ['Durability', 'durability'],
    ['Typical use', 'typicalUse'],
    ['Suited to', 'bestFor'],
    ['Less suited to', 'notFor'],
  ],
};

function cell(text: string): string {
  return text.replace(/\|/g, '/').replace(/\n/g, ' ');
}

export function materialsTable(
  materials: readonly MaterialKnowledge[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const texts = materials.map((m) => textsOf(m, locale));
  const aspect = locale === 'en' ? 'Aspect' : 'Aspek';
  const header = `| ${aspect} | ${texts.map((t) => `**${t.label}**`).join(' | ')} |`;
  const divider = `| --- | ${texts.map(() => '---').join(' | ')} |`;
  const rows = TABLE_ROWS[locale].map(
    ([label, key]) => `| ${label} | ${texts.map((t) => cell(t[key])).join(' | ')} |`,
  );
  return [header, divider, ...rows].join('\n');
}

/** "Apa bedanya fitting sama HDPE?" sebagai tabel: bahan di satu kolom, komponen di kolom lain. */
export function fittingVsMaterialTable(
  material: MaterialKnowledge,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = textsOf(material, locale);
  if (locale === 'en') {
    return [
      `| Aspect | **${m.label}** | **Fitting** |`,
      '| --- | --- | --- |',
      `| What it is | a pipe material — ${cell(m.gist)} | a connecting part: socket, tee, elbow, reducer, valve |`,
      `| Role | carries the water along the run | changes direction, splits a branch, changes size, joins two lengths |`,
      `| Material | ${cell(m.label)} | the same material as the pipe it joins (${cell(m.label)} fittings for ${cell(m.label)} pipe) |`,
      `| Joints | ${cell(m.joining)} | the same joining method as the pipe |`,
      `| Suited to | ${cell(m.bestFor)} | every run — there is no pipe run without fittings |`,
    ].join('\n');
  }
  return [
    `| Aspek | **${m.label}** | **Fitting** |`,
    '| --- | --- | --- |',
    `| Apa itu | bahan pipa — ${cell(m.gist)} | komponen penyambung: sok, tee, elbow, reducer, katup |`,
    `| Peran | membawa air sepanjang jalur | mengubah arah, membagi cabang, mengubah ukuran, menyambung dua batang |`,
    `| Bahan | ${cell(m.label)} | sama dengan pipa yang disambungnya (fitting ${cell(m.label)} untuk pipa ${cell(m.label)}) |`,
    `| Sambungan | ${cell(m.joining)} | cara sambung yang sama dengan pipanya |`,
    `| Cocok untuk | ${cell(m.bestFor)} | setiap jalur — tidak ada jalur pipa tanpa fitting |`,
  ].join('\n');
}

/**
 * Penyajian ulang jawaban produk/bahan yang BARU SAJA diberikan dalam bentuk yang diminta.
 * Isinya diambil dari apa yang dibicarakan (jawaban asisten terakhir + subjek), bukan dari pesan
 * "bikinin tabelnya" yang memang tidak menyebut apa-apa. `null` bila tidak ada yang bisa disajikan.
 */
export function reformat(
  format: 'table' | 'bullets' | 'summary',
  context: { readonly subject?: string | null; readonly previous?: string | null },
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  // Subjek dulu: penjelasan fitting menyebut "PVC untuk PVC, HDPE untuk HDPE", jadi membaca bahan
  // dari teks jawaban saja akan mengira ada dua bahan yang dibandingkan.
  const fromSubject = materialsIn(context.subject);
  const materials = (fromSubject.length > 0 ? fromSubject : materialsIn(context.previous)).slice(
    0,
    3,
  );
  const fitting = conceptsIn(context.previous, context.subject).some((c) => c.topic === 'fitting');
  if (materials.length === 0) return null;
  if (format === 'table') {
    if (materials.length === 1 && fitting) return fittingVsMaterialTable(materials[0]!, locale);
    return materialsTable(materials, locale);
  }
  if (format === 'bullets') {
    return materials
      .map((m) => {
        const t = textsOf(m, locale);
        return [`**${t.label}**`, ...dimensionRows(t, locale)].join('\n');
      })
      .join('\n\n');
  }
  // Ringkasan: inti tiap bahan + kapan dipakai. Bukan `briefComparison` ("Seperti tadi: …"), yang
  // nadanya pengingat anti-ulang, bukan jawaban atas permintaan "ringkas dong".
  const texts = materials.map((m) => textsOf(m, locale));
  if (locale === 'en') {
    const gists = texts.map((t) => `**${t.label}** is ${t.gist}`).join(', while ');
    const uses = texts.map((t) => `${t.label} for ${t.bestFor}`).join('; ');
    return `In short, ${gists}. ${uses}.`;
  }
  const gists = texts.map((t) => `**${t.label}** ${t.gist}`).join(', sedangkan ');
  const uses = texts.map((t) => `${t.label} untuk ${t.bestFor}`).join('; ');
  return `Singkatnya, ${gists}. ${uses}.`;
}

/** Ringkasan → satu blok per bahan → simpulan: "bedanya" dijawab sebagai perbedaan. */
export function compareMaterials(
  first: MaterialKnowledge,
  second: MaterialKnowledge,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const a = textsOf(first, locale);
  const b = textsOf(second, locale);
  if (locale === 'en') {
    return [
      `In short, **${a.label} is ${a.gist}**, while **${b.label} is ${b.gist}**.`,
      '',
      `**${a.label}**`,
      ...dimensionRows(a, locale),
      '',
      `**${b.label}**`,
      ...dimensionRows(b, locale),
      '',
      `So for **${a.bestFor}**, ${a.label} is usually more practical; for **${b.bestFor}**, ${b.label} is usually the better fit.`,
    ].join('\n');
  }
  return [
    `Singkatnya, **${a.label} ${a.gist}**, sedangkan **${b.label} ${b.gist}**.`,
    '',
    `**${a.label}**`,
    ...dimensionRows(a, locale),
    '',
    `**${b.label}**`,
    ...dimensionRows(b, locale),
    '',
    `Jadi untuk **${a.bestFor}**, ${a.label} biasanya lebih praktis; untuk **${b.bestFor}**, ${b.label} biasanya lebih cocok.`,
  ].join('\n');
}

/** Satu kalimat — untuk mengulang yang sudah dijelaskan tanpa mengulang seluruh perbandingan. */
export function briefComparison(
  materials: readonly MaterialKnowledge[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale === 'en') {
    const parts = materials.map((m) => `**${m.en.label} is ${m.en.gist}**`);
    return `As above: ${parts.join(', while ')}.`;
  }
  const parts = materials.map((m) => `**${m.label} ${m.gist}**`);
  return `Seperti tadi: ${parts.join(', sedangkan ')}.`;
}

export interface AdviceContext {
  readonly buildingLabel: string | null;
  readonly floors: number | null;
  /** Masih ada data inti yang kurang — kalimat penutup mengajak mengisinya. */
  readonly needsMoreData: boolean;
}

/**
 * Pertanyaan REKOMENDASI ("lebih bagus PVC atau HDPE buat rumah 2 lantai?") — bukan definisi.
 * Jawabannya bukan memilih satu bahan sebagai yang terbaik, melainkan: apa yang sebenarnya
 * menentukan, aturan praktis tiap bahan, dan data apa yang masih perlu ditanyakan. Datanya
 * sendiri ditanyakan kartu klarifikasi yang mengikuti teks ini — tidak diulang di sini.
 */
export function adviseMaterials(
  materials: readonly MaterialKnowledge[],
  context: AdviceContext,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale === 'en') return adviseMaterialsEn(materials, context);
  const where =
    context.buildingLabel && context.floors
      ? `Untuk ${context.buildingLabel} ${context.floors} lantai`
      : context.buildingLabel
        ? `Untuk ${context.buildingLabel}`
        : 'Untuk kasus ini';
  const basis = context.floors
    ? 'tidak ditentukan dari jumlah lantai saja'
    : 'tidak bisa ditentukan dari satu hal saja';
  const lines = [
    `${where}, pilihan bahan **${basis}** — yang menentukan adalah di mana jalurnya (di dalam bangunan, di luar, atau ditanam) dan bagaimana airnya dipasok.`,
    '',
    ...materials.map((m) => `- **${m.label}** biasanya lebih cocok untuk ${m.bestFor}.`),
    '',
    materials.length > 1
      ? 'Keduanya bisa dipakai di bagian yang berbeda dalam satu instalasi.'
      : 'Bahan lain bisa dipakai di bagian lain instalasi yang sama.',
  ];
  if (context.needsMoreData) {
    lines.push(
      '',
      'Supaya saya bisa merekomendasikan bahan dan ukurannya, saya perlu beberapa hal di bawah ini.',
    );
  }
  return lines.join('\n');
}

function adviseMaterialsEn(
  materials: readonly MaterialKnowledge[],
  context: AdviceContext,
): string {
  const where =
    context.buildingLabel && context.floors
      ? `For a ${context.buildingLabel} with ${context.floors} floors`
      : context.buildingLabel
        ? `For a ${context.buildingLabel}`
        : 'For this case';
  const basis = context.floors
    ? 'is not decided by the number of floors alone'
    : 'cannot be decided by one factor alone';
  const lines = [
    `${where}, the choice of material **${basis}** — what decides it is where the line runs (inside the building, outside, or buried) and how the water is supplied.`,
    '',
    ...materials.map((m) => `- **${m.en.label}** is usually better suited to ${m.en.bestFor}.`),
    '',
    materials.length > 1
      ? 'Both can be used in different parts of one installation.'
      : 'Another material can be used in other parts of the same installation.',
  ];
  if (context.needsMoreData) {
    lines.push(
      '',
      'So that I can recommend the material and size, I need a few things listed below.',
    );
  }
  return lines.join('\n');
}

/** Bahan Indonesia sudah memenuhi `MaterialTexts` apa adanya; Inggris ada di `en`. */
function textsOf(m: MaterialKnowledge, locale: Locale): MaterialTexts {
  return locale === 'en' ? m.en : m;
}

function dimensionRows(m: MaterialTexts, locale: Locale): readonly string[] {
  if (locale === 'en') {
    return [
      `- Form: ${m.form}.`,
      `- Joining: ${m.joining}.`,
      `- Durability: ${m.durability}.`,
      `- Typical use: ${m.typicalUse}.`,
    ];
  }
  return [
    `- Bentuk: ${m.form}.`,
    `- Sambungan: ${m.joining}.`,
    `- Ketahanan: ${m.durability}.`,
    `- Pemakaian lazim: ${m.typicalUse}.`,
  ];
}

/**
 * Penjelasan deterministik untuk sebuah pertanyaan konsep: perbandingan bila dua bahan
 * disebut, ikhtisar bila satu, ditambah konsep yang disinggung. Kosong bila tidak ada yang
 * dikenali — pemanggil yang memutuskan apa yang terjadi kemudian.
 */
export function explain(
  question: string,
  productQuery: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const materials = materialsIn(question, productQuery).slice(0, 2);
  const concepts = conceptsIn(question);
  const parts: string[] = [];
  // "Apa bedanya fitting sama HDPE?" membandingkan komponen dengan bahan — bukan dua bahan.
  // Katakan dulu bahwa keduanya tidak setara, baru jelaskan masing-masing.
  if (
    materials.length === 1 &&
    concepts.some((c) => c.topic === 'fitting') &&
    COMPARISON.test(question)
  ) {
    const m = materials[0]!;
    parts.push(
      locale === 'en'
        ? `**${m.en.label}** is a pipe material, while a **fitting** is a connecting part — so they are not two options to choose between. ${m.en.label} fittings exist too; they are what joins ${m.en.label} pipe.`
        : `**${m.label}** adalah bahan pipa, sedangkan **fitting** adalah komponen penyambungnya — jadi keduanya bukan dua pilihan yang dibandingkan. Fitting ${m.label} pun ada; itulah yang menyambung pipa ${m.label}.`,
    );
  }
  if (materials.length === 2) parts.push(compareMaterials(materials[0]!, materials[1]!, locale));
  else if (materials.length === 1) parts.push(describeMaterial(materials[0]!, locale));
  for (const c of concepts) parts.push(locale === 'en' ? c.textEn : c.text);
  return parts.join('\n\n');
}

const COMPARISON = /\b(beda|bedanya|perbedaan|dibanding|versus|vs|difference|differ|compare)\b/i;

function join(texts: readonly (string | null | undefined)[]): string {
  return texts.filter((t): t is string => typeof t === 'string').join(' ');
}
