// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

// ReportConfig is the caps + flags used during report assembly.
type ReportConfig struct {
	MaxRunReportPosts           int
	MaxRunReportBytes           int64
	MaxResolverLookupsPerExport int
	ExportTranscriptDefault     bool
}

// DefaultReportConfig returns the documented defaults from plan §3.6.8.
func DefaultReportConfig() ReportConfig {
	return ReportConfig{
		MaxRunReportPosts:           5000,
		MaxRunReportBytes:           50 * 1024 * 1024,
		MaxResolverLookupsPerExport: 500,
		ExportTranscriptDefault:     false,
	}
}

// ResolverStats describes a single resolver-table build invocation. It is
// emitted by the handler into the audit record.
type ResolverStats struct {
	Lookups int
	Cached  int
	CapHit  bool
}

// ReportService orchestrates assembly of sanitized RenderContext /
// PlaybookRenderContext values for the renderer. All permission scoping
// happens here; the renderer is data-in / PDF-out.
type ReportService struct {
	runService         PlaybookRunService
	playbookService    PlaybookService
	permissionsService *PermissionsService
	pluginAPI          *pluginapi.Client
	auditor            Auditor
	config             ReportConfig
}

// NewReportService constructs a ReportService.
func NewReportService(
	runService PlaybookRunService,
	playbookService PlaybookService,
	permissionsService *PermissionsService,
	pluginAPI *pluginapi.Client,
	auditor Auditor,
	cfg ReportConfig,
) *ReportService {
	if cfg.MaxRunReportPosts == 0 {
		cfg.MaxRunReportPosts = DefaultReportConfig().MaxRunReportPosts
	}
	if cfg.MaxRunReportBytes == 0 {
		cfg.MaxRunReportBytes = DefaultReportConfig().MaxRunReportBytes
	}
	if cfg.MaxResolverLookupsPerExport == 0 {
		cfg.MaxResolverLookupsPerExport = DefaultReportConfig().MaxResolverLookupsPerExport
	}
	return &ReportService{
		runService:         runService,
		playbookService:    playbookService,
		permissionsService: permissionsService,
		pluginAPI:          pluginAPI,
		auditor:            auditor,
		config:             cfg,
	}
}

