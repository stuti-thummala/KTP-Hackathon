"use client";

import { useEffect, useRef, useState } from "react";

import type { AttentionData, GazePoint, GazeRegion, ScoreComponents } from "../types";

type FocusZone = {
  region: GazeRegion;
  center: { x: number; y: number };
  spread: number;
  weight: number;
};

// Simulated focus zones roughly align with key regions in the scene so the synthetic gaze feels grounded.
const FOCUS_ZONES: FocusZone[] = [
  { region: "suspect", center: { x: 0.7, y: 0.46 }, spread: 0.055, weight: 0.45 },
  { region: "environment", center: { x: 0.3, y: 0.5 }, spread: 0.06, weight: 0.25 },
  { region: "jewels", center: { x: 0.52, y: 0.22 }, spread: 0.05, weight: 0.18 },
  { region: "perimeter", center: { x: 0.5, y: 0.74 }, spread: 0.08, weight: 0.12 },
];

const MIN_ZONE_DWELL_FRAMES = 45;
const MAX_ZONE_DWELL_FRAMES = 90;
const BLINK_PROBABILITY = 0.06;
const MOCK_FRAME_INTERVAL = 1000 / 30;

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const randomGaussian = (mean: number, stdDev: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const standardNormal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + standardNormal * stdDev;
};

const pickFocusZone = () => {
  const totalWeight = FOCUS_ZONES.reduce((sum, zone) => sum + zone.weight, 0);
  const target = Math.random() * totalWeight;
  let accumulator = 0;
  for (const zone of FOCUS_ZONES) {
    accumulator += zone.weight;
    if (target <= accumulator) {
      return zone;
    }
  }
  return FOCUS_ZONES[0];
};

interface VideoOverlayProps {
  videoSrc: string;
  onGazeData?: (data: { x: number; y: number }) => void;
  onVideoComplete?: (attentionData: AttentionData) => void;
  onCalibrationComplete?: () => void;
}

const IDEAL_OBSERVER = {
  suspect: 68,
  environment: 22,
  jewels: 10,
} as const;

const BASE_SCORE = 88;
const MIN_SUSPECT_TARGET = 60;
const BLINK_WEIGHT = 2;
const MAX_BLINK_PENALTY = 35;
const STEADINESS_BONUS_THRESHOLD = 6;
const STEADINESS_BONUS = 5;

