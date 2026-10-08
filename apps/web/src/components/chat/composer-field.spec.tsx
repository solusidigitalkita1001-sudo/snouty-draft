import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComposerField } from './composer-field';

const field = (focusToken?: number) => (
  <ComposerField
    value=""
    onChange={() => {}}
    onSubmit={() => {}}
    placeholder="Tulis pesan"
    ariaLabel="Tulis pesan"
    className=""
    {...(focusToken === undefined ? {} : { focusToken })}
  />
);

describe('ComposerField — fokus dari luar', () => {
  it('tanpa token tidak merebut fokus; token yang naik memfokuskan kolom ketik', () => {
    const { rerender } = render(field());
    const input = screen.getByLabelText('Tulis pesan');
    expect(document.activeElement).not.toBe(input);
    rerender(field(1));
    expect(document.activeElement).toBe(input);
  });
});
