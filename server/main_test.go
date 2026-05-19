// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	putils "github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	sapp "github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/config"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// testUserPassword is the shared password for test users. It must be at least
// 14 characters to satisfy FIPS password requirements enforced by the server.
const testUserPassword = "Password123!abcd"

func testPtr[T any](v T) *T {
	return &v
}

func TestMain(m *testing.M) {
	// Run the plugin under test if the server is trying to run us as a plugin.
	value := os.Getenv("MATTERMOST_PLUGIN")
	if value == "Securely message teams, anywhere." {
		plugin.ClientMain(&Plugin{})
		return
	}

	serverpathBytes, err := exec.Command("go", "list", "-f", "'{{.Dir}}'", "-m", "github.com/mattermost/mattermost/server/v8").Output()
	if err != nil {
		panic(err)
	}
	serverpath := string(serverpathBytes)
	serverpath = strings.Trim(strings.TrimSpace(serverpath), "'")
	os.Setenv("MM_SERVER_PATH", serverpath)

	// This actually runs the tests
	status := m.Run()

	// Tear down the shared server (if it was booted) now that all tests are done.
	if sharedCleanup != nil {
		sharedCleanup()
	}

	os.Exit(status)
}

type PermissionsHelper interface {
	SaveDefaultRolePermissions(t testing.TB) map[string][]string
	RestoreDefaultRolePermissions(t testing.TB, data map[string][]string)
	RemovePermissionFromRole(t testing.TB, permission string, roleName string)
	AddPermissionToRole(t testing.TB, permission string, roleName string)
	SetupChannelScheme(t testing.TB) *model.Scheme
}

type serverPermissionsWrapper struct {
	api4.TestHelper
}

type TestEnvironment struct {
	T       testing.TB
	Context *request.Context
	Srv     *sapp.Server
	A       *sapp.App

	Permissions PermissionsHelper
	logger      mlog.LoggerIFace

	// id is a unique token per environment used to namespace fixture names on
	// the shared server.
	id int64

	createClientsOnce sync.Once

	ServerAdminClient        *model.Client4
	PlaybooksAdminClient     *client.Client
	ServerClient             *model.Client4
	PlaybooksClient          *client.Client
	PlaybooksClient2         *client.Client
	PlaybooksClientNotInTeam *client.Client
	PlaybooksClientGuest     *client.Client

	UnauthenticatedPlaybooksClient *client.Client

	BasicTeam                *model.Team
	BasicTeam2               *model.Team
	BasicPublicChannel       *model.Channel
	BasicPublicChannelPost   *model.Post
	BasicPrivateChannel      *model.Channel
	BasicPrivateChannelPost  *model.Post
	BasicPlaybook            *client.Playbook
	BasicPrivatePlaybook     *client.Playbook
	PrivatePlaybookNoMembers *client.Playbook
	ArchivedPlaybook         *client.Playbook
	BasicRun                 *client.PlaybookRun
	AdminUser                *model.User
	RegularUser              *model.User
	RegularUser2             *model.User
	RegularUserNotInTeam     *model.User
	GuestUser                *model.User
}

func (e *TestEnvironment) DoPluginAPIRequestWithHeaders(ctx context.Context, client *model.Client4, method, path, data string, headers map[string]string) (*http.Response, error) {
	normalizedPath := path
	if !strings.HasPrefix(normalizedPath, "/") {
		normalizedPath = "/" + normalizedPath
	}

	req, err := http.NewRequestWithContext(ctx, method, client.URL+"/plugins/"+manifest.Id+normalizedPath, strings.NewReader(data))
	if err != nil {
		return nil, err
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}
	if client.AuthToken != "" {
		req.Header.Set(model.HeaderAuth, client.AuthType+" "+client.AuthToken)
	}
	for key, value := range client.HTTPHeader {
		req.Header.Set(key, value)
	}

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		return resp, err
	}
	if resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return resp, model.AppErrorFromJSON(resp.Body)
	}
	return resp, nil
}

// Global bundle cache to avoid recreating for every test
var (
	globalBundlePath string
	globalBundleOnce sync.Once
)

func getEnvWithDefault(name, defaultValue string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return defaultValue
}

