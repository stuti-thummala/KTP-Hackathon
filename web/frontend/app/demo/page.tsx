'use client';

import { useEffect, useMemo, useState } from 'react';
import VideoOverlay from '../components/VideoOverlay';
import Quiz from '../components/Quiz';
import type { AttentionData, GazePoint } from '../types';
import BiasLabPanel from '../components/BiasLabPanel';
import VoiceForJusticePanel from '../components/VoiceForJusticePanel';

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));

interface HeatmapOptions {
  width?: number;
  height?: number;
  intensity?: number;
  haloScale?: number;
}

const generateHeatmapFromTimeline = (points: GazePoint[], options: HeatmapOptions = {}): string | null => {
  if (typeof document === 'undefined' || !points.length) {
    return null;
  }

  const width = options.width ?? 640;
  const height = options.height ?? 360;
  const intensity = options.intensity ?? 0.85;
  const haloScale = options.haloScale ?? 0.45;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = intensity;

  const baseRadius = Math.max(width, height) * 0.08;

  points.forEach((point, index) => {
    const x = clamp01(point.x) * width;
    const y = clamp01(point.y) * height;
    const radius = baseRadius * (0.75 + Math.random() * 0.4);
    const peakAlpha = point.blink ? 0.95 : 0.75;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,45,149,${peakAlpha})`);
    gradient.addColorStop(0.45, `rgba(255,120,190,${peakAlpha * 0.55})`);
    gradient.addColorStop(1, 'rgba(255,45,149,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (index % 7 === 0) {
      const haloRadius = radius * haloScale;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      halo.addColorStop(0, 'rgba(255,255,255,0.25)');
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, 'rgba(10, 8, 20, 0.18)');
  veil.addColorStop(1, 'rgba(10, 8, 20, 0.32)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);

  try {
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Heatmap canvas export failed:', error);
    return null;
  }
};

type DemoStage = 'intro' | 'video' | 'quiz' | 'reflection' | 'results';

const IDEAL_OBSERVER_BASELINE = {
  suspect: 68,
  environment: 22,
  jewels: 10,
};

export default function Demo() {
  const [stage, setStage] = useState<DemoStage>('intro');
  const [, setGazeBuffer] = useState<{ x: number; y: number }[]>([]);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [attentionResults, setAttentionResults] = useState<AttentionData | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [heatmapDataUri, setHeatmapDataUri] = useState<string | null>(null);
  const [isGeneratingHeatmap, setIsGeneratingHeatmap] = useState(false);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
  const [showImpactModules, setShowImpactModules] = useState(false);

  const handleStartExperience = () => {
    setAttentionResults(null);
    setQuizScore(null);
    setQuizAnswers({});
    setHeatmapDataUri(null);
    setHeatmapError(null);
    setIsGeneratingHeatmap(false);
    setShowImpactModules(false);
    setIsCalibrated(false);
    setGazeBuffer([]);
    setStage('video');
  };

  const handleGazeData = (data: { x: number; y: number }) => {
    setGazeBuffer((prev) => {
      const next = [...prev, data];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  };

  const handleVideoComplete = (attentionData: AttentionData) => {
    setAttentionResults(attentionData);
    setStage('quiz');
  };

  const handleCalibrationComplete = () => {
    setIsCalibrated(true);
  };

  useEffect(() => {
    if (stage !== 'results' || !attentionResults) {
      if (stage !== 'results') {
        setHeatmapDataUri(null);
        setHeatmapError(null);
        setIsGeneratingHeatmap(false);
      }
      return;
    }

    if (!attentionResults.gazeTimeline || attentionResults.gazeTimeline.length < 5) {
      setHeatmapDataUri(null);
      setHeatmapError('Not enough gaze data recorded to build the heatmap.');
      setIsGeneratingHeatmap(false);
      return;
    }

    let cancelled = false;
    setIsGeneratingHeatmap(true);
    setHeatmapError(null);

    const rafId = requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      const image = generateHeatmapFromTimeline(attentionResults.gazeTimeline, {
        width: 640,
        height: 360,
        intensity: 0.88,
        haloScale: 0.42,
      });

      if (cancelled) {
        return;
      }

      if (image) {
        setHeatmapDataUri(image);
      } else {
        setHeatmapDataUri(null);
        setHeatmapError('We hit a snag generating the heatmap for this session.');
      }
      setIsGeneratingHeatmap(false);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [stage, attentionResults]);

  const quizAccuracy = useMemo(() => {
    if (quizScore === null) return null;
    const total = Object.keys(quizAnswers).length || 1;
    return Math.round((quizScore / total) * 100);
  }, [quizScore, quizAnswers]);

  const insightHighlights = useMemo(() => {
    if (!attentionResults) return [];
  const { gazeDistribution, blinkCount } = attentionResults;
  const suspectDelta = Math.round(gazeDistribution.suspect - IDEAL_OBSERVER_BASELINE.suspect);
  const environmentDelta = Math.round(gazeDistribution.environment - IDEAL_OBSERVER_BASELINE.environment);
  const jewelsDelta = Math.round(gazeDistribution.jewels - IDEAL_OBSERVER_BASELINE.jewels);
    const blinkLine =
      blinkCount > 12
        ? `Frequent blinks (${blinkCount}) during the heist window signal cognitive overload.`
        : `Blink rate stayed within the calm observer range (${blinkCount}).`;

    return [
      `You tracked the suspect ${Math.round(
        gazeDistribution.suspect,
      )}% of the time, ${suspectDelta >= 0 ? `${Math.abs(suspectDelta)}% more` : `${Math.abs(suspectDelta)}% less`} than the ideal baseline.`,
      `Attention drifted to the environment ${Math.round(
        gazeDistribution.environment,
      )}% of the time (${environmentDelta >= 0 ? '+' : '-'}${Math.abs(environmentDelta)}% vs. benchmark), a common selective attention bias.`,
      `The jewels held your gaze ${Math.round(
        gazeDistribution.jewels,
      )}% of the time (${jewelsDelta >= 0 ? '+' : '-'}${Math.abs(jewelsDelta)}% vs. benchmark).`,
      blinkLine,
    ];
  }, [attentionResults]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-midnight-950 text-slate-100">
  <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-80" />
  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,45,149,0.08),transparent_55%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-14 sm:px-6 lg:px-10">
        {stage === 'intro' && (
          <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/5 bg-white/10 p-12 shadow-midnight backdrop-blur-2xl">
            <div className="flex flex-col items-center gap-10 text-center">
              <h1 className="text-5xl font-black tracking-[0.55em] text-transparent bg-clip-text bg-gradient-to-r from-electricPink via-white to-aurora drop-shadow-glow md:text-6xl">
                THE LOUVRE
              </h1>
              <div className="space-y-4">
                <p className="text-lg font-semibold uppercase tracking-[0.35em] text-electricPink/90">
                  WitnessAware Immersive Trial
                </p>
                <p className="text-2xl font-semibold text-white md:text-3xl">
                  You&apos;re about to witness a ten-second scene. Pay obsessive attention.
                </p>
                <p className="text-base text-slate-300">
                  No spoilers, no second takes. When it ends, the only evidence is whatever your mind managed to hold on to.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartExperience}
                className="rounded-full bg-electricPink px-12 py-3 text-lg font-semibold text-white shadow-glow transition hover:bg-electricPink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-electricPink/60"
              >
                Begin
              </button>
            </div>
          </section>
        )}

        {stage === 'video' && (
          <section className="mx-auto w-full max-w-5xl space-y-8">
            <header className="flex flex-col gap-3 text-center md:text-left">
              <span className="text-sm uppercase tracking-[0.4em] text-electricPink">Calibration & Playback</span>
              <h2 className="text-3xl font-semibold text-white">Stay focused - your gaze writes the story.</h2>
              <p className="max-w-2xl text-base text-slate-300">
                Follow the neon markers during calibration, then keep your attention steady. We&apos;ll track what
                you watch, when you blink, and how your focus shifts as the scene unfolds.
              </p>
            </header>
            <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-midnight backdrop-blur-xl">
              <VideoOverlay
                videoSrc="/video.mp4"
                onGazeData={handleGazeData}
                onVideoComplete={handleVideoComplete}
                onCalibrationComplete={handleCalibrationComplete}
              />
            </div>
          </section>
        )}

        {stage === 'quiz' && (
          <section className="mx-auto w-full max-w-3xl rounded-3xl border border-white/5 bg-white/10 p-8 shadow-midnight backdrop-blur-lg">
            <header className="mb-6 space-y-2 text-center">
              <span className="text-sm uppercase tracking-[0.35em] text-electricPink">Memory Pulse</span>
              <h2 className="text-3xl font-semibold text-white">Lock in what you saw.</h2>
              <p className="text-base text-slate-300">
                Each question refreshes from a curated bank so no two runs feel the same. Trust what you remember.
              </p>
            </header>
            <Quiz
              onComplete={(score, answers) => {
                setQuizScore(score);
                setQuizAnswers(answers);
                setStage('reflection');
              }}
            />
          </section>
        )}

        {stage === 'reflection' && (
          <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 rounded-3xl border border-white/5 bg-white/10 p-12 text-center shadow-midnight backdrop-blur-2xl">
            <div className="space-y-6">
              <span className="inline-flex items-center justify-center rounded-full border border-electricPink/40 bg-electricPink/10 px-6 py-1 text-sm font-semibold uppercase tracking-[0.35em] text-electricPink">
                Moment Of Truth
              </span>
              <h2 className="text-4xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-electricPink via-white to-aurora drop-shadow-glow md:text-5xl">
                Found it hard to remember, didn&apos;t you?
              </h2>
              <p className="text-lg text-slate-200 md:text-xl">
                You&apos;re not alone. Research shows that 75% of all false convictions trace back to inaccurate eyewitness testimony.
                What felt certain moments ago might already be fading. Let&apos;s see how your attention told the story.
              </p>
            </div>
            <button
              onClick={() => setStage('results')}
              className="rounded-full bg-electricPink px-10 py-3 text-lg font-semibold text-white shadow-glow transition hover:bg-electricPink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-electricPink/60"
            >
              Reveal My Data
            </button>
          </section>
        )}

        {stage === 'results' && attentionResults && (
          <section className="mx-auto flex w-full max-w-6xl flex-col gap-10">
            <header className="grid gap-6 rounded-3xl border border-white/5 bg-white/10 p-8 shadow-midnight backdrop-blur-xl md:grid-cols-[1.1fr_1.6fr]">
              <div className="flex flex-col items-center justify-center gap-6 rounded-2xl bg-white/5 p-6 text-center md:items-start md:text-left">
                <div className="relative h-48 w-48">
                  <div
                    className="absolute inset-0 rounded-full opacity-90"
                    style={{
                      background: `conic-gradient(#FF2D95 ${attentionResults.score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                    }}
                  />
                  <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-midnight-950 shadow-midnight">
                    <span className="text-4xl font-semibold text-white">{attentionResults.score}</span>
                    <span className="text-xs uppercase tracking-[0.4em] text-slate-400">Score</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-white">Impact Reveal</p>
                  <p className="text-sm text-slate-300">
                    Your focused attention score compares to a trained observer baseline, blending suspect tracking weight, environment drift penalties, jewel vigilance bonuses, blink steadiness, and timeline variability checks from the scoring algorithm.
                  </p>
                </div>
                {quizAccuracy !== null && (
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-midnight-900/60 px-4 py-2 text-sm text-slate-200">
                    <span className="rounded-full bg-electricPink/20 px-3 py-1 text-electricPink">Quiz</span>
                    <span>{quizAccuracy}% accuracy ({quizScore} correct)</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-4 rounded-2xl border border-white/10 bg-midnight-900/60 p-6">
                  <h3 className="text-xl font-semibold text-white">Attention Ledger</h3>
                  <div className="space-y-4">
                    {(['suspect', 'environment', 'jewels'] as const).map((key) => {
                      const label = {
                        suspect: 'Suspect',
                        environment: 'Environment',
                        jewels: 'Jewels',
                      }[key];
                      const colorClasses = {
                        suspect: 'from-electricPink/80 via-electricPink/60 to-electricPink/40',
                        environment: 'from-aurora/80 via-aurora/60 to-aurora/30',
                        jewels: 'from-midnight-300 via-midnight-200 to-midnight-100',
                      }[key];
                      const value = Math.round(attentionResults.gazeDistribution[key] || 0);
                      const baseline = IDEAL_OBSERVER_BASELINE[key];
                      const delta = value - baseline;
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-slate-200">
                            <span>{label}</span>
                            <span>
                              {value}%{' '}
                              <span className="text-xs text-slate-400">
                                ({delta >= 0 ? '+' : '-'}
                                {Math.abs(Math.round(delta))}% vs baseline)
                              </span>
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${colorClasses}`}
                              style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-xl font-semibold text-white">Narrative Preview</h3>
                  <ul className="space-y-3 text-sm text-slate-200">
                    {insightHighlights.map((insight) => (
                      <li key={insight} className="flex items-start gap-3">
                        <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-electricPink" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </header>

            <div className="rounded-3xl border border-white/5 bg-midnight-900/70 p-6 shadow-midnight backdrop-blur-xl">
              <div className="grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">Attention Heatmap</h3>
                  <p className="text-sm text-slate-300">
                    This heatmap shows where your eyes locked during the simulated Louvre robbery.
                    Most people spend less than half of their attention on the actual suspect—distractions like guards,
                    ambient motion, or glittering objects steal the spotlight.
                  </p>
                  <p className="text-sm text-slate-300">
                    In real investigations, those attention gaps become wrongful identifications that send innocent people to prison.
                    According to the Innocence Project, eyewitness misidentification contributed to nearly 70% of over 375 DNA-based exonerations in the United States,
                    with many survivors serving a decade or more before being cleared.
                  </p>
                  <p className="text-sm text-slate-300">
                    Your gaze data shows how easily the human mind can feel certain—and be completely wrong. That&apos;s why reforming lineup procedures and educating witnesses is critical to preventing future wrongful convictions.
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                    <p>Samples captured: {attentionResults.metrics?.totalSamples ?? attentionResults.totalGazePoints}</p>
                    <p>Blinks registered: {attentionResults.blinkCount}</p>
                  </div>
                  {heatmapError ? (
                    <p className="text-sm text-electricPink">{heatmapError}</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Tip: Toggle future overlays to compare suspect tracking versus environment distractions frame by frame.
                    </p>
                  )}
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {isGeneratingHeatmap && (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">
                      <span className="animate-pulse">Rendering heatmap…</span>
                    </div>
                  )}
                  {!isGeneratingHeatmap && heatmapDataUri && !heatmapError && (
                    <img
                      src={heatmapDataUri}
                      alt="Gaze heatmap overlay"
                      className="h-full w-full object-cover mix-blend-screen"
                      loading="lazy"
                    />
                  )}
                  {!isGeneratingHeatmap && !heatmapDataUri && !heatmapError && (
                    <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-slate-300">
                      <span>Heatmap will appear once sufficient gaze data is captured.</span>
                    </div>
                  )}
                  {!isGeneratingHeatmap && heatmapError && (
                    <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-electricPink">
                      <span>{heatmapError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <BiasLabPanel
              attention={attentionResults}
              videoSrc="/video.mp4"
              heatmapDataUri={heatmapDataUri}
            />

            <div className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/10 p-6 shadow-midnight backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-white">Impact & Advocacy Modules</h3>
                  <p className="text-sm text-slate-300">
                    Explore reform insights and local actions when you&apos;re ready—no rush, no information overload.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImpactModules((prev) => !prev)}
                  className="rounded-full border border-electricPink/50 bg-electricPink/15 px-5 py-2 text-sm font-semibold text-electricPink transition hover:bg-electricPink/25"
                >
                  {showImpactModules ? 'Hide Modules' : 'Reveal Modules'}
                </button>
              </div>

              {showImpactModules && (
                <div className="space-y-6">
                  <div className="space-y-5 rounded-3xl border border-white/5 bg-white/10 p-6 shadow-midnight backdrop-blur-xl">
                    <h4 className="text-lg font-semibold text-white">Impact Statement</h4>
                    <p className="text-base text-slate-200">
                      An estimated 20,000 people are wrongfully incarcerated every year because eyewitness memory falters at
                      critical moments. Your session shows how easily attention drifts, even in a controlled, low-stress
                      environment.
                    </p>
                  </div>

                  <VoiceForJusticePanel />
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 rounded-3xl border border-white/5 bg-white/5 p-6 text-sm text-slate-300 backdrop-blur-xl">
              <button
                onClick={() => {
                  setStage('intro');
                  setIsCalibrated(false);
                  setAttentionResults(null);
                  setQuizScore(null);
                  setQuizAnswers({});
                  setGazeBuffer([]);
                  setHeatmapDataUri(null);
                  setHeatmapError(null);
                  setIsGeneratingHeatmap(false);
                  setShowImpactModules(false);
                }}
                className="rounded-full border border-electricPink/40 px-5 py-2 text-electricPink transition hover:bg-electricPink/10"
              >
                Restart Demo
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}