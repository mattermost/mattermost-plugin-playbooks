// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import {ClientError} from '@mattermost/client';

import {generateQuicklist} from 'src/client';
import {QuicklistGenerateResponse} from 'src/types/quicklist';

export type UseQuicklistGenerateResult = {
    isLoading: boolean;
    data: QuicklistGenerateResponse | null;
    error: ClientError | null;
    retry: () => void;
};

/**
 * Hook to generate a quicklist from a thread using AI analysis.
 * Calls the generate API on mount and manages loading/success/error states.
 * Provides a retry function for re-attempting generation after errors.
 *
 * @param postId - The ID of the root post of the thread to analyze
 * @returns Object containing isLoading, data, error states, and retry function
 */
export function useQuicklistGenerate(postId: string): UseQuicklistGenerateResult {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<QuicklistGenerateResponse | null>(null);
    const [error, setError] = useState<ClientError | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const cancelledRef = useRef(false);

    const fetchData = useCallback(async () => {
        if (!postId) {
            setIsLoading(false);
            setData(null);
            setError(null);
            return;
        }

        cancelledRef.current = false;
        setIsLoading(true);
        setError(null);

        try {
            const result = await generateQuicklist(postId);
            if (!cancelledRef.current) {
                setData(result);
                setIsLoading(false);
            }
        } catch (err) {
            if (!cancelledRef.current) {
                if (err instanceof ClientError) {
                    setError(err);
                } else {
                    // Wrap non-ClientError errors
                    setError(new ClientError('', {
                        message: err instanceof Error ? err.message : 'An unexpected error occurred',
                        status_code: 0,
                        url: '',
                    }));
                }
                setData(null);
                setIsLoading(false);
            }
        }
    }, [postId]);

    useEffect(() => {
        // `retry` bumps `retryCount`, which retriggers this effect to call `fetchData`.
        fetchData();

        return () => {
            cancelledRef.current = true;
        };
    }, [fetchData, retryCount]);

    const retry = useCallback(() => {
        setRetryCount((count) => count + 1);
    }, []);

    return {isLoading, data, error, retry};
}
