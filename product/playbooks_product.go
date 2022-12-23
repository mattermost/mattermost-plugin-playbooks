// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/product/pluginapi/cluster"
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
	mmapp "github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const (
	playbooksProductName = "playbooks######"
	playbooksProductID   = "com.mattermost.playbooks"
)

const (
	updateMetricsTaskFrequency = 15 * time.Minute

	metricsExposePort = ":9093"
)

const ServerKey product.ServiceKey = "server"

// These credentials for Rudder need to be populated at build-time,
// passing the following flags to the go build command:
// -ldflags "-X main.rudderDataplaneURL=<url> -X main.rudderWriteKey=<write_key>"
var (
	rudderDataplaneURL string
	rudderWriteKey     string
)

var errServiceTypeAssert = errors.New("type assertion failed")

type StatusRecorder struct {
	http.ResponseWriter
	Status int
}

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

func init() {
	product.RegisterProduct(playbooksProductName, product.Manifest{
		Initializer: newPlaybooksProduct,
		Dependencies: map[product.ServiceKey]struct{}{
			product.TeamKey:          {},
			product.ChannelKey:       {},
			product.UserKey:          {},
			product.PostKey:          {},
			product.BotKey:           {},
			product.ClusterKey:       {},
			product.ConfigKey:        {},
			product.LogKey:           {},
			product.LicenseKey:       {},
			product.FilestoreKey:     {},
			product.FileInfoStoreKey: {},
			product.RouterKey:        {},
			product.CloudKey:         {},
			product.KVStoreKey:       {},
			product.StoreKey:         {},
			product.SystemKey:        {},
			product.PreferencesKey:   {},
		},
	})
}

type playbooksProduct struct {
	teamService          product.TeamService
	channelService       product.ChannelService
	userService          product.UserService
	postService          product.PostService
	permissionsService   product.PermissionService
	botService           product.BotService
	clusterService       product.ClusterService
	configService        product.ConfigService
	logger               mlog.LoggerIFace
	licenseService       product.LicenseService
	filestoreService     product.FilestoreService
	fileInfoStoreService product.FileInfoStoreService
	routerService        product.RouterService
	cloudService         product.CloudService
	kvStoreService       product.KVStoreService
	storeService         product.StoreService
	systemService        product.SystemService
	preferencesService   product.PreferencesService
	hooksService         product.HooksService

	handler              *api.Handler
	config               *config.ServiceImpl
	playbookRunService   app.PlaybookRunService
	playbookService      app.PlaybookService
	permissions          *app.PermissionsService
	channelActionService app.ChannelActionService
	categoryService      app.CategoryService
	bot                  *bot.Bot
	userInfoStore        app.UserInfoStore
	telemetryClient      TelemetryClient
	licenseChecker       app.LicenseChecker
	metricsService       *metrics.Metrics

	plugin.MattermostPlugin

	// pluginAPIAdapter *adapters.PluginAPIAdapter
}

