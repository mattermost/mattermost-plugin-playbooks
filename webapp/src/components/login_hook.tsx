import {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';

import {globalSettings} from 'src/selectors';
import {actionSetGlobalSettings} from 'src/actions';
import {notifyConnect, fetchGlobalSettings} from 'src/client';

// This component is meant to be registered as RootComponent.
// It will be registered at initialize and "rendered" at login.
const LoginHook = () => {
    const dispatch = useDispatch();
    const hasGlobalSettings = useSelector((state: GlobalState) => Boolean(globalSettings(state)));
    const fetchAndStoreSettings = async () => dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));

    useEffect(() => {
        // Ensure settings fetch
        if (!hasGlobalSettings) {
            fetchAndStoreSettings();
        }

        // Fire the first connect bot event.
        notifyConnect();
    }, []);

    return null;
};

export default LoginHook;
