export interface PulseReading {
  id: number;
  takenAt: string; // ISO timestamp
  bpm: number;
  hrvRmssdMs: number | null;
  signalQuality: 'good' | 'fair' | 'poor';
}

export interface BloodPressureReading {
  id: number;
  takenAt: string; // ISO timestamp
  systolic: number;
  diastolic: number;
  pulseBpm: number | null;
}

export interface Settings {
  textScaleIndex: number; // index into TEXT_SCALES
  highContrast: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  leftHandCameraMode: boolean;
  onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  textScaleIndex: 1,
  highContrast: false,
  reminderEnabled: false,
  reminderHour: 8,
  reminderMinute: 0,
  leftHandCameraMode: false,
  onboardingComplete: false,
};
