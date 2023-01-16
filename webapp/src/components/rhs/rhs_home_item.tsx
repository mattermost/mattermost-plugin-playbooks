// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import {
    CheckAllIcon,
    OpenInNewIcon,
    PlayOutlineIcon,
    SyncIcon,
} from '@mattermost/compass-icons/components';

import {GlobalState} from '@mattermost/types/store';
import {Team} from '@mattermost/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {SubtlePrimaryButton} from 'src/components/assets/buttons';

import {DraftPlaybookWithChecklist, Playbook} from 'src/types/playbook';
import {useHasPlaybookPermission, usePlaybooksRouting} from 'src/hooks';
import {openPlaybookRunNewModal} from 'src/actions';
import {PillBox} from 'src/components/widgets/pill';
import {Timestamp} from 'src/webapp_globals';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

import {PlaybookPermissionGeneral} from 'src/types/permissions';

const Item = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 0 2rem;
    margin: 0 2.75rem;
    box-shadow: 0px 1px 0px rgba(var(--center-channel-color-rgb), 0.08);

    &:last-of-type {
        box-shadow: none;
    }

    > div {
        display: flex;
        overflow: hidden;
        flex-direction: column;
    }
`;

const Title = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    margin-top: 0;
    margin-bottom: 0.25rem;

    a {
        display: flex;
        max-width: 100%;
        overflow: hidden;
        padding-right: 1rem;
        span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-block;
        }
        svg {
            opacity: 0;
            flex-shrink: 0;
            color: rgba(var(--center-channel-color-rgb), 0.72);
            margin: 3px 0 0 3px;
            transition: opacity 0.15s ease-out;
        }
    }
    .app__body & a:hover,
    .app__body & a:focus {
        svg {
            opacity: 1;
        }
    }
    .app__body & a,
    .app__body & a:hover,
    .app__body & a:focus {
        color: var(--center-channel-color);
    }
`;

const Sub = styled.span`
    font-family: Open Sans;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 1rem;

    .separator {
        margin: 0 0.5rem;
        font-size: 2rem;
        line-height: 12px;
        vertical-align: middle;
        font-weight: 600;
    }
`;

const Meta = styled.div`

`;

export const MetaItem = styled(PillBox)`
    font-family: Open Sans;
    font-weight: 600;
    font-size: 11px;
    line-height: 10px;
    height: 20px;
    padding: 3px 8px;
    margin-right: 4px;
    margin-bottom: 4px;
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    svg {
        margin-right: 4px;
    }
    .separator {
        margin: 0 0.35rem;
        font-size: 2rem;
        line-height: 10px;
        vertical-align: middle;
        font-weight: 600;
    }
`;

const RunButton = styled(SubtlePrimaryButton)`
    min-width: 7.25rem;
    max-width: 10rem;
    height: 7.25rem;
    justify-content: center;
    flex-direction: column;
    flex-shrink: 0;

    svg {
        margin-bottom: 0.5rem;
    }
`;

const TIME_SPEC = {
    units: [
        'now',
        'minute',
        ['hour', -48],
        ['day', -30],
        'month',
        'year',
    ],
    useTime: false,
    day: 'numeric',
    style: 'narrow',
};

type RHSHomePlaybookProps = {
    playbook: Playbook;
    onRunCreated: (runId: string, channelId: string, statsData: object) => void;
}

