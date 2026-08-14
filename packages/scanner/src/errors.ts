export type ScannerErrorCode =
  | "INVALID_INPUT"
  | "NAVIGATION_TIMEOUT"
  | "NAVIGATION_FAILED"
  | "AXE_EXECUTION_FAILED"
  | "SCAN_FAILED";

export class ScannerError extends Error {
  readonly code: ScannerErrorCode;

  constructor(code: ScannerErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ScannerError";
    this.code = code;
  }
}
