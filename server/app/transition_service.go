// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// ErrUnknownStatusSlug is returned when SetRunStatus is given a slug not in the playbook scheme.
var ErrUnknownStatusSlug = errors.New("unknown status slug")

var errNoopTransition = errors.New("noop transition")

// LifecycleTransition is the CAS payload for a status/lifecycle write.
type LifecycleTransition struct {
	RunID              string
	ExpectedStatus     string
	ExpectedSlug       string
	NewStatus          string
	NewSlug            string
	At                 int64
	EndAt              *int64
	LastStatusUpdateAt *int64
	Timeline           *TimelineEvent
}

// LifecycleTransitionResult is the outcome of ApplyLifecycleTransition.
type LifecycleTransitionResult struct {
	Applied         bool
	TimelineEventID string
}

// TransitionService is the single writer for run lifecycle and status-slug changes.
type TransitionService struct {
	runs *PlaybookRunServiceImpl
}

// NewTransitionService returns a TransitionService that uses runs for store access and side effects.
func NewTransitionService(runs *PlaybookRunServiceImpl) *TransitionService {
	return &TransitionService{runs: runs}
}

func (s *PlaybookRunServiceImpl) ensureTransition() *TransitionService {
	if s.transition == nil {
		s.transition = NewTransitionService(s)
	}
	return s.transition
}

// FinishPlaybookRun changes a run's state to Finished. If run is already in Finished state, the call is a noop.
func (s *PlaybookRunServiceImpl) FinishPlaybookRun(playbookRunID, userID string) error {
	return s.ensureTransition().Finish(playbookRunID, userID)
}

// RestorePlaybookRun reverts a run from the Finished state. If run was not in Finished state, the call is a noop.
func (s *PlaybookRunServiceImpl) RestorePlaybookRun(playbookRunID, userID string) error {
	return s.ensureTransition().Restore(playbookRunID, userID)
}

// SetRunStatus is the single write path for a scheme slug change, including open-to-open.
func (s *PlaybookRunServiceImpl) SetRunStatus(playbookRunID, userID, slug string) error {
	return s.ensureTransition().SetRunStatus(playbookRunID, userID, slug)
}

// Finish closes the run using the scheme's first closed slug (default: closed).
func (t *TransitionService) Finish(playbookRunID, userID string) error {
	return t.apply(playbookRunID, userID, "finishPlaybookRun", func(run *PlaybookRun, scheme []StatusSchemeOption) (string, string, timelineEventType, error) {
		if run.CurrentStatus == StatusFinished {
			return "", "", "", errNoopTransition
		}
		slug := FirstSlugInCategory(scheme, LifecycleClosed)
		if slug == "" {
			slug = StatusSlugClosed
		}
		return StatusFinished, slug, RunFinished, nil
	})
}

// Restore reopens the run using the scheme's first open slug (default: in_progress).
func (t *TransitionService) Restore(playbookRunID, userID string) error {
	return t.apply(playbookRunID, userID, "restorePlaybookRun", func(run *PlaybookRun, scheme []StatusSchemeOption) (string, string, timelineEventType, error) {
		if run.CurrentStatus != StatusFinished {
			return "", "", "", errNoopTransition
		}
		slug := FirstSlugInCategory(scheme, LifecycleOpen)
		if slug == "" {
			slug = StatusSlugInProgress
		}
		return StatusInProgress, slug, RunRestored, nil
	})
}

// SetRunStatus is the single write path for a scheme slug change, including open-to-open.
func (t *TransitionService) SetRunStatus(playbookRunID, userID, slug string) error {
	return t.apply(playbookRunID, userID, "setRunStatus", func(run *PlaybookRun, scheme []StatusSchemeOption) (string, string, timelineEventType, error) {
		if run.StatusSlug == slug {
			return "", "", "", errNoopTransition
		}
		if _, ok := FindStatusSchemeOption(scheme, slug); !ok {
			return "", "", "", ErrUnknownStatusSlug
		}
		newStatus := CurrentStatusFromStatusSlug(scheme, slug)
		eventType := RunStatusChanged
		if run.CurrentStatus != StatusFinished && newStatus == StatusFinished {
			eventType = RunFinished
		} else if run.CurrentStatus == StatusFinished && newStatus == StatusInProgress {
			eventType = RunRestored
		}
		return newStatus, slug, eventType, nil
	})
}

type resolveTransition func(run *PlaybookRun, scheme []StatusSchemeOption) (newStatus, newSlug string, eventType timelineEventType, err error)

