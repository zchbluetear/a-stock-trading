const continuousBadgeClasses = [
  'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800',
  'bg-red-100 text-red-800 ring-1 ring-inset ring-red-300 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800',
  'bg-red-200 text-red-900 ring-1 ring-inset ring-red-300 dark:bg-red-900 dark:text-red-100 dark:ring-red-700',
  'bg-red-300 text-red-950 ring-1 ring-inset ring-red-400 dark:bg-red-800 dark:text-red-100 dark:ring-red-600',
] as const;

export const continuousBadgeClass = (days: number) => days >= 5
  ? 'bg-violet-700 text-white ring-1 ring-inset ring-violet-800 dark:bg-violet-500 dark:ring-violet-400'
  : continuousBadgeClasses[Math.max(Math.trunc(days), 1) - 1];
