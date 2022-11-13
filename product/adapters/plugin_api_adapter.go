package adapters

import (
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/sirupsen/logrus"
)

type PluginAPIAdapter struct {
	configService product.ConfigService
	id            string

	// ctx      *request.Context
	// logger   mlog.Sugar
	manifest *model.Manifest
}

func NewPluginAPIAdapter(pluginId string, configService product.ConfigService, manifest *model.Manifest) *PluginAPIAdapter {
	return &PluginAPIAdapter{
		configService: configService,
		id:            pluginId,
		manifest:      manifest,
	}
}

// ####### Config API #######
func (api *PluginAPIAdapter) LoadPluginConfiguration(dest any) error {
	finalConfig := make(map[string]any)

	// First set final config to defaults
	if api.manifest.SettingsSchema != nil {
		for _, setting := range api.manifest.SettingsSchema.Settings {
			finalConfig[strings.ToLower(setting.Key)] = setting.Default
		}
	}

	// If we have settings given we override the defaults with them
	for setting, value := range api.configService.Config().PluginSettings.Plugins[api.id] {
		finalConfig[strings.ToLower(setting)] = value
	}

	pluginSettingsJsonBytes, err := json.Marshal(finalConfig)
	if err != nil {
		logrus.WithError(err).Error("Error marshaling config for plugin", mlog.Err(err))
		return nil
	}
	err = json.Unmarshal(pluginSettingsJsonBytes, dest)
	if err != nil {
		logrus.WithError(err).Error("Error unmarshaling config for plugin", mlog.Err(err))
	}
	return nil
}

func (api *PluginAPIAdapter) SavePluginConfig(pluginConfig map[string]any) *model.AppError {
	cfg := api.GetConfig()
	cfg.PluginSettings.Plugins[api.manifest.Id] = pluginConfig
	_, _, err := api.configService.SaveConfig(cfg, true)

	return err
}

func (api *PluginAPIAdapter) GetConfig() *model.Config {
	cfg := api.configService.Config().Clone()
	cfg.Sanitize()

	return cfg
}

// ####### System API #######

func (api *PluginAPIAdapter) GetServerVersion() string {
	return model.CurrentVersion
}
