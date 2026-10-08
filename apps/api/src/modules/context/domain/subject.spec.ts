/**
 * Subjek percakapan & penyelesaian rujukan (Fase 16, P16-11): lanjutan diselesaikan terhadap subjek
 * aktif; kedalaman naik; subjek hanya berganti bila topik berganti. Bentuk kalimat datang dari
 * pemahaman (data); yang diuji di sini adalah PAGAR dan aturan penyelesaiannya.
 */
import { describe, expect, it } from 'vitest';
import { understood } from '../../understanding/testing/understood.js';
import {
  COMPANY_ENTITY,
  FITTING_VS_MATERIAL,
  companyTopicOf,
  intentForSubject,
  isChoiceFollowUp,
  isFollowUp,
  isFormatFollowUp,
  productSubject,
  resolveCompanySubject,
} from './subject.js';

describe('isFollowUp — lanjutan yang tidak berdiri sendiri', () => {
  it('bentuk lanjutan tanpa produk/kebutuhan baru adalah lanjutan', () => {
    expect(isFollowUp(understood('boleh', { intent: 'follow_up_continue' }))).toBe(true);
    expect(isFollowUp(understood('lengkap dong', { intent: 'follow_up_more' }))).toBe(true);
    expect(isFollowUp(understood('yang tadi', { intent: 'follow_up_reference' }))).toBe(true);
    expect(isFollowUp(understood('tell me more', { intent: 'follow_up_more' }))).toBe(true);
  });

  it('bentuk lanjutan yang menyebut produk atau kebutuhan membawa topik baru — bukan lanjutan', () => {
    expect(
      isFollowUp(understood('lebih detail soal HDPE dong', { intent: 'follow_up_more' })),
    ).toBe(false);
    expect(
      isFollowUp(
        understood('lanjut, rumah 2 lantai 3 kamar mandi', { intent: 'follow_up_continue' }),
      ),
    ).toBe(false);
  });

  it('intent lain bukan lanjutan, walau pendek', () => {
    expect(isFollowUp(understood('pralon itu apa?', { intent: 'company_question' }))).toBe(false);
    expect(isFollowUp(understood('ok', { intent: 'ack' }))).toBe(false);
    expect(isFollowUp(understood('', { intent: null }))).toBe(false);
  });
});

