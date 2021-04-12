package api

import (
	"net/http"
	"net/url"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type StatsHandler struct {
	pluginAPI  *pluginapi.Client
	log        bot.Logger
	statsStore *sqlstore.StatsStore
}

func NewStatsHandler(router *mux.Router, api *pluginapi.Client, log bot.Logger, statsStore *sqlstore.StatsStore, config config.Service) *StatsHandler {
	handler := &StatsHandler{
		pluginAPI:  api,
		log:        log,
		statsStore: statsStore,
	}

	e20Middleware := E20LicenseRequired{config}

	statsRouter := router.PathPrefix("/stats").Subrouter()
	statsRouter.Use(e20Middleware.Middleware)
	statsRouter.HandleFunc("", handler.stats).Methods(http.MethodGet)

	return handler
}

type Stats struct {
	TotalReportedIncidents                int `json:"total_reported_incidents"`
	TotalActiveIncidents                  int `json:"total_active_incidents"`
	TotalActiveParticipants               int `json:"total_active_participants"`
	AverageDurationActiveIncidentsMinutes int `json:"average_duration_active_incidents_minutes"`

	ActiveIncidents        []int `json:"active_incidents"`
	PeopleInIncidents      []int `json:"people_in_incidents"`
	AverageStartToActive   []int `json:"average_start_to_active"`
	AverageStartToResolved []int `json:"average_start_to_resolved"`
}

func parseStatsFilters(u *url.URL) (*sqlstore.StatsFilters, error) {
	teamID := u.Query().Get("team_id")
	if teamID == "" {
		return nil, errors.New("bad parameter 'team_id'; 'team_id' is required")
	}

	return &sqlstore.StatsFilters{
		TeamID: teamID,
	}, nil
}

func (h *StatsHandler) stats(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filters, err := parseStatsFilters(r.URL)
	if err != nil {
		HandleErrorWithCode(w, http.StatusBadRequest, "Bad filters", err)
		return
	}

	if !h.pluginAPI.User.HasPermissionToTeam(userID, filters.TeamID, model.PERMISSION_LIST_TEAM_CHANNELS) {
		HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s", userID, filters.TeamID))
		return
	}

	stats := Stats{
		TotalReportedIncidents:                h.statsStore.TotalReportedIncidents(filters),
		TotalActiveIncidents:                  h.statsStore.TotalActiveIncidents(filters),
		TotalActiveParticipants:               h.statsStore.TotalActiveParticipants(filters),
		AverageDurationActiveIncidentsMinutes: h.statsStore.AverageDurationActiveIncidentsMinutes(filters),

		ActiveIncidents:        h.statsStore.CountActiveIncidentsByDay(filters),
		PeopleInIncidents:      h.statsStore.UniquePeopleInIncidents(filters),
		AverageStartToActive:   h.statsStore.AverageStartToActive(filters),
		AverageStartToResolved: h.statsStore.AverageStartToResolved(filters),
	}

	ReturnJSON(w, stats, http.StatusOK)
}
