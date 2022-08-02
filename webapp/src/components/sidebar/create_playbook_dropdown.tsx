import React, {useRef} from 'react';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {mdiClipboardPlayMultipleOutline, mdiImport} from '@mdi/js';
import Icon from '@mdi/react';

import {displayPlaybookCreateModal} from 'src/actions';
import {importFile} from 'src/client';
import {useToaster, ToastType} from 'src/components/backstage/toast_banner';

import Menu from '../widgets/menu/menu';
import MenuItem from '../widgets/menu/menu_item';
import MenuGroup from '../widgets/menu/menu_group';
import MenuWrapper from '../widgets/menu/menu_wrapper';
import {navigateToPluginUrl} from 'src/browser_routing';

import {OVERLAY_DELAY} from 'src/constants';
import {useCanCreatePlaybooksOnAnyTeam} from 'src/hooks';

interface CreatePlaybookDropdownProps {
    team_id: string;
}

const CreatePlaybookDropdown = (props: CreatePlaybookDropdownProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const teams = useSelector(getMyTeams);
    const canCreatePlaybooks = useCanCreatePlaybooksOnAnyTeam();
    const addToast = useToaster().add;

    const tooltip = (
        <Tooltip id={'create_playbook_dropdown_tooltip'}>
            {formatMessage({defaultMessage: 'Browse or create Playbooks and Runs'})}
        </Tooltip>
    );

    const importUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];

            const teamId = props.team_id || teams[0].id;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                importFile(ev?.target?.result, teamId)
                    .then((id) => navigateToPluginUrl(`/playbooks/${id}/outline`))
                    .catch(() => addToast(formatMessage({defaultMessage: 'The playbook import has failed. Please check that is JSON valid and try again.'}), ToastType.Failure));
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const renderDropdownItems = () => {
        const browsePlaybooks = (
            <MenuItem
                id='browsePlaybooks'
                show={true}
                onClick={() => {
                    navigateToPluginUrl('/playbooks');
                }}
                icon={<StyledIcon className='icon-globe'/>}
                text={formatMessage({defaultMessage: 'Browse Playbooks'})}
            />
        );

        const createPlaybook = (
            <MenuItem
                id='createPlaybook'
                show={true}
                onClick={() => dispatch(displayPlaybookCreateModal({}))}
                icon={<StyledIcon className='icon-plus'/>}
                text={formatMessage({defaultMessage: 'Create New Playbook'})}
            />
        );

        const importPlaybook = (
            <>
                <MenuItem
                    id='importPlaybook'
                    show={true}
                    onClick={() => {
                        fileInputRef?.current?.click();
                    }}
                    icon={
                        <StyledMDIIcon
                            path={mdiImport}
                            size={'18px'}
                        />
                    }
                    text={formatMessage({defaultMessage: 'Import Playbook'})}
                />
            </>
        );

        const browseRuns = (
            <MenuItem
                id='browseRuns'
                show={true}
                onClick={() => {
                    navigateToPluginUrl('/runs');
                }}
                icon={
                    <StyledMDIIcon
                        path={mdiClipboardPlayMultipleOutline}
                        size={'18px'}
                    />
                }
                text={formatMessage({defaultMessage: 'Browse Runs'})}
            />
        );

        return (
            <>
                <MenuGroup noDivider={true}>
                    {browsePlaybooks}
                    {canCreatePlaybooks && createPlaybook}
                    {importPlaybook}
                </MenuGroup>
                <MenuGroup>
                    {browseRuns}
                </MenuGroup>
            </>
        );
    };

    return (
        <Dropdown>
            <OverlayTrigger
                delay={OVERLAY_DELAY}
                placement='top'
                overlay={tooltip}
            >
                <>
                    <Button aria-label={formatMessage({defaultMessage: 'Create Playbook Dropdown'})}>
                        <i className='icon-plus'/>
                    </Button>
                    <input
                        type='file'
                        accept='*.json,application/JSON'
                        onChange={importUpload}
                        ref={fileInputRef}
                        style={{display: 'none'}}
                    />
                </>
            </OverlayTrigger>
            <Menu
                id='CreatePlaybookDropdown'
                ariaLabel={formatMessage({defaultMessage: 'Create Playbook Dropdown'})}
            >
                {renderDropdownItems()}
            </Menu>
        </Dropdown>
    );
};

export default CreatePlaybookDropdown;

const Dropdown = styled(MenuWrapper)`
    position: relative;
    height: 30px;
`;

const Button = styled.button`
    border-radius: 16px;
    font-size: 18px;

    background-color: rgba(var(--sidebar-text-rgb), 0.08);
    color: rgba(var(--sidebar-text-rgb), 0.72);

    z-index: 1;
    padding: 0;
    border: none;
    background: transparent;

    &:hover:not(.active) {
        background: rgba(var(--sidebar-text-rgb), 0.16);
        color: var(--sidebar-text);
    }

    min-width: 28px;
    height: 28px;
    font-size: 18px;
    vertical-align: middle;

    &.disabled {
        background: rgba(255, 255, 255, 0.08);
    }
`;

const StyledMDIIcon = styled(Icon)`
    width: 25px;
    height: 22px;
    margin-right: 7px;
    margin-left: 4px;
`;

const StyledIcon = styled.i`
    width: 25px;
    height: 22px;
    margin-right: 3px;
`;