// Config returns the active configuration (used by handlers to compute caps).
func (s *ReportService) Config() ReportConfig {
	return s.config
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
	locale string,
) (report.RenderContext, ResolverStats, error) {
	if err := s.permissionsService.RunView(userID, runID); err != nil {
		return report.RenderContext{}, ResolverStats{}, err
	}

	run, err := s.runService.GetPlaybookRun(runID)
	if err != nil {
		return report.RenderContext{}, ResolverStats{}, errors.Wrap(err, "failed to load run")
	}

	rc := report.RenderContext{
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

	if ch, cerr := s.pluginAPI.Channel.Get(run.ChannelID); cerr == nil {
		rc.Channel = report.RenderChannel{
			ChannelID:   ch.Id,
			Name:        ch.Name,
			DisplayName: ch.DisplayName,
			Type:        string(ch.Type),
		}
	} else {
		rc.Channel = report.RenderChannel{ChannelID: run.ChannelID}
	}

	if run.TeamID != "" {
		if team, terr := s.pluginAPI.Team.Get(run.TeamID); terr == nil {
			rc.Team = report.RenderTeam{
				TeamID:      team.Id,
				Name:        team.Name,
				DisplayName: team.DisplayName,
			}
		} else {
			rc.Team = report.RenderTeam{TeamID: run.TeamID}
		}
	}

	if sections.StatusUpdates {
		rc.StatusUpdates = s.buildStatusUpdates(run)
	}
	if sections.Timeline {
		rc.TimelineEvents = buildTimelineEvents(run)
	}
	if sections.Checklists {
		rc.Checklists = buildChecklists(run.Checklists)
	}
	if sections.Retrospective {
		var metricConfigs []PlaybookMetricConfig
		if playbook != nil {
			metricConfigs = playbook.Metrics
		}
		rc.Retrospective = buildRetrospective(run, metricConfigs)
	}

	if sections.Transcript {
		switch {
		case run.ChannelID == "":
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
					return report.RenderContext{}, ResolverStats{}, errors.Wrap(tErr, "failed to assemble transcript")
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

	users, channelNames, fileIDs := extractResolverTargets(&rc)
	table, stats, rerr := s.buildResolverTable(ctx, userID, users, channelNames, fileIDs, s.config)
	if rerr != nil {
		return report.RenderContext{}, ResolverStats{}, rerr
	}
	rc.Resolvers = table
	seedResolverUsers(&rc.Resolvers, userCache)

	rc.GeneratedAtMillis = time.Now().UnixMilli()
	return rc, stats, nil
}

// seedResolverUsers folds the per-run user cache (owner, participants,
// timeline actors, assignees, post authors) into the resolver table so the
// renderer can look up display names for any user already loaded by the run
// assembly — without paying for another batch fetch. Targets the requester
// could not see remain zero-value in the table per §3.6.6.
func seedResolverUsers(rt *report.ResolverTable, userCache map[string]report.RenderUser) {
	if rt.Users == nil {
		rt.Users = make(map[string]report.RenderUser, len(userCache))
	}
	for id, u := range userCache {
		if _, ok := rt.Users[id]; ok {
			continue
		}
		if u.DisplayName == "" && u.Username == "" {
			continue
		}
		rt.Users[id] = u
	}
}

// AssemblePlaybookReportContext builds the sanitized PlaybookRenderContext.
func (s *ReportService) AssemblePlaybookReportContext(
	ctx context.Context,
	playbookID string,
	userID string,
	sections report.SectionFlags,
	locale string,
	hasPlaybookManage bool,
) (report.PlaybookRenderContext, ResolverStats, error) {
	if err := s.permissionsService.PlaybookView(userID, playbookID); err != nil {
		return report.PlaybookRenderContext{}, ResolverStats{}, err
	}

	pb, err := s.playbookService.Get(playbookID)
	if err != nil {
		return report.PlaybookRenderContext{}, ResolverStats{}, errors.Wrap(err, "failed to load playbook")
	}

	pc := report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{
			ID:          pb.ID,
			Title:       pb.Title,
			Description: pb.Description,
			Public:      pb.Public,
			TeamID:      pb.TeamID,
		},
	}

	seenUsers := make(map[string]struct{}, len(pb.Members))
	memberIDs := make([]string, 0, len(pb.Members))
	for _, m := range pb.Members {
		if _, ok := seenUsers[m.UserID]; ok || m.UserID == "" {
			continue
		}
		seenUsers[m.UserID] = struct{}{}
		memberIDs = append(memberIDs, m.UserID)
	}
	for _, cl := range pb.Checklists {
		for _, item := range cl.Items {
			if item.AssigneeID == "" {
				continue
			}
			if _, ok := seenUsers[item.AssigneeID]; ok {
				continue
			}
			seenUsers[item.AssigneeID] = struct{}{}
			memberIDs = append(memberIDs, item.AssigneeID)
		}
	}
	memberCache := s.batchResolveUsers(memberIDs)

	pc.Members = make([]report.RenderPlaybookMember, 0, len(pb.Members))
	for _, m := range pb.Members {
		ru := memberCache[m.UserID]
		pc.Members = append(pc.Members, report.RenderPlaybookMember{
			UserID:      m.UserID,
			DisplayName: ru.DisplayName,
			Roles:       append([]string(nil), m.SchemeRoles...),
		})
	}

	pc.ChecklistTemplates = buildChecklists(pb.Checklists)

	pc.StatusUpdateConfig = report.RenderStatusUpdateConfig{
		Enabled:  pb.StatusUpdateEnabled,
		Template: pb.ReminderMessageTemplate,
		Cadence:  formatCadenceSeconds(pb.ReminderTimerDefaultSeconds),
	}

	pc.RetrospectiveConfig = report.RenderRetrospectiveConfig{
		Enabled:         pb.RetrospectiveEnabled,
		Template:        pb.RetrospectiveTemplate,
		ReminderCadence: formatCadenceSeconds(pb.RetrospectiveReminderIntervalSeconds),
		Metrics:         metricsFromConfigs(pb.Metrics, nil),
	}

	pc.BroadcastChannels = make([]report.RenderChannel, 0, len(pb.BroadcastChannelIDs))
	for _, cid := range pb.BroadcastChannelIDs {
		if ch, cErr := s.pluginAPI.Channel.Get(cid); cErr == nil {
			pc.BroadcastChannels = append(pc.BroadcastChannels, report.RenderChannel{
				ChannelID:   ch.Id,
				Name:        ch.Name,
				DisplayName: ch.DisplayName,
				Type:        string(ch.Type),
			})
		} else {
			pc.BroadcastChannels = append(pc.BroadcastChannels, report.RenderChannel{ChannelID: cid})
		}
	}

	pc.WebhooksOnCreation = redactWebhooks(pb.WebhookOnCreationURLs, hasPlaybookManage)
	pc.WebhooksOnStatus = redactWebhooks(pb.WebhookOnStatusUpdateURLs, hasPlaybookManage)

	pc.SignalKeywords = append([]string(nil), pb.SignalAnyKeywords...)

	pc.Resolvers = report.ResolverTable{
		Users:      make(map[string]report.RenderUser, len(memberCache)),
		Channels:   map[string]report.RenderChannel{},
		Files:      map[string]report.RenderFile{},
		Permalinks: map[string]report.RenderPostPreview{},
	}
	seedResolverUsers(&pc.Resolvers, memberCache)

	pc.GeneratedAtMillis = time.Now().UnixMilli()
	return pc, ResolverStats{}, nil
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
	usersCache := make(map[string]report.RenderUser)
	exhausted := false

	return func(ctx context.Context) ([]report.RenderPost, error) {
		if exhausted {
			return nil, nil
		}
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
			return nil, nil
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

			author, ok := usersCache[post.UserId]
			if !ok && post.UserId != "" {
				author = s.resolveUser(post.UserId)
				usersCache[post.UserId] = author
			}

			out = append(out, report.RenderPost{
				PostID:   post.Id,
				AuthorID: post.UserId,
				CreateAt: post.CreateAt,
				Message:  post.Message,
				RootID:   post.RootId,
				Type:     post.Type,
				Files:    filesFromPost(s.pluginAPI, post),
			})
		}

		return out, nil
	}
}

type transcriptDrain struct {
	posts      []report.RenderPost
	truncation report.Truncation
}

// drainTranscript consumes the iterator into a slice, enforcing the post-cap
// and the byte-cap (approximated by Message + Name bytes).
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
			for _, f := range p.Files {
				postBytes += int64(len(f.Name))
			}
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
	}
}

