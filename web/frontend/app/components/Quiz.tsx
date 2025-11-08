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
    text: "What color was the thief's jacket?",
    options: ['Black', 'Blue', 'Brown', 'Grey'],
    correctAnswer: 'Black'
  },
  {
    id: 2,
    text: 'How many people were in the room?',
    options: ['2', '3', '4', '5'],
    correctAnswer: '3'
  },
  {
    id: 3,
    text: 'What did the thief steal?',
    options: ['Painting', 'Jewelry', 'Statue', 'Document'],
    correctAnswer: 'Painting'
  }
];

interface QuizProps {
  onComplete: (score: number, answers: Record<number, string>) => void;
}

export default function Quiz({ onComplete }: QuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  
  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [SAMPLE_QUESTIONS[currentQuestion].id]: answer
    }));
    
    if (currentQuestion < SAMPLE_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Calculate score
      const score = SAMPLE_QUESTIONS.reduce((acc, q) => {
        return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
      }, 0);
      
      onComplete(score, answers);
    }
  };
  
  const question = SAMPLE_QUESTIONS[currentQuestion];
  
  return (
    <div className="space-y-6">
      <div className="text-lg font-medium">
        Question {currentQuestion + 1} of {SAMPLE_QUESTIONS.length}
      </div>
      
      <div className="text-xl">{question.text}</div>
      
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option}
            onClick={() => handleAnswer(option)}
            className="w-full p-3 text-left border rounded hover:bg-gray-50"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}