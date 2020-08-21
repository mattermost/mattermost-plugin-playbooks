package main

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

func TestIsLicensed(t *testing.T) {
	t.Run("nil license features", func(t *testing.T) {
		assert.False(t, isLicensed(nil, &model.License{}))
	})

	t.Run("nil future features", func(t *testing.T) {
		assert.False(t, isLicensed(nil, &model.License{Features: &model.Features{}}))
	})

	t.Run("disabled future features", func(t *testing.T) {
		assert.False(t, isLicensed(nil, &model.License{Features: &model.Features{
			FutureFeatures: bToP(false),
		}}))
	})

	t.Run("enabled future features", func(t *testing.T) {
		assert.True(t, isLicensed(nil, &model.License{Features: &model.Features{
			FutureFeatures: bToP(true),
		}}))
	})

	t.Run("no license, no config", func(t *testing.T) {
		assert.False(t, isLicensed(nil, nil))
	})

	t.Run("no license, nil config", func(t *testing.T) {
		assert.False(t, isLicensed(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: nil, EnableTesting: nil}},
			nil,
		))
	})

	t.Run("no license, only developer mode", func(t *testing.T) {
		assert.False(t, isLicensed(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(false)}},
			nil,
		))
	})

	t.Run("no license, only developer mode", func(t *testing.T) {
		assert.False(t, isLicensed(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(false), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("no license, developer and testing mode", func(t *testing.T) {
		assert.True(t, isLicensed(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(true)}},
			nil,
		))
	})
}

func bToP(b bool) *bool {
	return &b
}
