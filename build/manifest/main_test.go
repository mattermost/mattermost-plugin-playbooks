// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const validSourceManifest = `{
  "id": "playbooks",
  "name": "Playbooks",
  "description": "Mattermost Playbooks enable reliable and repeatable processes for your teams.",
  "homepage_url": "https://github.com/mattermost/mattermost-plugin-playbooks/",
  "support_url": "https://github.com/mattermost/mattermost-plugin-playbooks/issues",
  "icon_path": "assets/plugin_icon.svg",
  "min_server_version": "11.9.0"
}`

func TestReadManifestRejectsHardcodedVersion(t *testing.T) {
	t.Run("version omitted", func(t *testing.T) {
		withBuildVersion(t)
		manifest, err := readManifest(writeManifest(t, validSourceManifest))
		if err != nil {
			t.Fatalf("readManifest failed: %v", err)
		}
		if manifest.Version != "0.0.0+abcdef0" {
			t.Fatalf("expected generated version 0.0.0+abcdef0, got %q", manifest.Version)
		}
		if manifest.Id != "playbooks" {
			t.Fatalf("expected manifest id playbooks, got %q", manifest.Id)
		}
		if manifest.Name != "Playbooks" {
			t.Fatalf("expected manifest name Playbooks, got %q", manifest.Name)
		}
	})

	for _, tc := range []struct {
		name     string
		manifest string
	}{
		{
			name:     "version string",
			manifest: strings.Replace(validSourceManifest, "{", `{"version": "9.9.9",`, 1),
		},
		{
			name:     "version null",
			manifest: strings.Replace(validSourceManifest, "{", `{"version": null,`, 1),
		},
		{
			name:     "version key case variant",
			manifest: strings.Replace(validSourceManifest, "{", `{"Version": "9.9.9",`, 1),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := readManifest(writeManifest(t, tc.manifest))
			requireErrorContains(t, err, "plugin.json must not contain a hardcoded version")
		})
	}
}

func TestReadManifestRejectsUnknownFields(t *testing.T) {
	withBuildVersion(t)
	manifestPath := writeManifest(t, strings.Replace(validSourceManifest, "{", `{"unexpected": true,`, 1))

	_, err := readManifest(manifestPath)
	requireErrorContains(t, err, "json: unknown field \"unexpected\"")
}

func writeManifest(t *testing.T, contents string) string {
	t.Helper()

	manifestPath := filepath.Join(t.TempDir(), "plugin.json")
	if err := os.WriteFile(manifestPath, []byte(contents+"\n"), 0600); err != nil {
		t.Fatalf("failed to write test manifest: %v", err)
	}
	return manifestPath
}

func requireErrorContains(t *testing.T, err error, want string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected error containing %q, got nil", want)
	}
	if !strings.Contains(err.Error(), want) {
		t.Fatalf("expected error containing %q, got %q", want, err.Error())
	}
}

func withBuildVersion(t *testing.T) {
	t.Helper()

	oldHashShort := BuildHashShort
	oldTagLatest := BuildTagLatest
	oldTagCurrent := BuildTagCurrent

	BuildHashShort = "abcdef0"
	BuildTagLatest = ""
	BuildTagCurrent = ""

	t.Cleanup(func() {
		BuildHashShort = oldHashShort
		BuildTagLatest = oldTagLatest
		BuildTagCurrent = oldTagCurrent
	})
}
