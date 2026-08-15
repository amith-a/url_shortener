import AppError from './app-error';

export class GoneError extends AppError {
  constructor(message = 'URL has expired') {
    super(410, message);
    Object.setPrototypeOf(this, GoneError.prototype);
  }
}
