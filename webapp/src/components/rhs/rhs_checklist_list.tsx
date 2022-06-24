// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {DateTime} from 'luxon';
import {GlobalState} from 'mattermost-webapp/types/store';

import {PlaybookRun} from 'src/types/playbook_run';
import {
    setAllChecklistsCollapsedState,
    setChecklistCollapsedState,
    setChecklistItemsFilter,
    setEachChecklistCollapsedState,
} from 'src/actions';
import {
    Checklist,
    ChecklistItemsFilter,
    ChecklistItemState,
} from 'src/types/playbook';
import {
    telemetryEventForPlaybookRun,
} from 'src/client';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {
    currentChecklistAllCollapsed,
    currentChecklistCollapsedState,
    currentChecklistItemsFilter,
} from 'src/selectors';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {DotMenuButton} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import ChecklistList from 'src/components/checklist/checklist_list';
import {AnchorLinkTitle} from '../backstage/playbook_runs/shared';

interface Props {
    playbookRun: PlaybookRun;
    parentContainer: ChecklistParent;
    viewerMode: boolean;
}

export enum ChecklistParent {
    RHS = 'rhs',
    RunDetails = 'run_details',
}

const RHSChecklistList = ({playbookRun, parentContainer, viewerMode}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channelId = useSelector(getCurrentChannelId);
    const stateKey = parentContainer + '_' + parentContainer === ChecklistParent.RHS ? channelId : playbookRun.id;
    const allCollapsed = useSelector(currentChecklistAllCollapsed(stateKey));
    const checklistsState = useSelector(currentChecklistCollapsedState(stateKey));
    const checklistItemsFilter = useSelector((state) => currentChecklistItemsFilter(state as GlobalState, stateKey));
    const myUser = useSelector(getCurrentUser);
    const teamnameNameDisplaySetting = useSelector(getTeammateNameDisplaySetting) || '';
    const preferredName = displayUsername(myUser, teamnameNameDisplaySetting);
    const [showMenu, setShowMenu] = useState(false);

    const checklists = playbookRun.checklists || [];
    const filterOptions = makeFilterOptions(checklistItemsFilter, preferredName);
    const overdueTasksNum = overdueTasks(checklists);

    const onChecklistCollapsedStateChange = (checklistIndex: number, state: boolean) => {
        dispatch(setChecklistCollapsedState(stateKey, checklistIndex, state));
    };
    const onEachChecklistCollapsedStateChange = (state: Record<number, boolean>) => {
        dispatch(setEachChecklistCollapsedState(stateKey, state));
    };

    // Cancel overdueOnly filter if there are no overdue tasks anymore
    if (overdueTasksNum === 0 && checklistItemsFilter.overdueOnly) {
        dispatch(setChecklistItemsFilter(stateKey, {
            ...checklistItemsFilter,
            overdueOnly: false,
        }));
    }

    const selectOption = (value: string, checked: boolean) => {
        telemetryEventForPlaybookRun(playbookRun.id, 'checklists_filter_selected');

        if (checklistItemsFilter.all && value !== 'all') {
            return;
        }
        if (isLastCheckedValueInBottomCategory(value, checked, checklistItemsFilter)) {
            return;
        }

        dispatch(setChecklistItemsFilter(stateKey, {
            ...checklistItemsFilter,
            [value]: checked,
        }));
    };

    const title = parentContainer === ChecklistParent.RunDetails ? (
        <AnchorLinkTitle
            title={formatMessage({defaultMessage: 'Tasks'})}
            id={'checklist'}
        />
    ) : <>{formatMessage({defaultMessage: 'Checklists'})}</>;

    return (
        <InnerContainer
            id='pb-checklists-inner-container'
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
            parentContainer={parentContainer}
        >
            <MainTitleBG numChecklists={checklists.length}>
                <MainTitle parentContainer={parentContainer}>
                    {title}
                    {
                        overdueTasksNum > 0 &&
                        <OverdueTasksToggle
                            data-testid='overdue-tasks-filter'
                            toggled={checklistItemsFilter.overdueOnly}
                            onClick={() => selectOption('overdueOnly', !checklistItemsFilter.overdueOnly)}
                        >
                            {formatMessage({defaultMessage: '{num} {num, plural, =1 {task} other {tasks}} overdue'}, {num: overdueTasksNum})}
                        </OverdueTasksToggle>
                    }
                    {
                        showMenu &&
                        <HoverRow>
                            <ExpandHoverButton
                                title={allCollapsed ? formatMessage({defaultMessage: 'Expand'}) : formatMessage({defaultMessage: 'Collapse'})}
                                className={(allCollapsed ? 'icon-arrow-expand' : 'icon-arrow-collapse') + ' icon-16 btn-icon'}
                                onClick={() => dispatch(setAllChecklistsCollapsedState(stateKey, !allCollapsed, checklists.length))}
                            />
                            <MultiCheckbox
                                options={filterOptions}
                                onselect={selectOption}
                                placement='bottom-end'
                                dotMenuButton={StyledDotMenuButton}
                                icon={
                                    <IconWrapper title={formatMessage({defaultMessage: 'Filter items'})}>
                                        <i className='icon icon-filter-variant'/>
                                    </IconWrapper>
                                }
                            />
                        </HoverRow>
                    }
                </MainTitle>
            </MainTitleBG>
            <ChecklistList
                playbookRun={playbookRun}
                enableFinishRun={parentContainer === ChecklistParent.RHS}
                isReadOnly={viewerMode}
                checklistsState={checklistsState}
                onChecklistCollapsedStateChange={onChecklistCollapsedStateChange}
                onEachChecklistCollapsedStateChange={onEachChecklistCollapsedStateChange}
            />
        </InnerContainer>
    );
};

