from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.config import settings
from app.routers import des, health

app = FastAPI(title=settings.app_name, version="0.1.0")
app.include_router(health.router)
app.include_router(des.router)


def error_response(status: int, code: str, message: str, details=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details or []}},
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Return field errors without including the submitted values.
    allowed = {"body", "plaintext", "key", "ciphertextHex", "format", "value"}
    details = [{
        "path": ".".join(str(part) if part in allowed else "unknown" for part in error["loc"]),
        "message": error["msg"] if error["type"] == "value_error" else "Invalid or missing field.",
    } for error in exc.errors()]
    return error_response(422, "VALIDATION_ERROR", "Request validation failed.", details)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return error_response(exc.status_code, "HTTP_ERROR", "HTTP request could not be processed.")


@app.exception_handler(Exception)
async def internal_error(request: Request, exc: Exception):
    return error_response(500, "INTERNAL_ERROR", "An internal error occurred.")
