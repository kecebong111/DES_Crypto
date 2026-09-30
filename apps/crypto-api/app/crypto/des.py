"""Single-block DES encryption and decryption."""
from app.crypto.key_schedule import expand_key, permute
from app.crypto.tables import E, FP, IP, P, SBOXES


def feistel(right: int, subkey: int) -> int:
    expanded = permute(right, 32, E) ^ subkey
    substituted = 0
    for index, box in enumerate(SBOXES):
        chunk = (expanded >> (42 - 6 * index)) & 0x3F
        # The first and last bits select the row. The middle four select the column.
        row = ((chunk >> 4) & 2) | (chunk & 1)
        column = (chunk >> 1) & 15
        substituted = (substituted << 4) | box[row][column]
    return permute(substituted, 32, P)


def crypt_block(block: bytes, key: bytes, *, decrypt: bool = False) -> bytes:
    if len(block) != 8:
        raise ValueError("DES blocks must contain exactly 8 bytes.")
    _, rounds = expand_key(key)
    state = permute(int.from_bytes(block, "big"), 64, IP)
    left, right = state >> 32, state & 0xFFFFFFFF
    for round_key in reversed(rounds) if decrypt else rounds:
        left, right = right, left ^ feistel(right, round_key.subkey)
    # DES swaps the two halves before applying the final permutation.
    output = permute((right << 32) | left, 64, FP)
    return output.to_bytes(8, "big")