// buildResolverTable does the permission-scoped pre-resolution for the
// markdown extension. Each target gets one lookup; permissions denials are
// recorded as zero-value entries so the deny path is byte-identical to
// "not found" (plan §3.6.6).
func (s *ReportService) buildResolverTable(
	ctx context.Context,
	requesterUserID string,
	userIDs, channelNames, fileIDs []string,
	caps ReportConfig,
) (report.ResolverTable, ResolverStats, error) {
	table := report.ResolverTable{
		Users:      map[string]report.RenderUser{},
		Channels:   map[string]report.RenderChannel{},
		Files:      map[string]report.RenderFile{},
		Permalinks: map[string]report.RenderPostPreview{},
	}
	stats := ResolverStats{}

	uniqUsers := dedupNonEmpty(userIDs, 26)
	uniqChannels := dedupNonEmpty(channelNames, 64)
	uniqFiles := dedupNonEmpty(fileIDs, 26)

	total := len(uniqUsers) + len(uniqChannels) + len(uniqFiles)
	if caps.MaxResolverLookupsPerExport > 0 && total > caps.MaxResolverLookupsPerExport {
		stats.CapHit = true
		uniqUsers, uniqChannels, uniqFiles = capLookups(uniqUsers, uniqChannels, uniqFiles, caps.MaxResolverLookupsPerExport)
	}

	var (
		mu sync.Mutex
		eg errgroup.Group
	)
	eg.SetLimit(4)

	for _, id := range uniqUsers {
		id := id
		eg.Go(func() error {
			lookupCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
			defer cancel()
			ru := s.resolveUserForRequester(lookupCtx, requesterUserID, id)
			mu.Lock()
			table.Users[id] = ru
			stats.Lookups++
			mu.Unlock()
			return nil
		})
	}

	for _, name := range uniqChannels {
		name := name
		eg.Go(func() error {
			lookupCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
			defer cancel()
			rc := s.resolveChannelForRequester(lookupCtx, requesterUserID, name)
			mu.Lock()
			table.Channels[name] = rc
			stats.Lookups++
			mu.Unlock()
			return nil
		})
	}

	for _, fid := range uniqFiles {
		fid := fid
		eg.Go(func() error {
			lookupCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
			defer cancel()
			rf := s.resolveFileForRequester(lookupCtx, requesterUserID, fid)
			mu.Lock()
			table.Files[fid] = rf
			stats.Lookups++
			mu.Unlock()
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return table, stats, err
	}
	return table, stats, nil
}

func (s *ReportService) resolveUserForRequester(ctx context.Context, requesterID, targetID string) report.RenderUser {
	if ctx.Err() != nil {
		return report.RenderUser{}
	}
	u, err := s.pluginAPI.User.Get(targetID)
	if err != nil || u == nil {
		return report.RenderUser{}
	}
	if !s.requesterCanSeeUser(requesterID, u) {
		return report.RenderUser{}
	}
	return renderUserFromModel(u)
}

// requesterCanSeeUser is a conservative shared-team visibility check. It
// returns true when the target is the requester, when both are system users
// the requester can administer, or when the two share at least one team.
func (s *ReportService) requesterCanSeeUser(requesterID string, target *model.User) bool {
	if target == nil || target.Id == "" {
		return false
	}
	if target.Id == requesterID {
		return true
	}
	members, err := s.pluginAPI.Team.ListMembersForUser(target.Id, 0, 200)
	if err != nil || len(members) == 0 {
		return false
	}
	for _, tm := range members {
		if s.pluginAPI.User.HasPermissionToTeam(requesterID, tm.TeamId, model.PermissionViewTeam) {
			return true
		}
	}
	return false
}

func (s *ReportService) resolveChannelForRequester(ctx context.Context, requesterID, channelName string) report.RenderChannel {
	if ctx.Err() != nil {
		return report.RenderChannel{}
	}
	ch, err := s.lookupChannelByIDOrName(channelName)
	if err != nil || ch == nil {
		return report.RenderChannel{}
	}
	if !s.pluginAPI.User.HasPermissionToChannel(requesterID, ch.Id, model.PermissionReadChannel) {
		return report.RenderChannel{}
	}
	return report.RenderChannel{
		ChannelID:   ch.Id,
		Name:        ch.Name,
		DisplayName: ch.DisplayName,
		Type:        string(ch.Type),
	}
}

func (s *ReportService) lookupChannelByIDOrName(target string) (*model.Channel, error) {
	if ch, err := s.pluginAPI.Channel.Get(target); err == nil {
		return ch, nil
	}
	return nil, errors.New("channel not found by id or name")
}

func (s *ReportService) resolveFileForRequester(ctx context.Context, requesterID, fileID string) report.RenderFile {
	if ctx.Err() != nil {
		return report.RenderFile{}
	}
	info, err := s.pluginAPI.File.GetInfo(fileID)
	if err != nil || info == nil {
		return report.RenderFile{}
	}
	if info.PostId == "" {
		return report.RenderFile{}
	}
	post, err := s.pluginAPI.Post.GetPost(info.PostId)
	if err != nil || post == nil {
		return report.RenderFile{}
	}
	if !s.pluginAPI.User.HasPermissionToChannel(requesterID, post.ChannelId, model.PermissionReadChannel) {
		return report.RenderFile{}
	}
	return report.RenderFile{
		FileID: info.Id,
		Name:   info.Name,
		Size:   info.Size,
		Kind:   fileKindFromMime(info.MimeType),
	}
}

// extractResolverTargets is a stub. T1's markdown walker will return the real
// (user, channel, file) target sets; until that lands the resolver table is
// pre-built empty.
func extractResolverTargets(rc *report.RenderContext) ([]string, []string, []string) {
	return nil, nil, nil
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
			CreateAt:  ev.CreateAt,
			Summary:   ev.Summary,
			Details:   ev.Details,
			SubjectID: ev.SubjectUserID,
			CreatorID: ev.CreatorUserID,
		})
	}
	return out
}

