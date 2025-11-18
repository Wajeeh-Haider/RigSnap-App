-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Requests table policies
CREATE POLICY "Users can view all requests" ON public.requests
  FOR SELECT USING (true);

CREATE POLICY "Truckers can insert their own requests" ON public.requests
  FOR INSERT WITH CHECK (auth.uid() = trucker_id);

CREATE POLICY "Truckers can update their own requests" ON public.requests
  FOR UPDATE USING (auth.uid() = trucker_id);

CREATE POLICY "Providers can update requests they're involved in" ON public.requests
  FOR UPDATE USING (auth.uid() = provider_id);

-- Chats table policies
CREATE POLICY "Users can view chats they're part of" ON public.chats
  FOR SELECT USING (auth.uid() = trucker_id OR auth.uid() = provider_id);

CREATE POLICY "System can insert chats" ON public.chats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update chats they're part of" ON public.chats
  FOR UPDATE USING (auth.uid() = trucker_id OR auth.uid() = provider_id);

-- Messages table policies
CREATE POLICY "Users can view messages in their chats" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.request_id = messages.request_id
      AND (chats.trucker_id = auth.uid() OR chats.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their chats" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.request_id = messages.request_id
      AND (chats.trucker_id = auth.uid() OR chats.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can update messages they sent" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can update read status of messages in their chats" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.request_id = messages.request_id
      AND (chats.trucker_id = auth.uid() OR chats.provider_id = auth.uid())
    )
  );

-- Leads table policies
CREATE POLICY "Users can view their own leads" ON public.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert leads" ON public.leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own leads" ON public.leads
  FOR UPDATE USING (auth.uid() = user_id);

-- Payment methods table policies
CREATE POLICY "Users can view their own payment methods" ON public.payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods" ON public.payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods" ON public.payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods" ON public.payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- Payment transactions table policies
CREATE POLICY "Users can view their own transactions" ON public.payment_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON public.payment_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update transactions" ON public.payment_transactions
  FOR UPDATE USING (true);