describe('resolveCompanySubject', () => {
  it('"PT Pralon yang gw maksud" → entitas perusahaan, ikhtisar, kedalaman standar', () => {
    const { subject, resolvedFromPrevious } = resolveCompanySubject(
      understood('PT Pralon yang gw maksud', { intent: 'company_question' }),
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
    const first = resolveCompanySubject(
      understood('company profile PT Pralon', {
        intent: 'company_question',
        companyTopic: 'company_profile',
      }),
      undefined,
    ).subject;
    expect(first.topic).toBe('company_profile');
    expect(first.depth).toBe('detailed');
    const next = resolveCompanySubject(
      understood('lengkap dong', { intent: 'follow_up_more', depth: 'comprehensive' }),
      first,
    );
    expect(next.resolvedFromPrevious).toBe(true);
    expect(next.subject.kind).toBe('company');
    expect(next.subject.topic).toBe('company_profile');
    expect(next.subject.depth).toBe('comprehensive');
  });

  it('TEST D: "jelasin PT Pralon" lalu "semuanya" → subjek perusahaan, semuanya = comprehensive', () => {
    const first = resolveCompanySubject(
      understood('jelasin PT Pralon', { intent: 'company_question' }),
      undefined,
    ).subject;
    const next = resolveCompanySubject(
      understood('semuanya', { intent: 'follow_up_more', depth: 'comprehensive' }),
      first,
    ).subject;
    expect(next.kind).toBe('company');
    expect(next.entity).toBe(COMPANY_ENTITY);
    expect(next.depth).toBe('comprehensive');
  });

  it('"boleh" tanpa permintaan kedalaman menaikkan satu tingkat; mentok di comprehensive', () => {
    const boleh = understood('boleh', { intent: 'follow_up_continue' });
    const s0 = resolveCompanySubject(
      understood('PT Pralon yang gw maksud', { intent: 'company_question' }),
      undefined,
    ).subject;
    const s1 = resolveCompanySubject(boleh, s0).subject;
    const s2 = resolveCompanySubject(boleh, s1).subject;
    const s3 = resolveCompanySubject(boleh, s2).subject;
    expect([s1.depth, s2.depth, s3.depth]).toEqual(['detailed', 'comprehensive', 'comprehensive']);
  });

  it('topik baru di dalam perusahaan mengganti topik, bukan entitas', () => {
    const s0 = resolveCompanySubject(
      understood('company profile PT Pralon', {
        intent: 'company_question',
        companyTopic: 'company_profile',
      }),
      undefined,
    ).subject;
    const s1 = resolveCompanySubject(
      understood('sejarahnya gimana?', { intent: 'company_question', companyTopic: 'history' }),
      s0,
    ).subject;
    expect(s1.entity).toBe(COMPANY_ENTITY);
    expect(s1.topic).toBe('history');
    expect(
      companyTopicOf(understood('alamat kantornya di mana?', { companyTopic: 'contact' })),
    ).toBe('contact');
    expect(companyTopicOf(understood('pralon itu apa?', { intent: 'company_question' }))).toBe(
      'company_overview',
    );
  });
});

describe('isFormatFollowUp & isChoiceFollowUp — pagar atas bentuk yang dikenali', () => {
  it('permintaan ubah bentuk tanpa bahan baru adalah lanjutan; dengan bahan baru bukan', () => {
    expect(
      isFormatFollowUp(
        understood('bikinin skema perbedaan nya dalam bentuk table dong', {
          intent: 'follow_up_reformat',
          format: 'table',
        }),
      ),
    ).toBe(true);
    expect(
      isFormatFollowUp(
        understood('ringkas dong', { intent: 'follow_up_brief', format: 'summary' }),
      ),
    ).toBe(true);
    expect(
      isFormatFollowUp(
        understood('bandingin pvc sama hdpe dalam bentuk tabel', {
          intent: 'product_comparison',
          format: 'table',
        }),
      ),
    ).toBe(false);
    expect(isFormatFollowUp(understood('apa itu PPR?', { intent: 'product_concept' }))).toBe(false);
  });

  it('"yang mana buat kamar mandi?" — lanjutan pilihan walau menyebut tempat pakai; menyebut bahan → bukan', () => {
    expect(
      isChoiceFollowUp(understood('yang mana buat kamar mandi?', { intent: 'follow_up_choice' })),
    ).toBe(true);
    expect(isChoiceFollowUp(understood('which one?', { intent: 'follow_up_choice' }))).toBe(true);
    expect(
      isChoiceFollowUp(understood('yang mana, pvc atau hdpe?', { intent: 'follow_up_choice' })),
    ).toBe(false);
    expect(
      isChoiceFollowUp(understood('apa bedanya pvc sama hdpe?', { intent: 'product_comparison' })),
    ).toBe(false);
  });
});

describe('productSubject & intentForSubject', () => {
  it('TEST E: setelah perusahaan, "produk HDPE nya gimana?" berpindah ke subjek produk HDPE', () => {
    const company = resolveCompanySubject(
      understood('company profile PT Pralon', { intent: 'company_question' }),
      undefined,
    ).subject;
    const next = productSubject(
      'hdpe',
      understood('produk HDPE nya gimana?', { intent: 'product_concept' }),
      company,
    );
    expect(next.kind).toBe('product');
    expect(next.entity).toBe('hdpe');
    expect(next.topic).toBe('product_overview');
  });

  it('lanjutan atas subjek produk mewarisi entitasnya dan naik kedalaman', () => {
    const pvc = productSubject(
      'pvc aw',
      understood('apa itu PVC AW?', { intent: 'product_concept' }),
      undefined,
    );
    const more = productSubject(
      null,
      understood('lebih detail dong', { intent: 'follow_up_more', depth: 'detailed' }),
      pvc,
    );
    expect(more.entity).toBe('pvc aw');
    expect(more.depth).toBe('detailed');
  });

  it('perbandingan dengan subjek aktif menggabungkan entitas; fitting vs satu bahan disimpan sebagai topiknya', () => {
    const hdpe = productSubject(
      'hdpe',
      understood('apa bedanya fitting sama hdpe?', {
        intent: 'product_comparison',
        knowledgeTopics: ['fitting'],
      }),
      undefined,
    );
    expect(hdpe).toMatchObject({ kind: 'product', entity: 'hdpe', topic: FITTING_VS_MATERIAL });
    const both = productSubject(
      'pvc',
      understood('coba bandingin sama pipa PVC', { intent: 'product_comparison' }),
      hdpe,
    );
    expect(both.entity).toBe('hdpe dan pvc');
    expect(both.topic).toBe('comparison');
  });

  it('intent lanjutan mengikuti jenis subjek', () => {
    expect(intentForSubject('company')).toBe('COMPANY_QUESTION');
    expect(intentForSubject('product')).toBe('PRODUCT_LOOKUP');
    expect(intentForSubject('case')).toBe('REQUIREMENT_STATEMENT');
  });
});
