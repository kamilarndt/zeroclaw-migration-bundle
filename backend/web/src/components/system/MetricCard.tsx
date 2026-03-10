interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
}

export function MetricCard({ title, value, unit }: MetricCardProps) {
  return (
    <div className="metric-card bg-gray-800 p-4 rounded">
      <h3 className="text-sm text-gray-400">{title}</h3>
      <p className="text-2xl font-bold">{value} <span className="text-sm">{unit}</span></p>
    </div>
  );
}
