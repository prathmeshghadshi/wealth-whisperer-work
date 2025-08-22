import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  PieChart,
  DollarSign,
  Target
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
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6months');
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalExpenses: 0,
    averageDaily: 0,
    totalBudget: 0,
    savingsRate: 0
  });

  const fetchReportsData = async () => {
    if (!user) return;

    try {
      const currentDate = new Date();
      const monthsBack = timeRange === '6months' ? 6 : timeRange === '12months' ? 12 : 3;
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthsBack, 1);
      
      // Fetch expenses data
      const { data: expensesData } = await supabase
        .from('expenses')
        .select(`
          amount,
          expense_date,
          categories (name, color)
        `)
        .eq('user_id', user.id)
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .order('expense_date');

      // Fetch budget data
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('amount, period')
        .eq('user_id', user.id);

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

      // Calculate monthly budgets (simplified - using total budget divided by months)
      const totalBudget = budgetData?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
      const monthlyBudget = totalBudget;

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

      // Generate trend data (last 30 days)
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dailyExpenses = new Map<string, number>();
      
      expensesData?.forEach(expense => {
        const expenseDate = new Date(expense.expense_date);
        if (expenseDate >= last30Days) {
          const dateKey = expenseDate.toISOString().split('T')[0];
          dailyExpenses.set(dateKey, (dailyExpenses.get(dateKey) || 0) + Number(expense.amount));
        }
      });

      const trendDataArray: TrendData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        trendDataArray.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: dailyExpenses.get(dateKey) || 0
        });
      }

      // Calculate stats
      const daysInRange = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReportsData();
    }
  }, [user, timeRange]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Insights into your spending patterns</p>
        </div>
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3months">Last 3 months</SelectItem>
            <SelectItem value="6months">Last 6 months</SelectItem>
            <SelectItem value="12months">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              This period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.averageDaily.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.totalBudget.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Active budgets
            </p>
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
        {/* Monthly Expenses vs Budget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Overview
            </CardTitle>
            <CardDescription>Expenses vs Budget comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="expenses" fill="#3B82F6" name="Expenses" />
                <Bar dataKey="budget" fill="#10B981" name="Budget" />
              </BarChart>
            </ResponsiveContainer>
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
              <div className="w-full lg:w-2/3">
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
                    <Tooltip />
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
                    <span className="font-medium">${category.amount.toFixed(0)}</span>
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
          <CardDescription>Last 30 days spending pattern</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;