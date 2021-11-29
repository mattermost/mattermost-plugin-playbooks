package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// SettingsHandler is the API handler.
type SettingsHandler struct {
	*ErrorHandler
	pluginAPI *pluginapi.Client
	log       bot.Logger
	config    config.Service
}

// NewSettingsHandler returns a new settings api handler
func NewSettingsHandler(router *mux.Router, api *pluginapi.Client, log bot.Logger, configService config.Service) *SettingsHandler {
	handler := &SettingsHandler{
		ErrorHandler: &ErrorHandler{log: log},
		pluginAPI:    api,
		log:          log,
		config:       configService,
	}

	settingsRouter := router.PathPrefix("/settings").Subrouter()
	settingsRouter.HandleFunc("", handler.getSettings).Methods(http.MethodGet)
	//settingsRouter.HandleFunc("", handler.setSettings).Methods(http.MethodPut)

	return handler
}

func (h *SettingsHandler) getSettings(w http.ResponseWriter, r *http.Request) {
	cfg := h.config.GetConfiguration()
	settings := client.GlobalSettings{
		EnableExperimentalFeatures: cfg.EnableExperimentalFeatures,
	}

	ReturnJSON(w, &settings, http.StatusOK)
}

/*
func (h *SettingsHandler) setSettings(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var settings client.GlobalSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode settings", err)
		return
	}

	pluginConfig := h.pluginAPI.Configuration.GetPluginConfig()
	if err := h.pluginAPI.Configuration.SavePluginConfig(pluginConfig); err != nil {
		h.HandleError(w, err)
	}

	w.WriteHeader(http.StatusOK)
}*/
