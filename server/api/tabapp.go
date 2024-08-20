package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/sirupsen/logrus"
)

const (
	MicrosoftTeamsAppDomain = "https://playbooks.integrations.mattermost.com"
)

// TabAppHandler is the API handler.
type TabAppHandler struct {
	*ErrorHandler
	config             config.Service
	playbookRunService app.PlaybookRunService
	pluginAPI          *pluginapi.Client
	getJWTKeyFunc      func() keyfunc.Keyfunc
}

// NewTabAppHandler Creates a new Plugin API handler.
func NewTabAppHandler(
	apiHandler *Handler,
	playbookRunService app.PlaybookRunService,
	api *pluginapi.Client,
	configService config.Service,
	getJWTKeyFunc func() keyfunc.Keyfunc,
) *TabAppHandler {
	handler := &TabAppHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookRunService: playbookRunService,
		pluginAPI:          api,
		config:             configService,
		getJWTKeyFunc:      getJWTKeyFunc,
	}

	// Regiter the tab app on the root, which doesn't require Mattermost user authentication.
	tabAppRouter := apiHandler.root.PathPrefix("/tabapp/").Subrouter()
	tabAppRouter.HandleFunc("/runs", withContext(handler.getPlaybookRuns)).Methods(http.MethodOptions, http.MethodGet)

	return handler
}

