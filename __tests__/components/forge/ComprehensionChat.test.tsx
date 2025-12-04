/**
 * ComprehensionChat Component Tests
 * Tests for the AI-powered reading comprehension chat component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// lucide-react is mocked globally in jest.setup.react.ts
import { ComprehensionChat, Message } from '@/components/forge/comprehension/ComprehensionChat';

// Test data
const mockMessages: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'What is the main theme of this chapter?',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'The main theme of this chapter is the journey of self-discovery.',
    timestamp: Date.now() - 30000,
    insight_type: 'theme',
    xp_earned: 15,
  },
];

const mockSuggestedTopics = [
  'What motivates the protagonist?',
  'Explain the symbolism of the river',
  'Compare the two main characters',
];

describe('ComprehensionChat', () => {
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSendMessage.mockResolvedValue({
      response: 'Great question! Let me explain...',
      insight_type: 'analysis',
      xp_earned: 10,
      follow_up_questions: ['What else would you like to explore?'],
    });
  });

  describe('Rendering', () => {
    it('renders book title in header', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="To Kill a Mockingbird"
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('To Kill a Mockingbird')).toBeInTheDocument();
    });

    it('renders chapter title when provided', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="To Kill a Mockingbird"
          chapterTitle="Chapter 5: The Trial"
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Chapter 5: The Trial')).toBeInTheDocument();
    });

    it('shows Discussion badge', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Discussion')).toBeInTheDocument();
    });

    it('renders input area', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByPlaceholderText('Ask a question or share your thoughts...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state with instructions', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Start a Discussion')).toBeInTheDocument();
      expect(screen.getByText(/Ask questions about the book/)).toBeInTheDocument();
    });

    it('shows suggested topics when provided', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          suggestedTopics={mockSuggestedTopics}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Try asking about:')).toBeInTheDocument();
      expect(screen.getByText('What motivates the protagonist?')).toBeInTheDocument();
      expect(screen.getByText('Explain the symbolism of the river')).toBeInTheDocument();
    });

    it('clicking suggested topic sends message', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          suggestedTopics={mockSuggestedTopics}
          onSendMessage={mockOnSendMessage}
        />
      );

      fireEvent.click(screen.getByText('What motivates the protagonist?'));

      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith(
          'What motivates the protagonist?',
          expect.any(Object)
        );
      });
    });
  });

  describe('Messages', () => {
    it('renders initial messages', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          initialMessages={mockMessages}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('What is the main theme of this chapter?')).toBeInTheDocument();
      expect(screen.getByText('The main theme of this chapter is the journey of self-discovery.')).toBeInTheDocument();
    });

    it('shows user avatar for user messages', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          initialMessages={mockMessages}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getAllByTestId('icon-user').length).toBeGreaterThan(0);
    });

    it('shows bot avatar for assistant messages', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          initialMessages={mockMessages}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getAllByTestId('icon-bot').length).toBeGreaterThan(0);
    });

    it('shows insight badge for messages with insight_type', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          initialMessages={mockMessages}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('shows XP earned badge', () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          initialMessages={mockMessages}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('+15 XP')).toBeInTheDocument();
    });
  });

  describe('Sending Messages', () => {
    it('sends message when clicking send button', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });

      const sendButton = screen.getByTestId('icon-send').closest('button');
      if (sendButton) {
        fireEvent.click(sendButton);
      }

      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith('My question', expect.any(Object));
      });
    });

    it('sends message when pressing Enter', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith('My question', expect.any(Object));
      });
    });

    it('does not send empty messages', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('clears input after sending', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('adds user message to conversation immediately', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('My question')).toBeInTheDocument();
      });
    });

    it('adds assistant response to conversation', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Great question! Let me explain...')).toBeInTheDocument();
      });
    });
  });

  describe('Follow-up Questions', () => {
    it('shows follow-up questions after response', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Continue exploring:')).toBeInTheDocument();
        expect(screen.getByText('What else would you like to explore?')).toBeInTheDocument();
      });
    });

    it('clicking follow-up sends that message', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('What else would you like to explore?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('What else would you like to explore?'));

      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledTimes(2);
        expect(mockOnSendMessage).toHaveBeenLastCalledWith(
          'What else would you like to explore?',
          expect.any(Object)
        );
      });
    });
  });

  describe('Loading State', () => {
    it('shows typing indicator while loading', async () => {
      mockOnSendMessage.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          response: 'Response',
          insight_type: 'analysis',
          xp_earned: 5,
        }), 100))
      );

      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should show typing indicator
      await waitFor(() => {
        expect(screen.getAllByTestId('icon-bot').length).toBeGreaterThan(0);
      });
    });

    it('disables input while loading', async () => {
      mockOnSendMessage.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          response: 'Response',
          insight_type: 'analysis',
          xp_earned: 5,
        }), 100))
      );

      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error message on API failure', async () => {
      mockOnSendMessage.mockRejectedValueOnce(new Error('API Error'));

      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Sorry, I had trouble processing that. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Chapter Context', () => {
    it('passes chapter context in onSendMessage', async () => {
      render(
        <ComprehensionChat
          bookId="book-1"
          bookTitle="Test Book"
          chapterId="chapter-5"
          onSendMessage={mockOnSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Ask a question or share your thoughts...');
      fireEvent.change(input, { target: { value: 'My question' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith(
          'My question',
          { chapterId: 'chapter-5' }
        );
      });
    });
  });
});
