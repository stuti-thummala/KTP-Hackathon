'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const VideoOverlay = dynamic(() => import('../components/VideoOverlay'), {
  ssr: false
});

const Quiz = dynamic(() => import('../components/Quiz'), {
  ssr: false
});

type DemoStage = 'intro' | 'video' | 'quiz' | 'results';

export default function Demo() {
  const [stage, setStage] = useState<DemoStage>('intro');
  const [gazeData, setGazeData] = useState<{x: number; y: number}[]>([]);
  const [isCalibrated, setIsCalibrated] = useState(false);
  
  const handleGazeData = (data: {x: number; y: number}) => {
    setGazeData(prev => [...prev, data]);
  };
  
  const handleVideoComplete = () => {
    setStage('quiz');
  };

  const handleCalibrationComplete = () => {
    setIsCalibrated(true);
  };
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4">
        {stage === 'intro' && (
          <div className="max-w-2xl mx-auto text-center p-8 bg-white rounded-lg shadow">
            <h1 className="text-3xl font-bold mb-4">Witness Memory Experiment</h1>
            <div className="space-y-4 text-left mb-8">
              <p className="text-lg">Here&apos;s what will happen:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>First, we&apos;ll calibrate the eye tracker (takes about 30 seconds)</li>
                <li>You&apos;ll watch a short video of a simulated robbery</li>
                <li>We&apos;ll test your memory of what you saw</li>
                <li>You&apos;ll see how your attention affected your memory</li>
              </ol>
            </div>
            <button
              onClick={() => setStage('video')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Start Experiment
            </button>
          </div>
        )}
        
        {stage === 'video' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold mb-4">
                {!isCalibrated ? 'Eye Tracker Calibration' : 'Watch Carefully'}
              </h2>
              <p className="mb-6">
                {!isCalibrated 
                  ? 'Follow the dots with your eyes as they appear on screen. Keep your head still.'
                  : 'Pay attention to all details in the video - you\'ll be tested on them afterward.'}
              </p>
              <VideoOverlay
                videoSrc="/video.mp4"
                onGazeData={handleGazeData}
                onVideoComplete={handleVideoComplete}
                onCalibrationComplete={handleCalibrationComplete}
              />
            </div>
          </div>
        )}
        
        {stage === 'quiz' && (
          <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Memory Test</h2>
            <Quiz 
              onComplete={(score, answers) => {
                console.log('Score:', score, 'Answers:', answers);
                setStage('results');
              }} 
            />
          </div>
        )}
        
        {stage === 'results' && (
          <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Your Results</h2>
            {/* Results visualization will go here */}
          </div>
        )}
      </div>
    </main>
  );
}