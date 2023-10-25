package main

import (
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/command"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/enterprise"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
	"github.com/mattermost/mattermost-plugin-playbooks/server/scheduler"
	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
	"github.com/mattermost/mattermost-plugin-playbooks/server/telemetry"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-api/cluster"
)

const (
	updateMetricsTaskFrequency = 15 * time.Minute

	metricsExposePort = ":9093"

	// Topic represents a start of a thread. In playbooks we support 2 types of topics:
	// status topic - indicating the start of the thread below status update and
	// task topic - indicating the start of the thread below task(checklist item)
	TopicTypeStatus = "status"
	TopicTypeTask   = "task"

	// Collection is a group of topics and their corresponding threads.
	// In Playbooks we support a single type of collection - a run
	CollectionTypeRun = "run"
)

const (
	rudderDataplaneURL = "https://pdat.matterlytics.com"
	rudderWriteKey     = "1ag0Mv7LPf5uJNhcnKomqg0ENFd"
)

type TelemetryClient interface {
	app.PlaybookRunTelemetry
	app.PlaybookTelemetry
	app.GenericTelemetry
	bot.Telemetry
	app.UserInfoTelemetry
	app.ChannelActionTelemetry
	app.CategoryTelemetry
	Enable() error
	Disable() error
}

// Plugin implements the interface expected by the Mattermost server to communicate between the
// server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	handler              *api.Handler
	config               *config.ServiceImpl
	playbookRunService   app.PlaybookRunService
	playbookService      app.PlaybookService
	permissions          *app.PermissionsService
	channelActionService app.ChannelActionService
	categoryService      app.CategoryService
	bot                  *bot.Bot
	pluginAPI            *pluginapi.Client
	userInfoStore        app.UserInfoStore
	telemetryClient      TelemetryClient
	licenseChecker       app.LicenseChecker
	metricsService       *metrics.Metrics
}

type StatusRecorder struct {
	http.ResponseWriter
	Status int
}

