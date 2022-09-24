package api

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/graph-gophers/graphql-go/errors"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app/transform"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

type LocalHandler struct {
	*ErrorHandler
	localRouter        *mux.Router
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	pluginAPI          *pluginapi.Client
	config             config.Service
	permissions        *app.PermissionsService
}

func NewLocalHandler(
	playbookService app.PlaybookService,
	playbookRunService app.PlaybookRunService,
	api *pluginapi.Client,
	configService config.Service,
	permissions *app.PermissionsService,
) *LocalHandler {
	handler := &LocalHandler{
		localRouter:        mux.NewRouter(),
		ErrorHandler:       &ErrorHandler{},
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		pluginAPI:          api,
		config:             configService,
		permissions:        permissions,
	}

	handler.localRouter.HandleFunc("/boards/blocks", withContext(handler.getBlocks)).Methods("GET")
	handler.localRouter.HandleFunc("/boards/members", withContext(handler.getMembers)).Methods("GET")
	handler.localRouter.HandleFunc("/boards/playbooks", withContext(handler.getPlaybooks)).Methods("GET")

	return handler
}

func (h *LocalHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestSize)
	h.localRouter.ServeHTTP(w, r)
}

func (h *LocalHandler) getMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookIDs := strings.Split(r.URL.Query().Get("playbook_ids"), ",")
	userID := r.URL.Query().Get("user_id")
	teamID := r.URL.Query().Get("team_id")

	requesterInfo, err := app.GetRequesterInfo(userID, h.pluginAPI)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	options := app.PlaybookFilterOptions{
		Page:        0,
		PerPage:     100,
		PlaybookIDs: playbookIDs,
	}
	playbooks, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	members := transform.BoardsPlaybooksMembers{Playbooks: playbooks.Items}

	ReturnJSON(w, members.Transform(), http.StatusOK)
}

func (h *LocalHandler) getPlaybooks(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	teamID := r.URL.Query().Get("team_id")

	requesterInfo, err := app.GetRequesterInfo(userID, h.pluginAPI)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	options := app.PlaybookFilterOptions{
		Page:    0,
		PerPage: 100,
	}

	playbooks, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	items := transform.BoardsPlaybooks{Playbooks: playbooks.Items}
	ReturnJSON(w, items.Transform(), http.StatusOK)
}

func (h *LocalHandler) getBlocks(c *Context, w http.ResponseWriter, r *http.Request) {

	teamID := r.URL.Query().Get("team_id")
	boardID := r.URL.Query().Get("board_id")
	playbookIDs := strings.Split(r.URL.Query().Get("playbook_ids"), ",")

	if boardID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "board_id is required", errors.Errorf("board_id is required when asking for blocks"))
		return
	}
	if teamID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "team_id is required", errors.Errorf("team_id is required when asking for blocks"))
		return
	}
	if len(playbookIDs) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "playbook_ids are required", errors.Errorf("playbook_ids are required when asking for blocks"))
		return
	}

	// act as an admin, auth is done in boards side
	requesterInfo := app.RequesterInfo{
		IsAdmin: true,
	}
	pbOptions := app.PlaybookFilterOptions{
		Page:        0,
		PerPage:     100,
		PlaybookIDs: playbookIDs,
	}
	playbooks, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, pbOptions)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	options := app.PlaybookRunFilterOptions{
		PlaybookIDs: playbookIDs,
		TeamID:      teamID,
		Statuses:    []string{"InProgress", "Finished"},
		Direction:   app.DirectionDesc,
		Sort:        app.SortField("last_status_update_at"),
		Page:        0,
		PerPage:     10000,
	}

	results, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	blocks := transform.BoardsPlaybookRuns{
		PlaybookRuns: results.Items,
		BoardID:      boardID,
		Playbooks:    playbooks.Items,
	}

	ReturnJSON(w, blocks.Transform(), http.StatusOK)
}
