export type SimulationScenarioName = 'urban' | 'highway' | 'mixed';

export type SimulationSample = {
  minuteOffset: number;
  batteryPercentage: number;
  speedKmph: number;
  engineOn: boolean;
  charging: boolean;
  ambientTemperature: number;
  odometerKm: number;
};

export type SimulationScenario = {
  name: SimulationScenarioName;
  description: string;
  samples: SimulationSample[];
};

const URBAN_COMMUTE: SimulationScenario = {
  name: 'urban',
  description: 'Stop-and-go city driving with short idling segments at intersections.',
  samples: [
    {
      minuteOffset: 0,
      batteryPercentage: 82,
      speedKmph: 0,
      engineOn: true,
      charging: false,
      ambientTemperature: 30,
      odometerKm: 15230.2,
    },
    {
      minuteOffset: 5,
      batteryPercentage: 81.2,
      speedKmph: 26,
      engineOn: true,
      charging: false,
      ambientTemperature: 30,
      odometerKm: 15231.0,
    },
    {
      minuteOffset: 10,
      batteryPercentage: 80.5,
      speedKmph: 34,
      engineOn: true,
      charging: false,
      ambientTemperature: 30,
      odometerKm: 15232.3,
    },
    {
      minuteOffset: 15,
      batteryPercentage: 80,
      speedKmph: 14,
      engineOn: true,
      charging: false,
      ambientTemperature: 29,
      odometerKm: 15233.1,
    },
    {
      minuteOffset: 20,
      batteryPercentage: 79.8,
      speedKmph: 0,
      engineOn: true,
      charging: false,
      ambientTemperature: 29,
      odometerKm: 15233.1,
    },
    {
      minuteOffset: 25,
      batteryPercentage: 79.7,
      speedKmph: 0,
      engineOn: true,
      charging: false,
      ambientTemperature: 29,
      odometerKm: 15233.1,
    },
    {
      minuteOffset: 30,
      batteryPercentage: 79,
      speedKmph: 28,
      engineOn: true,
      charging: false,
      ambientTemperature: 29,
      odometerKm: 15234.4,
    },
    {
      minuteOffset: 35,
      batteryPercentage: 78.4,
      speedKmph: 21,
      engineOn: true,
      charging: false,
      ambientTemperature: 29,
      odometerKm: 15235.4,
    },
    {
      minuteOffset: 40,
      batteryPercentage: 78,
      speedKmph: 0,
      engineOn: false,
      charging: false,
      ambientTemperature: 28,
      odometerKm: 15235.4,
    },
  ],
};

const HIGHWAY_CRUISE: SimulationScenario = {
  name: 'highway',
  description: 'Sustained highway speeds with higher energy draw and minimal stops.',
  samples: [
    {
      minuteOffset: 0,
      batteryPercentage: 76,
      speedKmph: 0,
      engineOn: true,
      charging: false,
      ambientTemperature: 27,
      odometerKm: 23110.6,
    },
    {
      minuteOffset: 5,
      batteryPercentage: 74.8,
      speedKmph: 92,
      engineOn: true,
      charging: false,
      ambientTemperature: 27,
      odometerKm: 23118.5,
    },
    {
      minuteOffset: 10,
      batteryPercentage: 73.5,
      speedKmph: 108,
      engineOn: true,
      charging: false,
      ambientTemperature: 27,
      odometerKm: 23127.4,
    },
    {
      minuteOffset: 15,
      batteryPercentage: 72.1,
      speedKmph: 112,
      engineOn: true,
      charging: false,
      ambientTemperature: 27,
      odometerKm: 23136.9,
    },
    {
      minuteOffset: 20,
      batteryPercentage: 71,
      speedKmph: 104,
      engineOn: true,
      charging: false,
      ambientTemperature: 27,
      odometerKm: 23145.6,
    },
    {
      minuteOffset: 25,
      batteryPercentage: 70.2,
      speedKmph: 0,
      engineOn: false,
      charging: false,
      ambientTemperature: 27,
      odometerKm: 23145.6,
    },
  ],
};

const MIXED_DEMO: SimulationScenario = {
  name: 'mixed',
  description:
    'Combination of spirited driving followed by a slower-than-expected AC charge.',
  samples: [
    {
      minuteOffset: 0,
      batteryPercentage: 65,
      speedKmph: 0,
      engineOn: true,
      charging: false,
      ambientTemperature: 33,
      odometerKm: 8940.2,
    },
    {
      minuteOffset: 5,
      batteryPercentage: 63.4,
      speedKmph: 74,
      engineOn: true,
      charging: false,
      ambientTemperature: 33,
      odometerKm: 8946.6,
    },
    {
      minuteOffset: 10,
      batteryPercentage: 61.1,
      speedKmph: 101,
      engineOn: true,
      charging: false,
      ambientTemperature: 33,
      odometerKm: 8954.7,
    },
    {
      minuteOffset: 15,
      batteryPercentage: 59.8,
      speedKmph: 88,
      engineOn: true,
      charging: false,
      ambientTemperature: 33,
      odometerKm: 8962.3,
    },
    {
      minuteOffset: 20,
      batteryPercentage: 58,
      speedKmph: 46,
      engineOn: true,
      charging: false,
      ambientTemperature: 32,
      odometerKm: 8967.0,
    },
    {
      minuteOffset: 25,
      batteryPercentage: 57.2,
      speedKmph: 0,
      engineOn: false,
      charging: true,
      ambientTemperature: 32,
      odometerKm: 8967.0,
    },
    {
      minuteOffset: 35,
      batteryPercentage: 57.8,
      speedKmph: 0,
      engineOn: false,
      charging: true,
      ambientTemperature: 32,
      odometerKm: 8967.0,
    },
    {
      minuteOffset: 45,
      batteryPercentage: 58.8,
      speedKmph: 0,
      engineOn: false,
      charging: true,
      ambientTemperature: 32,
      odometerKm: 8967.0,
    },
    {
      minuteOffset: 55,
      batteryPercentage: 60,
      speedKmph: 0,
      engineOn: false,
      charging: true,
      ambientTemperature: 32,
      odometerKm: 8967.0,
    },
  ],
};

const SCENARIOS: Record<SimulationScenarioName, SimulationScenario> = {
  urban: URBAN_COMMUTE,
  highway: HIGHWAY_CRUISE,
  mixed: MIXED_DEMO,
};

export const listScenarios = (): SimulationScenario[] => Object.values(SCENARIOS);

export const getScenario = (name: SimulationScenarioName): SimulationScenario =>
  SCENARIOS[name];