// doPluginRequest issues an authenticated request to an absolute URL using the
// given client's credentials. Client4's Do* helpers now prefix the request with
// the server's /api/v4 APIURL, which breaks calls to plugin endpoints (served
// under /plugins/{id}/...), so we build the request directly here. The error
// semantics mirror Client4.doAPIRequestReader: a >= 300 response yields the
// parsed AppError alongside the raw response.
func (e *TestEnvironment) doPluginRequest(c *model.Client4, ctx context.Context, method, url, data string, headers map[string]string) (*http.Response, error) {
	rq, err := http.NewRequestWithContext(ctx, method, url, strings.NewReader(data))
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		rq.Header.Set(k, v)
	}

	if c.AuthToken != "" {
		rq.Header.Set(model.HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return rp, err
	}

	if rp.StatusCode == http.StatusNotModified {
		return rp, nil
	}

	if rp.StatusCode >= 300 {
		defer rp.Body.Close()
		return rp, model.AppErrorFromJSON(rp.Body)
	}

	return rp, nil
}

// createPluginBundleOnce creates the plugin bundle once and caches it for reuse
func createPluginBundleOnce() string {
	globalBundleOnce.Do(func() {
		// Create a very short path temp directory
		bundleDir := "/tmp/pb-test"
		os.RemoveAll(bundleDir) // Clean up any existing
		err := os.MkdirAll(bundleDir, 0755)
		if err != nil {
			panic(fmt.Sprintf("Failed to create bundle dir: %v", err))
		}

		// Get current binary
		currentBinary, err := os.Executable()
		if err != nil {
			panic(fmt.Sprintf("Failed to get executable: %v", err))
		}

		// Copy the manifest without webapp
		modifiedManifest := model.Manifest{}
		_ = json.NewDecoder(strings.NewReader(manifestStr)).Decode(&modifiedManifest)
		modifiedManifest.Webapp = nil

		// Create bundle directory structure with short paths
		bundleBinaryDir := path.Join(bundleDir, "server", "dist")
		bundleManifest := path.Join(bundleDir, "plugin.json")
		bundleAssetsDir := path.Join(bundleDir, "assets")
		bundleBinary := path.Join(bundleBinaryDir, "plugin-"+runtime.GOOS+"-"+runtime.GOARCH)

		// Copy files to bundle directory
		err = os.MkdirAll(bundleBinaryDir, 0755)
		if err != nil {
			panic(fmt.Sprintf("Failed to create binary dir: %v", err))
		}
		err = putils.CopyFile(currentBinary, bundleBinary)
		if err != nil {
			panic(fmt.Sprintf("Failed to copy binary: %v", err))
		}

		// Copy assets directory (needed for plugin icon)
		assetsDir := "../assets"
		if _, err := os.Stat(assetsDir); err == nil {
			err = putils.CopyDir(assetsDir, bundleAssetsDir)
			if err != nil {
				panic(fmt.Sprintf("Failed to copy assets: %v", err))
			}
		}

		manifestJSONBytes, _ := json.Marshal(modifiedManifest)
		err = os.WriteFile(bundleManifest, manifestJSONBytes, 0700)
		if err != nil {
			panic(fmt.Sprintf("Failed to write manifest: %v", err))
		}

		// Create tar.gz bundle with short path
		globalBundlePath = "/tmp/pb-test.tar.gz"
		err = createTarGz(bundleDir, globalBundlePath)
		if err != nil {
			panic(fmt.Sprintf("Failed to create bundle: %v", err))
		}
	})
	return globalBundlePath
}

// serverInstance is a running Mattermost server with the playbooks plugin
// deployed onto it. A single instance is shared across the whole test package
// (see ensureSharedServer) to avoid paying the multi-second server boot cost for
// every test.
type serverInstance struct {
	server *sapp.Server
	app    *sapp.App
	logger mlog.LoggerIFace
}

// Shared server reused across the entire test package. It is created lazily on
// the first Setup call and torn down in TestMain after all tests have run.
var (
	sharedInstance     *serverInstance
	sharedCleanup      func()
	sharedInstanceOnce sync.Once

	// envCounter yields a unique token per TestEnvironment so that fixtures
	// (users, teams, channels) created on the shared server never collide.
	envCounter atomic.Int64
)

