// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

func newTestReportService(api *plugintest.API) *ReportService {
	client := pluginapi.NewClient(api, &plugintest.Driver{})
	return &ReportService{pluginAPI: client}
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
		},
		Checklists: []Checklist{
			{Items: []ChecklistItem{{AssigneeID: "assignee"}}},
		},
	}
	require.ElementsMatch(t,
		[]string{"owner", "p1", "p2", "owner", "subj", "creator", "assignee"},
		collectRunUserIDs(run))
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

	t.Run("leaves out tasks a condition hides", func(t *testing.T) {
		checklists := buildChecklists([]Checklist{{Items: []ChecklistItem{
			{ID: "shown", Title: "Shown"},
			{ID: "hidden", Title: "Hidden", ConditionAction: ConditionActionHidden},
		}}}, nil)
		require.Len(t, checklists[0].Items, 1)
		require.Equal(t, "Shown", checklists[0].Items[0].Title)
	})
}

func TestReportServiceBuildStatusUpdates(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	botID, aliceID, bobID := model.NewId(), model.NewId(), model.NewId()

	// The playbooks bot posts every update; the author is in the timeline
	// event or, failing that, the authorUsername prop.
	api.On("GetPost", "p1").Return(&model.Post{Id: "p1", UserId: botID, Message: "first", Props: model.StringInterface{"authorUsername": "bob"}}, nil)
	api.On("GetPost", "p2").Return(&model.Post{Id: "p2", UserId: botID, Message: "second", Props: model.StringInterface{"authorUsername": "bob"}}, nil)
	api.On("GetPost", "p3").Return(nil, model.NewAppError("GetPost", "not_found", nil, "", 404))
	api.On("GetUserByUsername", "bob").Return(&model.User{Id: bobID, Username: "bob"}, nil)

	run := &PlaybookRun{
		StatusPosts: []StatusPost{
			{ID: "p1", CreateAt: 10},
			{ID: "p2", CreateAt: 20},
			{ID: "p3", CreateAt: 30},
			{ID: "deleted", CreateAt: 40, DeleteAt: 50},
		},
		TimelineEvents: []TimelineEvent{
			{EventType: StatusUpdated, PostID: "p1", SubjectUserID: aliceID},
			{EventType: StatusUpdated, PostID: "p3", SubjectUserID: aliceID},
		},
	}

	require.Equal(t, []report.RenderStatusUpdate{
		{AuthorID: aliceID, CreateAt: 10, Message: "first"},
		{AuthorID: bobID, CreateAt: 20, Message: "second"},
		{AuthorID: aliceID, CreateAt: 30},
	}, newTestReportService(api).buildStatusUpdates(run))
}

func TestReportServiceBuildRetrospective(t *testing.T) {
	run := &PlaybookRun{
		Retrospective: "done",
		MetricsData: []RunMetricData{
			{MetricConfigID: "m1", Value: null.IntFrom(0)},
			{MetricConfigID: "m2", Value: null.Int{}},
			{MetricConfigID: "gone", Value: null.IntFrom(5)},
		},
	}
	cfg := []PlaybookMetricConfig{
		{ID: "m1", Title: "Time to detect", Type: MetricTypeDuration, Target: null.IntFrom(60)},
		{ID: "m2", Title: "Spend", Type: MetricTypeCurrency},
		{ID: "m3", Title: "Customers affected", Type: MetricTypeInteger},
	}

	t.Run("configs join the run's values and keep zero apart from unset", func(t *testing.T) {
		retro := buildRetrospective(run, cfg)
		require.Equal(t, "done", retro.Body)
		require.Equal(t, []report.RenderMetric{
			{Title: "Time to detect", Type: "duration", Value: 0, HasValue: true},
			{Title: "Spend", Type: "currency"},
			{Title: "Customers affected", Type: "integer"},
		}, retro.Metrics)
	})

	t.Run("no metrics without the playbook's configs", func(t *testing.T) {
		require.Empty(t, buildRetrospective(run, nil).Metrics)
	})

	t.Run("published, draft and canceled", func(t *testing.T) {
		published := &PlaybookRun{RetrospectivePublishedAt: 100}
		retro := buildRetrospective(published, nil)
		require.True(t, retro.Published)
		require.False(t, retro.Canceled)

		require.False(t, buildRetrospective(&PlaybookRun{}, nil).Published, "an unpublished retrospective is a draft")

		canceled := &PlaybookRun{
			RetrospectivePublishedAt: 300,
			RetrospectiveWasCanceled: true,
			TimelineEvents: []TimelineEvent{
				{EventType: CanceledRetrospective, CreateAt: 200, SubjectUserID: "u2"},
				{EventType: CanceledRetrospective, CreateAt: 300, SubjectUserID: "u3"},
				{EventType: CanceledRetrospective, CreateAt: 400, DeleteAt: 500, SubjectUserID: "u4"},
				{EventType: PublishedRetrospective, CreateAt: 600, SubjectUserID: "u5"},
			},
		}
		retro = buildRetrospective(canceled, nil)
		require.False(t, retro.Published)
		require.True(t, retro.Canceled)
		require.Equal(t, int64(300), retro.CanceledAt)
		require.Equal(t, "u3", retro.CanceledByID)
	})
}

