# Visual Assessment Integration Guide

## Quick Start

### 1. Run Database Migration

```bash
sqlite3 data/wrath-shield.db < migrations/046_hyro_visual_assessment.sql
```

### 2. Complete Implementation

The stub file at `/lib/hyro/forge-visual-assessment.ts` needs to be completed with the full implementation. Reference the comprehensive implementation in `VISUAL_ASSESSMENT_IMPLEMENTATION.md`.

**Key Functions to Implement:**
- `assessVisualComprehension()` - Main assessment function
- `generateMultiModalPrompt()` - Generate prompts for different modalities
- `getModalityPreferences()` - Get student's learning preferences
- `recordModalityPerformance()` - Track performance by modality
- `generateDiagramPrompt()` - Create diagram creation prompts

### 3. Extend Existing Types

Add visual assessment types to `/lib/hyro/forge-types.ts`:

```typescript
// Add to existing XPSource type
export type XPSource =
  | 'quest'
  | 'daily'
  // ... existing sources
  | 'visual_assessment'
  | 'diagram_creation'
  | 'multimodal_content';

// Add to SubmissionType
export type SubmissionType = 
  | 'text' 
  | 'voice' 
  | 'image' 
  | 'url' 
  | 'code'
  | 'diagram';
```

### 4. Extend Comprehension System

In `/lib/hyro/forge-comprehension.ts`, add visual prompt types:

```typescript
export type PromptType = 
  | 'analysis' 
  | 'connection' 
  | 'prediction' 
  | 'creation' 
  | 'meta'
  | 'visual_analysis'        // NEW
  | 'diagram_interpretation' // NEW
  | 'chart_reading';         // NEW
```

### 5. Extend Quest System

In `/lib/hyro/forge-quest-generator.ts`, add visual quest support:

```typescript
import { generateDiagramPrompt, DiagramType } from './forge-visual-assessment';

export async function generateVisualQuest(
  studentId: string,
  conceptId: string,
  diagramType: DiagramType
): Promise<Quest> {
  const diagramPrompt = generateDiagramPrompt(conceptId, diagramType);
  
  return createQuest({
    questType: 'daily',
    title: `Create ${diagramType}: ${conceptId}`,
    description: diagramPrompt.promptText,
    required_stat: 'critical_thinking',
    difficulty: 'medium',
    xp_reward: 35,
    // ... other params
  });
}
```

## Integration Examples

### Example 1: Visual Assessment in Reading Discussion

```typescript
import { assessVisualComprehension } from './forge-visual-assessment';
import { continueDiscussion } from './forge-comprehension';

// After showing a book illustration
const visualResult = await assessVisualComprehension(
  studentId,
  illustrationUrl,
  { bookId: 'book-wonder', chapterId: 'chapter-1' },
  {
    assessmentType: 'image_analysis',
    question: 'What emotions does this illustration convey about Auggie?',
    studentResponse: studentAnswer,
  }
);

// Feed result back into discussion
const discussion = continueDiscussion(
  studentId,
  discussionId,
  `I noticed ${visualResult.strengths.join(', ')}. ${visualResult.feedback}`,
);
```

### Example 2: Modality-Adaptive Content Delivery

```typescript
import { 
  getModalityPreferences, 
  generateMultiModalPrompt,
  recordModalityPerformance 
} from './forge-visual-assessment';

async function presentConcept(studentId: string, conceptId: string) {
  // Get student's preferred modality
  const profile = getModalityPreferences(studentId);
  const preferredModality = profile.recommendedModality;
  
  // Generate prompt in preferred modality
  const prompt = generateMultiModalPrompt(studentId, conceptId, preferredModality);
  
  if (!prompt) {
    // Fallback to text if no content in preferred modality
    const textPrompt = generateMultiModalPrompt(studentId, conceptId, 'text');
    return textPrompt;
  }
  
  // Present to student, then record performance
  const score = await evaluateResponse(studentAnswer);
  recordModalityPerformance(studentId, preferredModality, {
    conceptId,
    score,
    responseTimeSeconds: elapsedTime,
  });
  
  return prompt;
}
```

### Example 3: Visual Quest Generation

```typescript
import { generateDiagramPrompt } from './forge-visual-assessment';
import { createQuest } from './forge-quest-generator';

async function generateDailyVisualQuest(studentId: string) {
  const concepts = ['water-cycle', 'photosynthesis', 'food-chain'];
  const randomConcept = concepts[Math.floor(Math.random() * concepts.length)];
  
  const diagramPrompt = generateDiagramPrompt(randomConcept, 'flowchart', {
    customPrompt: `Create a flowchart explaining the ${randomConcept}`,
  });
  
  const quest = await createQuest(studentId, {
    questType: 'daily',
    title: `Visual Quest: ${randomConcept}`,
    description: diagramPrompt.promptText,
    required_stat: 'science',
    difficulty: 'medium',
    xp_reward: 30,
    metadata: {
      diagram_type: 'flowchart',
      concept_id: randomConcept,
      guidelines: diagramPrompt.guidelines,
      required_elements: diagramPrompt.requiredElements,
    },
  });
  
  return quest;
}
```

## API Route Examples

### POST /api/hyro/visual-assessment

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { assessVisualComprehension } from '@/lib/hyro/forge-visual-assessment';

