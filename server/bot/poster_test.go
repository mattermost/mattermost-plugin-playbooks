// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// fakeConfigService is a minimal config.Service stub for tests that don't
// care about most config behavior.
type fakeConfigService struct {
	isCloud bool
}

func (f *fakeConfigService) GetConfiguration() *config.Configuration               { return &config.Configuration{} }
func (f *fakeConfigService) UpdateConfiguration(func(*config.Configuration)) error { return nil }
func (f *fakeConfigService) RegisterConfigChangeListener(func()) string            { return "" }
func (f *fakeConfigService) UnregisterConfigChangeListener(string)                 {}
func (f *fakeConfigService) GetManifest() *model.Manifest {
	return &model.Manifest{Id: "playbooks"}
}
func (f *fakeConfigService) IsConfiguredForDevelopmentAndTesting() bool { return false }
func (f *fakeConfigService) IsCloud() bool                              { return f.isCloud }
func (f *fakeConfigService) SupportsGivingFeedback() error              { return nil }
func (f *fakeConfigService) IsIncrementalUpdatesEnabled() bool          { return false }
func (f *fakeConfigService) IsExperimentalFeaturesEnabled() bool        { return false }

// allAdminNotificationMessageTypes mirrors webapp/src/constants.ts's AdminNotificationType
// enum. Every value there must produce a non-blank DM: this test would have caught the
// bug where "start_trial_to_set_checklist_item_due_date" fell through the switch in
// NotifyAdmins with no title or text.
var allAdminNotificationMessageTypes = []string{
	"start_trial_to_view_timeline",
	"start_trial_to_add_message_to_timeline",
	"start_trial_to_access_retrospective",
	"start_trial_to_restrict_playbook_access",
	"start_trial_to_restrict_playbook_creation",
	"start_trial_to_export_channel",
	"start_trial_to_access_playbook_dashboard",
	"start_trial_to_access_metrics",
	"start_trial_to_set_checklist_item_due_date",
	"start_trial_to_request_update",
}

func TestNotifyAdmins(t *testing.T) {
	for _, messageType := range allAdminNotificationMessageTypes {
		t.Run(messageType, func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)

			authorID := model.NewId()
			adminID := model.NewId()
			botID := model.NewId()

			api.On("GetUser", authorID).Return(&model.User{Id: authorID, Username: "author"}, (*model.AppError)(nil))
			api.On("GetUsers", mock.AnythingOfType("*model.UserGetOptions")).
				Return([]*model.User{{Id: adminID, Username: "admin"}}, (*model.AppError)(nil))
			api.On("GetDirectChannel", adminID, botID).
				Return(&model.Channel{Id: model.NewId()}, (*model.AppError)(nil))

			// PostService.CreatePost shallow-copies the mock's returned post back onto the
			// original pointer, which would wipe out the attachment props if we returned a
			// blank post. Read the attachments off the post while handling the mock call,
			// before that copy-back happens.
			attachmentsCh := make(chan []*model.MessageAttachment, 1)
			api.On("CreatePost", mock.AnythingOfType("*model.Post")).
				Run(func(args mock.Arguments) {
					post := args.Get(0).(*model.Post)
					attachmentsCh <- post.Attachments()
				}).
				Return(&model.Post{Id: model.NewId()}, (*model.AppError)(nil))

			b := &Bot{
				pluginAPI:     pluginapi.NewClient(api, &plugintest.Driver{}),
				botUserID:     botID,
				configService: &fakeConfigService{},
			}

			err := b.NotifyAdmins(messageType, authorID, false)
			require.NoError(t, err)

			select {
			case attachments := <-attachmentsCh:
				require.Len(t, attachments, 1)
				require.NotEmpty(t, attachments[0].Title, "title must not be blank")
				require.NotEmpty(t, attachments[0].Text, "text must not be blank")
			case <-time.After(5 * time.Second):
				require.FailNow(t, "timed out waiting for the admin DM to be created")
			}
		})
	}
}
