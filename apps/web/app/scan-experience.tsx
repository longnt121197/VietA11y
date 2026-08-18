"use client";

import type {
  AccessibilityViolation,
  AffectedNode,
  NormalizedImpact,
  ScanReport,
  SelectorTarget,
  VietnameseGuidance,
} from "@vieta11y/scanner";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";

import type {
  ScanErrorBody,
  ScanSuccessBody,
} from "./api/scans/scan-service";

const unavailableGuidanceMessage =
  "VietA11y chưa có hướng dẫn tiếng Việt được biên soạn cho quy tắc này.";

const impactLabels: Record<NormalizedImpact, string> = {
  critical: "Nghiêm trọng nhất (critical)",
  serious: "Nghiêm trọng (serious)",
  moderate: "Trung bình (moderate)",
  minor: "Nhẹ (minor)",
  unknown: "Chưa xác định (unknown)",
};

export function ScanExperience() {
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<{
    kind: "validation" | "request";
    message: string;
  }>();
  const [report, setReport] = useState<ScanReport>();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (error?.kind === "validation") {
      urlInputRef.current?.focus();
    } else if (error !== undefined) {
      errorRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    if (report !== undefined) {
      reportHeadingRef.current?.focus();
    }
  }, [report]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateUrlInput(url);

    if (validationMessage !== undefined) {
      setError({ kind: "validation", message: validationMessage });
      setReport(undefined);
      return;
    }

    setIsScanning(true);
    setError(undefined);
    setReport(undefined);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const responseError = readErrorResponse(body);
        setError({
          kind: responseError.isValidation ? "validation" : "request",
          message: responseError.message,
        });
        return;
      }

      if (!isScanSuccessBody(body)) {
        setError({
          kind: "request",
          message: "Máy chủ trả về kết quả không hợp lệ. Vui lòng thử lại.",
        });
        return;
      }

      setReport(body.report);
    } catch {
      setError({
        kind: "request",
        message: "Không thể kết nối với máy chủ quét. Vui lòng thử lại.",
      });
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <>
      <section aria-labelledby="scan-form-title" className="mt-10 max-w-3xl">
        <h2 id="scan-form-title" className="text-2xl font-bold text-slate-950">
          Quét một trang
        </h2>
        <form
          className="mt-5 rounded-xl border border-slate-300 bg-white p-5 shadow-sm sm:p-6"
          aria-busy={isScanning}
          noValidate
          onSubmit={handleSubmit}
        >
          <label htmlFor="scan-url" className="block font-semibold text-slate-950">
            URL trang cần quét
          </label>
          <p id="scan-url-help" className="mt-1 text-sm leading-6 text-slate-600">
            Nhập địa chỉ đầy đủ bắt đầu bằng http:// hoặc https://.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              ref={urlInputRef}
              id="scan-url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              required
              value={url}
              disabled={isScanning}
              aria-invalid={error?.kind === "validation"}
              aria-describedby={
                error === undefined ? "scan-url-help" : "scan-url-help scan-error"
              }
              onChange={(event) => setUrl(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-400 bg-white px-3 py-2.5 text-slate-950 outline-none placeholder:text-slate-500 focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-700 disabled:cursor-wait disabled:bg-slate-100"
              placeholder="https://example.com"
            />
            <button
              type="submit"
              disabled={isScanning}
              className="rounded-md bg-sky-800 px-5 py-2.5 font-semibold text-white outline-none hover:bg-sky-900 focus-visible:ring-2 focus-visible:ring-sky-800 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-slate-500"
            >
              {isScanning ? "Đang quét…" : "Quét trang"}
            </button>
          </div>

          {isScanning ? (
            <p role="status" className="mt-4 text-sm font-medium text-sky-900">
              VietA11y đang tải trang và chạy kiểm tra tự động. Quá trình này có
              thể mất một lúc.
            </p>
          ) : null}

          {error !== undefined ? (
            <div
              id="scan-error"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-950 outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              {error.message}
            </div>
          ) : null}
        </form>
      </section>

      {report !== undefined ? (
        <ScanResults report={report} headingRef={reportHeadingRef} />
      ) : null}
    </>
  );
}

function ScanResults({
  report,
  headingRef,
}: {
  report: ScanReport;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const distribution = report.summary.impactDistribution;

  return (
    <section aria-labelledby="report-title" className="mt-14">
      <h2
        id="report-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
      >
        Kết quả quét
      </h2>
      <dl className="mt-5 grid gap-3 rounded-xl border border-slate-300 bg-white p-5 sm:grid-cols-2 sm:p-6">
        <Metadata label="Trang" value={report.metadata.documentTitle || "Không có tiêu đề"} />
        <Metadata label="URL sau điều hướng" value={report.metadata.finalUrl} code />
        <Metadata label="Thời điểm quét" value={formatScannedAt(report.metadata.scannedAt)} />
        <Metadata label="Thời gian quét" value={`${report.metadata.durationMs} ms`} />
      </dl>

      <section aria-labelledby="summary-title" className="mt-10">
        <h3 id="summary-title" className="text-2xl font-bold text-slate-950">
          Tóm tắt
        </h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <SummaryValue
            label="Quy tắc phát hiện vi phạm"
            value={report.summary.violatedRuleCount}
          />
          <SummaryValue
            label="Lượt phần tử bị ảnh hưởng"
            value={report.summary.affectedElementCount}
          />
        </dl>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Một phần tử có thể được tính lại khi cùng vi phạm nhiều quy tắc; đây
          không phải số phần tử duy nhất trên trang.
        </p>

        <h4 className="mt-7 text-lg font-semibold text-slate-950">
          Phân bố quy tắc theo mức tác động
        </h4>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(impactLabels) as NormalizedImpact[]).map((impact) => (
            <div key={impact} className="rounded-lg border border-slate-300 bg-white p-3">
              <dt className="text-sm font-medium text-slate-700">
                {impactLabels[impact]}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-slate-950">
                {distribution[impact]}
              </dd>
            </div>
          ))}
        </dl>

        <aside className="mt-6 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sky-950">
          <strong>Giới hạn của kiểm tra tự động:</strong> Kết quả này không chứng
          minh trang tuân thủ đầy đủ WCAG và không phải chứng nhận khả năng tiếp
          cận. Vẫn cần kiểm tra thủ công, bao gồm kiểm tra bằng bàn phím và công
          nghệ hỗ trợ.
        </aside>
      </section>

      {report.warnings.length > 0 ? (
        <section aria-labelledby="warnings-title" className="mt-8">
          <h3 id="warnings-title" className="text-xl font-bold text-slate-950">
            Cảnh báo xử lý dữ liệu
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            {report.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="violations-title" className="mt-12">
        <h3 id="violations-title" className="text-2xl font-bold text-slate-950">
          Vi phạm
        </h3>
        {report.violations.length === 0 ? (
          <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            Không phát hiện vi phạm tự động trong trạng thái trang đã quét. Điều
            này không có nghĩa là trang đã tuân thủ đầy đủ WCAG.
          </p>
        ) : (
          <ol className="mt-5 space-y-6">
            {report.violations.map((violation, index) => (
              <li key={`${violation.ruleId}-${index}`}>
                <ViolationCard violation={violation} index={index} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function Metadata({
  label,
  value,
  code = false,
}: {
  label: string;
  value: string;
  code?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 break-words text-slate-950">
        {code ? <code className="break-all text-sm">{value}</code> : value}
      </dd>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-5">
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd className="mt-2 text-4xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}

function ViolationCard({
  violation,
  index,
}: {
  violation: AccessibilityViolation;
  index: number;
}) {
  const helpUrl = readSafeHttpUrl(violation.helpUrl);

  return (
    <article
      aria-labelledby={`violation-${index}-title`}
      className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <p className="text-sm font-semibold text-slate-700">
          Mức tác động: {impactLabels[violation.impact]}
        </p>
        <h4 id={`violation-${index}-title`} className="mt-2 text-xl font-bold text-slate-950">
          {violation.help ?? violation.ruleId}
        </h4>
        <p className="mt-2 text-sm text-slate-600">
          Mã quy tắc: <code className="font-semibold">{violation.ruleId}</code>
        </p>
        {violation.description !== undefined ? (
          <p className="mt-3 leading-7 text-slate-700">{violation.description}</p>
        ) : null}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metadata label="Số phần tử bị ảnh hưởng" value={String(violation.totalNodeCount)} />
          <div>
            <dt className="text-sm font-semibold text-slate-600">Tham chiếu WCAG</dt>
            <dd className="mt-1 text-slate-950">
              {violation.wcagReferences.length === 0
                ? "Không có trong dữ liệu quy tắc"
                : violation.wcagReferences
                    .map((reference) => `${reference.standard} ${reference.successCriterion}`)
                    .join(", ")}
            </dd>
          </div>
        </dl>

        {helpUrl !== undefined ? (
          <p className="mt-4">
            <a
              href={helpUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-sky-800 underline decoration-2 underline-offset-2 hover:text-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              Đọc tài liệu chính thức của axe cho quy tắc {violation.ruleId}
              <span className="sr-only"> (mở trong thẻ mới)</span>
            </a>
          </p>
        ) : violation.helpUrl !== undefined ? (
          <p className="mt-4 break-all text-sm text-slate-600">
            Tham chiếu axe không có URL HTTP/HTTPS hợp lệ: {violation.helpUrl}
          </p>
        ) : null}
      </div>

      <Guidance guidance={violation.guidance} />

      <section aria-labelledby={`violation-${index}-nodes`} className="p-5 sm:p-6">
        <h5 id={`violation-${index}-nodes`} className="text-lg font-bold text-slate-950">
          Phần tử bị ảnh hưởng
          <span className="sr-only"> cho quy tắc {violation.ruleId}</span>
        </h5>
        {violation.nodes.length < violation.totalNodeCount ? (
          <p className="mt-3 text-sm text-slate-700">
            Hiển thị {violation.nodes.length} trong tổng số {violation.totalNodeCount} phần tử
            để giữ báo cáo ở kích thước an toàn.
          </p>
        ) : null}
        {violation.nodes.length === 0 ? (
          <p className="mt-3 text-slate-700">Không có chi tiết phần tử.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {violation.nodes.map((node, nodeIndex) => (
              <li key={nodeIndex}>
                <AffectedNodeDetails node={node} index={nodeIndex} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

function Guidance({ guidance }: { guidance: VietnameseGuidance }) {
  if (guidance.status === "UNAVAILABLE") {
    return (
      <section className="border-b border-slate-200 bg-slate-50 p-5 sm:p-6">
        <h5 className="font-bold text-slate-950">Hướng dẫn tiếng Việt: Chưa có</h5>
        <p className="mt-2 text-slate-700">{unavailableGuidanceMessage}</p>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-emerald-50 p-5 sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
        Hướng dẫn tiếng Việt đã biên soạn
      </p>
      <h5 className="mt-2 text-lg font-bold text-slate-950">{guidance.title}</h5>
      <GuidanceField label="Giải thích" value={guidance.explanation} />
      <GuidanceField label="Vì sao quan trọng" value={guidance.whyItMatters} />
      <GuidanceField label="Cách khắc phục" value={guidance.remediation} />
      {guidance.example !== undefined ? (
        <div className="mt-4">
          <h6 className="font-semibold text-slate-950">Ví dụ</h6>
          <pre className="mt-2 max-w-full whitespace-pre-wrap break-all rounded-md border border-emerald-300 bg-white p-3 text-sm text-slate-950">
            <code>{guidance.example}</code>
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function GuidanceField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <h6 className="font-semibold text-slate-950">{label}</h6>
      <p className="mt-1 whitespace-pre-line leading-7 text-slate-700">{value}</p>
    </div>
  );
}

function AffectedNodeDetails({ node, index }: { node: AffectedNode; index: number }) {
  return (
    <details className="rounded-lg border border-slate-300 bg-slate-50 p-4">
      <summary className="cursor-pointer font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-sky-700">
        Phần tử {index + 1}: <code className="break-all text-sm">{formatTarget(node.target)}</code>
      </summary>
      <div className="mt-4 space-y-4">
        <div>
          <h6 className="font-semibold text-slate-950">Selector / target</h6>
          <pre className="mt-2 max-w-full whitespace-pre-wrap break-all rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-950">
            <code>{formatTarget(node.target)}</code>
          </pre>
        </div>
        {node.html !== undefined ? (
          <div>
            <h6 className="font-semibold text-slate-950">Đoạn HTML (hiển thị dưới dạng văn bản)</h6>
            <pre className="mt-2 max-w-full whitespace-pre-wrap break-all rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-950">
              <code>{node.html}</code>
            </pre>
          </div>
        ) : null}
        {node.failureSummary !== undefined ? (
          <div>
            <h6 className="font-semibold text-slate-950">Tóm tắt lỗi từ axe</h6>
            <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">
              {node.failureSummary}
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function validateUrlInput(input: string): string | undefined {
  const value = input.trim();

  if (value.length === 0) {
    return "Hãy nhập URL của trang cần quét.";
  }

  try {
    const parsed = new URL(value);

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.hostname.length === 0
    ) {
      return "URL phải bắt đầu bằng http:// hoặc https:// và có tên máy chủ.";
    }

    if (parsed.username.length > 0 || parsed.password.length > 0) {
      return "URL không được chứa tên người dùng hoặc mật khẩu.";
    }
  } catch {
    return "Hãy nhập một URL đầy đủ và hợp lệ, ví dụ https://example.com.";
  }

  return undefined;
}

function isScanSuccessBody(input: unknown): input is ScanSuccessBody {
  return (
    typeof input === "object" &&
    input !== null &&
    "report" in input &&
    typeof input.report === "object" &&
    input.report !== null
  );
}

function readErrorResponse(input: unknown): {
  message: string;
  isValidation: boolean;
} {
  if (
    typeof input === "object" &&
    input !== null &&
    "error" in input &&
    typeof input.error === "object" &&
    input.error !== null &&
    "message" in input.error &&
    typeof input.error.message === "string"
  ) {
    const error = (input as ScanErrorBody).error;
    return {
      message: error.message,
      isValidation: error.code === "INVALID_INPUT",
    };
  }

  return {
    message: "Không thể hoàn tất lần quét. Vui lòng thử lại.",
    isValidation: false,
  };
}

function formatTarget(target: SelectorTarget): string {
  if (target.length === 0) {
    return "Không có selector";
  }

  return target
    .map((part) => (Array.isArray(part) ? part.join(" → ") : part))
    .join(", ");
}

function readSafeHttpUrl(input: string | undefined): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function formatScannedAt(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(date);
}
