# Visual Assessment & Multi-Modal Learning Implementation

## Overview

This document describes the visual assessment and multi-modal learning system added to Hyro Forge.

## Files Created

### 1. `/lib/hyro/forge-visual-assessment.ts`
Main implementation file with functions for:
- Visual comprehension assessment
- Multi-modal content management
- Modality preference tracking
- Diagram generation prompts

### 2. `/migrations/046_hyro_visual_assessment.sql`
Database schema for visual assessment system with tables:
- `hyro_visual_assessments` - Visual assessment records
- `hyro_multimodal_content` - Content in different modalities
- `hyro_modality_preferences` - Student performance by modality
- `hyro_diagram_prompts` - Diagram creation prompts
- `hyro_diagram_submissions` - Student diagram submissions

## Core Features

### 1. Visual Comprehension Assessment

Assesses student ability to interpret visual content across multiple types:

**Assessment Types:**
- `diagram_interpretation` - Understanding diagrams and flowcharts
- `chart_reading` - Extracting data from charts/graphs
- `visual_comparison` - Identifying differences between images
- `spatial_reasoning` - Manipulating mental representations
- `image_analysis` - General visual analysis

**Function:**
```typescript
assessVisualComprehension(
  studentId: string,
  imageUrl: string,
  context: AssessmentContext,
  options: {
    assessmentType: VisualAssessmentType;
    question: string;
    studentResponse: string;
    responseTimeSeconds?: number;
  }
): Promise<VisualAssessmentResult>
```

**Evaluation Metrics (0-25 each):**
- **Visual Literacy** - Can identify and describe visual elements
- **Interpretation** - Understanding what visual represents
- **Detail Attention** - Noticing important details
- **Synthesis** - Connecting visual to broader concepts

**Feature Flags:**
- `USE_AI_VISION=true` - Enable AI vision-based evaluation
- Fallback to heuristic evaluation when disabled or if AI fails

### 2. Multi-Modal Content Representation

Represent same concepts across different modalities:

**Supported Modalities:**
- `text` - Written passages
- `image` - Static images
- `diagram` - Diagrams and flowcharts
- `video` - Video content
- `interactive` - Interactive activities
- `audio` - Audio content

**Functions:**
```typescript
// Generate prompt for specific modality
generateMultiModalPrompt(
  studentId: string,
  conceptId: string,
  modality: Modality
): MultiModalPrompt | null

// Create new multi-modal content
createMultiModalContent(
  studentId: string,
  params: {
    conceptId: string;
    modality: Modality;
    title: string;
    contentUrl?: string;
    contentText?: string;
    contentData?: any;
    // ... more params
  }
): MultiModalContent
```

### 3. Modality Preference Tracking

Track which learning modalities work best for each student:

**Functions:**
```typescript
// Get complete modality profile
getModalityPreferences(studentId: string): ModalityProfile

// Record performance with specific modality
recordModalityPerformance(
  studentId: string,
  modality: Modality,
  params: {
    conceptId: string;
    score: number;
    responseTimeSeconds?: number;
    contentId?: string;
  }
): void

// Get best modality for specific concept
getBestModalityForConcept(
  studentId: string,
  conceptId: string
): Modality | null
```

**Preference Score Calculation:**
- Performance (40% weight): Average score / 100 * 40
- Engagement (30% weight): Success rate (score >= 70) * 30
- Efficiency (30% weight): Items completed per minute * 10 (max 30)

**Recommendation Logic:**
- Requires minimum 3 completed items per modality
- Selects modality with highest preference score
- Defaults to 'text' if insufficient data

### 4. Diagram Generation Prompts

Guide students in creating visual representations:

**Diagram Types:**
- `flowchart` - Process steps and decisions
- `mind_map` - Concept organization
- `comparison_table` - Similarities/differences
- `timeline` - Chronological events
- `concept_map` - Idea connections
- `venn_diagram` - Overlapping characteristics
- `cause_effect` - Causal relationships
- `hierarchy` - Levels and tiers