export async function POST(req: NextRequest) {
  const { studentId, imageUrl, assessmentType, question, studentResponse } = await req.json();
  
  try {
    const result = await assessVisualComprehension(
      studentId,
      imageUrl,
      { conceptId: 'example' },
      { assessmentType, question, studentResponse }
    );
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

### GET /api/hyro/modality-profile/:studentId

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getModalityPreferences } from '@/lib/hyro/forge-visual-assessment';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const profile = getModalityPreferences(params.studentId);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

## UI Component Examples

### VisualAssessmentCard.tsx

```typescript
'use client';

import { useState } from 'react';

interface VisualAssessmentCardProps {
  studentId: string;
  imageUrl: string;
  question: string;
  assessmentType: string;
}

export function VisualAssessmentCard({ 
  studentId, 
  imageUrl, 
  question, 
  assessmentType 
}: VisualAssessmentCardProps) {
  const [response, setResponse] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    
    const res = await fetch('/api/hyro/visual-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        imageUrl,
        assessmentType,
        question,
        studentResponse: response,
      }),
    });
    
    const data = await res.json();
    setResult(data.data);
    setLoading(false);
  };

  return (
    <div className="border rounded-lg p-6">
      <img src={imageUrl} alt="Assessment Visual" className="w-full mb-4 rounded" />
      <p className="font-semibold mb-2">{question}</p>
      
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        className="w-full border rounded p-2 mb-4"
        rows={4}
        placeholder="Your answer..."
      />
      
      <button 
        onClick={handleSubmit} 
        disabled={loading || !response}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? 'Evaluating...' : 'Submit'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <div className="text-xl font-bold mb-2">
            Score: {result.score}/100
          </div>
          <p className="mb-2">{result.feedback}</p>
          
          {result.strengths.length > 0 && (
            <div className="mb-2">
              <strong>Strengths:</strong>
              <ul className="list-disc ml-5">
                {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          
          {result.growthAreas.length > 0 && (
            <div>
              <strong>Growth Areas:</strong>
              <ul className="list-disc ml-5">
                {result.growthAreas.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
          
          <div className="mt-2 text-sm text-gray-600">
            XP Earned: +{result.xpEarned}
          </div>
        </div>
      )}
    </div>
  );
}
```

### ModalityProfileDashboard.tsx

```typescript
'use client';

import { useEffect, useState } from 'react';

export function ModalityProfileDashboard({ studentId }: { studentId: string }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetch(`/api/hyro/modality-profile/${studentId}`)
      .then(res => res.json())
      .then(data => setProfile(data.data));
  }, [studentId]);

  if (!profile) return <div>Loading...</div>;

  const modalities = ['text', 'image', 'diagram', 'video', 'interactive', 'audio'];

  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-xl font-bold mb-4">Your Learning Style Profile</h3>
      
      <div className="mb-4 p-4 bg-blue-50 rounded">
        <strong>Recommended Modality:</strong> {profile.recommendedModality}
      </div>
      
      <div className="space-y-2">
        {modalities.map(modality => {
          const perf = profile.preferences[modality];
          return (
            <div key={modality} className="border rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold capitalize">{modality}</span>
                <span className="text-sm">
                  {perf.itemsCompleted} completed
                </span>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Average Score:</span>
                  <span>{Math.round(perf.averageScore)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Engagement:</span>
                  <span>{Math.round(perf.engagementRate * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Preference Score:</span>
                  <span>{Math.round(perf.preferenceScore)}/100</span>
                </div>
              </div>
              
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${perf.preferenceScore}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Visual assessments save to database
- [ ] AI vision evaluation works (when enabled)
- [ ] Heuristic fallback evaluation works
- [ ] Modality preferences track correctly
- [ ] Modality recommendations update
- [ ] XP awards for visual assessments
- [ ] Diagram prompts generate correctly
- [ ] Multi-modal content retrieval works
- [ ] UI components render properly
- [ ] API routes return correct data

## Troubleshooting

**Issue: AI vision evaluation fails**
- Check `USE_AI_VISION` environment variable
- Verify OpenRouter API key is set
- Ensure model supports vision capabilities
- Check fallback to heuristic evaluation works

**Issue: No modality preferences**
- Verify `recordModalityPerformance()` is called after assessments
- Check student has completed at least 3 items per modality
- Verify database records in `hyro_modality_preferences`

**Issue: Diagram prompts missing required elements**
- Ensure custom prompts include required elements
- Check default required elements for diagram type
- Verify evaluation rubric is set

## Next Steps

1. Complete the full implementation in `forge-visual-assessment.ts`
2. Run database migration
3. Add visual assessment UI components
4. Create API routes for visual assessment endpoints
5. Integrate with existing comprehension and quest systems
6. Add tests for visual assessment functions
7. Deploy and monitor performance

## Resources

- Full implementation spec: `VISUAL_ASSESSMENT_IMPLEMENTATION.md`
- Database schema: `migrations/046_hyro_visual_assessment.sql`
- Existing comprehension system: `lib/hyro/forge-comprehension.ts`
- Quest system: `lib/hyro/forge-quest-generator.ts`
- Type definitions: `lib/hyro/forge-types.ts`
