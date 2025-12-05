'use client';

/**
 * HYRO FORGE: Student Onboarding Page
 * Multi-step wizard for new students to set up their profile
 */

import { useState } from 'react';
import { useUser, RedirectToSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'profile', title: 'Your Profile' },
  { id: 'grade', title: 'Your Grade' },
  { id: 'goals', title: 'Your Goals' },
];

const LEARNING_GOALS = [
  { id: 'math', label: 'Math', icon: '🔢', description: 'Arithmetic, algebra, and problem-solving' },
  { id: 'reading', label: 'Reading', icon: '📚', description: 'Comprehension and vocabulary' },
  { id: 'science', label: 'Science', icon: '🔬', description: 'Exploration and discovery' },
  { id: 'coding', label: 'Coding', icon: '💻', description: 'Programming and logic' },
  { id: 'writing', label: 'Writing', icon: '✍️', description: 'Creative and technical writing' },
  { id: 'study_skills', label: 'Study Skills', icon: '🎯', description: 'Organization and time management' },
];

interface OnboardingData {
  displayName: string;
  gradeLevel: number;
  goals: string[];
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    gradeLevel: 5,
    goals: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loading state
  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  // Redirect to sign in if not authenticated
  if (!user) {
    return <RedirectToSignIn />;
  }

  const currentStep = STEPS[step];

  async function handleNext() {
    if (step === 1 && !data.displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    setError(null);

    // Save step data to API
    try {
      await fetch('/api/hyro/forge/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: currentStep.id, data }),
      });
    } catch (err) {
      console.error('Failed to save step data:', err);
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/hyro/forge/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'complete', data }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to complete onboarding');
      }

      // Redirect to main dashboard
      router.push('/hyro/forge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Indicator */}
        <div className="flex justify-center mb-8 gap-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                    ? 'bg-blue-500 text-white scale-110'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-12 h-1 mx-1 transition-all duration-300 ${
                    i < step ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content Card */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Step Components */}
          {step === 0 && <WelcomeStep user={user} />}
          {step === 1 && <ProfileStep data={data} setData={setData} user={user} />}
          {step === 2 && <GradeStep data={data} setData={setData} />}
          {step === 3 && (
            <GoalsStep data={data} setData={setData} onComplete={handleComplete} loading={loading} />
          )}

          {/* Navigation Buttons */}
          {step < 3 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-700">
              {step > 0 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
              >
                {step === 2 ? 'Continue →' : 'Next →'}
              </button>
            </div>
          )}
        </div>

        {/* Step Title Below Card */}
        <div className="text-center mt-4 text-gray-400 text-sm">
          Step {step + 1} of {STEPS.length}: {currentStep.title}
        </div>
      </div>
    </div>
  );
}

/**
 * Welcome Step Component
 */
function WelcomeStep({ user }: { user: any }) {
  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="text-6xl mb-4">🚀</div>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
          Welcome to HYRO FORGE!
        </h1>
        <p className="text-xl text-gray-300">
          Hey {user.firstName || 'there'}! Ready to level up your learning?
        </p>
      </div>

      <div className="space-y-4 text-left max-w-md mx-auto">
        <div className="flex items-start gap-3 p-4 bg-gray-700/50 rounded-lg">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="font-semibold text-white mb-1">Complete Quests</h3>
            <p className="text-sm text-gray-400">Earn XP by completing daily challenges and learning activities</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-gray-700/50 rounded-lg">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="font-semibold text-white mb-1">Level Up</h3>
            <p className="text-sm text-gray-400">Track your progress and watch your character grow stronger</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-gray-700/50 rounded-lg">
          <span className="text-2xl">🏆</span>
          <div>
            <h3 className="font-semibold text-white mb-1">Unlock Achievements</h3>
            <p className="text-sm text-gray-400">Earn badges and rewards as you master new skills</p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-gray-400 text-sm">
        Let's set up your profile in just a few quick steps!
      </p>
    </div>
  );
}

/**
 * Profile Step Component
 */
