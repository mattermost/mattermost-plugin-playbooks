// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

func newTestReportService(api *plugintest.API) *ReportService {
	client := pluginapi.NewClient(api, &plugintest.Driver{})
	return &ReportService{
		pluginAPI: client,
		config:    DefaultReportConfig(),
	}
}

func TestReportServiceWebhookRedaction(t *testing.T) {
	t.Run("masks path and query when manage denied", func(t *testing.T) {
		out := redactWebhooks([]string{"https://hooks.slack.com/services/T0/B0/XXX?token=secret"}, false)
		require.Len(t, out, 1)
		require.Equal(t, "https://hooks.slack.com/****", out[0].HostMasked)
		require.Empty(t, out[0].Full)
	})

	t.Run("returns Full only when manage granted", func(t *testing.T) {
		raw := "https://hooks.example.com/path?token=t"
		out := redactWebhooks([]string{raw}, true)
		require.Len(t, out, 1)
		require.Equal(t, "https://hooks.example.com/****", out[0].HostMasked)
		require.Equal(t, raw, out[0].Full)
	})

	t.Run("strips userinfo before masking", func(t *testing.T) {
		out := redactWebhooks([]string{"https://user:pass@hooks.example.com/p"}, true)
		require.Len(t, out, 1)
		require.Equal(t, "https://hooks.example.com/****", out[0].HostMasked)
		require.NotContains(t, out[0].Full, "user:pass")
		require.NotContains(t, out[0].Full, "@hooks.example.com")
	})

	t.Run("host-only URL masks without trailing slash", func(t *testing.T) {
		out := redactWebhooks([]string{"https://hooks.example.com"}, false)
		require.Len(t, out, 1)
		require.Equal(t, "https://hooks.example.com", out[0].HostMasked)
	})

	t.Run("empty strings are dropped", func(t *testing.T) {
		out := redactWebhooks([]string{"", "  "}, false)
		require.Empty(t, out)
	})

	t.Run("invalid URL yields masked placeholder", func(t *testing.T) {
		out := redactWebhooks([]string{"://broken"}, false)
		require.Len(t, out, 1)
		require.Equal(t, "****", out[0].HostMasked)
		require.Empty(t, out[0].Full)
	})
}

func TestReportServiceDedupNonEmpty(t *testing.T) {
	t.Run("dedups, trims, drops over-length", func(t *testing.T) {
		long := strings.Repeat("a", 27)
		out := dedupNonEmpty([]string{"abc", " abc ", "", "  ", long, "def"}, 26)
		require.Equal(t, []string{"abc", "def"}, out)
	})

	t.Run("zero maxLen disables length cap", func(t *testing.T) {
		long := strings.Repeat("a", 27)
		out := dedupNonEmpty([]string{long}, 0)
		require.Equal(t, []string{long}, out)
	})
}

func TestReportServiceCapLookups(t *testing.T) {
	t.Run("budget exhausts users first then channels then files", func(t *testing.T) {
		u, c, f := capLookups(
			[]string{"u1", "u2", "u3"},
			[]string{"c1", "c2"},
			[]string{"f1", "f2"},
			4,
		)
		require.Equal(t, []string{"u1", "u2", "u3"}, u)
		require.Equal(t, []string{"c1"}, c)
		require.Empty(t, f)
	})

	t.Run("zero budget yields nothing", func(t *testing.T) {
		u, c, f := capLookups([]string{"u"}, []string{"c"}, []string{"f"}, 0)
		require.Empty(t, u)
		require.Empty(t, c)
		require.Empty(t, f)
	})
}

func TestReportServiceFileKindFromMime(t *testing.T) {
	cases := map[string]string{
		"image/png":           "image",
		"audio/mpeg":          "audio",
		"video/mp4":           "video",
		"application/pdf":     "doc",
		"application/msword":  "doc",
		"application/vnd.foo": "doc",
		"text/plain":          "doc",
		"application/octet":   "other",
		"":                    "other",
	}
	for mime, want := range cases {
		t.Run(mime, func(t *testing.T) {
			require.Equal(t, want, fileKindFromMime(mime))
		})
	}
}

