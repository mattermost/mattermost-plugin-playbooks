// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/product/adapters"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
	"github.com/mattermost/mattermost-plugin-playbooks/server/scheduler"
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
	mmapp.RegisterProduct(playbooksProductName, mmapp.ProductManifest{
		Initializer: newPlaybooksProduct,
		Dependencies: map[mmapp.ServiceKey]struct{}{
			mmapp.TeamKey:          {},
			mmapp.ChannelKey:       {},
			mmapp.UserKey:          {},
			mmapp.PostKey:          {},
			mmapp.BotKey:           {},
			mmapp.ClusterKey:       {},
			mmapp.ConfigKey:        {},
			mmapp.LogKey:           {},
			mmapp.LicenseKey:       {},
			mmapp.FilestoreKey:     {},
			mmapp.FileInfoStoreKey: {},
			mmapp.RouterKey:        {},
			mmapp.CloudKey:         {},
			mmapp.KVStoreKey:       {},
			mmapp.StoreKey:         {},
			mmapp.SystemKey:        {},
			mmapp.PreferencesKey:   {},
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
	channelActionService app.ChannelActionService
	categoryService      app.CategoryService
	bot                  *bot.Bot
	userInfoStore        app.UserInfoStore
	telemetryClient      TelemetryClient
	licenseChecker       app.LicenseChecker
	metricsService       *metrics.Metrics

	plugin.MattermostPlugin
}

func newPlaybooksProduct(server *mmapp.Server, services map[mmapp.ServiceKey]interface{}) (mmapp.Product, error) {
	playbooks := &playbooksProduct{}

	for key, service := range services {
		switch key {
		case mmapp.TeamKey:
			teamService, ok := service.(product.TeamService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.teamService = teamService
		case mmapp.ChannelKey:
			channelService, ok := service.(product.ChannelService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.channelService = channelService
		case mmapp.UserKey:
			userService, ok := service.(product.UserService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.userService = userService
		case mmapp.PostKey:
			postService, ok := service.(product.PostService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.postService = postService
		case mmapp.PermissionsKey:
			permissionsService, ok := service.(product.PermissionService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.permissionsService = permissionsService
		case mmapp.BotKey:
			botService, ok := service.(product.BotService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.botService = botService
		case mmapp.ClusterKey:
			clusterService, ok := service.(product.ClusterService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.clusterService = clusterService
		case mmapp.ConfigKey:
			configService, ok := service.(product.ConfigService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.configService = configService
		case mmapp.LogKey:
			logger, ok := service.(mlog.LoggerIFace)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.logger = logger.With(mlog.String("product", playbooksProductName))
		case mmapp.LicenseKey:
			licenseService, ok := service.(product.LicenseService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.licenseService = licenseService
		case mmapp.FilestoreKey:
			filestoreService, ok := service.(product.FilestoreService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.filestoreService = filestoreService
		case mmapp.FileInfoStoreKey:
			fileInfoStoreService, ok := service.(product.FileInfoStoreService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.fileInfoStoreService = fileInfoStoreService
		case mmapp.RouterKey:
			routerService, ok := service.(product.RouterService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.routerService = routerService
		case mmapp.CloudKey:
			cloudService, ok := service.(product.CloudService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.cloudService = cloudService
		case mmapp.KVStoreKey:
			kvStoreService, ok := service.(product.KVStoreService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.kvStoreService = kvStoreService
		case mmapp.StoreKey:
			storeService, ok := service.(product.StoreService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.storeService = storeService
		case mmapp.SystemKey:
			systemService, ok := service.(product.SystemService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.systemService = systemService
		case mmapp.PreferencesKey:
			preferencesService, ok := service.(product.PreferencesService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.preferencesService = preferencesService
		case mmapp.HooksKey:
			hooksService, ok := service.(product.HooksService)
			if !ok {
				return nil, fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			playbooks.hooksService = hooksService
		}
	}
	return playbooks, nil
}

func (pp *playbooksProduct) Start() error {
	logger := logrus.StandardLogger()
	ConfigureLogrus(logger, pp.logger)
	logrus.Warn("################ Playbooks product start ##################")

	serviceAdapter := newServiceAPIAdapter(pp)
	pluginAPIAdapter := adapters.NewPluginAPIAdapter(playbooksProductID, pp.configService, manifest)
	botID, err := serviceAdapter.EnsureBot(&model.Bot{
		Username:    "playbooks",
		DisplayName: "Playbooks",
		Description: "Playbooks bot.",
		OwnerId:     "playbooks",
	})
	if err != nil {
		return errors.Wrapf(err, "failed to ensure bot")
	}

	pp.config = config.NewConfigService(serviceAdapter, pluginAPIAdapter, manifest)
	err = pp.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrapf(err, "failed save bot to config")
	}

	pp.handler = api.NewHandler(pp.config)

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
		logrus.Warn("################ 003 ##################")

	}

	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		logrus.Warn("Rudder credentials are not set. Disabling analytics.")
		pp.telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := serviceAdapter.GetDiagnosticID()
		serverVersion := pluginAPIAdapter.GetServerVersion()
		pp.telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, manifest.Version, serverVersion)
		if err != nil {
			return errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := pluginAPIAdapter.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = pp.telemetryClient.Enable(); err != nil {
				logrus.WithError(err).Error("Telemetry could not be enabled")
			}
			return
		}

		if err = pp.telemetryClient.Disable(); err != nil {
			logrus.WithError(err).Error("Telemetry could not be disabled")
		}
	}

	toggleTelemetry()
	pp.config.RegisterConfigChangeListener(toggleTelemetry)

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
