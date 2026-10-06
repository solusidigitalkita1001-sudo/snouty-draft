/**
 * Fase 1 — registry parameter, asumsi, ketergantungan, kesiapan. Yang dipaku: kosakata unik
 * dan lengkap (label + pertanyaan bahasa pengguna), asumsi beridentitas dengan rujukan,
 * kekurangan transitif, dan kesiapan yang berbeda per keluaran.
 */
import { describe, expect, it } from 'vitest';
import { ASSUMPTIONS, apply, assumptionsFor } from './assumptions.js';
import { DEPENDENCIES, missingInputsFor } from './dependencies.js';
import { PARAMETERS, isParameterKey, parameterDefinition } from './registry.js';
import { resolveReadiness } from './readiness.js';

describe('ParameterRegistry', () => {
  it('kunci unik; setiap parameter punya label, pertanyaan bahasa pengguna, dan alasan', () => {
    const keys = PARAMETERS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of PARAMETERS) {
      expect(p.label.length).toBeGreaterThan(2);
      expect(p.question.endsWith('?')).toBe(true);
      expect(p.question).not.toMatch(/static head|Q design|input/i); // bukan jargon mentah
      expect(p.reason.length).toBeGreaterThan(5);
      if (p.kind === 'enum') expect(p.options?.length ?? 0).toBeGreaterThan(1);
      if (p.kind === 'number') expect(p.unit).toBeDefined();
    }
    expect(parameterDefinition('source_elevation').question).toContain(
      'lebih rendah atau lebih tinggi',
    );
    expect(isParameterKey('static_head')).toBe(true);
    expect(isParameterKey('foo')).toBe(false);
  });
});

describe('EngineeringAssumptionRegistry', () => {
  it('ID unik, setiap asumsi punya rujukan dan deskripsi, parameter terdaftar', () => {
    const ids = ASSUMPTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ASSUMPTIONS) {
      expect(a.reference.length).toBeGreaterThan(5);
      expect(a.description.length).toBeGreaterThan(10);
      expect(isParameterKey(a.parameter)).toBe(true);
      expect(a.confirmationRequired).toBe(true); // belum ada yang divalidasi
    }
  });

  it('asumsi per kasus: irigasi mendapat debit awal + yang umum; bangunan tidak mendapat debit irigasi', () => {
    const irrigation = assumptionsFor('irrigation').map((a) => a.id);
    expect(irrigation).toContain('IRRIGATION_PRELIMINARY_FLOW_FLOOD');
    expect(irrigation).toContain('DESIGN_VELOCITY_PLASTIC');
    expect(assumptionsFor('residential_clean_water').map((a) => a.id)).not.toContain(
      'IRRIGATION_PRELIMINARY_FLOW_FLOOD',
    );
    expect(apply('DESIGN_VELOCITY_PLASTIC')).toMatchObject({
      parameter: 'design_velocity',
      value: 1.5,
      unit: 'm/s',
    });
  });
});

describe('ParameterDependencyResolver', () => {
  it('keluaran unik; kekurangan transitif: pump_duty tanpa apa-apa → debit, tinggi statis, panjang jalur, diameter, bahan', () => {
    const outputs = DEPENDENCIES.map((d) => d.output);
    expect(new Set(outputs).size).toBe(outputs.length);
    const missing = missingInputsFor('pump_duty', new Set());
    expect(missing).toEqual(
      expect.arrayContaining([
        'design_flow',
        'static_head',
        'nominal_diameter',
        'route_length',
        'material',
      ]),
    );
    expect(missingInputsFor('pump_duty', new Set(['design_flow', 'total_dynamic_head']))).toEqual(
      [],
    );
  });
});

describe('ReadinessResolver', () => {
  it('kesiapan berbeda per keluaran: bahan bisa siap saat sizing pipa masih kurang data', () => {
    const r = resolveReadiness({
      known: new Set(['fluid_type', 'installation_location']),
      assumed: new Set(),
    });
    expect(r.readiness.material_selection).toBe('partial'); // masih ada yang bisa memperbaiki
    expect(r.readiness.pipe_sizing).toBe('missing_data');
    expect(r.missing.pipe_sizing).toEqual(expect.arrayContaining(['design_flow', 'route_length']));
    expect(r.readiness.pump_sizing).toBe('missing_data');
  });

  it('masukan wajib lewat asumsi → partial, bukan ready; semua diketahui + tidak ada yang memperbaiki → ready', () => {
    const base = [
      'design_flow',
      'route_length',
      'material',
      'static_head',
      'required_pressure',
      'design_velocity',
      'allowable_head_loss',
    ];
    const assumed = resolveReadiness({
      known: new Set([
        'route_length',
        'material',
        'static_head',
        'required_pressure',
        'design_velocity',
        'allowable_head_loss',
      ]),
      assumed: new Set(['design_flow']),
    });
    expect(assumed.readiness.pipe_sizing).toBe('partial');
    const ready = resolveReadiness({ known: new Set(base), assumed: new Set() });
    expect(ready.readiness.pipe_sizing).toBe('ready');
    expect(ready.missing.pipe_sizing).toEqual([]);
  });

  it('BOM butuh geometri: tanpa panjang/lebar lahan tetap partial walau jalur diketahui', () => {
    const r = resolveReadiness({
      known: new Set(['route_length', 'design_flow', 'material', 'nominal_diameter']),
      assumed: new Set(),
    });
    expect(r.readiness.bom).toBe('partial');
    expect(r.improvable.bom).toEqual(expect.arrayContaining(['field_length', 'field_width']));
  });
});