function ProfileStep({
  data,
  setData,
  user,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  user: any;
}) {
  // Pre-fill display name from Clerk user data if empty
  const suggestedName = user.firstName || user.username || '';

  const handleNameChange = (value: string) => {
    setData({ ...data, displayName: value });
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">👤</div>
        <h2 className="text-3xl font-bold text-white mb-2">Create Your Profile</h2>
        <p className="text-gray-400">What should we call you in HYRO FORGE?</p>
      </div>

      <div className="max-w-md mx-auto">
        <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
        <input
          type="text"
          value={data.displayName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={suggestedName || 'Enter your name...'}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          autoFocus
        />

        {suggestedName && !data.displayName && (
          <button
            onClick={() => handleNameChange(suggestedName)}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Use "{suggestedName}"
          </button>
        )}

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <p className="text-sm text-blue-300">
            💡 <strong>Tip:</strong> Choose a name that you'll be proud to see on the leaderboards!
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Grade Step Component
 */
function GradeStep({
  data,
  setData,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
}) {
  const grades = [
    { value: 0, label: 'Kindergarten', icon: '🌱' },
    { value: 1, label: '1st Grade', icon: '🌿' },
    { value: 2, label: '2nd Grade', icon: '🌾' },
    { value: 3, label: '3rd Grade', icon: '🌳' },
    { value: 4, label: '4th Grade', icon: '🌲' },
    { value: 5, label: '5th Grade', icon: '🎄' },
    { value: 6, label: '6th Grade', icon: '🏔️' },
    { value: 7, label: '7th Grade', icon: '🗻' },
    { value: 8, label: '8th Grade', icon: '🏰' },
    { value: 9, label: '9th Grade', icon: '🎓' },
    { value: 10, label: '10th Grade', icon: '📚' },
    { value: 11, label: '11th Grade', icon: '🎯' },
    { value: 12, label: '12th Grade', icon: '🚀' },
  ];

  return (
    <div>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🎓</div>
        <h2 className="text-3xl font-bold text-white mb-2">Select Your Grade</h2>
        <p className="text-gray-400">This helps us customize your learning experience</p>
      </div>

      {/* Grade Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
        {grades.map((grade) => (
          <button
            key={grade.value}
            onClick={() => setData({ ...data, gradeLevel: grade.value })}
            className={`p-4 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 ${
              data.gradeLevel === grade.value
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
            }`}
          >
            <div className="text-3xl mb-2">{grade.icon}</div>
            <div className="text-sm font-semibold">{grade.label}</div>
          </button>
        ))}
      </div>

      {/* Slider Alternative for Fine-tuning */}
      <div className="mt-8 max-w-md mx-auto">
        <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
          Or use the slider: <span className="text-blue-400 font-bold">{grades[data.gradeLevel].label}</span>
        </label>
        <input
          type="range"
          min="0"
          max="12"
          value={data.gradeLevel}
          onChange={(e) => setData({ ...data, gradeLevel: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
}

/**
 * Goals Step Component
 */
function GoalsStep({
  data,
  setData,
  onComplete,
  loading,
}: {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  onComplete: () => void;
  loading: boolean;
}) {
  const toggleGoal = (goalId: string) => {
    setData({
      ...data,
      goals: data.goals.includes(goalId)
        ? data.goals.filter((g) => g !== goalId)
        : [...data.goals, goalId],
    });
  };

  const skipGoals = () => {
    setData({ ...data, goals: [] });
    onComplete();
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🎯</div>
        <h2 className="text-3xl font-bold text-white mb-2">Choose Your Learning Goals</h2>
        <p className="text-gray-400">Select the subjects you want to focus on (optional)</p>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {LEARNING_GOALS.map((goal) => {
          const isSelected = data.goals.includes(goal.id);
          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`p-5 rounded-lg border-2 text-left transition-all duration-200 transform hover:scale-102 ${
                isSelected
                  ? 'bg-gradient-to-br from-blue-600/40 to-purple-600/40 border-blue-400'
                  : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{goal.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{goal.label}</h3>
                    {isSelected && <span className="text-green-400 text-xl">✓</span>}
                  </div>
                  <p className="text-sm text-gray-400">{goal.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selection Summary */}
      {data.goals.length > 0 && (
        <div className="mt-6 text-center text-gray-400 text-sm">
          {data.goals.length} {data.goals.length === 1 ? 'goal' : 'goals'} selected
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 pt-6 border-t border-gray-700">
        <button
          onClick={skipGoals}
          disabled={loading}
          className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Skip for now
        </button>
        <button
          onClick={onComplete}
          disabled={loading}
          className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Setting up...
            </>
          ) : (
            <>
              Let's Begin! 🚀
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Loading Spinner Component
 */
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
