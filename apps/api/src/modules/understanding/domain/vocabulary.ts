/**
 * Kosakata ENTITAS — nama keluarga produk dan merek — dari `data/understanding/vocabulary.json`.
 *
 * Ini pengenalan nama, bukan pemahaman pertanyaan: "hdpe" adalah nama keluarga produk apa pun
 * kalimatnya. Nama yang baru (keluarga produk baru di katalog, merek pesaing baru) ditambah di
 * data, bukan di kode.
 */
import { z } from 'zod';

export const VocabularySchema = z.object({
  /** Merek sendiri — "Pralon" di pesan bukan pesaing dan bukan pertanyaan perusahaan dengan sendirinya. */
  ownBrand: z.array(z.string().trim().min(1)).min(1),
  /** Keluarga produk kanonis → alias yang dipakai pengguna. */
  productFamilies: z.record(z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)),
  /**
   * Keluarga yang hanya PENGETAHUAN (galvanis): dikenali untuk dijelaskan, tetapi bukan produk
   * Pralon — tidak pernah dicari ke katalog, jadi tidak ada klaim "tidak ada di katalog".
   */
  knowledgeOnlyFamilies: z.array(z.string().trim().min(1)).default([]),
  /**
   * Keluarga katalog yang MEWAKILI sebuah bahan saat contoh produknya ditunjukkan ("pvc" → "PVC AW").
   * Tanpa ini contohnya hasil pencarian nama yang urutannya sembarang (audit 2026-10-19: PVC diwakili
   * "Pipa (Bell End) Kelas B 355 mm").
   */
  representativeFamilies: z.record(z.string().trim().min(1), z.string().trim().min(1)).default({}),
  /** Keluarga yang merupakan JENIS FITTING (tee, elbow): digabung dengan bahannya saat mencari katalog. */
  fittingFamilies: z.array(z.string().trim().min(1)).default([]),
  /**
   * Fluida/kondisi yang bahannya butuh validasi teknis (air panas, uap, kimia, air laut): kebutuhan
   * yang menyebutnya keluar dari rekomendasi otomatis (kebijakan cakupan, `policy/scope.ts`).
   */
  outOfScopeFluids: z.array(z.string().trim().min(1)).default([]),
  /** Nama merek pesaing. */
  competitorBrands: z.array(z.string().trim().min(1)),
  /** Rujukan umum ke merek lain ("merek lain", "kompetitor"). */
  competitorReferences: z.array(z.string().trim().min(1)),
  /**
   * Nama hal-hal yang menandai KEBUTUHAN instalasi (bangunan, fixture, sumber air, jenis
   * jalur): pesan yang menyebutnya membawa kebutuhan — aturan presedensinya di `context`.
   */
  requirementEntities: z.array(z.string().trim().min(1)),
});
export type Vocabulary = z.infer<typeof VocabularySchema>;

interface Alias {
  readonly canonical: string;
  readonly pattern: RegExp;
}

function escape(alias: string): string {
  return alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
}

/**
 * Nama pada batas kata, dengan klitik "-nya" yang boleh menempel ("pvcnya", "pralonnya"):
 * tanpa ini "pvcnya gimana?" tidak mengenali PVC (tinjauan 2026-10-08).
 */
function bounded(alias: string): string {
  return `(?<![a-z0-9])${escape(alias)}(?:nya)?(?![a-z0-9])`;
}

/** Pencocokan nama pada batas kata, alias terpanjang dulu supaya "pvc aw" menang atas "pvc". */
export class EntityLexicon {
  private readonly families: readonly Alias[];
  private readonly competitors: RegExp;
  private readonly own: RegExp;
  private readonly requirements: RegExp;
  private readonly outOfScope: RegExp;
  private readonly knowledgeOnly: ReadonlySet<string>;
  private readonly fittings: ReadonlySet<string>;
  private readonly aliases: ReadonlyMap<string, readonly string[]>;
  private readonly representatives: ReadonlyMap<string, string>;

