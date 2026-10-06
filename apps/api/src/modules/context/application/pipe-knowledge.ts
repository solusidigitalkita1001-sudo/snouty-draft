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

export interface MaterialKnowledge {
  readonly family: string;
  readonly label: string;
  readonly pattern: RegExp;
  /** Satu frasa untuk kalimat ringkasan: "PVC kaku dan dipasok batangan". */
  readonly gist: string;
  /** Kondisi yang membuatnya pilihan lazim — untuk kalimat simpulan. */
  readonly bestFor: string;
  /** Kekakuan dan bentuk pasokan. */
  readonly form: string;
  readonly joining: string;
  readonly durability: string;
  readonly typicalUse: string;
}

export interface ConceptKnowledge {
  readonly topic: string;
  readonly pattern: RegExp;
  readonly text: string;
}

export const MATERIALS: readonly MaterialKnowledge[] = [
  {
    family: 'PVC',
    label: 'PVC (uPVC)',
    pattern: /\b(u?pvc|paralon)\b/i,
    gist: 'kaku dan dipasok batangan',
    bestFor: 'instalasi tetap di dalam dan sekitar bangunan',
    form: 'kaku dan ringan, dipasok batangan; belokan dan percabangan memakai fitting',
    joining:
      'lem (solvent cement) atau cincin karet (rubber ring) — cepat, tanpa alat khusus, tetapi sambungan lem tidak bisa dibongkar',
    durability:
      'tahan korosi dan bahan kimia air bersih; getas bila terbentur keras dan melemah bila lama terpapar sinar matahari; bukan untuk air panas',
    typicalUse:
      'jaringan air bersih di dalam dan sekitar bangunan (kelas bertekanan), serta pembuangan dan ventilasi (kelas gravitasi)',
  },
  {
    family: 'HDPE',
    label: 'HDPE',
    pattern: /\b(hdpe|pe\s?100|pe\s?80|polyethylene|polietilen|poly)\b/i,
    gist: 'lentur dan bisa digulung',
    bestFor: 'jalur panjang, ditanam, atau tanah yang bergerak',
    form: 'lentur dan ulet; ukuran kecil dipasok gulungan, ukuran besar batangan — bisa mengikuti kontur tanah dengan sedikit sambungan',
    joining:
      'pemanasan (butt fusion atau electrofusion) sehingga sambungan menyatu dengan pipanya; ukuran kecil bisa memakai fitting kompresi; tidak dilem',
    durability:
      'tahan korosi, benturan, dan pergerakan tanah; warna hitamnya tahan sinar matahari; pemasangan butuh alat las dan operator terlatih',
    typicalUse:
      'jalur tanam dan distribusi di luar bangunan, jaringan jarak panjang, tanah yang bergerak atau lintasan yang berbelok',
  },
  {
    family: 'PPR',
    label: 'PPR',
    pattern: /\b(ppr|pp-r|polypropylene|polipropilen)\b/i,
    gist: 'kaku dan tahan air panas',
    bestFor: 'instalasi air panas dan dingin di dalam bangunan',
    form: 'kaku, dipasok batangan, dindingnya relatif tebal',
    joining: 'pemanasan (heat fusion) dengan alat pemanas sehingga sambungan menyatu; tidak dilem',
    durability: 'tahan air panas dan korosi; perlu alat pemanas dan kerapian saat menyambung',
    typicalUse: 'instalasi air panas dan dingin di dalam bangunan',
  },
  {
    family: 'Galvanis',
    label: 'pipa galvanis (GIP)',
    pattern: /\b(galvanis|gip|besi|baja)\b/i,
    gist: 'kaku, berat, dan berkarat seiring waktu',
    bestFor: 'instalasi lama yang mempertahankan sistem ulir atau las',
    form: 'kaku dan berat, dipasok batangan',
    joining: 'ulir atau las',
    durability:
      'kuat terhadap benturan dan panas, tetapi lama-kelamaan berkarat dari dalam dan menyempit',
    typicalUse: 'instalasi lama; untuk air bersih kini umumnya digantikan pipa plastik',
  },
];

export const CONCEPTS: readonly ConceptKnowledge[] = [
  {
    topic: 'pipa tanam',
    pattern: /\b(tanam|ditanam|bawah tanah|timbun|urug)\b/i,
    text: 'Pipa tanam menanggung beban tanah dan pergerakannya. Bahan yang lentur dengan sambungan yang menyatu lebih toleran terhadap tanah yang bergerak; pipa kaku membutuhkan alas (bedding) dan urugan yang rapi agar tidak retak di sambungan.',
  },
  {
    topic: 'bertekanan vs gravitasi',
    pattern: /\b(bertekanan|tekanan|gravitasi|pembuangan|limbah)\b/i,
    text: 'Jalur air bersih bertekanan menuntut pipa dan sambungan yang menahan tekanan dari dalam, sehingga memakai kelas pipa yang lebih tebal (pada PVC: kelas AW). Jalur pembuangan mengalir karena gravitasi dan memakai kelas yang lebih tipis (kelas D).',
  },
  {
    topic: 'kaku vs lentur',
    pattern: /\b(kaku|lentur|fleksibel|rigid)\b/i,
    text: 'Pipa kaku mudah dipasang lurus dan rapi di dalam bangunan, tetapi setiap belokan adalah sambungan. Pipa lentur mengikuti lintasan dengan sambungan lebih sedikit — berguna di luar bangunan dan di bawah tanah.',
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
export function describeMaterial(m: MaterialKnowledge): string {
  return [`**${m.label}** — ${m.gist}.`, ...dimensionRows(m)].join('\n');
}

/** Ringkasan → satu blok per bahan → simpulan: "bedanya" dijawab sebagai perbedaan. */
export function compareMaterials(a: MaterialKnowledge, b: MaterialKnowledge): string {
  return [
    `Singkatnya, **${a.label} ${a.gist}**, sedangkan **${b.label} ${b.gist}**.`,
    '',
    `**${a.label}**`,
    ...dimensionRows(a),
    '',
    `**${b.label}**`,
    ...dimensionRows(b),
    '',
    `Jadi untuk **${a.bestFor}**, ${a.label} biasanya lebih praktis; untuk **${b.bestFor}**, ${b.label} biasanya lebih cocok.`,
  ].join('\n');
}

function dimensionRows(m: MaterialKnowledge): readonly string[] {
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
export function explain(question: string, productQuery: string | null): string {
  const materials = materialsIn(question, productQuery).slice(0, 2);
  const concepts = conceptsIn(question);
  const parts: string[] = [];
  if (materials.length === 2) parts.push(compareMaterials(materials[0]!, materials[1]!));
  else if (materials.length === 1) parts.push(describeMaterial(materials[0]!));
  for (const c of concepts) parts.push(c.text);
  return parts.join('\n\n');
}

function join(texts: readonly (string | null | undefined)[]): string {
  return texts.filter((t): t is string => typeof t === 'string').join(' ');
}