export default function VideoOverlay({ videoSrc, onGazeData, onVideoComplete, onCalibrationComplete }: VideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationDot, setCalibrationDot] = useState<{ x: number; y: number } | null>(null);
  const [latestGaze, setLatestGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const gazeTimelineRef = useRef<GazePoint[]>([]);
  const blinkCountRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const focusStateRef = useRef<{ zone: FocusZone; framesRemaining: number }>({
    zone: FOCUS_ZONES[0],
    framesRemaining: MIN_ZONE_DWELL_FRAMES,
  });
  const previousPointRef = useRef<{ x: number; y: number } | null>(null);

  const getContainerSize = () => {
    const rect = videoContainerRef.current?.getBoundingClientRect();
    if (rect) {
      return { width: rect.width, height: rect.height };
    }
    if (typeof window !== "undefined") {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 0, height: 0 };
  };

  const moveOverlayToNormalizedPoint = (point: { x: number; y: number }) => {
    const { width, height } = getContainerSize();
    setLatestGaze({
      x: clamp01(point.x) * width,
      y: clamp01(point.y) * height,
    });
  };

  const sampleMockPoint = () => {
    let { zone, framesRemaining } = focusStateRef.current;

    if (framesRemaining <= 0) {
      zone = pickFocusZone();
      framesRemaining = Math.round(randomBetween(MIN_ZONE_DWELL_FRAMES, MAX_ZONE_DWELL_FRAMES));
    } else {
      framesRemaining -= 1;
    }

    focusStateRef.current = { zone, framesRemaining };

    const rawX = clamp01(randomGaussian(zone.center.x, zone.spread));
    const rawY = clamp01(randomGaussian(zone.center.y, zone.spread));
    const previous = previousPointRef.current;

    const smoothedX = previous ? previous.x * 0.55 + rawX * 0.45 : rawX;
    const smoothedY = previous ? previous.y * 0.55 + rawY * 0.45 : rawY;

    previousPointRef.current = { x: smoothedX, y: smoothedY };

    return { x: smoothedX, y: smoothedY };
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      moveOverlayToNormalizedPoint({ x: 0.5, y: 0.5 });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const activateCamera = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access not supported in this browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          await webcamVideoRef.current.play().catch(() => undefined);
        }
        setIsCameraActive(true);
        setCameraError(null);
      } catch (error) {
        console.error("Camera activation failed", error);
        setIsCameraActive(false);
        setCameraError("Unable to access camera. Check permissions or device in use.");
      }
    };

    activateCamera();

    return () => {
      cancelled = true;
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
      }
    };
  }, []);

  const determineGazeRegion = (x: number, y: number): GazeRegion => {
    const { width, height } = getContainerSize();
    const normalizedX = width > 0 ? x / width : 0.5;
    const normalizedY = height > 0 ? y / height : 0.5;

    if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
      return "unknown";
    }

    if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
      return "unknown";
    }

    const regions = {
      suspect: { x: [0.58, 0.82], y: [0.25, 0.72] },
  environment: { x: [0.18, 0.42], y: [0.3, 0.72] },
  jewels: { x: [0.4, 0.62], y: [0.08, 0.32] },
    } as const;

    for (const [region, bounds] of Object.entries(regions)) {
      if (
        normalizedX >= bounds.x[0] &&
        normalizedX <= bounds.x[1] &&
        normalizedY >= bounds.y[0] &&
        normalizedY <= bounds.y[1]
      ) {
        return region as GazeRegion;
      }
    }

    return "perimeter";
  };

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const runFrame = (time: number) => {
      if (cancelled) {
        return;
      }

      const video = videoRef.current;
      if (!video || video.paused || video.ended) {
        setIsPlaying(false);
        animationFrameRef.current = null;
        return;
      }

      if (time - lastFrameTimeRef.current >= MOCK_FRAME_INTERVAL) {
        lastFrameTimeRef.current = time;

        const normalizedPoint = sampleMockPoint();
        const { width, height } = getContainerSize();
        const absoluteX = normalizedPoint.x * width;
        const absoluteY = normalizedPoint.y * height;
        const blink = Math.random() < BLINK_PROBABILITY;
        const timestamp = video.currentTime;
        const region = determineGazeRegion(absoluteX, absoluteY);

        const timelinePoint: GazePoint = {
          x: normalizedPoint.x,
          y: normalizedPoint.y,
          blink,
          timestamp,
          region,
        };

        gazeTimelineRef.current.push(timelinePoint);
        if (gazeTimelineRef.current.length > 1500) {
          gazeTimelineRef.current.shift();
        }
        if (blink) {
          blinkCountRef.current += 1;
        }

        setLatestGaze({ x: absoluteX, y: absoluteY });
        onGazeData?.({ x: absoluteX, y: absoluteY });
      }

      animationFrameRef.current = requestAnimationFrame(runFrame);
    };

    animationFrameRef.current = requestAnimationFrame((time) => {
      lastFrameTimeRef.current = time;
      runFrame(time);
    });

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, onGazeData]);

  const calibrationPoints = [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.1, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.9, y: 0.5 },
    { x: 0.1, y: 0.9 },
    { x: 0.5, y: 0.9 },
    { x: 0.9, y: 0.9 },
  ];

  const startCalibration = async () => {
    try {
      setIsCalibrated(false);
      setIsCalibrating(true);
      setCalibrationProgress(0);

      for (let i = 0; i < calibrationPoints.length; i += 1) {
        const point = calibrationPoints[i];
        setCalibrationDot(point);
        moveOverlayToNormalizedPoint(point);

        await new Promise((resolve) => {
          const jitterInterval = setInterval(() => {
            moveOverlayToNormalizedPoint({
              x: clamp01(point.x + randomGaussian(0, 0.01)),
              y: clamp01(point.y + randomGaussian(0, 0.01)),
            });
          }, 250);

          setTimeout(() => {
            clearInterval(jitterInterval);
            moveOverlayToNormalizedPoint(point);
            resolve(null);
          }, 1600);
        });

        setCalibrationProgress(((i + 1) / calibrationPoints.length) * 100);
      }

      setCalibrationDot(null);
      setIsCalibrating(false);
      setIsCalibrated(true);
      focusStateRef.current = {
        zone: pickFocusZone(),
        framesRemaining: Math.round(randomBetween(MIN_ZONE_DWELL_FRAMES, MAX_ZONE_DWELL_FRAMES)),
      };
      previousPointRef.current = { x: 0.5, y: 0.5 };
      moveOverlayToNormalizedPoint({ x: 0.5, y: 0.5 });
      onCalibrationComplete?.();
    } catch (error) {
      console.error("Calibration failed:", error);
      setIsCalibrating(false);
      setCalibrationProgress(0);
      setCalibrationDot(null);
    }
  };

  const startDemo = () => {
    if (!videoRef.current || !isCalibrated) {
      return;
    }

    gazeTimelineRef.current = [];
    blinkCountRef.current = 0;
    focusStateRef.current = {
      zone: pickFocusZone(),
      framesRemaining: Math.round(randomBetween(MIN_ZONE_DWELL_FRAMES, MAX_ZONE_DWELL_FRAMES)),
    };
    previousPointRef.current = null;
    lastFrameTimeRef.current = 0;
    moveOverlayToNormalizedPoint({ x: 0.5, y: 0.5 });

    setIsPlaying(true);
    const playPromise = videoRef.current.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error: unknown) => {
        console.error("Video playback failed to start:", error);
        setIsPlaying(false);
      });
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    moveOverlayToNormalizedPoint({ x: 0.5, y: 0.5 });

    const timeline = [...gazeTimelineRef.current];
    const totalSamples = timeline.length;

    let suspectSamples = 0;
  let environmentSamples = 0;
  let jewelsSamples = 0;
    let perimeterSamples = 0;
    let blinkCount = 0;

    timeline.forEach((point) => {
      if (point.blink) {
        blinkCount += 1;
      }

      switch (point.region) {
        case "suspect":
          suspectSamples += 1;
          break;
        case "environment":
          environmentSamples += 1;
          break;
        case "jewels":
          jewelsSamples += 1;
          break;
        case "perimeter":
          perimeterSamples += 1;
          break;
        default:
          break;
      }
    });

  const knownSamples = suspectSamples + environmentSamples + jewelsSamples + perimeterSamples;
    const percentOf = (count: number) => (knownSamples === 0 ? 0 : (count / knownSamples) * 100);

    const suspectPercent = percentOf(suspectSamples);
  const environmentPercent = percentOf(environmentSamples);
  const jewelsPercent = percentOf(jewelsSamples);
    const perimeterPercent = percentOf(perimeterSamples);

    const blinkPenalty = Math.min(blinkCount * BLINK_WEIGHT, MAX_BLINK_PENALTY);
  const suspectFocusAdjustmentRaw = (suspectPercent - MIN_SUSPECT_TARGET) * 0.45;
  const suspectFocusAdjustment = Math.max(-25, Math.min(25, Math.round(suspectFocusAdjustmentRaw)));
  const focusBalanceBonus = Math.round(Math.min(jewelsPercent, 18) * 0.2);
  const environmentPenalty = Math.max(0, Math.round(Math.max(0, environmentPercent - IDEAL_OBSERVER.environment) * 0.45));
    const perimeterPenalty = Math.max(0, Math.round(perimeterPercent * 0.35));
    const steadinessBonus = blinkCount <= STEADINESS_BONUS_THRESHOLD ? STEADINESS_BONUS : 0;
  const variabilityNudge = Math.round((suspectPercent - environmentPercent) * 0.05);

    let finalScore =
      BASE_SCORE +
      suspectFocusAdjustment +
      steadinessBonus +
      focusBalanceBonus +
      variabilityNudge -
      blinkPenalty -
  environmentPenalty -
      perimeterPenalty;

    finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

    const scoreComponents: ScoreComponents = {
      baseScore: BASE_SCORE,
      suspectFocusAdjustment,
      blinkPenalty,
      steadinessBonus,
      focusBalanceBonus,
  environmentPenalty,
      perimeterPenalty,
    };

    const baselineComparison = {
      suspectDelta: Number((suspectPercent - IDEAL_OBSERVER.suspect).toFixed(1)),
  environmentDelta: Number((environmentPercent - IDEAL_OBSERVER.environment).toFixed(1)),
  jewelsDelta: Number((jewelsPercent - IDEAL_OBSERVER.jewels).toFixed(1)),
    };

    const suspectPenalty = Math.max(0, Math.round(Math.max(0, MIN_SUSPECT_TARGET - suspectPercent)));

    const firstSuspect = timeline.find((point) => point.region === "suspect");
  const environmentFixation = timeline.find((point) => point.region === "environment");
    const heavyBlinkMoment = timeline.find((point) => point.blink);

    const criticalMoments = [
      firstSuspect
        ? {
            timestamp: Number(firstSuspect.timestamp.toFixed(2)),
            gazeLocation: "suspect" as GazeRegion,
            blinked: firstSuspect.blink,
          }
        : null,
      environmentFixation
        ? {
            timestamp: Number(environmentFixation.timestamp.toFixed(2)),
            gazeLocation: "environment" as GazeRegion,
            blinked: environmentFixation.blink,
          }
        : null,
      heavyBlinkMoment
        ? {
            timestamp: Number(heavyBlinkMoment.timestamp.toFixed(2)),
            gazeLocation: heavyBlinkMoment.region,
            blinked: true,
          }
        : null,
    ].filter(Boolean) as AttentionData["criticalMoments"];

    const attentionData: AttentionData = {
      score: finalScore,
      blinkCount,
      totalGazePoints: totalSamples,
      gazeDistribution: {
        suspect: Number(suspectPercent.toFixed(1)),
  environment: Number(environmentPercent.toFixed(1)),
  jewels: Number(jewelsPercent.toFixed(1)),
        perimeter: Number(perimeterPercent.toFixed(1)),
      },
      idealObserver: IDEAL_OBSERVER,
  baselineComparison,
      scoreComponents,
      criticalMoments,
      gazeTimeline: [...timeline],
      playbackDuration: videoRef.current?.duration ?? 0,
      metrics: {
        totalSamples,
        blinkPenalty,
        suspectPenalty,
        baseScore: BASE_SCORE,
        finalScore,
        suspectAttentionPercent: Number(suspectPercent.toFixed(1)),
        environmentAttentionPercent: Number(environmentPercent.toFixed(1)),
        jewelsAttentionPercent: Number(jewelsPercent.toFixed(1)),
        perimeterAttentionPercent: Number(perimeterPercent.toFixed(1)),
        environmentPenalty,
        perimeterPenalty,
        focusBalanceBonus,
      },
      baselines: IDEAL_OBSERVER,
    };

    onVideoComplete?.(attentionData);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div
        ref={videoContainerRef}
        className="relative aspect-video bg-black rounded-lg overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,45,149,0.12),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,15,40,0.55),transparent_70%)] mix-blend-screen" />

        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <video
            ref={webcamVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>

        <div className={`absolute inset-0 transition-opacity duration-500 ${!isCalibrating ? "opacity-100" : "opacity-0"}`}>
          {isCalibrated && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <button
                onClick={startDemo}
                className="rounded-full bg-electricPink px-8 py-3 text-lg font-semibold text-white shadow-glow transition hover:bg-electricPink/90"
              >
                Watch Video
              </button>
            </div>
          )}
          <video
            ref={videoRef}
            src={videoSrc || "/video.mp4"}
            className="w-full h-full object-contain"
            onEnded={handleVideoEnd}
            playsInline
          />
        </div>

        {calibrationDot && (
          <div
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-electricPink animate-pulse"
            style={{
              left: `${calibrationDot.x * 100}%`,
              top: `${calibrationDot.y * 100}%`,
            }}
          />
        )}

        {!isCalibrated && (
          <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 bg-black/70 text-center text-sm text-white">
            <p className="font-medium text-white">Follow the neon dot with your eyes as it glides across the screen.</p>
            <p className="text-xs text-white/70">Keep your head steady; calibration locks the heatmap to your gaze.</p>
            {cameraError ? (
              <p className="text-xs text-electricPink/80">{cameraError}</p>
            ) : !isCameraActive ? (
              <p className="text-xs text-white/60">Grant camera access if prompted so the ambient feed appears behind the video.</p>
            ) : null}
          </div>
        )}

        {isCalibrated && !isCalibrating && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: "transparent",
            }}
          >
            {!isPlaying && (
              <div
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-electricPink opacity-60 shadow-glow"
                style={{
                  left: `${latestGaze.x || 0}px`,
                  top: `${latestGaze.y || 0}px`,
                  transition: "all 0.12s ease-out",
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-4">
        {!isCalibrated ? (
          <>
            {!isCalibrating ? (
              <button
                onClick={startCalibration}
                className="rounded-full bg-white/10 px-8 py-3 text-lg font-semibold text-white shadow-midnight transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-electricPink/60"
              >
                Start Calibration
              </button>
            ) : (
              <div className="w-full max-w-md">
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-electricPink transition-all duration-300"
                    style={{ width: `${calibrationProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-sm text-slate-200">
                  Calibrating... {Math.round(calibrationProgress)}%
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}