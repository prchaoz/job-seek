export const Placeholder = ({ title, milestone }: { title: string; milestone: string }) => (
  <>
    <h1 class="mb-2 text-2xl font-semibold">{title}</h1>
    <p class="text-slate-600">
      This page is planned for milestone {milestone}. Nothing to show yet.
    </p>
  </>
);
