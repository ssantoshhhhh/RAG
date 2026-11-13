import hmac

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings
from app.core.security import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER, REFRESH_COOKIE

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
}


class SecurityMiddleware(BaseHTTPMiddleware):
    """CSRF double-submit protection, origin checks and security headers."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        settings = get_settings()
        path = request.url.path
        method = request.method.upper()

        if method in UNSAFE_METHODS and path.startswith("/api/v1"):
            origin = request.headers.get("origin")
            if origin and origin.rstrip("/") not in settings.cors_origin_list:
                return JSONResponse(status_code=403, content={"detail": "Origin is not allowed"})

            if path not in CSRF_EXEMPT_PATHS:
                has_session = ACCESS_COOKIE in request.cookies or REFRESH_COOKIE in request.cookies
                if has_session:
                    cookie_token = request.cookies.get(CSRF_COOKIE)
                    header_token = request.headers.get(CSRF_HEADER)
                    if (
                        not cookie_token
                        or not header_token
                        or not hmac.compare_digest(cookie_token, header_token)
                    ):
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "CSRF token missing or invalid"},
                        )

        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        return response
