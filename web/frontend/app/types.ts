export type GazeRegion = 'suspect' | 'environment' | 'jewels' | 'perimeter' | 'unknown';

export interface GazePoint {
  x: number;
  y: number;
  blink: boolean;
  timestamp: number;
  region: GazeRegion;
}

export interface ScoreComponents {
  baseScore: number;
  suspectFocusAdjustment: number;
  blinkPenalty: number;
  steadinessBonus: number;
  focusBalanceBonus: number;
  environmentPenalty: number;
  perimeterPenalty: number;
}

export interface AttentionData {
  score: number;
  blinkCount: number;
  totalGazePoints: number;
  gazeDistribution: {
    suspect: number;
    environment: number;
    jewels: number;
    perimeter: number;
  };
  idealObserver: {
    suspect: number;
    environment: number;
    jewels: number;
  };
  baselineComparison: {
    suspectDelta: number;
    environmentDelta: number;
    jewelsDelta: number;
  };
  scoreComponents: ScoreComponents;
  criticalMoments: {
    timestamp: number;
    gazeLocation: GazeRegion;
    blinked: boolean;
  }[];
  gazeTimeline: GazePoint[];
  playbackDuration: number;
  metrics: {
    totalSamples: number;
    blinkPenalty: number;
    suspectPenalty: number;
    baseScore: number;
    finalScore: number;
    suspectAttentionPercent: number;
    environmentAttentionPercent: number;
    jewelsAttentionPercent: number;
    perimeterAttentionPercent: number;
    environmentPenalty: number;
    perimeterPenalty: number;
    focusBalanceBonus: number;
  };
  baselines: {
    suspect: number;
    environment: number;
    jewels: number;
  };
}