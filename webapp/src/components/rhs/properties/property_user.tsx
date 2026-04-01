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
import {useProfilesInTeam} from 'src/hooks/general';
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
    const previousValueRef = useRef<string | null>(displayValue);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newValue = typeof props.value?.value === 'string' ? props.value.value : null;
        previousValueRef.current = newValue;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const fetchUsersInTeam = useCallback(async () => profilesInTeam, [profilesInTeam]);

    const handleActivateKey = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEditing(true);
        }
    }, []);

    const handleSelectedChange = useCallback((user?: UserProfile) => {
        const previousValue = previousValueRef.current;
        const newValue = user?.id ?? null;
        previousValueRef.current = newValue;
        setDisplayValue(newValue);
        Promise.resolve(props.onValueChange(newValue)).catch(() => {
            if (isMounted.current) {
                setDisplayValue((current) => (current === newValue ? previousValue : current));
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

    if (!displayValue) {
        return (
            <PropertyDisplayContainer
                onClick={() => setIsEditing(true)}
                onKeyDown={handleActivateKey}
                data-testid='property-value'
            >
                <EmptyState/>
            </PropertyDisplayContainer>
        );
    }

    return (
        <PropertyDisplayContainer
            onClick={() => setIsEditing(true)}
            onKeyDown={handleActivateKey}
            data-testid='property-value'
        >
            <Profile userId={displayValue}/>
        </PropertyDisplayContainer>
    );
};

export const MultiuserProperty = (props: Props) => {
    const {formatMessage} = useIntl();
    const [isEditing, setIsEditing] = useState(false);
    const profilesInTeam = useProfilesInTeam();

    const rawValue = props.value?.value;
    const userIds: string[] = Array.isArray(rawValue) ? rawValue as string[] : [];

    const [displayValues, setDisplayValues] = useState<string[]>(userIds);
    const isMounted = useRef(true);
    const previousValuesRef = useRef<string[]>(userIds);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newValue = Array.isArray(props.value?.value) ? props.value?.value as string[] : [];
        previousValuesRef.current = newValue;
        setDisplayValues(newValue);
    }, [props.value?.value]);

    const fetchUsersInTeam = useCallback(async () => profilesInTeam, [profilesInTeam]);

    const handleActivateKey = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEditing(true);
        }
    }, []);

    const handleSelectedChange = useCallback((user?: UserProfile) => {
        if (!user) {
            return;
        }
        const previousValues = previousValuesRef.current;
        const newValues = previousValues.includes(user.id) ? previousValues.filter((id) => id !== user.id) : [...previousValues, user.id];
        previousValuesRef.current = newValues;
        setDisplayValues(newValues);
        Promise.resolve(props.onValueChange(newValues.length > 0 ? newValues : null)).catch(() => {
            if (isMounted.current) {
                setDisplayValues((current) => (current === newValues ? previousValues : current));
            }
        });
    }, [props.onValueChange]);

    const handleRemoveUser = useCallback((uid: string) => {
        const previousValues = previousValuesRef.current;
        const newValues = previousValues.filter((id) => id !== uid);
        previousValuesRef.current = newValues;
        setDisplayValues(newValues);
        Promise.resolve(props.onValueChange(newValues.length > 0 ? newValues : null)).catch(() => {
            if (isMounted.current) {
                setDisplayValues((current) => (current === newValues ? previousValues : current));
            }
        });
    }, [props.onValueChange]);

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

    if (displayValues.length === 0) {
        return (
            <PropertyDisplayContainer
                onClick={() => setIsEditing(true)}
                onKeyDown={handleActivateKey}
                data-testid='property-value'
            >
                <EmptyState/>
            </PropertyDisplayContainer>
        );
    }

    return (
        <PropertyDisplayContainer
            onClick={() => setIsEditing(true)}
            onKeyDown={handleActivateKey}
            data-testid='property-value'
        >
            <ChipsContainer>
                {displayValues.map((uid) => (
                    <Profile
                        key={uid}
                        userId={uid}
                    />
                ))}
            </ChipsContainer>
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
