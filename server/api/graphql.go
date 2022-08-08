package api

import (
	"context"
	_ "embed"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	graphql "github.com/graph-gophers/graphql-go"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/pkg/errors"
)

type GraphQLHandler struct {
	*ErrorHandler
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	categoryService    app.CategoryService
	pluginAPI          *pluginapi.Client
	log                bot.Logger
	config             config.Service
	permissions        *app.PermissionsService
	playbookStore      app.PlaybookStore
	licenceChecker     app.LicenseChecker

	schema *graphql.Schema
}

//go:embed schema.graphqls
var SchemaFile string

func NewGraphQLHandler(
	router *mux.Router,
	playbookService app.PlaybookService,
	playbookRunService app.PlaybookRunService,
	categoryService app.CategoryService,
	api *pluginapi.Client,
	log bot.Logger,
	configService config.Service,
	permissions *app.PermissionsService,
	playbookStore app.PlaybookStore,
	licenceChecker app.LicenseChecker,
) *GraphQLHandler {
	handler := &GraphQLHandler{
		ErrorHandler:       &ErrorHandler{log: log},
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		categoryService:    categoryService,
		pluginAPI:          api,
		log:                log,
		config:             configService,
		permissions:        permissions,
		playbookStore:      playbookStore,
		licenceChecker:     licenceChecker,
	}

	opts := []graphql.SchemaOpt{
		graphql.UseFieldResolvers(),
		graphql.MaxParallelism(5),
	}

	if !configService.IsConfiguredForDevelopmentAndTesting() {
		opts = append(opts,
			graphql.MaxDepth(4),
			graphql.DisableIntrospection(),
		)
	}

	root := &RootResolver{}
	var err error
	handler.schema, err = graphql.ParseSchema(SchemaFile, root, opts...)
	if err != nil {
		log.Errorf("unable to parse graphql schema: %v", err.Error())
		return nil
	}

	router.HandleFunc("/query", graphiQL).Methods("GET")
	router.HandleFunc("/query", handler.graphQL).Methods("POST")

	return handler
}

type ctxKey struct{}

type Context struct {
	r                  *http.Request
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	playbookStore      app.PlaybookStore
	categoryService    app.CategoryService
	pluginAPI          *pluginapi.Client
	log                bot.Logger
	config             config.Service
	permissions        *app.PermissionsService
	licenceChecker     app.LicenseChecker
}

// When moving over to the multi-product architecture this should be handled by the server.
func (h *GraphQLHandler) graphQL(w http.ResponseWriter, r *http.Request) {
	// Limit bodies to 100KiB.
	r.Body = http.MaxBytesReader(w, r.Body, 102400)

	var params struct {
		Query         string                 `json:"query"`
		OperationName string                 `json:"operationName"`
		Variables     map[string]interface{} `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.log.Debugf("Unable to decode graphql query: %v", err)
		return
	}

	if !h.config.IsConfiguredForDevelopmentAndTesting() {
		if params.OperationName == "" {
			h.log.Debugf("Invalid blank operation name.")
			return
		}
	}

	c := &Context{
		r:                  r,
		playbookService:    h.playbookService,
		playbookRunService: h.playbookRunService,
		categoryService:    h.categoryService,
		pluginAPI:          h.pluginAPI,
		log:                h.log,
		config:             h.config,
		permissions:        h.permissions,
		playbookStore:      h.playbookStore,
		licenceChecker:     h.licenceChecker,
	}

	// Populate the context with required info.
	reqCtx := r.Context()
	reqCtx = context.WithValue(reqCtx, ctxKey{}, c)

	response := h.schema.Exec(reqCtx,
		params.Query,
		params.OperationName,
		params.Variables,
	)

	if len(response.Errors) > 0 {
		mlog.Error("Error executing request", mlog.String("operation", params.OperationName),
			mlog.Array("errors", response.Errors))
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func getContext(ctx context.Context) (*Context, error) {
	c, ok := ctx.Value(ctxKey{}).(*Context)
	if !ok {
		return nil, errors.New("custom context not found in context")
	}

	return c, nil
}

//go:embed graphqli.html
var GraphiqlPage []byte

func graphiQL(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write(GraphiqlPage)
}
