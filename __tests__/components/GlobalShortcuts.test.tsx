import { render } from '@testing-library/react';
import GlobalShortcuts from '../../components/GlobalShortcuts';

describe('GlobalShortcuts', () => {
  test('fires callbacks on Alt+R and Alt+F', () => {
    const rep = jest.fn();
    const forge = jest.fn();
    render(<GlobalShortcuts onReplace={rep} onForge={forge} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'F' }));
    expect(rep).toHaveBeenCalled();
    expect(forge).toHaveBeenCalled();
  });
});
