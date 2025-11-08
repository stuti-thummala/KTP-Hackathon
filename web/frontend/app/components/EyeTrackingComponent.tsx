'use client';

import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

export default function EyeTrackingComponent() {
  const webcamRef = useRef<Webcam>(null);
  const [gazePosition, setGazePosition] = useState<{ x: number; y: number } | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/gaze');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setGazePosition(data.gaze);
    };
    
    return () => ws.close();
  }, []);
  
  const startCalibration = async () => {
    try {
      const response = await fetch('http://localhost:8000/calibrate', {
        method: 'POST'
      });
      if (response.ok) {
        setIsCalibrated(true);
      }
    } catch (error) {
      console.error('Calibration failed:', error);
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Webcam
          ref={webcamRef}
          className="rounded-lg shadow-lg"
          width={640}
          height={480}
        />
        {gazePosition && (
          <div 
            className="absolute w-4 h-4 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: gazePosition.x,
              top: gazePosition.y,
            }}
          />
        )}
      </div>
      
      {!isCalibrated ? (
        <button
          onClick={startCalibration}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Start Calibration
        </button>
      ) : (
        <div className="text-green-500">Calibrated!</div>
      )}
    </div>
  );
}