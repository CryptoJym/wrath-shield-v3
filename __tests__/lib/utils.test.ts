// @ts-nocheck
/**
 * Wrath Shield v3 - Utils Tests
 *
 * Tests for utility functions including className helper (cn).
 */

import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn (className helper)', () => {
    it('should join multiple class names', () => {
      expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
    });

    it('should filter out falsy values', () => {
      expect(cn('foo', false, 'bar', null, 'baz', undefined)).toBe('foo bar baz');
    });

    it('should return empty string when no valid classes', () => {
      expect(cn(false, null, undefined)).toBe('');
    });

    it('should handle empty input', () => {
      expect(cn()).toBe('');
    });

    it('should handle single class name', () => {
      expect(cn('single')).toBe('single');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;

      expect(cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled'
      )).toBe('base-class active');
    });

    it('should handle mixed truthy and falsy values', () => {
      expect(cn(
        'always',
        true && 'conditional-true',
        false && 'conditional-false',
        null,
        undefined,
        'end'
      )).toBe('always conditional-true end');
    });

    it('should handle empty strings as falsy', () => {
      // Empty strings are filtered by Boolean
      expect(cn('foo', '', 'bar')).toBe('foo bar');
    });

    it('should work with template literals', () => {
      const size = 'lg';
      expect(cn(`text-${size}`, 'font-bold')).toBe('text-lg font-bold');
    });

    it('should handle typical Tailwind class patterns', () => {
      const variant = 'primary';
      const isLoading = true;
      const isDisabled = false;

      expect(cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-500 text-black',
        isLoading && 'opacity-50 cursor-wait',
        isDisabled && 'opacity-30 cursor-not-allowed'
      )).toBe('px-4 py-2 rounded bg-blue-500 text-white opacity-50 cursor-wait');
    });
  });
});
