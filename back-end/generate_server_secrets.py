import secrets
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

# Generate keypair
private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

# convert the keys to strings
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
).decode('utf-8')

public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
).decode('utf-8')

# Generate OPRF seed
oprf_seed = secrets.token_hex(32)

# print everything
print("=== AKE Keypair ===")
print("Private:")
print(private_pem)
print("\n Public:")
print(public_pem)
print("\n OPRF Seed:")
print(oprf_seed)