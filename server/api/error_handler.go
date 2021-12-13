// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/mattermost-plugin-playbooks/v2/server/bot"
)

type ErrorHandler struct {
	log bot.Logger
}

// HandleError logs the internal error and sends a generic error as JSON in a 500 response.
func (h *ErrorHandler) HandleError(w http.ResponseWriter, internalErr error) {
	h.HandleErrorWithCode(w, http.StatusInternalServerError, "An internal error has occurred. Check app server logs for details.", internalErr)
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func (h *ErrorHandler) HandleErrorWithCode(w http.ResponseWriter, code int, publicErrorMsg string, internalErr error) {
	HandleErrorWithCode(h.log, w, code, publicErrorMsg, internalErr)
}
