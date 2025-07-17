// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// UserGetter interface for retrieving user information
type UserGetter interface {
	Get(userID string) (*model.User, error)
}

// TimelineFilterOptions represents filter options for timeline events
type TimelineFilterOptions struct {
	All               bool
	OwnerChanged      bool
	StatusUpdated     bool
	EventFromPost     bool
	TaskStateModified bool
	AssigneeChanged   bool
	RanSlashCommand   bool
	UserJoinedLeft    bool
}

// TaskStateModifiedDetails represents the details of a task state modification
type TaskStateModifiedDetails struct {
	Action string `json:"action"`
	Task   string `json:"task"`
}

// UserJoinedLeftDetails represents the details of a user joined/left event
type UserJoinedLeftDetails struct {
	Action string   `json:"action"`
	Users  []string `json:"users"`
	Title  string   `json:"title"` // legacy format
}

// ParticipantsChangedDetails represents the details of a participant change event
type ParticipantsChangedDetails struct {
	Action    string   `json:"action"`
	Users     []string `json:"users"`
	Requester string   `json:"requester"`
}

// showEventForCSV determines if an event should be included based on filter options
func showEventForCSV(eventType timelineEventType, filter TimelineFilterOptions) bool {
	if filter.All {
		return true
	}

	switch eventType {
	case OwnerChanged:
		return filter.OwnerChanged
	case StatusUpdated, PlaybookRunCreated, RunFinished, RunRestored, StatusUpdateRequested:
		return filter.StatusUpdated
	case EventFromPost:
		return filter.EventFromPost
	case TaskStateModified:
		return filter.TaskStateModified
	case AssigneeChanged:
		return filter.AssigneeChanged
	case RanSlashCommand:
		return filter.RanSlashCommand
	case UserJoinedLeft, ParticipantsChanged:
		return filter.UserJoinedLeft
	default:
		return filter.All
	}
}

// generatePostLink creates a link to a post if postID is provided, including SiteURL
func generatePostLink(siteURL, teamName, postID string) string {
	if postID == "" {
		return ""
	}
	if siteURL == "" {
		return fmt.Sprintf("/%s/pl/%s", teamName, postID)
	}
	return fmt.Sprintf("%s/%s/pl/%s", siteURL, teamName, postID)
}

// getUserDisplayInfo gets user display information
func getUserDisplayInfo(userGetter UserGetter, userID string) (username, email string) {
	if userID == "" {
		return "", ""
	}

	user, err := userGetter.Get(userID)
	if err != nil {
		return userID, "" // fallback to user ID if we can't get user info
	}

	return user.Username, user.Email
}

