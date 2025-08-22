-- Fix security warnings by setting search_path on functions

-- Update the update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update the handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Insert default categories
  INSERT INTO public.categories (user_id, name, color, icon) VALUES
  (NEW.id, 'Food & Dining', '#EF4444', 'utensils'),
  (NEW.id, 'Transportation', '#3B82F6', 'car'),
  (NEW.id, 'Shopping', '#8B5CF6', 'shopping-bag'),
  (NEW.id, 'Entertainment', '#F59E0B', 'film'),
  (NEW.id, 'Bills & Utilities', '#10B981', 'zap'),
  (NEW.id, 'Health & Medical', '#EC4899', 'heart'),
  (NEW.id, 'Education', '#6366F1', 'book-open'),
  (NEW.id, 'Travel', '#14B8A6', 'plane'),
  (NEW.id, 'Other', '#6B7280', 'more-horizontal');
  
  RETURN NEW;
END;
$$;