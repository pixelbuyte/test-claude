import { bpCategory } from '../bpCategory';

describe('bpCategory', () => {
  it('classifies a textbook normal reading', () => {
    expect(bpCategory(115, 75).id).toBe('normal');
  });

  it('classifies elevated (systolic 120-129 with normal diastolic)', () => {
    expect(bpCategory(125, 75).id).toBe('elevated');
  });

  it('classifies stage 1', () => {
    expect(bpCategory(135, 85).id).toBe('stage1');
  });

  it('classifies stage 2', () => {
    expect(bpCategory(145, 95).id).toBe('stage2');
  });

  it('classifies a hypertensive crisis reading', () => {
    expect(bpCategory(185, 125).id).toBe('crisis');
    expect(bpCategory(160, 122).id).toBe('crisis');
  });

  it('classifies low readings', () => {
    expect(bpCategory(85, 55).id).toBe('low');
  });

  it('takes the HIGHER of the two categories when systolic and diastolic disagree', () => {
    // Systolic alone reads normal, but diastolic 95 is stage 2 territory.
    expect(bpCategory(118, 95).id).toBe('stage2');
    // Systolic alone reads stage 1, diastolic is normal.
    expect(bpCategory(135, 70).id).toBe('stage1');
  });

  it('handles category boundaries exactly', () => {
    expect(bpCategory(119, 79).id).toBe('normal');
    expect(bpCategory(120, 79).id).toBe('elevated');
    expect(bpCategory(129, 79).id).toBe('elevated');
    expect(bpCategory(130, 79).id).toBe('stage1');
    expect(bpCategory(139, 89).id).toBe('stage1');
    expect(bpCategory(140, 89).id).toBe('stage2');
    expect(bpCategory(179, 119).id).toBe('stage2');
    expect(bpCategory(180, 119).id).toBe('crisis');
  });

  it('gives every category a label and a non-empty blurb', () => {
    const samples: [number, number][] = [
      [85, 55],
      [115, 75],
      [125, 75],
      [135, 85],
      [145, 95],
      [185, 125],
    ];
    for (const [s, d] of samples) {
      const c = bpCategory(s, d);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(0);
    }
  });
});
