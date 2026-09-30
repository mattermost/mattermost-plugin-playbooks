// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

const (
	assertWaitFor = time.Second
	assertTick    = 10 * time.Millisecond
)

type stubConfigService struct {
	config.Service
	manifest *model.Manifest
	isCloud  bool
}

func (s *stubConfigService) GetManifest() *model.Manifest {
	if s.manifest != nil {
		return s.manifest
	}
	return &model.Manifest{Id: "playbooks"}
}

func (s *stubConfigService) IsCloud() bool {
	return s.isCloud
}

func newPosterForTest(t *testing.T) (*Bot, *plugintest.API) {
	t.Helper()
	api := &plugintest.API{}
	t.Cleanup(func() { api.AssertExpectations(t) })
	return &Bot{
		botUserID:     "bot-user-id",
		configService: &stubConfigService{},
		pluginAPI:     pluginapi.NewClient(api, nil),
	}, api
}

// captureBroadcast registers a PublishWebSocketEvent expectation and returns a pointer that
// receives the broadcast the method was called with.
func captureBroadcast(api *plugintest.API, event string) **model.WebsocketBroadcast {
	captured := new(*model.WebsocketBroadcast)
	api.On("PublishWebSocketEvent", event, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			*captured = args.Get(2).(*model.WebsocketBroadcast)
		}).Once()
	return captured
}

