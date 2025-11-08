'use client';

import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

interface AttentionData {
  score: number;
  blinkCount: number;
  gazeDistribution: {
    suspect: number;
    guard: number;
    artwork: number;
  };
  criticalMoments: {
    timestamp: number;
    gazeLocation: string;
    blinked: boolean;
  }[];
}

interface VideoOverlayProps {
  videoSrc: string;
  onGazeData?: (data: {x: number; y: number}) => void;
  onVideoComplete?: (attentionData: AttentionData) => void;
  onCalibrationComplete?: () => void;
}

export default function VideoOverlay({ videoSrc, onGazeData, onVideoComplete, onCalibrationComplete }: VideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gazeData, setGazeData] = useState<{x: number; y: number}[]>([]);
  
  // Store timestamps of video segments for analysis
  const videoSegments = {
    intro: [0, 5],      // First 5 seconds
    suspectAppears: [5, 10],  // 5-10 seconds
    heist: [10, 20],    // 10-20 seconds
    escape: [20, 30]    // 20-30 seconds
  };

  // Track attention metrics
  const [attentionMetrics, setAttentionMetrics] = useState({
    blinkCount: 0,
    gazePoints: {
      suspect: [] as {x: number, y: number, timestamp: number}[],
      guard: [] as {x: number, y: number, timestamp: number}[],
      artwork: [] as {x: number, y: number, timestamp: number}[]
    },
    attentionScore: 0
  });

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8002/ws/gaze');
    let videoStartTime = 0;
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const currentTime = videoRef.current?.currentTime || 0;
      const gazePoint = {
        x: data.x * window.innerWidth,
        y: data.y * window.innerHeight,
        blink: data.blink,
        timestamp: currentTime
      };

      // Update gaze visualization
      setGazeData(prev => [...prev, gazePoint]);
      onGazeData?.(gazePoint);

      // Track metrics if video is playing
      if (isPlaying) {
        // Count blinks
        if (data.blink) {
          setAttentionMetrics(prev => ({
            ...prev,
            blinkCount: prev.blinkCount + 1
          }));
        }

        // Determine what the user is looking at based on screen regions
        const region = determineGazeRegion(gazePoint.x, gazePoint.y);
        if (region) {
          setAttentionMetrics(prev => ({
            ...prev,
            gazePoints: {
              ...prev.gazePoints,
              [region]: [...prev.gazePoints[region], gazePoint]
            }
          }));
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [onGazeData, isPlaying]);

  // Helper function to determine what region the user is looking at
  const determineGazeRegion = (x: number, y: number): 'suspect' | 'guard' | 'artwork' | null => {
    // These would be configured based on your actual video layout
    const regions = {
      suspect: { x: [0.6, 0.8], y: [0.3, 0.7] },
      guard: { x: [0.2, 0.4], y: [0.3, 0.7] },
      artwork: { x: [0.4, 0.6], y: [0.1, 0.3] }
    };

    const normalizedX = x / window.innerWidth;
    const normalizedY = y / window.innerHeight;

    for (const [region, bounds] of Object.entries(regions)) {
      if (
        normalizedX >= bounds.x[0] && 
        normalizedX <= bounds.x[1] && 
        normalizedY >= bounds.y[0] && 
        normalizedY <= bounds.y[1]
      ) {
        return region as 'suspect' | 'guard' | 'artwork';
      }
    }

    return null;
  };
  
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  
  const [calibrationDot, setCalibrationDot] = useState<{x: number, y: number} | null>(null);
  const calibrationPoints = [
    {x: 0.1, y: 0.1},
    {x: 0.5, y: 0.1},
    {x: 0.9, y: 0.1},
    {x: 0.1, y: 0.5},
    {x: 0.5, y: 0.5},
    {x: 0.9, y: 0.5},
    {x: 0.1, y: 0.9},
    {x: 0.5, y: 0.9},
    {x: 0.9, y: 0.9},
  ];

  const startCalibration = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationProgress(0);
      
      for (let i = 0; i < calibrationPoints.length; i++) {
        setCalibrationDot(calibrationPoints[i]);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Show each point for 2 seconds
        setCalibrationProgress((i + 1) * (100 / calibrationPoints.length));
      }

      setCalibrationDot(null);
      setIsCalibrating(false);
      setIsCalibrated(true);
      onCalibrationComplete?.();
    } catch (error) {
      console.error('Calibration failed:', error);
      setIsCalibrating(false);
      setCalibrationProgress(0);
      setCalibrationDot(null);
    }
  };
  
  const calculateAttentionScore = () => {
    const metrics = {
      suspectAttention: attentionMetrics.gazePoints.suspect.length,
      guardAttention: attentionMetrics.gazePoints.guard.length,
      artworkAttention: attentionMetrics.gazePoints.artwork.length,
      blinkPenalty: Math.min(attentionMetrics.blinkCount * 2, 30), // Up to 30 point penalty for blinking
    };

    // Calculate percentage of time spent looking at the suspect
    const totalGazePoints = 
      metrics.suspectAttention + 
      metrics.guardAttention + 
      metrics.artworkAttention;

    const suspectAttentionPercent = 
      totalGazePoints > 0 ? (metrics.suspectAttention / totalGazePoints) * 100 : 0;

    // Base score out of 100
    let score = 100;

    // Deduct points for poor suspect attention
    if (suspectAttentionPercent < 40) {
      score -= (40 - suspectAttentionPercent);
    }

    // Deduct points for excessive blinking
    score -= metrics.blinkPenalty;

    // Ensure score stays between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    
    // Calculate final attention score
    const score = calculateAttentionScore();
    setAttentionMetrics(prev => ({
      ...prev,
      attentionScore: score
    }));

    // Pass attention data to parent
    onVideoComplete?.();
  };
  
  const startDemo = () => {
    if (videoRef.current && isCalibrated) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };
  
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {/* Webcam feed */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.1 }}>
          <Webcam
            ref={webcamRef}
            videoConstraints={{
              width: 640,
              height: 480,
            }}
            className="w-full h-full object-contain"
          />
        </div>
        
        {/* Main video */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${!isCalibrating ? 'opacity-100' : 'opacity-0'}`}>
          {isCalibrated && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <button
                onClick={startDemo}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-lg font-semibold"
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
        
        {/* Calibration dot */}
        {calibrationDot && (
          <div 
            className="absolute w-4 h-4 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
            style={{
              left: `${calibrationDot.x * 100}%`,
              top: `${calibrationDot.y * 100}%`,
            }}
          />
        )}

        {/* Calibration instructions */}
        {!isCalibrated && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-black/75 text-white text-center">
            <p>Follow the red dot with your eyes as it appears on screen.</p>
            <p className="text-sm opacity-75">Keep your head still during calibration.</p>
          </div>
        )}
        
        {/* Gaze overlay */}
        {(isPlaying || isCalibrated) && (
          <div 
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: 'transparent',
            }}
          >
            <div
              className="absolute w-4 h-4 bg-red-500 rounded-full opacity-50 transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
              style={{
                left: `${gazeData[gazeData.length - 1]?.x || 0}px`,
                top: `${gazeData[gazeData.length - 1]?.y || 0}px`,
                transition: 'all 0.1s ease-out'
              }}
            />
          </div>
        )}
      </div>
      
      <div className="mt-4 flex flex-col items-center gap-4">
        {!isCalibrated ? (
          <>
            {!isCalibrating ? (
              <button
                onClick={startCalibration}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-lg font-semibold"
              >
                Start Calibration
              </button>
            ) : (
              <div className="w-full max-w-md">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${calibrationProgress}%` }}
                  />
                </div>
                <p className="text-center mt-2 text-sm text-gray-600">
                  Calibrating... {calibrationProgress}%
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}