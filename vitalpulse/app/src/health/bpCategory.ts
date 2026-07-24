/**
 * Maps a blood pressure reading to the published American Heart Association
 * category ranges.
 *
 * This is *reference information*, not a diagnosis: the AHA categories are
 * public, well-known thresholds, and showing where a number falls against
 * them is the single most useful thing a BP logbook can do. Every surface
 * that renders a category also carries the "reference, not a diagnosis —
 * talk to your doctor" framing, and nothing here ever tells a user what to
 * do about a reading.
 *
 * Source: https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
 */
export type BPCategoryId = 'low' | 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';

export interface BPCategory {
  id: BPCategoryId;
  label: string;
  /** Which palette token to tint the pill with — see theme.status. */
  tone: 'info' | 'good' | 'notice' | 'warn' | 'high' | 'critical';
  /** One plain-language sentence. Never an instruction, always a description. */
  blurb: string;
}

const CATEGORIES: Record<BPCategoryId, BPCategory> = {
  low: {
    id: 'low',
    label: 'Low',
    tone: 'info',
    blurb: 'Below the typical range. Worth mentioning to your doctor, especially with dizziness.',
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    tone: 'good',
    blurb: 'Within the range the AHA describes as normal.',
  },
  elevated: {
    id: 'elevated',
    label: 'Elevated',
    tone: 'notice',
    blurb: 'Above normal but not yet high blood pressure.',
  },
  stage1: {
    id: 'stage1',
    label: 'Stage 1 high',
    tone: 'warn',
    blurb: 'In the AHA’s stage 1 hypertension range.',
  },
  stage2: {
    id: 'stage2',
    label: 'Stage 2 high',
    tone: 'high',
    blurb: 'In the AHA’s stage 2 hypertension range.',
  },
  crisis: {
    id: 'crisis',
    label: 'Very high',
    tone: 'critical',
    blurb: 'At or above the level the AHA calls a hypertensive crisis. Contact a doctor.',
  },
};

/**
 * AHA rules: a reading takes the *higher* of the two categories its systolic
 * and diastolic fall into — so 118/95 is stage 1, not normal.
 */
export function bpCategory(systolic: number, diastolic: number): BPCategory {
  if (systolic >= 180 || diastolic >= 120) return CATEGORIES.crisis;
  if (systolic >= 140 || diastolic >= 90) return CATEGORIES.stage2;
  if (systolic >= 130 || diastolic >= 80) return CATEGORIES.stage1;
  if (systolic >= 120) return CATEGORIES.elevated;
  if (systolic < 90 || diastolic < 60) return CATEGORIES.low;
  return CATEGORIES.normal;
}

/** The band drawn behind the Trends chart as a visual "this is normal" reference. */
export const NORMAL_BAND = { systolic: [90, 120], diastolic: [60, 80] } as const;
