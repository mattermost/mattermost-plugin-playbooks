// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"context"
	"encoding/json"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// Transcript caps: a transcript stops at whichever it reaches first, and the
// report says it was cut short.
const (
	maxTranscriptPosts       = 5000
	maxTranscriptBytes int64 = 50 * 1024 * 1024
	transcriptPageSize       = 200
)

// ReportService assembles the sanitized RenderContext for the renderer. The
// writers only turn the data into HTML or Markdown.
type ReportService struct {
	playbookService PlaybookService
	propertyService PropertyService
	pluginAPI       *pluginapi.Client
}

// NewReportService constructs a ReportService.
func NewReportService(playbookService PlaybookService, propertyService PropertyService, pluginAPI *pluginapi.Client) *ReportService {
	return &ReportService{
		playbookService: playbookService,
		propertyService: propertyService,
		pluginAPI:       pluginAPI,
	}
}

// AssembleRunReportContext builds the sanitized RenderContext for a run. The
// caller must have checked that userID can view the run; the transcript is
// only included when userID is a member of the run's channel.
func (s *ReportService) AssembleRunReportContext(
	ctx context.Context,
	run *PlaybookRun,
	userID string,
	sections report.SectionFlags,
) (report.RenderContext, error) {
	// The run page leaves out a disabled retrospective, so the report does too.
	sections.Retrospective = sections.Retrospective && run.RetrospectiveEnabled
	rc := report.RenderContext{
		Sections: sections,
		Run: report.RenderRun{
			Name:        run.Name,
			Summary:     run.Summary,
			Status:      run.CurrentStatus,
			StartTimeMs: run.CreateAt,
			EndTimeMs:   run.EndAt,
		},
	}

	var siteURL string
	if cfg := s.pluginAPI.Configuration.GetConfig(); cfg != nil && cfg.ServiceSettings.SiteURL != nil {
		siteURL = strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
	}

	// The playbook gives the report its title and the retrospective metrics'
	// titles and types.
	var playbook *Playbook
	if run.PlaybookID != "" {
		if pb, err := s.playbookService.Get(run.PlaybookID); err == nil {
			playbook = &pb
			rc.Run.PlaybookTitle = pb.Title
			if siteURL != "" {
				rc.Run.PlaybookURL = getPlaybookDetailsURL(siteURL, run.PlaybookID)
			}
		}
	}

	// The channel is named only to a requester who can read it, so a run
	// viewer outside a private run channel doesn't learn its name.
	if run.ChannelID != "" && s.pluginAPI.User.HasPermissionToChannel(userID, run.ChannelID, model.PermissionReadChannel) {
		if channel, err := s.pluginAPI.Channel.Get(run.ChannelID); err == nil {
			rc.Run.ChannelName = channel.DisplayName
			if siteURL != "" {
				if team, err := s.pluginAPI.Team.Get(channel.TeamId); err == nil {
					rc.Run.ChannelURL = getURLForChannel(siteURL, team.Name, channel)
				}
			}
		}
	}

	if sections.StatusUpdates {
		rc.StatusUpdates = s.buildStatusUpdates(run)
	}
	if sections.Timeline {
		rc.TimelineEvents = buildTimelineEvents(run)
	}
	if sections.Checklists {
		rc.Checklists = buildChecklists(run.Checklists, taskStateUsers(run.TimelineEvents))
	}
	// The metrics are the headline figures even when the retrospective
	// section is left out.
	if run.RetrospectiveEnabled {
		var metricConfigs []PlaybookMetricConfig
		if playbook != nil {
			metricConfigs = playbook.Metrics
		}
		rc.Retrospective = buildRetrospective(run, metricConfigs)
	}

	if sections.Transcript {
		switch run.ChannelID {
		case "":
			rc.TranscriptOmittedReason = report.TranscriptOmittedNoChannel
		default:
			if _, err := s.pluginAPI.Channel.GetMember(run.ChannelID, userID); err != nil {
				rc.TranscriptOmittedReason = report.TranscriptOmittedNotMember
			} else {
				posts, truncation, err := s.fetchTranscript(ctx, run.ChannelID, run.CreateAt, run.EndAt)
				// When ctx ends, the posts read so far make a truncated
				// transcript rather than a failed export.
				if err != nil && ctx.Err() == nil {
					return report.RenderContext{}, errors.Wrap(err, "failed to assemble transcript")
				}
				rc.Transcript = posts
				rc.TranscriptTruncation = truncation
			}
		}
	}

	attributes, err := s.buildAttributes(run.ID)
	if err != nil {
		return report.RenderContext{}, errors.Wrap(err, "failed to load run attributes")
	}
	rc.Attributes = attributes

	userIDs := collectRunUserIDs(run)
	for _, a := range rc.Attributes {
		userIDs = append(userIDs, a.UserIDs...)
	}
	for _, su := range rc.StatusUpdates {
		userIDs = append(userIDs, su.AuthorID)
	}
	for _, p := range rc.Transcript {
		userIDs = append(userIDs, p.AuthorID)
	}
	rc.Users = s.batchResolveUsers(userIDs)
	if !s.canSeeFullNames(userID) {
		for id, u := range rc.Users {
			u.DisplayName = u.Username
			rc.Users[id] = u
		}
	}
	rc.Owner = rc.Users[run.OwnerUserID]
	rc.Participants = make([]report.RenderUser, 0, len(run.ParticipantIDs))
	for _, id := range run.ParticipantIDs {
		rc.Participants = append(rc.Participants, rc.Users[id])
	}

	rc.GeneratedAtMillis = time.Now().UnixMilli()
	return rc, nil
}

