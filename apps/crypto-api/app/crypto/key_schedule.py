"""DES key scheduling."""
from dataclasses import dataclass

from app.crypto.tables import PC1, PC2, SHIFTS


def permute(value: int, width: int, table: tuple[int, ...]) -> int:
    # DES table positions are 1-based, counting from the most significant bit (MSB).
    result = 0
    for position in table:
        result = (result << 1) | ((value >> (width - position)) & 1)
    return result


@dataclass(frozen=True)
class RoundKey:
    round: int
    shift: int
    c: int
    d: int
    subkey: int


def expand_key(key: bytes) -> tuple[int, tuple[RoundKey, ...]]:
    if len(key) != 8:
        raise ValueError("DES keys must contain exactly 8 bytes.")
    pc1 = permute(int.from_bytes(key, "big"), 64, PC1)
    c, d = pc1 >> 28, pc1 & 0xFFFFFFF
    rounds: list[RoundKey] = []
    for number, shift in enumerate(SHIFTS, 1):
        c = ((c << shift) | (c >> (28 - shift))) & 0xFFFFFFF
        d = ((d << shift) | (d >> (28 - shift))) & 0xFFFFFFF
        combined = (c << 28) | d
        subkey = permute(combined, 56, PC2)
        rounds.append(RoundKey(number, shift, c, d, subkey))
    return pc1, tuple(rounds)
