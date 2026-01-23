// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// ThreadContent holds the formatted thread content and metadata for AI processing.
type ThreadContent struct {
	FormattedContent string
	MessageCount     int
	ParticipantCount int
	Truncated        bool
	TruncatedCount   int
}

// ThreadService provides methods for fetching and formatting thread content.
type ThreadService struct {
	api    plugin.API
	config config.Service
}

// NewThreadService creates a new ThreadService instance.
func NewThreadService(api plugin.API, config config.Service) *ThreadService {
	return &ThreadService{
		api:    api,
		config: config,
	}
}

// FetchAndFormatThread fetches a thread by its root post ID and formats it for AI consumption.
func (s *ThreadService) FetchAndFormatThread(postID string) (*ThreadContent, error) {
	// Get root post
	rootPost, appErr := s.api.GetPost(postID)
	if appErr != nil {
		return nil, fmt.Errorf("failed to get post: %s", appErr.Error())
	}

	// Get thread
	thread, appErr := s.api.GetPostThread(postID)
	if appErr != nil {
		return nil, fmt.Errorf("failed to get thread: %s", appErr.Error())
	}

	// Get channel info for context (ignore errors, channel is optional)
	channel, _ := s.api.GetChannel(rootPost.ChannelId)

	// Sort posts by create time (ascending - oldest first)
	posts := sortPostsByTime(thread.Posts)

	// Get configuration limits
	cfg := s.config.GetConfiguration()
	maxMessages := cfg.QuicklistMaxMessages
	maxChars := cfg.QuicklistMaxCharacters

	truncated := false
	truncatedCount := 0

	// Apply message limit - keep root and most recent
	if len(posts) > maxMessages {
		truncatedCount = len(posts) - maxMessages
		posts = keepRecentWithRoot(posts, rootPost.Id, maxMessages)
		truncated = true
	}

	// Count participants before formatting
	participantCount := countParticipants(posts)

	// Build user cache for formatting
	userCache := s.buildUserCache(posts)

	// Format content
	content := s.formatThreadContent(posts, channel, userCache, truncated, truncatedCount)

	// Check character limit
	if len(content) > maxChars {
		content = content[:maxChars] + "\n\n[Content truncated due to length]"
		truncated = true
	}

	return &ThreadContent{
		FormattedContent: content,
		MessageCount:     len(posts),
		ParticipantCount: participantCount,
		Truncated:        truncated,
		TruncatedCount:   truncatedCount,
	}, nil
}

// sortPostsByTime returns posts sorted by CreateAt in ascending order (oldest first).
func sortPostsByTime(postsMap map[string]*model.Post) []*model.Post {
	posts := make([]*model.Post, 0, len(postsMap))
	for _, post := range postsMap {
		posts = append(posts, post)
	}

	sort.Slice(posts, func(i, j int) bool {
		return posts[i].CreateAt < posts[j].CreateAt
	})

	return posts
}

// keepRecentWithRoot keeps the root post and the most recent messages up to maxMessages.
// It ensures the root post is always included even if it's not among the most recent.
func keepRecentWithRoot(posts []*model.Post, rootID string, maxMessages int) []*model.Post {
	if len(posts) <= maxMessages {
		return posts
	}

	// Find root post
	var rootPost *model.Post
	var otherPosts []*model.Post

	for _, post := range posts {
		if post.Id == rootID {
			rootPost = post
		} else {
			otherPosts = append(otherPosts, post)
		}
	}

	// If no root found, just return most recent
	if rootPost == nil {
		return posts[len(posts)-maxMessages:]
	}

	// Take most recent (maxMessages - 1) from other posts to leave room for root
	recentCount := maxMessages - 1
	if len(otherPosts) < recentCount {
		recentCount = len(otherPosts)
	}

	// otherPosts are already sorted ascending, so take from the end
	recentPosts := otherPosts[len(otherPosts)-recentCount:]

	// Combine root + recent and sort again
	result := make([]*model.Post, 0, recentCount+1)
	result = append(result, rootPost)
	result = append(result, recentPosts...)

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreateAt < result[j].CreateAt
	})

	return result
}

// countParticipants returns the number of unique users in the posts.
func countParticipants(posts []*model.Post) int {
	users := make(map[string]struct{})
	for _, post := range posts {
		users[post.UserId] = struct{}{}
	}
	return len(users)
}

// buildUserCache fetches usernames for all users in the posts.
func (s *ThreadService) buildUserCache(posts []*model.Post) map[string]string {
	userIDs := make(map[string]struct{})
	for _, post := range posts {
		userIDs[post.UserId] = struct{}{}
	}

	cache := make(map[string]string)
	for userID := range userIDs {
		user, appErr := s.api.GetUser(userID)
		if appErr != nil {
			cache[userID] = "unknown"
		} else {
			cache[userID] = user.Username
		}
	}

	return cache
}

// formatThreadContent formats posts into a string suitable for AI analysis.
func (s *ThreadService) formatThreadContent(posts []*model.Post, channel *model.Channel, userCache map[string]string, truncated bool, truncatedCount int) string {
	var sb strings.Builder

	// Header with context
	channelName := "unknown"
	if channel != nil {
		if channel.DisplayName != "" {
			channelName = channel.DisplayName
		} else {
			channelName = channel.Name
		}
	}

	// Get participants list
	participants := make([]string, 0, len(userCache))
	for _, username := range userCache {
		participants = append(participants, "@"+username)
	}
	sort.Strings(participants)

	// Format start time from first post
	var startTime string
	if len(posts) > 0 {
		t := time.UnixMilli(posts[0].CreateAt).UTC()
		startTime = t.Format("2006-01-02 15:04 UTC")
	}

	fmt.Fprintf(&sb, "Thread from channel: #%s\n", channelName)
	fmt.Fprintf(&sb, "Started: %s\n", startTime)
	fmt.Fprintf(&sb, "Participants: %s\n", strings.Join(participants, ", "))
	sb.WriteString("\n---\n\n")

	// Format each post
	for _, post := range posts {
		username := userCache[post.UserId]
		t := time.UnixMilli(post.CreateAt).UTC()
		timestamp := t.Format("2006-01-02 15:04")

		fmt.Fprintf(&sb, "[@%s] %s:\n", username, timestamp)
		sb.WriteString(post.Message)
		sb.WriteString("\n\n---\n\n")
	}

	// Add truncation notice if applicable
	if truncated && truncatedCount > 0 {
		fmt.Fprintf(&sb, "[Thread truncated: %d more messages not included]\n", truncatedCount)
	}

	return sb.String()
}
