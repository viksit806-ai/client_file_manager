'use client';

export default function StatCard({ title, value, icon: Icon, color = 'blue' }) {
  const configs = {
    blue: {
      card: 'bg-blue-50/80 dark:bg-blue-950/20 border border-slate-200/80 dark:border-slate-800/80 border-l-4 border-l-blue-600 dark:border-l-blue-500 text-blue-800 dark:text-blue-200 shadow-xs hover:shadow-md transition-all duration-300',
      iconBg: 'bg-blue-600 text-white dark:bg-blue-500/20 dark:text-blue-300',
    },
    green: {
      card: 'bg-green-50/80 dark:bg-green-950/20 border border-slate-200/80 dark:border-slate-800/80 border-l-4 border-l-green-600 dark:border-l-green-500 text-green-800 dark:text-green-200 shadow-xs hover:shadow-md transition-all duration-300',
      iconBg: 'bg-green-600 text-white dark:bg-green-500/20 dark:text-green-300',
    },
    yellow: {
      card: 'bg-amber-50/80 dark:bg-amber-950/20 border border-slate-200/80 dark:border-slate-800/80 border-l-4 border-l-amber-600 dark:border-l-amber-500 text-amber-800 dark:text-amber-200 shadow-xs hover:shadow-md transition-all duration-300',
      iconBg: 'bg-amber-600 text-white dark:bg-amber-500/20 dark:text-amber-300',
    },
    red: {
      card: 'bg-red-50/80 dark:bg-red-950/20 border border-slate-200/80 dark:border-slate-800/80 border-l-4 border-l-red-600 dark:border-l-red-500 text-red-800 dark:text-red-200 shadow-xs hover:shadow-md transition-all duration-300',
      iconBg: 'bg-red-600 text-white dark:bg-red-500/20 dark:text-red-300',
    },
    purple: {
      card: 'bg-purple-50/80 dark:bg-purple-950/20 border border-slate-200/80 dark:border-slate-800/80 border-l-4 border-l-purple-600 dark:border-l-purple-500 text-purple-800 dark:text-purple-200 shadow-xs hover:shadow-md transition-all duration-300',
      iconBg: 'bg-purple-600 text-white dark:bg-purple-500/20 dark:text-purple-300',
    },
  };

  const config = configs[color] || configs.blue;

  return (
    <div className={`rounded-xl p-5 flex items-center justify-between ${config.card}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-extrabold mt-1.5 tracking-tight">{value}</p>
      </div>
      {Icon && (
        <div className={`p-3 rounded-xl shrink-0 ml-4 flex items-center justify-center transition-all ${config.iconBg}`}>
          <Icon size={22} className="shrink-0" strokeWidth={2.2} />
        </div>
      )}
    </div>
  );
}
