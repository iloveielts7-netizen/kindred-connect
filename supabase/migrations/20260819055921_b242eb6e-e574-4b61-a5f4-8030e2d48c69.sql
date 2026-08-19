GRANT EXECUTE ON FUNCTION public.shares_connection(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_connection_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accepted_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(uuid, uuid) TO authenticated;