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

func TestReportServiceTaskStateUsers(t *testing.T) {
	event := func(at int64, userID, details string) TimelineEvent {
		return TimelineEvent{EventType: TaskStateModified, CreateAt: at, SubjectUserID: userID, Details: details}
	}
	events := []TimelineEvent{
		// Out of order on purpose: the later uncheck wins over the earlier check.
		event(30, "u2", `{"action":"uncheck","task":"Reopened","item_id":"i2"}`),
		event(10, "u1", `{"action":"check","task":"Page on-call","item_id":"i1"}`),
		event(20, "u1", `{"action":"check","task":"Reopened","item_id":"i2"}`),
		event(40, "u3", `{"action":"skip","task":"War room","item_id":"i3"}`),
		event(50, "u2", `{"action":"check","task":"Page on-call","item_id":"i1"}`),
		// No item ID, as recorded before item IDs were stored.
		event(60, "u4", `{"action":"check","task":"Old"}`),
		// Not a task event.
		{EventType: OwnerChanged, CreateAt: 70, SubjectUserID: "u5", Details: `{"item_id":"i4","action":"check"}`},
		// Deleted.
		{EventType: TaskStateModified, CreateAt: 80, DeleteAt: 90, SubjectUserID: "u6", Details: `{"action":"check","item_id":"i5"}`},
	}

	require.Equal(t, map[string]string{"i1": "u2", "i3": "u3"}, taskStateUsers(events))

	checklists := buildChecklists([]Checklist{{Items: []ChecklistItem{
		{ID: "i1", Title: "Page on-call", State: ChecklistItemStateClosed, StateModified: 50},
		{ID: "i3", Title: "War room", State: ChecklistItemStateSkipped, StateModified: 40},
		// Open again, though an old entry names who closed it.
		{ID: "i1", Title: "Copy", State: ChecklistItemStateOpen},
	}}}, taskStateUsers(events))
	items := checklists[0].Items
	require.Equal(t, "u2", items[0].StateUserID)
	require.Equal(t, int64(50), items[0].StateMs)
	require.Equal(t, "u3", items[1].StateUserID)
	require.Empty(t, items[2].StateUserID)
}

func TestReportServiceMetricsFromConfigs(t *testing.T) {
	t.Run("configs join the run's values", func(t *testing.T) {
		cfg := []PlaybookMetricConfig{
			{ID: "m1", Title: "Resolution", Type: MetricTypeDuration, Target: null.IntFrom(60)},
			{ID: "m2", Title: "Spend", Type: MetricTypeCurrency},
		}
		out := metricsFromConfigs(cfg, map[string]int64{"m1": 42})
		require.Len(t, out, 2)
		require.Equal(t, "duration", out[0].Type)
		require.True(t, out[0].HasValue)
		require.Equal(t, int64(42), out[0].Value)
		require.Equal(t, "currency", out[1].Type)
		require.False(t, out[1].HasValue)
	})

	t.Run("run metric values join to playbook configs by id and preserve null vs zero", func(t *testing.T) {
		// Mirrors the production path: playbook metric configs supply
		// labels and types; run-side values come in via the lookup
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
		StatusUpdates: []report.RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u1", Message: "hi"},
		},
		TimelineEvents: []report.RenderTimelineEvent{{EventType: "incident_created"}},
		Checklists: []report.RenderChecklist{
			{Title: "ck", Items: []report.RenderChecklistItem{{Title: "task"}}},
		},
		Retrospective: report.RenderRetrospective{Body: "done"},
		Transcript: []report.RenderPost{
			{PostID: "p2"},
		},
		Resolvers: report.ResolverTable{
			Users: map[string]report.RenderUser{"u1": {UserID: "u1"}},
		},
	}
	requireNoRawModelTypes(t, reflect.ValueOf(rc))
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
		require.Falsef(t, forbidden[typeName], "forbidden raw model type %q found in render context", typeName)
		switch v.Kind() {
		case reflect.Pointer, reflect.Interface:
			if !v.IsNil() {
				visit(v.Elem())
			}
		case reflect.Struct:
			for _, field := range v.Fields() {
				visit(field)
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

func TestReportServiceChannelPostsIteratorSkipsPagesAfterTheRun(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)

	svc := newTestReportService(api)
	channelID := model.NewId()
	userID := model.NewId()

	// The newest page holds only posts from after the run ended.
	api.On("GetPostsForChannel", channelID, 0, 2).Return(&model.PostList{
		Order: []string{"later1", "later2"},
		Posts: map[string]*model.Post{
			"later1": {Id: "later1", UserId: userID, CreateAt: 300},
			"later2": {Id: "later2", UserId: userID, CreateAt: 200},
		},
	}, nil)
	api.On("GetPostsForChannel", channelID, 1, 2).Return(&model.PostList{
		Order: []string{"during", "before"},
		Posts: map[string]*model.Post{
			"during": {Id: "during", UserId: userID, CreateAt: 50},
			"before": {Id: "before", UserId: userID, CreateAt: 5},
		},
	}, nil)

	iter := svc.channelPostsIterator(channelID, 10, 100, channelPostsIterOpts{
		pageSize: 2,
		throttle: time.Millisecond,
	})

	got, err := iter(context.Background())
	require.NoError(t, err)
	require.Len(t, got, 1)
	require.Equal(t, "during", got[0].PostID)

	got, err = iter(context.Background())
	require.NoError(t, err)
	require.Empty(t, got)
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
