"use client";

/**
 * Download PDF, with the pending state §13 requires.
 *
 * An export takes a couple of seconds — Chromium launches per request (§8) —
 * so a plain link gives no sign anything is happening and invites a second
 * click, which would launch a second browser. Fetching instead lets the
 * button disable and spin for the request's duration, and turns the API's
 * JSON error (a missing font face, a Puppeteer failure) into a toast rather
 * than a blank tab.
 *
 * The response is a PDF of a couple of hundred KB, so buffering it as a blob
 * to trigger the save costs nothing worth optimising.
 */
import { useState } from "react";

import { exportPath, pdfFilename } from "@/lib/routes";

import { useToast } from "./Toaster";

/** Reads the API's `{ error }` body, falling back to the status line. */
async function failureMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // A non-JSON body (a proxy error page, say) leaves the status to speak.
  }
  return `Export failed with ${response.status} ${response.statusText}`;
}

/** Long enough for the browser to have read the blob before it is revoked. */
const REVOKE_AFTER_MS = 60_000;

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // The browser reads the blob asynchronously after the click, so the object
  // URL has to outlive the call that started the download; revoking it inline
  // can cancel the very save it just triggered. Letting it go stale on a timer
  // costs one held reference and rules that out.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

export function DownloadButton({
  profileId,
  variantId,
}: {
  profileId: string;
  variantId: string;
}) {
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function download() {
    setPending(true);
    try {
      const response = await fetch(exportPath(profileId, variantId, { download: true }));
      if (!response.ok) {
        toast(await failureMessage(response), "error");
        return;
      }
      const pdf = await response.blob();
      // A 2xx with nothing in it is still a failed export — saving a 0-byte
      // file would be precisely the silent failure §13 rules out.
      if (pdf.size === 0) {
        toast("Export returned an empty file — nothing was saved.", "error");
        return;
      }
      save(pdf, pdfFilename(profileId, variantId));
    } catch (error) {
      // A dropped connection or an aborted request must say so; §13's rule is
      // that nothing fails silently.
      toast(`Export failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      aria-busy={pending}
      className="flex items-center gap-1.5 rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      disabled={pending}
      onClick={download}
      type="button"
    >
      {pending ? (
        <>
          <svg aria-hidden className="size-3 animate-spin" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              fill="none"
              r="6"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="2"
            />
            <path
              d="M8 2a6 6 0 0 1 6 6"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
          Generating…
        </>
      ) : (
        "Download PDF"
      )}
    </button>
  );
}
