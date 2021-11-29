// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {useSelector} from 'react-redux';

import {
    renderThumbHorizontal,
    renderThumbVertical, renderView,
    RHSContainer,
    RHSContent,
} from 'src/components/rhs/rhs_shared';
import {currentPlaybookRun} from 'src/selectors';
import RHSAbout from 'src/components/rhs/rhs_about';
import RHSChecklists from 'src/components/rhs/rhs_checklists';
import {browserHistory} from 'src/webapp_globals';
import {telemetryEventForPlaybookRun} from 'src/client';
import {usePrevious} from 'src/hooks/general';
import {PlaybookRunStatus} from 'src/types/playbook_run';

const RHSRunDetails = () => {
    const scrollbarsRef = useRef<Scrollbars>(null);
    const playbookRun = useSelector(currentPlaybookRun);
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.searchParams);

    const prevStatus = usePrevious(playbookRun?.current_status);
    useEffect(() => {
        if ((prevStatus !== playbookRun?.current_status) && (playbookRun?.current_status === PlaybookRunStatus.Finished)) {
            scrollbarsRef?.current?.scrollToTop();
        }
    }, [playbookRun?.current_status]);

    if (searchParams.has('telem') && playbookRun) {
        const action = searchParams.get('telem');
        if (action) {
            telemetryEventForPlaybookRun(playbookRun.id, action);
        }
        searchParams.delete('telem');
        url.search = searchParams.toString();
        browserHistory.replace({pathname: url.pathname, search: url.search});
    }

    if (!playbookRun) {
        return null;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <Scrollbars
                    ref={scrollbarsRef}
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    style={{position: 'absolute'}}
                >
                    <RHSAbout playbookRun={playbookRun}/>
                    <RHSChecklists playbookRun={playbookRun}/>
                </Scrollbars>
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSRunDetails;