func newPlaybooksProduct(services map[product.ServiceKey]interface{}) (product.Product, error) {
	playbooks := &playbooksProduct{}
	err := playbooks.setProductServices(services)
	if err != nil {
		return nil, err
	}

	logger := logrus.StandardLogger()
	ConfigureLogrus(logger, playbooks.logger)

	server := services[ServerKey].(*mmapp.Server)

	serviceAdapter := newServiceAPIAdapter(playbooks, server, manifest)
	botID, err := serviceAdapter.EnsureBot(&model.Bot{
		Username:    "playbooks",
		DisplayName: "Playbooks",
		Description: "Playbooks bot.",
		OwnerId:     "playbooks",
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to ensure bot")
	}

	playbooks.config = config.NewConfigService(serviceAdapter, manifest)
	err = playbooks.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed save bot to config")
	}

	playbooks.handler = api.NewHandler(playbooks.config)

	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		logrus.Warn("Rudder credentials are not set. Disabling analytics.")
		playbooks.telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := serviceAdapter.GetDiagnosticID()
		serverVersion := serviceAdapter.GetServerVersion()
		playbooks.telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, manifest.Version, serverVersion)
		if err != nil {
			return nil, errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := serviceAdapter.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = playbooks.telemetryClient.Enable(); err != nil {
				logrus.WithError(err).Error("Telemetry could not be enabled")
			}
			return
		}

		if err = playbooks.telemetryClient.Disable(); err != nil {
			logrus.WithError(err).Error("Telemetry could not be disabled")
		}
	}

	toggleTelemetry()
	playbooks.config.RegisterConfigChangeListener(toggleTelemetry)

	apiClient := sqlstore.NewClient(serviceAdapter)
	playbooks.bot = bot.New(serviceAdapter, playbooks.config.GetConfiguration().BotUserID, playbooks.config, playbooks.telemetryClient)
	scheduler := cluster.GetJobOnceScheduler(serviceAdapter)

	sqlStore, err := sqlstore.New(apiClient, scheduler)
	if err != nil {
		return nil, errors.Wrapf(err, "failed creating the SQL store")
	}

	playbookRunStore := sqlstore.NewPlaybookRunStore(apiClient, sqlStore)
	playbookStore := sqlstore.NewPlaybookStore(apiClient, sqlStore)
	statsStore := sqlstore.NewStatsStore(apiClient, sqlStore)
	playbooks.userInfoStore = sqlstore.NewUserInfoStore(sqlStore)
	channelActionStore := sqlstore.NewChannelActionStore(apiClient, sqlStore)
	categoryStore := sqlstore.NewCategoryStore(apiClient, sqlStore)

	playbooks.handler = api.NewHandler(playbooks.config)

	playbooks.playbookService = app.NewPlaybookService(playbookStore, playbooks.bot, playbooks.telemetryClient, serviceAdapter, playbooks.metricsService)

	keywordsThreadIgnorer := app.NewKeywordsThreadIgnorer()
	playbooks.channelActionService = app.NewChannelActionsService(serviceAdapter, playbooks.bot, playbooks.config, channelActionStore, playbooks.playbookService, keywordsThreadIgnorer, playbooks.telemetryClient)
	playbooks.categoryService = app.NewCategoryService(categoryStore, serviceAdapter, playbooks.telemetryClient)

	playbooks.licenseChecker = enterprise.NewLicenseChecker(serviceAdapter)

	playbooks.playbookRunService = app.NewPlaybookRunService(
		playbookRunStore,
		playbooks.bot,
		playbooks.config,
		scheduler,
		playbooks.telemetryClient,
		serviceAdapter,
		playbooks.playbookService,
		playbooks.channelActionService,
		playbooks.licenseChecker,
		playbooks.metricsService,
	)

	if err = scheduler.SetCallback(playbooks.playbookRunService.HandleReminder); err != nil {
		logrus.WithError(err).Error("JobOnceScheduler could not add the playbookRunService's HandleReminder")
	}
	if err = scheduler.Start(); err != nil {
		logrus.WithError(err).Error("JobOnceScheduler could not start")
	}

	// Migrations use the scheduler, so they have to be run after playbookRunService and scheduler have started
	mutex, err := cluster.NewMutex(serviceAdapter, "IR_dbMutex")
	if err != nil {
		return nil, errors.Wrapf(err, "failed creating cluster mutex")
	}
	mutex.Lock()
	if err = sqlStore.RunMigrations(); err != nil {
		mutex.Unlock()
		return nil, errors.Wrapf(err, "failed to run migrations")
	}
	mutex.Unlock()

	playbooks.permissions = app.NewPermissionsService(
		playbooks.playbookService,
		playbooks.playbookRunService,
		serviceAdapter,
		playbooks.config,
		playbooks.licenseChecker,
	)

	api.NewGraphQLHandler(
		playbooks.handler.APIRouter,
		playbooks.playbookService,
		playbooks.playbookRunService,
		playbooks.categoryService,
		serviceAdapter,
		playbooks.config,
		playbooks.permissions,
		playbookStore,
		playbooks.licenseChecker,
	)
	api.NewPlaybookHandler(
		playbooks.handler.APIRouter,
		playbooks.playbookService,
		serviceAdapter,
		playbooks.config,
		playbooks.permissions,
	)
	api.NewPlaybookRunHandler(
		playbooks.handler.APIRouter,
		playbooks.playbookRunService,
		playbooks.playbookService,
		playbooks.permissions,
		playbooks.licenseChecker,
		serviceAdapter,
		playbooks.bot,
		playbooks.config,
	)
	api.NewStatsHandler(
		playbooks.handler.APIRouter,
		serviceAdapter,
		statsStore,
		playbooks.playbookService,
		playbooks.permissions,
		playbooks.licenseChecker,
	)
	api.NewBotHandler(
		playbooks.handler.APIRouter,
		serviceAdapter, playbooks.bot,
		playbooks.config,
		playbooks.playbookRunService,
		playbooks.userInfoStore,
	)
	api.NewTelemetryHandler(
		playbooks.handler.APIRouter,
		playbooks.playbookRunService,
		serviceAdapter,
		playbooks.telemetryClient,
		playbooks.playbookService,
		playbooks.telemetryClient,
		playbooks.telemetryClient,
		playbooks.telemetryClient,
		playbooks.permissions,
	)
	api.NewSignalHandler(
		playbooks.handler.APIRouter,
		serviceAdapter,
		playbooks.playbookRunService,
		playbooks.playbookService,
		keywordsThreadIgnorer,
	)
	api.NewSettingsHandler(
		playbooks.handler.APIRouter,
		serviceAdapter,
		playbooks.config,
	)
	api.NewActionsHandler(
		playbooks.handler.APIRouter,
		playbooks.channelActionService,
		serviceAdapter,
		playbooks.permissions,
	)
	api.NewCategoryHandler(
		playbooks.handler.APIRouter,
		serviceAdapter,
		playbooks.categoryService,
		playbooks.playbookService,
		playbooks.playbookRunService,
	)

	isTestingEnabled := false
	flag := serviceAdapter.GetConfig().ServiceSettings.EnableTesting
	if flag != nil {
		isTestingEnabled = *flag
	}

	if err = command.RegisterCommands(serviceAdapter.RegisterCommand, isTestingEnabled); err != nil {
		return nil, errors.Wrapf(err, "failed register commands")
	}

	return playbooks, nil
}

