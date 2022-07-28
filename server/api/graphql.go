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
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

type GraphQLHandler struct {
	*ErrorHandler
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	categoryService    app.CategoryService
	pluginAPI          *pluginapi.Client
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
	configService config.Service,
	permissions *app.PermissionsService,
	playbookStore app.PlaybookStore,
	licenceChecker app.LicenseChecker,
) *GraphQLHandler {
	handler := &GraphQLHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		categoryService:    categoryService,
		pluginAPI:          api,
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
		logrus.WithError(err).Error("unable to parse graphql schema")
		return nil
	}

	router.HandleFunc("/query", withLogger(graphiQL)).Methods("GET")
	router.HandleFunc("/query", withLogger(handler.graphQL)).Methods("POST")

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
	logger             logrus.FieldLogger
	config             config.Service
	permissions        *app.PermissionsService
	licenceChecker     app.LicenseChecker
}

// When moving over to the multi-product architecture this should be handled by the server.
func (h *GraphQLHandler) graphQL(w http.ResponseWriter, r *http.Request, logger logrus.FieldLogger) {
	// Limit bodies to 100KiB.
	r.Body = http.MaxBytesReader(w, r.Body, 102400)

	var params struct {
		Query         string                 `json:"query"`
		OperationName string                 `json:"operationName"`
		Variables     map[string]interface{} `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		logger.WithError(err).Debug("Unable to decode graphql query")
		return
	}

	if !h.config.IsConfiguredForDevelopmentAndTesting() {
		if params.OperationName == "" {
			logger.Debug("Invalid blank operation name")
			return
		}
	}

	c := &Context{
		r:                  r,
		playbookService:    h.playbookService,
		playbookRunService: h.playbookRunService,
		categoryService:    h.categoryService,
		pluginAPI:          h.pluginAPI,
		logger:             logger,
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

	for _, err := range response.Errors {
		logger.WithError(err).WithField("operation", params.OperationName).Error("Error executing request")
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.WithError(err).Warn("Error while writing response")
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

func graphiQL(w http.ResponseWriter, r *http.Request, logger logrus.FieldLogger) {
	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write(GraphiqlPage)
}