// buildAttributes lists the run's attributes in their playbook order. Hidden
// attributes are left out, and so are unset ones unless they are always
// shown. Picked options are named; an option that no longer exists is
// dropped.
func (s *ReportService) buildAttributes(runID string) ([]report.RenderAttribute, error) {
	if s.propertyService == nil {
		return nil, nil
	}
	fields, err := s.propertyService.GetRunPropertyFields(runID)
	if err != nil {
		return nil, err
	}
	values, err := s.propertyService.GetRunPropertyValues(runID)
	if err != nil {
		return nil, err
	}
	byField := make(map[string]json.RawMessage, len(values))
	for _, v := range values {
		if v.DeleteAt == 0 {
			byField[v.FieldID] = v.Value
		}
	}
	slices.SortStableFunc(fields, func(a, b PropertyField) int { return cmp.Compare(a.Attrs.SortOrder, b.Attrs.SortOrder) })

	var out []report.RenderAttribute
	for _, f := range fields {
		visibility := cmp.Or(f.Attrs.Visibility, PropertyFieldVisibilityDefault)
		if f.DeleteAt != 0 || visibility == PropertyFieldVisibilityHidden {
			continue
		}
		a := attributeValue(f, byField[f.ID])
		if len(a.Text) == 0 && len(a.UserIDs) == 0 && a.DateMs == 0 && visibility != PropertyFieldVisibilityAlways {
			continue
		}
		out = append(out, a)
	}
	return out, nil
}

// attributeValue decodes an attribute's stored value; a value that doesn't
// decode leaves it unset.
func attributeValue(f PropertyField, raw json.RawMessage) report.RenderAttribute {
	a := report.RenderAttribute{Name: f.Name}
	var one string
	var many []string
	switch f.Type {
	case model.PropertyFieldTypeText:
		if json.Unmarshal(raw, &one) == nil && strings.TrimSpace(one) != "" {
			a.Text = []string{one}
		}
	case model.PropertyFieldTypeSelect:
		if json.Unmarshal(raw, &one) == nil {
			a.Text = optionNames(f, []string{one})
		}
	case model.PropertyFieldTypeMultiselect:
		if json.Unmarshal(raw, &many) == nil {
			a.Text = optionNames(f, many)
		}
	case model.PropertyFieldTypeUser:
		if json.Unmarshal(raw, &one) == nil && one != "" {
			a.UserIDs = []string{one}
		}
	case model.PropertyFieldTypeMultiuser:
		if json.Unmarshal(raw, &many) == nil {
			a.UserIDs = slices.DeleteFunc(many, func(id string) bool { return id == "" })
		}
	case model.PropertyFieldTypeDate:
		if json.Unmarshal(raw, &one) == nil {
			if t, err := time.Parse(time.RFC3339, one); err == nil {
				a.DateMs = t.UnixMilli()
			}
		}
	}
	return a
}