**Function:**
```typescript
generateDiagramPrompt(
  conceptId: string,
  diagramType: DiagramType,
  params?: {
    customPrompt?: string;
    requiredElements?: string[];
  }
): DiagramPrompt
```

**Each prompt includes:**
- Prompt text with clear instructions
- Guidelines for creating the diagram
- Required elements checklist
- Evaluation rubric

## Integration with Existing Systems

### With Comprehension System

Visual assessments extend the existing comprehension system:

```typescript
import { PromptType } from './forge-comprehension';
import { VisualAssessmentType, assessVisualComprehension } from './forge-visual-assessment';

// Extend PromptType to include visual variants
export type ExtendedPromptType = PromptType | 
  'visual_analysis' | 
  'diagram_creation' | 
  'chart_interpretation';

// Use in discussions or quests
const visualResult = await assessVisualComprehension(
  studentId,
  imageUrl,
  { bookId, chapterId },
  {
    assessmentType: 'diagram_interpretation',
    question: 'What does this diagram show about...',
    studentResponse: studentAnswer,
  }
);
```

### With Quest System

Visual quests can be created using diagram prompts:

```typescript
import { generateDiagramPrompt } from './forge-visual-assessment';

// Create a quest for diagram creation
const diagramPrompt = generateDiagramPrompt(
  conceptId,
  'mind_map',
  {
    customPrompt: 'Create a mind map of the water cycle',
    requiredElements: ['Evaporation', 'Condensation', 'Precipitation', 'Collection'],
  }
);

// Add to quest system as 'creation' type quest
const quest = await createQuest({
  questType: 'creation',
  title: 'Map the Water Cycle',
  description: diagramPrompt.promptText,
  // ... other quest params
});
```

### With Profile System

Modality preferences can enhance learning recommendations:

```typescript
import { getModalityPreferences, getBestModalityForConcept } from './forge-visual-assessment';

// Get student's modality profile
const profile = getModalityPreferences(studentId);
console.log(`Recommended modality: ${profile.recommendedModality}`);

// For specific concept
const bestModality = getBestModalityForConcept(studentId, 'photosynthesis');

// Recommend content in preferred modality
if (bestModality) {
  const prompt = generateMultiModalPrompt(studentId, 'photosynthesis', bestModality);
  // Present prompt to student
}
```

## Data Flow

### Visual Assessment Flow

1. **Present Visual** - Show image/diagram to student
2. **Ask Question** - Pose comprehension question
3. **Collect Response** - Student provides written/verbal response
4. **Evaluate** - AI vision or heuristic evaluation
5. **Score & Feedback** - Calculate scores, generate feedback
6. **Award XP** - Based on performance (10-40 XP)
7. **Store Results** - Save to `hyro_visual_assessments`
8. **Update Profile** - Track modality performance

### Modality Tracking Flow

1. **Record Performance** - After each multi-modal assessment
2. **Calculate Metrics** - Score, time, engagement per modality
3. **Update Preferences** - Recalculate preference scores
4. **Generate Recommendations** - Identify best modalities
5. **Adapt Content** - Present future content in preferred modality

## Environment Variables

```bash
# Enable AI vision-based evaluation (requires vision-capable model)
USE_AI_VISION=true

# LLM for evaluations (reuses existing OpenRouter setup)
OPENROUTER_API_KEY=sk-...
```

## Database Schema

See `/migrations/046_hyro_visual_assessment.sql` for complete schema.

**Key Tables:**
- `hyro_visual_assessments` - Assessment records
- `hyro_multimodal_content` - Content library
- `hyro_modality_preferences` - Performance tracking
- `hyro_diagram_prompts` - Creation prompts
- `hyro_diagram_submissions` - Student work

## Example Usage

### Basic Visual Assessment

