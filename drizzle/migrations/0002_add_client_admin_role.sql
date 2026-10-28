ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client_admin' AFTER 'ap_reviewer';

COMMENT ON TYPE public.app_role IS 'Roles: admin, user, ap_reviewer, client_admin. client_admin is reserved for the client vs platform split; no user holds it yet.';