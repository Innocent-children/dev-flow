# Embedded WebUI assets

`scripts/build-webui.sh` owns `generated/` and writes the production Vite bundle there. The build clears that directory
before every run, emits content-hashed assets plus `manifest.json`, and uses this directory as the Go Core embed input.

`assets.go` embeds this boundary and the generated bundle into the Core binary. Runtime code reads embedded files; Node,
pnpm, Vite and an external asset service are build-time responsibilities only.

Edit frontend source under `packages/webui/` and regenerate the bundle through the repository build command. Generated
files record build output and are not a source-authority surface.