// limitedUser returns the minimum amount of user data needed for the app.
type limitedUser struct {
	UserID    string `json:"user_id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// limitedUser returns the minimum amount of post data needed for the app.
type limitedPost struct {
	Message  string `json:"message"`
	CreateAt int64  `json:"create_at"`
	UserID   string `json:"user_id"`
}

type tabAppResults struct {
	TotalCount int                    `json:"total_count"`
	PageCount  int                    `json:"page_count"`
	PerPage    int                    `json:"per_page"`
	HasMore    bool                   `json:"has_more"`
	Items      []app.PlaybookRun      `json:"items"`
	Users      map[string]limitedUser `json:"users"`
	Posts      map[string]limitedPost `json:"posts"`
}

func (r tabAppResults) Clone() tabAppResults {
	newTabAppResults := r

	newTabAppResults.Items = make([]app.PlaybookRun, 0, len(r.Items))
	for _, i := range r.Items {
		newTabAppResults.Items = append(newTabAppResults.Items, *i.Clone())
	}

	return newTabAppResults
}

func (r tabAppResults) MarshalJSON() ([]byte, error) {
	type Alias tabAppResults

	old := Alias(r.Clone())

	// replace nils with empty slices for the frontend
	if old.Items == nil {
		old.Items = []app.PlaybookRun{}
	}

	return json.Marshal(old)
}

// validateToken validates the token in the given http.Request.
//
// Note that in developer mode, we skip validation if an empty token is provided. This
// usually happens because the developer is testing changes outside of Teams. If a token
// is provided, it's always required to be valid. If developer mode is disabled, a valid
// token is always required.
func (h *TabAppHandler) validateToken(c *Context, w http.ResponseWriter, r *http.Request, enableDeveloper *bool) bool {
	tokens := r.Header["Authorization"]
	if len(tokens) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Empty Authorization header in validating token", nil)
		return false
	} else if len(tokens) > 1 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Too many Authorization headers in validating token", nil)
		return false
	}

	token := tokens[0]
	if token == "" && enableDeveloper != nil && *enableDeveloper {
		logrus.Warn("Skipping token validation check for empty token since developer mode enabled")
		return true
	}

	jwtKeyFunc := h.getJWTKeyFunc()
	if jwtKeyFunc == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "Failed to initialize token validation", nil)
		return false
	}

	parsed, err := jwt.Parse(token, jwtKeyFunc.Keyfunc)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Failed to parse token", err)
		return false
	} else if !parsed.Valid {
		h.HandleErrorWithCode(w, c.logger, http.StatusUnauthorized, "Invalid token", nil)
		return false
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		h.HandleErrorWithCode(w, c.logger, http.StatusUnauthorized, "Unexpected claims", nil)
		return false
	}

	expectedTenantIDs := h.config.GetConfiguration().TeamsTabAppTenantIDs
	for _, expectedTenantID := range strings.Split(expectedTenantIDs, ",") {
		if claims["tid"] == expectedTenantID {
			logrus.WithFields(logrus.Fields{
				"tenant_id": claims["tid"],
				"oid":       claims["oid"],
			}).Info("Validated token, and authorized request")

			return true
		}
	}

	logrus.WithFields(logrus.Fields{
		"tenant_id":           claims["tid"],
		"oid":                 claims["oid"],
		"expected_tenant_ids": expectedTenantIDs,
	}).Warn("Validated token, but rejected request on tenant mismatch")

	return false
}

// getPlaybookRuns handles the GET /tabapp/runs endpoint.
//
// It returns certain runs and associated users and status posts in support of
// a Microsoft Teams app backed by a Mattermost domain.
//
// Only runs with the @msteams as a participant are returned, though this can
// this can be automated by automatically inviting said bot to new runs via the
// playbook configuration.
//
// A Mattermost account is not required: rather the caller must prove
// themselves to belong to the configured Microsoft Teams tenant by passing a
// Microsoft Entra ID token in the Authorization header. The signature of this
// JWT is verified against known Microsoft signing keys, effectively allowing
// anyone with access to that tenant to access this endpoint.
func (h *TabAppHandler) getPlaybookRuns(c *Context, w http.ResponseWriter, r *http.Request) {
	// If not enabled, the client won't get this reply since we won't have sent
	// the CORS headers yet. This is no different than if Playbooks wasn't
	// installed, so the client has to handle this case anyway.
	if !h.config.GetConfiguration().EnableTeamsTabApp {
		logrus.Warn("Rejecting request for teams tab app since feature not enabled")
		handleResponseWithCode(w, http.StatusForbidden, "Tab app not enabled")
		return
	}

	// In development, allow CORS from any requestor. Specify the host given in the origin and
	// not the wildcard '*' to continue to allow exchange of authorization tokens. Otherwise,
	// in production, we require the app to originate from the known domain.
	enableDeveloper := h.pluginAPI.Configuration.GetConfig().ServiceSettings.EnableDeveloper
	if enableDeveloper != nil && *enableDeveloper {
		logrus.WithField("origin", r.Header.Get("Origin")).Warn("Setting custom CORS header to match developer origin")
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	} else {
		w.Header().Set("Access-Control-Allow-Origin", MicrosoftTeamsAppDomain)
	}
	w.Header().Add("Access-Control-Allow-Headers", "Authorization")
	w.Header().Add("Access-Control-Allow-Methods", "OPTIONS,POST")

	// No payload needed to pre-flight the request.
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Validate the token in the request, handling all errors if invalid.
	if !h.validateToken(c, w, r, enableDeveloper) {
		return
	}

	teamsTabAppBotUserID := h.config.GetConfiguration().TeamsTabAppBotUserID

	// Parse using the common filter options, but we only support a subset below.
	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, teamsTabAppBotUserID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// We'll only fetch runs of which the teams tab app bot is a participant.
	requesterInfo := app.RequesterInfo{
		UserID: teamsTabAppBotUserID,
	}
	limitedFilterOptions := app.PlaybookRunFilterOptions{
		Page:          filterOptions.Page,
		PerPage:       filterOptions.PerPage,
		ParticipantID: teamsTabAppBotUserID,
	}
	runResults, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, limitedFilterOptions)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Collect all the users participating in the runs.
	users := make(map[string]limitedUser)
	for _, run := range runResults.Items {
		for _, participantID := range run.ParticipantIDs {
			if _, ok := users[participantID]; ok {
				continue
			}

			// TODO: Ideally, this would be a single GetUserByIDs call, but we didn't
			// expose that in the PluginAPI.
			user, err := h.pluginAPI.User.Get(participantID)
			if err != nil {
				logrus.WithField("user_id", participantID).WithError(err).Warn("Failed to get participant user")
				continue
			}
			users[participantID] = limitedUser{
				UserID:    user.Id,
				FirstName: user.FirstName,
				LastName:  user.LastName,
			}
		}
	}

	// Collect all the status posts for the runs.
	posts := make(map[string]limitedPost)
	for _, run := range runResults.Items {
		for _, statusPost := range run.StatusPosts {
			if statusPost.DeleteAt > 0 {
				continue
			}

			post, err := h.pluginAPI.Post.GetPost(statusPost.ID)
			if err != nil {
				logrus.WithField("post_id", statusPost.ID).WithError(err).Warn("Failed to get status post")
				continue
			}
			posts[statusPost.ID] = limitedPost{
				Message:  post.Message,
				CreateAt: post.CreateAt,
				UserID:   post.UserId,
			}
		}
	}

	// Collect all the authors for the status posts in the runs.
	for _, statusPost := range posts {
		if _, ok := users[statusPost.UserID]; ok {
			continue
		}

		// TODO: We don't actually post as the author anymore, so this is really
		// only going to look up the single @playbooks user right now. Update this
		// to extract the username from the stauts post props and resolve that user
		// instead.
		user, err := h.pluginAPI.User.Get(statusPost.UserID)
		if err != nil {
			logrus.WithField("user_id", statusPost.UserID).WithError(err).Warn("Failed to get status post user")
			continue
		}
		users[statusPost.UserID] = limitedUser{
			UserID:    user.Id,
			FirstName: user.FirstName,
			LastName:  user.LastName,
		}
	}

	results := tabAppResults{
		TotalCount: runResults.TotalCount,
		PageCount:  runResults.PageCount,
		PerPage:    runResults.PerPage,
		HasMore:    runResults.HasMore,
		Items:      runResults.Items,
		Users:      users,
		Posts:      posts,
	}

	ReturnJSON(w, results, http.StatusOK)
}