func (r *StatusRecorder) WriteHeader(status int) {
	r.Status = status
	r.ResponseWriter.WriteHeader(status)
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return errors.Wrapf(err, "unable to get bundle path")
	}

	if err := i18n.TranslationsPreInit(filepath.Join(bundlePath, "assets/i18n")); err != nil {
		return errors.Wrapf(err, "unable to load translation files")
	}

	p.metricsService = p.newMetricsInstance()
	pluginAPIClient := pluginapi.NewClient(p.API, p.Driver)
	p.pluginAPI = pluginAPIClient

	p.config = config.NewConfigService(pluginAPIClient, manifest)

	logger := logrus.StandardLogger()
	pluginapi.ConfigureLogrus(logger, pluginAPIClient)

	botID, err := pluginAPIClient.Bot.EnsureBot(&model.Bot{
		Username:    "playbooks",
		DisplayName: "Playbooks",
		Description: "Playbooks bot.",
		OwnerId:     "playbooks",
	},
		pluginapi.ProfileImagePath("assets/plugin_icon.png"),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to ensure bot")
	}

	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
	})
	if err != nil {
		return errors.Wrapf(err, "failed save bot to config")
	}

	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		logrus.Warn("Rudder credentials are not set. Disabling analytics.")
		p.telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := pluginAPIClient.System.GetDiagnosticID()
		serverVersion := pluginAPIClient.System.GetServerVersion()
		p.telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, manifest.Version, serverVersion)
		if err != nil {
			return errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := pluginAPIClient.Configuration.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = p.telemetryClient.Enable(); err != nil {
				logrus.WithError(err).Error("Telemetry could not be enabled")
			}
			return
		}

		if err = p.telemetryClient.Disable(); err != nil {
			logrus.WithError(err).Error("Telemetry could not be disabled")
		}
	}

	toggleTelemetry()
	p.config.RegisterConfigChangeListener(toggleTelemetry)

	apiClient := sqlstore.NewClient(pluginAPIClient)
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config, p.telemetryClient)
	scheduler := cluster.GetJobOnceScheduler(p.API)

	sqlStore, err := sqlstore.New(apiClient, scheduler)
	if err != nil {
		return errors.Wrapf(err, "failed creating the SQL store")
	}

	playbookRunStore := sqlstore.NewPlaybookRunStore(apiClient, sqlStore)
	playbookStore := sqlstore.NewPlaybookStore(apiClient, sqlStore)
	statsStore := sqlstore.NewStatsStore(apiClient, sqlStore)
	p.userInfoStore = sqlstore.NewUserInfoStore(sqlStore)
	channelActionStore := sqlstore.NewChannelActionStore(apiClient, sqlStore)
	categoryStore := sqlstore.NewCategoryStore(apiClient, sqlStore)

	p.handler = api.NewHandler(pluginAPIClient, p.config)

	p.playbookService = app.NewPlaybookService(playbookStore, p.bot, p.telemetryClient, pluginAPIClient, p.metricsService)

	keywordsThreadIgnorer := app.NewKeywordsThreadIgnorer()
	p.channelActionService = app.NewChannelActionsService(pluginAPIClient, p.bot, p.config, channelActionStore, p.playbookService, keywordsThreadIgnorer, p.telemetryClient)
	p.categoryService = app.NewCategoryService(categoryStore, pluginAPIClient, p.telemetryClient)

	p.licenseChecker = enterprise.NewLicenseChecker(pluginAPIClient)

	p.playbookRunService = app.NewPlaybookRunService(
		pluginAPIClient,
		playbookRunStore,
		p.bot,
		p.config,
		scheduler,
		p.telemetryClient,
		p.telemetryClient,
		p.API,
		p.playbookService,
		p.channelActionService,
		p.licenseChecker,
		p.metricsService,
	)

	if err = scheduler.SetCallback(p.playbookRunService.HandleReminder); err != nil {
		logrus.WithError(err).Error("JobOnceScheduler could not add the playbookRunService's HandleReminder")
	}
	if err = scheduler.Start(); err != nil {
		logrus.WithError(err).Error("JobOnceScheduler could not start")
	}

	// Migrations use the scheduler, so they have to be run after playbookRunService and scheduler have started
	mutex, err := cluster.NewMutex(p.API, "IR_dbMutex")
	if err != nil {
		return errors.Wrapf(err, "failed creating cluster mutex")
	}
	mutex.Lock()
	if err = sqlStore.RunMigrations(); err != nil {
		mutex.Unlock()
		return errors.Wrapf(err, "failed to run migrations")
	}
	mutex.Unlock()

	p.permissions = app.NewPermissionsService(p.playbookService, p.playbookRunService, pluginAPIClient, p.config, p.licenseChecker)

	// register collections and topics.
	// TODO bump the minimum server version
	if err := p.API.RegisterCollectionAndTopic(CollectionTypeRun, TopicTypeStatus); err != nil {
		logrus.WithError(err).Warnf("failed to register collection - %s and topic - %s", CollectionTypeRun, TopicTypeStatus)
	}
	if err := p.API.RegisterCollectionAndTopic(CollectionTypeRun, TopicTypeTask); err != nil {
		logrus.WithError(err).Warnf("failed to register collection - %s and topic - %s", CollectionTypeRun, TopicTypeTask)
	}

	api.NewGraphQLHandler(
		p.handler.APIRouter,
		p.playbookService,
		p.playbookRunService,
		p.categoryService,
		pluginAPIClient,
		p.config,
		p.permissions,
		playbookStore,
		playbookRunStore,
		p.licenseChecker,
	)
	api.NewPlaybookHandler(
		p.handler.APIRouter,
		p.playbookService,
		pluginAPIClient,
		p.config,
		p.permissions,
	)
	api.NewPlaybookRunHandler(
		p.handler.APIRouter,
		p.playbookRunService,
		p.playbookService,
		p.permissions,
		p.licenseChecker,
		pluginAPIClient,
		p.bot,
		p.config,
	)
	api.NewStatsHandler(p.handler.APIRouter, pluginAPIClient, statsStore, p.playbookService, p.permissions, p.licenseChecker)
	api.NewBotHandler(p.handler.APIRouter, pluginAPIClient, p.bot, p.config, p.playbookRunService, p.userInfoStore)
	api.NewTelemetryHandler(p.handler.APIRouter, p.playbookRunService, pluginAPIClient, p.telemetryClient, p.playbookService, p.telemetryClient, p.telemetryClient, p.telemetryClient, p.permissions)
	api.NewSignalHandler(p.handler.APIRouter, pluginAPIClient, p.playbookRunService, p.playbookService, keywordsThreadIgnorer)
	api.NewSettingsHandler(p.handler.APIRouter, pluginAPIClient, p.config)
	api.NewActionsHandler(p.handler.APIRouter, p.channelActionService, p.pluginAPI, p.permissions)
	api.NewCategoryHandler(p.handler.APIRouter, pluginAPIClient, p.categoryService, p.playbookService, p.playbookRunService)

	isTestingEnabled := false
	flag := p.API.GetConfig().ServiceSettings.EnableTesting
	if flag != nil {
		isTestingEnabled = *flag
	}
	if err = command.RegisterCommands(p.API.RegisterCommand, isTestingEnabled); err != nil {
		return errors.Wrapf(err, "failed register commands")
	}

	enableMetrics := p.API.GetConfig().MetricsSettings.Enable
	if enableMetrics != nil && *enableMetrics {
		// run metrics server to expose data
		p.runMetricsServer()
		// run metrics updater recurring task
		p.runMetricsUpdaterTask(playbookStore, playbookRunStore, updateMetricsTaskFrequency)
		// set error counter middleware handler
		p.handler.APIRouter.Use(p.getErrorCounterHandler())
	}

	// prevent a recursive OnConfigurationChange
	go func() {
		// Remove the prepackaged old versions of the plugin
		_ = pluginAPIClient.Plugin.Remove("com.mattermost.plugin-incident-response")
		_ = pluginAPIClient.Plugin.Remove("com.mattermost.plugin-incident-management")
	}()

	return nil
}

