package api

import (
	"math"
	"net/http"
	"net/url"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type StatsHandler struct {
	*ErrorHandler
	pluginAPI       *pluginapi.Client
	log             bot.Logger
	statsStore      *sqlstore.StatsStore
	playbookService app.PlaybookService
	permissions     *app.PermissionsService
	licenseChecker  app.LicenseChecker
}

func NewStatsHandler(router *mux.Router, api *pluginapi.Client, log bot.Logger, statsStore *sqlstore.StatsStore, playbookService app.PlaybookService, permissions *app.PermissionsService, licenseChecker app.LicenseChecker) *StatsHandler {
	handler := &StatsHandler{
		ErrorHandler:    &ErrorHandler{log: log},
		pluginAPI:       api,
		log:             log,
		statsStore:      statsStore,
		playbookService: playbookService,
		permissions:     permissions,
		licenseChecker:  licenseChecker,
	}

	statsRouter := router.PathPrefix("/stats").Subrouter()
	statsRouter.HandleFunc("/playbook", handler.playbookStats).Methods(http.MethodGet)

	return handler
}

type PlaybookStats struct {
	RunsInProgress                int       `json:"runs_in_progress"`
	ParticipantsActive            int       `json:"participants_active"`
	RunsFinishedPrev30Days        int       `json:"runs_finished_prev_30_days"`
	RunsFinishedPercentageChange  int       `json:"runs_finished_percentage_change"`
	RunsStartedPerWeek            []int     `json:"runs_started_per_week"`
	RunsStartedPerWeekTimes       [][]int64 `json:"runs_started_per_week_times"`
	ActiveRunsPerDay              []int     `json:"active_runs_per_day"`
	ActiveRunsPerDayTimes         [][]int64 `json:"active_runs_per_day_times"`
	ActiveParticipantsPerDay      []int     `json:"active_participants_per_day"`
	ActiveParticipantsPerDayTimes [][]int64 `json:"active_participants_per_day_times"`
	MetricOverallAverage          []int64   `json:"metric_overall_average"`
	MetricRollingAverage          []int64   `json:"metric_rolling_average"`
	MetricRollingAverageChange    []int64   `json:"metric_rolling_average_change"`
	MetricValueRange              [][]int64 `json:"metric_value_range"`
	MetricRollingValues           [][]int64 `json:"metric_rolling_values"`
	LastXRunNames                 []string  `json:"last_x_run_names"`
}

const (
	MetricChartPeriod          = 10
	MetricRollingAveragePeriod = 10
)

func parsePlaybookStatsFilters(u *url.URL) (*sqlstore.StatsFilters, error) {
	playbookID := u.Query().Get("playbook_id")
	if playbookID == "" {
		return nil, errors.New("bad parameter 'playbook_id'; 'playbook_id' is required")
	}

	return &sqlstore.StatsFilters{
		PlaybookID: playbookID,
	}, nil
}

func (h *StatsHandler) playbookStats(w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.StatsAllowed() {
		h.HandleErrorWithCode(w, http.StatusForbidden, "timeline feature is not covered by current server license", nil)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	filters, err := parsePlaybookStatsFilters(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad filters", err)
		return
	}

	if !h.PermissionsCheck(w, h.permissions.PlaybookView(userID, filters.PlaybookID)) {
		return
	}

	runsFinishedLast30Days := h.statsStore.RunsFinishedBetweenDays(filters, 30, 0)
	runsFinishedBetween60and30DaysAgo := h.statsStore.RunsFinishedBetweenDays(filters, 60, 31)
	var percentageChange int
	if runsFinishedBetween60and30DaysAgo == 0 {
		percentageChange = 99999999
	} else {
		percentageChange = int(math.Floor(float64((runsFinishedLast30Days-runsFinishedBetween60and30DaysAgo)/runsFinishedBetween60and30DaysAgo) * 100))
	}
	runsStartedPerWeek, runsStartedPerWeekTimes := h.statsStore.RunsStartedPerWeekLastXWeeks(12, filters)
	activeRunsPerDay, activeRunsPerDayTimes := h.statsStore.ActiveRunsPerDayLastXDays(14, filters)
	activeParticipantsPerDay, activeParticipantsPerDayTimes := h.statsStore.ActiveParticipantsPerDayLastXDays(14, filters)

	metricOverallAverage := h.statsStore.MetricOverallAverage(filters)
	metricRollingValues, lastXRunNames := h.statsStore.MetricRollingValuesLastXRuns(MetricChartPeriod, 0, filters)
	metricRollingAverage, metricRollingAverageChange := h.statsStore.MetricRollingAverageAndChange(MetricRollingAveragePeriod, filters)
	metricValueRange := h.statsStore.MetricValueRange(filters)

	ReturnJSON(w, &PlaybookStats{
		RunsInProgress:                h.statsStore.TotalInProgressPlaybookRuns(filters),
		ParticipantsActive:            h.statsStore.TotalActiveParticipants(filters),
		RunsFinishedPrev30Days:        runsFinishedLast30Days,
		RunsFinishedPercentageChange:  percentageChange,
		RunsStartedPerWeek:            runsStartedPerWeek,
		RunsStartedPerWeekTimes:       runsStartedPerWeekTimes,
		ActiveRunsPerDay:              activeRunsPerDay,
		ActiveRunsPerDayTimes:         activeRunsPerDayTimes,
		ActiveParticipantsPerDay:      activeParticipantsPerDay,
		ActiveParticipantsPerDayTimes: activeParticipantsPerDayTimes,
		MetricOverallAverage:          metricOverallAverage,
		MetricRollingValues:           metricRollingValues,
		MetricValueRange:              metricValueRange,
		MetricRollingAverage:          metricRollingAverage,
		MetricRollingAverageChange:    metricRollingAverageChange,
		LastXRunNames:                 lastXRunNames,
	}, http.StatusOK)
}
