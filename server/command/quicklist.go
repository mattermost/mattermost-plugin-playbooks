// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package command

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// WebSocket event name for opening the quicklist modal
const quicklistOpenModalEvent = "quicklist_open_modal"

// actionQuicklist handles the /playbook quicklist <post_id> command.
// It validates the post exists, user has access, channel is not archived,
// and sends a WebSocket event to open the quicklist modal.
func (r *Runner) actionQuicklist(args []string) {
	// Check if feature is enabled
	if !r.configService.IsQuicklistEnabled() {
		r.postCommandResponse("The quicklist feature is not enabled. Please contact your system administrator.")
		return
	}

	// Validate post ID is provided
	if len(args) < 1 {
		r.postCommandResponse("Please provide a post ID: `/playbook quicklist <post_id>`")
		return
	}

	postID := args[0]

	// Validate post ID format
	if !model.IsValidId(postID) {
		r.postCommandResponse("Invalid post ID format. Please provide a valid post ID.")
		return
	}

	// Get the post to validate it exists
	post, appErr := r.pluginAPI.Post.GetPost(postID)
	if appErr != nil {
		r.postCommandResponse("Could not find the specified post. Please check the post ID and try again.")
		return
	}

	// Check if user has permission to read the channel
	if !r.pluginAPI.User.HasPermissionToChannel(r.args.UserId, post.ChannelId, model.PermissionReadChannel) {
		r.postCommandResponse("You don't have access to this channel.")
		return
	}

	// Get the channel to check if it's archived
	channel, appErr := r.pluginAPI.Channel.Get(post.ChannelId)
	if appErr != nil {
		r.warnUserAndLogErrorf("Error retrieving channel: %v", appErr)
		return
	}

	// Check if channel is archived
	if channel.DeleteAt != 0 {
		r.postCommandResponse("Cannot create a quicklist from an archived channel.")
		return
	}

	// Send ephemeral confirmation
	r.postCommandResponse("Opening quicklist generator...")

	// Send WebSocket event to open the modal
	r.poster.PublishWebsocketEventToUser(quicklistOpenModalEvent, map[string]any{
		"post_id":    postID,
		"channel_id": post.ChannelId,
	}, r.args.UserId)
}
