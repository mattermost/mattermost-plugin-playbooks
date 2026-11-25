// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    type UseDispatch,
    useDispatch,
    useSelector,
    useStore,
} from 'react-redux';
import type {GlobalState} from '@mattermost/types/store';

import type {Dispatch, Store} from 'src/types/store';

// The `as Dispatch` is currently required because mattermost-redux messes with the type definition for useDispatch
export const useAppDispatch = (useDispatch as UseDispatch).withTypes<Dispatch>();
export const useAppSelector = useSelector.withTypes<GlobalState>();

// withTypes runs at import. Several suites mock react-redux without useStore.
export const useAppStore = (): Store => useStore() as Store;
