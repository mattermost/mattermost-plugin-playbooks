// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientError} from '@mattermost/client';

/**
 * Error types for quicklist operations.
 * Used to classify errors and determine appropriate user messaging and retry behavior.
 */
export enum QuicklistErrorType {
    ServiceUnavailable = 'service_unavailable',
    NetworkError = 'network_error',
    Timeout = 'timeout',

    // Permanent errors (not retryable)
    NotFound = 'not_found',
    Forbidden = 'forbidden',
    BadRequest = 'bad_request',
    FeatureDisabled = 'feature_disabled',
    ArchivedChannel = 'archived_channel',

    // Unknown
    Unknown = 'unknown',
}

/**
 * Determines if an error is transient and can be retried.
 * Transient errors include: network failures, timeouts, and service unavailability (503, 504).
 */
export function isTransientError(error: ClientError | null): boolean {
    if (!error) {
        return false;
    }

    const statusCode = error.status_code;

    // Network errors (status 0) or server errors (5xx) are typically transient
    if (statusCode === 0 || statusCode === 503 || statusCode === 504 || statusCode >= 500) {
        return true;
    }

    // Check for timeout or network-related messages
    const message = error.message?.toLowerCase() || '';
    if (message.includes('timeout') || message.includes('network') || message.includes('fetch')) {
        return true;
    }

    return false;
}

/**
 * Classifies an error into a specific QuicklistErrorType.
 */
export function classifyError(error: ClientError | null): QuicklistErrorType {
    if (!error) {
        return QuicklistErrorType.Unknown;
    }

    const statusCode = error.status_code;
    const message = error.message?.toLowerCase() || '';

    // Network/timeout errors
    if (statusCode === 0) {
        if (message.includes('timeout')) {
            return QuicklistErrorType.Timeout;
        }
        return QuicklistErrorType.NetworkError;
    }

    // Service unavailable
    if (statusCode === 503 || statusCode === 504) {
        return QuicklistErrorType.ServiceUnavailable;
    }

    // Not found
    if (statusCode === 404) {
        return QuicklistErrorType.NotFound;
    }

    // Forbidden / Feature disabled
    if (statusCode === 403) {
        if (message.includes('not enabled') || message.includes('disabled')) {
            return QuicklistErrorType.FeatureDisabled;
        }
        return QuicklistErrorType.Forbidden;
    }

    // Bad request
    if (statusCode === 400) {
        if (message.includes('archived')) {
            return QuicklistErrorType.ArchivedChannel;
        }
        return QuicklistErrorType.BadRequest;
    }

    // Other 5xx errors are service unavailable
    if (statusCode >= 500) {
        return QuicklistErrorType.ServiceUnavailable;
    }

    return QuicklistErrorType.Unknown;
}

/**
 * Returns a user-friendly error message based on the error type and original error.
 * Messages are designed to be helpful without exposing technical details.
 */
export function getUserFriendlyErrorMessage(error: ClientError | null): string {
    if (!error) {
        return 'An unexpected error occurred. Please try again.';
    }

    const errorType = classifyError(error);

    switch (errorType) {
    case QuicklistErrorType.ServiceUnavailable:
        return 'AI service is temporarily unavailable. Please try again in a moment.';

    case QuicklistErrorType.NetworkError:
        return 'Unable to connect to the server. Please check your connection and try again.';

    case QuicklistErrorType.Timeout:
        return 'The request timed out. Please try again.';

    case QuicklistErrorType.NotFound:
        return 'Could not find the specified post. It may have been deleted.';

    case QuicklistErrorType.Forbidden:
        return "You don't have access to this channel.";

    case QuicklistErrorType.FeatureDisabled:
        return 'Quicklist feature is not enabled. Please contact your administrator.';

    case QuicklistErrorType.ArchivedChannel:
        return 'Cannot generate quicklist from an archived channel.';

    case QuicklistErrorType.BadRequest:
        // Use the original message for bad requests as it's usually specific
        return error.message || 'Invalid request. Please try again.';

    default:
        // For unknown errors, try to use the original message if available
        return error.message || 'Failed to generate checklist. Please try again.';
    }
}
