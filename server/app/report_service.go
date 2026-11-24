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
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

// ReportConfig is the caps used during report assembly.
type ReportConfig struct {
	MaxRunReportPosts int
	MaxRunReportBytes int64
}

// DefaultReportConfig returns the caps every report uses.
func DefaultReportConfig() ReportConfig {
	return ReportConfig{
		MaxRunReportPosts: 5000,
		MaxRunReportBytes: 50 * 1024 * 1024,
	}
}

// ReportService orchestrates assembly of the sanitized RenderContext for
// the renderer. All permission scoping happens here; the writers only turn
// the data into HTML or Markdown.
type ReportService struct {
	runService         PlaybookRunService
	playbookService    PlaybookService
	permissionsService *PermissionsService
	pluginAPI          *pluginapi.Client
	config             ReportConfig
}

// NewReportService constructs a ReportService.
func NewReportService(
	runService PlaybookRunService,
	playbookService PlaybookService,
	permissionsService *PermissionsService,
	pluginAPI *pluginapi.Client,
) *ReportService {
	return &ReportService{
		runService:         runService,
		playbookService:    playbookService,
		permissionsService: permissionsService,
		pluginAPI:          pluginAPI,
		config:             DefaultReportConfig(),
	}
}

// channelPostsIterOpts configures channelPostsIterator behavior.
type channelPostsIterOpts struct {
	includeSystem bool
	pageSize      int
	throttle      time.Duration
}

// postIterator yields the next batch of posts; returns an empty slice when
// the underlying channel is exhausted or a stop condition fires.
type postIterator func(ctx context.Context) ([]report.RenderPost, error)

// AssembleRunReportContext builds the sanitized RenderContext for a run.
func (s *ReportService) AssembleRunReportContext(
	ctx context.Context,
	runID string,
	userID string,
	sections report.SectionFlags,
) (report.RenderContext, error) {
	if err := s.permissionsService.RunView(userID, runID); err != nil {
		return report.RenderContext{}, err
	}

	run, err := s.runService.GetPlaybookRun(runID)
	if err != nil {
		return report.RenderContext{}, errors.Wrap(err, "failed to load run")
	}

	rc := report.RenderContext{
		Sections: sections,
		Run: report.RenderRun{
			ID:          run.ID,
			Name:        run.Name,
			Summary:     run.Summary,
			Status:      run.CurrentStatus,
			StartTimeMs: run.CreateAt,
			EndTimeMs:   run.EndAt,
			PlaybookID:  run.PlaybookID,
		},
	}

	// playbook holds the parent template if we can fetch it — used for
	// PlaybookTitle and the retrospective metric config join.
	var playbook *Playbook
	if run.PlaybookID != "" {
		if pb, perr := s.playbookService.Get(run.PlaybookID); perr == nil {
			playbook = &pb
			rc.Run.PlaybookTitle = pb.Title
		}
	}

	userIDs := collectRunUserIDs(run)
	userCache := s.batchResolveUsers(userIDs)

	rc.Owner = userCache[run.OwnerUserID]
	rc.Participants = make([]report.RenderUser, 0, len(run.ParticipantIDs))
	for _, pid := range run.ParticipantIDs {
		rc.Participants = append(rc.Participants, userCache[pid])
	}

	if sections.StatusUpdates {
		rc.StatusUpdates = s.buildStatusUpdates(run)
		for _, su := range rc.StatusUpdates {
			if _, ok := userCache[su.AuthorID]; !ok && su.AuthorID != "" {
				userCache[su.AuthorID] = s.resolveUser(su.AuthorID)
			}
		}
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
			rc.TranscriptOmittedReason = coretypes.TranscriptOmittedNoChannel
		default:
			if _, mErr := s.pluginAPI.Channel.GetMember(run.ChannelID, userID); mErr != nil {
				rc.TranscriptOmittedReason = coretypes.TranscriptOmittedNotMember
			} else {
				iter := s.channelPostsIterator(run.ChannelID, run.CreateAt, run.EndAt, channelPostsIterOpts{
					includeSystem: false,
					pageSize:      200,
					throttle:      20 * time.Millisecond,
				})
				transcript, tErr := drainTranscript(ctx, iter, s.config.MaxRunReportPosts, s.config.MaxRunReportBytes)
				if tErr != nil && !errors.Is(tErr, context.Canceled) {
					return report.RenderContext{}, errors.Wrap(tErr, "failed to assemble transcript")
				}
				rc.Transcript = transcript.posts
				rc.TranscriptTruncation = transcript.truncation

				for _, p := range rc.Transcript {
					if _, ok := userCache[p.AuthorID]; !ok && p.AuthorID != "" {
						userCache[p.AuthorID] = s.resolveUser(p.AuthorID)
					}
				}
			}
		}
	}

	rc.Resolvers = report.ResolverTable{Users: knownUsers(userCache)}
	rc.GeneratedAtMillis = time.Now().UnixMilli()
	return rc, nil
}

