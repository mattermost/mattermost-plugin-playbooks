// This file is automatically generated. Do not modify it manually.

const manifest = JSON.parse(`
{
    "id": "com.mattermost.plugin-incident-response",
    "name": "Incident Response",
    "description": "This plugin allows users to coordinate and manage incidents within Mattermost.",
    "version": "0.5.0",
    "min_server_version": "5.28.0",
    "server": {
        "executables": {
            "linux-amd64": "server/dist/plugin-linux-amd64",
            "darwin-amd64": "server/dist/plugin-darwin-amd64",
            "windows-amd64": "server/dist/plugin-windows-amd64.exe"
        },
        "executable": ""
    },
    "webapp": {
        "bundle_path": "webapp/dist/main.js"
    },
    "settings_schema": {
        "header": "",
        "footer": "",
        "settings": []
    }
}
`);

export default manifest;
export const id = manifest.id;
export const version = manifest.version;
export const pluginId = manifest.id;
