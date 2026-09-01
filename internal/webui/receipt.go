package webui

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const runtimeReceiptName = "webui-runtime.json"

type RuntimeReceipt struct {
	PID                  int       `json:"pid"`
	ProcessStartIdentity string    `json:"process_start_identity"`
	DataRootDigest       string    `json:"data_root_digest"`
	URL                  string    `json:"url"`
	CreatedAt            time.Time `json:"created_at"`
}

func ReceiptPath(dataDirectory string) string {
	return filepath.Join(dataDirectory, runtimeReceiptName)
}

func DataRootDigest(dataDirectory string) (string, error) {
	canonical, err := filepath.EvalSymlinks(dataDirectory)
	if err != nil {
		return "", err
	}
	absolute, err := filepath.Abs(canonical)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(filepath.Clean(absolute)))
	return hex.EncodeToString(digest[:]), nil
}

func ReadReceipt(dataDirectory string) (RuntimeReceipt, error) {
	path := ReceiptPath(dataDirectory)
	info, err := os.Lstat(path)
	if err != nil {
		return RuntimeReceipt{}, err
	}
	if !validRuntimeReceiptFile(info) {
		return RuntimeReceipt{}, fmt.Errorf("invalid WebUI runtime receipt")
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return RuntimeReceipt{}, err
	}
	var receipt RuntimeReceipt
	decoder := json.NewDecoder(strings.NewReader(string(content)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&receipt); err != nil || receipt.PID <= 0 || receipt.ProcessStartIdentity == "" || len(receipt.DataRootDigest) != 64 || !strings.HasPrefix(receipt.URL, "http://127.0.0.1:") || receipt.CreatedAt.IsZero() {
		return RuntimeReceipt{}, fmt.Errorf("invalid WebUI runtime receipt")
	}
	return receipt, nil
}

func writeReceipt(dataDirectory string, receipt RuntimeReceipt) error {
	content, err := json.Marshal(receipt)
	if err != nil {
		return err
	}
	path := ReceiptPath(dataDirectory)
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	ok := false
	defer func() {
		_ = file.Close()
		if !ok {
			_ = os.Remove(path)
		}
	}()
	if _, err := file.Write(append(content, '\n')); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	ok = true
	return nil
}

func removeReceipt(dataDirectory string, expected RuntimeReceipt) error {
	current, err := ReadReceipt(dataDirectory)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if current.PID != expected.PID || current.ProcessStartIdentity != expected.ProcessStartIdentity || current.URL != expected.URL {
		return fmt.Errorf("WebUI runtime receipt changed")
	}
	return os.Remove(ReceiptPath(dataDirectory))
}

func receiptProcessMatches(receipt RuntimeReceipt) bool {
	identity, err := processStartIdentity(receipt.PID)
	return err == nil && identity == receipt.ProcessStartIdentity
}