func TestReportServiceRenderUserFromModel(t *testing.T) {
	t.Run("uses first+last when present", func(t *testing.T) {
		u := &model.User{Id: "uid", Username: "alice", FirstName: "Al", LastName: "Ice"}
		got := renderUserFromModel(u)
		require.Equal(t, "uid", got.UserID)
		require.Equal(t, "alice", got.Username)
		require.Equal(t, "Al Ice", got.DisplayName)
	})

	t.Run("falls back to username when names empty", func(t *testing.T) {
		u := &model.User{Id: "uid", Username: "alice"}
		got := renderUserFromModel(u)
		require.Equal(t, "alice", got.DisplayName)
	})
}

func TestReportServiceCollectRunUserIDs(t *testing.T) {
	run := &PlaybookRun{
		OwnerUserID:    "owner",
		ReporterUserID: "reporter",
		ParticipantIDs: []string{"p1", "p2", "owner"},
		TimelineEvents: []TimelineEvent{
			{SubjectUserID: "subj", CreatorUserID: "creator"},
			{DeleteAt: 0, SubjectUserID: ""},
		},
		Checklists: []Checklist{
			{Items: []ChecklistItem{{AssigneeID: "assignee"}, {AssigneeID: ""}}},
		},
	}
	got := collectRunUserIDs(run)
	want := map[string]struct{}{
		"owner": {}, "reporter": {}, "p1": {}, "p2": {},
		"subj": {}, "creator": {}, "assignee": {},
	}
	require.Len(t, got, len(want))
	for _, id := range got {
		_, ok := want[id]
		require.Truef(t, ok, "unexpected user id %q", id)
	}
}

func TestReportServiceMetricsFromConfigs(t *testing.T) {
	t.Run("playbook configs apply value overrides", func(t *testing.T) {
		cfg := []PlaybookMetricConfig{
			{ID: "m1", Title: "Resolution", Type: MetricTypeDuration, Target: null.IntFrom(60)},
			{ID: "m2", Title: "Spend", Type: MetricTypeCurrency},
		}
		out := metricsFromConfigs(cfg, map[string]int64{"m1": 42})
		require.Len(t, out, 2)
		require.Equal(t, "duration", out[0].Type)
		require.True(t, out[0].HasValue)
		require.Equal(t, int64(42), out[0].Value)
		require.Equal(t, int64(60), out[0].Target)
		require.Equal(t, "currency", out[1].Type)
		require.False(t, out[1].HasValue)
	})

	t.Run("run metric values join to playbook configs by id and preserve null vs zero", func(t *testing.T) {
		// Mirrors the production path: playbook metric configs supply
		// labels/types/targets; run-side values come in via the lookup
		// map. A nil-valued run-side metric stays HasValue=false; a
		// zero-valued one stays HasValue=true.
		cfg := []PlaybookMetricConfig{
			{ID: "m1", Title: "Time to detect", Type: MetricTypeDuration},
			{ID: "m2", Title: "Customer impact", Type: MetricTypeInteger},
		}
		values := map[string]int64{"m1": 0} // m2 missing → no value
		out := metricsFromConfigs(cfg, values)
		require.Len(t, out, 2)
		require.Equal(t, "Time to detect", out[0].Title)
		require.True(t, out[0].HasValue)
		require.Equal(t, int64(0), out[0].Value)
		require.Equal(t, "Customer impact", out[1].Title)
		require.False(t, out[1].HasValue)
	})
}

