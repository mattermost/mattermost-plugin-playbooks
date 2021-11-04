package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/api4"
	sapp "github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
	"github.com/mattermost/mattermost-server/v6/utils"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	// Run the plugin under test if the server is trying to run us as a plugin.
	value := os.Getenv("MATTERMOST_PLUGIN")
	if value == "Securely message teams, anywhere." {
		plugin.ClientMain(&Plugin{})
		return
	}

	serverpathBytes, err := exec.Command("go", "list", "-f", "'{{.Dir}}'", "-m", "github.com/mattermost/mattermost-server/v6").Output()
	if err != nil {
		panic(err)
	}
	serverpath := string(serverpathBytes)
	serverpath = strings.Trim(strings.TrimSpace(serverpath), "'")
	os.Setenv("MM_SERVER_PATH", serverpath)

	// This actually runs the tests
	status := m.Run()

	os.Exit(status)
}

type PermissionsHelper interface {
	SaveDefaultRolePermissions() map[string][]string
	RestoreDefaultRolePermissions(data map[string][]string)
	RemovePermissionFromRole(permission string, roleName string)
	AddPermissionToRole(permission string, roleName string)
}

type serverPermissionsWrapper struct {
	api4.TestHelper
}

type TestEnvironment struct {
	T   testing.TB
	Srv *sapp.Server
	A   *sapp.App

	Permissions PermissionsHelper

	ServerAdminClient    *model.Client4
	PlaybooksAdminClient *client.Client
	ServerClient         *model.Client4
	PlaybooksClient      *client.Client

	UnauthenticatedPlaybooksClient *client.Client

	BasicTeam               *model.Team
	BasicPublicChannel      *model.Channel
	BasicPublicChannelPost  *model.Post
	BasicPrivateChannel     *model.Channel
	BasicPrivateChannelPost *model.Post
	BasicPlaybook           *client.Playbook
	AdminUser               *model.User
	RegularUser             *model.User
}

func getEnvWithDefault(name, defaultValue string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return defaultValue
}

func Setup(t *testing.T) *TestEnvironment {
	// Enviroment Settings
	driverName := getEnvWithDefault("TEST_DATABASE_DRIVERNAME", "postgres")

	sqlSettings := storetest.MakeSqlSettings(driverName, false)

	// Directories for plugin stuff
	dir := t.TempDir()
	clientDir := t.TempDir()
	playbooksDir := path.Join(dir, "playbooks")
	binaryDir := path.Join(playbooksDir, "server", "dist")
	pluginBinary := path.Join(binaryDir, "plugin-"+runtime.GOOS+"-"+runtime.GOARCH)
	pluginManifest := path.Join(playbooksDir, "plugin.json")
	assetsDir := path.Join(playbooksDir, "assets")

	// Create a test memory store and modify configuration appropriately
	configStore := config.NewTestMemoryStore()
	config := configStore.Get()
	config.PluginSettings.Directory = &dir
	config.PluginSettings.ClientDirectory = &clientDir
	addr := "localhost:9056"
	config.ServiceSettings.ListenAddress = &addr
	config.TeamSettings.MaxUsersPerTeam = model.NewInt(10000)
	config.LocalizationSettings.SetDefaults()
	config.SqlSettings = *sqlSettings
	_, _, err := configStore.Set(config)
	require.NoError(t, err)

	// Copy ourselves into the correct directory so we are executed.
	currentBinary, err := os.Executable()
	require.NoError(t, err)
	err = utils.CopyFile(currentBinary, pluginBinary)
	require.NoError(t, err)
	err = utils.CopyDir("../assets", assetsDir)
	require.NoError(t, err)

	// Copy the manifest without webapp to the correct directory
	modifiedManifest := model.Manifest{}
	_ = json.NewDecoder(strings.NewReader(manifestStr)).Decode(&modifiedManifest)
	modifiedManifest.Webapp = nil
	manifestJSONBytes, _ := json.Marshal(modifiedManifest)
	err = os.WriteFile(pluginManifest, manifestJSONBytes, 0700)
	require.NoError(t, err)

	// Create a logger to override
	testLogger, err := mlog.NewLogger()
	require.NoError(t, err)
	testLogger.LockConfiguration()

	// Create a server with our specified options
	err = utils.TranslationsPreInit()
	require.NoError(t, err)

	options := []sapp.Option{
		sapp.ConfigStore(configStore),
		sapp.SetLogger(testLogger),
	}
	server, err := sapp.NewServer(options...)
	require.NoError(t, err)
	api4.Init(server)
	err = server.Start()
	require.NoError(t, err)

	// Cleanup to run after test is complete
	t.Cleanup(func() {
		server.Shutdown()
	})

	ap := sapp.New(sapp.ServerConnector(server.Channels()))

	return &TestEnvironment{
		T:   t,
		Srv: server,
		A:   ap,
		Permissions: &serverPermissionsWrapper{
			TestHelper: api4.TestHelper{
				Server: server,
				App:    ap,
			},
		},
	}
}

