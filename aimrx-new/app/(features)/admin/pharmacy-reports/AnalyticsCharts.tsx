"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, Award, Building2 } from "lucide-react";

interface Order {
  id: string;
  queue_id: string;
  date: string;
  patient: string;
  medication: string;
  quantity: number;
  refills: number;
  sig: string;
  price: number;
  medicationPrice: number;
  providerFees: number;
  status: string;
}

interface ProviderData {
  provider: { id: string; name: string; email: string; group_id: string | null };
  orders: Order[];
  totalOrders: number;
  totalAmount: number;
  totalMedicationAmount: number;
  totalProviderFees: number;
}

interface PharmacyReport {
  pharmacy: { id: string; name: string };
  providers: ProviderData[];
  totalOrders: number;
  totalAmount: number;
}

interface AnalyticsChartsProps {
  reports: PharmacyReport[];
}

const BLUE_PALETTE = [
  "#1E3A8A",
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
  "#1E40AF",
  "#1D4ED8",
];

const STATUS_COLORS: Record<string, string> = {
  submitted: "#3B82F6",
  billing: "#8B5CF6",
  approved: "#10B981",
  packed: "#F59E0B",
  shipped: "#6366F1",
  delivered: "#059669",
  completed: "#059669",
  cancelled: "#EF4444",
  pending_payment: "#F59E0B",
  payment_received: "#14B8A6",
};

