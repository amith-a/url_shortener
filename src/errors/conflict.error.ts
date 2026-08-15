import AppError from './app-error';

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(409, message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