func TestReportServiceDrainTranscript(t *testing.T) {
	makePosts := func(n int, msgSize int) []report.RenderPost {
		out := make([]report.RenderPost, n)
		for i := range out {
			out[i] = report.RenderPost{
				PostID:  "p",
				Message: strings.Repeat("x", msgSize),
			}
		}
		return out
	}

	t.Run("stops on post cap", func(t *testing.T) {
		called := 0
		iter := func(ctx context.Context) ([]report.RenderPost, error) {
			called++
			if called > 3 {
				return nil, nil
			}
			return makePosts(2, 4), nil
		}
		got, err := drainTranscript(context.Background(), iter, 4, 0)
		require.NoError(t, err)
		require.True(t, got.truncation.Hit)
		require.Equal(t, "posts", got.truncation.Reason)
		require.Len(t, got.posts, 4)
	})

	t.Run("stops on byte cap", func(t *testing.T) {
		called := 0
		iter := func(ctx context.Context) ([]report.RenderPost, error) {
			called++
			if called > 1 {
				return nil, nil
			}
			return makePosts(5, 100), nil
		}
		got, err := drainTranscript(context.Background(), iter, 0, 250)
		require.NoError(t, err)
		require.True(t, got.truncation.Hit)
		require.Equal(t, "bytes", got.truncation.Reason)
		require.Len(t, got.posts, 2)
	})

	t.Run("returns normally when exhausted", func(t *testing.T) {
		called := 0
		iter := func(ctx context.Context) ([]report.RenderPost, error) {
			called++
			if called == 1 {
				return makePosts(2, 4), nil
			}
			return nil, nil
		}
		got, err := drainTranscript(context.Background(), iter, 100, 100*1024)
		require.NoError(t, err)
		require.False(t, got.truncation.Hit)
		require.Len(t, got.posts, 2)
	})

	t.Run("propagates iterator error", func(t *testing.T) {
		sentinel := errors.New("boom")
		iter := func(ctx context.Context) ([]report.RenderPost, error) {
			return nil, sentinel
		}
		_, err := drainTranscript(context.Background(), iter, 100, 100)
		require.ErrorIs(t, err, sentinel)
	})
}

// TestReportServiceContextSanitizationInvariant walks the assembled context
// via reflection and asserts that no raw model.User / model.Post /
// model.Channel value can sneak through. This is the security backstop for
// the renderer's trust boundary (plan §3.6.7).
func TestReportServiceContextSanitizationInvariant(t *testing.T) {
	rc := report.RenderContext{
		Owner:        report.RenderUser{UserID: "u1"},
		Participants: []report.RenderUser{{UserID: "u2"}},
		Channel:      report.RenderChannel{ChannelID: "c1"},
		Team:         report.RenderTeam{TeamID: "t1"},
		StatusUpdates: []report.RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u1", Message: "hi"},
		},
		TimelineEvents: []report.RenderTimelineEvent{{EventType: "incident_created"}},
		Checklists: []report.RenderChecklist{
			{Title: "ck", Items: []report.RenderChecklistItem{{Title: "task"}}},
		},
		Retrospective: report.RenderRetrospective{Body: "done"},
		Transcript: []report.RenderPost{
			{PostID: "p2", Files: []report.RenderFile{{FileID: "f1"}}},
		},
		Resolvers: report.ResolverTable{
			Users:    map[string]report.RenderUser{"u1": {UserID: "u1"}},
			Channels: map[string]report.RenderChannel{"c1": {ChannelID: "c1"}},
			Files:    map[string]report.RenderFile{"f1": {FileID: "f1"}},
		},
	}
	requireNoRawModelTypes(t, reflect.ValueOf(rc))

	pc := report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{ID: "pb1"},
		Members:  []report.RenderPlaybookMember{{UserID: "u1"}},
		WebhooksOnCreation: []report.RenderWebhook{
			{HostMasked: "https://example.com/****"},
		},
		BroadcastChannels: []report.RenderChannel{{ChannelID: "c1"}},
	}
	requireNoRawModelTypes(t, reflect.ValueOf(pc))
}

