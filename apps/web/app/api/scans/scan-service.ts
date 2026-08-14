import { ScannerError, scanPage } from "@vieta11y/scanner";
import type { ScanReport, ScannerErrorCode } from "@vieta11y/scanner";

export interface ScanSuccessBody {
  report: ScanReport;
}

export type ScanApiErrorCode = "INVALID_REQUEST" | ScannerErrorCode;

export interface ScanErrorBody {
  error: {
    code: ScanApiErrorCode;
    message: string;
  };
}

export type ScanApiResult =
  | { status: 200; body: ScanSuccessBody }
  | { status: 400 | 500 | 502 | 504; body: ScanErrorBody };

type ScanFunction = (url: string) => Promise<ScanReport>;

const invalidRequestResult: ScanApiResult = {
  status: 400,
  body: {
    error: {
      code: "INVALID_REQUEST",
      message: "Yêu cầu phải chỉ chứa một địa chỉ URL không để trống.",
    },
  },
};

export async function createScanApiResult(
  input: unknown,
  scan: ScanFunction = scanPage,
): Promise<ScanApiResult> {
  const url = readUrl(input);

  if (url === undefined) {
    return invalidRequestResult;
  }

  try {
    return {
      status: 200,
      body: { report: await scan(url) },
    };
  } catch (error) {
    return mapScanError(error);
  }
}

export function createInvalidJsonResult(): ScanApiResult {
  return invalidRequestResult;
}

function readUrl(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }

  const entries = Object.entries(input);

  if (entries.length !== 1 || entries[0]?.[0] !== "url") {
    return undefined;
  }

  const url = entries[0][1];

  return typeof url === "string" && url.trim().length > 0 ? url : undefined;
}

function mapScanError(error: unknown): ScanApiResult {
  if (!(error instanceof ScannerError)) {
    return safeError(
      500,
      "SCAN_FAILED",
      "Không thể hoàn tất lần quét do lỗi máy chủ.",
    );
  }

  switch (error.code) {
    case "INVALID_INPUT":
      return safeError(
        400,
        error.code,
        "URL phải là địa chỉ HTTP hoặc HTTPS tuyệt đối và hợp lệ.",
      );
    case "NAVIGATION_TIMEOUT":
      return safeError(
        504,
        error.code,
        "Trang mất quá nhiều thời gian để tải. Vui lòng thử lại.",
      );
    case "NAVIGATION_FAILED":
      return safeError(
        502,
        error.code,
        "Không thể truy cập hoặc tải trang cần quét.",
      );
    case "AXE_EXECUTION_FAILED":
      return safeError(
        500,
        error.code,
        "Không thể phân tích trạng thái trang đã tải.",
      );
    case "SCAN_FAILED":
      return safeError(
        500,
        error.code,
        "Không thể hoàn tất lần quét do lỗi máy chủ.",
      );
  }
}

function safeError(
  status: 400 | 500 | 502 | 504,
  code: ScanApiErrorCode,
  message: string,
): ScanApiResult {
  return {
    status,
    body: { error: { code, message } },
  };
}