  constructor(vocabulary: Vocabulary) {
    this.families = Object.entries(vocabulary.productFamilies)
      .flatMap(([canonical, aliases]) => aliases.map((alias) => ({ canonical, alias })))
      .sort((a, b) => b.alias.length - a.alias.length)
      .map(({ canonical, alias }) => ({
        canonical,
        pattern: new RegExp(bounded(alias), 'i'),
      }));
    this.knowledgeOnly = new Set(vocabulary.knowledgeOnlyFamilies.map((f) => f.toLowerCase()));
    this.fittings = new Set(vocabulary.fittingFamilies.map((f) => f.toLowerCase()));
    this.representatives = new Map(
      Object.entries(vocabulary.representativeFamilies).map(([k, v]) => [k.toLowerCase(), v]),
    );
    this.aliases = new Map(
      Object.entries(vocabulary.productFamilies).map(([k, v]) => [
        k.toLowerCase(),
        v.map((a) => a.toLowerCase()),
      ]),
    );
    const competitorTerms = [...vocabulary.competitorBrands, ...vocabulary.competitorReferences];
    this.competitors = anyOf(competitorTerms);
    this.own = anyOf(vocabulary.ownBrand);
    this.requirements = anyOf(vocabulary.requirementEntities);
    this.outOfScope = anyOf(vocabulary.outOfScopeFluids);
  }

  /** Keluarga produk yang disebut, kanonis, urut kemunculan, tanpa duplikat. */
  productFamilies(text: string): readonly string[] {
    const found: { canonical: string; at: number }[] = [];
    let remaining = text.toLowerCase();
    for (const { canonical, pattern } of this.families) {
      const match = pattern.exec(remaining);
      if (!match) continue;
      found.push({ canonical, at: match.index });
      // Alias yang sudah dipakai dihapus supaya "pvc" di dalam "pvc aw" tidak dihitung dua kali.
      remaining = remaining.replace(pattern, (m) => ' '.repeat(m.length));
    }
    return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.canonical))];
  }

  /**
   * Teks tanpa nama produk dan merek (Pralon, pesaing, alias keluarga). Nama-nama itu sama di kedua
   * bahasa, jadi tidak boleh ikut menentukan bahasa pesan: "elbow pvc 3 inch ada?" bukan kalimat
   * Inggris (audit 2026-10-19).
   */
  withoutNames(text: string): string {
    let remaining = text.toLowerCase();
    for (const { pattern } of this.families) {
      remaining = remaining.replace(new RegExp(pattern.source, 'gi'), ' ');
    }
    for (const pattern of [this.own, this.competitors]) {
      remaining = remaining.replace(new RegExp(pattern.source, 'gi'), ' ');
    }
    return remaining.replace(/\s+/g, ' ').trim();
  }

  mentionsCompetitor(text: string): boolean {
    return this.competitors.test(text);
  }

  mentionsOwnBrand(text: string): boolean {
    return this.own.test(text);
  }

  /** Menyebut bangunan/fixture/sumber air/jenis jalur — isyarat kebutuhan instalasi. */
  mentionsRequirementEntity(text: string): boolean {
    return this.requirements.test(text);
  }

  /** Menyebut fluida/kondisi di luar cakupan rekomendasi otomatis. */
  mentionsOutOfScopeFluid(text: string): boolean {
    return this.outOfScope.test(text);
  }

  /** Keluarga yang dicari ke katalog Pralon (bukan keluarga yang hanya pengetahuan, mis. galvanis). */
  isCatalogFamily(family: string): boolean {
    return !this.knowledgeOnly.has(family.toLowerCase());
  }

  /** Alias sebuah keluarga kanonis (tanpa nama kanonisnya sendiri). */
  aliasesOf(family: string): readonly string[] {
    const key = family.toLowerCase();
    return (this.aliases.get(key) ?? []).filter((a) => a !== key);
  }

  /** Keluarga katalog yang mewakili istilah ini bila istilahnya persis satu bahan ("pvc" → "PVC AW"). */
  representativeFamily(term: string): string | null {
    const families = this.productFamilies(term);
    if (families.length !== 1 || families[0] !== term.trim().toLowerCase()) return null;
    return this.representatives.get(families[0]!) ?? null;
  }

  /** Keluarga jenis fitting (tee, elbow, …) — bukan bahan. */
  isFittingFamily(family: string): boolean {
    return this.fittings.has(family.toLowerCase());
  }
}

function anyOf(terms: readonly string[]): RegExp {
  if (terms.length === 0) return /$^/;
  return new RegExp(`(?:${terms.map(bounded).join('|')})`, 'i');
}
