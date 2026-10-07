/**
 * TechnicalCaseClassifier (brief §2 — fase 2). Deterministik, dari isyarat teks.
 *
 * Model bahasa hanya dipanggil bila ini ragu (confidence rendah) — dan itu keputusan pemanggil
 * di lapisan aplikasi, bukan di sini. Isyarat ditimbang: kata yang khas untuk satu kasus
 * ("gorong-gorong", "sawah") lebih berat daripada kata yang muncul di banyak kasus ("pompa").
 */

import type { CaseId } from './profiles.js';

interface Signal {
  readonly pattern: RegExp;
  readonly weight: number;
}

const SIGNALS: Readonly<Record<CaseId, readonly Signal[]>> = {
  fish_pond: [
    {
      pattern:
        /\btambak\b|\blele\b|\bnila\b|\bgurame\b|\bbioflok\b|budidaya|\bkoi\b|\bikan\b|fish ?pond|\bpond\b|tilapia|catfish|aquaculture|biofloc/i,
      weight: 5,
    },
    { pattern: /\bkolam\b|\bbak\b|pengurasan|\bkuras\b|\bfish tank\b/i, weight: 3 },
  ],
  culvert: [
    { pattern: /gorong[- ]gorong|culvert|box culvert/i, weight: 5 },
    {
      pattern:
        /melintas(i)? jalan|menyeberang(i)? jalan|lintas(an)? jalan|bawah jalan|under the road|road crossing|crosses? the road|under a (?:\d+(?:[.,]\d+)? ?m )?road/i,
      weight: 3,
    },
  ],
  stormwater: [
    {
      pattern:
        /\bair hujan\b|\bhujan\b|limpasan|curah hujan|talang|banjir|rain ?water|storm ?water|runoff|rainfall|\bgutters?\b|\bfloods?\b|\bflooding\b/i,
      weight: 4,
    },
    { pattern: /\bdrainase\b|\bdrainage\b/i, weight: 1 },
  ],
  irrigation: [
    {
      pattern:
        /\birigasi\b|\bsawah\b|perkebunan|\bpertanian\b|\bladang\b|irrigation|paddy|rice field|\bfarm(?:land)?\b|orchard|plantation/i,
      weight: 5,
    },
    { pattern: /\bkebun\b|sprinkler|springkel|\btetes\b|\bdrip\b|siram|sprinklers?/i, weight: 3 },
  ],
  gravity_drainage: [
    {
      pattern:
        /\bdrainase\b|\bselokan\b|\bgot\b|air kotor|\blimbah\b|pembuangan|septic|septik|(?<!rain ?water |storm ?water |rain |storm )\bdrainage\b|\bdrains?\b|\bsewer\b|\bsewage\b|wastewater/i,
      weight: 4,
    },
    { pattern: /gravitasi|kemiringan|\bslope\b|\bgravity\b|\bgradient\b/i, weight: 2 },
  ],
  well_distribution: [
    {
      pattern:
        /sumur bor|sumur dalam|submersible|pompa sumur|\bsumur\b|borehole|deep well|well pump|\bwell\b/i,
      weight: 4,
    },
    { pattern: /kedalaman|jet ?pump|well depth/i, weight: 2 },
  ],
  pump_transfer: [
    {
      pattern:
        /\btransfer\b|memompa|dipompa|kirim air|naikkan air|mengalirkan air|alirkan air|dorong air|\bpumping\b|pump (?:the )?water/i,
      weight: 4,
    },
    {
      pattern: /\btandon\b|\breservoir\b|\bembung\b|penampungan|\btanks?\b|\belevation\b/i,
      weight: 2,
    },
    { pattern: /\bpompa\b|\bpump\b/i, weight: 1 },
    { pattern: /\b\d+(?:[.,]\d+)?\s*(km|m|meter)\b/i, weight: 1 },
  ],
  residential_cluster: [
    {
      pattern:
        /\bcluster\b|\bklaster\b|\bperumahan\b|\bkomplek(s)?\b|\bkavling\b|town ?house|housing (?:estate|complex)|subdivision/i,
      weight: 5,
    },
    { pattern: /\b\d+\s*(units?|rumah|kk|sambungan|houses|homes)\b/i, weight: 3 },
  ],
  multistorey_building_water: [
    {
      pattern:
        /\bgedung\b|\bapartemen\b|\bhotel\b|\brusun\b|\bbertingkat\b|high ?rise|\btower\b|apartment|multi-?stor(?:ey|y)/i,
      weight: 4,
    },
    { pattern: /\b(?:[4-9]|[1-9]\d)\s*-?\s*(?:lantai|floors|stor(?:eys|ies|ey|y))\b/i, weight: 4 },
    { pattern: /\bbooster\b|\briser\b|zonasi/i, weight: 2 },
  ],
  residential_clean_water: [
    { pattern: /\brumah\b|\bkos\b|\bkost\b|\bruko\b|\bvilla\b/i, weight: 3 },
    {
      pattern: /kamar mandi|wastafel|\bdapur\b|\btoren\b|titik air|\bkeran\b|\bshower\b/i,
      weight: 3,
    },
    { pattern: /\b[1-3]\s*-?\s*(?:lantai|floors?|stor(?:eys?|ies|y))\b/i, weight: 2 },
    { pattern: /air bersih|\bpdam\b/i, weight: 1 },
  ],
};

/** Urutan pemenang bila skor seri: kasus yang lebih khas menang atas yang lebih umum. */
const TIE_ORDER: readonly CaseId[] = [
  'culvert',
  'fish_pond',
  'irrigation',
  'stormwater',
  'well_distribution',
  'residential_cluster',
  'multistorey_building_water',
  'gravity_drainage',
  'pump_transfer',
  'residential_clean_water',
];

export interface CaseClassification {
  readonly primary: CaseId | null;
  /** Kasus kedua yang juga terbaca — misal irigasi + transfer pompa. */
  readonly secondary: CaseId | null;
  /** 0–1; < 0,5 berarti pemanggil sebaiknya bertanya atau meminta model menimbang. */
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export function classifyCase(message: string): CaseClassification {
  const scores = new Map<CaseId, number>();
  const evidence: string[] = [];
  for (const id of TIE_ORDER) {
    let score = 0;
    for (const signal of SIGNALS[id]) {
      // Dua isyarat berbeda dari pola yang sama ("irigasi" DAN "sawah") memperkuat; lebih dari
      // dua tidak — supaya kalimat panjang tidak menang hanya karena mengulang kata.
      const matches = [...new Set(message.match(new RegExp(signal.pattern.source, 'gi')) ?? [])];
      if (matches.length === 0) continue;
      score += signal.weight * Math.min(2, matches.length);
      evidence.push(`${id}:${matches.join('|').toLowerCase()}`);
    }
    scores.set(id, score);
  }
  const ranked = TIE_ORDER.map((id) => ({ id, score: scores.get(id) ?? 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || TIE_ORDER.indexOf(a.id) - TIE_ORDER.indexOf(b.id));

  const top = ranked[0];
  if (!top) return { primary: null, secondary: null, confidence: 0, evidence };
  const second = ranked[1];
  // Keyakinan: seberapa dominan pemenang atas runner-up, dibatasi oleh kuatnya isyaratnya sendiri.
  const dominance = second ? top.score / (top.score + second.score) : 1;
  const strength = Math.min(1, top.score / 5);
  const confidence = Math.round(Math.min(dominance, strength) * 100) / 100;
  return {
    primary: top.id,
    secondary: second && second.score >= 3 ? second.id : null,
    confidence,
    evidence,
  };
}