// ensureSharedServer boots the shared server exactly once and returns it.
func ensureSharedServer(t *testing.T) *serverInstance {
	sharedInstanceOnce.Do(func() {
		bootStart := time.Now()
		sharedInstance, sharedCleanup = bootServer(t)
		t.Logf("Shared server boot took: %v", time.Since(bootStart))
	})
	require.NotNil(t, sharedInstance, "shared server failed to boot")
	return sharedInstance
}

// bootServer creates a brand-new Mattermost server on its own database and
// deploys the playbooks plugin onto it. The returned cleanup function shuts the
// server down and removes its temporary resources. It is used both for the
// shared server and for the dedicated servers handed out by SetupIsolated.
func bootServer(tb testing.TB) (*serverInstance, func()) {
	tb.Helper()

	// Ignore any locally defined SiteURL as we intend to host our own.
	os.Unsetenv("MM_SERVICESETTINGS_SITEURL")
	os.Unsetenv("MM_SERVICESETTINGS_LISTENADDRESS")
	// Ignore developer mode and configure it ourselves during testing.
	os.Unsetenv("MM_SERVICESETTINGS_ENABLEDEVELOPER")

	// Environment Settings
	driverName := getEnvWithDefault("TEST_DATABASE_DRIVERNAME", "postgres")
	sqlSettings := storetest.MakeSqlSettings(driverName)

	// Directories for plugin stuff. We use MkdirTemp rather than tb.TempDir so
	// the directories outlive the test that first triggers the shared boot;
	// cleanup is handled by the returned function instead.
	dir, err := os.MkdirTemp("", "pb-plugin-dir")
	require.NoError(tb, err)
	clientDir, err := os.MkdirTemp("", "pb-plugin-client")
	require.NoError(tb, err)

	// Get the cached plugin bundle (created once globally)
	bundlePath := createPluginBundleOnce()

	// Create a test memory store and modify configuration appropriately
	configStore := config.NewTestMemoryStore()
	cfg := configStore.Get()
	cfg.PluginSettings.Directory = &dir
	cfg.PluginSettings.ClientDirectory = &clientDir
	cfg.PluginSettings.Enable = testPtr(true)
	cfg.PluginSettings.RequirePluginSignature = testPtr(false)
	cfg.PluginSettings.EnableUploads = testPtr(true)
	cfg.ServiceSettings.ListenAddress = testPtr("localhost:0")
	cfg.TeamSettings.MaxUsersPerTeam = testPtr(10000)
	cfg.LocalizationSettings.SetDefaults()
	cfg.SqlSettings = *sqlSettings
	cfg.ServiceSettings.SiteURL = testPtr("http://testsiteurlplaybooks.mattermost.com/")
	cfg.LogSettings.EnableConsole = testPtr(true)
	cfg.LogSettings.EnableFile = testPtr(false)
	cfg.LogSettings.ConsoleLevel = testPtr("DEBUG")

	// override config with e2etest.config.json if it exists
	if textConfig, rerr := os.ReadFile("./e2etest.config.json"); rerr == nil {
		require.NoError(tb, json.Unmarshal(textConfig, cfg))
	}

	_, _, err = configStore.Set(cfg)
	require.NoError(tb, err)

	// Get manifest for plugin ID
	modifiedManifest := model.Manifest{}
	_ = json.NewDecoder(strings.NewReader(manifestStr)).Decode(&modifiedManifest)
	modifiedManifest.Webapp = nil

	// Create a logger to override
	testLogger, err := mlog.NewLogger()
	require.NoError(tb, err)
	testLogger.LockConfiguration()

	// Create a server with our specified options
	require.NoError(tb, utils.TranslationsPreInit())

	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuEnterpriseAdvanced

	options := []sapp.Option{
		sapp.ConfigStore(configStore),
		sapp.WithLicense(license),
	}
	server, err := sapp.NewServer(options...)
	require.NoError(tb, err)
	_, err = api4.Init(server)
	require.NoError(tb, err)
	require.NoError(tb, server.Start())

	ap := sapp.New(sapp.ServerConnector(server.Channels()))

	// Create a dedicated system admin used only to deploy the plugin. Per-test
	// admins are created separately (and uniquely) by CreateClients.
	ctx := request.EmptyContext(testLogger)
	deployAdmin, appErr := ap.CreateUserAsAdmin(ctx, &model.User{
		Email:    "pb-deploy-admin@example.com",
		Username: "pb-deploy-admin",
		Password: testUserPassword,
	}, "")
	require.Nil(tb, appErr)

	siteURL := fmt.Sprintf("http://localhost:%v", ap.Srv().ListenAddr.Port)
	deployClient := model.NewAPIv4Client(siteURL)
	_, _, err = deployClient.Login(context.Background(), deployAdmin.Email, testUserPassword)
	require.NoError(tb, err)

	// Deploy plugin using forced upload (like pluginctl does in development)
	bundleFile, err := os.Open(bundlePath)
	require.NoError(tb, err)
	defer bundleFile.Close()

	// Upload plugin using forced upload (bypasses signature verification)
	_, _, err = deployClient.UploadPluginForced(context.Background(), bundleFile)
	require.NoError(tb, err)

	// Enable the plugin
	_, err = deployClient.EnablePlugin(context.Background(), modifiedManifest.Id)
	require.NoError(tb, err)

	instance := &serverInstance{server: server, app: ap, logger: testLogger}
	cleanup := func() {
		server.Shutdown()
		storetest.CleanupSqlSettings(sqlSettings)
		_ = os.RemoveAll(dir)
		_ = os.RemoveAll(clientDir)
	}
	return instance, cleanup
}

