import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../src/errors/conflict.error';
import AppError from '../../../src/errors/app-error';

describe('ConflictError', () => {
  it('should create an instance with status code 409 and correct message', () => {
    const error = new ConflictError('Custom alias is already in use');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Custom alias is already in use');
    expect(error.name).toBe('ConflictError');
  });

  it('should use default message when none is provided', () => {
    const error = new ConflictError();

    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Resource conflict');
  });
});
