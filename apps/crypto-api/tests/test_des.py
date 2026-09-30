import random
import unittest

from pydantic import ValidationError

from app.crypto.des import crypt_block
from app.schemas.des import BlockInput, DecryptRequest, EncryptRequest, KeyScheduleRequest
from app.services import des_service as service


class DesTests(unittest.TestCase):
    def test_known_vectors(self):
        for plaintext, key, ciphertext in [
            ("0123456789ABCDEF", "133457799BBCDFF1", "85E813540F0AB405"),
            ("0000000000000000", "0000000000000000", "8CA64DE9C1B123A7"),
        ]:
            with self.subTest(key=key):
                request = EncryptRequest.model_validate({"plaintext": {"format": "hex", "value": plaintext}, "key": {"format": "hex", "value": key}})
                self.assertEqual(service.encrypt(request).ciphertextHex, ciphertext)
                result = service.decrypt(DecryptRequest(ciphertextHex=ciphertext, key=request.key))
                self.assertEqual(result.plaintextHex, plaintext)

    def test_full_schedule(self):
        trace = service.key_schedule(KeyScheduleRequest(key=BlockInput(format="hex", value="133457799BBCDFF1")))
        self.assertEqual(trace.rounds[0].subkeyHex, "1B02EFFC7072")
        self.assertEqual(trace.rounds[-1].subkeyHex, "CB3D8B0E17F5")
        self.assertEqual(trace.pc1Output, "11110000110011001010101011110101010101100110011110001111")
        self.assertEqual(trace.c0 + trace.d0, trace.pc1Output)
        c, d = trace.c0, trace.d0
        for i, r in enumerate(trace.rounds):
            self.assertEqual(r.round, i + 1)
            c, d = c[r.shift:] + c[:r.shift], d[r.shift:] + d[:r.shift]
            self.assertEqual((r.c, r.d), (c, d))
            self.assertEqual(r.subkeyBinary, "".join((c + d)[p - 1] for p in trace.pc2Table))
            self.assertEqual(int(r.subkeyHex, 16), int(r.subkeyBinary, 2))
        self.assertEqual((c, d), (trace.c0, trace.d0))

    def test_roundtrips(self):
        rng = random.Random(42)
        for _ in range(64):
            block, key = rng.randbytes(8), rng.randbytes(8)
            self.assertEqual(crypt_block(crypt_block(block, key), key, decrypt=True), block)

    def test_text_and_invalid_utf8(self):
        key = BlockInput(format="text", value="ABCDEFGH")
        for value in ("ABCDEFGH", "éééé"):
            encrypted = service.encrypt(EncryptRequest(plaintext=BlockInput(format="text", value=value), key=key))
            decoded = service.decrypt(DecryptRequest(ciphertextHex=encrypted.ciphertextHex, key=key))
            self.assertEqual(decoded.plaintextText, value)
        encrypted = service.encrypt(EncryptRequest(plaintext=BlockInput(format="hex", value="FF00000000000000"), key=key))
        decoded = service.decrypt(DecryptRequest(ciphertextHex=encrypted.ciphertextHex, key=key))
        self.assertIsNone(decoded.plaintextText)
        self.assertEqual(decoded.plaintextHex, "FF00000000000000")

    def test_leading_zeros_and_parity(self):
        traces = [service.key_schedule(KeyScheduleRequest(key=BlockInput(format="hex", value=k))) for k in ("0000000000000000", "0101010101010101")]
        self.assertNotEqual(traces[0].inputKeyHex, traces[1].inputKeyHex)
        self.assertEqual(traces[0].rounds, traces[1].rounds)
        self.assertEqual(traces[0].inputKeyBinary, "0" * 64)
        self.assertTrue(all(r.subkeyHex == "0" * 12 and r.subkeyBinary == "0" * 48 for r in traces[0].rounds))
        self.assertEqual(crypt_block(bytes(8), bytes(8)), crypt_block(bytes(8), b"\x01" * 8))
        self.assertEqual(crypt_block(crypt_block(b"\0" * 7 + b"\x01", bytes(8)), bytes(8), decrypt=True), b"\0" * 7 + b"\x01")

    def test_validation(self):
        for fmt, values in [("hex", ["", "0" * 15, "0" * 17, "G" * 16, "0x0123456789ABCDEF", "\u00a0" + "0" * 16]), ("text", ["", "ABCDEFG", "ABCDEFGHI", "é" * 8, "\ud800ABCDEFG"])]:
            for value in values:
                with self.subTest(value=repr(value)), self.assertRaises(ValidationError):
                    BlockInput(format=fmt, value=value)
        for value in ("0", "Z" * 16):
            with self.assertRaises(ValidationError):
                DecryptRequest(ciphertextHex=value, key=BlockInput(format="hex", value="0" * 16))
        self.assertEqual(BlockInput(format="hex", value="01 23\t45\r67\n89\fab\vcd ef").value, "0123456789ABCDEF")
        for block, key in [(b"", bytes(8)), (bytes(8), b"")]:
            with self.assertRaises(ValueError):
                crypt_block(block, key)


if __name__ == "__main__":
    unittest.main()
