// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientError} from '@mattermost/client';

import {
    QuicklistErrorType,
    classifyError,
    getUserFriendlyErrorMessage,
    isTransientError,
} from './quicklist_errors';

describe('quicklist_errors', () => {
    describe('isTransientError', () => {
        it('returns false for null error', () => {
            expect(isTransientError(null)).toBe(false);
        });

        it('returns true for status 503 (Service Unavailable)', () => {
            const error = new ClientError('', {
                message: 'Service unavailable',
                status_code: 503,
                url: '',
            });
            expect(isTransientError(error)).toBe(true);
        });

        it('returns true for status 504 (Gateway Timeout)', () => {
            const error = new ClientError('', {
                message: 'Gateway timeout',
                status_code: 504,
                url: '',
            });
            expect(isTransientError(error)).toBe(true);
        });

        it('returns true for status 0 (network error)', () => {
            const error = new ClientError('', {
                message: 'Network error',
                status_code: 0,
                url: '',
            });
            expect(isTransientError(error)).toBe(true);
        });

        it('returns true for any 5xx error', () => {
            const error = new ClientError('', {
                message: 'Internal server error',
                status_code: 500,
                url: '',
            });
            expect(isTransientError(error)).toBe(true);
        });

        it('returns true for timeout message', () => {
            const error = new ClientError('', {
                message: 'Request timeout exceeded',
                status_code: 408,
                url: '',
            });
            expect(isTransientError(error)).toBe(true);
        });

        it('returns false for 404 (Not Found)', () => {
            const error = new ClientError('', {
                message: 'Not found',
                status_code: 404,
                url: '',
            });
            expect(isTransientError(error)).toBe(false);
        });

        it('returns false for 403 (Forbidden)', () => {
            const error = new ClientError('', {
                message: 'Forbidden',
                status_code: 403,
                url: '',
            });
            expect(isTransientError(error)).toBe(false);
        });

        it('returns false for 400 (Bad Request)', () => {
            const error = new ClientError('', {
                message: 'Bad request',
                status_code: 400,
                url: '',
            });
            expect(isTransientError(error)).toBe(false);
        });
    });

    describe('classifyError', () => {
        it('returns Unknown for null error', () => {
            expect(classifyError(null)).toBe(QuicklistErrorType.Unknown);
        });

        it('returns NetworkError for status 0', () => {
            const error = new ClientError('', {
                message: 'Network error',
                status_code: 0,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.NetworkError);
        });

        it('returns Timeout for status 0 with timeout message', () => {
            const error = new ClientError('', {
                message: 'Request timeout',
                status_code: 0,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.Timeout);
        });

        it('returns ServiceUnavailable for status 503', () => {
            const error = new ClientError('', {
                message: 'Service unavailable',
                status_code: 503,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.ServiceUnavailable);
        });

        it('returns NotFound for status 404', () => {
            const error = new ClientError('', {
                message: 'Not found',
                status_code: 404,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.NotFound);
        });

        it('returns FeatureDisabled for 403 with disabled message', () => {
            const error = new ClientError('', {
                message: 'Quicklist feature is not enabled',
                status_code: 403,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.FeatureDisabled);
        });

        it('returns Forbidden for 403 without disabled message', () => {
            const error = new ClientError('', {
                message: 'Access denied',
                status_code: 403,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.Forbidden);
        });

        it('returns ArchivedChannel for 400 with archived message', () => {
            const error = new ClientError('', {
                message: 'Cannot generate quicklist from archived channel',
                status_code: 400,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.ArchivedChannel);
        });

        it('returns BadRequest for 400 without archived message', () => {
            const error = new ClientError('', {
                message: 'Invalid post_id',
                status_code: 400,
                url: '',
            });
            expect(classifyError(error)).toBe(QuicklistErrorType.BadRequest);
        });
    });

    describe('getUserFriendlyErrorMessage', () => {
        it('returns generic message for null error', () => {
            expect(getUserFriendlyErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
        });

        it('returns service unavailable message for 503', () => {
            const error = new ClientError('', {
                message: 'Service unavailable',
                status_code: 503,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe(
                'AI service is temporarily unavailable. Please try again in a moment.',
            );
        });

        it('returns network error message for status 0', () => {
            const error = new ClientError('', {
                message: 'Network error',
                status_code: 0,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe(
                'Unable to connect to the server. Please check your connection and try again.',
            );
        });

        it('returns timeout message for timeout error', () => {
            const error = new ClientError('', {
                message: 'Request timeout',
                status_code: 0,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe('The request timed out. Please try again.');
        });

        it('returns not found message for 404', () => {
            const error = new ClientError('', {
                message: 'Not found',
                status_code: 404,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe(
                'Could not find the specified post. It may have been deleted.',
            );
        });

        it('returns access denied message for 403', () => {
            const error = new ClientError('', {
                message: 'Access denied',
                status_code: 403,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe("You don't have access to this channel.");
        });

        it('returns feature disabled message for 403 with disabled flag', () => {
            const error = new ClientError('', {
                message: 'Quicklist feature is not enabled',
                status_code: 403,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe(
                'Quicklist feature is not enabled. Please contact your administrator.',
            );
        });

        it('returns archived channel message for archived error', () => {
            const error = new ClientError('', {
                message: 'Cannot generate quicklist from archived channel',
                status_code: 400,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe(
                'Cannot generate quicklist from an archived channel.',
            );
        });

        it('returns original message for bad request without specific type', () => {
            const error = new ClientError('', {
                message: 'Invalid post_id format',
                status_code: 400,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe('Invalid post_id format');
        });

        it('returns fallback for unknown error with message', () => {
            const error = new ClientError('', {
                message: 'Some unexpected error',
                status_code: 418,
                url: '',
            });
            expect(getUserFriendlyErrorMessage(error)).toBe('Some unexpected error');
        });
    });
});