func (e *TestEnvironment) CreateClients() {
	e.T.Helper()

	userPassword := "Password123!"
	admin, _ := e.A.CreateUser(request.EmptyContext(), &model.User{
		Email:    "playbooksadmin@test.com",
		Username: "playbooksadmin",
		Password: userPassword,
	})
	e.AdminUser = admin

	user, _ := e.A.CreateUser(request.EmptyContext(), &model.User{
		Email:    "playbooksuser@test.com",
		Username: "playbooksuser",
		Password: userPassword,
	})
	e.RegularUser = user

	siteURL := "http://localhost:9056"

	serverAdminClient := model.NewAPIv4Client(siteURL)
	_, _, err := serverAdminClient.Login(admin.Email, userPassword)
	require.NoError(e.T, err)

	playbooksAdminClient, err := client.New(serverAdminClient)
	require.NoError(e.T, err)

	e.ServerAdminClient = serverAdminClient
	e.PlaybooksAdminClient = playbooksAdminClient

	serverClient := model.NewAPIv4Client(siteURL)
	_, _, err = serverClient.Login(user.Email, userPassword)
	require.NoError(e.T, err)

	playbooksClient, err := client.New(serverClient)
	require.NoError(e.T, err)

	unauthServerClient := model.NewAPIv4Client(siteURL)
	unauthClient, err := client.New(unauthServerClient)
	require.NoError(e.T, err)

	e.ServerClient = serverClient
	e.PlaybooksClient = playbooksClient
	e.UnauthenticatedPlaybooksClient = unauthClient
}

func (e *TestEnvironment) CreateBasicServer() {
	e.T.Helper()

	team, _, err := e.ServerAdminClient.CreateTeam(&model.Team{
		DisplayName: "basic",
		Name:        "basic",
		Email:       "success+playbooks@simulator.amazonses.com",
		Type:        model.TeamOpen,
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddTeamMember(team.Id, e.RegularUser.Id)
	require.NoError(e.T, err)

	pubChannel, _, err := e.ServerAdminClient.CreateChannel(&model.Channel{
		DisplayName: "testpublic1",
		Name:        "testpublic1",
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
	})
	require.NoError(e.T, err)

	pubPost, _, err := e.ServerAdminClient.CreatePost(&model.Post{
		UserId:    e.AdminUser.Id,
		ChannelId: pubChannel.Id,
		Message:   "this is a public channel post by a system admin",
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddChannelMember(pubChannel.Id, e.RegularUser.Id)
	require.NoError(e.T, err)

	privateChannel, _, err := e.ServerAdminClient.CreateChannel(&model.Channel{
		DisplayName: "testprivate1",
		Name:        "testprivate1",
		Type:        model.ChannelTypePrivate,
		TeamId:      team.Id,
	})
	require.NoError(e.T, err)

	privatePost, _, err := e.ServerAdminClient.CreatePost(&model.Post{
		UserId:    e.AdminUser.Id,
		ChannelId: privateChannel.Id,
		Message:   "this is a private channel post by a system admin",
	})
	require.NoError(e.T, err)

	e.BasicTeam = team
	e.BasicPublicChannel = pubChannel
	e.BasicPublicChannelPost = pubPost
	e.BasicPrivateChannel = privateChannel
	e.BasicPrivateChannelPost = privatePost
}

func (e *TestEnvironment) CreateBasicPlaybooks() {
	e.T.Helper()

	playbook, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPlaybook",
		TeamID: e.BasicTeam.Id,
	})
	require.NoError(e.T, err)

	e.BasicPlaybook = playbook
}

func (e *TestEnvironment) SetE10Licence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuE10
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) SetE20Licence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuE20
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) CreateBasic() {
	e.CreateClients()
	e.CreateBasicServer()
	e.CreateBasicPlaybooks()
}

// TestTestFramework If this is failing you know the break is not exclusivly in your test.
func TestTestFramework(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
}

func requireErrorWithStatusCode(t *testing.T, err error, statusCode int) {
	t.Helper()

	require.Error(t, err)

	var errResponse *client.ErrorResponse
	require.Truef(t, errors.As(err, &errResponse), "err is not an instance of errResponse: %s", err.Error())
	require.Equal(t, statusCode, errResponse.StatusCode)
}