func TestPublishWebsocketEventBroadcastScope(t *testing.T) {
	const (
		event     = "playbook_run_updated"
		channelID = "channel-id"
		userID    = "user-id"
		teamID    = "team-id"
	)
	payload := map[string]string{"foo": "bar"}

	for _, tc := range []struct {
		name     string
		call     func(b *Bot)
		assertWB func(t *testing.T, wb *model.WebsocketBroadcast)
	}{
		{
			name: "ToChannel is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventToChannel(event, payload, channelID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, channelID, wb.ChannelId)
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToChannelReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventToChannelReliable(event, payload, channelID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, channelID, wb.ChannelId)
				assert.True(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToUser is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventToUser(event, payload, userID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, userID, wb.UserId)
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToUserReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventToUserReliable(event, payload, userID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, userID, wb.UserId)
				assert.True(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToTeam is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventToTeam(event, payload, teamID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, teamID, wb.TeamId)
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToTeamReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventToTeamReliable(event, payload, teamID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, teamID, wb.TeamId)
				assert.True(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "Global is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventGlobal(event, payload) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "GlobalReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventGlobalReliable(event, payload) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.True(t, wb.ReliableClusterSend)
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, api := newPosterForTest(t)
			captured := captureBroadcast(api, event)

			tc.call(b)

			require.NotNil(t, *captured)
			tc.assertWB(t, *captured)
		})
	}
}

func TestPublishWebsocketEventPayloadMarshalled(t *testing.T) {
	// All publish methods funnel payload marshalling through the same helper, so cover both a
	// reliable and a best-effort entry point to guard the shared path against future refactors.
	for _, tc := range []struct {
		name string
		call func(b *Bot, event string, payload interface{})
	}{
		{"reliable", func(b *Bot, event string, payload interface{}) {
			b.PublishWebsocketEventToChannelReliable(event, payload, "channel-id")
		}},
		{"best-effort", func(b *Bot, event string, payload interface{}) {
			b.PublishWebsocketEventToChannel(event, payload, "channel-id")
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, api := newPosterForTest(t)
			payload := map[string]string{"hello": "world"}

			var gotPayload map[string]interface{}
			api.On("PublishWebSocketEvent", "evt", mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					gotPayload = args.Get(1).(map[string]interface{})
				}).Once()

			tc.call(b, "evt", payload)

			raw, ok := gotPayload["payload"].(string)
			require.True(t, ok, "payload should be JSON-encoded under the \"payload\" key")
			var decoded map[string]string
			require.NoError(t, json.Unmarshal([]byte(raw), &decoded))
			assert.Equal(t, payload, decoded)
		})
	}
}

func TestBotSkipsEmptyPosts(t *testing.T) {
	for _, tc := range []struct {
		name string
		call func(t *testing.T, b *Bot, api *plugintest.API) (*model.Post, error)
	}{
		{
			name: "PostMessage empty string",
			call: func(t *testing.T, b *Bot, api *plugintest.API) (*model.Post, error) {
				return b.PostMessage("channel-id", "")
			},
		},
		{
			name: "DM whitespace only",
			call: func(t *testing.T, b *Bot, api *plugintest.API) (*model.Post, error) {
				api.On("GetDirectChannel", "user-id", "bot-user-id").Return(&model.Channel{Id: "dm-channel-id"}, nil).Once()
				return nil, b.DM("user-id", &model.Post{Message: " \n\t "})
			},
		},
		{
			name: "custom post action-only attachment",
			call: func(t *testing.T, b *Bot, api *plugintest.API) (*model.Post, error) {
				return b.PostCustomMessageWithAttachments("channel-id", "custom_type", []*model.MessageAttachment{
					{
						Text: "\n\n---\n\n",
						Actions: []*model.PostAction{{
							Type: "button",
							Name: "Start trial",
						}},
					},
				}, "")
			},
		},
		{
			name: "PostCustomMessageWithAttachmentsf empty format",
			call: func(t *testing.T, b *Bot, api *plugintest.API) (*model.Post, error) {
				return b.PostCustomMessageWithAttachmentsf("channel-id", "custom_type", nil, "   ")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, api := newPosterForTest(t)

			post, err := tc.call(t, b, api)
			require.NoError(t, err)
			assert.Nil(t, post)
			api.AssertNotCalled(t, "CreatePost", mock.Anything)
		})
	}
}

func TestBotSendsPostsWithContent(t *testing.T) {
	b, api := newPosterForTest(t)
	createdPosts := make(chan *model.Post, 1)
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.ChannelId == "channel-id" && post.Message == "" && post.Type == "custom_type"
	})).Run(func(args mock.Arguments) {
		createdPosts <- args.Get(0).(*model.Post).Clone()
	}).Return(func(post *model.Post) *model.Post {
		return post.Clone()
	}, nil).Once()

	_, err := b.PostCustomMessageWithAttachments("channel-id", "custom_type", []*model.MessageAttachment{
		{Title: "Upgrade playbooks", Text: "Start a trial to unlock this feature."},
	}, "")

	require.NoError(t, err)
	var createdPost *model.Post
	require.Eventually(t, func() bool {
		select {
		case createdPost = <-createdPosts:
			return true
		default:
			return false
		}
	}, assertWaitFor, assertTick)
	attachments, ok := createdPost.GetProps()[model.PostPropsAttachments].([]*model.MessageAttachment)
	require.True(t, ok)
	require.Len(t, attachments, 1)
	assert.Equal(t, "Upgrade playbooks", attachments[0].Title)
	assert.Equal(t, "Start a trial to unlock this feature.", attachments[0].Text)
}

