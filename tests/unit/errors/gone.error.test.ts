import { describe, expect, it } from 'vitest';
import { GoneError } from '../../../src/errors/gone.error.js';
import AppError from '../../../src/errors/app-error.js';

describe('GoneError', () => {
  it('should create an instance with status code 410 and correct message', () => {
    const error = new GoneError('URL has expired');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(GoneError);
    expect(error.statusCode).toBe(410);
    expect(error.message).toBe('URL has expired');
    expect(error.name).toBe('GoneError');
  });

  it('should use default message when none is provided', () => {
    const error = new GoneError();

    expect(error.statusCode).toBe(410);
    expect(error.message).toBe('URL has expired');
  });
});
