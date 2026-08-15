REVOKE ALL ON FUNCTION public.is_connection_member(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_accepted_member(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.shares_connection(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_blocked_pair(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.limit_connection_requests() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_by_stress_id(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_by_stress_id(text) TO authenticated;