func TestReportServiceChannelLink(t *testing.T) {
	siteURL := "https://chat.example.com/"
	run := &PlaybookRun{ChannelID: "c1"}

	t.Run("named and linked for a requester who can read the channel", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})
		api.On("HasPermissionToChannel", "u1", "c1", model.PermissionReadChannel).Return(true)
		api.On("GetChannel", "c1").Return(&model.Channel{Id: "c1", TeamId: "t1", Name: "db-outage", DisplayName: "DB outage", Type: model.ChannelTypePrivate}, nil)
		api.On("GetTeam", "t1").Return(&model.Team{Id: "t1", Name: "ops"}, nil)

		rc, err := newTestReportService(api).AssembleRunReportContext(context.Background(), run, "u1", report.SectionFlags{})
		require.NoError(t, err)
		require.Equal(t, "DB outage", rc.Run.ChannelName)
		require.Equal(t, "https://chat.example.com/ops/channels/db-outage", rc.Run.ChannelURL)
	})

	t.Run("left out for a requester who cannot read it", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})
		api.On("HasPermissionToChannel", "u2", "c1", model.PermissionReadChannel).Return(false)

		rc, err := newTestReportService(api).AssembleRunReportContext(context.Background(), run, "u2", report.SectionFlags{})
		require.NoError(t, err)
		require.Empty(t, rc.Run.ChannelName)
		require.Empty(t, rc.Run.ChannelURL)
	})
}

func TestReportServiceLeavesOutDisabledRetrospective(t *testing.T) {
	api := &plugintest.API{}
	api.On("GetConfig").Return(&model.Config{})
	svc := newTestReportService(api)
	sections := report.SectionFlags{ExecutiveSummary: true, Retrospective: true}

	rc, err := svc.AssembleRunReportContext(context.Background(), &PlaybookRun{RetrospectiveEnabled: false}, "u1", sections)
	require.NoError(t, err)
	require.False(t, rc.Sections.Retrospective)

	rc, err = svc.AssembleRunReportContext(context.Background(), &PlaybookRun{RetrospectiveEnabled: true}, "u1", sections)
	require.NoError(t, err)
	require.True(t, rc.Sections.Retrospective)
}

