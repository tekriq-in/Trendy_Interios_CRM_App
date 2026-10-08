type Variant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange';

const variants: Record<Variant, string> = {
  green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  yellow: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20',
  orange: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
};

export function Badge({ variant = 'gray', children }: { variant?: Variant; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
