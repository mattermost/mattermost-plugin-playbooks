package sqlstore

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"

	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/golang/mock/gomock"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestMigrations(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	logger := mock_bot.NewMockLogger(mockCtrl)
	logger.EXPECT().Debugf(gomock.AssignableToTypeOf("string")).Times(2)
	scheduler := mock_app.NewMockJobOnceScheduler(mockCtrl)

	for _, driver := range driverNames {
		builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
		if driver == model.DatabaseDriverPostgres {
			builder = builder.PlaceholderFormat(sq.Dollar)
		}

		t.Run("Run every migration twice", func(t *testing.T) {
			db := setupTestDB(t, driver)
			sqlStore := &SQLStore{
				logger,
				db,
				builder,
				scheduler,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

			// Migration to 0.10.0 needs the Channels table to work
			setupChannelsTable(t, db)
			// Migration to 0.21.0 need the Posts table
			setupPostsTable(t, db)
			// Migration to 0.31.0 needs the PluginKeyValueStore
			setupKVStoreTable(t, db)

			// Apply each migration twice
			for _, migration := range migrations {
				for i := 0; i < 2; i++ {
					err := sqlStore.migrate(migration)
					require.NoError(t, err)

					currentSchemaVersion, err := sqlStore.GetCurrentVersion()
					require.NoError(t, err)
					require.Equal(t, currentSchemaVersion, migration.toVersion)
				}
			}
		})

		t.Run("Run the whole set of migrations twice", func(t *testing.T) {
			db := setupTestDB(t, driver)
			sqlStore := &SQLStore{
				logger,
				db,
				builder,
				scheduler,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

			// Migration to 0.10.0 needs the Channels table to work
			setupChannelsTable(t, db)
			// Migration to 0.21.0 need the Posts table
			setupPostsTable(t, db)
			// Migration to 0.31.0 needs the PluginKeyValueStore
			setupKVStoreTable(t, db)

			// Apply the whole set of migrations twice
			for i := 0; i < 2; i++ {
				for _, migration := range migrations {
					err := sqlStore.migrate(migration)
					require.NoError(t, err)

					currentSchemaVersion, err := sqlStore.GetCurrentVersion()
					require.NoError(t, err)
					require.Equal(t, currentSchemaVersion, migration.toVersion)
				}
			}
		})

		t.Run("force incidents to have a reminder set", func(t *testing.T) {
			db := setupTestDB(t, driver)
			sqlStore := &SQLStore{
				logger,
				db,
				builder,
				scheduler,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

			// Migration to 0.10.0 needs the Channels table to work
			setupChannelsTable(t, db)
			// Migration to 0.21.0 need the Posts table
			setupPostsTable(t, db)
			// Migration to 0.31.0 needs the PluginKeyValueStore
			setupKVStoreTable(t, db)

			// Apply the migrations up to and including 0.36
			migrateUpTo(t, sqlStore, semver.MustParse("0.36.0"))

			now := time.Now()
			// Insert runs to test
			expired, err := insertRunWithExpiredReminder(sqlStore, 1*time.Minute)
			require.NoError(t, err)
			noReminder, err := insertRunWithNoReminder(sqlStore)
			require.NoError(t, err)
			oldExpired, err := insertRunWithExpiredReminder(sqlStore, 4*24*time.Hour)
			require.NoError(t, err)
			activeReminder, err := insertRunWithActiveReminder(sqlStore, 24*time.Hour)
			require.NoError(t, err)
			inactive1, err := insertInactiveRunWithExpiredReminder(sqlStore, 23*time.Hour)
			require.NoError(t, err)
			inactive2, err := insertInactiveRunWithNoReminder(sqlStore)
			require.NoError(t, err)

			// set expected calls we will get below when we run migration
			newReminder := 24 * 7 * time.Hour
			scheduler.EXPECT().Cancel(expired)
			scheduler.EXPECT().ScheduleOnce(expired, gomock.Any()).
				Return(nil, nil).
				Times(1).
				Do(func(id string, at time.Time) {
					shouldHaveReminderBefore := now.Add(newReminder + 1*time.Second)
					shouldHaveReminderAfter := now.Add(newReminder - 1*time.Second)
					if at.Before(shouldHaveReminderAfter) || at.After(shouldHaveReminderBefore) {
						t.Errorf("expected call to ScheduleOnce: %d to be after: %d and before: %d",
							model.GetMillisForTime(at), model.GetMillisForTime(shouldHaveReminderAfter),
							model.GetMillisForTime(shouldHaveReminderBefore))
					}
				})
			scheduler.EXPECT().Cancel(noReminder)
			scheduler.EXPECT().ScheduleOnce(noReminder, gomock.Any()).
				Return(nil, nil).
				Times(1).
				Do(func(id string, at time.Time) {
					shouldHaveReminderBefore := now.Add(newReminder + 1*time.Second)
					shouldHaveReminderAfter := now.Add(newReminder - 1*time.Second)
					if at.Before(shouldHaveReminderAfter) || at.After(shouldHaveReminderBefore) {
						t.Errorf("expected call to ScheduleOnce: %d to be after: %d and before: %d",
							model.GetMillisForTime(at), model.GetMillisForTime(shouldHaveReminderAfter),
							model.GetMillisForTime(shouldHaveReminderBefore))
					}
				})
			scheduler.EXPECT().Cancel(oldExpired)
			scheduler.EXPECT().ScheduleOnce(oldExpired, gomock.Any()).
				Return(nil, nil).
				Times(1).
				Do(func(id string, at time.Time) {
					shouldHaveReminderBefore := now.Add(newReminder + 1*time.Second)
					shouldHaveReminderAfter := now.Add(newReminder - 1*time.Second)
					if at.Before(shouldHaveReminderAfter) || at.After(shouldHaveReminderBefore) {
						t.Errorf("expected call to ScheduleOnce: %d to be after: %d and before: %d",
							model.GetMillisForTime(at), model.GetMillisForTime(shouldHaveReminderAfter),
							model.GetMillisForTime(shouldHaveReminderBefore))
					}
				})

			// Apply the migrations from 0.37-on
			migrateFrom(t, sqlStore, semver.MustParse("0.36.0"))

			// Test that the runs that should have been changed now have new reminders
			expiredRun, err := getRun(expired, sqlStore)
			require.NoError(t, err)
			require.Equal(t, expiredRun.PreviousReminder, newReminder)
			noReminderRun, err := getRun(noReminder, sqlStore)
			require.NoError(t, err)
			require.Equal(t, noReminderRun.PreviousReminder, newReminder)

			// Test that the runs that should not have been changed do /not/ have new reminders
			activeReminderRun, err := getRun(activeReminder, sqlStore)
			require.NoError(t, err)
			require.Equal(t, activeReminderRun.PreviousReminder, 24*time.Hour)
			inactive1Run, err := getRun(inactive1, sqlStore)
			require.NoError(t, err)
			require.Equal(t, inactive1Run.PreviousReminder, 23*time.Hour)
			inactive2Run, err := getRun(inactive2, sqlStore)
			require.NoError(t, err)
			require.Equal(t, inactive2Run.PreviousReminder, time.Duration(0))
		})

		t.Run("copy Description column into new RunSummaryTemplate", func(t *testing.T) {
			db := setupTestDB(t, driver)
			sqlStore := &SQLStore{
				logger,
				db,
				builder,
				scheduler,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

			// Migration to 0.10.0 needs the Channels table to work
			setupChannelsTable(t, db)
			// Migration to 0.21.0 need the Posts table
			setupPostsTable(t, db)
			// Migration to 0.31.0 needs the PluginKeyValueStore
			setupKVStoreTable(t, db)

			// Apply the migrations up to and including 0.38
			migrateUpTo(t, sqlStore, semver.MustParse("0.38.0"))

			playbookWithDescriptionID := model.NewId()
			nonEmptyDescription := "a non-empty description"

			// Insert a playbook with a non-empty description
			_, err = sqlStore.execBuilder(sqlStore.db, sq.
				Insert("IR_Playbook").
				SetMap(map[string]interface{}{
					"ID":          playbookWithDescriptionID,
					"Description": nonEmptyDescription,
					// Have to be set:
					"Title":                                "Playbook",
					"TeamID":                               model.NewId(),
					"CreatePublicIncident":                 true,
					"CreateAt":                             0,
					"DeleteAt":                             0,
					"ChecklistsJSON":                       []byte("{}"),
					"NumStages":                            0,
					"NumSteps":                             0,
					"ReminderTimerDefaultSeconds":          0,
					"RetrospectiveReminderIntervalSeconds": 0,
					"UpdateAt":                             0,
					"ExportChannelOnFinishedEnabled":       false,
				}))
			require.NoError(t, err)

			playbookWithEmptyDescriptionID := model.NewId()

			// Insert a playbook with an empty description
			_, err = sqlStore.execBuilder(sqlStore.db, sq.
				Insert("IR_Playbook").
				SetMap(map[string]interface{}{
					"ID":          playbookWithEmptyDescriptionID,
					"Description": "",
					// Have to be set:
					"Title":                                "Playbook",
					"Teamid":                               model.NewId(),
					"CreatePublicIncident":                 true,
					"CreateAt":                             0,
					"DeleteAt":                             0,
					"ChecklistsJSON":                       []byte("{}"),
					"NumStages":                            0,
					"NumSteps":                             0,
					"ReminderTimerDefaultSeconds":          0,
					"RetrospectiveReminderIntervalSeconds": 0,
					"UpdateAt":                             0,
					"ExportChannelOnFinishedEnabled":       false,
				}))
			require.NoError(t, err)

			// Apply the migrations from 0.38-on
			migrateFrom(t, sqlStore, semver.MustParse("0.38.0"))

			// Get the playbook with the non-empty description
			var playbookWithDescription app.Playbook
			err = sqlStore.getBuilder(sqlStore.db, &playbookWithDescription, sqlStore.builder.
				Select("ID", "Description", "RunSummaryTemplate").
				From("IR_Playbook").
				Where(sq.Eq{"ID": playbookWithDescriptionID}))
			require.NoError(t, err)

			// Get the playbook with the empty description
			var playbookWithEmptyDescription app.Playbook
			err = sqlStore.getBuilder(sqlStore.db, &playbookWithEmptyDescription, sqlStore.builder.
				Select("ID", "Description", "RunSummaryTemplate").
				From("IR_Playbook").
				Where(sq.Eq{"ID": playbookWithEmptyDescriptionID}))
			require.NoError(t, err)

			// Check that the copy was successful in the playbook with the non-empty description
			require.Equal(t, playbookWithDescription.Description, "")
			require.Equal(t, playbookWithDescription.RunSummaryTemplate, nonEmptyDescription)

			// Check that the copy was successful in the playbook with the empty description
			require.Equal(t, playbookWithEmptyDescription.Description, "")
			require.Equal(t, playbookWithEmptyDescription.RunSummaryTemplate, "")
		})
	}
}

func insertRunWithExpiredReminder(sqlStore *SQLStore, reminderExpiredAgo time.Duration) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                 id,
			"CreateAt":           model.GetMillis(),
			"PreviousReminder":   24 * time.Hour,
			"CurrentStatus":      app.StatusInProgress,
			"LastStatusUpdateAt": model.GetMillisForTime(time.Now().Add(-24*time.Hour - reminderExpiredAgo)),
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertRunWithNoReminder(sqlStore *SQLStore) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":            id,
			"CreateAt":      model.GetMillis(),
			"CurrentStatus": app.StatusInProgress,
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertRunWithActiveReminder(sqlStore *SQLStore, previousReminder time.Duration) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                 id,
			"CreateAt":           model.GetMillis(),
			"PreviousReminder":   previousReminder,
			"CurrentStatus":      app.StatusInProgress,
			"LastStatusUpdateAt": model.GetMillisForTime(time.Now().Add(-24*time.Hour + 10*time.Second)),
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertInactiveRunWithExpiredReminder(sqlStore *SQLStore, previousReminder time.Duration) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                 id,
			"CreateAt":           model.GetMillis(),
			"PreviousReminder":   previousReminder,
			"CurrentStatus":      app.StatusFinished,
			"LastStatusUpdateAt": model.GetMillisForTime(time.Now().Add(-25 * time.Hour)),
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertInactiveRunWithNoReminder(sqlStore *SQLStore) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":            id,
			"CreateAt":      model.GetMillis(),
			"CurrentStatus": app.StatusFinished,
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func getRun(id string, sqlStore *SQLStore) (app.PlaybookRun, error) {
	var run app.PlaybookRun
	err := sqlStore.getBuilder(sqlStore.db, &run, sqlStore.builder.
		Select("ID", "Name", "CreateAt", "PreviousReminder", "CurrentStatus", "LastStatusUpdateAt").
		From("IR_Incident").
		Where(sq.Eq{"ID": id}))
	return run, err
}

func TestHasConsistentCharset(t *testing.T) {
	t.Run("MySQL", func(t *testing.T) {
		db := setupTestDB(t, model.DatabaseDriverMysql)
		setupPlaybookStore(t, db) // To run the migrations and everything
		badCharsets := []string{}
		err := db.Select(&badCharsets, `
			SELECT tab.table_name
			FROM   information_schema.tables tab
			WHERE  tab.table_schema NOT IN ( 'mysql', 'information_schema',
											 'performance_schema',
											 'sys' )
			AND tab.table_schema = (SELECT DATABASE())
			AND NOT (tab.table_collation = 'utf8mb4_general_ci' OR tab.table_collation = 'utf8mb4_0900_ai_ci')
		`)
		require.Len(t, badCharsets, 0)
		require.NoError(t, err)
	})
}

func TestHasPrimaryKeys(t *testing.T) {
	t.Run("MySQL", func(t *testing.T) {
		db := setupTestDB(t, model.DatabaseDriverMysql)
		setupPlaybookStore(t, db) // To run the migrations and everything
		tablesWithoutPrimaryKeys := []string{}
		err := db.Select(&tablesWithoutPrimaryKeys, `
			SELECT tab.table_name
				   AS tablename
			FROM   information_schema.tables tab
				   LEFT JOIN information_schema.table_constraints tco
						  ON tab.table_schema = tco.table_schema
							 AND tab.table_name = tco.table_name
							 AND tco.constraint_type = 'PRIMARY KEY'
				   LEFT JOIN information_schema.key_column_usage kcu
						  ON tco.constraint_schema = kcu.constraint_schema
							 AND tco.constraint_name = kcu.constraint_name
							 AND tco.table_name = kcu.table_name
			WHERE tab.table_schema = (SELECT DATABASE())
			AND tco.constraint_name is NULL
			GROUP  BY tab.table_schema,
					  tab.table_name,
					  tco.constraint_name
		`)
		require.Len(t, tablesWithoutPrimaryKeys, 0)
		require.NoError(t, err)
	})

	t.Run("Postgres", func(t *testing.T) {
		db := setupTestDB(t, model.DatabaseDriverPostgres)
		setupPlaybookStore(t, db) // To run the migrations and everything
		tablesWithoutPrimaryKeys := []string{}
		err := db.Select(&tablesWithoutPrimaryKeys, `
			SELECT tab.table_name AS pk_name
			FROM   information_schema.tables tab
				   LEFT JOIN information_schema.table_constraints tco
						  ON tco.table_schema = tab.table_schema
							 AND tco.table_name = tab.table_name
							 AND tco.constraint_type = 'PRIMARY KEY'
				   LEFT JOIN information_schema.key_column_usage kcu
						  ON kcu.constraint_name = tco.constraint_name
							 AND kcu.constraint_schema = tco.constraint_schema
							 AND kcu.constraint_name = tco.constraint_name
			WHERE  tab.table_schema NOT IN ( 'pg_catalog', 'information_schema' )
				   AND tab.table_type = 'BASE TABLE'
				   AND tab.table_catalog = (SELECT current_database())
				   AND tco.constraint_name is NULL
			GROUP  BY tab.table_schema,
					  tab.table_name,
					  tco.constraint_name
		`)
		require.Len(t, tablesWithoutPrimaryKeys, 0)
		require.NoError(t, err)
	})

}
