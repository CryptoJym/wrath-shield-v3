/**
 * Tests for PII Redaction Module
 */

import {
  redactPII,
  revealSegment,
  revealAll,
  countPII,
  hasPII,
  redactAndTruncate,
  PIIType,
  RedactionResult,
} from '@/lib/redact';

describe('PII Redaction Module', () => {
  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const text = 'Contact me at john.doe@example.com for more info';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.redactedText).toContain('[EMAIL]');
      expect(result.redactedText).not.toContain('john.doe@example.com');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('email');
      expect(result.segments[0].original).toBe('john.doe@example.com');
    });

    it('should redact phone numbers in multiple formats', () => {
      const text = 'Call me at (555) 123-4567 or 555-987-6543 or +1 555 111 2222';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments.filter(s => s.type === 'phone')).toHaveLength(3);
      expect(result.redactedText).toContain('[PHONE]');
      expect(result.redactedText).not.toContain('555');
    });

    it('should redact Social Security Numbers', () => {
      const text = 'My SSN is 123-45-6789';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('ssn');
      expect(result.segments[0].original).toBe('123-45-6789');
      expect(result.redactedText).not.toContain('123-45-6789');
    });

    it('should redact credit card numbers', () => {
      const text = 'Card number: 4532-1234-5678-9010';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('credit_card');
      expect(result.redactedText).toContain('[CREDIT_CARD]');
    });

    it('should redact dates of birth', () => {
      const text = 'Born on 01/15/1990';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('date_of_birth');
      expect(result.redactedText).toContain('[DATE_OF_BIRTH]');
    });

    it('should redact IP addresses', () => {
      const text = 'Server IP: 192.168.1.100';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('ip_address');
      expect(result.redactedText).toContain('[IP_ADDRESS]');
    });

    it('should redact URLs', () => {
      const text = 'Visit https://www.example.com/page for details';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('url');
      expect(result.redactedText).toContain('[URL]');
    });

    it('should redact street addresses', () => {
      const text = 'I live at 123 Main Street';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('address');
      expect(result.redactedText).toContain('[ADDRESS]');
    });

    it('should redact names (common names not at start of sentence)', () => {
      const text = 'I spoke with John Smith yesterday. He said hi.';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      const nameSegments = result.segments.filter(s => s.type === 'name');
      expect(nameSegments.length).toBeGreaterThan(0);
      expect(result.redactedText).toContain('[NAME]');
    });

    it('should handle text with multiple PII types', () => {
      const text = 'Contact John at john@example.com or call (555) 123-4567';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments.length).toBeGreaterThan(2); // name, email, phone
      expect(result.redactedText).toContain('[EMAIL]');
      expect(result.redactedText).toContain('[PHONE]');
    });

    it('should not redact text without PII', () => {
      const text = 'This is a normal sentence without any sensitive information.';
      const result = redactPII(text);

      expect(result.hasPII).toBe(false);
      expect(result.segments).toHaveLength(0);
      expect(result.redactedText).toBe(text);
    });

    it('should support selective redaction by type', () => {
      const text = 'Email: test@example.com Phone: 555-1234';
      const result = redactPII(text, { types: ['email'] });

      expect(result.hasPII).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('email');
      expect(result.redactedText).toContain('[EMAIL]');
      expect(result.redactedText).toContain('555-1234'); // phone not redacted
    });

    it('should support preserveFormat option with block characters', () => {
      const text = 'Email: test@example.com';
      const result = redactPII(text, { preserveFormat: true });

      expect(result.hasPII).toBe(true);
      expect(result.redactedText).toContain('█');
      expect(result.redactedText).not.toContain('[EMAIL]');
      // Should have same length as original email
      const originalEmail = 'test@example.com';
      const blocks = '█'.repeat(originalEmail.length);
      expect(result.redactedText).toContain(blocks);
    });

    it('should handle empty string', () => {
      const result = redactPII('');

      expect(result.hasPII).toBe(false);
      expect(result.segments).toHaveLength(0);
      expect(result.redactedText).toBe('');
    });

    it('should handle text with only whitespace', () => {
      const result = redactPII('   \n\t  ');

      expect(result.hasPII).toBe(false);
      expect(result.segments).toHaveLength(0);
    });
  });

  describe('revealSegment', () => {
    it('should reveal a specific segment', () => {
      const text = 'Contact me at john@example.com';
      const redacted = redactPII(text);

      const revealed = revealSegment(redacted, 0);

      expect(revealed).toContain('john@example.com');
      expect(revealed).not.toContain('[EMAIL]');
    });

    it('should handle invalid segment index', () => {
      const text = 'Email: test@example.com';
      const redacted = redactPII(text);

      const revealedNegative = revealSegment(redacted, -1);
      const revealedTooLarge = revealSegment(redacted, 999);

      expect(revealedNegative).toBe(redacted.redactedText);
      expect(revealedTooLarge).toBe(redacted.redactedText);
    });

    it('should only reveal the specified segment', () => {
      const text = 'Email: test@example.com Phone: 555-123-4567';
      const redacted = redactPII(text);

      const revealed = revealSegment(redacted, 0);

      // Email revealed but phone still redacted
      expect(revealed).toContain('test@example.com');
      expect(revealed).toContain('[PHONE]');
    });
  });

  describe('revealAll', () => {
    it('should reveal all PII in text', () => {
      const original = 'Contact John at john@example.com or call (555) 123-4567';
      const redacted = redactPII(original);

      const revealed = revealAll(redacted);

      // Should contain all original PII
      expect(revealed).toContain('john@example.com');
      expect(revealed).toContain('(555) 123-4567');
      expect(revealed).not.toContain('[EMAIL]');
      expect(revealed).not.toContain('[PHONE]');
    });

    it('should handle text with no PII', () => {
      const text = 'No sensitive information here';
      const redacted = redactPII(text);

      const revealed = revealAll(redacted);

      expect(revealed).toBe(text);
    });

    it('should correctly restore text with multiple segments', () => {
      const text = 'SSN: 123-45-6789 Card: 4532-1234-5678-9010 DOB: 01/15/1990';
      const redacted = redactPII(text);

      const revealed = revealAll(redacted);

      expect(revealed).toContain('123-45-6789');
      expect(revealed).toContain('4532-1234-5678-9010');
      expect(revealed).toContain('01/15/1990');
    });
  });

  describe('countPII', () => {
    it('should count PII by type', () => {
      const text = 'Emails: test@example.com, another@test.com Phone: 555-123-4567';
      const redacted = redactPII(text);

      const counts = countPII(redacted);

      expect(counts.email).toBe(2);
      expect(counts.phone).toBe(1);
    });

    it('should return empty counts for text without PII', () => {
      const text = 'No sensitive information';
      const redacted = redactPII(text);

      const counts = countPII(redacted);

      expect(Object.keys(counts)).toHaveLength(0);
    });

    it('should count all PII types correctly', () => {
      const text = `
        Email: test@example.com
        Phone: 555-123-4567
        SSN: 123-45-6789
        URL: https://example.com
      `;
      const redacted = redactPII(text);

      const counts = countPII(redacted);

      expect(counts.email).toBe(1);
      expect(counts.phone).toBe(1);
      expect(counts.ssn).toBe(1);
      expect(counts.url).toBe(1);
    });
  });

  describe('hasPII', () => {
    it('should return true if text has PII', () => {
      expect(hasPII('Email: test@example.com')).toBe(true);
      expect(hasPII('Phone: 555-123-4567')).toBe(true);
      expect(hasPII('SSN: 123-45-6789')).toBe(true);
    });

    it('should return false if text has no PII', () => {
      expect(hasPII('This is normal text')).toBe(false);
      expect(hasPII('')).toBe(false);
      expect(hasPII('Just some words here')).toBe(false);
    });

    it('should respect type filter', () => {
      const text = 'Email: test@example.com Phone: 555-1234';

      expect(hasPII(text, ['email'])).toBe(true);
      expect(hasPII(text, ['ssn'])).toBe(false); // no SSN in text
    });
  });

  describe('redactAndTruncate', () => {
    it('should redact and truncate long text', () => {
      const longText = 'Email: test@example.com. ' + 'X'.repeat(300);
      const result = redactAndTruncate(longText, 50);

      expect(result.redactedText.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result.redactedText).toContain('[EMAIL]');
      expect(result.redactedText).toContain('...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Email: test@example.com';
      const result = redactAndTruncate(shortText, 100);

      expect(result.redactedText).not.toContain('...');
      expect(result.redactedText.length).toBeLessThan(100);
    });

    it('should only include segments within truncated length', () => {
      // Email at position 200+
      const text = 'X'.repeat(200) + ' email: test@example.com ' + 'Y'.repeat(100);
      const result = redactAndTruncate(text, 50);

      // Email is beyond truncation point, so no email segment
      const emailSegments = result.segments.filter(s => s.type === 'email');
      expect(emailSegments).toHaveLength(0);
    });

    it('should use default maxLength of 200', () => {
      const text = 'A'.repeat(250) + ' email: test@example.com';
      const result = redactAndTruncate(text);

      expect(result.redactedText.length).toBeLessThanOrEqual(203); // 200 + '...'
    });

    it('should support preserveFormat option', () => {
      const text = 'Email: test@example.com ' + 'X'.repeat(300);
      const result = redactAndTruncate(text, 50, { preserveFormat: true });

      expect(result.redactedText).toContain('█');
      expect(result.redactedText).not.toContain('[EMAIL]');
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle special characters in PII', () => {
      const text = 'Email: test+tag@example.com';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.segments[0].original).toBe('test+tag@example.com');
    });

    it('should handle multiple emails close together', () => {
      const text = 'test1@example.com test2@example.com test3@example.com';
      const result = redactPII(text);

      expect(result.segments.filter(s => s.type === 'email')).toHaveLength(3);
    });

    it('should handle overlapping PII patterns gracefully', () => {
      // Some credit cards might also match phone patterns
      const text = 'Card: 4532123456789010';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      // Should handle as credit card primarily
      expect(result.segments.some(s => s.type === 'credit_card')).toBe(true);
    });

    it('should handle very long text efficiently', () => {
      const longText = 'Normal text. '.repeat(1000) + ' Email: test@example.com';
      const start = Date.now();
      const result = redactPII(longText);
      const elapsed = Date.now() - start;

      expect(result.hasPII).toBe(true);
      expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should not leak original PII in redacted text', () => {
      const sensitive = {
        email: 'sensitive@example.com',
        phone: '555-123-4567',
        ssn: '123-45-6789',
      };

      const text = `Email: ${sensitive.email} Phone: ${sensitive.phone} SSN: ${sensitive.ssn}`;
      const result = redactPII(text);

      // Redacted text should not contain any original PII
      expect(result.redactedText).not.toContain(sensitive.email);
      expect(result.redactedText).not.toContain(sensitive.phone);
      expect(result.redactedText).not.toContain(sensitive.ssn);

      // But segments should preserve originals for reveal
      expect(result.segments[0].original).toBeDefined();
    });

    it('should handle consecutive PII without spaces', () => {
      const text = 'test@example.com(555)123-4567';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      // At least email should be detected
      expect(result.segments.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle Unicode and emoji', () => {
      const text = 'Email: test@example.com 📧 Phone: 555-123-4567 📞';
      const result = redactPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.redactedText).toContain('📧');
      expect(result.redactedText).toContain('📞');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should redact PII from a lifelog transcript', () => {
      const transcript = `
        User: Hey, can you send that to john.doe@example.com?
        Other: Sure, I'll send it to that email. What's your phone?
        User: It's (555) 123-4567. Call me anytime.
        Other: Got it. I live at 123 Main Street if you want to visit.
      `;

      const result = redactPII(transcript);

      expect(result.hasPII).toBe(true);
      expect(result.redactedText).toContain('[EMAIL]');
      expect(result.redactedText).toContain('[PHONE]');
      expect(result.redactedText).toContain('[ADDRESS]');

      // Original sensitive data should not appear
      expect(result.redactedText).not.toContain('john.doe@example.com');
      expect(result.redactedText).not.toContain('(555) 123-4567');
      expect(result.redactedText).not.toContain('123 Main Street');
    });

    it('should handle daily summary with partial PII', () => {
      const summary = `
        2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%.
        Had a conversation with Sarah at sarah@company.com.
        3 manipulative phrases detected. Deployed assertive boundaries in response.
      `;

      const result = redactAndTruncate(summary, 200);

      expect(result.hasPII).toBe(true);
      expect(result.redactedText).toContain('[EMAIL]');
      expect(result.redactedText).not.toContain('sarah@company.com');

      // Non-PII metrics should remain
      expect(result.redactedText).toContain('Recovery 78%');
      expect(result.redactedText).toContain('Strain 12.4');
    });
  });
});