// OnConfigurationChange handles any change in the configuration.
func (p *Plugin) OnConfigurationChange() error {
	if p.config == nil {
		return nil
	}

	return p.config.OnConfigurationChange()
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := command.NewCommandRunner(c, args, pluginapi.NewClient(p.API, p.Driver), p.bot,
		p.playbookRunService, p.playbookService, p.config, p.userInfoStore, p.telemetryClient, p.permissions)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("Playbooks.ExecuteCommand", "app.command.execute.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}

func (p *Plugin) UserHasJoinedChannel(c *plugin.Context, channelMember *model.ChannelMember, actor *model.User) {
	actorID := ""
	if actor != nil && actor.Id != channelMember.UserId {
		actorID = actor.Id
	}
	p.channelActionService.UserHasJoinedChannel(channelMember.UserId, channelMember.ChannelId, actorID)
}

func (p *Plugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
	p.channelActionService.MessageHasBeenPosted(post)
	p.playbookRunService.MessageHasBeenPosted(post)
}

func (p *Plugin) newMetricsInstance() *metrics.Metrics {
	// Init metrics
	instanceInfo := metrics.InstanceInfo{
		Version:        manifest.Version,
		InstallationID: os.Getenv("MM_CLOUD_INSTALLATION_ID"),
	}
	return metrics.NewMetrics(instanceInfo)
}

func (p *Plugin) runMetricsServer() {
	logrus.WithField("port", metricsExposePort).Info("Starting Playbooks metrics server")

	metricServer := metrics.NewMetricsServer(metricsExposePort, p.metricsService)
	// Run server to expose metrics
	go func() {
		err := metricServer.Run()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logrus.WithError(err).Error("Metrics server could not be started")
		}
	}()
}

func (p *Plugin) runMetricsUpdaterTask(playbookStore app.PlaybookStore, playbookRunStore app.PlaybookRunStore, updateMetricsTaskFrequency time.Duration) {
	metricsUpdater := func() {
		if playbooksActiveTotal, err := playbookStore.GetPlaybooksActiveTotal(); err == nil {
			p.metricsService.ObservePlaybooksActiveTotal(playbooksActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, playbooks_active_total")
		}

		if runsActiveTotal, err := playbookRunStore.GetRunsActiveTotal(); err == nil {
			p.metricsService.ObserveRunsActiveTotal(runsActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, runs_active_total")
		}

		if remindersOverdueTotal, err := playbookRunStore.GetOverdueUpdateRunsTotal(); err == nil {
			p.metricsService.ObserveRemindersOutstandingTotal(remindersOverdueTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, reminders_outstanding_total")
		}

		if retrosOverdueTotal, err := playbookRunStore.GetOverdueRetroRunsTotal(); err == nil {
			p.metricsService.ObserveRetrosOutstandingTotal(retrosOverdueTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, retros_outstanding_total")
		}

		if followersActiveTotal, err := playbookRunStore.GetFollowersActiveTotal(); err == nil {
			p.metricsService.ObserveFollowersActiveTotal(followersActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, followers_active_total")
		}

		if participantsActiveTotal, err := playbookRunStore.GetParticipantsActiveTotal(); err == nil {
			p.metricsService.ObserveParticipantsActiveTotal(participantsActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, participants_active_total")
		}
	}

	scheduler.CreateRecurringTask("metricsUpdater", metricsUpdater, updateMetricsTaskFrequency)
}

func (p *Plugin) getErrorCounterHandler() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			recorder := &StatusRecorder{
				ResponseWriter: w,
				Status:         200,
			}
			next.ServeHTTP(recorder, r)
			if recorder.Status < 200 || recorder.Status > 299 {
				p.metricsService.IncrementErrorsCount(1)
			}
		})
	}
}

func (p *Plugin) UserHasPermissionToCollection(c *plugin.Context, userID string, collectionType, collectionID string, permission *model.Permission) (bool, error) {
	if collectionType != CollectionTypeRun {
		return false, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}

	run, err := p.playbookRunService.GetPlaybookRun(collectionID)
	if err != nil {
		return false, errors.Wrapf(err, "No run with id - %s", collectionID)
	}
	return p.permissions.HasPermissionsToRun(userID, run, permission), nil
}

func (p *Plugin) GetAllCollectionIDsForUser(c *plugin.Context, userID, collectionType string) ([]string, error) {
	if collectionType != CollectionTypeRun {
		return nil, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}

	ids, err := p.playbookRunService.GetPlaybookRunIDsForUser(userID)
	if err != nil {
		return nil, err
	}

	return ids, nil
}

func (p *Plugin) GetAllUserIdsForCollection(c *plugin.Context, collectionType, collectionID string) ([]string, error) {
	if collectionType != CollectionTypeRun {
		return nil, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}

	run, err := p.playbookRunService.GetPlaybookRun(collectionID)
	if err != nil {
		return nil, errors.Wrapf(err, "No run with id - %s", collectionID)
	}
	followers, err := p.playbookRunService.GetFollowers(collectionID)
	if err != nil {
		return nil, errors.Wrapf(err, "can't get followers for run - %s", collectionID)
	}
	return mergeSlice(run.ParticipantIDs, followers), nil
}

func (p *Plugin) GetCollectionMetadataByIds(c *plugin.Context, collectionType string, collectionIDs []string) (map[string]*model.CollectionMetadata, error) {
	if collectionType != CollectionTypeRun {
		return nil, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}
	runsMetadata := map[string]*model.CollectionMetadata{}
	runs, err := p.playbookRunService.GetRunMetadataByIDs(collectionIDs)
	if err != nil {
		return nil, errors.Wrap(err, "can't get playbook run metadata by ids")
	}
	for _, run := range runs {
		runsMetadata[run.ID] = &model.CollectionMetadata{
			Id:             run.ID,
			CollectionType: CollectionTypeRun,
			TeamId:         run.TeamID,
			Name:           run.Name,
			RelativeURL:    app.GetRunDetailsRelativeURL(run.ID),
		}
	}
	return runsMetadata, nil
}

func (p *Plugin) GetTopicMetadataByIds(c *plugin.Context, topicType string, topicIDs []string) (map[string]*model.TopicMetadata, error) {
	topicsMetadata := map[string]*model.TopicMetadata{}

	var getTopicMetadataByIDs func(topicIDs []string) ([]app.TopicMetadata, error)
	switch topicType {
	case TopicTypeStatus:
		getTopicMetadataByIDs = p.playbookRunService.GetStatusMetadataByIDs
	case TopicTypeTask:
		getTopicMetadataByIDs = p.playbookRunService.GetTaskMetadataByIDs
	default:
		return map[string]*model.TopicMetadata{}, errors.Errorf("topic type %s is not registered by playbooks", topicType)
	}

	topics, err := getTopicMetadataByIDs(topicIDs)
	if err != nil {
		return nil, errors.Wrap(err, "can't get metadata by topic ids")
	}
	for _, topic := range topics {
		topicsMetadata[topic.ID] = &model.TopicMetadata{
			Id:             topic.ID,
			TopicType:      topicType,
			CollectionType: CollectionTypeRun,
			TeamId:         topic.TeamID,
			CollectionId:   topic.RunID,
		}
	}

	return topicsMetadata, nil
}

func mergeSlice(a, b []string) []string {
	m := make(map[string]struct{}, len(a)+len(b))
	for _, elem := range a {
		m[elem] = struct{}{}
	}
	for _, elem := range b {
		m[elem] = struct{}{}
	}
	merged := make([]string, 0, len(m))
	for key := range m {
		merged = append(merged, key)
	}
	return merged
}