// knownUsers is the users the run's assembly loaded (owner, participants,
// timeline actors, assignees, status and post authors), without the ones
// that could not be loaded, which the report shows as unknown users.
func knownUsers(userCache map[string]report.RenderUser) map[string]report.RenderUser {
	users := make(map[string]report.RenderUser, len(userCache))
	for id, u := range userCache {
		if u.DisplayName != "" || u.Username != "" {
			users[id] = u
		}
	}
	return users
}

// channelPostsIterator returns a paging iterator over a channel's posts,
// filtered to (startMs, endMs] and excluding post-edit duplicates. Each call
// returns the next page; an empty slice indicates exhaustion. The caller is
// responsible for tracking the byte-cap (caps span pages).
func (s *ReportService) channelPostsIterator(channelID string, startMs, endMs int64, opts channelPostsIterOpts) postIterator {
	if opts.pageSize <= 0 {
		opts.pageSize = 200
	}
	if opts.throttle <= 0 {
		opts.throttle = 20 * time.Millisecond
	}

	page := 0
	first := true
	seen := make(map[string]struct{})
	exhausted := false

	// Each call reads pages until one has posts in the window, since a page
	// can hold only posts from after the run ended.
	return func(ctx context.Context) ([]report.RenderPost, error) {
		for !exhausted {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}

			if !first {
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(opts.throttle):
				}
			}
			first = false

			postList, err := s.pluginAPI.Post.GetPostsForChannel(channelID, page, opts.pageSize)
			if err != nil {
				return nil, errors.Wrap(err, "failed to fetch channel posts")
			}
			page++

			if postList == nil || len(postList.Order) == 0 {
				exhausted = true
				break
			}

			out := make([]report.RenderPost, 0, len(postList.Order))
			for _, id := range postList.Order {
				post := postList.Posts[id]
				if post == nil {
					continue
				}
				if _, dup := seen[post.Id]; dup {
					continue
				}
				seen[post.Id] = struct{}{}

				if post.OriginalId != "" {
					continue
				}
				if !opts.includeSystem && post.Type != "" {
					continue
				}
				if endMs > 0 && post.CreateAt > endMs {
					continue
				}
				if startMs > 0 && post.CreateAt < startMs {
					exhausted = true
					continue
				}

				out = append(out, report.RenderPost{
					PostID:   post.Id,
					AuthorID: post.UserId,
					CreateAt: post.CreateAt,
					Message:  post.Message,
					RootID:   post.RootId,
					Type:     post.Type,
				})
			}
			if len(out) > 0 {
				return out, nil
			}
		}
		return nil, nil
	}
}

type transcriptDrain struct {
	posts      []report.RenderPost
	truncation report.Truncation
}

