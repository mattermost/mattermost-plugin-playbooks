// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {UserProfile} from '@mattermost/types/users';
import {ControlProps, components} from 'react-select';

import {DateTime} from 'luxon';

import {Condition} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';
import {useProfilesInTeam} from 'src/hooks';
import ProfileSelector, {Option} from 'src/components/profile/profile_selector';
import DateTimeSelector, {DateTimeOption} from 'src/components/datetime_selector';
import {Mode, useMakeOption} from 'src/components/datetime_input';
import {formatConditionExpr} from 'src/utils/condition_format';
import {useConfirmModal} from 'src/components/widgets/confirmation_modal';

interface Props {
    selectedCount: number;
    participantUserIds: string[];
    availableConditions?: Condition[];
    propertyFields?: PropertyField[];
    hasAnyAssignee?: boolean;
    hasAnyDueDate?: boolean;
    isPlaybookRun?: boolean;
    onClearSelection: () => void;
    onBulkAssign: (userId: string) => void;
    onBulkDueDate: (timestamp: number) => void;
    onBulkDelete: () => void;
    onBulkAddToCondition?: (conditionId: string) => void;
}

const MultiSelectActionBar = ({
    selectedCount,
    participantUserIds,
    availableConditions,
    propertyFields,
    hasAnyAssignee,
    hasAnyDueDate,
    isPlaybookRun,
    onClearSelection,
    onBulkAssign,
    onBulkDueDate,
    onBulkDelete,
    onBulkAddToCondition,
}: Props) => {
    const {formatMessage} = useIntl();
    const profilesInTeam = useProfilesInTeam();
    const openConfirmModal = useConfirmModal();
    const [showConditions, setShowConditions] = useState(false);
    const conditionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (conditionRef.current && !conditionRef.current.contains(e.target as Node)) {
                setShowConditions(false);
            }
        };
        if (showConditions) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showConditions]);

    if (selectedCount === 0) {
        return null;
    }

    const hasConditions = Boolean(availableConditions?.length && onBulkAddToCondition);

    const getConditionLabel = (condition: Condition): string => {
        if (condition.condition_expr && propertyFields?.length) {
            try {
                return formatConditionExpr(condition.condition_expr, propertyFields);
            } catch {
                // Fall through to default
            }
        }
        return formatMessage({defaultMessage: 'Condition'});
    };

    return (
        <BarContainer data-testid='multi-select-action-bar'>
            <LeftSection>
                <SelectedCount>
                    {formatMessage(
                        {defaultMessage: '{count} {count, plural, one {task} other {tasks}} selected'},
                        {count: selectedCount},
                    )}
                </SelectedCount>
            </LeftSection>
            <MiddleSection>
                <ProfileSelector
                    selectedUserId={''}
                    onlyPlaceholder={true}
                    placeholder={
                        <BarButton>
                            <i className='icon icon-account-plus-outline'/>
                            {formatMessage({defaultMessage: 'Assign'})}
                        </BarButton>
                    }
                    enableEdit={true}
                    userGroups={{
                        subsetUserIds: participantUserIds,
                        defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                        subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                    }}
                    getAllUsers={async () => profilesInTeam}
                    onSelectedChange={(user?: UserProfile) => {
                        if (user?.id) {
                            onBulkAssign(user.id);
                        }
                    }}
                    selfIsFirstOption={true}
                    customControl={BulkAssignControlComponent}
                    customControlProps={{
                        showCustomReset: Boolean(hasAnyAssignee),
                        onCustomReset: () => onBulkAssign(''),
                    }}
                />
                <DueDateSelector
                    isPlaybookRun={isPlaybookRun}
                    hasAnyDueDate={hasAnyDueDate}
                    onBulkDueDate={onBulkDueDate}
                />
                {hasConditions && (
                    <ConditionWrapper ref={conditionRef}>
                        <BarButton onClick={() => setShowConditions(!showConditions)}>
                            <i className='icon icon-source-branch'/>
                            {formatMessage({defaultMessage: 'Add to condition'})}
                            <i className='icon icon-chevron-down icon--small'/>
                        </BarButton>
                        {showConditions && (
                            <ConditionDropdown>
                                <ConditionDropdownTitle>
                                    {formatMessage({defaultMessage: 'Move to condition'})}
                                </ConditionDropdownTitle>
                                {availableConditions!.map((condition) => (
                                    <ConditionOption
                                        key={condition.id}
                                        onClick={() => {
                                            onBulkAddToCondition!(condition.id);
                                            setShowConditions(false);
                                        }}
                                    >
                                        <i className='icon icon-source-branch'/>
                                        <span>{getConditionLabel(condition)}</span>
                                    </ConditionOption>
                                ))}
                            </ConditionDropdown>
                        )}
                    </ConditionWrapper>
                )}
                <DeleteIconButton
                    onClick={() => {
                        openConfirmModal({
                            title: formatMessage(
                                {defaultMessage: 'Delete {count} {count, plural, one {task} other {tasks}}?'},
                                {count: selectedCount},
                            ),
                            message: formatMessage(
                                {defaultMessage: 'Are you sure you want to delete {count} selected {count, plural, one {task} other {tasks}}? This action cannot be undone.'},
                                {count: selectedCount},
                            ),
                            confirmButtonText: formatMessage({defaultMessage: 'Delete'}),
                            isDestructive: true,
                            onConfirm: () => onBulkDelete(),
                        });
                    }}
                    aria-label={formatMessage({defaultMessage: 'Delete selected tasks'})}
                >
                    <i className='icon icon-trash-can-outline'/>
                </DeleteIconButton>
            </MiddleSection>
            <Separator/>
            <ClearButton
                onClick={onClearSelection}
                aria-label={formatMessage({defaultMessage: 'Clear selection'})}
            >
                <i className='icon icon-close'/>
            </ClearButton>
        </BarContainer>
    );
};

