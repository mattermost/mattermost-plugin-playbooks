// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

import {ClientError} from '@mattermost/client';

import {generateQuicklist} from 'src/client';
import {QuicklistGenerateResponse} from 'src/types/quicklist';

export type UseQuicklistGenerateResult = {
    isLoading: boolean;
    data: QuicklistGenerateResponse | null;
    error: ClientError | null;
};

/**
 * Hook to generate a quicklist from a thread using AI analysis.
 * Calls the generate API on mount and manages loading/success/error states.
 *
 * @param postId - The ID of the root post of the thread to analyze
 * @returns Object containing isLoading, data, and error states
 */
export function useQuicklistGenerate(postId: string): UseQuicklistGenerateResult {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<QuicklistGenerateResponse | null>(null);
    const [error, setError] = useState<ClientError | null>(null);

    useEffect(() => {
        if (!postId) {
            setIsLoading(false);
            setData(null);
            setError(null);
            return undefined;
        }

        let cancelled = false;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const result = await generateQuicklist(postId);
                if (!cancelled) {
                    setData(result);
                    setIsLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
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
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [postId]);

    return {isLoading, data, error};
}
