-- Automatically mark the first payment method for a user as default.

CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.is_default, FALSE) = FALSE
       AND NOT EXISTS (
           SELECT 1
           FROM public.payment_methods
           WHERE user_id = NEW.user_id
             AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
       ) THEN
        NEW.is_default := TRUE;
    END IF;

    IF NEW.is_default = TRUE THEN
        UPDATE public.payment_methods
        SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;