package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/graph-gophers/graphql-go/errors"
	boards "github.com/mattermost/focalboard/server/model"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
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

	participantByPlaybook := make(map[string][]string, 0)
	for _, playbookID := range playbookIDs {
		playbook, err := h.playbookService.Get(playbookID)
		if err != nil {
			h.HandleError(w, c.logger, err)
			return
		}
		if len(participantByPlaybook[playbookID]) == 0 {
			participantByPlaybook[playbookID] = make([]string, 0)
		}
		for _, m := range playbook.Members {
			participantByPlaybook[playbookID] = append(participantByPlaybook[playbookID], m.UserID)
		}
	}

	finalMembers := make([]string, 0)
	for _, sl := range participantByPlaybook {
		if len(finalMembers) == 0 {
			finalMembers = sl
		} else {
			finalMembers = intersection(finalMembers, sl)
		}
	}

	members := make([]boards.BoardMember, 0)
	for _, fm := range finalMembers {
		members = append(members, boards.BoardMember{
			UserID:       fm,
			SchemeViewer: true,
		})
	}

	ReturnJSON(w, members, http.StatusOK)

}

type PlaybookItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

func (h *LocalHandler) getPlaybooks(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	teamID := r.URL.Query().Get("team_id")

	requesterInfo, err := app.GetRequesterInfo(userID, h.pluginAPI)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	playbooks, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, app.PlaybookFilterOptions{})
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	items := make([]PlaybookItem, 0)
	for _, playbook := range playbooks.Items {
		item := PlaybookItem{
			ID:   playbook.ID,
			Name: playbook.Title,
			Type: "O",
		}
		if !playbook.Public {
			item.Type = "P"
		}
		items = append(items, item)
	}

	ReturnJSON(w, items, http.StatusOK)
}

func (h *LocalHandler) getBlocks(c *Context, w http.ResponseWriter, r *http.Request) {

	userID := r.URL.Query().Get("user_id")
	teamID := r.URL.Query().Get("team_id")
	boardID := r.URL.Query().Get("board_id")
	playbookIDs := strings.Split(r.URL.Query().Get("playbook_ids"), ",")

	if userID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "user_id is required", errors.Errorf("user_id is required when asking for blocks"))
		return
	}
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

	options := app.PlaybookRunFilterOptions{
		PlaybookIDs: playbookIDs,
		TeamID:      "mgxhrprsjbrx9yqsoacrqqkgro",
		Statuses:    []string{"InProgress", "Finished"},
		Direction:   app.DirectionDesc,
		Sort:        app.SortField("last_status_update_at"),
		Page:        0,
		PerPage:     10000,
	}
	requesterInfo, err := app.GetRequesterInfo(userID, h.pluginAPI)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	results, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	blocks := make([]boards.Block, 0)
	for _, run := range results.Items {
		blocks = append(blocks, boards.Block{
			ID:         fmt.Sprintf("A+%s", run.ID),
			ParentID:   "",
			CreatedBy:  run.OwnerUserID, // TODO: look for a better data
			ModifiedBy: run.OwnerUserID, // TODO: look for a better data
			Schema:     1,
			Type:       boards.TypeCard,
			Title:      run.Name,
			Fields: map[string]interface{}{
				"status":          run.CurrentStatus,
				"playbookrun_url": fmt.Sprintf("/playbooks/runs/%s", run.ID),
			},
			CreateAt: run.CreateAt,
			// UpdateAt: TODO check this data
			BoardID: boardID,
		})
	}

	// filter those the user don't have permission

	ReturnJSON(w, blocks, http.StatusOK)
}

func intersection(s1, s2 []string) (inter []string) {
	hash := make(map[string]bool)
	for _, e := range s1 {
		hash[e] = true
	}
	for _, e := range s2 {
		// If elements present in the hashmap then append intersection list.
		if hash[e] {
			inter = append(inter, e)
		}
	}
	//Remove dups from slice.
	inter = removeDuplicates(inter)
	return
}

//Remove duplicated values from slice.
func removeDuplicates(elements []string) (nodups []string) {
	encountered := make(map[string]bool)
	for _, element := range elements {
		if !encountered[element] {
			nodups = append(nodups, element)
			encountered[element] = true
		}
	}
	return
}
