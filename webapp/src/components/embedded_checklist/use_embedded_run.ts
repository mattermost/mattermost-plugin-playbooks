// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useState} from 'react';

import {playbookRunUpdated} from 'src/actions';
import {fetchPlaybookRun} from 'src/client';
import {useAppDispatch, useAppSelector} from 'src/hooks/redux';
import {getRunById} from 'src/selectors';
import {PlaybookRun} from 'src/types/playbook_run';

import {registerEmbeddedRun} from './embedded_run_registry';

export type EmbeddedRunStatus = 'loading' | 'ready' | 'unavailable' | 'error';

type FetchFailure = {runId: string; kind: 'unavailable' | 'error'};

const isUnavailable = (err: unknown) => {
    const code = (err as {status_code?: number})?.status_code;
    return code === 403 || code === 404;
};

export function useEmbeddedRun(runId: string): {run: PlaybookRun | undefined; status: EmbeddedRunStatus; retry: () => void} {
    const dispatch = useAppDispatch();
    const run = useAppSelector((state) => getRunById(state, runId));
    const [failure, setFailure] = useState<FetchFailure | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!runId) {
            return undefined;
        }
        return registerEmbeddedRun(runId);
    }, [runId]);

    useEffect(() => {
        if (!runId) {
            return undefined;
        }

        let stale = false;
        fetchPlaybookRun(runId).then((fetched) => {
            if (stale) {
                return;
            }
            setFailure(null);
            dispatch(playbookRunUpdated(fetched));
        }).catch((err) => {
            if (!stale) {
                setFailure({runId, kind: isUnavailable(err) ? 'unavailable' : 'error'});
            }
        });

        return () => {
            stale = true;
        };
    }, [runId, attempt, dispatch]);

    const retry = useCallback(() => {
        setFailure(null);
        setAttempt((n) => n + 1);
    }, []);

    const currentFailure = failure?.runId === runId ? failure.kind : null;

    let status: EmbeddedRunStatus = 'loading';
    if (currentFailure === 'unavailable') {
        status = 'unavailable';
    } else if (run) {
        status = 'ready';
    } else if (currentFailure === 'error') {
        status = 'error';
    }

    return {run, status, retry};
}