```typescript
import { assessVisualComprehension } from '@/lib/hyro/forge-visual-assessment';

const result = await assessVisualComprehension(
  'student-123',
  'https://example.com/diagram.png',
  { conceptId: 'cell-structure', difficulty: 'medium', statTargeted: 'science' },
  {
    assessmentType: 'diagram_interpretation',
    question: 'Label and explain the major parts of a plant cell',
    studentResponse: 'The nucleus is in the center and contains DNA...',
    responseTimeSeconds: 180,
  }
);

console.log(`Score: ${result.score}/100`);
console.log(`Feedback: ${result.feedback}`);
console.log(`Visual Literacy: ${result.visualLiteracyScore}/25`);
```

### Modality Recommendation

```typescript
import { getModalityPreferences, generateMultiModalPrompt } from '@/lib/hyro/forge-visual-assessment';

const profile = getModalityPreferences('student-123');

if (profile.recommendedModality === 'video') {
  // Student learns best from videos
  const videoPrompt = generateMultiModalPrompt(
    'student-123',
    'photosynthesis',
    'video'
  );
  
  if (videoPrompt) {
    // Present video + comprehension question
    console.log(videoPrompt.promptText);
  }
} else if (profile.recommendedModality === 'diagram') {
  // Student learns best from diagrams
  const diagramPrompt = generateMultiModalPrompt(
    'student-123',
    'photosynthesis',
    'diagram'
  );
  
  if (diagramPrompt) {
    // Present diagram + interpretation question
    console.log(diagramPrompt.promptText);
  }
}
```

### Diagram Creation Task

```typescript
import { generateDiagramPrompt } from '@/lib/hyro/forge-visual-assessment';

const prompt = generateDiagramPrompt(
  'scientific-method',
  'flowchart',
  {
    customPrompt: 'Create a flowchart showing the steps of the scientific method',
    requiredElements: [
      'Ask Question',
      'Research',
      'Form Hypothesis',
      'Test with Experiment',
      'Analyze Data',
      'Draw Conclusion',
    ],
  }
);

console.log('Task:', prompt.promptText);
console.log('Guidelines:', prompt.guidelines);
console.log('Required:', prompt.requiredElements);
console.log('Rubric:', prompt.evaluationRubric);
```

## Testing

### Unit Tests

```typescript
describe('Visual Assessment', () => {
  it('should evaluate visual comprehension', async () => {
    const result = await assessVisualComprehension(...);
    expect(result.score).toBeGreaterThan(0);
    expect(result.visualLiteracyScore).toBeLessThanOrEqual(25);
  });
  
  it('should track modality preferences', () => {
    recordModalityPerformance('student-123', 'diagram', {
      conceptId: 'test-concept',
      score: 85,
    });
    
    const profile = getModalityPreferences('student-123');
    expect(profile.preferences.diagram.itemsCompleted).toBeGreaterThan(0);
  });
});
```

## Future Enhancements

1. **Vision Model Integration** - Full AI vision evaluation with image analysis
2. **Diagram Auto-Evaluation** - AI scoring of student-created diagrams
3. **Interactive Diagrams** - Drag-drop diagram building in UI
4. **Adaptive Content** - Auto-select modality based on real-time performance
5. **Multi-Modal Quests** - Quests requiring multiple modalities
6. **Accessibility Features** - Alt text generation, audio descriptions

## Related Files

- `/lib/hyro/forge-comprehension.ts` - Text-based comprehension (extends this)
- `/lib/hyro/forge-quest-generator.ts` - Quest system (integrates visual quests)
- `/lib/hyro/forge-types.ts` - Type definitions (add visual types)
- `/lib/hyro/forge-xp.ts` - XP system (awards XP for visual assessments)

## Notes

- Visual assessments integrate seamlessly with existing comprehension system
- Modality tracking adapts to individual learning preferences
- All visual assessments award XP (10-40 based on performance)
- AI vision evaluation requires USE_AI_VISION=true flag
- Heuristic evaluation provides fallback when AI unavailable
- Database migration must be run before using these features

## Migration

To enable visual assessment features:

```bash
# Run the migration
sqlite3 data/wrath-shield.db < migrations/046_hyro_visual_assessment.sql

# Verify tables created
sqlite3 data/wrath-shield.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hyro_%visual%';"
```
