"""Request and response models for the DES endpoints."""

import re
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


def normalize_hex(value: str) -> str:
    normalized = re.sub(r"[ \t\r\n\f\v]", "", value)
    if re.fullmatch(r"[0-9a-fA-F]{16}", normalized) is None:
        raise ValueError("Hex must contain exactly 16 hexadecimal characters.")
    return normalized.upper()


class BlockInput(ContractModel):
    format: Literal["text", "hex"]
    value: str

    @model_validator(mode="after")
    def validate_block(self) -> Self:
        if self.format == "hex":
            self.value = normalize_hex(self.value)
        else:
            try:
                length = len(self.value.encode("utf-8", errors="strict"))
            except UnicodeEncodeError:
                raise ValueError("Text must be valid UTF-8.") from None
            if length != 8:
                raise ValueError("Text must encode to exactly 8 UTF-8 bytes.")
        return self


class EncryptRequest(ContractModel):
    plaintext: BlockInput
    key: BlockInput


class DecryptRequest(ContractModel):
    ciphertextHex: str
    key: BlockInput

    @field_validator("ciphertextHex")
    @classmethod
    def validate_ciphertext(cls, value: str) -> str:
        return normalize_hex(value)


class KeyScheduleRequest(ContractModel):
    key: BlockInput


Hex64 = Annotated[str, Field(pattern=r"^[0-9A-F]{16}$")]
Hex48 = Annotated[str, Field(pattern=r"^[0-9A-F]{12}$")]
Bits64 = Annotated[str, Field(pattern=r"^[01]{64}$")]
Bits56 = Annotated[str, Field(pattern=r"^[01]{56}$")]
Bits48 = Annotated[str, Field(pattern=r"^[01]{48}$")]
Bits28 = Annotated[str, Field(pattern=r"^[01]{28}$")]


class EncryptResponse(ContractModel):
    algorithm: Literal["DES"]
    operation: Literal["encrypt"]
    plaintextHex: Hex64
    ciphertextHex: Hex64


class DecryptResponse(ContractModel):
    algorithm: Literal["DES"]
    operation: Literal["decrypt"]
    plaintextHex: Hex64
    plaintextText: str | None


class KeyScheduleRound(ContractModel):
    round: Annotated[int, Field(ge=1, le=16)]
    shift: Literal[1, 2]
    c: Bits28
    d: Bits28
    subkeyBinary: Bits48
    subkeyHex: Hex48


class KeyScheduleResponse(ContractModel):
    algorithm: Literal["DES"]
    operation: Literal["key-schedule"]
    inputKeyBinary: Bits64
    inputKeyHex: Hex64
    pc1Table: Annotated[list[Annotated[int, Field(ge=1, le=64)]], Field(min_length=56, max_length=56)]
    pc1Output: Bits56
    c0: Bits28
    d0: Bits28
    shiftSchedule: Annotated[list[Literal[1, 2]], Field(min_length=16, max_length=16)]
    rounds: Annotated[list[KeyScheduleRound], Field(min_length=16, max_length=16)]
    pc2Table: Annotated[list[Annotated[int, Field(ge=1, le=56)]], Field(min_length=48, max_length=48)]


class ErrorDetail(ContractModel):
    path: str
    message: str


class ErrorInfo(ContractModel):
    code: Literal["VALIDATION_ERROR", "INVALID_JSON", "UNSUPPORTED_MEDIA_TYPE", "BACKEND_UNAVAILABLE", "BACKEND_TIMEOUT", "BACKEND_BAD_RESPONSE", "CONFIGURATION_ERROR", "INTERNAL_ERROR", "HTTP_ERROR"]
    message: str
    details: list[ErrorDetail]


class ErrorResponse(ContractModel):
    error: ErrorInfo
