import { render, screen, fireEvent } from '@testing-library/react';
import ChatSlashInput from '../../components/ChatSlashInput';

describe('ChatSlashInput (slash commands, feature-flagged at integration site)', () => {
  test('runs /help and emits output', async () => {
    const outputs: string[] = [];
    render(<ChatSlashInput onCommandOutput={(t) => outputs.push(t)} />);

    const ta = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '/help' } });
    fireEvent.keyDown(ta, { key: 'Enter' });

    // Help should contain at least '/help' itself
    // Allow microtask flush
    await new Promise((r) => setTimeout(r, 0));
    expect(outputs.length).toBe(1);
    expect(outputs[0]).toContain('/help');
  });
});
