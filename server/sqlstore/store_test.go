package sqlstore

import (
	"fmt"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/golang/mock/gomock"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestMigrationIdempotency(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	logger := mock_bot.NewMockLogger(mockCtrl)
	logger.EXPECT().Debugf(gomock.AssignableToTypeOf("string")).Times(2)

	for _, driver := range driverNames {
		fmt.Println(driver)
		builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
		if driver == model.DATABASE_DRIVER_POSTGRES {
			builder = builder.PlaceholderFormat(sq.Dollar)
		}

		t.Run("Run every migration twice", func(t *testing.T) {
			sqlStore := &SQLStore{
				log:     logger,
				db:      setupTestDB(t, driver),
				builder: builder,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

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
			sqlStore := &SQLStore{
				log:     logger,
				db:      setupTestDB(t, driver),
				builder: builder,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

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
	}
}