const CustomTooltip = ({ active, payload, label, prefix }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string; prefix?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-xl p-4 min-w-[160px]" data-testid="chart-tooltip">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-sm text-gray-600">{entry.name}</span>
          </div>
          <span className="text-sm font-bold text-gray-900">
            {prefix === "$" ? `$${Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-xl p-3 min-w-[140px]" data-testid="pie-tooltip">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="text-sm font-semibold text-gray-800">{entry.name}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 ml-5">{entry.value} orders</p>
    </div>
  );
};

function ChartHeader({ icon: Icon, title, subtitle }: { icon: typeof TrendingUp; title: string; subtitle?: string }) {
  return (
    <CardHeader className="pb-1 pt-5 px-6">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] flex items-center justify-center shadow-sm">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <CardTitle className="text-sm font-semibold text-gray-900">{title}</CardTitle>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </CardHeader>
  );
}

export default function AnalyticsCharts({ reports }: AnalyticsChartsProps) {
  const revenueOverTime = useMemo(() => {
    const dailyMap: Record<string, { date: string; revenue: number; orders: number }> = {};
    reports.forEach((report) => {
      report.providers.forEach((p) => {
        p.orders.forEach((order) => {
          const day = new Date(order.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const sortKey = new Date(order.date).toISOString().split("T")[0];
          if (!dailyMap[sortKey]) {
            dailyMap[sortKey] = { date: day, revenue: 0, orders: 0 };
          }
          dailyMap[sortKey].revenue += order.price;
          dailyMap[sortKey].orders += 1;
        });
      });
    });
    return Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, revenue: Math.round(v.revenue * 100) / 100 }));
  }, [reports]);

  const statusDistribution = useMemo(() => {
    const statusMap: Record<string, number> = {};
    reports.forEach((report) => {
      report.providers.forEach((p) => {
        p.orders.forEach((order) => {
          const status = order.status || "unknown";
          statusMap[status] = (statusMap[status] || 0) + 1;
        });
      });
    });
    return Object.entries(statusMap)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
        value,
        color: STATUS_COLORS[name] || "#94A3B8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [reports]);

  const totalStatusOrders = statusDistribution.reduce((s, d) => s + d.value, 0);

  const topProviders = useMemo(() => {
    const providerMap: Record<string, { name: string; revenue: number; orders: number }> = {};
    reports.forEach((report) => {
      report.providers.forEach((p) => {
        const key = p.provider.id;
        if (!providerMap[key]) {
          providerMap[key] = { name: p.provider.name, revenue: 0, orders: 0 };
        }
        providerMap[key].revenue += p.totalAmount;
        providerMap[key].orders += p.totalOrders;
      });
    });
    return Object.values(providerMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }));
  }, [reports]);

  const pharmacyComparison = useMemo(() => {
    return reports
      .map((r) => ({
        name: r.pharmacy.name.length > 18 ? r.pharmacy.name.slice(0, 18) + "..." : r.pharmacy.name,
        revenue: Math.round(r.totalAmount * 100) / 100,
        orders: r.totalOrders,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [reports]);

  const allOrders = reports.flatMap((r) => r.providers.flatMap((p) => p.orders));

  if (allOrders.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <TrendingUp className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No data available</h3>
          <p className="text-sm text-gray-400">Adjust your filters to see analytics</p>
        </CardContent>
      </Card>
    );
  }

  const maxProviderRevenue = topProviders.length > 0 ? topProviders[0].revenue : 0;

  return (
    <div className="space-y-6" data-testid="analytics-charts">
      <Card className="overflow-hidden border-0 shadow-md bg-white" data-testid="chart-revenue-trend">
        <ChartHeader icon={TrendingUp} title="Revenue Trend" subtitle="Daily revenue over selected period" />
        <CardContent className="px-6 pb-6 pt-2">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueOverTime} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E3A8A" stopOpacity={0.2} />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} axisLine={false} tickLine={false} dx={-4} />
                <Tooltip content={<CustomTooltip prefix="$" />} cursor={{ stroke: "#CBD5E1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#1E3A8A"
                  strokeWidth={2.5}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#1E3A8A", stroke: "#fff", strokeWidth: 2 }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden border-0 shadow-md bg-white" data-testid="chart-status-distribution">
          <ChartHeader icon={PieIcon} title="Order Status" subtitle="Distribution by current status" />
          <CardContent className="px-6 pb-6 pt-2">
            <div className="h-[300px] flex items-center">
              <div className="w-[55%] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      animationDuration={1200}
                      animationEasing="ease-out"
                      strokeWidth={0}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-[45%] space-y-2 pl-2">
                {statusDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-gray-600 truncate">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-gray-900">{entry.value}</span>
                      <span className="text-[10px] text-gray-400 w-8 text-right">
                        {totalStatusOrders > 0 ? Math.round((entry.value / totalStatusOrders) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-md bg-white" data-testid="chart-top-providers">
          <ChartHeader icon={Award} title="Top Providers" subtitle="Ranked by total revenue" />
          <CardContent className="px-6 pb-6 pt-2">
            <div className="h-[300px] space-y-3 overflow-y-auto">
              {topProviders.map((provider, idx) => {
                const barWidth = maxProviderRevenue > 0 ? (provider.revenue / maxProviderRevenue) * 100 : 0;
                return (
                  <div key={idx} className="group" data-testid={`provider-rank-${idx}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${idx < 3 ? "bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] text-white" : "bg-gray-100 text-gray-500"}`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700 truncate">{provider.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-sm font-bold text-gray-900">${provider.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-[10px] text-gray-400 ml-1.5">{provider.orders} orders</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${barWidth}%`,
                          background: idx < 3
                            ? "linear-gradient(90deg, #1E3A8A, #3B82F6)"
                            : "linear-gradient(90deg, #94A3B8, #CBD5E1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {topProviders.length === 0 && (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">No provider data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {pharmacyComparison.length > 1 && (
        <Card className="overflow-hidden border-0 shadow-md bg-white" data-testid="chart-pharmacy-comparison">
          <ChartHeader icon={Building2} title="Pharmacy Comparison" subtitle="Revenue performance by pharmacy" />
          <CardContent className="px-6 pb-6 pt-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pharmacyComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    {pharmacyComparison.map((_, index) => (
                      <linearGradient key={`pharmaGrad-${index}`} id={`pharmaGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BLUE_PALETTE[index % BLUE_PALETTE.length]} stopOpacity={1} />
                        <stop offset="100%" stopColor={BLUE_PALETTE[index % BLUE_PALETTE.length]} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} axisLine={false} tickLine={false} dx={-4} />
                  <Tooltip content={<CustomTooltip prefix="$" />} cursor={{ fill: "#F8FAFC" }} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: 12 }}
                    formatter={(value) => <span className="text-xs text-gray-500 ml-1">{value}</span>}
                  />
                  <Bar dataKey="revenue" name="Revenue" animationDuration={1200} animationEasing="ease-out" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {pharmacyComparison.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pharmaGrad-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