const InnerContainer = styled.div<{parentContainer?: ChecklistParent}>`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;

    ${({parentContainer}) => parentContainer !== ChecklistParent.RunDetails && `
        padding: 0 12px 24px 12px;

        &:hover {
            background-color: rgba(var(--center-channel-color-rgb), 0.04);
        }
    `}

    .pb-tutorial-tour-tip__pulsating-dot-ctr {
        z-index: 1000;
    }
`;

const MainTitleBG = styled.div<{numChecklists: number}>`
    background-color: var(--center-channel-bg);
    z-index: ${({numChecklists}) => numChecklists + 2};
    position: sticky;
    top: 0;
`;

const MainTitle = styled.div<{parentContainer?: ChecklistParent}>`
    ${SemiBoldHeading} {
    }

    font-size: 16px;
    line-height: 24px;
    padding: ${(props) => (props.parentContainer === ChecklistParent.RunDetails ? '12px 0' : '12px 0 12px 8px')};
`;

const HoverRow = styled(HoverMenu)`
    top: 6px;
    right: 0px;
`;

const ExpandHoverButton = styled(HoverMenuButton)`
    padding: 3px 0 0 1px;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    display: inline-block;
    width: 28px;
    height: 28px;
`;

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const OverdueTasksToggle = styled.div<{toggled: boolean}>`
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;
    display: inline-block;
    margin-left: 5px;
    padding: 2px 4px;
    align-items: center;
    border-radius: 4px;
    user-select: none;
    cursor: pointer;
    background-color: ${(props) => (props.toggled ? 'var(--dnd-indicator)' : 'rgba(var(--dnd-indicator-rgb), 0.08)')};
    color: ${(props) => (props.toggled ? 'var(--button-color)' : 'var(--dnd-indicator)')};
`;

export default RHSChecklistList;

const overdueTasks = (checklists: Checklist[]) => {
    let count = 0;
    const now = DateTime.now();
    for (const list of checklists) {
        for (const item of list.items) {
            if ((item.state === ChecklistItemState.Open || item.state === ChecklistItemState.InProgress) &&
                item.due_date > 0 && DateTime.fromMillis(item.due_date) <= now) {
                count++;
            }
        }
    }
    return count;
};

const makeFilterOptions = (filter: ChecklistItemsFilter, name: string): CheckboxOption[] => {
    return [
        {
            display: 'All tasks',
            value: 'all',
            selected: filter.all,
            disabled: false,
        },
        {
            value: 'divider',
            display: '',
        },
        {
            value: 'title',
            display: 'TASK STATE',
        },
        {
            display: 'Show checked tasks',
            value: 'checked',
            selected: filter.checked,
            disabled: filter.all,
        },
        {
            value: 'divider',
            display: '',
        },
        {
            value: 'title',
            display: 'ASSIGNEE',
        },
        {
            display: `Me (${name})`,
            value: 'me',
            selected: filter.me,
            disabled: filter.all,
        },
        {
            display: 'Unassigned',
            value: 'unassigned',
            selected: filter.unassigned,
            disabled: filter.all,
        },
        {
            display: 'Others',
            value: 'others',
            selected: filter.others,
            disabled: filter.all,
        },
    ];
};

// isLastCheckedValueInBottomCategory returns true only if this value is in the bottom category and
// it is the last checked value. We don't want to allow the user to deselect all the options in
// the bottom category.
const isLastCheckedValueInBottomCategory = (value: string, nextState: boolean, filter: ChecklistItemsFilter) => {
    const inBottomCategory = (val: string) => val === 'me' || val === 'unassigned' || val === 'others';
    if (!inBottomCategory(value)) {
        return false;
    }
    const numChecked = ['me', 'unassigned', 'others'].reduce((accum, cur) => (
        (inBottomCategory(cur) && filter[cur]) ? accum + 1 : accum
    ), 0);
    return numChecked === 1 && filter[value];
};
