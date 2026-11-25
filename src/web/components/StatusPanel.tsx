import type { SystemStatus } from '../status.js';

const Badge = ({ ok, children }: { ok: boolean; children: string }) => (
  <span
    class={
      ok
        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
        : 'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800'
    }
  >
    {children}
  </span>
);

export const StatusPanel = ({ status, now }: { status: SystemStatus; now: Date }) => (
  <section id="system-status" class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">System status</h2>
    <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt class="text-slate-600">Database</dt>
      <dd>
        <Badge ok={status.db === 'ok'}>{status.db === 'ok' ? 'connected' : 'unavailable'}</Badge>
      </dd>
      <dt class="text-slate-600">Worker</dt>
      <dd class="flex items-center gap-2">
        <Badge ok={status.worker.healthy}>{status.worker.healthy ? 'alive' : 'no heartbeat'}</Badge>
        {status.worker.ageSeconds !== null ? (
          <span class="text-slate-500">last heartbeat {status.worker.ageSeconds}s ago</span>
        ) : (
          <span class="text-slate-500">never reported</span>
        )}
      </dd>
      <dt class="text-slate-600">Checked</dt>
      <dd class="text-slate-500">{now.toISOString()}</dd>
    </dl>
  </section>
);
