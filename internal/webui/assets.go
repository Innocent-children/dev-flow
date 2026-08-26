package webui

import "embed"

// Assets contains the WebUI source boundary documentation and generated production bundle.
//
//go:embed assets
var Assets embed.FS
