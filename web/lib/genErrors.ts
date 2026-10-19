export type GenErrorCode = "bad_image" | "bad_token" | "quota" | "space_down" | "timeout" | "cancelled" | "unknown";

export class GenError extends Error {
  code: GenErrorCode;
  retryIn?: string;
  constructor(code: GenErrorCode, message: string, retryIn?: string) {
    super(message);
    this.name = "GenError";
    this.code = code;
    this.retryIn = retryIn;
  }
}
