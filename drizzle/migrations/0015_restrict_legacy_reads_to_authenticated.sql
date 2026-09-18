REVOKE SELECT ON TABLE public.activities FROM PUBLIC, anon;
REVOKE SELECT ON TABLE public.progress FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.activities TO authenticated;
GRANT SELECT ON TABLE public.progress TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;
GRANT ALL ON TABLE public.progress TO service_role;
NOTIFY pgrst, 'reload schema';