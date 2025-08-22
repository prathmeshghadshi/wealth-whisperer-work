import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Target,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Budget {
  id: string;
  name: string;
  amount: number;
  period: string;
  start_date: string;
  end_date?: string;
  categories?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  spent?: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const Budgets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Form state for adding budget
  const [addFormData, setAddFormData] = useState({
    name: '',
    amount: '',
    period: 'monthly',
    category_id: '',
    start_date: new Date().toISOString().split('T')[0]
  });

  // Form state for editing budget
  const [editFormData, setEditFormData] = useState({
    name: '',
    amount: '',
    period: 'monthly',
    category_id: '',
    start_date: ''
  });

  const fetchBudgets = async () => {
    if (!user) return;

    try {
      const { data: budgetsData, error } = await supabase
        .from('budgets')
        .select(`
          id,
          name,
          amount,
          period,
          start_date,
          end_date,
          categories (
            id,
            name,
            color,
            icon
          )
        `)
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;

      const budgetsWithSpent = await Promise.all(
        (budgetsData || []).map(async (budget) => {
          const currentDate = new Date();
          const startDate = new Date(budget.start_date);
          let endDate = new Date(budget.end_date || currentDate);
          if (!budget.end_date) {
            if (budget.period === 'monthly') {
              endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            } else if (budget.period === 'weekly') {
              endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else if (budget.period === 'yearly') {
              endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
            }
          }

          let query = supabase
            .from('expenses')
            .select('amount')
            .eq('user_id', user.id)
            .gte('expense_date', budget.start_date)
            .lte('expense_date', endDate.toISOString().split('T')[0]);

          if (budget.categories?.id) {
            query = query.eq('category_id', budget.categories.id);
          }

          const { data: expensesData } = await query;
          const spent = expensesData?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;

          return { ...budget, spent };
        })
      );

      setBudgets(budgetsWithSpent);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast({
        title: "Error",
        description: "Failed to load budgets",
        variant: "destructive",
      });
    }
  };

  const fetchCategories = async () => {
    if (!user) return;

    try {
      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !addFormData.name || !addFormData.amount) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .insert([{
          user_id: user.id,
          name: addFormData.name,
          amount: parseFloat(addFormData.amount),
          period: addFormData.period,
          category_id: addFormData.category_id || null,
          start_date: addFormData.start_date
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Budget created successfully",
      });

      setIsAddDialogOpen(false);
      setAddFormData({
        name: '',
        amount: '',
        period: 'monthly',
        category_id: '',
        start_date: new Date().toISOString().split('T')[0]
      });
      fetchBudgets();
    } catch (error) {
      console.error('Error adding budget:', error);
      toast({
        title: "Error",
        description: "Failed to create budget",
        variant: "destructive",
      });
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !editingBudget || !editFormData.name || !editFormData.amount) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .update({
          name: editFormData.name,
          amount: parseFloat(editFormData.amount),
          period: editFormData.period,
          category_id: editFormData.category_id || null,
          start_date: editFormData.start_date
        })
        .eq('id', editingBudget.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Budget updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingBudget(null);
      fetchBudgets();
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: "Error",
        description: "Failed to update budget",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Budget deleted successfully",
      });

      fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: "Error",
        description: "Failed to delete budget",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setEditFormData({
      name: budget.name,
      amount: budget.amount.toString(),
      period: budget.period,
      category_id: budget.categories?.id || '',
      start_date: budget.start_date
    });
    setIsEditDialogOpen(true);
  };

  useEffect(() => {
    if (user) {
      Promise.all([fetchBudgets(), fetchCategories()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getBudgetStatus = (budget: Budget) => {
    const progress = budget.spent ? (budget.spent / budget.amount) * 100 : 0;
    if (progress >= 100) return { status: 'exceeded', color: 'text-destructive', icon: AlertTriangle };
    if (progress >= 80) return { status: 'warning', color: 'text-yellow-600', icon: TrendingUp };
    return { status: 'good', color: 'text-green-600', icon: TrendingDown };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budgets</h1>
          <p className="text-muted-foreground">Set and track your spending limits</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
              <DialogDescription>
                Set a spending limit to help manage your finances.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Budget Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Monthly Food Budget"
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Budget Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={addFormData.amount}
                  onChange={(e) => setAddFormData({ ...addFormData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select value={addFormData.period} onValueChange={(value) => setAddFormData({ ...addFormData, period: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category (Optional)</Label>
                <Select value={addFormData.category_id} onValueChange={(value) => setAddFormData({ ...addFormData, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories || [])
                      .filter((category) => category.id && category.id.trim() !== "")
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={addFormData.start_date}
                  onChange={(e) => setAddFormData({ ...addFormData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Create Budget</Button>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Budget Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
            <DialogDescription>
              Update your budget details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditBudget} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Budget Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Monthly Food Budget"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-amount">Budget Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-period">Period</Label>
              <Select value={editFormData.period} onValueChange={(value) => setEditFormData({ ...editFormData, period: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category (Optional)</Label>
              <Select value={editFormData.category_id} onValueChange={(value) => setEditFormData({ ...editFormData, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {(categories || [])
                    .filter((category) => category.id && category.id.trim() !== "")
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-start_date">Start Date</Label>
              <Input
                id="edit-start_date"
                type="date"
                value={editFormData.start_date}
                onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Update Budget</Button>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No budgets yet. Create your first budget to start tracking your spending limits!
              </p>
            </CardContent>
          </Card>
        ) : (
          budgets.map((budget) => {
            const progress = budget.spent ? (budget.spent / budget.amount) * 100 : 0;
            const { status, color, icon: StatusIcon } = getBudgetStatus(budget);

            return (
              <Card key={budget.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{budget.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {budget.period}
                        </Badge>
                        {budget.categories && (
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: budget.categories.color }}
                            />
                            <span className="text-xs">{budget.categories.name}</span>
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(budget)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Spent</span>
                      <span className={color}>
                        ${(budget.spent || 0).toFixed(2)} / ${budget.amount.toFixed(2)}
                      </span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{progress.toFixed(0)}% used</span>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`h-3 w-3 ${color}`} />
                        <span className={color}>
                          {status === 'exceeded' ? 'Over budget' :
                            status === 'warning' ? 'Close to limit' : 'On track'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Remaining: ${Math.max(0, budget.amount - (budget.spent || 0)).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Budgets;