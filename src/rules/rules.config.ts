export const RuleIds = {
  deepDischargeWarning: 'deep_discharge_warning',
  deepDischargeCritical: 'deep_discharge_critical',
  idleDrain: 'idle_drain',
  rapidDrop: 'rapid_drop',
  slowCharge: 'slow_charge',
  temperatureHigh: 'temperature_high',
  temperatureLow: 'temperature_low',
} as const;

export type RuleId = (typeof RuleIds)[keyof typeof RuleIds];

export type HealthStatus = 'GOOD' | 'MODERATE' | 'POOR';

export type StatusBand = {
  threshold: number;
  status: HealthStatus;
};

export type AlertTemplate = {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
};

export type TipTemplate = {
  message: string;
};

export type RuleTemplate = {
  id: string;
  label: string;
  description: string;
  deduction: number;
  alert: AlertTemplate;
  tip: TipTemplate;
};

export const rulesConfig = {
  baseScore: 100,
  statusBands: [
    { threshold: 80, status: 'GOOD' },
    { threshold: 60, status: 'MODERATE' },
    { threshold: 0, status: 'POOR' },
  ] as StatusBand[],
  deepDischarge: {
    warningThreshold: 20,
    criticalThreshold: 10,
    warning: {
      deduction: 5,
      alert: {
        title: 'Battery charge low',
        message:
          'Battery level fell below 20%. Sustained deep discharge accelerates degradation.',
        severity: 'warning',
      },
      tip: {
        message: 'Charge before dropping under 20% to protect long-term capacity.',
      },
    },
    critical: {
      deduction: 10,
      alert: {
        title: 'Battery critically low',
        message: 'State of charge is under 10%. Charge immediately to avoid shutdown.',
        severity: 'critical',
      },
      tip: {
        message:
          'Avoid driving with less than 10% charge; schedule charging stops earlier.',
      },
    },
  },
  idleDrain: {
    durationMinutes: 10,
    deductionPerInterval: 3,
    alert: {
      title: 'Extended idling detected',
      message:
        'Vehicle remained on with no movement for an extended time, increasing drain.',
      severity: 'warning',
    },
    tip: {
      message:
        'Switch off the vehicle or enable eco-idle features when stationary to prevent waste.',
    },
  },
  rapidDrop: {
    windowMinutes: 15,
    percentageDrop: 15,
    deduction: 4,
    alert: {
      title: 'Rapid charge depletion',
      message:
        'Battery percentage fell sharply within minutes, indicating aggressive driving or load.',
      severity: 'warning',
    },
    tip: {
      message:
        'Adopt smoother acceleration and deceleration to maintain efficient energy usage.',
    },
  },
  slowCharge: {
    minRatePercentage: 5,
    durationMinutes: 20,
    alert: {
      title: 'Slow charging observed',
      message:
        'Charging progress is below expected levels; check charger health or connection.',
      severity: 'info',
    },
    tip: {
      message:
        'Inspect charging equipment and prefer faster AC/DC chargers when available.',
    },
  },
  temperature: {
    highCelsius: 40,
    lowCelsius: 0,
    highDeduction: 2,
    lowDeduction: 1,
    highAlert: {
      title: 'High temperature risk',
      message: 'Ambient temperatures above 40°C can degrade the battery faster.',
      severity: 'warning',
    },
    lowAlert: {
      title: 'Low temperature effect',
      message:
        'Cold weather reduces performance; pre-condition the cabin before driving.',
      severity: 'info',
    },
    highTip: {
      message: 'Park in shaded areas and avoid fast charging during extreme heat.',
    },
    lowTip: {
      message:
        'Pre-heat the vehicle while plugged in to protect the battery in cold conditions.',
    },
  },
} as const;

export type RulesConfig = typeof rulesConfig;
