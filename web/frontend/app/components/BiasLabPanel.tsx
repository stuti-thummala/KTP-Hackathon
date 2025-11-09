"use client";

import { useEffect, useMemo, useRef, useState, ChangeEvent } from "react";
import type { AttentionData } from "../types";

interface BiasLabPanelProps {
  attention: AttentionData;
  videoSrc: string;
  heatmapDataUri?: string | null;
}

const SUSPECT_REGION = {
  left: 0.58,
  right: 0.82,
  top: 0.25,
  bottom: 0.72,
};

const ENVIRONMENT_REGION = {
  left: 0.18,
  right: 0.42,
  top: 0.3,
  bottom: 0.72,
};

const CANVAS_BASE_WIDTH = 1280;
const CANVAS_BASE_HEIGHT = 720;

export default function BiasLabPanel({ attention, videoSrc, heatmapDataUri }: BiasLabPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [slowMotion, setSlowMotion] = useState(false);
  const [showSuspectHighlight, setShowSuspectHighlight] = useState(true);
  const [showGazeTrail, setShowGazeTrail] = useState(true);

  const duration = useMemo(() => attention.playbackDuration || 0, [attention.playbackDuration]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.playbackRate = slowMotion ? 0.5 : 1;
  }, [slowMotion]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoEl.currentTime);
    };

    videoEl.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.play().catch((error) => {
        console.error("Video playback failed:", error);
        setIsPlaying(false);
      });
    } else {
      videoEl.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const resizeCanvas = () => {
      const { clientWidth, clientHeight } = overlay;
      canvas.width = clientWidth;
      canvas.height = clientHeight;
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(overlay);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!showGazeTrail) {
      return;
    }

    const points = attention.gazeTimeline.filter((point) => point.timestamp <= currentTime);
    if (!points.length) {
      return;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];

      const x1 = prev.x * canvas.width;
      const y1 = prev.y * canvas.height;
      const x2 = curr.x * canvas.width;
      const y2 = curr.y * canvas.height;

  ctx.strokeStyle = curr.blink ? "rgba(255,45,149,0.7)" : "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const lastPoint = points[points.length - 1];
    const centerX = lastPoint.x * canvas.width;
    const centerY = lastPoint.y * canvas.height;
    const radius = 6;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 3);
    gradient.addColorStop(0, "rgba(255,45,149,0.85)");
    gradient.addColorStop(1, "rgba(255,45,149,0.0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 3, 0, Math.PI * 2);
    ctx.fill();
  }, [attention.gazeTimeline, currentTime, showGazeTrail]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updateLoop = () => {
      const videoEl = videoRef.current;
      if (videoEl) {
        setCurrentTime(videoEl.currentTime);
      }
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animationFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setCurrentTime(value);
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.currentTime = value;
    }
  };

  const togglePlayback = () => {
    setIsPlaying((prev) => !prev);
  };

  const formattedTimestamp = useMemo(() => {
    const totalSeconds = Math.floor(currentTime);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [currentTime]);

  const suspectOverlayStyles = useMemo(() => {
    return {
      left: `${SUSPECT_REGION.left * 100}%`,
      top: `${SUSPECT_REGION.top * 100}%`,
      width: `${(SUSPECT_REGION.right - SUSPECT_REGION.left) * 100}%`,
      height: `${(SUSPECT_REGION.bottom - SUSPECT_REGION.top) * 100}%`,
    };
  }, []);

  const environmentOverlayStyles = useMemo(() => {
    return {
      left: `${ENVIRONMENT_REGION.left * 100}%`,
      top: `${ENVIRONMENT_REGION.top * 100}%`,
      width: `${(ENVIRONMENT_REGION.right - ENVIRONMENT_REGION.left) * 100}%`,
      height: `${(ENVIRONMENT_REGION.bottom - ENVIRONMENT_REGION.top) * 100}%`,
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const disableHeatmap = !heatmapDataUri;

  return (
    <section className="rounded-3xl border border-white/5 bg-white/10 p-6 shadow-midnight backdrop-blur-xl">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Bias Lab Replay</h3>
          <p className="text-sm text-slate-300">
            Scrub through the scene, toggle overlays, and inspect how selective attention shaped what stuck.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{formattedTimestamp}</span>
          <span>·</span>
          <span>{Math.round(attention.metrics?.suspectAttentionPercent ?? attention.gazeDistribution.suspect)}% suspect focus</span>
        </div>
      </header>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black" ref={overlayRef}>
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full object-contain"
              playsInline
              onLoadedMetadata={() => {
                setCurrentTime(0);
              }}
              onEnded={() => setIsPlaying(false)}
            />

            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

            {showHeatmap && heatmapDataUri && (
              <img
                src={heatmapDataUri}
                alt="Heatmap overlay"
                className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
              />
            )}

            {showSuspectHighlight && (
              <>
                <div
                  className="pointer-events-none absolute rounded-xl border border-electricPink/70 bg-electricPink/10 blur-[0.5px]"
                  style={suspectOverlayStyles}
                />
                <div
                  className="pointer-events-none absolute rounded-xl border border-aurora/60 bg-aurora/10"
                  style={environmentOverlayStyles}
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={Math.min(currentTime, duration)}
              onChange={handleSliderChange}
              className="w-full accent-electricPink"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <button
                type="button"
                onClick={togglePlayback}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-white transition hover:bg-white/20"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => setSlowMotion((prev) => !prev)}
                className={`rounded-full border px-4 py-1.5 transition ${
                  slowMotion
                    ? "border-electricPink/60 bg-electricPink/20 text-electricPink"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/20"
                }`}
              >
                {slowMotion ? "Slow Motion: On" : "Slow Motion: Off"}
              </button>
              <button
                type="button"
                onClick={() => setShowHeatmap((prev) => !prev)}
                disabled={disableHeatmap}
                className={`rounded-full border px-4 py-1.5 transition ${
                  showHeatmap && !disableHeatmap
                    ? "border-electricPink/60 bg-electricPink/20 text-electricPink"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5 disabled:text-slate-500"
                }`}
              >
                {disableHeatmap ? "Heatmap Unavailable" : showHeatmap ? "Heatmap: On" : "Heatmap: Off"}
              </button>
              <button
                type="button"
                onClick={() => setShowSuspectHighlight((prev) => !prev)}
                className={`rounded-full border px-4 py-1.5 transition ${
                  showSuspectHighlight
                    ? "border-electricPink/60 bg-electricPink/20 text-electricPink"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/20"
                }`}
              >
                {showSuspectHighlight ? "Spotlight: On" : "Spotlight: Off"}
              </button>
              <button
                type="button"
                onClick={() => setShowGazeTrail((prev) => !prev)}
                className={`rounded-full border px-4 py-1.5 transition ${
                  showGazeTrail
                    ? "border-electricPink/60 bg-electricPink/20 text-electricPink"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/20"
                }`}
              >
                {showGazeTrail ? "Gaze Trail: On" : "Gaze Trail: Off"}
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-3xl border border-white/10 bg-midnight-900/70 p-4 text-sm text-slate-200">
          <h4 className="text-base font-semibold text-white">Timeline Notes</h4>
          <ul className="space-y-3">
            {attention.criticalMoments.length > 0 ? (
              attention.criticalMoments.map((moment, index) => (
                <li key={`${moment.timestamp}-${moment.gazeLocation}-${index}`} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-electricPink" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{moment.gazeLocation}</p>
                    <p>
                      {moment.blinked ? "Blink registered" : "Fixation"} at {moment.timestamp.toFixed(1)}s
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-slate-400">Critical gaze moments will appear here once captured.</li>
            )}
          </ul>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
            <p>
              Gaze trail brightness scales with blink activity, helping highlight where recall gaps might emerge when
              the suspect shifts position.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