func buildChecklists(in []Checklist) []report.RenderChecklist {
	out := make([]report.RenderChecklist, 0, len(in))
	for _, c := range in {
		items := make([]report.RenderChecklistItem, 0, len(c.Items))
		for _, it := range c.Items {
			items = append(items, report.RenderChecklistItem{
				Title:       it.Title,
				State:       it.State,
				StateMs:     it.StateModified,
				AssigneeID:  it.AssigneeID,
				DueAtMs:     it.DueDate,
				Description: it.Description,
				Command:     it.Command,
			})
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
// Description, Type, Target); the run-side instance values come from
// run.MetricsData. When metricConfigs is nil/empty (orphaned run with a
// deleted playbook, or the caller couldn't fetch), the function still emits
// value-only entries so the renderer can show numbers — labels stay blank.
func buildRetrospective(run *PlaybookRun, metricConfigs []PlaybookMetricConfig) report.RenderRetrospective {
	return report.RenderRetrospective{
		Body:        run.Retrospective,
		PublishedMs: run.RetrospectivePublishedAt,
		Metrics:     metricsFromConfigs(metricConfigs, runMetricValueLookup(run)),
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

// metricsFromConfigs maps the canonical PlaybookMetricConfig list into
// the renderer DTO, optionally joining run-instance values via
// valueOverrides (metricID → value). Used for both the playbook surface
// (values nil) and the run surface (values map from runMetricValueLookup).
func metricsFromConfigs(configs []PlaybookMetricConfig, valueOverrides map[string]int64) []report.RenderMetric {
	out := make([]report.RenderMetric, 0, len(configs))
	for _, m := range configs {
		var target int64
		if m.Target.Valid {
			target = m.Target.Int64
		}
		rm := report.RenderMetric{
			ID:          m.ID,
			Title:       m.Title,
			Description: m.Description,
			Type:        metricTypeFromConfig(m.Type),
			Target:      target,
		}
		if val, ok := valueOverrides[m.ID]; ok {
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

func formatCadenceSeconds(seconds int64) string {
	if seconds <= 0 {
		return ""
	}
	d := time.Duration(seconds) * time.Second
	return d.String()
}

// redactWebhooks rewrites URL paths and queries, strips userinfo, and only
// returns the Full URL when the requester has playbook-manage permission
// (plan §3.6.5 / MF-1).
func redactWebhooks(urls []string, hasManage bool) []report.RenderWebhook {
	out := make([]report.RenderWebhook, 0, len(urls))
	for _, raw := range urls {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Host == "" {
			out = append(out, report.RenderWebhook{HostMasked: "****"})
			continue
		}
		host := parsed.Host
		masked := parsed.Scheme + "://" + host
		if parsed.Path != "" || parsed.RawQuery != "" {
			masked += "/****"
		}
		w := report.RenderWebhook{HostMasked: masked}
		if hasManage {
			clean := *parsed
			clean.User = nil
			w.Full = clean.String()
		}
		out = append(out, w)
	}
	return out
}

func fileKindFromMime(mime string) string {
	mime = strings.ToLower(mime)
	switch {
	case strings.HasPrefix(mime, "image/"):
		return "image"
	case strings.HasPrefix(mime, "audio/"):
		return "audio"
	case strings.HasPrefix(mime, "video/"):
		return "video"
	case strings.HasPrefix(mime, "application/pdf"),
		strings.HasPrefix(mime, "application/msword"),
		strings.HasPrefix(mime, "application/vnd."),
		strings.HasPrefix(mime, "text/"):
		return "doc"
	}
	return "other"
}

func filesFromPost(api *pluginapi.Client, post *model.Post) []report.RenderFile {
	if post == nil || len(post.FileIds) == 0 {
		return nil
	}
	out := make([]report.RenderFile, 0, len(post.FileIds))
	for _, fid := range post.FileIds {
		info, err := api.File.GetInfo(fid)
		if err != nil || info == nil {
			out = append(out, report.RenderFile{FileID: fid})
			continue
		}
		out = append(out, report.RenderFile{
			FileID: info.Id,
			Name:   info.Name,
			Size:   info.Size,
			Kind:   fileKindFromMime(info.MimeType),
		})
	}
	return out
}

// dedupNonEmpty returns the unique values of in that are non-empty and within
// the length cap. Order is preserved so capLookups can drop the tail
// deterministically.
func dedupNonEmpty(in []string, maxLen int) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if maxLen > 0 && len(v) > maxLen {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// capLookups truncates the three resolver target slices to a combined budget,
// preferring users > channels > files. The order matches the visual hierarchy
// of references in the rendered PDF.
func capLookups(users, channels, files []string, budget int) ([]string, []string, []string) {
	if budget <= 0 {
		return nil, nil, nil
	}
	take := func(in []string) []string {
		if budget <= 0 {
			return nil
		}
		if len(in) <= budget {
			budget -= len(in)
			return in
		}
		out := in[:budget]
		budget = 0
		return out
	}
	users = take(users)
	channels = take(channels)
	files = take(files)
	return users, channels, files
}
