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
  /** Keluarga yang merupakan JENIS FITTING (tee, elbow): digabung dengan bahannya saat mencari katalog. */
  fittingFamilies: z.array(z.string().trim().min(1)).default([]),
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
  private readonly knowledgeOnly: ReadonlySet<string>;
  private readonly fittings: ReadonlySet<string>;
  private readonly aliases: ReadonlyMap<string, readonly string[]>;

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

  /** Keluarga yang dicari ke katalog Pralon (bukan keluarga yang hanya pengetahuan, mis. galvanis). */
  isCatalogFamily(family: string): boolean {
    return !this.knowledgeOnly.has(family.toLowerCase());
  }

  /** Alias sebuah keluarga kanonis (tanpa nama kanonisnya sendiri). */
  aliasesOf(family: string): readonly string[] {
    const key = family.toLowerCase();
    return (this.aliases.get(key) ?? []).filter((a) => a !== key);
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
