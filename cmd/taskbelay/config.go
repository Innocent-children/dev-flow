package main

import (
	"encoding/json"
	"io"

	"github.com/Innocent-children/taskbelay/internal/userconfig"
)

const configValidationHelp = `Usage: taskbelay config validate

Read one UTF-8 configuration object (at most 16 KiB) from stdin.
Return {ok:true,result:<resolved Host preferences>} or
{ok:false,error:{code:"INVALID_CONFIGURATION",message:<reason>}} as JSON.
Exit 0 on success, 1 on invalid input. This command reads no configuration file,
Task store or Git state. An empty object uses Core defaults for every Host.
`

type configurationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func runConfigValidation(stdin io.Reader, stdout io.Writer) int {
	if stdin == nil || stdout == nil {
		return 1
	}
	fail := func(message string) int {
		_ = json.NewEncoder(stdout).Encode(struct {
			OK    bool               `json:"ok"`
			Error configurationError `json:"error"`
		}{Error: configurationError{Code: "INVALID_CONFIGURATION", Message: message}})
		return 1
	}
	raw, err := io.ReadAll(io.LimitReader(stdin, userconfig.MaxConfigBytes+1))
	if err != nil {
		return fail("configuration input could not be read")
	}
	preferences, err := userconfig.Decode(raw)
	if err != nil {
		return fail(err.Error())
	}
	if json.NewEncoder(stdout).Encode(struct {
		OK     bool                   `json:"ok"`
		Result userconfig.Preferences `json:"result"`
	}{OK: true, Result: preferences}) != nil {
		return 1
	}
	return 0
}