const BarContainer = styled.div`
    position: fixed;
    bottom: 36px;
    left: calc(50% + 100px);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 8px;
    background: var(--center-channel-color);
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0 0 0 / 0.12);
    z-index: 100;
`;

const LeftSection = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 8px;
    padding-right: 8px;
`;

const MiddleSection = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const Separator = styled.div`
    width: 1px;
    height: 20px;
    background: rgba(var(--center-channel-bg-rgb), 0.16);
    flex-shrink: 0;
    margin: 0;
`;

const SelectedCount = styled.span`
    color: var(--center-channel-bg);
    font-family: "Open Sans", sans-serif;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    white-space: nowrap;
`;

const ClearButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: none;
    width: 32px;
    border-radius: 4px;
    background: none;
    color: var(--center-channel-bg-56);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-bg-rgb), 0.08);
        color: var(--center-channel-bg);
    }

    i {
        font-size: 16px;
    }
`;

export const BarButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: rgba(var(--center-channel-bg-rgb), 0.08);
    color: var(--center-channel-bg);
    cursor: pointer;
    font-family: "Open Sans", sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    white-space: nowrap;

    &:hover {
        background: rgba(var(--center-channel-bg-rgb), 0.16);
    }

    i {
        font-size: 14px;
    }
`;

const DeleteIconButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--center-channel-bg-56);
    cursor: pointer;

    &:hover {
        color: var(--error-text);
        background: rgba(var(--error-text-color-rgb), 0.08);
    }

    i {
        font-size: 16px;
    }
`;

const ConditionWrapper = styled.div`
    position: relative;
`;

const ConditionDropdown = styled.div`
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 220px;
    padding: 4px 0;
    background: var(--center-channel-color);
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0 0 0 / 0.4);
    z-index: 10000;
`;

const ConditionDropdownTitle = styled.div`
    padding: 6px 12px 4px;
    color: var(--center-channel-bg-56);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const ConditionOption = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--center-channel-bg);
    cursor: pointer;
    font-size: 13px;
    text-align: left;

    &:hover {
        background: rgba(var(--center-channel-bg-rgb), 0.08);
    }

    i {
        font-size: 14px;
        color: var(--center-channel-bg-56);
        flex-shrink: 0;
    }

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const DueDateSelector = ({isPlaybookRun, hasAnyDueDate, onBulkDueDate}: {isPlaybookRun?: boolean; hasAnyDueDate?: boolean; onBulkDueDate: (timestamp: number) => void}) => {
    const {formatMessage} = useIntl();
    const mode = isPlaybookRun ? Mode.DateTimeValue : Mode.DurationValue;
    const makeOption = useMakeOption(Mode.DurationValue);
    const [toggleKey, setToggleKey] = useState(false);

    const durationPresetOptions = useMemo((): DateTimeOption[] => [
        makeOption({hours: 4}) as DateTimeOption,
        makeOption({days: 1}) as DateTimeOption,
        makeOption({days: 7}) as DateTimeOption,
    ], [makeOption]);

    const suggestedOptions: DateTimeOption[] = mode === Mode.DurationValue ?
        durationPresetOptions :
        (() => {
            let dt = DateTime.now().endOf('day');
            const list: DateTimeOption[] = [];
            list.push({value: dt, label: formatMessage({defaultMessage: 'Today'})});
            dt = dt.plus({days: 1});
            list.push({value: dt, label: formatMessage({defaultMessage: 'Tomorrow'})});
            dt = dt.plus({days: 6});
            list.push({value: dt, label: formatMessage({defaultMessage: 'Next week'})});
            return list;
        })();

    const resetDueDate = () => {
        onBulkDueDate(0);
        setToggleKey(!toggleKey);
    };

    return (
        <DateTimeSelector
            mode={mode}
            onlyPlaceholder={true}
            placeholder={
                <BarButton>
                    <i className='icon icon-calendar-outline'/>
                    {formatMessage({defaultMessage: 'Due date'})}
                </BarButton>
            }
            suggestedOptions={suggestedOptions}
            onSelectedChange={(value?: DateTimeOption | null) => {
                if (value?.value) {
                    onBulkDueDate(value.value.toMillis());
                }
            }}
            customControl={BulkDueDateControlComponent}
            customControlProps={{
                showCustomReset: Boolean(hasAnyDueDate),
                onCustomReset: resetDueDate,
                isDateTime: mode === Mode.DateTimeValue,
            }}
            controlledOpenToggle={toggleKey}
            placement='top'
        />
    );
};

const BulkDueDateControlComponent = (ownProps: ControlProps<DateTimeOption, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                {ownProps.selectProps.isDateTime ?
                    <FormattedMessage defaultMessage='No due date'/> :
                    <FormattedMessage defaultMessage='No time frame'/>
                }
            </ControlComponentAnchor>
        )}
    </div>
);

const BulkAssignControlComponent = (ownProps: ControlProps<Option, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage defaultMessage='No Assignee'/>
            </ControlComponentAnchor>
        )}
    </div>
);

const ControlComponentAnchor = styled.button.attrs({type: 'button'})`
    position: relative;
    top: -4px;
    display: inline-block;
    padding: 0;
    border: 0;
    background: none;
    margin: 0 0 8px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--button-bg);
    cursor: pointer;
`;

export default MultiSelectActionBar;
