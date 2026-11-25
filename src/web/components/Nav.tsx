export const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/companies', label: 'Companies' },
  { href: '/applications', label: 'Applications' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
] as const;

export const Nav = ({ currentPath }: { currentPath: string }) => (
  <header class="border-b border-slate-200 bg-white">
    <nav class="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
      <a href="/" class="text-lg font-semibold tracking-tight">
        Job Agent
      </a>
      <ul class="flex gap-4 text-sm">
        {navItems.map((item) => (
          <li>
            <a
              href={item.href}
              class={
                currentPath === item.href
                  ? 'font-medium text-slate-900 underline underline-offset-4'
                  : 'text-slate-600 hover:text-slate-900'
              }
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  </header>
);