// Setup returns a TestEnvironment backed by the shared package-wide server. The
// returned environment owns a unique set of users/teams/channels so it stays
// isolated from other tests despite sharing the same server and database. Use
// SetupIsolated instead if a test genuinely requires a globally-empty server.
func Setup(t *testing.T) *TestEnvironment {
	t.Helper()
	env := newEnv(t, ensureSharedServer(t))
	// Reset the shared server's license to the default so license changes made
	// by a previous test (e.g. RemoveLicence) do not leak into this one.
	env.SetEnterpriseAdvancedLicence()
	return env
}

// SetupIsolated boots a dedicated server on its own database for tests that
// require a pristine, globally-empty environment. Prefer Setup unless a test
// genuinely depends on global state being empty, as this pays the full server
// boot cost.
func SetupIsolated(t *testing.T) *TestEnvironment {
	t.Helper()
	instance, cleanup := bootServer(t)
	t.Cleanup(cleanup)
	return newEnv(t, instance)
}

// newEnv builds a TestEnvironment with a unique token bound to the given server.
func newEnv(t *testing.T, instance *serverInstance) *TestEnvironment {
	ctx := request.EmptyContext(instance.logger)
	return &TestEnvironment{
		T:       t,
		Context: ctx,
		Srv:     instance.server,
		A:       instance.app,
		id:      envCounter.Add(1),
		Permissions: &serverPermissionsWrapper{
			TestHelper: api4.TestHelper{
				Server:  instance.server,
				App:     instance.app,
				Context: ctx,
			},
		},
		logger: instance.logger,
	}
}

// username, email and resourceName produce per-environment unique identifiers so
// that fixtures created on the shared server never collide. base must be short
// enough that the resulting username stays within Mattermost's 22-char limit.
func (e *TestEnvironment) username(base string) string {
	return fmt.Sprintf("pb-%s-%d", base, e.id)
}

func (e *TestEnvironment) email(base string) string {
	return e.username(base) + "@example.com"
}

func (e *TestEnvironment) resourceName(base string) string {
	return fmt.Sprintf("%s-%d", base, e.id)
}

func createTarGz(srcDir, dstFile string) error {
	file, err := os.Create(dstFile)
	if err != nil {
		return err
	}
	defer file.Close()

	gzw := gzip.NewWriter(file)
	defer gzw.Close()

	tw := tar.NewWriter(gzw)
	defer tw.Close()

	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		header.Name = relPath

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		if !info.IsDir() {
			srcFile, err := os.Open(path)
			if err != nil {
				return err
			}
			defer srcFile.Close()

			_, err = io.Copy(tw, srcFile)
			return err
		}

		return nil
	})
}