func (t *TransitionService) apply(playbookRunID, userID, auditName string, resolve resolveTransition) error {
	s := t.runs
	auditRec := plugin.MakeAuditRecord(auditName, model.AuditStatusFail)
	defer s.api.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterToAuditRec(auditRec, "playbookRunID", playbookRunID)

	logger := logrus.WithField("playbook_run_id", playbookRunID)

	run, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	model.AddEventParameterToAuditRec(auditRec, "currentStatus", run.CurrentStatus)
	model.AddEventParameterToAuditRec(auditRec, "statusSlug", run.StatusSlug)
	model.AddEventParameterToAuditRec(auditRec, "teamID", run.TeamID)
	model.AddEventParameterToAuditRec(auditRec, "ownerUserID", run.OwnerUserID)

	scheme := t.schemeForRun(run)

	newStatus, newSlug, eventType, err := resolve(run, scheme)
	if errors.Is(err, errNoopTransition) {
		auditRec.Success()
		auditRec.AddEventResultState(*run)
		return nil
	}
	if err != nil {
		return err
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	var originalRun *PlaybookRun
	if s.configService.IsIncrementalUpdatesEnabled() {
		originalRun = run.Clone()
	}

	at := model.GetMillis()
	transition := LifecycleTransition{
		RunID:          playbookRunID,
		ExpectedStatus: run.CurrentStatus,
		ExpectedSlug:   run.StatusSlug,
		NewStatus:      newStatus,
		NewSlug:        newSlug,
		At:             at,
		Timeline: &TimelineEvent{
			PlaybookRunID: playbookRunID,
			CreateAt:      at,
			EventAt:       at,
			EventType:     eventType,
			SubjectUserID: userID,
			Summary:       statusOptionName(scheme, newSlug),
		},
	}
	if newStatus == StatusFinished {
		transition.EndAt = &at
	} else if run.CurrentStatus == StatusFinished && newStatus == StatusInProgress {
		zero := int64(0)
		transition.EndAt = &zero
		transition.LastStatusUpdateAt = &at
	}

	result, err := s.store.ApplyLifecycleTransition(transition)
	if err != nil {
		return err
	}
	if !result.Applied {
		auditRec.Success()
		auditRec.AddEventResultState(*run)
		return nil
	}

	t.runSideEffects(run, user, userID, scheme, newSlug, eventType, at, result.TimelineEventID, originalRun, logger)

	signalName := "run_status_changed"
	signalExtra := map[string]string{"status": newSlug, "user_id": userID}
	if newStatus == StatusFinished {
		signalName = "run_finished"
		signalExtra = map[string]string{"user_id": userID}
	} else if run.CurrentStatus == StatusFinished {
		signalName = "run_restored"
		signalExtra = map[string]string{"user_id": userID}
	}
	s.emitRunSignal(signalName, playbookRunID, signalExtra)

	auditRec.Success()
	model.AddEventParameterToAuditRec(auditRec, "at", at)
	model.AddEventParameterToAuditRec(auditRec, "finalStatus", newStatus)
	model.AddEventParameterToAuditRec(auditRec, "finalSlug", newSlug)
	run.CurrentStatus = newStatus
	run.StatusSlug = newSlug
	if transition.EndAt != nil {
		run.EndAt = *transition.EndAt
	}
	auditRec.AddEventResultState(*run)

	return nil
}

func (t *TransitionService) schemeForRun(run *PlaybookRun) []StatusSchemeOption {
	if run.PlaybookID == "" || t.runs.playbookService == nil {
		return DefaultStatusScheme()
	}
	playbook, err := t.runs.playbookService.Get(run.PlaybookID)
	if err != nil {
		logrus.WithError(err).WithField("playbook_id", run.PlaybookID).Warn("failed to retrieve playbook for status scheme; using default")
		return DefaultStatusScheme()
	}
	return ResolveStatusScheme(playbook.StatusScheme)
}

func (t *TransitionService) runSideEffects(
	run *PlaybookRun,
	user *model.User,
	userID string,
	scheme []StatusSchemeOption,
	newSlug string,
	eventType timelineEventType,
	at int64,
	timelineEventID string,
	originalRun *PlaybookRun,
	logger *logrus.Entry,
) {
	s := t.runs
	playbookRunID := run.ID

	if eventType == RunRestored {
		run = t.unarchiveIfNeeded(run, userID, at, logger)
	}

	message := t.statusMessage(run, user.Username, scheme, newSlug, eventType)
	postID := ""
	post, err := s.poster.PostMessage(run.ChannelID, message)
	if err != nil {
		logger.WithError(err).WithField("channel_id", run.ChannelID).Error("failed to post the status update to channel")
	} else if post != nil {
		postID = post.Id
	}

	if timelineEventID != "" && postID != "" {
		if tlErr := s.store.UpdateTimelineEvent(&TimelineEvent{
			ID:            timelineEventID,
			PlaybookRunID: playbookRunID,
			CreateAt:      at,
			EventAt:       at,
			EventType:     eventType,
			PostID:        postID,
			SubjectUserID: userID,
			Summary:       statusOptionName(scheme, newSlug),
		}); tlErr != nil {
			logger.WithError(tlErr).Error("failed to set timeline event post id")
		}
	}

	if run.StatusUpdateBroadcastChannelsEnabled {
		msgType := finishMessage
		if eventType == RunRestored {
			msgType = restoreMessage
		} else if eventType == RunStatusChanged {
			msgType = statusUpdateMessage
		}
		s.broadcastPlaybookRunMessageToChannels(run.BroadcastChannelIDs, &model.Post{Message: message}, msgType, run, logger)
	}

	if eventType == RunFinished {
		runFinishedMessage := s.buildRunFinishedMessage(run, user.Username)
		if dmErr := s.dmPostToRunFollowers(&model.Post{Message: runFinishedMessage}, finishMessage, playbookRunID, userID); dmErr != nil {
			logger.WithError(dmErr).Error("failed to dm post to run followers")
		}

		s.RemoveReminder(playbookRunID)

		if s.licenseChecker.RetrospectiveAllowed() && run.RetrospectiveEnabled && run.RetrospectivePublishedAt == 0 {
			if retroErr := s.postRetrospectiveReminder(run, true); retroErr != nil {
				logger.WithError(retroErr).Error("couldn't post retrospective reminder")
			}
			s.scheduler.Cancel(RetrospectivePrefix + playbookRunID)
			if run.RetrospectiveReminderIntervalSeconds != 0 {
				if reminderErr := s.SetReminder(RetrospectivePrefix+playbookRunID, time.Duration(run.RetrospectiveReminderIntervalSeconds)*time.Second); reminderErr != nil {
					logger.WithError(reminderErr).Error("failed to set the retrospective reminder for playbook run")
				}
			}
		}

		if s.metricsService != nil {
			s.metricsService.IncrementRunsFinishedCount(1)
		}

		if s.shouldAutoArchiveChannel(run) {
			run = s.autoArchiveChannelOnFinish(run, playbookRunID, userID, at, logger)
		}
	}

	s.sendPlaybookRunObjectUpdatedWS(playbookRunID, originalRun, nil)

	if run.StatusUpdateBroadcastWebhooksEnabled {
		s.sendWebhooksOnUpdateStatus(playbookRunID, &PlaybookRunWebhookEvent{
			Type:   eventType,
			At:     at,
			UserID: userID,
		})
	}
}

func (t *TransitionService) unarchiveIfNeeded(run *PlaybookRun, userID string, at int64, logger *logrus.Entry) *PlaybookRun {
	s := t.runs
	if !run.AutoArchivedChannel || run.ChannelID == "" {
		return run
	}

	unarchived := s.restoreChannelByID(run.ChannelID, logger)
	candidate := *run
	candidate.AutoArchivedChannel = false
	if updatedRun, updateErr := s.store.UpdatePlaybookRun(&candidate); updateErr != nil {
		logger.WithError(updateErr).Warn("failed to reset AutoArchivedChannel flag on run restore")
	} else {
		run = updatedRun
	}
	if unarchived {
		unarchiveEvent := &TimelineEvent{
			PlaybookRunID: run.ID,
			CreateAt:      at + 1,
			EventAt:       at + 1,
			EventType:     ChannelUnarchived,
			SubjectUserID: userID,
		}
		if _, tlErr := s.store.CreateTimelineEvent(unarchiveEvent); tlErr != nil {
			logger.WithError(tlErr).Warn("failed to create channel_unarchived timeline event")
		}
	}
	return run
}

func (t *TransitionService) statusMessage(run *PlaybookRun, username string, scheme []StatusSchemeOption, newSlug string, eventType timelineEventType) string {
	runURL := GetRunDetailsRelativeURL(run.ID)
	switch eventType {
	case RunFinished:
		return fmt.Sprintf("@%s marked [%s](%s) as finished.", username, run.Name, runURL)
	case RunRestored:
		return fmt.Sprintf("@%s changed the status of [%s](%s) from Finished to In Progress.", username, run.Name, runURL)
	default:
		return fmt.Sprintf("@%s changed the status of [%s](%s) to %s.", username, run.Name, runURL, statusOptionName(scheme, newSlug))
	}
}

func statusOptionName(scheme []StatusSchemeOption, slug string) string {
	if opt, ok := FindStatusSchemeOption(scheme, slug); ok && opt.Name != "" {
		return opt.Name
	}
	return slug
}