// TestReportServiceContextSanitizationInvariant walks the assembled context
// via reflection and asserts that no raw model.User / model.Post /
// model.Channel value can sneak through. This is the security backstop for
// the renderer's trust boundary.
func TestReportServiceContextSanitizationInvariant(t *testing.T) {
	rc := report.RenderContext{
		Owner:        report.RenderUser{UserID: "u1"},
		Participants: []report.RenderUser{{UserID: "u2"}},
		StatusUpdates: []report.RenderStatusUpdate{
			{AuthorID: "u1", Message: "hi"},
		},
		TimelineEvents: []report.RenderTimelineEvent{{EventType: "incident_created"}},
		Checklists: []report.RenderChecklist{
			{Title: "ck", Items: []report.RenderChecklistItem{{Title: "task"}}},
		},
		Retrospective: report.RenderRetrospective{Body: "done"},
		Transcript: []report.RenderPost{
			{PostID: "p2"},
		},
		Users: map[string]report.RenderUser{"u1": {UserID: "u1"}},
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

func TestReportServiceFetchTranscript(t *testing.T) {
	channelID := model.NewId()
	userID := model.NewId()

	t.Run("filters and dedups", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetPostsForChannel", channelID, 0, transcriptPageSize).Return(&model.PostList{
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

		posts, truncation, err := newTestReportService(api).fetchTranscript(context.Background(), channelID, 10, 100)
		require.NoError(t, err)
		require.False(t, truncation.Hit)
		require.Len(t, posts, 2)
		require.Equal(t, "keep", posts[0].PostID)
		require.Equal(t, "dupshared", posts[1].PostID)
	})

	t.Run("reads past pages from after the run", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		// The newest page holds only posts from after the run ended.
		api.On("GetPostsForChannel", channelID, 0, transcriptPageSize).Return(&model.PostList{
			Order: []string{"later1", "later2"},
			Posts: map[string]*model.Post{
				"later1": {Id: "later1", UserId: userID, CreateAt: 300},
				"later2": {Id: "later2", UserId: userID, CreateAt: 200},
			},
		}, nil)
		api.On("GetPostsForChannel", channelID, 1, transcriptPageSize).Return(&model.PostList{
			Order: []string{"during", "before"},
			Posts: map[string]*model.Post{
				"during": {Id: "during", UserId: userID, CreateAt: 50},
				"before": {Id: "before", UserId: userID, CreateAt: 5},
			},
		}, nil)

		posts, _, err := newTestReportService(api).fetchTranscript(context.Background(), channelID, 10, 100)
		require.NoError(t, err)
		require.Len(t, posts, 1)
		require.Equal(t, "during", posts[0].PostID)
	})

	t.Run("an empty page ends the transcript", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetPostsForChannel", channelID, 0, transcriptPageSize).Return(&model.PostList{}, nil)

		posts, truncation, err := newTestReportService(api).fetchTranscript(context.Background(), channelID, 0, 0)
		require.NoError(t, err)
		require.False(t, truncation.Hit)
		require.Empty(t, posts)
	})

	// pages returns full pages of posts with messages of size bytes, newest
	// first, all inside the run.
	pages := func(size int) func(string, int, int) (*model.PostList, *model.AppError) {
		message := strings.Repeat("x", size)
		return func(_ string, page, perPage int) (*model.PostList, *model.AppError) {
			list := model.NewPostList()
			for i := range perPage {
				id := fmt.Sprintf("p%d-%d", page, i)
				list.AddPost(&model.Post{Id: id, UserId: userID, Message: message, CreateAt: int64(1_000_000 - page*perPage - i)})
				list.AddOrder(id)
			}
			return list, nil
		}
	}

	t.Run("stops at the post cap", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetPostsForChannel", channelID, mock.Anything, transcriptPageSize).Return(pages(1))

		posts, truncation, err := newTestReportService(api).fetchTranscript(context.Background(), channelID, 0, 0)
		require.NoError(t, err)
		require.Equal(t, report.Truncation{Hit: true, Reason: "posts"}, truncation)
		require.Len(t, posts, maxTranscriptPosts)
	})

	t.Run("stops at the byte cap", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetPostsForChannel", channelID, mock.Anything, transcriptPageSize).Return(pages(1024 * 1024))

		posts, truncation, err := newTestReportService(api).fetchTranscript(context.Background(), channelID, 0, 0)
		require.NoError(t, err)
		require.Equal(t, report.Truncation{Hit: true, Reason: "bytes"}, truncation)
		require.Len(t, posts, int(maxTranscriptBytes/(1024*1024)))
	})

	t.Run("stops when the context ends", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, truncation, err := newTestReportService(&plugintest.API{}).fetchTranscript(ctx, channelID, 0, 0)
		require.ErrorIs(t, err, context.Canceled)
		require.Equal(t, report.Truncation{Hit: true, Reason: "timeout"}, truncation)
	})
}