// optionNames names the picked options, in the order picked.
func optionNames(f PropertyField, ids []string) []string {
	var names []string
	for _, id := range ids {
		for _, o := range f.Attrs.Options {
			if o != nil && o.GetID() == id {
				names = append(names, o.GetName())
				break
			}
		}
	}
	return names
}

// fetchTranscript reads a channel's posts from the run's window,
// (startMs, endMs], newest first, leaving out system messages and edit
// history. It stops at the transcript caps and says so in the Truncation.
// When ctx ends it returns the posts read so far, truncated for "timeout",
// with ctx's error.
func (s *ReportService) fetchTranscript(ctx context.Context, channelID string, startMs, endMs int64) ([]report.RenderPost, report.Truncation, error) {
	var (
		posts []report.RenderPost
		bytes int64
	)
	seen := make(map[string]bool)
	for page := 0; ; page++ {
		if err := ctx.Err(); err != nil {
			return posts, report.Truncation{Hit: true, Reason: "timeout"}, err
		}
		list, err := s.pluginAPI.Post.GetPostsForChannel(channelID, page, transcriptPageSize)
		if err != nil {
			return posts, report.Truncation{}, errors.Wrap(err, "failed to fetch channel posts")
		}
		if list == nil || len(list.Order) == 0 {
			return posts, report.Truncation{}, nil
		}

		// Pages run newest first, so a post from before the run is the last
		// page to read.
		lastPage := false
		for _, id := range list.Order {
			post := list.Posts[id]
			if post == nil || seen[post.Id] {
				continue
			}
			seen[post.Id] = true
			if post.OriginalId != "" || post.Type != "" || (endMs > 0 && post.CreateAt > endMs) {
				continue
			}
			if post.CreateAt < startMs {
				lastPage = true
				continue
			}

			if len(posts) >= maxTranscriptPosts {
				return posts, report.Truncation{Hit: true, Reason: "posts"}, nil
			}
			if bytes += int64(len(post.Message)); bytes > maxTranscriptBytes {
				return posts, report.Truncation{Hit: true, Reason: "bytes"}, nil
			}
			posts = append(posts, report.RenderPost{
				PostID:   post.Id,
				AuthorID: post.UserId,
				CreateAt: post.CreateAt,
				Message:  post.Message,
				RootID:   post.RootId,
			})
		}
		if lastPage {
			return posts, report.Truncation{}, nil
		}
	}
}

// batchResolveUsers fetches RenderUser DTOs for a set of user IDs. Duplicates
// are coalesced. Unresolvable IDs yield a zero-value entry (rendered as
// "Unknown user").
func (s *ReportService) batchResolveUsers(ids []string) map[string]report.RenderUser {
	out := make(map[string]report.RenderUser, len(ids))
	uniq := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := out[id]; ok {
			continue
		}
		out[id] = report.RenderUser{}
		uniq = append(uniq, id)
	}
	if len(uniq) == 0 {
		return out
	}

	if users, err := s.pluginAPI.User.ListByUserIDs(uniq); err == nil && users != nil {
		for _, u := range users {
			if u == nil {
				continue
			}
			out[u.Id] = renderUserFromModel(u)
		}
		return out
	}

	for _, id := range uniq {
		out[id] = s.resolveUser(id)
	}
	return out
}