func (e *TestEnvironment) CreateClients() {
	e.T.Helper()

	e.createClientsOnce.Do(func() {
		admin, appErr := e.A.CreateUserAsAdmin(e.Context, &model.User{
			Email:    e.email("admin"),
			Username: e.username("admin"),
			Password: testUserPassword,
		}, "")
		require.Nil(e.T, appErr)
		// Explicitly promote to system admin. On the shared server this user is
		// not the first account, so it does not get auto-promoted the way it did
		// when every test booted its own server.
		admin, appErr = e.A.UpdateUserRoles(e.Context, admin.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
		require.Nil(e.T, appErr)
		e.AdminUser = admin

		user, appErr := e.A.CreateUser(e.Context, &model.User{
			Email:     e.email("user"),
			Username:  e.username("user"),
			Password:  testUserPassword,
			FirstName: "First 1",
			LastName:  "Last 1",
		})
		require.Nil(e.T, appErr)
		e.RegularUser = user

		user2, appErr := e.A.CreateUser(e.Context, &model.User{
			Email:     e.email("user2"),
			Username:  e.username("user2"),
			Password:  testUserPassword,
			FirstName: "First 2",
			LastName:  "Last 2",
		})
		require.Nil(e.T, appErr)
		e.RegularUser2 = user2

		notInTeam, appErr := e.A.CreateUser(e.Context, &model.User{
			Email:    e.email("notinteam"),
			Username: e.username("notinteam"),
			Password: testUserPassword,
		})
		require.Nil(e.T, appErr)
		e.RegularUserNotInTeam = notInTeam

		siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)

		serverAdminClient := model.NewAPIv4Client(siteURL)
		_, _, err := serverAdminClient.Login(context.Background(), admin.Email, testUserPassword)
		require.NoError(e.T, err)

		playbooksAdminClient, err := client.New(serverAdminClient)
		require.NoError(e.T, err)

		e.ServerAdminClient = serverAdminClient
		e.PlaybooksAdminClient = playbooksAdminClient

		serverClient := model.NewAPIv4Client(siteURL)
		_, _, err = serverClient.Login(context.Background(), user.Email, testUserPassword)
		require.NoError(e.T, err)

		playbooksClient, err := client.New(serverClient)
		require.NoError(e.T, err)

		unauthServerClient := model.NewAPIv4Client(siteURL)
		unauthClient, err := client.New(unauthServerClient)
		require.NoError(e.T, err)

		serverClient2 := model.NewAPIv4Client(siteURL)
		_, _, err = serverClient2.Login(context.Background(), user2.Email, testUserPassword)
		require.NoError(e.T, err)

		playbooksClient2, err := client.New(serverClient2)
		require.NoError(e.T, err)

		serverClientNotInTeam := model.NewAPIv4Client(siteURL)
		_, _, err = serverClientNotInTeam.Login(context.Background(), notInTeam.Email, testUserPassword)
		require.NoError(e.T, err)

		playbooksClientNotInTeam, err := client.New(serverClientNotInTeam)
		require.NoError(e.T, err)

		e.ServerClient = serverClient
		e.PlaybooksClient = playbooksClient
		e.PlaybooksClient2 = playbooksClient2
		e.UnauthenticatedPlaybooksClient = unauthClient
		e.PlaybooksClientNotInTeam = playbooksClientNotInTeam
	})
}

func (e *TestEnvironment) CreateBasicServer() {
	e.T.Helper()

	team, _, err := e.ServerAdminClient.CreateTeam(context.Background(), &model.Team{
		DisplayName: "basic",
		Name:        e.resourceName("basic"),
		Email:       "success+playbooks@simulator.amazonses.com",
		Type:        model.TeamOpen,
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), team.Id, e.RegularUser.Id)
	require.NoError(e.T, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), team.Id, e.RegularUser2.Id)
	require.NoError(e.T, err)

	pubChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "testpublic1",
		Name:        e.resourceName("testpublic1"),
		Type:        model.ChannelTypeOpen,
		TeamId:      team.Id,
	})
	require.NoError(e.T, err)

	pubPost, _, err := e.ServerAdminClient.CreatePost(context.Background(), &model.Post{
		UserId:    e.AdminUser.Id,
		ChannelId: pubChannel.Id,
		Message:   "this is a public channel post by a system admin",
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), pubChannel.Id, e.RegularUser.Id)
	require.NoError(e.T, err)

	privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		DisplayName: "testprivate1",
		Name:        e.resourceName("testprivate1"),
		Type:        model.ChannelTypePrivate,
		TeamId:      team.Id,
	})
	require.NoError(e.T, err)

	privatePost, _, err := e.ServerAdminClient.CreatePost(context.Background(), &model.Post{
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

	// Add a second team to test cross-team features
	team2, _, err := e.ServerAdminClient.CreateTeam(context.Background(), &model.Team{
		DisplayName: "second team",
		Name:        e.resourceName("second-team"),
		Email:       "success+playbooks@simulator.amazonses.com",
		Type:        model.TeamOpen,
	})
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), team2.Id, e.RegularUser.Id)
	require.NoError(e.T, err)

	e.BasicTeam2 = team2
}

