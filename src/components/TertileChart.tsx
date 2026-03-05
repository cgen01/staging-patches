import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import type { TertileData, CumulativeRow } from "@/lib/tertiles";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

export function TertileChart({ data }: { data: TertileData[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 13 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 13 }} />
        <Tooltip
          formatter={(value) => [`${value}`, "PRs"]}
          contentStyle={{ borderRadius: 8, fontSize: 13 }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={80}>
          {data.map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Cumulative area chart: overlays current year vs previous year
export function CumulativeAreaChart({
  data,
  years,
}: {
  data: CumulativeRow[];
  years: [number, number]; // [previous, current]
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart
        data={data}
        margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
      >
        <defs>
          <linearGradient id="gradientCurrent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradientPrevious" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#d1d5db" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 13 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 13 }} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
        <Legend />
        <Area
          type="monotone"
          dataKey={String(years[0])}
          stroke="#9ca3af"
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="url(#gradientPrevious)"
        />
        <Area
          type="monotone"
          dataKey={String(years[1])}
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#gradientCurrent)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface ReleaseSlice {
  name: string;
  count: number;
}

export function ReleaseBarChart({ data }: { data: ReleaseSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(320, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 13 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
        <Tooltip
          formatter={(value) => [`${value}`, "PRs"]}
          contentStyle={{ borderRadius: 8, fontSize: 13 }}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={30}>
          {data.map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface UserSlice {
  name: string;
  count: number;
}

export function UserPieChart({ data }: { data: UserSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={60}
          paddingAngle={2}
          label={({ name, value }) => `${name} (${value})`}
          labelLine={{ strokeWidth: 1 }}
        >
          {data.map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value}`, "PRs"]}
          contentStyle={{ borderRadius: 8, fontSize: 13 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