func (s *ReportService) resolveUser(id string) report.RenderUser {
	if id == "" {
		return report.RenderUser{}
	}
	u, err := s.pluginAPI.User.Get(id)
	if err != nil || u == nil {
		return report.RenderUser{UserID: id}
	}
	return renderUserFromModel(u)
}

// canSeeFullNames reports whether userID may see other users' full names:
// everyone may unless the server's privacy settings hide them, and system
// admins always may.
func (s *ReportService) canSeeFullNames(userID string) bool {
	cfg := s.pluginAPI.Configuration.GetConfig()
	if cfg == nil || cfg.PrivacySettings.ShowFullName == nil || *cfg.PrivacySettings.ShowFullName {
		return true
	}
	return s.pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem)
}

func renderUserFromModel(u *model.User) report.RenderUser {
	display := strings.TrimSpace(strings.Join([]string{u.FirstName, u.LastName}, " "))
	if display == "" {
		display = u.Username
	}
	return report.RenderUser{
		UserID:      u.Id,
		Username:    u.Username,
		DisplayName: display,
		Nickname:    strings.TrimSpace(u.Nickname),
	}
}

// collectRunUserIDs lists the users the run names: its owner, participants,
// timeline subjects and creators, and assignees. It may repeat a user.
func collectRunUserIDs(run *PlaybookRun) []string {
	ids := append([]string{run.OwnerUserID}, run.ParticipantIDs...)
	for _, ev := range run.TimelineEvents {
		ids = append(ids, ev.SubjectUserID, ev.CreatorUserID)
	}
	for _, cl := range run.Checklists {
		for _, item := range cl.Items {
			ids = append(ids, item.AssigneeID)
		}
	}
	return ids
}

// buildStatusUpdates assembles the chronological status post stream. Post
// bodies are fetched on demand because StatusPost only persists the postID.
// The playbooks bot posts every update, so the author comes from the
// update's status_updated timeline event, or else from the post's
// authorUsername prop.
func (s *ReportService) buildStatusUpdates(run *PlaybookRun) []report.RenderStatusUpdate {
	authors := make(map[string]string)
	for _, ev := range run.TimelineEvents {
		if ev.EventType == StatusUpdated && ev.PostID != "" {
			authors[ev.PostID] = ev.SubjectUserID
		}
	}

	out := make([]report.RenderStatusUpdate, 0, len(run.StatusPosts))
	for _, sp := range run.StatusPosts {
		if sp.DeleteAt != 0 {
			continue
		}
		post, err := s.pluginAPI.Post.GetPost(sp.ID)
		if err != nil || post == nil {
			out = append(out, report.RenderStatusUpdate{AuthorID: authors[sp.ID], CreateAt: sp.CreateAt})
			continue
		}
		authorID := authors[sp.ID]
		if username, _ := post.GetProp("authorUsername").(string); authorID == "" && username != "" {
			if user, err := s.pluginAPI.User.GetByUsername(username); err == nil && user != nil {
				authorID = user.Id
			}
		}
		out = append(out, report.RenderStatusUpdate{
			AuthorID: authorID,
			CreateAt: sp.CreateAt,
			Message:  post.Message,
		})
	}
	return out
}

func buildTimelineEvents(run *PlaybookRun) []report.RenderTimelineEvent {
	out := make([]report.RenderTimelineEvent, 0, len(run.TimelineEvents))
	for _, ev := range run.TimelineEvents {
		if ev.DeleteAt != 0 {
			continue
		}
		out = append(out, report.RenderTimelineEvent{
			EventType: string(ev.EventType),
			CreateAt:  cmp.Or(ev.EventAt, ev.CreateAt),
			Summary:   ev.Summary,
			Details:   ev.Details,
			SubjectID: ev.SubjectUserID,
			CreatorID: ev.CreatorUserID,
		})
	}
	return out
}

