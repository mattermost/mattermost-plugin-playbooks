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
	pluginAPI       *pluginapi.Client
}

// NewReportService constructs a ReportService.
func NewReportService(playbookService PlaybookService, pluginAPI *pluginapi.Client) *ReportService {
	return &ReportService{
		playbookService: playbookService,
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

	// The playbook gives the report its title and the retrospective metrics'
	// titles and types.
	var playbook *Playbook
	if run.PlaybookID != "" {
		if pb, err := s.playbookService.Get(run.PlaybookID); err == nil {
			playbook = &pb
			rc.Run.PlaybookTitle = pb.Title
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
	if sections.Retrospective {
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
				if err != nil && !errors.Is(err, context.Canceled) {
					return report.RenderContext{}, errors.Wrap(err, "failed to assemble transcript")
				}
				rc.Transcript = posts
				rc.TranscriptTruncation = truncation
			}
		}
	}

	userIDs := collectRunUserIDs(run)
	for _, su := range rc.StatusUpdates {
		userIDs = append(userIDs, su.AuthorID)
	}
	for _, p := range rc.Transcript {
		userIDs = append(userIDs, p.AuthorID)
	}
	rc.Users = s.batchResolveUsers(userIDs)
	rc.Owner = rc.Users[run.OwnerUserID]
	rc.Participants = make([]report.RenderUser, 0, len(run.ParticipantIDs))
	for _, id := range run.ParticipantIDs {
		rc.Participants = append(rc.Participants, rc.Users[id])
	}

	rc.GeneratedAtMillis = time.Now().UnixMilli()
	return rc, nil
}

// fetchTranscript reads a channel's posts from the run's window,
// (startMs, endMs], newest first, leaving out system messages and edit
// history. It stops at the transcript caps and says so in the Truncation.
// When ctx ends it returns the posts read so far with ctx's error.
func (s *ReportService) fetchTranscript(ctx context.Context, channelID string, startMs, endMs int64) ([]report.RenderPost, report.Truncation, error) {
	var (
		posts []report.RenderPost
		bytes int64
	)
	seen := make(map[string]bool)
	for page := 0; ; page++ {
		if err := ctx.Err(); err != nil {
			return posts, report.Truncation{}, err
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
func (s *ReportService) buildStatusUpdates(run *PlaybookRun) []report.RenderStatusUpdate {
	out := make([]report.RenderStatusUpdate, 0, len(run.StatusPosts))
	for _, sp := range run.StatusPosts {
		if sp.DeleteAt != 0 {
			continue
		}
		post, err := s.pluginAPI.Post.GetPost(sp.ID)
		if err != nil || post == nil {
			out = append(out, report.RenderStatusUpdate{CreateAt: sp.CreateAt})
			continue
		}
		out = append(out, report.RenderStatusUpdate{
			AuthorID: post.UserId,
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
// metric to show: a value without its title or type means nothing.
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
	return report.RenderRetrospective{Body: run.Retrospective, Metrics: metrics}
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
