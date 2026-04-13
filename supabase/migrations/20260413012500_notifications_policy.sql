-- Allow public insert notifications
CREATE POLICY "Allow public insert notifications"
ON public.notifications
FOR INSERT TO public
WITH CHECK (true);