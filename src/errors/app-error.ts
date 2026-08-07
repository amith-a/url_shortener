export default class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);

    this.name = this.constructor.name;

    Object.setPrototypeOf(this, AppError.prototype);

    Error.captureStackTrace?.(this, this.constructor);
  }
}