func (pp *playbooksProduct) setProductServices(services map[product.ServiceKey]interface{}) error {
	for key, service := range services {
		switch key {
		case product.TeamKey:
			teamService, ok := service.(product.TeamService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.teamService = teamService
		case product.ChannelKey:
			channelService, ok := service.(product.ChannelService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.channelService = channelService
		case product.UserKey:
			userService, ok := service.(product.UserService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.userService = userService
		case product.PostKey:
			postService, ok := service.(product.PostService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.postService = postService
		case product.PermissionsKey:
			permissionsService, ok := service.(product.PermissionService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.permissionsService = permissionsService
		case product.BotKey:
			botService, ok := service.(product.BotService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.botService = botService
		case product.ClusterKey:
			clusterService, ok := service.(product.ClusterService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.clusterService = clusterService
		case product.ConfigKey:
			configService, ok := service.(product.ConfigService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.configService = configService
		case product.LogKey:
			logger, ok := service.(mlog.LoggerIFace)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.logger = logger.With(mlog.String("product", playbooksProductName))
		case product.LicenseKey:
			licenseService, ok := service.(product.LicenseService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.licenseService = licenseService
		case product.FilestoreKey:
			filestoreService, ok := service.(product.FilestoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.filestoreService = filestoreService
		case product.FileInfoStoreKey:
			fileInfoStoreService, ok := service.(product.FileInfoStoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.fileInfoStoreService = fileInfoStoreService
		case product.RouterKey:
			routerService, ok := service.(product.RouterService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.routerService = routerService
		case product.CloudKey:
			cloudService, ok := service.(product.CloudService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.cloudService = cloudService
		case product.KVStoreKey:
			kvStoreService, ok := service.(product.KVStoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.kvStoreService = kvStoreService
		case product.StoreKey:
			storeService, ok := service.(product.StoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.storeService = storeService
		case product.SystemKey:
			systemService, ok := service.(product.SystemService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.systemService = systemService
		case product.PreferencesKey:
			preferencesService, ok := service.(product.PreferencesService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.preferencesService = preferencesService
		case product.HooksKey:
			hooksService, ok := service.(product.HooksService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.hooksService = hooksService
		}
	}
	return nil
}

func (pp *playbooksProduct) Start() error {
	logrus.Warn("################ Playbooks product start ##################")

	if err := pp.hooksService.RegisterHooks(playbooksProductName, pp); err != nil {
		return fmt.Errorf("failed to register hooks: %w", err)
	}

	enableMetrics := pp.configService.Config().MetricsSettings.Enable
	if enableMetrics != nil && *enableMetrics {
		pp.metricsService = newMetricsInstance()
		// run metrics server to expose data
		pp.runMetricsServer()
		//TODO: uncomment after store layer initialization
		// run metrics updater recurring task
		// pp.runMetricsUpdaterTask(playbookStore, playbookRunStore, updateMetricsTaskFrequency)
		// set error counter middleware handler
		pp.handler.APIRouter.Use(pp.getErrorCounterHandler())
	}

	logrus.Warn("################ Start END ##################")
	return nil
}

func (pp *playbooksProduct) Stop() error {
	return nil
}

func newMetricsInstance() *metrics.Metrics {
	// Init metrics
	instanceInfo := metrics.InstanceInfo{
		Version:        "0", //manifest.Version, TODO:  we can get product hash from the server
		InstallationID: os.Getenv("MM_CLOUD_INSTALLATION_ID"),
	}
	return metrics.NewMetrics(instanceInfo)
}

func (pp *playbooksProduct) runMetricsServer() {
	logrus.WithField("port", metricsExposePort).Info("Starting Playbooks metrics server")

	metricServer := metrics.NewMetricsServer(metricsExposePort, pp.metricsService)
	// Run server to expose metrics
	go func() {
		err := metricServer.Run()
		if err != nil {
			logrus.WithError(err).Error("Metrics server could not be started")
		}
	}()
}

func (pp *playbooksProduct) runMetricsUpdaterTask(playbookStore app.PlaybookStore, playbookRunStore app.PlaybookRunStore, updateMetricsTaskFrequency time.Duration) {
	metricsUpdater := func() {
		if playbooksActiveTotal, err := playbookStore.GetPlaybooksActiveTotal(); err == nil {
			pp.metricsService.ObservePlaybooksActiveTotal(playbooksActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, playbooks_active_total")
		}

		if runsActiveTotal, err := playbookRunStore.GetRunsActiveTotal(); err == nil {
			pp.metricsService.ObserveRunsActiveTotal(runsActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, runs_active_total")
		}

		if remindersOverdueTotal, err := playbookRunStore.GetOverdueUpdateRunsTotal(); err == nil {
			pp.metricsService.ObserveRemindersOutstandingTotal(remindersOverdueTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, reminders_outstanding_total")
		}

		if retrosOverdueTotal, err := playbookRunStore.GetOverdueRetroRunsTotal(); err == nil {
			pp.metricsService.ObserveRetrosOutstandingTotal(retrosOverdueTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, retros_outstanding_total")
		}

		if followersActiveTotal, err := playbookRunStore.GetFollowersActiveTotal(); err == nil {
			pp.metricsService.ObserveFollowersActiveTotal(followersActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, followers_active_total")
		}

		if participantsActiveTotal, err := playbookRunStore.GetParticipantsActiveTotal(); err == nil {
			pp.metricsService.ObserveParticipantsActiveTotal(participantsActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, participants_active_total")
		}
	}

	scheduler.CreateRecurringTask("metricsUpdater", metricsUpdater, updateMetricsTaskFrequency)
}

func (pp *playbooksProduct) getErrorCounterHandler() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			recorder := &StatusRecorder{
				ResponseWriter: w,
				Status:         200,
			}
			next.ServeHTTP(recorder, r)
			if recorder.Status < 200 || recorder.Status > 299 {
				pp.metricsService.IncrementErrorsCount(1)
			}
		})
	}
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (pp *playbooksProduct) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	pp.handler.ServeHTTP(w, r)
}

//
// These callbacks are called by the suite automatically
//

func (pp *playbooksProduct) OnConfigurationChange() error {
	if pp.config == nil {
		return nil
	}
	return pp.config.OnConfigurationChange()
}
