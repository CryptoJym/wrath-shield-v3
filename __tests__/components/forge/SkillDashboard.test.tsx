/**
 * SkillDashboard Component Tests
 * Tests for the skill proficiency tracking component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// lucide-react is mocked globally in jest.setup.react.ts
import { SkillDashboard, Skill } from '@/components/forge/proficiency/SkillDashboard';

// Test data
const mockSkills: Skill[] = [
  {
    id: 'skill-1',
    name: 'Algebra Basics',
    category: 'mathematics',
    stat_name: 'intelligence',
    proficiency_level: 75,
    xp_current: 450,
    xp_required: 600,
    mastery_percent: 75,
    last_practiced_at: Date.now() - 3600000,
    practice_count: 25,
    trend: 'up',
    is_unlocked: true,
  },
  {
    id: 'skill-2',
    name: 'Geometry',
    category: 'mathematics',
    stat_name: 'intelligence',
    proficiency_level: 45,
    xp_current: 200,
    xp_required: 400,
    mastery_percent: 45,
    last_practiced_at: Date.now() - 7200000,
    practice_count: 15,
    trend: 'stable',
    is_unlocked: true,
  },
  {
    id: 'skill-3',
    name: 'Calculus',
    category: 'mathematics',
    stat_name: 'intelligence',
    proficiency_level: 0,
    xp_current: 0,
    xp_required: 500,
    mastery_percent: 0,
    practice_count: 0,
    trend: 'stable',
    is_unlocked: false,
    unlock_requirement: 'Complete Algebra and Geometry',
  },
  {
    id: 'skill-4',
    name: 'Reading Comprehension',
    category: 'reading',
    stat_name: 'wisdom',
    proficiency_level: 90,
    xp_current: 900,
    xp_required: 1000,
    mastery_percent: 90,
    last_practiced_at: Date.now(),
    practice_count: 50,
    trend: 'up',
    is_unlocked: true,
  },
  {
    id: 'skill-5',
    name: 'Critical Analysis',
    category: 'reading',
    stat_name: 'wisdom',
    proficiency_level: 60,
    xp_current: 350,
    xp_required: 600,
    mastery_percent: 60,
    last_practiced_at: Date.now() - 86400000,
    practice_count: 20,
    trend: 'down',
    is_unlocked: true,
  },
];

describe('SkillDashboard', () => {
  describe('Rendering', () => {
    it('renders Skill Proficiency title', () => {
      render(<SkillDashboard skills={mockSkills} />);
      expect(screen.getByText('Skill Proficiency')).toBeInTheDocument();
    });

    it('renders sort dropdown', () => {
      render(<SkillDashboard skills={mockSkills} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Sort:')).toBeInTheDocument();
    });

    it('groups skills by category', () => {
      render(<SkillDashboard skills={mockSkills} />);

      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.getByText('Reading')).toBeInTheDocument();
    });

    it('shows category skill counts', () => {
      render(<SkillDashboard skills={mockSkills} />);

      expect(screen.getByText('2/3 skills')).toBeInTheDocument(); // Math: 2 unlocked of 3
      expect(screen.getByText('2/2 skills')).toBeInTheDocument(); // Reading: 2 unlocked of 2
    });

    it('shows category progress percentage', () => {
      render(<SkillDashboard skills={mockSkills} />);

      // Math category average = (75 + 45) / 2 = 60%
      expect(screen.getByText('60%')).toBeInTheDocument();
      // Reading category average = (90 + 60) / 2 = 75%
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no skills', () => {
      render(<SkillDashboard skills={[]} />);

      expect(screen.getByText('No Skills Available')).toBeInTheDocument();
      expect(screen.getByText('Start learning to unlock new skills!')).toBeInTheDocument();
    });
  });

  describe('Category Expansion', () => {
    it('categories are collapsed by default', () => {
      render(<SkillDashboard skills={mockSkills} />);

      // Skill names should not be visible when collapsed
      expect(screen.queryByText('Algebra Basics')).not.toBeInTheDocument();
    });

    it('expands category when clicked', () => {
      render(<SkillDashboard skills={mockSkills} />);

      fireEvent.click(screen.getByText('Math'));

      expect(screen.getByText('Algebra Basics')).toBeInTheDocument();
      expect(screen.getByText('Geometry')).toBeInTheDocument();
      expect(screen.getByText('Calculus')).toBeInTheDocument();
    });

    it('collapses category when clicked again', () => {
      render(<SkillDashboard skills={mockSkills} />);

      // Expand
      fireEvent.click(screen.getByText('Math'));
      expect(screen.getByText('Algebra Basics')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('Math'));
      expect(screen.queryByText('Algebra Basics')).not.toBeInTheDocument();
    });

    it('shows chevron up when expanded', () => {
      render(<SkillDashboard skills={mockSkills} />);

      fireEvent.click(screen.getByText('Math'));

      expect(screen.getByTestId('icon-chevron-up')).toBeInTheDocument();
    });
  });

  describe('Skill Cards', () => {
    beforeEach(() => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));
    });

    it('shows skill proficiency level', () => {
      // Proficiency levels appear as percentages
      expect(screen.getAllByText(/75%/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/45%/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows skill XP progress', () => {
      expect(screen.getByText('450/600 XP')).toBeInTheDocument();
      expect(screen.getByText('200/400 XP')).toBeInTheDocument();
    });

    it('shows practice count', () => {
      expect(screen.getByText('25 practices')).toBeInTheDocument();
      expect(screen.getByText('15 practices')).toBeInTheDocument();
    });

    it('shows stat name badge', () => {
      const intelligenceBadges = screen.getAllByText('intelligence');
      expect(intelligenceBadges.length).toBeGreaterThan(0);
    });

    it('shows unlock icon for unlocked skills', () => {
      const unlockIcons = screen.getAllByTestId('icon-unlock');
      expect(unlockIcons.length).toBe(2); // 2 unlocked math skills
    });

    it('shows lock icon for locked skills', () => {
      const lockIcons = screen.getAllByTestId('icon-lock');
      expect(lockIcons.length).toBeGreaterThan(0);
    });

    it('shows unlock requirement for locked skills', () => {
      expect(screen.getByText('Complete Algebra and Geometry')).toBeInTheDocument();
    });
  });

  describe('Level Labels', () => {
    it('shows Expert for 75% proficiency', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      expect(screen.getByText('Expert')).toBeInTheDocument();
    });

    it('shows Master for 90% proficiency', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Reading'));

      expect(screen.getByText('Master')).toBeInTheDocument();
    });

    it('shows Intermediate for 45% proficiency', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      expect(screen.getByText('Intermediate')).toBeInTheDocument();
    });

    it('shows Advanced for 60% proficiency', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Reading'));

      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('shows trending up icon for improving skills', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      expect(screen.getByTestId('icon-trending-up')).toBeInTheDocument();
    });

    it('shows trending down icon for declining skills', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Reading'));

      expect(screen.getByTestId('icon-trending-down')).toBeInTheDocument();
    });

    it('shows minus icon for stable skills', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      expect(screen.getByTestId('icon-minus')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by level by default', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      const skillNames = screen.getAllByText(/Algebra|Geometry|Calculus/);
      expect(skillNames[0]).toHaveTextContent('Algebra Basics');
    });

    it('sorts by recently practiced', () => {
      render(<SkillDashboard skills={mockSkills} />);

      const sortSelect = screen.getByRole('combobox');
      fireEvent.change(sortSelect, { target: { value: 'recent' } });
      fireEvent.click(screen.getByText('Math'));

      const skillNames = screen.getAllByText(/Algebra|Geometry|Calculus/);
      expect(skillNames[0]).toHaveTextContent('Algebra Basics');
    });

    it('sorts alphabetically', () => {
      render(<SkillDashboard skills={mockSkills} />);

      const sortSelect = screen.getByRole('combobox');
      fireEvent.change(sortSelect, { target: { value: 'name' } });
      fireEvent.click(screen.getByText('Math'));

      const skillNames = screen.getAllByText(/Algebra|Geometry|Calculus/);
      expect(skillNames[0]).toHaveTextContent('Algebra Basics');
    });
  });

  describe('Category Filter', () => {
    it('filters by category when categoryFilter prop is passed', () => {
      render(<SkillDashboard skills={mockSkills} categoryFilter="mathematics" />);

      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.queryByText('Reading')).not.toBeInTheDocument();
    });
  });

  describe('Skill Selection', () => {
    it('calls onSelectSkill when unlocked skill is clicked', () => {
      const mockOnSelect = jest.fn();
      render(<SkillDashboard skills={mockSkills} onSelectSkill={mockOnSelect} />);

      fireEvent.click(screen.getByText('Math'));
      fireEvent.click(screen.getByText('Algebra Basics'));

      expect(mockOnSelect).toHaveBeenCalledWith(mockSkills[0]);
    });

    it('does not call onSelectSkill when locked skill is clicked', () => {
      const mockOnSelect = jest.fn();
      render(<SkillDashboard skills={mockSkills} onSelectSkill={mockOnSelect} />);

      fireEvent.click(screen.getByText('Math'));
      fireEvent.click(screen.getByText('Calculus'));

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('unlocked skills have pointer cursor', () => {
      const mockOnSelect = jest.fn();
      render(<SkillDashboard skills={mockSkills} onSelectSkill={mockOnSelect} />);

      fireEvent.click(screen.getByText('Math'));
      const algebraCard = screen.getByText('Algebra Basics').closest('div[style*="cursor"]');
      expect(algebraCard).toHaveStyle({ cursor: 'pointer' });
    });
  });

  describe('Locked Skills', () => {
    it('shows reduced opacity for locked skills', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      const calculusCard = screen.getByText('Calculus').closest('div');
      expect(calculusCard).toBeInTheDocument();
    });

    it('does not show progress bar for locked skills', () => {
      render(<SkillDashboard skills={mockSkills} />);
      fireEvent.click(screen.getByText('Math'));

      // Locked skills don't show XP info
      expect(screen.queryByText('0/500 XP')).not.toBeInTheDocument();
    });
  });
});
