-- Allow providers to read trucker request authorizations needed for capture
-- at acceptance time. Without this, providers cannot see trucker auth intents
-- due to RLS and acceptance fails after trucker removes their saved card.

CREATE POLICY "Providers can view trucker request authorizations for visible requests"
ON public.payment_transactions
FOR SELECT
USING (
  transaction_type = 'request_fee'
  AND user_role = 'trucker'
  AND request_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'provider'
  )
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = payment_transactions.request_id
      AND (
        -- open request providers can accept
        (r.status = 'pending' AND r.provider_id IS NULL)
        -- or request already tied to this provider (retry/reload scenarios)
        OR r.provider_id = auth.uid()
      )
  )
);
