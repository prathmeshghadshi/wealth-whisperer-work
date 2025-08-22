import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Plus,
  Calendar,
  Receipt
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalExpenses: number;
  monthlyExpenses: number;
  budgetUsed: number;
  totalBudget: number;
  recentExpenses: any[];
  categoriesSpending: any[];
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    monthlyExpenses: 0,
    budgetUsed: 0,
    totalBudget: 0,
    recentExpenses: [],
    categoriesSpending: []
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // Fetch total expenses
      const { data: totalExpensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id);

      // Fetch monthly expenses
      const { data: monthlyExpensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id)
        .gte('expense_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lte('expense_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`);

      // Fetch budgets
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('amount')
        .eq('user_id', user.id)
        .eq('period', 'monthly');

      // Fetch recent expenses with category info
      const { data: recentExpensesData } = await supabase
        .from('expenses')
        .select(`
          id,
          title,
          amount,
          expense_date,
          categories (name, color, icon)
        `)
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false })
        .limit(5);

      // Fetch category spending
      const { data: categorySpendingData } = await supabase
        .from('expenses')
        .select(`
          amount,
          categories (name, color, icon)
        `)
        .eq('user_id', user.id)
        .gte('expense_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lte('expense_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`);

      // Calculate stats
      const totalExpenses = totalExpensesData?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
      const monthlyExpenses = monthlyExpensesData?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
      const totalBudget = budgetsData?.reduce((sum, budget) => sum + Number(budget.amount), 0) || 0;

      // Process category spending
      const categoryMap = new Map();
      categorySpendingData?.forEach(expense => {
        if (expense.categories) {
          const categoryName = expense.categories.name;
          const current = categoryMap.get(categoryName) || { 
            ...expense.categories, 
            amount: 0 
          };
          current.amount += Number(expense.amount);
          categoryMap.set(categoryName, current);
        }
      });

      const categoriesSpending = Array.from(categoryMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setStats({
        totalExpenses,
        monthlyExpenses,
        budgetUsed: monthlyExpenses,
        totalBudget,
        recentExpenses: recentExpensesData || [],
        categoriesSpending
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const budgetProgress = stats.totalBudget > 0 ? (stats.budgetUsed / stats.totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your financial activity</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Monthly spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{budgetProgress.toFixed(0)}%</div>
            <Progress value={budgetProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              ${stats.budgetUsed.toFixed(2)} of ${stats.totalBudget.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.monthlyExpenses / new Date().getDate()).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Expenses and Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recent Expenses
            </CardTitle>
            <CardDescription>Your latest transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No expenses yet. Add your first expense to get started!
                </p>
              ) : (
                stats.recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: expense.categories?.color || '#6B7280' }}
                      >
                        {expense.title.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{expense.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {expense.categories?.name || 'Uncategorized'} • {new Date(expense.expense_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">-${Number(expense.amount).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Top Categories
            </CardTitle>
            <CardDescription>This month's spending by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.categoriesSpending.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No category data yet. Add some expenses to see insights!
                </p>
              ) : (
                stats.categoriesSpending.map((category, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <span className="font-medium">${category.amount.toFixed(2)}</span>
                    </div>
                    <Progress 
                      value={stats.monthlyExpenses > 0 ? (category.amount / stats.monthlyExpenses) * 100 : 0} 
                      className="h-2" 
                    />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;