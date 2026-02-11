"""
Routes package — domain-specific route modules extracted from server.py.

Each module defines a `router` (APIRouter) and a `setup(deps)` function.
server.py calls setup() then includes the router.

Pattern:
  from routes import watchtower
  watchtower.setup(supabase_admin=supabase_admin, ...)
  api_router.include_router(watchtower.router)
"""
