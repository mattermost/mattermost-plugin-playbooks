package sqlstore

import (
	"database/sql"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-incident-response/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/stretchr/testify/require"
)

var driverNames = []string{model.DATABASE_DRIVER_POSTGRES, model.DATABASE_DRIVER_MYSQL}

func setupTestDB(t *testing.T, driverName string) *sqlx.DB {
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

func setupSQLStore(t *testing.T, db *sqlx.DB) (PluginAPIClient, bot.Logger, *SQLStore) {
	t.Helper()

	mockCtrl := gomock.NewController(t)

	logger := mock_bot.NewMockLogger(mockCtrl)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	driverName := db.DriverName()
	configAPI.EXPECT().
		GetConfig().
		Return(&model.Config{
			SqlSettings: model.SqlSettings{DriverName: &driverName},
		}).
		Times(1)

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		logger,
		db,
		builder,
		nil,
	}

	kvAPI.EXPECT().
		Get("v2_playbookindex", gomock.Any()).
		SetArg(1, oldPlaybookIndex{}).
		Times(1)

	kvAPI.EXPECT().
		Get("v2_all_headers", gomock.Any()).
		SetArg(1, map[string]oldHeader{}).
		Times(1)

	logger.EXPECT().Debugf(gomock.AssignableToTypeOf("string")).Times(2)

	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	require.NoError(t, err)

	if currentSchemaVersion.LT(LatestVersion()) {
		err = sqlStore.Migrate(pluginAPIClient, currentSchemaVersion)
		require.NoError(t, err)
	}

	return pluginAPIClient, logger, sqlStore
}

func setupUsersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	// NOTE: for this and the other tables below, this is a now out-of-date schema, which doesn't
	//       reflect any of the changes past v5.0. If the test code requires a new column, you will
	//       need to update these tables accordingly.
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.users (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				deleteat bigint,
				username character varying(64),
				password character varying(128),
				authdata character varying(128),
				authservice character varying(32),
				email character varying(128),
				emailverified boolean,
				nickname character varying(64),
				firstname character varying(64),
				lastname character varying(64),
				"position" character varying(128),
				roles character varying(256),
				allowmarketing boolean,
				props character varying(4000),
				notifyprops character varying(2000),
				lastpasswordupdate bigint,
				lastpictureupdate bigint,
				failedattempts integer,
				locale character varying(5),
				timezone character varying(256),
				mfaactive boolean,
				mfasecret character varying(128)
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Users (
				Id varchar(26) NOT NULL,
				CreateAt bigint(20) DEFAULT NULL,
				UpdateAt bigint(20) DEFAULT NULL,
				DeleteAt bigint(20) DEFAULT NULL,
				Username varchar(64) DEFAULT NULL,
				Password varchar(128) DEFAULT NULL,
				AuthData varchar(128) DEFAULT NULL,
				AuthService varchar(32) DEFAULT NULL,
				Email varchar(128) DEFAULT NULL,
				EmailVerified tinyint(1) DEFAULT NULL,
				Nickname varchar(64) DEFAULT NULL,
				FirstName varchar(64) DEFAULT NULL,
				LastName varchar(64) DEFAULT NULL,
				Position varchar(128) DEFAULT NULL,
				Roles text,
				AllowMarketing tinyint(1) DEFAULT NULL,
				Props text,
				NotifyProps text,
				LastPasswordUpdate bigint(20) DEFAULT NULL,
				LastPictureUpdate bigint(20) DEFAULT NULL,
				FailedAttempts int(11) DEFAULT NULL,
				Locale varchar(5) DEFAULT NULL,
				Timezone text,
				MfaActive tinyint(1) DEFAULT NULL,
				MfaSecret varchar(128) DEFAULT NULL,
				PRIMARY KEY (Id),
				UNIQUE KEY Username (Username),
				UNIQUE KEY AuthData (AuthData),
				UNIQUE KEY Email (Email),
				KEY idx_users_email (Email),
				KEY idx_users_update_at (UpdateAt),
				KEY idx_users_create_at (CreateAt),
				KEY idx_users_delete_at (DeleteAt),
				FULLTEXT KEY idx_users_all_txt (Username,FirstName,LastName,Nickname,Email),
				FULLTEXT KEY idx_users_all_no_full_name_txt (Username,Nickname,Email),
				FULLTEXT KEY idx_users_names_txt (Username,FirstName,LastName,Nickname),
				FULLTEXT KEY idx_users_names_no_full_name_txt (Username,Nickname)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelMemberHistoryTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channelmemberhistory (
				channelid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				jointime bigint NOT NULL,
				leavetime bigint
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS ChannelMemberHistory (
				ChannelId varchar(26) NOT NULL,
				UserId varchar(26) NOT NULL,
				JoinTime bigint(20) NOT NULL,
				LeaveTime bigint(20) DEFAULT NULL,
				PRIMARY KEY (ChannelId,UserId,JoinTime)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupTeamMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.teammembers (
				teamid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				roles character varying(64),
				deleteat bigint,
				schemeuser boolean,
				schemeadmin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS TeamMembers (
			  TeamId varchar(26) NOT NULL,
			  UserId varchar(26) NOT NULL,
			  Roles varchar(64) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  SchemeUser tinyint(4) DEFAULT NULL,
			  SchemeAdmin tinyint(4) DEFAULT NULL,
			  PRIMARY KEY (TeamId,UserId),
			  KEY idx_teammembers_team_id (TeamId),
			  KEY idx_teammembers_user_id (UserId),
			  KEY idx_teammembers_delete_at (DeleteAt)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channelmembers (
				channelid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				roles character varying(64),
				lastviewedat bigint,
				msgcount bigint,
				mentioncount bigint,
				notifyprops character varying(2000),
				lastupdateat bigint,
				schemeuser boolean,
				schemeadmin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS ChannelMembers (
			  ChannelId varchar(26) NOT NULL,
			  UserId varchar(26) NOT NULL,
			  Roles varchar(64) DEFAULT NULL,
			  LastViewedAt bigint(20) DEFAULT NULL,
			  MsgCount bigint(20) DEFAULT NULL,
			  MentionCount bigint(20) DEFAULT NULL,
			  NotifyProps text,
			  LastUpdateAt bigint(20) DEFAULT NULL,
			  SchemeUser tinyint(4) DEFAULT NULL,
			  SchemeAdmin tinyint(4) DEFAULT NULL,
			  PRIMARY KEY (ChannelId,UserId),
			  KEY idx_channelmembers_channel_id (ChannelId),
			  KEY idx_channelmembers_user_id (UserId)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelsTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channels (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				deleteat bigint,
				teamid character varying(26),
				type character varying(1),
				displayname character varying(64),
				name character varying(64),
				header character varying(1024),
				purpose character varying(250),
				lastpostat bigint,
				totalmsgcount bigint,
				extraupdateat bigint,
				creatorid character varying(26),
				schemeid character varying(26)
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE Channels (
			  Id varchar(26) NOT NULL,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  TeamId varchar(26) DEFAULT NULL,
			  Type varchar(1) DEFAULT NULL,
			  DisplayName varchar(64) DEFAULT NULL,
			  Name varchar(64) DEFAULT NULL,
			  Header text,
			  Purpose varchar(250) DEFAULT NULL,
			  LastPostAt bigint(20) DEFAULT NULL,
			  TotalMsgCount bigint(20) DEFAULT NULL,
			  ExtraUpdateAt bigint(20) DEFAULT NULL,
			  CreatorId varchar(26) DEFAULT NULL,
			  SchemeId varchar(26) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  UNIQUE KEY Name (Name,TeamId),
			  KEY idx_channels_team_id (TeamId),
			  KEY idx_channels_name (Name),
			  KEY idx_channels_update_at (UpdateAt),
			  KEY idx_channels_create_at (CreateAt),
			  KEY idx_channels_delete_at (DeleteAt),
			  FULLTEXT KEY idx_channels_txt (Name,DisplayName)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func addUsers(t *testing.T, store *SQLStore, userIDs []string) {
	t.Helper()

	insertBuilder := store.builder.Insert("Users").Columns("ID")

	for _, u := range userIDs {
		insertBuilder = insertBuilder.Values(u)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToTeam(t *testing.T, store *SQLStore, userIDs []string, teamID string) {
	t.Helper()

	insertBuilder := store.builder.Insert("TeamMembers").Columns("TeamId", "UserId")

	for _, u := range userIDs {
		insertBuilder = insertBuilder.Values(teamID, u)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToChannels(t *testing.T, store *SQLStore, userIDs, channelIDs []string) {
	t.Helper()

	insertBuilder := store.builder.Insert("ChannelMembers").Columns("ChannelId", "UserId")

	for _, u := range userIDs {
		for _, c := range channelIDs {
			insertBuilder = insertBuilder.Values(c, u)
		}
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func makeChannelsPublicOrPrivate(t *testing.T, store *SQLStore, channelIDs []string, makePublic bool) {
	t.Helper()

	channelType := "P"
	if makePublic {
		channelType = "O"
	}

	insertBuilder := store.builder.Insert("Channels").Columns("Id", "Type")

	for _, c := range channelIDs {
		insertBuilder = insertBuilder.Values(c, channelType)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func makeAdmin(t *testing.T, store *SQLStore, userID string) {
	t.Helper()

	updateBuilder := store.builder.
		Update("Users").
		Where(sq.Eq{"Id": userID}).
		Set("Roles", "role1 role2 system_admin role3")

	_, err := store.execBuilder(store.db, updateBuilder)
	require.NoError(t, err)
}
