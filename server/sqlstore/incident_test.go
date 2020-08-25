package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/stretchr/testify/require"
)

func SetupTestDB(t *testing.T, driverName string) *sqlx.DB {
	t.Helper()

	sqlSettings := storetest.MakeSqlSettings(driverName)

	origDB, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)

	db := sqlx.NewDb(origDB, driverName)
	if driverName == model.DATABASE_DRIVER_MYSQL {
		db.MapperFunc(func(s string) string { return s })
	}

	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
		storetest.CleanupSqlSettings(sqlSettings)
	})

	return db
}

func SetupSQLStore(t *testing.T, driverName string, logger bot.Logger) *SQLStore {
	t.Helper()

	sqlStore := &SQLStore{
		logger,
		SetupTestDB(t, driverName),
	}

	err := migrations[0].migrationFunc(sqlStore)
	require.NoError(t, err)

	return sqlStore
}

func SetupIncidentStore(t *testing.T, driverName string) incident.Store {
	mockCtrl := gomock.NewController(t)

	logger := mock_bot.NewMockLogger(mockCtrl)

	pluginAPI := &plugintest.API{}
	client := pluginapi.NewClient(pluginAPI)
	pluginAPI.On("GetConfig").Return(&model.Config{
		SqlSettings: model.SqlSettings{DriverName: &driverName},
	})

	return NewIncidentStore(NewClient(client), logger, SetupSQLStore(t, driverName, logger))
}

func tRun(t *testing.T, testName string, test func(t *testing.T, driverName string)) {
	driverNames := []string{model.DATABASE_DRIVER_POSTGRES, model.DATABASE_DRIVER_MYSQL}

	for _, driverName := range driverNames {
		t.Run(driverName+" - "+testName, func(t *testing.T) { test(t, driverName) })
	}
}

func TestCreateIncident(t *testing.T) {
	validIncidents := []incident.Incident{
		{},
		{
			Header: incident.Header{
				Name:            "my_incident",
				IsActive:        true,
				CommanderUserID: model.NewId(),
				TeamID:          model.NewId(),
				ChannelID:       model.NewId(),
				CreateAt:        model.GetMillis(),
				EndAt:           0,
				DeleteAt:        0,
				ActiveStage:     0,
			},
			PostID:     model.NewId(),
			PlaybookID: model.NewId(),
			Checklists: []playbook.Checklist{},
		},
	}

	invalidIncidents := []*incident.Incident{
		nil,
		{
			Header: incident.Header{
				ID: "this should not be set",
			},
		},
	}

	tRun(t, "Create valid incident", func(t *testing.T, driverName string) {
		incidentStore := SetupIncidentStore(t, driverName)

		for _, incident := range validIncidents {
			actualIncident, err := incidentStore.CreateIncident(&incident)
			require.NoError(t, err)
			require.NotEqual(t, "", actualIncident.ID)

			expectedIncident := incident
			expectedIncident.ID = actualIncident.ID

			require.Equal(t, &expectedIncident, actualIncident)
		}
	})

	tRun(t, "Create invalid incident", func(t *testing.T, driverName string) {
		incidentStore := SetupIncidentStore(t, driverName)

		for _, incident := range invalidIncidents {
			createdIncident, err := incidentStore.CreateIncident(incident)
			require.Nil(t, createdIncident)
			require.Error(t, err)
		}
	})
}