func requireNoRawModelTypes(t *testing.T, v reflect.Value) {
	t.Helper()
	forbidden := map[string]bool{
		"model.User":     true,
		"model.Post":     true,
		"model.Channel":  true,
		"model.Team":     true,
		"model.FileInfo": true,
	}
	var visit func(reflect.Value)
	visit = func(v reflect.Value) {
		if !v.IsValid() {
			return
		}
		typeName := v.Type().String()
		if forbidden[typeName] {
			t.Fatalf("forbidden raw model type %q found in render context", typeName)
		}
		switch v.Kind() {
		case reflect.Ptr, reflect.Interface:
			if !v.IsNil() {
				visit(v.Elem())
			}
		case reflect.Struct:
			for i := 0; i < v.NumField(); i++ {
				visit(v.Field(i))
			}
		case reflect.Slice, reflect.Array:
			for i := 0; i < v.Len(); i++ {
				visit(v.Index(i))
			}
		case reflect.Map:
			iter := v.MapRange()
			for iter.Next() {
				visit(iter.Key())
				visit(iter.Value())
			}
		}
	}
	visit(v)
}

func TestReportServiceBuildResolverTableCapHit(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	svc.config.MaxResolverLookupsPerExport = 1

	users := []string{model.NewId(), model.NewId(), model.NewId()}
	api.On("GetUser", users[0]).Return((*model.User)(nil), &model.AppError{Message: "nope"})

	table, stats, err := svc.buildResolverTable(
		context.Background(),
		model.NewId(),
		users,
		nil,
		nil,
		svc.config,
	)
	require.NoError(t, err)
	require.True(t, stats.CapHit)
	require.Equal(t, 1, stats.Lookups)
	require.Len(t, table.Users, 1)
}

func TestReportServiceBuildResolverTableUserDeniedYieldsZero(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)

	requester := model.NewId()
	target := &model.User{Id: model.NewId(), Username: "bob"}
	teamID := model.NewId()

	api.On("GetUser", target.Id).Return(target, nil)
	api.On("GetTeamMembersForUser", target.Id, 0, 200).Return(
		[]*model.TeamMember{{TeamId: teamID, UserId: target.Id}},
		nil,
	)
	api.On("HasPermissionToTeam", requester, teamID, model.PermissionViewTeam).Return(false)

	table, stats, err := svc.buildResolverTable(
		context.Background(),
		requester,
		[]string{target.Id},
		nil,
		nil,
		svc.config,
	)
	require.NoError(t, err)
	require.Equal(t, 1, stats.Lookups)
	require.False(t, stats.CapHit)
	require.Equal(t, report.RenderUser{}, table.Users[target.Id])
}

func TestReportServiceBuildResolverTableChannelDenied(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	requester := model.NewId()
	channelID := model.NewId()

	api.On("GetChannel", channelID).Return(&model.Channel{
		Id:   channelID,
		Name: "ops-room",
		Type: model.ChannelTypeOpen,
	}, nil)
	api.On("HasPermissionToChannel", requester, channelID, model.PermissionReadChannel).Return(false)

	table, _, err := svc.buildResolverTable(
		context.Background(),
		requester,
		nil,
		[]string{channelID},
		nil,
		svc.config,
	)
	require.NoError(t, err)
	require.Equal(t, report.RenderChannel{}, table.Channels[channelID])
}

func TestReportServiceBuildResolverTableChannelAllowed(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	requester := model.NewId()
	channelID := model.NewId()

	api.On("GetChannel", channelID).Return(&model.Channel{
		Id:          channelID,
		Name:        "ops-room",
		DisplayName: "Ops Room",
		Type:        model.ChannelTypeOpen,
	}, nil)
	api.On("HasPermissionToChannel", requester, channelID, model.PermissionReadChannel).Return(true)

	table, _, err := svc.buildResolverTable(
		context.Background(),
		requester,
		nil,
		[]string{channelID},
		nil,
		svc.config,
	)
	require.NoError(t, err)
	got := table.Channels[channelID]
	require.Equal(t, channelID, got.ChannelID)
	require.Equal(t, "ops-room", got.Name)
	require.Equal(t, "Ops Room", got.DisplayName)
}

