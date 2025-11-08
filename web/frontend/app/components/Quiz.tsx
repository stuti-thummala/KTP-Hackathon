'use client';

import { useState } from 'react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: string;
}

const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'How many robbers stormed the gallery?',
    options: ['Five', 'Six', 'Seven', 'Eight'],
    correctAnswer: 'Seven',
  },
  {
    id: 2,
    text: 'How many of the robbers were women?',
    options: ['One', 'Two', 'Three', 'Four'],
    correctAnswer: 'Three',
  },
  {
    id: 3,
    text: 'Which gem colors were the crew targeting?',
    options: ['Blue and gold', 'Green and red', 'Purple and silver', 'Black and white'],
    correctAnswer: 'Green and red',
  },
  {
    id: 4,
    text: 'How many people smashed the display window?',
    options: ['None', 'One', 'Two', 'Three'],
    correctAnswer: 'Two',
  },
];

interface QuizProps {
  onComplete: (score: number, answers: Record<number, string>) => void;
}

export default function Quiz({ onComplete }: QuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const totalQuestions = SAMPLE_QUESTIONS.length;
  const progress = Math.round((currentQuestion / totalQuestions) * 100);
  
  const handleAnswer = (answer: string) => {
    const question = SAMPLE_QUESTIONS[currentQuestion];
    const newAnswers = {
      ...answers,
      [question.id]: answer,
    };

    setAnswers(newAnswers);

    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Calculate score
      const score = SAMPLE_QUESTIONS.reduce((acc, q) => {
        return acc + (newAnswers[q.id] === q.correctAnswer ? 1 : 0);
      }, 0);
      
      onComplete(score, newAnswers);
    }
  };
  
  const question = SAMPLE_QUESTIONS[currentQuestion];
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-400">
          <span>Prompt {currentQuestion + 1} / {totalQuestions}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-electricPink via-electricPink/80 to-electricPink/50 transition-all"
            style={{ width: `${Math.min(100, Math.max(5, progress + 5))}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-midnight">
        <p className="text-lg font-semibold text-white">{question.text}</p>
      </div>
      
      <div className="grid gap-3">
        {question.options.map((option) => {
          const isSelected = answers[question.id] === option;
          return (
            <button
              key={option}
              onClick={() => handleAnswer(option)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-electricPink/60 ${
                isSelected
                  ? 'border-electricPink/60 bg-electricPink/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:border-electricPink/30 hover:bg-electricPink/10 hover:text-white'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}