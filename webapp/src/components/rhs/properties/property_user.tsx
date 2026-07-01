// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    KeyboardEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';
import {useIntl} from 'react-intl';
import {UserProfile} from '@mattermost/types/users';
import {CloseIcon} from '@mattermost/compass-icons/components';

import {PropertyComponentProps} from 'src/types/properties';
import {useProfilesInTeam} from 'src/hooks';
import Profile from 'src/components/profile/profile';
import ProfileSelector from 'src/components/profile/profile_selector';

import EmptyState from './empty_state';
import {PropertyDisplayContainer} from './property_styles';

interface Props extends PropertyComponentProps {
    onValueChange: (value: string | string[] | null) => Promise<void> | void;
}

const UserProperty = (props: Props) => {
    const {formatMessage} = useIntl();
    const [isEditing, setIsEditing] = useState(false);
    const profilesInTeam = useProfilesInTeam();
    const [displayValue, setDisplayValue] = useState<string | null>(
        typeof props.value?.value === 'string' ? props.value?.value : null,
    );
    const isMounted = useRef(true);
    const serverValueRef = useRef<string | null>(displayValue);
    const callSeqRef = useRef(0);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newValue = typeof props.value?.value === 'string' ? props.value?.value : null;
        serverValueRef.current = newValue;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const fetchUsersInTeam = useCallback(async () => profilesInTeam, [profilesInTeam]);

    const handleActivateKey = useCallback((e: KeyboardEvent) => {
        if (props.readOnly) {
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEditing(true);
        }
    }, [props.readOnly]);

    const handleSelectedChange = useCallback((user?: UserProfile) => {
        const newValue = user?.id ?? null;
        const seq = ++callSeqRef.current;
        setDisplayValue(newValue);
        Promise.resolve(props.onValueChange(newValue))
            .then(() => {
                if (callSeqRef.current === seq) {
                    serverValueRef.current = newValue;
                }
            })
            .catch(() => {
                if (isMounted.current && callSeqRef.current === seq) {
                    setDisplayValue(serverValueRef.current);
                }
            });
        setIsEditing(false);
    }, [props.onValueChange]);

    if (isEditing) {
        return (
            <ProfileSelector
                testId={`property-user-${props.field.id}`}
                selectedUserId={displayValue ?? undefined}
                placeholder={formatMessage({id: 'playbooks.property_user.select_placeholder', defaultMessage: 'Select user...'})}
                enableEdit={true}
                isClearable={true}
                selfIsFirstOption={true}
                getAllUsers={fetchUsersInTeam}
                onSelectedChange={handleSelectedChange}
                controlledOpenToggle={isEditing}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsEditing(false);
                    }
                }}
            />
        );
    }

    return (
        <PropertyDisplayContainer
            $readOnly={props.readOnly}
            onClick={props.readOnly ? undefined : () => setIsEditing(true)}
            onKeyDown={props.readOnly ? undefined : handleActivateKey}
            data-testid='property-value'
        >
            {displayValue ? <Profile userId={displayValue}/> : <EmptyState/>}
        </PropertyDisplayContainer>
    );
};

export const MultiuserProperty = (props: Props) => {
    const {formatMessage} = useIntl();
    const [isEditing, setIsEditing] = useState(false);
    const profilesInTeam = useProfilesInTeam();

    const rawValue = props.value?.value;
    const userIds: string[] = Array.isArray(rawValue) ? rawValue.filter((v): v is string => typeof v === 'string') : [];

    const [displayValues, setDisplayValues] = useState<string[]>(userIds);
    const displayValuesRef = useRef<string[]>(userIds);
    const isMounted = useRef(true);
    const serverValuesRef = useRef<string[]>(userIds);
    const callSeqRef = useRef(0);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newValue = Array.isArray(props.value?.value) ? props.value?.value as string[] : [];
        serverValuesRef.current = newValue;
        displayValuesRef.current = newValue;
        setDisplayValues(newValue);
    }, [props.value?.value]);

    const fetchUsersInTeam = useCallback(async () => profilesInTeam, [profilesInTeam]);

    const handleActivateKey = useCallback((e: KeyboardEvent) => {
        if (props.readOnly) {
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEditing(true);
        }
    }, [props.readOnly]);

    const applyNewValues = useCallback((newValues: string[]) => {
        const seq = ++callSeqRef.current;
        displayValuesRef.current = newValues;
        setDisplayValues(newValues);
        Promise.resolve(props.onValueChange(newValues.length > 0 ? newValues : null))
            .then(() => {
                if (callSeqRef.current === seq) {
                    serverValuesRef.current = newValues;
                }
            })
            .catch(() => {
                if (isMounted.current && callSeqRef.current === seq) {
                    displayValuesRef.current = serverValuesRef.current;
                    setDisplayValues(serverValuesRef.current);
                }
            });
    }, [props.onValueChange]);

    const handleSelectedChange = useCallback((user?: UserProfile) => {
        if (!user) {
            return;
        }
        const current = displayValuesRef.current;
        applyNewValues(current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id]);
    }, [applyNewValues]);

    const handleRemoveUser = useCallback((uid: string) => {
        applyNewValues(displayValuesRef.current.filter((id) => id !== uid));
    }, [applyNewValues]);

    if (isEditing) {
        return (
            <MultiuserContainer>
                <ChipsContainer>
                    {displayValues.map((uid) => (
                        <ChipWrapper key={uid}>
                            <Profile
                                userId={uid}
                                withoutName={true}
                            />
                            <RemoveButton
                                type='button'
                                aria-label={formatMessage({id: 'playbooks.property_user.remove_user', defaultMessage: 'Remove user'})}
                                onClick={() => handleRemoveUser(uid)}
                            >
                                <CloseIcon size={12}/>
                            </RemoveButton>
                        </ChipWrapper>
                    ))}
                </ChipsContainer>
                <ProfileSelector
                    testId={`property-multiuser-${props.field.id}`}
                    placeholder={formatMessage({id: 'playbooks.property_user.add_placeholder', defaultMessage: 'Add user...'})}
                    enableEdit={true}
                    isClearable={false}
                    selfIsFirstOption={true}
                    getAllUsers={fetchUsersInTeam}
                    onSelectedChange={handleSelectedChange}
                    controlledOpenToggle={isEditing}
                    onOpenChange={(open) => {
                        if (!open) {
                            setIsEditing(false);
                        }
                    }}
                />
            </MultiuserContainer>
        );
    }

    return (
        <PropertyDisplayContainer
            $readOnly={props.readOnly}
            onClick={props.readOnly ? undefined : () => setIsEditing(true)}
            onKeyDown={props.readOnly ? undefined : handleActivateKey}
            data-testid='property-value'
        >
            {displayValues.length === 0 ? <EmptyState/> : (
                <ChipsContainer>
                    {displayValues.map((uid) => (
                        <Profile
                            key={uid}
                            userId={uid}
                        />
                    ))}
                </ChipsContainer>
            )}
        </PropertyDisplayContainer>
    );
};

const MultiuserContainer = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const ChipsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
`;

const ChipWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;
    padding: 2px 6px;
`;

const RemoveButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;

    &:hover {
        color: var(--error-text);
    }
`;

export default UserProperty;
