REVOKE INSERT, UPDATE, DELETE ON public.user_vocabulary FROM anon, authenticated;
GRANT SELECT ON public.user_vocabulary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vocabulary TO service_role;

NOTIFY pgrst, 'reload schema';