import { ScannerError } from "./errors.js";

export interface ScanCapacityLimiter {
  acquire(): () => void;
}

export function createScanCapacityLimiter(limit: number): ScanCapacityLimiter {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Scan capacity must be a positive integer.");
  }

  let activeScans = 0;

  return {
    acquire() {
      if (activeScans >= limit) {
        throw new ScannerError(
          "CAPACITY_EXCEEDED",
          "The in-process scan capacity has been reached.",
        );
      }

      activeScans += 1;
      let released = false;

      return () => {
        if (!released) {
          released = true;
          activeScans -= 1;
        }
      };
    },
  };
}