// drainTranscript consumes the iterator into a slice, enforcing the post-cap
// and the byte-cap (counted in message bytes).
func drainTranscript(ctx context.Context, iter postIterator, maxPosts int, maxBytes int64) (transcriptDrain, error) {
	var (
		out      []report.RenderPost
		bytesSum int64
	)
	for {
		batch, err := iter(ctx)
		if err != nil {
			return transcriptDrain{posts: out}, err
		}
		if len(batch) == 0 {
			return transcriptDrain{posts: out, truncation: report.Truncation{Posts: len(out)}}, nil
		}
		for _, p := range batch {
			if maxPosts > 0 && len(out) >= maxPosts {
				return transcriptDrain{
					posts: out,
					truncation: report.Truncation{
						Hit:    true,
						Reason: "posts",
						Posts:  len(out),
					},
				}, nil
			}
			postBytes := int64(len(p.Message))
			if maxBytes > 0 && bytesSum+postBytes > maxBytes {
				return transcriptDrain{
					posts: out,
					truncation: report.Truncation{
						Hit:    true,
						Reason: "bytes",
						Posts:  len(out),
						Bytes:  bytesSum,
					},
				}, nil
			}
			bytesSum += postBytes
			out = append(out, p)
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

// collectRunUserIDs gathers every user identifier referenced by the run's
// owner, participants, timeline subjects/creators, and assignees.
func collectRunUserIDs(run *PlaybookRun) []string {
	seen := make(map[string]struct{})
	add := func(id string) {
		if id == "" {
			return
		}
		seen[id] = struct{}{}
	}
	add(run.OwnerUserID)
	add(run.ReporterUserID)
	for _, p := range run.ParticipantIDs {
		add(p)
	}
	for _, ev := range run.TimelineEvents {
		add(ev.SubjectUserID)
		add(ev.CreatorUserID)
	}
	for _, cl := range run.Checklists {
		for _, item := range cl.Items {
			add(item.AssigneeID)
		}
	}
	out := make([]string, 0, len(seen))
	for id := range seen {
		out = append(out, id)
	}
	return out
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
			out = append(out, report.RenderStatusUpdate{
				PostID:   sp.ID,
				CreateAt: sp.CreateAt,
			})
			continue
		}
		out = append(out, report.RenderStatusUpdate{
			PostID:   sp.ID,
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

// buildRetrospective composes the retrospective DTO for the run renderer.
// metricConfigs is the parent playbook's metric configuration (Title,
// Description, Type); the run-side instance values come from
// run.MetricsData. When metricConfigs is empty (the playbook was deleted or
// could not be loaded), there is no metric left to show: a value without
// its title or type would be meaningless in the report.
func buildRetrospective(run *PlaybookRun, metricConfigs []PlaybookMetricConfig) report.RenderRetrospective {
	return report.RenderRetrospective{
		Body:    run.Retrospective,
		Metrics: metricsFromConfigs(metricConfigs, runMetricValueLookup(run)),
	}
}

// runMetricValueLookup builds the metric-ID → value map for joining a run
// instance's persisted values against the parent playbook's metric configs.
func runMetricValueLookup(run *PlaybookRun) map[string]int64 {
	out := make(map[string]int64, len(run.MetricsData))
	for _, md := range run.MetricsData {
		if md.Value.Valid {
			out[md.MetricConfigID] = md.Value.Int64
		}
	}
	return out
}

// metricsFromConfigs maps the parent playbook's metric configs into the
// renderer DTO, joining the run's values (metricID → value) from
// runMetricValueLookup.
func metricsFromConfigs(configs []PlaybookMetricConfig, values map[string]int64) []report.RenderMetric {
	out := make([]report.RenderMetric, 0, len(configs))
	for _, m := range configs {
		rm := report.RenderMetric{
			ID:          m.ID,
			Title:       m.Title,
			Description: m.Description,
			Type:        metricTypeFromConfig(m.Type),
		}
		if val, ok := values[m.ID]; ok {
			rm.Value = val
			rm.HasValue = true
		}
		out = append(out, rm)
	}
	return out
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
