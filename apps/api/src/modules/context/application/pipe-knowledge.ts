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
import type { KnowledgeTopicLabel } from '../../understanding/domain/labels.js';

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
  /** Keluarga produk kanonis (kosakata `data/understanding/vocabulary.json`) yang berarti bahan ini. */
  readonly families: readonly string[];
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
  /** Label katalog `knowledge-topic` di `data/understanding/` — contoh pertanyaannya hidup di sana. */
  readonly topic: KnowledgeTopicLabel;
  /** Keluarga produk kanonis yang dengan sendirinya menyinggung konsep ini ("pvc aw" → kelas PVC). */
  readonly families?: readonly string[];
  readonly text: string;
  readonly textEn: string;
}

export const MATERIALS: readonly MaterialKnowledge[] = [
  {
    family: 'PVC',
    label: 'PVC (uPVC)',
    // "pipa AW" adalah PVC kelas AW — kelasnya disebut, bahannya tersirat.
    families: ['pvc', 'pvc aw', 'pvc d', 'pvc c'],
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
    families: ['hdpe'],
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
    families: ['ppr'],
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
    families: ['galvanis'],
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
    text: 'Fitting adalah komponen penyambung pipa — sok (socket), tee, elbow/knee, reducer, katup — yang mengubah arah, membagi cabang, mengubah ukuran, atau menyambung dua batang. Fitting dibuat dari bahan yang sama dengan pipanya (PVC untuk PVC, HDPE untuk HDPE) supaya sambungannya cocok.',
    textEn:
      'Fittings are the connecting parts of a pipe run — sockets, tees, elbows, reducers, valves — that change direction, split a branch, change size, or join two lengths. They are made of the same material as the pipe (PVC for PVC, HDPE for HDPE) so the joint matches.',
  },
  // ── Dari materi internal Pralon (OQ-54): "Snouty Product Knowledge Master — uPVC PRALON" v1.0,
  //    data/company/Snouty_Product_Knowledge_Master.md. Hanya yang kualitatif dan konsisten;
  //    angka yang dokumen itu tandai "perlu validasi" tidak dibawa ke sini. ─────────────────
  {
    topic: 'upvc',
    text: 'uPVC adalah unplasticized PVC — PVC tanpa penambahan plasticizer, sehingga kaku. Sifat yang membuatnya lazim untuk pipa: tahan karat, permukaan dalam licin, ringan, isolator listrik, tahan terhadap sejumlah bahan kimia air bersih, mudah dipasang dan dirawat. Pipa PVC Pralon (PRALON, PIPPO, JIS, SNI) semuanya uPVC.',
    textEn:
      'uPVC is unplasticized PVC — PVC without added plasticizer, hence rigid. The properties that make it common for pipe: rust-free, smooth bore, light, electrically insulating, resistant to the chemicals found in clean water, easy to install and maintain. Pralon PVC pipe (PRALON, PIPPO, JIS, SNI) is all uPVC.',
  },
  {
    topic: 'istilah dimensi',
    text: 'Istilah ukuran pipa: DN diameter nominal; OD diameter luar; ID diameter dalam; WT (t) tebal dinding; SDR perbandingan diameter luar terhadap tebal dinding; PN tekanan nominal; S seri pipa. Hubungannya: diameter dalam = diameter luar dikurangi dua kali tebal dinding. Ukuran inci pada pipa PVC adalah ukuran nominal — tidak selalu sama dengan diameter aktualnya.',
    textEn:
      'Pipe sizing terms: DN nominal diameter; OD outside diameter; ID inside diameter; WT (t) wall thickness; SDR the ratio of outside diameter to wall thickness; PN nominal pressure; S pipe series. They relate as inside diameter = outside diameter minus twice the wall thickness. Inch sizes on PVC pipe are nominal — not always the actual diameter.',
  },
  {
    topic: 'sambungan lem',
    text: 'Sambungan lem (solvent cement) untuk pipa PVC ujung TS End: rapikan bekas potongan, coba dulu kecocokan pipa dengan fitting, tandai kedalaman socket, bersihkan ujung pipa, oleskan solvent cement, masukkan sampai tanda lalu tahan sebentar, bersihkan sisa lem, dan diamkan sampai mengering sebelum dialiri. Solvent cement quick dry untuk ukuran kecil, slow dry untuk ukuran besar; waktu tahan dan waktu kering resminya mengikuti lembar data solvent cement Pralon.',
    textEn:
      'Solvent-cement joints for TS End PVC pipe: deburr the cut end, dry-fit pipe and fitting, mark the socket depth, clean the pipe end, apply solvent cement, push in to the mark and hold briefly, wipe off the excess, and let it cure before pressurising. Quick-dry cement for small sizes, slow-dry for large ones; official hold and cure times follow the Pralon solvent-cement data sheet.',
  },
  {
    topic: 'sambungan rubber ring',
    text: 'Sambungan rubber ring (Bell End): spigot dan socket harus lurus, pipa bersih, cincin karet tidak terbalik dan tidak melipat, lalu dorong dengan pelumas khusus pipa. Jangan memakai oli, gemuk, minyak, atau sabun sebagai pengganti pelumas — merusak karet dan mengganggu kedapnya sambungan.',
    textEn:
      'Rubber-ring (Bell End) joints: spigot and socket aligned straight, pipe clean, the ring neither reversed nor folded, then push home with pipe lubricant. Never substitute oil, grease, or soap for the lubricant — they damage the rubber and compromise the seal.',
  },
  {
    topic: 'jenis fitting',
    text: 'Jenis fitting uPVC dan fungsinya: tee membagi aliran; socket menyambung dua pipa berdiameter sama; elbow dan bend membelokkan arah; reducer menyambung diameter berbeda; cap menutup ujung; faucet socket sambungan dengan ulir dalam (ke keran); valve socket menghubungkan pipa dengan katup. Fitting Pralon dibuat dengan injection moulding dari uPVC, sama bahannya dengan pipanya.',
    textEn:
      'uPVC fitting types and roles: tee splits the flow; socket joins two pipes of the same diameter; elbow and bend change direction; reducer joins different diameters; cap closes an end; faucet socket has a female thread (for taps); valve socket connects pipe to a valve. Pralon fittings are injection-moulded from uPVC, the same material as the pipe.',
  },
  {
    topic: 'penyimpanan',
    text: 'Penyimpanan pipa PVC: hindari sinar matahari langsung jangka panjang dan sumber panas, beri pelindung atau terpal, alasi dari batu dan benda tajam, susun stabil dengan tinggi tumpukan terbatas. Saat diangkut, pipa diangkat, diturunkan, dan dibawa dengan hati-hati — jangan dibanting, digulingkan sembarangan, atau diseret.',
    textEn:
      'Storing PVC pipe: avoid prolonged direct sun and heat sources, cover it, keep it off stones and sharp objects, and stack it stably with limited height. In transport, lift, lower, and carry the pipe with care — never drop, roll carelessly, or drag it.',
  },
  {
    topic: 'perawatan dan gangguan',
    text: 'Perawatan jaringan PVC: periksa visual berkala, bersihkan jalur, lindungi dari panas dan sinar UV, jaga tekanan kerja, periksa bracket dan support, bersihkan tandon, dan cegah kotoran masuk ke jaringan; jangan membersihkan pipa dengan soda api. Gangguan yang lazim: bocor di sambungan (permukaan kotor atau lem kurang merata — perbaiki sambungannya), pipa retak atau pecah (tekanan berlebih atau benturan — potong dan perbaiki), aliran tersumbat (lumpur, kerak, benda asing — bersihkan), pipa melengkung atau kendor (support kurang — tambah support), warna berubah (paparan UV — lindungi dan evaluasi). Perbaikan memakai dresser joint, gibault joint, atau bell repair socket.',
    textEn:
      'Maintaining a PVC network: periodic visual checks, clean the run, protect from heat and UV, keep to the working pressure, check brackets and supports, clean the tank, and keep debris out of the network; never clean pipe with caustic soda. Common faults: leaking joints (dirty surface or uneven cement — remake the joint), cracked or burst pipe (over-pressure or impact — cut out and repair), blocked flow (silt, scale, foreign objects — clean), sagging or loose pipe (too few supports — add supports), discolouration (UV exposure — protect and assess). Repairs use a dresser joint, gibault joint, or bell repair socket.',
  },
  {
    topic: 'proses produksi',
    text: 'Pipa uPVC Pralon dibuat lewat: penerimaan dan inspeksi material, formulasi oleh R&D, penimbangan, mixing, ekstrusi (bahan yang dilunakkan didorong melalui die), vacuum tank untuk menjaga dimensi, pendinginan spray, marking, haul-off, pemotongan, lalu pembentukan ujung TS End atau Bell End, dan quality control sebelum masuk gudang. Fitting dibuat dengan injection moulding.',
    textEn:
      'Pralon uPVC pipe is made through material receipt and inspection, R&D formulation, weighing, mixing, extrusion (softened material pushed through a die), a vacuum tank to hold dimensions, spray cooling, marking, haul-off, cutting, then TS End or Bell End forming, and quality control before storage. Fittings are injection-moulded.',
  },
  {
    topic: 'uji mutu',
    text: 'Pengendalian mutu pipa uPVC Pralon: setiap produk diperiksa visual (permukaan halus, tidak bergelombang, tidak cacat, warna seragam, pipa lurus) dan dimensinya (diameter luar, ovalitas, tebal dinding, panjang). Uji laboratorium: hidrostatik dan burst, ketahanan methylene chloride, longitudinal reversion, tensile dan elongation, flattening, impact, serta Vicat softening point. Tekanan uji laboratorium bukan tekanan kerja produk — tekanan kerja mengikuti kelas pipanya.',
    textEn:
      'Quality control of Pralon uPVC pipe: every product is checked visually (smooth surface, no waviness or defects, even colour, straight) and dimensionally (outside diameter, ovality, wall thickness, length). Laboratory tests: hydrostatic and burst, methylene-chloride resistance, longitudinal reversion, tensile and elongation, flattening, impact, and Vicat softening point. Laboratory test pressure is not the working pressure — that follows the pipe class.',
  },
  {
    topic: 'penimbunan',
    text: 'Pipa PVC yang ditanam: galian dibuat lebih dalam dari diameter pipa ditambah kedalaman timbunan dan lapisan pasir di dasar; kedalaman timbunan makin besar bila di sisi jalan dan terbesar di bawah jalan besar, dan lebar galian mengikuti diameter pipa. Angka resminya mengikuti pedoman teknik Pralon dan standar penimbunan yang berlaku.',
    textEn:
      'Buried PVC pipe: the trench is deeper than the pipe diameter plus the cover depth and a sand bed; cover is greater beside roads and greatest under major roads, and trench width follows the pipe diameter. Official figures follow Pralon engineering guidance and the applicable burial standard.',
  },
  {
    topic: 'uji tekanan lapangan',
    text: 'Setelah terpasang, jaringan bertekanan diuji dengan tekanan di atas tekanan kerja selama waktu tertentu; sambungan lem diuji setelah lemnya benar-benar kering. Pada jalur panjang atau berelevasi, water hammer dihindari dan katup udara dipasang di titik yang perlu — angka dan letaknya mengikuti pedoman teknik Pralon.',
    textEn:
      'Once installed, a pressurised network is tested above its working pressure for a set period; cemented joints are tested only after the cement has fully cured. On long or elevated runs, water hammer is avoided and air valves placed where needed — figures and positions follow Pralon engineering guidance.',
  },
  {
    topic: 'air panas',
    text: 'Untuk air panas, bahan yang lazim adalah **PPR**: tahan suhu tinggi dan sambungannya dilas panas sehingga menyatu. PVC tidak untuk air panas — melunak dan sambungan lemnya melemah; HDPE pun dirancang untuk air dingin. Jalur air panas di dalam bangunan: PPR untuk pipa dan fitting-nya.',
    textEn:
      'For hot water the usual material is **PPR**: it withstands high temperature and its joints are heat-fused into one piece. PVC is not for hot water — it softens and its glued joints weaken; HDPE is designed for cold water too. Hot-water runs inside a building: PPR for both pipe and fittings.',
  },
  {
    topic: 'kelas pvc',
    families: ['pvc aw', 'pvc d', 'pvc c'],
    text: 'AW, D, dan C adalah kelas pipa PVC, bukan bahan yang berbeda: AW untuk jalur air bersih bertekanan (dinding paling tebal), D untuk pembuangan dan ventilasi yang mengalir karena gravitasi (dinding lebih tipis), C tanpa tekanan kerja (pelindung dan saluran tak bertekanan). Jadi "pipa AW" adalah pipa PVC kelas bertekanan. Di luar kelas PRALON, ada pipa uPVC standar JIS (VP bertekanan, VU tak bertekanan) dan SNI (seri S untuk air minum, kelas A/B untuk air buangan); PIPPO adalah merek kedua Pralon dengan kelas AW dan D. Tekanan kerja tiap kelas mengikuti spesifikasi produk Pralon.',
    textEn:
      'AW, D, and C are classes of PVC pipe, not different materials: AW for pressurized clean-water lines (thickest wall), D for drainage and venting that flow by gravity (thinner wall), C with no working pressure (sleeves and non-pressure runs). So an "AW pipe" is PVC pipe of the pressure class. Beyond the PRALON classes there is JIS-standard uPVC pipe (VP pressure, VU non-pressure) and SNI pipe (S series for drinking water, classes A/B for drainage); PIPPO is Pralon\'s second brand with AW and D classes. Working pressure per class follows the Pralon product specification.',
  },
  {
    topic: 'pipa tanam',
    text: 'Pipa tanam menanggung beban tanah dan pergerakannya. Bahan yang lentur dengan sambungan yang menyatu lebih toleran terhadap tanah yang bergerak; pipa kaku membutuhkan alas (bedding) dan urugan yang rapi agar tidak retak di sambungan.',
    textEn:
      'Buried pipe carries the load of the soil and its movement. A flexible material with fused joints tolerates moving ground better; rigid pipe needs neat bedding and backfill so it does not crack at the joints.',
  },
  {
    topic: 'bertekanan vs gravitasi',
    text: 'Jalur air bersih bertekanan menuntut pipa dan sambungan yang menahan tekanan dari dalam, sehingga memakai kelas pipa yang lebih tebal (pada PVC: kelas AW). Jalur pembuangan mengalir karena gravitasi dan memakai kelas yang lebih tipis (kelas D).',
    textEn:
      'Pressurized clean water lines need pipe and joints that withstand internal pressure, so they use a thicker pipe class (for PVC: class AW). Drainage lines flow by gravity and use a thinner class (class D).',
  },
  {
    topic: 'kaku vs lentur',
    text: 'Pipa kaku mudah dipasang lurus dan rapi di dalam bangunan, tetapi setiap belokan adalah sambungan. Pipa lentur mengikuti lintasan dengan sambungan lebih sedikit — berguna di luar bangunan dan di bawah tanah.',
    textEn:
      'Rigid pipe is easy to run straight and neat inside a building, but every bend is a joint. Flexible pipe follows the route with fewer joints — useful outside buildings and underground.',
  },
];