func (e *TestEnvironment) CreateBasicPlaybook() {
	e.T.Helper()

	e.CreateBasicPublicPlaybook()
	e.CreateBasicPrivatePlaybook()
}

func (e *TestEnvironment) CreateBasicPrivatePlaybook() {
	e.T.Helper()

	privateID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPrivatePlaybook",
		TeamID: e.BasicTeam.Id,
		Public: false,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(e.T, err)

	privatePlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privateID)
	require.NoError(e.T, err)

	e.BasicPrivatePlaybook = privatePlaybook
}

func (e *TestEnvironment) CreateBasicPublicPlaybook() {

	e.T.Helper()
	id, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		Metrics: []client.PlaybookMetricConfig{
			{Title: "testmetric", Type: app.MetricTypeDuration, Target: null.IntFrom(0)},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(e.T, err)

	playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), id)
	require.NoError(e.T, err)

	e.BasicPlaybook = playbook
}

func (e *TestEnvironment) CreateBasicRun() {
	e.T.Helper()

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Basic create",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(e.T, err)
	require.NotNil(e.T, run)

	run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
	require.NoError(e.T, err)
	require.NotNil(e.T, run)

	e.BasicRun = run
}

func (e *TestEnvironment) CreateAdditionalPlaybooks() {
	e.T.Helper()

	privateID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPrivatePlaybookNoMembers",
		TeamID: e.BasicTeam.Id,
		Public: false,
	})
	require.NoError(e.T, err)

	privatePlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), privateID)
	require.NoError(e.T, err)

	e.PrivatePlaybookNoMembers = privatePlaybook

	archivedID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestArchivedPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
	})
	require.NoError(e.T, err)

	err = e.PlaybooksAdminClient.Playbooks.Archive(context.Background(), archivedID)
	require.NoError(e.T, err)

	archivedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), archivedID)
	require.NoError(e.T, err)

	e.ArchivedPlaybook = archivedPlaybook
}

func (e *TestEnvironment) CreateGuest() {
	cfg := e.Srv.Config()
	cfg.GuestAccountsSettings.Enable = testPtr(true)
	_, _, err := e.ServerAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(e.T, err)

	guest, appErr := e.A.CreateGuest(e.Context, &model.User{
		Email:    e.email("guest"),
		Username: e.username("guest"),
		Password: testUserPassword,
	})
	require.Nil(e.T, appErr)
	e.GuestUser = guest

	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicPublicChannel.TeamId, e.GuestUser.Id)
	require.NoError(e.T, err)

	_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicPublicChannel.Id, e.GuestUser.Id)
	require.NoError(e.T, err)

	siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)
	serverClientGuest := model.NewAPIv4Client(siteURL)
	_, _, err = serverClientGuest.Login(context.Background(), e.GuestUser.Email, testUserPassword)
	require.NoError(e.T, err)

	playbooksClientGuest, err := client.New(serverClientGuest)
	require.NoError(e.T, err)
	e.PlaybooksClientGuest = playbooksClientGuest
}

func (e *TestEnvironment) RemoveLicence() {
	e.Srv.SetLicense(nil)
}

func (e *TestEnvironment) SetProfessoinalLicence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuProfessional
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) SetEnterpriseLicence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuEnterprise
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) SetEnterpriseAdvancedLicence() {
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuEnterpriseAdvanced
	e.Srv.SetLicense(license)
}

func (e *TestEnvironment) CreateBasic() {
	e.T.Helper()

	e.CreateClients()
	e.CreateBasicServer()
	e.SetEnterpriseAdvancedLicence()
	e.CreateBasicPlaybook()
	e.CreateBasicRun()
	e.CreateAdditionalPlaybooks()
}

// TestTestFramework If this is failing you know the break is not exclusively in your test.
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
