import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl text-xs">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.fill }}
            />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="font-semibold text-foreground">
              {p.dataKey === "revenue"
                ? `${Number(p.value).toLocaleString("vi-VN")} VNĐ`
                : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl">
        Chưa có dữ liệu thống kê hôm nay
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#334155"
            opacity={0.1}
          />
          <XAxis
            dataKey="label"
            interval={data.length > 15 ? 2 : 0}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            fontSize={10}
            dy={8}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            fontSize={10}
            dx={-8}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            stroke="#f59e0b"
            fontSize={10}
            dx={8}
            tickFormatter={(v) => `${Number(v).toLocaleString("vi-VN")} VNĐ`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", fontWeight: 500 }}
          />
          <Bar
            yAxisId="right"
            dataKey="revenue"
            name="Doanh thu"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
            maxBarSize={15}
          />
          <Bar
            yAxisId="left"
            dataKey="exits"
            name="Xe Ra"
            fill="#f472b6"
            radius={[4, 4, 0, 0]}
            maxBarSize={15}
          />

          <Bar
            yAxisId="left"
            dataKey="entries"
            name="Xe Vào"
            fill="#38bdf8"
            radius={[4, 4, 0, 0]}
            maxBarSize={15}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
