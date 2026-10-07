/**
 * Subjek percakapan & penyelesaian rujukan (Fase 16): "boleh", "lengkap dong", "semuanya"
 * diselesaikan terhadap subjek aktif; kedalaman naik; subjek hanya berganti bila topik berganti.
 */
import { describe, expect, it } from 'vitest';
import {
  COMPANY_ENTITY,
  companyTopicOf,
  intentForSubject,
  isFollowUp,
  isFormatFollowUp,
  productSubject,
  requestedDepth,
  requestedFormat,
  resolveCompanySubject,
} from './subject.js';

describe('isFollowUp — pesan yang tidak berdiri sendiri', () => {
  it.each([
    'boleh',
    'lengkap dong',
    'data nya secara lengkap dong',
    'semuanya, tolong tampilin',
    'yang tadi',
    'lanjut',
    'ok lanjut aja',
    'lebih detail dong',
    'sure, go on',
    'all of it please',
    'tell me more',
  ])('"%s" adalah lanjutan', (message) => {
    expect(isFollowUp(message)).toBe(true);
  });

  it.each([
    'produk HDPE nya gimana?',
    'pralon itu apa?',
    'PT Pralon yang gw maksud',
    'rumah 2 lantai 3 kamar mandi',
    'apa bedanya pvc sama hdpe',
    'company profile PT Pralon',
    '',
  ])('"%s" berdiri sendiri', (message) => {
    expect(isFollowUp(message)).toBe(false);
  });
});

describe('requestedDepth', () => {
  it('membaca singkat / detail / lengkap dari bahasa pengguna', () => {
    expect(requestedDepth('singkat aja')).toBe('brief');
    expect(requestedDepth('jelasin')).toBeNull();
    expect(requestedDepth('lebih detail')).toBe('detailed');
    expect(requestedDepth('semuanya')).toBe('comprehensive');
    expect(requestedDepth('data nya secara lengkap dong')).toBe('comprehensive');
    expect(requestedDepth('everything you have')).toBe('comprehensive');
  });
});

describe('resolveCompanySubject', () => {
  it('"PT Pralon yang gw maksud" → entitas perusahaan, ikhtisar, kedalaman standar', () => {
    const { subject, resolvedFromPrevious } = resolveCompanySubject(
      'PT Pralon yang gw maksud',
      undefined,
    );
    expect(subject).toEqual({
      kind: 'company',
      entity: COMPANY_ENTITY,
      topic: 'company_overview',
      depth: 'standard',
    });
    expect(resolvedFromPrevious).toBe(false);
  });

  it('TEST C: "company profile PT Pralon" lalu "lengkap dong" → tetap profil, kedalaman comprehensive', () => {
    const first = resolveCompanySubject('company profile PT Pralon', undefined).subject;
    expect(first.topic).toBe('company_profile');
    expect(first.depth).toBe('detailed');
    const next = resolveCompanySubject('lengkap dong', first);
    expect(next.resolvedFromPrevious).toBe(true);
    expect(next.subject.kind).toBe('company');
    expect(next.subject.topic).toBe('company_profile');
    expect(next.subject.depth).toBe('comprehensive');
  });

  it('TEST D: "jelasin PT Pralon" lalu "semuanya" → subjek perusahaan, semuanya = comprehensive', () => {
    const first = resolveCompanySubject('jelasin PT Pralon', undefined).subject;
    const next = resolveCompanySubject('semuanya', first).subject;
    expect(next.kind).toBe('company');
    expect(next.entity).toBe(COMPANY_ENTITY);
    expect(next.depth).toBe('comprehensive');
  });

  it('"boleh" tanpa permintaan kedalaman menaikkan satu tingkat; mentok di comprehensive', () => {
    const s0 = resolveCompanySubject('PT Pralon yang gw maksud', undefined).subject;
    const s1 = resolveCompanySubject('boleh', s0).subject;
    const s2 = resolveCompanySubject('boleh', s1).subject;
    const s3 = resolveCompanySubject('boleh', s2).subject;
    expect([s1.depth, s2.depth, s3.depth]).toEqual(['detailed', 'comprehensive', 'comprehensive']);
  });

  it('topik baru di dalam perusahaan mengganti topik, bukan entitas', () => {
    const s0 = resolveCompanySubject('company profile PT Pralon', undefined).subject;
    const s1 = resolveCompanySubject('sejarahnya gimana?', s0).subject;
    expect(s1.entity).toBe(COMPANY_ENTITY);
    expect(s1.topic).toBe('history');
    expect(companyTopicOf('alamat kantornya di mana?')).toBe('contact');
    expect(companyTopicOf('pabriknya di mana?')).toBe('manufacturing');
    expect(companyTopicOf('visi misinya apa?')).toBe('vision_mission');
  });
});

describe('requestedFormat & isFormatFollowUp — permintaan ubah bentuk jawaban', () => {
  it('tabel / poin / ringkas dikenali; pesan yang merujuk jawaban sebelumnya adalah lanjutan', () => {
    expect(
      requestedFormat('bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca'),
    ).toBe('table');
    expect(requestedFormat('poin-poinnya aja')).toBe('bullets');
    expect(requestedFormat('ringkas dong')).toBe('summary');
    expect(requestedFormat('apa itu PPR?')).toBeNull();
    expect(
      isFormatFollowUp(
        'bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca',
      ),
    ).toBe(true);
    expect(isFormatFollowUp('can you put that in a table?')).toBe(true);
    expect(isFormatFollowUp('tabel')).toBe(true);
    expect(isFormatFollowUp('rumah 2 lantai 3 kamar mandi')).toBe(false);
  });
});

describe('productSubject & intentForSubject', () => {
  it('TEST E: setelah perusahaan, "produk HDPE nya gimana?" berpindah ke subjek produk HDPE', () => {
    const company = resolveCompanySubject('company profile PT Pralon', undefined).subject;
    const next = productSubject('hdpe', 'produk HDPE nya gimana?', company);
    expect(next.kind).toBe('product');
    expect(next.entity).toBe('hdpe');
    expect(next.topic).toBe('product_overview');
  });

  it('lanjutan atas subjek produk mewarisi entitasnya dan naik kedalaman', () => {
    const pvc = productSubject('pvc aw', 'apa itu PVC AW?', undefined);
    const more = productSubject(null, 'lebih detail dong', pvc);
    expect(more.entity).toBe('pvc aw');
    expect(more.depth).toBe('detailed');
  });

  it('intent lanjutan mengikuti jenis subjek', () => {
    expect(intentForSubject('company')).toBe('COMPANY_QUESTION');
    expect(intentForSubject('product')).toBe('PRODUCT_LOOKUP');
    expect(intentForSubject('case')).toBe('REQUIREMENT_STATEMENT');
  });
});
