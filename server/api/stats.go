package api

import (
	"net/http"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore"
)

type StatsHandler struct {
	pluginAPI  *pluginapi.Client
	log        bot.Logger
	statsStore *sqlstore.StatsStore
}

func NewStatsHandler(router *mux.Router, api *pluginapi.Client, log bot.Logger, statsStore *sqlstore.StatsStore) *StatsHandler {
	handler := &StatsHandler{
		pluginAPI:  api,
		log:        log,
		statsStore: statsStore,
	}

	statsRouter := router.PathPrefix("/stats").Subrouter()
	statsRouter.HandleFunc("", handler.stats).Methods(http.MethodGet)

	return handler
}

type Stats struct {
	TotalActiveIncidents                              int                    `json:"total_active_incidents"`
	TotalActiveParticipants                           int                    `json:"total_active_participants"`
	AverageDurationActiveIncidentsMinutes             int                    `json:"average_duration_active_incidents_minutes"`
	AverageReportedToActiveTimeActiveIncidentsMinutes int                    `json:"average_reported_to_active_time_minutes"`
	PlaybookUses                                      []sqlstore.PlaybookUse `json:"playbook_uses"`
	ActiveIncidentsOverTime                           []int                  `json:"active_incidents_over_time"`
}

func (h *StatsHandler) stats(w http.ResponseWriter, r *http.Request) {
	stats := Stats{
		TotalActiveIncidents:                              h.statsStore.GetTotalActiveIncidents(),
		TotalActiveParticipants:                           h.statsStore.GetTotalActiveParticipants(),
		AverageDurationActiveIncidentsMinutes:             h.statsStore.GetAverageDurationActiveIncidentsMinutes(),
		AverageReportedToActiveTimeActiveIncidentsMinutes: 20,
		PlaybookUses:            h.statsStore.GetPlaybookUses(),
		ActiveIncidentsOverTime: h.statsStore.GetActiveIncidentsOverTime(),
	}

	ReturnJSON(w, stats, http.StatusOK)
}
