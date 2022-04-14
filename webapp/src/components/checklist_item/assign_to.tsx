import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {ControlProps, components} from 'react-select';
import {UserProfile} from 'mattermost-redux/types/users';

import ProfileSelector, {Option} from 'src/components/profile/profile_selector';
import {useProfilesInCurrentChannel, useProfilesInTeam} from 'src/hooks';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';

interface AssignedToProps {
    assignee_id: string;
    editable: boolean;
    withoutName?: boolean;
    inHoverMenu?: boolean;

    onSelectedChange: (userType?: string, user?: UserProfile) => void;
}

const AssignTo = (props: AssignedToProps) => {
    const {formatMessage} = useIntl();
    const profilesInChannel = useProfilesInCurrentChannel();
    const profilesInTeam = useProfilesInTeam();
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);

    const resetAssignee = () => {
        props.onSelectedChange();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    if (props.inHoverMenu) {
        return (
            <ProfileSelector
                selectedUserId={props.assignee_id}
                onlyPlaceholder={true}
                placeholder={
                    <HoverMenuButton
                        title={formatMessage({defaultMessage: 'Assign'})}
                        className={'icon-account-plus-outline icon-16 btn-icon'}
                    />
                }
                enableEdit={true}
                getUsers={async () => {
                    return profilesInChannel;
                }}
                getUsersInTeam={async () => {
                    return profilesInTeam;
                }}
                onSelectedChange={props.onSelectedChange}
                selfIsFirstOption={true}
                customControl={ControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(props.assignee_id),
                    onCustomReset: resetAssignee,
                }}
                controlledOpenToggle={profileSelectorToggle}
                showOnRight={true}
            />
        );
    }

    return (
        <AssignToContainer>
            <StyledProfileSelector
                testId={'assignee-profile-selector'}
                selectedUserId={props.assignee_id}
                placeholder={
                    <PlaceholderDiv>
                        <AssignToIcon
                            title={formatMessage({defaultMessage: 'Assign to...'})}
                            className={'icon-account-plus-outline icon-16 btn-icon'}
                        />
                        <AssignToTextContainer>
                            {formatMessage({defaultMessage: 'Assign to...'})}
                        </AssignToTextContainer>
                    </PlaceholderDiv>
                }
                placeholderButtonClass={'NoAssignee-button'}
                profileButtonClass={props.withoutName ? 'NoName-Assigned-button' : 'Assigned-button'}
                enableEdit={props.editable}
                getUsers={async () => {
                    return profilesInChannel;
                }}
                getUsersInTeam={async () => {
                    return profilesInTeam;
                }}
                onSelectedChange={props.onSelectedChange}
                selfIsFirstOption={true}
                customControl={ControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(props.assignee_id),
                    onCustomReset: resetAssignee,
                }}
                selectWithoutName={props.withoutName}
            />
        </AssignToContainer>
    );
};

export default AssignTo;

const ControlComponent = (ownProps: ControlProps<Option, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage defaultMessage='No Assignee'/>
            </ControlComponentAnchor>
        )}
    </div>
);

const StyledProfileSelector = styled(ProfileSelector)`
    .Assigned-button, .NoAssignee-button, .NoName-Assigned-button {
        display: flex;
        align-items: center;
        max-width: 100%;
        height: 24px;
        padding: 2px 6px 2px 2px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
        border-radius: 100px;
        border: none;

        font-weight: 400;
        font-size: 12px;
        line-height: 10px;

        :hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .image {
            width: 20px;
            height: 20px;
        }

        .icon-chevron-down{
            font-weight: 400;
            font-size: 14.4px;
            line-height: 14px;
            display: flex;
            align-items: center;
            text-align: center;
        }
    }
    .NoName-Assigned-button {
        background: none;
        padding: 0px;

        .image {
            margin: 0px;
        }
    }
`;

const PlaceholderDiv = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
`;

const AssignToTextContainer = styled.div`
    color: var(--center-channel-color);
    font-weight: 600;
    font-size: 12px;
    line-height: 15px;
`;

const AssignToIcon = styled.i`
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    text-align: center;
    flex: table;
`;

const AssignToContainer = styled.div`
    :not(:first-child) {
        margin-left: 36px;
    }
    max-width: calc(100% - 210px);
`;

const ControlComponentAnchor = styled.a`
    display: inline-block;
    margin: 0 0 8px 12px;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    top: -4px;
`;