export const RHSHomePlaybook = ({playbook, onRunCreated}: RHSHomePlaybookProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {view} = usePlaybooksRouting({urlOnly: true});
    const linkRef = useRef(null);
    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, playbook);

    const {
        id,
        title,
        num_runs,
        num_stages,
        num_actions,
        last_run_at,
        description,
        team_id,
        default_owner_enabled,
        default_owner_id,
    } = playbook;
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, team_id || ''));
    const {id: teamId, name: teamName} = team;
    return (
        <Item
            data-testid='rhs-home-item'
            id={`pbitem-${id}`}
        >
            <div>
                <Title>
                    <Link
                        to={view(id)}
                        ref={linkRef}
                    >
                        <TextWithTooltipWhenEllipsis
                            id={`${id})_playbook_item`}
                            text={title}
                            parentRef={linkRef}

                        />
                        <OpenInNewIcon size={14}/>
                    </Link>
                </Title>
                <Sub>
                    {num_runs > 0 ? (
                        <>
                            <span>
                                <FormattedMessage
                                    defaultMessage='Last run was {relativeTime}'
                                    values={{
                                        relativeTime: (
                                            <Timestamp
                                                value={last_run_at}
                                                {...TIME_SPEC}
                                            />
                                        ),
                                    }}
                                />
                                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                                <span className='separator'>{'·'}</span>
                            </span>
                        </>
                    ) : null}
                    <span>
                        {formatMessage({
                            defaultMessage: '{num_runs, plural, =0 {Not run yet} one {# run} other {# total runs}}',
                        }, {num_runs})}
                    </span>
                </Sub>
                <Meta>
                    <MetaItem>
                        <CheckAllIcon size={16}/>
                        {formatMessage({
                            defaultMessage: '{num_checklists, plural, =0 {no checklists} one {# checklist} other {# checklists}}',
                        }, {num_checklists: num_stages})}
                    </MetaItem>
                    <MetaItem>
                        <SyncIcon size={16}/>
                        {formatMessage({
                            defaultMessage: '{num_actions, plural, =0 {no actions} one {# action} other {# actions}}',
                        }, {num_actions})}
                    </MetaItem>
                </Meta>
            </div>
            {hasPermissionToRunPlaybook &&
            <RunButton
                data-testid={'run-playbook'}
                onClick={() => {
                    dispatch(openPlaybookRunNewModal({
                        teamId,
                        onRunCreated,
                        playbookId: id,
                    }));
                }}
            >
                <PlayOutlineIcon/>
                <FormattedMessage defaultMessage='Run'/>
            </RunButton>
            }
        </Item>
    );
};

type RHSHomeTemplateProps = {
    title: string;
    template: DraftPlaybookWithChecklist;
    onUse: (template: DraftPlaybookWithChecklist) => void;
}

export const RHSHomeTemplate = ({
    title,
    template,
    onUse,
}: RHSHomeTemplateProps) => {
    const {formatMessage} = useIntl();
    const linkRef = useRef(null);
    return (
        <Item>
            <div data-testid='template-details'>
                <Title ref={linkRef}>
                    <Link
                        to={''}
                        onClick={(e) => {
                            e.preventDefault();
                            onUse(template);
                        }}
                        ref={linkRef}
                    >
                        <TextWithTooltipWhenEllipsis
                            id={`${title})_template_item`}
                            text={title}
                            parentRef={linkRef}

                        />
                        <OpenInNewIcon size={14}/>
                    </Link>
                </Title>
                <Sub/>
                <Meta>
                    <MetaItem>
                        <CheckAllIcon
                            color={'rgba(var(--center-channel-color-rgb), 0.72)'}
                            size={16}
                        />
                        {formatMessage({
                            defaultMessage: '{num_checklists, plural, =0 {no checklists} one {# checklist} other {# checklists}}',
                        }, {num_checklists: template.num_stages})}
                    </MetaItem>
                    <MetaItem>
                        <SyncIcon
                            size={16}
                            color={'rgba(var(--center-channel-color-rgb), 0.72)'}
                        />
                        {formatMessage({

                            defaultMessage: '{num_actions, plural, =0 {no actions} one {# action} other {# actions}}',
                        }, {num_actions: template.num_actions})}
                    </MetaItem>
                </Meta>
            </div>
            <RunButton
                data-testid={'use-playbook'}
                onClick={() => onUse(template)}
            >
                <OpenInNewIcon color={'var(--button-bg)'}/>
                {formatMessage({defaultMessage: 'Use'})}
            </RunButton>
        </Item>
    );
};
