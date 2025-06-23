// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {
    CheckIcon,
    ContentCopyIcon,
    DotsHorizontalIcon,
    EyeOutlineIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';

import DotMenu, {DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import {Separator} from 'src/components/backstage/playbook_runs/shared';
import type {PropertyField} from 'src/types/property_field';
import GenericModal from 'src/components/widgets/generic_modal';

type Props = {
    field: PropertyField;
    onVisibility?: (field: PropertyField) => void;
    onDelete?: (field: PropertyField) => void;
    onDuplicate?: (field: PropertyField) => void;
};

const PropertyDotMenu = ({
    field,
    onVisibility,
    onDelete,
    onDuplicate,
}: Props) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Default to "when_set" (Hide when empty) if no visibility is set
    const currentVisibility = field.attrs.visibility || 'when_set';

    const handleVisibility = (visibility: 'hidden' | 'when_set' | 'always') => {
        onVisibility?.({...field, attrs: {...field.attrs, visibility}});
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = () => {
        onDelete?.(field);
        setShowDeleteModal(false);
    };

    const handleCancelDelete = () => {
        setShowDeleteModal(false);
    };

    const handleDuplicate = () => {
        onDuplicate?.(field);
    };

    return (
        <MenuContainer>
            <DotMenu
                placement='bottom-end'
                dotMenuButton={FullWidthActionsButton}
                dropdownMenu={CustomDropdownMenu}
                icon={<DotsHorizontalIcon size={16}/>}
            >
                <MenuTitle>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <EyeOutlineIcon size={16}/>
                            <FormattedMessage
                                id='playbook.properties.menu.visibility'
                                defaultMessage='Visibility'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </MenuTitle>
                <DropdownMenuItem onClick={() => handleVisibility('always')}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <FormattedMessage
                                id='playbook.properties.menu.visibility.always'
                                defaultMessage='Always show'
                            />
                        </MenuItemLeft>
                        {currentVisibility === 'always' && (
                            <CheckIcon
                                size={16}
                                color='var(--button-bg, #1c58d9)'
                            />
                        )}
                    </MenuItemContent>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisibility('when_set')}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <FormattedMessage
                                id='playbook.properties.menu.visibility.when_set'
                                defaultMessage='Hide when empty'
                            />
                        </MenuItemLeft>
                        {currentVisibility === 'when_set' && (
                            <CheckIcon
                                size={16}
                                color='var(--button-bg, #1c58d9)'
                            />
                        )}
                    </MenuItemContent>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisibility('hidden')}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <FormattedMessage
                                id='playbook.properties.menu.visibility.hidden'
                                defaultMessage='Always hide'
                            />
                        </MenuItemLeft>
                        {currentVisibility === 'hidden' && (
                            <CheckIcon
                                size={16}
                                color='var(--button-bg, #1c58d9)'
                            />
                        )}
                    </MenuItemContent>
                </DropdownMenuItem>
                <Separator/>
                <DropdownMenuItem onClick={handleDuplicate}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <ContentCopyIcon size={16}/>
                            <FormattedMessage
                                id='playbook.properties.menu.duplicate'
                                defaultMessage='Duplicate'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </DropdownMenuItem>
                <DangerDropdownMenuItem onClick={handleDeleteClick}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <DangerIcon><TrashCanOutlineIcon size={16}/></DangerIcon>
                            <FormattedMessage
                                id='playbook.properties.menu.delete'
                                defaultMessage='Delete'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </DangerDropdownMenuItem>
            </DotMenu>
            {showDeleteModal && (
                <GenericModal
                    id='confirm-property-delete-modal'
                    modalHeaderText={
                        <FormattedMessage
                            id='playbook.properties.delete.confirm.title'
                            defaultMessage='Delete Property'
                        />
                    }
                    show={showDeleteModal}
                    onHide={handleCancelDelete}
                    handleConfirm={handleConfirmDelete}
                    handleCancel={handleCancelDelete}
                    confirmButtonText={
                        <FormattedMessage
                            id='playbook.properties.delete.confirm.delete'
                            defaultMessage='Delete'
                        />
                    }
                    cancelButtonText={
                        <FormattedMessage
                            id='playbook.properties.delete.confirm.cancel'
                            defaultMessage='Cancel'
                        />
                    }
                    isConfirmDestructive={true}
                >
                    <p>
                        <FormattedMessage
                            id='playbook.properties.delete.confirm.warning'
                            defaultMessage='Are you sure you want to delete the property "{propertyName}"? This action cannot be undone.'
                            values={{
                                propertyName: field.name,
                            }}
                        />
                    </p>
                </GenericModal>
            )}
        </MenuContainer>
    );
};

const MenuContainer = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 8px 12px;
`;

const CustomDropdownMenu = styled(DropdownMenu)`
    max-width: 496px;
    min-width: 114px;
`;

const FullWidthActionsButton = styled.button<{$isActive?: boolean}>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: none;
    border-radius: 4px;
    background-color: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};
    color: ${(props) => (props.$isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    cursor: pointer;
    
    &:hover {
        background-color: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;

const MenuItemContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    width: 100%;
`;

const MenuItemLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const MenuTitle = styled.div`
    padding: 10px 20px;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: default;
    
    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const DangerDropdownMenuItem = styled(DropdownMenuItem)`
    && {
        color: #D24B4E;
    }

    &&:hover {
        color: #D24B4E;
    }
`;

const DangerIcon = styled.div`
    color: #D24B4E;
`;

export default PropertyDotMenu;