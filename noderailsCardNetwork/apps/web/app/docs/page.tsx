import Link from "next/link";
import { ArrowLeft, ServerCrash } from "lucide-react";
import { Badge, Card } from "@noderails-card/ui";

async function fetchSpec() {
  try {
    const res = await fetch("http://localhost:9080/v1/openapi.json", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DocsPage() {
  const spec = await fetchSpec();
  const offline = spec === null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Home
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-brand">
            API reference
          </p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.02em] text-ink">
            OpenAPI · Live spec
          </h1>
          <p className="mt-2 max-w-2xl text-[14.5px] text-ink-muted">
            Served from{" "}
            <code className="rounded-md bg-canvas-muted px-1.5 py-0.5 font-mono text-[13px] text-ink">
              /v1/openapi.json
            </code>{" "}
            when the API is running on port 9080.
          </p>
        </div>
        <Badge tone={offline ? "warning" : "success"}>
          {offline ? (
            <>
              <ServerCrash className="h-3 w-3" /> API offline
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
            </>
          )}
        </Badge>
      </div>

      <Card className="mt-8 overflow-hidden p-0">
        <div className="border-b border-line bg-canvas-subtle/70 px-5 py-3 text-[12.5px] font-medium text-ink-muted">
          {offline
            ? "Start the API: docker compose up -d && pnpm --filter @noderails-card/api dev"
            : "GET /v1/openapi.json"}
        </div>
        <pre className="max-h-[min(70vh,720px)] overflow-auto bg-[#0b0b12] p-5 font-mono text-[12.5px] leading-relaxed text-zinc-200">
          <code>
            {JSON.stringify(
              spec ?? { status: "api offline; run docker compose & pnpm dev in services/api" },
              null,
              2
            )}
          </code>
        </pre>
      </Card>
    </div>
  );
}
