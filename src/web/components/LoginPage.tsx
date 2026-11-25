export const LoginPage = ({ next, error }: { next: string; error?: string }) => (
  <div class="mx-auto max-w-sm">
    <h1 class="mb-6 text-2xl font-semibold">Sign in</h1>
    {error ? (
      <p role="alert" class="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error}
      </p>
    ) : null}
    <form method="post" action="/login" class="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700">Password</span>
        <input
          type="password"
          name="password"
          required
          autocomplete="current-password"
          autofocus
          class="w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-slate-500 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        class="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Sign in
      </button>
    </form>
  </div>
);
