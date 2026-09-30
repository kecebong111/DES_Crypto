from fastapi import APIRouter

from app.schemas.des import (
    DecryptRequest, DecryptResponse, EncryptRequest, EncryptResponse,
    ErrorResponse, KeyScheduleRequest, KeyScheduleResponse,
)
from app.services import des_service

router = APIRouter(prefix="/des", tags=["DES"], responses={
    422: {"model": ErrorResponse},
})


@router.post("/encrypt", response_model=EncryptResponse)
def encrypt(request: EncryptRequest):
    return des_service.encrypt(request)


@router.post("/decrypt", response_model=DecryptResponse)
def decrypt(request: DecryptRequest):
    return des_service.decrypt(request)


@router.post("/key-schedule", response_model=KeyScheduleResponse)
def key_schedule(request: KeyScheduleRequest):
    return des_service.key_schedule(request)