/**
 * Bahan yang dimaksud sekumpulan keluarga produk kanonis (dari kosakata `understanding`):
 * "pvc aw" dan "pvc d" sama-sama PVC. Urutan mengikuti urutan keluarga yang diberikan, tanpa
 * duplikat — "bedanya PVC AW dan PVC D" adalah satu bahan, bukan perbandingan dua bahan.
 */
export function materialsFor(families: readonly string[]): readonly MaterialKnowledge[] {
  const found: MaterialKnowledge[] = [];
  for (const family of families) {
    const material = MATERIALS.find((m) => m.families.includes(family.toLowerCase()));
    if (material && !found.includes(material)) found.push(material);
  }
  return found;
}

/**
 * Konsep yang disinggung sekumpulan topik pengetahuan (label katalog `knowledge-topic`) atau
 * keluarga produk yang terikat konsep ("pvc aw" menyinggung kelas PVC).
 */
export function conceptsFor(
  topics: readonly string[],
  families: readonly string[] = [],
): readonly ConceptKnowledge[] {
  const lower = families.map((f) => f.toLowerCase());
  return CONCEPTS.filter(
    (c) => topics.includes(c.topic) || (c.families?.some((f) => lower.includes(f)) ?? false),
  );
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
 * Isinya diambil dari apa yang dibicarakan (bahan yang disebut subjek/pesan, atau jawaban asisten
 * terakhir), bukan dari pesan "bikinin tabelnya" yang memang tidak menyebut apa-apa — pemanggil
 * yang membaca bahan itu dari kosakata. `null` bila tidak ada yang bisa disajikan.
 */
export function reformat(
  format: 'table' | 'bullets' | 'summary',
  context: {
    /** Bahan yang sedang dibicarakan, maksimal tiga dipakai. */
    readonly materials: readonly MaterialKnowledge[];
    /** Jawaban yang disajikan ulang membandingkan fitting dengan satu bahan. */
    readonly fitting: boolean;
  },
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const materials = context.materials.slice(0, 3);
  const fitting = context.fitting;
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

export interface ExplainInput {
  /** Keluarga produk kanonis yang dibicarakan — dari pesan dan dari subjek aktif. */
  readonly families: readonly string[];
  /** Topik pengetahuan yang disinggung — dari pesan dan dari subjek aktif. */
  readonly topics: readonly string[];
  /** Pertanyaan membandingkan ("apa bedanya …"). */
  readonly comparison: boolean;
  /** Pertanyaan tentang bahannya sendiri (definisi/perbandingan), bukan tentang cara/topik. */
  readonly aboutMaterial: boolean;
}

/**
 * Penjelasan deterministik untuk sebuah pertanyaan konsep: perbandingan bila dua bahan
 * disebut, ikhtisar bila satu, ditambah konsep yang disinggung. Kosong bila tidak ada yang
 * dikenali — pemanggil yang memutuskan apa yang terjadi kemudian.
 */
export function explain(input: ExplainInput, locale: Locale = DEFAULT_LOCALE): string {
  const materials = materialsFor(input.families).slice(0, 2);
  const concepts = conceptsFor(input.topics, input.families);
  const parts: string[] = [];
  // "Apa bedanya fitting sama HDPE?" membandingkan komponen dengan bahan — bukan dua bahan.
  // Katakan dulu bahwa keduanya tidak setara, baru jelaskan masing-masing.
  if (materials.length === 1 && concepts.some((c) => c.topic === 'fitting') && input.comparison) {
    const m = materials[0]!;
    parts.push(
      locale === 'en'
        ? `**${m.en.label}** is a pipe material, while a **fitting** is a connecting part — so they are not two options to choose between. ${m.en.label} fittings exist too; they are what joins ${m.en.label} pipe.`
        : `**${m.label}** adalah bahan pipa, sedangkan **fitting** adalah komponen penyambungnya — jadi keduanya bukan dua pilihan yang dibandingkan. Fitting ${m.label} pun ada; itulah yang menyambung pipa ${m.label}.`,
    );
  }
  if (materials.length === 2) parts.push(compareMaterials(materials[0]!, materials[1]!, locale));
  else if (materials.length === 1) parts.push(describeMaterial(materials[0]!, locale));
  const conceptTexts = concepts.map((c) => (locale === 'en' ? c.textEn : c.text));
  // Pertanyaan tentang TOPIK ("pvc disimpan di luar boleh?", "cara nyambung pvc?") dibuka dengan
  // topiknya; ikhtisar bahan menyusul. Pertanyaan tentang bahannya sendiri ("apa itu PVC?",
  // "bedanya…") tetap dibuka dengan bahan.
  const aboutMaterialItself = materials.length === 2 || input.aboutMaterial;
  const ordered =
    conceptTexts.length > 0 && !aboutMaterialItself
      ? [...conceptTexts, ...parts]
      : [...parts, ...conceptTexts];
  return ordered.join('\n\n');
}