// taskStateUsers maps each checklist item ID to the user who last checked
// off or skipped it, read from the run's task_state_modified timeline
// events. Unchecking or restoring an item clears its entry. Events recorded
// before the item ID was stored in them are skipped.
func taskStateUsers(events []TimelineEvent) map[string]string {
	sorted := slices.Clone(events)
	slices.SortStableFunc(sorted, func(a, b TimelineEvent) int { return cmp.Compare(a.CreateAt, b.CreateAt) })

	users := make(map[string]string)
	for _, ev := range sorted {
		if ev.EventType != TaskStateModified || ev.DeleteAt != 0 {
			continue
		}
		var details TaskStateModifiedDetails
		if err := json.Unmarshal([]byte(ev.Details), &details); err != nil || details.ItemID == "" {
			continue
		}
		switch details.Action {
		case taskStateActionCheck, taskStateActionSkip:
			users[details.ItemID] = ev.SubjectUserID
		case taskStateActionUncheck, taskStateActionRestore:
			delete(users, details.ItemID)
		}
	}
	return users
}

// buildChecklists converts a run's checklists for the report. stateUsers,
// from taskStateUsers, names who closed or skipped each item.
func buildChecklists(in []Checklist, stateUsers map[string]string) []report.RenderChecklist {
	out := make([]report.RenderChecklist, 0, len(in))
	for _, c := range in {
		items := make([]report.RenderChecklistItem, 0, len(c.Items))
		for _, it := range c.Items {
			// Tasks a condition hides are not part of the run.
			if it.ConditionAction == ConditionActionHidden {
				continue
			}
			item := report.RenderChecklistItem{
				Title:       it.Title,
				State:       it.State,
				StateMs:     it.StateModified,
				AssigneeID:  it.AssigneeID,
				DueAtMs:     it.DueDate,
				Description: it.Description,
				Command:     it.Command,
			}
			if it.State == ChecklistItemStateClosed || it.State == ChecklistItemStateSkipped {
				item.StateUserID = stateUsers[it.ID]
			}
			items = append(items, item)
		}
		out = append(out, report.RenderChecklist{
			Title: c.Title,
			Items: items,
		})
	}
	return out
}

// buildRetrospective joins the run's metric values to the playbook's metric
// configs, which give each metric its title, description and type. Without
// the configs (the playbook was deleted or could not be loaded) there is no
// metric to show: a value without its title or type means nothing. A
// canceled retrospective is named after the last canceled_retrospective
// timeline event's user; canceling records its time as the publish time.
func buildRetrospective(run *PlaybookRun, metricConfigs []PlaybookMetricConfig) report.RenderRetrospective {
	values := make(map[string]int64, len(run.MetricsData))
	for _, md := range run.MetricsData {
		if md.Value.Valid {
			values[md.MetricConfigID] = md.Value.Int64
		}
	}
	metrics := make([]report.RenderMetric, 0, len(metricConfigs))
	for _, m := range metricConfigs {
		value, ok := values[m.ID]
		metrics = append(metrics, report.RenderMetric{
			Title:       m.Title,
			Description: m.Description,
			Type:        metricTypeFromConfig(m.Type),
			Value:       value,
			HasValue:    ok,
		})
	}
	retro := report.RenderRetrospective{
		Body:      run.Retrospective,
		Metrics:   metrics,
		Published: run.RetrospectivePublishedAt > 0 && !run.RetrospectiveWasCanceled,
		Canceled:  run.RetrospectiveWasCanceled,
	}
	if retro.Canceled {
		retro.CanceledAt = run.RetrospectivePublishedAt
		var last int64
		for _, ev := range run.TimelineEvents {
			if ev.EventType == CanceledRetrospective && ev.DeleteAt == 0 && ev.CreateAt >= last {
				last, retro.CanceledByID = ev.CreateAt, ev.SubjectUserID
			}
		}
	}
	return retro
}

func metricTypeFromConfig(t string) string {
	switch t {
	case MetricTypeDuration:
		return "duration"
	case MetricTypeCurrency:
		return "currency"
	case MetricTypeInteger:
		return "integer"
	}
	return t
}
