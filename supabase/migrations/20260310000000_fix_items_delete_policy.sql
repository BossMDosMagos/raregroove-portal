-- Fix DELETE policy for items table
-- Allows users to delete their own items and admins to delete any item

-- Enable RLS (just in case)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policies to ensure clean slate
DROP POLICY IF EXISTS "Users can delete own items" ON public.items;
DROP POLICY IF EXISTS "Admins can delete any item" ON public.items;
DROP POLICY IF EXISTS "Delete own items" ON public.items;
DROP POLICY IF EXISTS "Admin delete items" ON public.items;

-- Policy 1: Users can delete their own items
-- Note: It is good practice to prevent deleting items that are already sold/shipped at DB level,
-- but for now we focus on fixing the permission error.
CREATE POLICY "Users can delete own items"
ON public.items
FOR DELETE
USING (
  auth.uid() = seller_id
);

-- Policy 2: Admins can delete any item
CREATE POLICY "Admins can delete any item"
ON public.items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);
