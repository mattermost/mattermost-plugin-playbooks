package main

import (
	"archive/zip"
	"bytes"
	"context"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestGenerateSupportData(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	data, _, err := e.ServerAdminClient.GenerateSupportPacket(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, data)

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	require.NotNil(t, zr)

	f, err := zr.Open(path.Join(manifest.Id, "diagnostics.yaml"))
	require.NoError(t, err)
	require.NotNil(t, f)

	var sp SupportPacket
	err = yaml.NewDecoder(f).Decode(&sp)
	require.NoError(t, err)

	assert.Equal(t, manifest.Version, sp.Version)
	assert.Equal(t, int64(4), sp.TotalPlaybooks)
	assert.Equal(t, int64(3), sp.ActivePlaybooks)
	assert.Equal(t, int64(1), sp.TotalPlaybookRuns)
}
