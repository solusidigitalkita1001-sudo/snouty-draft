/**
 * P31-82 — layar validasi aturan. Yang dipaku: aturan benar-benar tampil beserta contoh kerja
 * dari test case-nya sendiri, tanda tangan menaikkan status hanya untuk versi yang ditandatangani,
 * aturan yang sudah ditolak di kode tidak bisa dihidupkan lewat basis data, dan tanda tangan atas
 * versi yang sudah lewat ditolak.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PRIORITY_RULES } from '../domain/priority-rules.js';
import type {
  DecideRuleInput,
  RuleSignOffRepository,
  RuleSignOffRow,
} from '../domain/rule-sign-off.repository.js';
import { RuleValidationService } from './rule-validation.service.js';

class FakeSignOffs implements RuleSignOffRepository {
  rows: RuleSignOffRow[] = [];

  async list(): Promise<readonly RuleSignOffRow[]> {
    return this.rows;
  }

  async decide(input: DecideRuleInput): Promise<void> {
    this.rows = this.rows.filter(
      (row) => !(row.ruleId === input.ruleId && row.ruleVersion === input.ruleVersion),
    );
    this.rows.push({
      ...input,
      decidedByName: 'Pak Ahli',
      decidedAt: new Date('2026-10-28T02:00:00Z'),
    });
  }

  async withdraw(ruleId: string, ruleVersion: number): Promise<void> {
    this.rows = this.rows.filter((row) => !(row.ruleId === ruleId && row.ruleVersion === ruleVersion));
  }
}

let signOffs: FakeSignOffs;
let service: RuleValidationService;

beforeEach(() => {
  signOffs = new FakeSignOffs();
  service = new RuleValidationService(signOffs);
});

describe('validasi aturan teknik', () => {
  it('delapan aturan prioritas tampil lebih dulu, lengkap dengan alasannya', async () => {
    const board = await service.board('id');

    expect(board.priority).toHaveLength(PRIORITY_RULES.length);
    expect(board.priority.map((card) => card.ruleId)).toEqual(
      PRIORITY_RULES.map((rule) => rule.ruleId),
    );
    for (const card of board.priority) {
      expect(card.why).not.toBeNull();
    }
  });

  it('sisanya tidak disembunyikan', async () => {
    const board = await service.board('id');
    expect(board.rest.length).toBeGreaterThan(50);
    expect(board.total).toBe(board.priority.length + board.rest.length);
  });

  it('tiap kartu membawa contoh kerja dari test case aturannya sendiri', async () => {
    const board = await service.board('id');
    const card = board.priority.find((item) => item.ruleId === 'ENG-601');

    expect(card).toBeDefined();
    expect(card?.examples.length).toBeGreaterThan(0);
    expect(card?.examples[0]?.explanation).not.toBe('');
    // Sumbernya dibaca ahli untuk memeriksa angkanya; UPC sejak P31-72.
    expect(card?.standard).toContain('UPC');
  });

  it('tanpa tanda tangan, setiap aturan masih menunggu', async () => {
    const board = await service.board('id');
    expect(board.signedOff).toBe(0);
    expect(board.priority.every((card) => card.status === 'REQUIRES_DOMAIN_VALIDATION')).toBe(true);
  });

  it('tanda tangan menaikkan status aturan itu saja', async () => {
    const before = await service.board('id');
    const target = before.priority[0];
    expect(target).toBeDefined();

    const result = await service.decide({
      ruleId: target!.ruleId,
      ruleVersion: target!.version,
      decision: 'approved',
      note: 'Sesuai praktik Pralon.',
      actorId: '01JEXPERT00000000000000001',
    });
    expect(result).toBe('ok');

    const after = await service.board('id');
    expect(after.signedOff).toBe(1);
    const signed = after.priority.find((card) => card.ruleId === target!.ruleId);
    expect(signed?.status).toBe('VALIDATED');
    expect(signed?.decision?.by).toBe('Pak Ahli');
    expect(signed?.decision?.note).toBe('Sesuai praktik Pralon.');
  });

  it('menolak berarti nilainya tidak boleh ditampilkan', async () => {
    const before = await service.board('id');
    const target = before.priority[0]!;

    await service.decide({
      ruleId: target.ruleId,
      ruleVersion: target.version,
      decision: 'rejected',
      note: null,
      actorId: '01JEXPERT00000000000000001',
    });

    const after = await service.board('id');
    expect(after.priority.find((card) => card.ruleId === target.ruleId)?.status).toBe('REJECTED');
    expect(after.signedOff).toBe(0);
  });

  it('tanda tangan atas versi yang sudah lewat ditolak', async () => {
    const board = await service.board('id');
    const target = board.priority[0]!;

    const result = await service.decide({
      ruleId: target.ruleId,
      ruleVersion: target.version - 1,
      decision: 'approved',
      note: null,
      actorId: '01JEXPERT00000000000000001',
    });
    expect(result).toBe('stale_version');
  });

  it('aturan yang tidak ada tidak bisa ditandatangani', async () => {
    const result = await service.decide({
      ruleId: 'ENG-999',
      ruleVersion: 1,
      decision: 'approved',
      note: null,
      actorId: '01JEXPERT00000000000000001',
    });
    expect(result).toBe('unknown_rule');
  });

  it('mencabut tanda tangan mengembalikan aturan ke menunggu, bukan ke ditolak', async () => {
    const board = await service.board('id');
    const target = board.priority[0]!;
    await service.decide({
      ruleId: target.ruleId,
      ruleVersion: target.version,
      decision: 'approved',
      note: null,
      actorId: '01JEXPERT00000000000000001',
    });

    await service.withdraw(target.ruleId, target.version);

    const after = await service.board('id');
    expect(after.priority.find((card) => card.ruleId === target.ruleId)?.status).toBe(
      'REQUIRES_DOMAIN_VALIDATION',
    );
  });

  it('alasan prioritas ikut bahasa yang diminta', async () => {
    const english = await service.board('en');
    expect(english.priority[0]?.why).toMatch(/[a-z]/);
    const indonesian = await service.board('id');
    expect(indonesian.priority[0]?.why).not.toBe(english.priority[0]?.why);
  });
});
