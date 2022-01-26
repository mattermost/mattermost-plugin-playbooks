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
	playbookService app.PlaybookService
	pluginAPI       *pluginapi.Client
	log             bot.Logger
	config          config.Service
	permissions     *app.PermissionsService
	playbookStore   app.PlaybookStore

	schema *graphql.Schema
}

//go:embed schema.graphqls
var schemaFile string

func NewGraphQLHandler(
	router *mux.Router,
	playbookService app.PlaybookService,
	api *pluginapi.Client,
	log bot.Logger,
	configService config.Service,
	permissions *app.PermissionsService,
	playbookStore app.PlaybookStore,
) *GraphQLHandler {
	handler := &GraphQLHandler{
		ErrorHandler:    &ErrorHandler{log: log},
		playbookService: playbookService,
		pluginAPI:       api,
		log:             log,
		config:          configService,
		permissions:     permissions,
		playbookStore:   playbookStore,
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

	root := &rootResolver{}
	var err error
	handler.schema, err = graphql.ParseSchema(schemaFile, root, opts...)
	if err != nil {
		log.Errorf("unable to parse graphql schema: %w", err)
		return nil
	}

	router.HandleFunc("/query", graphiQL).Methods("GET")
	router.HandleFunc("/query", handler.graphQL).Methods("POST")

	return handler
}

type ctxKey struct{}

type Context struct {
	r               *http.Request
	playbookService app.PlaybookService
	playbookStore   app.PlaybookStore
	pluginAPI       *pluginapi.Client
	log             bot.Logger
	config          config.Service
	permissions     *app.PermissionsService
}

func (h *GraphQLHandler) graphQL(w http.ResponseWriter, r *http.Request) {
	var params struct {
		Query         string                 `json:"query"`
		OperationName string                 `json:"operationName"`
		Variables     map[string]interface{} `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		return
	}

	/*if isProd() && params.OperationName == "" {
		c.SetInvalidParam("graphql.operationName")
		return
	}*/

	c := &Context{
		r:               r,
		playbookService: h.playbookService,
		pluginAPI:       h.pluginAPI,
		log:             h.log,
		config:          h.config,
		permissions:     h.permissions,
		playbookStore:   h.playbookStore,
	}

	// Populate the context with required info.
	reqCtx := r.Context()
	reqCtx = context.WithValue(reqCtx, ctxKey{}, c)

	response := h.schema.Exec(reqCtx,
		params.Query,
		params.OperationName,
		params.Variables)

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

func graphiQL(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.Write(graphiqlPage)
}

var graphiqlPage = []byte(`
<!DOCTYPE html>
<html>
	<head>
		<title>GraphiQL editor | Mattermost</title>
		<link href="https://cdnjs.cloudflare.com/ajax/libs/graphiql/0.11.11/graphiql.min.css" rel="stylesheet" />
		<script src="https://cdnjs.cloudflare.com/ajax/libs/es6-promise/4.1.1/es6-promise.auto.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.3/fetch.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/react/16.2.0/umd/react.production.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/16.2.0/umd/react-dom.production.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/graphiql/0.11.11/graphiql.min.js"></script>
	</head>
	<body style="width: 100%; height: 100%; margin: 0; overflow: hidden;">
		<div id="graphiql" style="height: 100vh;">Loading...</div>
		<script>
			function graphQLFetcher(graphQLParams) {
				return fetch("/plugins/playbooks/api/v1/query", {
					method: "post",
					body: JSON.stringify(graphQLParams),
					credentials: "include",
					headers: {
						'X-Requested-With': 'XMLHttpRequest'
					}
				}).then(function (response) {
					return response.text();
				}).then(function (responseBody) {
					try {
						return JSON.parse(responseBody);
					} catch (error) {
						return responseBody;
					}
				});
			}
			ReactDOM.render(
				React.createElement(GraphiQL, {fetcher: graphQLFetcher}),
				document.getElementById("graphiql")
			);
		</script>
	</body>
</html>
`)