func TestBotSendsDifferentContentSources(t *testing.T) {
	for _, tc := range []struct {
		name   string
		call   func(b *Bot) error
		assert func(t *testing.T, post *model.Post)
	}{
		{
			name: "message text",
			call: func(b *Bot) error {
				_, err := b.PostMessage("channel-id", "hello %s", "world")
				return err
			},
			assert: func(t *testing.T, post *model.Post) {
				assert.Equal(t, "hello world", post.Message)
				assert.Equal(t, "channel-id", post.ChannelId)
			},
		},
		{
			name: "file IDs",
			call: func(b *Bot) error {
				return b.PostMessageToThread("", &model.Post{
					ChannelId: "channel-id",
					FileIds:   model.StringArray{"file-id"},
				})
			},
			assert: func(t *testing.T, post *model.Post) {
				assert.Equal(t, model.StringArray{"file-id"}, post.FileIds)
				assert.Equal(t, "channel-id", post.ChannelId)
			},
		},
		{
			name: "attachment field",
			call: func(b *Bot) error {
				_, err := b.PostMessageWithAttachments("channel-id", []*model.MessageAttachment{
					{Fields: []*model.MessageAttachmentField{{Title: "Task", Value: "Follow up"}}},
				}, "")
				return err
			},
			assert: func(t *testing.T, post *model.Post) {
				attachments, ok := post.GetProps()[model.PostPropsAttachments].([]*model.MessageAttachment)
				require.True(t, ok)
				require.Len(t, attachments, 1)
				require.Len(t, attachments[0].Fields, 1)
				assert.Equal(t, "Task", attachments[0].Fields[0].Title)
				assert.Equal(t, "Follow up", attachments[0].Fields[0].Value)
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, api := newPosterForTest(t)
			createdPosts := make(chan *model.Post, 1)
			api.On("CreatePost", mock.AnythingOfType("*model.Post")).
				Run(func(args mock.Arguments) {
					createdPosts <- args.Get(0).(*model.Post).Clone()
				}).
				Return(func(post *model.Post) *model.Post {
					return post.Clone()
				}, nil).Once()

			require.NoError(t, tc.call(b))

			var createdPost *model.Post
			require.Eventually(t, func() bool {
				select {
				case createdPost = <-createdPosts:
					return true
				default:
					return false
				}
			}, assertWaitFor, assertTick)
			tc.assert(t, createdPost)
		})
	}
}

func TestNotifyAdminsSkipsUnknownMessageType(t *testing.T) {
	b, api := newPosterForTest(t)

	const authorID = "author-id"
	api.On("GetUser", authorID).Return(&model.User{Id: authorID, Username: "requester"}, nil).Once()
	api.On("GetUsers", mock.MatchedBy(func(options *model.UserGetOptions) bool {
		return options.Role == string(model.SystemAdminRoleId) && options.PerPage == maxAdminsToQueryForNotification
	})).Return([]*model.User{{Id: "admin-id"}}, nil).Once()

	require.NoError(t, b.NotifyAdmins("unknown_notification_type", authorID, false))
	api.AssertNotCalled(t, "GetDirectChannel", mock.Anything, mock.Anything)
	api.AssertNotCalled(t, "CreatePost", mock.Anything)
}

func TestNotifyAdminsChecklistItemDueDateSendsContent(t *testing.T) {
	b, api := newPosterForTest(t)

	const (
		authorID = "author-id"
		adminID  = "admin-id"
	)
	api.On("GetUser", authorID).Return(&model.User{Id: authorID, Username: "requester"}, nil).Once()
	api.On("GetUsers", mock.MatchedBy(func(options *model.UserGetOptions) bool {
		return options.Role == string(model.SystemAdminRoleId) && options.PerPage == maxAdminsToQueryForNotification
	})).Return([]*model.User{{Id: adminID}}, nil).Once()
	api.On("GetDirectChannel", adminID, "bot-user-id").Return(&model.Channel{Id: "dm-channel-id"}, nil).Once()

	createdPosts := make(chan *model.Post, 1)
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.ChannelId == "dm-channel-id" && strings.Contains(post.Message, "set due dates")
	})).Run(func(args mock.Arguments) {
		createdPosts <- args.Get(0).(*model.Post).Clone()
	}).Return(func(post *model.Post) *model.Post {
		return post.Clone()
	}, nil).Once()

	require.NoError(t, b.NotifyAdmins("start_trial_to_set_checklist_item_due_date", authorID, false))

	var createdPost *model.Post
	require.Eventually(t, func() bool {
		select {
		case createdPost = <-createdPosts:
			return true
		default:
			return false
		}
	}, assertWaitFor, assertTick)

	assert.NotEmpty(t, strings.TrimSpace(createdPost.Message))
	assert.Contains(t, createdPost.Message, "@requester")
	attachments, ok := createdPost.GetProps()[model.PostPropsAttachments].([]*model.MessageAttachment)
	require.True(t, ok)
	require.Len(t, attachments, 1)
	assert.Equal(t, "Keep checklist work on schedule", attachments[0].Title)
	assert.Contains(t, attachments[0].Text, "Set due dates on checklist items")
	require.Len(t, attachments[0].Actions, 1)
	assert.Equal(t, "Start 30-day trial", attachments[0].Actions[0].Name)
}
