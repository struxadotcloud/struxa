package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

func DecryptToken(ciphertext string) (string, error) {
	keyHex := os.Getenv("DATABASE_ENCRYPTION_KEY")
	if keyHex == "" {
		return "", fmt.Errorf("DATABASE_ENCRYPTION_KEY is not set")
	}
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", fmt.Errorf("invalid DATABASE_ENCRYPTION_KEY: %w", err)
	}

	parts := strings.SplitN(ciphertext, ":", 3)
	if len(parts) != 3 {
		return ciphertext, nil // not encrypted, return as-is
	}
	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return ciphertext, nil
	}
	tag, err := hex.DecodeString(parts[1])
	if err != nil {
		return ciphertext, nil
	}
	enc, err := hex.DecodeString(parts[2])
	if err != nil {
		return ciphertext, nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	combined := append(enc, tag...)
	plain, err := gcm.Open(nil, iv, combined, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt failed: %w", err)
	}
	return string(plain), nil
}
