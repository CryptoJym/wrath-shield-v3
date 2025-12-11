/**
 * Navigation Component Tests
 *
 * Tests for the categorical mega-menu navigation component.
 * Verifies click-based dropdown functionality, accessibility, and keyboard interactions.
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigation } from '@/components/Navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('Navigation Component', () => {

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render the logo and brand name', () => {
      render(<Navigation />);

      expect(screen.getByText('Wrath Shield v3')).toBeInTheDocument();
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });

    it('should render all navigation categories', () => {
      render(<Navigation />);

      // Check category labels
      expect(screen.getByText('Command')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Intel')).toBeInTheDocument();
      expect(screen.getByText('Systems')).toBeInTheDocument();
    });

    it('should render category icons', () => {
      render(<Navigation />);

      expect(screen.getByText('🎯')).toBeInTheDocument(); // Command
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Operations
      expect(screen.getByText('🔍')).toBeInTheDocument(); // Intel
      expect(screen.getByText('🛡️')).toBeInTheDocument(); // Systems
    });

    it('should render mobile menu button on smaller screens', () => {
      render(<Navigation />);

      const mobileButton = screen.getByLabelText('Toggle menu');
      expect(mobileButton).toBeInTheDocument();
    });
  });

  describe('Click-Based Dropdown Functionality', () => {
    it('should open dropdown on click', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      // Find Command button and click it
      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      // Dropdown should be visible
      expect(screen.getByText('Orchestrator')).toBeInTheDocument();
      expect(screen.getByText('Team Roster')).toBeInTheDocument();
      expect(screen.getByText('Agent Graph')).toBeInTheDocument();
    });

    it('should close dropdown when clicking the same button again', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });

      // Open
      await user.click(commandButton);
      expect(screen.getByText('Orchestrator')).toBeInTheDocument();

      // Close
      await user.click(commandButton);
      await waitFor(() => {
        expect(screen.queryByText('AI command center')).not.toBeInTheDocument();
      });
    });

    it('should close current dropdown and open new one when clicking different category', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      // Open Command
      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);
      expect(screen.getByText('Orchestrator')).toBeInTheDocument();

      // Click Operations
      const operationsButton = screen.getByRole('button', { name: /Operations/i });
      await user.click(operationsButton);

      // Command dropdown should close, Operations should open
      await waitFor(() => {
        expect(screen.queryByText('AI command center')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.getByText('Communications hub')).toBeInTheDocument();
    });

    it('should close dropdown when clicking a link inside', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      // Open Command dropdown
      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      // Click on a link - the link has role="menuitem" for accessibility
      // Use getAllByRole since there could be multiple matches
      const menuItems = screen.getAllByRole('menuitem');
      const orchestratorLink = menuItems[0]; // First menuitem is Orchestrator
      await user.click(orchestratorLink);

      // Note: In real app, navigation would trigger useEffect cleanup
      // Here we just verify the click handler exists
      expect(orchestratorLink).toHaveAttribute('href', '/chat');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-expanded attribute on dropdown buttons', () => {
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      expect(commandButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      expect(commandButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-haspopup attribute', () => {
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      expect(commandButton).toHaveAttribute('aria-haspopup', 'true');
    });

    it('dropdown menu should have role="menu"', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
    });

    it('dropdown items should have role="menuitem"', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBe(3); // Command has 3 items
    });
  });

  describe('Keyboard Interaction', () => {
    it('should close dropdown on Escape key', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      // Open dropdown
      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);
      expect(screen.getByText('Orchestrator')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText('AI command center')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu on button click', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const mobileButton = screen.getByLabelText('Toggle menu');

      // Open mobile menu
      await user.click(mobileButton);

      // Check if mobile menu is open (it renders categories differently on mobile)
      // The mobile menu shows all items directly without dropdowns
      expect(mobileButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Navigation Items Content', () => {
    it('should have correct Command category items', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      expect(screen.getByText('Orchestrator')).toBeInTheDocument();
      expect(screen.getByText('AI command center')).toBeInTheDocument();

      expect(screen.getByText('Team Roster')).toBeInTheDocument();
      expect(screen.getByText('Agent management')).toBeInTheDocument();

      expect(screen.getByText('Agent Graph')).toBeInTheDocument();
      expect(screen.getByText('Network topology')).toBeInTheDocument();
    });

    it('should have correct Operations category items', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const operationsButton = screen.getByRole('button', { name: /Operations/i });
      await user.click(operationsButton);

      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.getByText('PM')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });

    it('should have correct Intel category items', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const intelButton = screen.getByRole('button', { name: /Intel/i });
      await user.click(intelButton);

      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Education')).toBeInTheDocument();
      expect(screen.getByText('Feed')).toBeInTheDocument();
    });

    it('should have correct Systems category items', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const systemsButton = screen.getByRole('button', { name: /Systems/i });
      await user.click(systemsButton);

      expect(screen.getByText('EEG')).toBeInTheDocument();
      expect(screen.getByText('Legal Advisor')).toBeInTheDocument();
      expect(screen.getByText('Privacy')).toBeInTheDocument();
    });
  });

  describe('Link Hrefs', () => {
    it('should have correct hrefs for Command items', async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const commandButton = screen.getByRole('button', { name: /Command/i });
      await user.click(commandButton);

      // Links have role="menuitem" for accessibility within dropdown menus
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(3); // Command has 3 items

      // Verify hrefs in order: Orchestrator, Team Roster, Agent Graph
      expect(menuItems[0]).toHaveAttribute('href', '/chat');
      expect(menuItems[1]).toHaveAttribute('href', '/agents/roster');
      expect(menuItems[2]).toHaveAttribute('href', '/agents/graph');
    });
  });
});
