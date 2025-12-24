export class AppError extends Error {
  code: string;
  httpStatus: number;
  hint?: string;

  constructor(code: string, message: string, httpStatus = 400, hint?: string) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.hint = hint;
  }
}
