import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart,
  DollarSign,
  Target,
  Download
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import ExcelDownload from '@/components/ExcelDownload';

interface MonthlyData {
  month: string;
  expenses: number;
  budget: number;
}

interface CategoryData {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

interface TrendData {
  date: string;
  amount: number;
}

const Reports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6months');
  const [customMonth, setCustomMonth] = useState('');
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalExpenses: 0,
    averageDaily: 0,
    totalBudget: 0,
    savingsRate: 0
  });
  const [currency, setCurrency] = useState('USD');

  // Set customMonth to current month when timeRange changes to 'custom_month'
  useEffect(() => {
    if (timeRange === 'custom_month') {
      const currentDate = new Date();
      const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
      setCustomMonth(currentMonth); // Default to current month (e.g., '2025-08')
    } else {
      setCustomMonth(''); // Clear customMonth for other time ranges
    }
  }, [timeRange]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('currency')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      console.log('Profile fetched:', data); // Debug log
      setCurrency(data?.currency || 'USD');
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    }
  };

  const fetchReportsData = async () => {
    if (!user) return;
    if (timeRange === 'custom_month' && !customMonth) {
      setLoading(false); // Prevent fetching until a month is selected
      return;
    }

    try {
      const currentDate = new Date();
      let startDate: Date;
      let endDate: Date;
      let monthsBack: number;

      // Determine date range based on timeRange
      if (timeRange === 'this_month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        monthsBack = 1;
      } else if (timeRange === 'last_month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
        monthsBack = 1;
      } else if (timeRange === 'custom_month' && customMonth) {
        const [year, month] = customMonth.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
        monthsBack = 1;
      } else {
        monthsBack = timeRange === '6months' ? 6 : timeRange === '12months' ? 12 : 3;
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthsBack, 1);
        endDate = currentDate;
      }

      // Fetch expenses data
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          amount,
          expense_date,
          categories (name, color)
        `)
        .eq('user_id', user.id)
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0])
        .order('expense_date');

      if (expensesError) throw expensesError;

      // Fetch budget data
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('amount, period, start_date, end_date')
        .eq('user_id', user.id)
        .gte('start_date', (timeRange === 'this_month' || timeRange === 'last_month' || timeRange === 'custom_month') ? startDate.toISOString().split('T')[0] : undefined)
        .lte('end_date', (timeRange === 'this_month' || timeRange === 'last_month' || timeRange === 'custom_month') ? endDate.toISOString().split('T')[0] : undefined);

      if (budgetError) throw budgetError;

      // Process monthly data
      const monthlyMap = new Map<string, { expenses: number; budget: number }>();
      const categoryMap = new Map<string, { amount: number; color: string }>();
      let totalExpenses = 0;

      expensesData?.forEach(expense => {
        const date = new Date(expense.expense_date);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        totalExpenses += Number(expense.amount);

        // Monthly data
        const current = monthlyMap.get(monthKey) || { expenses: 0, budget: 0 };
        current.expenses += Number(expense.amount);
        monthlyMap.set(monthKey, current);

        // Category data
        if (expense.categories) {
          const categoryKey = expense.categories.name;
          const currentCategory = categoryMap.get(categoryKey) || {
            amount: 0,
            color: expense.categories.color
          };
          currentCategory.amount += Number(expense.amount);
          categoryMap.set(categoryKey, currentCategory);
        }
      });

      // Calculate monthly budgets
      const totalBudget = budgetData?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
      const monthlyBudget = (timeRange === 'this_month' || timeRange === 'last_month' || timeRange === 'custom_month')
        ? totalBudget
        : totalBudget / monthsBack;

      // Convert maps to arrays
      const monthlyDataArray: MonthlyData[] = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        expenses: data.expenses,
        budget: monthlyBudget
      }));

      const categoryDataArray: CategoryData[] = Array.from(categoryMap.entries())
        .map(([name, data]) => ({
          name,
          amount: data.amount,
          color: data.color,
          percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);

      // Generate trend data (last 30 days for multi-month, full month for single-month)
      let trendStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (timeRange === 'this_month' || timeRange === 'last_month' || timeRange === 'custom_month') {
        trendStartDate = startDate;
      }
      const dailyExpenses = new Map<string, number>();

      expensesData?.forEach(expense => {
        const expenseDate = new Date(expense.expense_date);
        if (expenseDate >= trendStartDate) {
          const dateKey = expenseDate.toISOString().split('T')[0];
          dailyExpenses.set(dateKey, (dailyExpenses.get(dateKey) || 0) + Number(expense.amount));
        }
      });

      const trendDataArray: TrendData[] = [];
      const daysInPeriod = Math.floor((endDate.getTime() - trendStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      for (let i = daysInPeriod - 1; i >= 0; i--) {
        const date = new Date(trendStartDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        trendDataArray.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: dailyExpenses.get(dateKey) || 0
        });
      }

      // Calculate stats
      const daysInRange = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const averageDaily = daysInRange > 0 ? totalExpenses / daysInRange : 0;
      const savingsRate = totalBudget > 0 ? ((totalBudget - totalExpenses) / totalBudget) * 100 : 0;

      setMonthlyData(monthlyDataArray);
      setCategoryData(categoryDataArray);
      setTrendData(trendDataArray);
      setTotalStats({
        totalExpenses,
        averageDaily,
        totalBudget,
        savingsRate
      });

    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      Promise.all([fetchProfile(), fetchReportsData()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user, timeRange, customMonth]);

  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile update received:', payload); // Debug log
          setCurrency(payload.new.currency || 'USD');
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  // Excel sheet configurations
  const excelSheets = [
    {
      sheetName: 'Key Metrics',
      data: [
        { metric: 'Total Expenses', value: totalStats.totalExpenses },
        { metric: 'Daily Average', value: totalStats.averageDaily },
        { metric: 'Total Budget', value: totalStats.totalBudget },
        { metric: 'Savings Rate', value: totalStats.savingsRate }
      ],
      columns: [
        { key: 'metric', header: 'Metric' },
        {
          key: 'value', header: 'Value', format: (value, row) =>
            row.metric === 'Savings Rate' ? `${value.toFixed(1)}%` : formatCurrency(value, currency)
        }
      ]
    },
    {
      sheetName: 'Monthly Overview',
      data: monthlyData,
      columns: [
        { key: 'month', header: 'Month' },
        { key: 'expenses', header: 'Expenses', format: (value) => formatCurrency(value, currency) },
        { key: 'budget', header: 'Budget', format: (value) => formatCurrency(value, currency) }
      ],
      chartId: 'monthly-overview-chart'
    },
    {
      sheetName: 'Category Breakdown',
      data: categoryData,
      columns: [
        { key: 'name', header: 'Category' },
        { key: 'amount', header: 'Amount', format: (value) => formatCurrency(value, currency) },
        { key: 'percentage', header: 'Percentage', format: (value) => `${value.toFixed(1)}%` }
      ],
      chartId: 'category-breakdown-chart'
    },
    {
      sheetName: 'Daily Trend',
      data: trendData,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'amount', header: 'Amount', format: (value) => formatCurrency(value, currency) }
      ], chartId: 'daily-trend-chart'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Insights into your spending patterns</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="custom_month">Select a month</SelectItem>
              <SelectItem value="3months">Last 3 months</SelectItem>
              <SelectItem value="6months">Last 6 months</SelectItem>
              <SelectItem value="12months">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          {timeRange === 'custom_month' && (
            <Input
              type="month"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
              className="w-[180px]"
              max={`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`}
            />
          )}
          <ExcelDownload
            sheets={excelSheets}
            fileName="Expense_Report"
            disabled={loading || (timeRange === 'custom_month' && !customMonth)}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.totalExpenses, currency)}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.averageDaily, currency)}</div>
            <p className="text-xs text-muted-foreground">Per day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.totalBudget, currency)}</div>
            <p className="text-xs text-muted-foreground">Active budgets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            {totalStats.savingsRate >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalStats.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalStats.savingsRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStats.savingsRate >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Overview
            </CardTitle>
            <CardDescription>Expenses vs Budget comparison</CardDescription>
          </CardHeader>
          <CardContent>
          <div id="monthly-overview-chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                <Legend />
                <Bar dataKey="expenses" fill="#3B82F6" name="Expenses" />
                <Bar dataKey="budget" fill="#10B981" name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Spending by Category
            </CardTitle>
            <CardDescription>Top categories this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-4">
              <div id="category-breakdown-chart" className="w-full lg:w-2/3">
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      dataKey="amount"
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ percentage }) => `${percentage.toFixed(0)}%`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full lg:w-1/3 space-y-2">
                {categoryData.map((category, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color || COLORS[index % COLORS.length] }}
                    />
                    <span className="flex-1">{category.name}</span>
                    <span className="font-medium">{formatCurrency(category.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Spending Trend
          </CardTitle>
          <CardDescription>
            {timeRange === 'this_month' || timeRange === 'last_month' || timeRange === 'custom_month'
              ? 'Spending pattern for selected month'
              : 'Last 30 days spending pattern'}
          </CardDescription>
        </CardHeader>
        <CardContent>
        <div id="daily-trend-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;