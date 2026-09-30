"""Convert API input, run DES, and build response models."""
from app.crypto.des import crypt_block
from app.crypto.key_schedule import expand_key
from app.crypto.tables import PC1, PC2, SHIFTS
from app.schemas.des import (
    BlockInput,
    DecryptRequest,
    DecryptResponse,
    EncryptRequest,
    EncryptResponse,
    KeyScheduleRequest,
    KeyScheduleResponse,
    KeyScheduleRound,
)


def block_bytes(block: BlockInput) -> bytes:
    if block.format == "hex":
        return bytes.fromhex(block.value)
    return block.value.encode("utf-8")


def encrypt(request: EncryptRequest) -> EncryptResponse:
    plaintext = block_bytes(request.plaintext)
    ciphertext = crypt_block(plaintext, block_bytes(request.key))
    return EncryptResponse(
        algorithm="DES",
        operation="encrypt",
        plaintextHex=plaintext.hex().upper(),
        ciphertextHex=ciphertext.hex().upper(),
    )


def decrypt(request: DecryptRequest) -> DecryptResponse:
    ciphertext = bytes.fromhex(request.ciphertextHex)
    plaintext = crypt_block(ciphertext, block_bytes(request.key), decrypt=True)
    try:
        text = plaintext.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        text = None
    return DecryptResponse(
        algorithm="DES",
        operation="decrypt",
        plaintextHex=plaintext.hex().upper(),
        plaintextText=text,
    )


def key_schedule(request: KeyScheduleRequest) -> KeyScheduleResponse:
    key = block_bytes(request.key)
    pc1, rounds = expand_key(key)
    return KeyScheduleResponse(
        algorithm="DES",
        operation="key-schedule",
        inputKeyBinary=f"{int.from_bytes(key, 'big'):064b}",
        inputKeyHex=key.hex().upper(),
        pc1Table=list(PC1),
        pc1Output=f"{pc1:056b}",
        c0=f"{pc1 >> 28:028b}",
        d0=f"{pc1 & 0xFFFFFFF:028b}",
        shiftSchedule=list(SHIFTS),
        rounds=[
            KeyScheduleRound(
                round=round_key.round,
                shift=round_key.shift,
                c=f"{round_key.c:028b}",
                d=f"{round_key.d:028b}",
                subkeyBinary=f"{round_key.subkey:048b}",
                subkeyHex=f"{round_key.subkey:012X}",
            )
            for round_key in rounds
        ],
        pc2Table=list(PC2),
    )