func TestReportServiceBuildResolverTableFileDenied(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	requester := model.NewId()
	fileID := model.NewId()
	postID := model.NewId()
	channelID := model.NewId()

	api.On("GetFileInfo", fileID).Return(&model.FileInfo{
		Id:       fileID,
		PostId:   postID,
		Name:     "q3.pdf",
		Size:     1024,
		MimeType: "application/pdf",
	}, nil)
	api.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
	}, nil)
	api.On("HasPermissionToChannel", requester, channelID, model.PermissionReadChannel).Return(false)

	table, _, err := svc.buildResolverTable(
		context.Background(),
		requester,
		nil,
		nil,
		[]string{fileID},
		svc.config,
	)
	require.NoError(t, err)
	require.Equal(t, report.RenderFile{}, table.Files[fileID])
}

func TestReportServiceBatchResolveUsers(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	uid1 := model.NewId()
	uid2 := model.NewId()

	api.On("GetUsersByIds", []string{uid1, uid2}).Return(
		[]*model.User{
			{Id: uid1, Username: "alice", FirstName: "A", LastName: "L"},
			{Id: uid2, Username: "bob"},
		},
		nil,
	)

	out := svc.batchResolveUsers([]string{uid1, uid2, uid1, ""})
	require.Equal(t, "A L", out[uid1].DisplayName)
	require.Equal(t, "bob", out[uid2].DisplayName)
}

func TestReportServiceChannelPostsIteratorFiltersAndDedups(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	channelID := model.NewId()
	userID := model.NewId()

	api.On("GetUser", userID).Return(&model.User{Id: userID, Username: "alice"}, nil)

	api.On("GetPostsForChannel", channelID, 0, 200).Return(&model.PostList{
		Order: []string{"keep", "edit", "system", "after", "before", "dup1", "dup2"},
		Posts: map[string]*model.Post{
			"keep":   {Id: "keep", UserId: userID, Message: "hello", CreateAt: 50},
			"edit":   {Id: "edit", UserId: userID, Message: "edited", OriginalId: "old", CreateAt: 50},
			"system": {Id: "system", UserId: userID, Message: "joined", Type: "system_join_channel", CreateAt: 50},
			"after":  {Id: "after", UserId: userID, Message: "future", CreateAt: 200},
			"before": {Id: "before", UserId: userID, Message: "past", CreateAt: 5},
			"dup1":   {Id: "dupshared", UserId: userID, Message: "dup", CreateAt: 50},
			"dup2":   {Id: "dupshared", UserId: userID, Message: "dup", CreateAt: 50},
		},
	}, nil)

	iter := svc.channelPostsIterator(channelID, 10, 100, channelPostsIterOpts{
		pageSize: 200,
		throttle: time.Millisecond,
	})

	got, err := iter(context.Background())
	require.NoError(t, err)
	require.Len(t, got, 2)
	require.Equal(t, "keep", got[0].PostID)
	require.Equal(t, "dupshared", got[1].PostID)
}

func TestReportServiceChannelPostsIteratorEmptyPageExhausts(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	channelID := model.NewId()

	api.On("GetPostsForChannel", channelID, 0, 200).Return(&model.PostList{
		Order: nil,
		Posts: map[string]*model.Post{},
	}, nil)

	iter := svc.channelPostsIterator(channelID, 0, 0, channelPostsIterOpts{
		pageSize: 200,
		throttle: time.Millisecond,
	})
	got, err := iter(context.Background())
	require.NoError(t, err)
	require.Empty(t, got)

	got2, err := iter(context.Background())
	require.NoError(t, err)
	require.Empty(t, got2)
}

func TestReportServiceChannelPostsIteratorRespectsContext(t *testing.T) {
	api := &plugintest.API{}
	svc := newTestReportService(api)

	iter := svc.channelPostsIterator(model.NewId(), 0, 0, channelPostsIterOpts{
		pageSize: 200,
		throttle: 50 * time.Millisecond,
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := iter(ctx)
	require.ErrorIs(t, err, context.Canceled)
}