// generateEnhancedSummary creates an enhanced summary based on event type and details that matches frontend formatting
func generateEnhancedSummary(event *TimelineEvent, userGetter UserGetter) string {
	// Get the subject username once for efficiency (used in most cases)
	username, _ := getUserDisplayInfo(userGetter, event.SubjectUserID)
	if username == "" {
		return "Unknown user"
	}

	switch event.EventType {
	case PlaybookRunCreated:
		return fmt.Sprintf("Run started by @%s", username)

	case RunFinished:
		return fmt.Sprintf("Run finished by @%s", username)

	case RunRestored:
		return fmt.Sprintf("Run restored by @%s", username)

	case StatusUpdated:
		if event.Summary == "" {
			return fmt.Sprintf("@%s posted a status update", username)
		}
		return fmt.Sprintf("@%s changed status from %s", username, event.Summary)

	case StatusUpdateSnoozed:
		return fmt.Sprintf("@%s snoozed a status update", username)

	case StatusUpdateRequested:
		return fmt.Sprintf("@%s requested a status update", username)

	case OwnerChanged:
		if event.Summary != "" {
			return fmt.Sprintf("Owner changed from %s", event.Summary)
		}
		// If no summary, try to get the new owner info
		return fmt.Sprintf("Owner changed to @%s", username)

	case TaskStateModified:
		var details TaskStateModifiedDetails
		if err := json.Unmarshal([]byte(event.Details), &details); err == nil {

			switch details.Action {
			case "check":
				return fmt.Sprintf("@%s checked off checklist item \"%s\"", username, details.Task)
			case "uncheck":
				return fmt.Sprintf("@%s unchecked checklist item \"%s\"", username, details.Task)
			case "skip":
				return fmt.Sprintf("@%s skipped checklist item \"%s\"", username, details.Task)
			case "restore":
				return fmt.Sprintf("@%s restored checklist item \"%s\"", username, details.Task)
			default:
				// Fallback - remove ** and add username
				summary := strings.ReplaceAll(event.Summary, "**", "\"")
				return fmt.Sprintf("@%s %s", username, summary)
			}
		}
		// If we can't parse details, fall back to original behavior

		summary := strings.ReplaceAll(event.Summary, "**", "\"")
		return fmt.Sprintf("@%s %s", username, summary)

	case AssigneeChanged:
		// Try to extract assignee info from summary or use subject user
		if event.Summary != "" {
			return fmt.Sprintf("Assignee changed: %s", event.Summary)
		}
		return fmt.Sprintf("Task assigned to @%s", username)

	case RanSlashCommand:
		return fmt.Sprintf("Command executed by @%s", username)

	case EventFromPost:
		// User requested: "$username saved post: "$Summary""
		return fmt.Sprintf("@%s saved post: \"%s\"", username, event.Summary)

	case UserJoinedLeft:
		var details UserJoinedLeftDetails
		if err := json.Unmarshal([]byte(event.Details), &details); err == nil {
			// Check for legacy format first
			if details.Title != "" {
				return details.Title
			}

			// New format
			if len(details.Users) > 0 {
				user := details.Users[0]
				if details.Action == "joined" {
					return fmt.Sprintf("@%s joined the run", user)
				}
				return fmt.Sprintf("@%s left the run", user)
			}
		}
		// Fallback to event summary
		return event.Summary

	case ParticipantsChanged:
		var details ParticipantsChangedDetails
		if err := json.Unmarshal([]byte(event.Details), &details); err == nil {
			if len(details.Users) > 1 {
				if details.Action == "joined" {
					return fmt.Sprintf("%s added %d participants to the run", details.Requester, len(details.Users))
				}
				return fmt.Sprintf("%s removed %d participants from the run", details.Requester, len(details.Users))
			}
			if len(details.Users) == 1 {
				if details.Action == "joined" {
					return fmt.Sprintf("%s added @%s to the run", details.Requester, details.Users[0])
				}
				return fmt.Sprintf("%s removed @%s from the run", details.Requester, details.Users[0])
			}
		}
		return event.Summary

	case PublishedRetrospective:
		return fmt.Sprintf("Retrospective published by @%s", username)

	case CanceledRetrospective:
		return fmt.Sprintf("Retrospective canceled by @%s", username)

	case StatusUpdatesEnabled:
		return fmt.Sprintf("Run status updates enabled by @%s", username)

	case StatusUpdatesDisabled:
		return fmt.Sprintf("Run status updates disabled by @%s", username)

	default:
		return event.Summary
	}
}

// GenerateTimelineCSV generates a CSV export of timeline events
func GenerateTimelineCSV(playbookRun *PlaybookRun, filterOptions TimelineFilterOptions, userGetter UserGetter, siteURL, teamName string) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write CSV header
	header := []string{
		"Event Time",
		"Event Type",
		"Summary",
		"Details",
		"Post Link",
	}
	if err := writer.Write(header); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Filter and write timeline events
	for _, event := range playbookRun.TimelineEvents {
		// Skip deleted events
		if event.DeleteAt != 0 {
			continue
		}

		// Apply filters
		if !showEventForCSV(event.EventType, filterOptions) {
			continue
		}

		// Format event time
		eventTime := time.Unix(event.EventAt/1000, (event.EventAt%1000)*1e6).UTC().Format("2006-01-02 15:04:05 UTC")

		// Generate enhanced summary
		enhancedSummary := generateEnhancedSummary(&event, userGetter)

		// Generate post link
		postLink := generatePostLink(siteURL, teamName, event.PostID)

		record := []string{
			eventTime,
			string(event.EventType),
			enhancedSummary,
			event.Details,
			postLink,
		}

		if err := writer.Write(record); err != nil {
			return nil, fmt.Errorf("failed to write CSV record: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("failed to flush CSV writer: %w", err)
	}

	return buf.Bytes(), nil
}
