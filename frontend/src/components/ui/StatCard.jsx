'use client';

export default function StatCard({ title, value, icon: Icon, color = 'blue' }) {
  const configs = {
    blue: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm hover:shadow-md transition-all duration-300',
    green: 'bg-gradient-to-br from-green-600 to-emerald-700 text-white shadow-sm hover:shadow-md transition-all duration-300',
    yellow: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm hover:shadow-md transition-all duration-300',
    red: 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-sm hover:shadow-md transition-all duration-300',
    purple: 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-sm hover:shadow-md transition-all duration-300',
  };

  const cardStyle = configs[color] || configs.blue;

  return (
    <div className={`rounded-xl p-5 flex items-center justify-between border-none ${cardStyle}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{title}</p>
        <p className="text-3xl font-extrabold mt-1.5 tracking-tight text-white">{value}</p>
      </div>
      {Icon && (
        <div className="p-3 bg-white/15 text-white rounded-xl shrink-0 ml-4 flex items-center justify-center backdrop-blur-xs">
          <Icon size={24} className="shrink-0" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}
