import { describe, expect, it } from 'vitest';
import { generateShortCode } from '../../../src/utils/short-code.js';

describe('short-code utility', () => {
  it('should generate a short code of default length (8)', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(8);
  });

  it('should generate a short code of custom length', () => {
    const code = generateShortCode(12);
    expect(code).toHaveLength(12);
  });

  it('should generate short codes containing only Base62 characters', () => {
    const base62Regex = /^[A-Za-z0-9]+$/;
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode();
      expect(code).toMatch(base62Regex);
    }
  });

  it('should generate distinct codes across 1000 generations without accidental duplication', () => {
    const generated = new Set<string>();
    const total = 1000;

    for (let i = 0; i < total; i++) {
      generated.add(generateShortCode());
    }

    expect(generated.size).toBe(total);
  });
});
