// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {Playbook} from 'src/types/playbook';
import {navigateToTeamPluginUrl} from 'src/browser_routing';

import {deletePlaybook, clientFetchPlaybooks} from 'src/client';

import Spinner from 'src/components/assets/icons/spinner';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

import NoContentPlaybookSvg from '../../assets/no_content_playbooks_svg';

import BackstageListHeader from '../backstage_list_header';
import './playbook.scss';

const DeleteBannerTimeout = 5000;

const PlaybookList: FC = () => {
    const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    useEffect(() => {
        const fetchPlaybooks = async () => {
            setPlaybooks(await clientFetchPlaybooks(currentTeam.id));
        };
        fetchPlaybooks();
    }, [currentTeam.id]);

    const editPlaybook = (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        navigateToTeamPluginUrl(currentTeam.name, `/playbooks/${playbook.id}`);
    };

    const newPlaybook = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/playbooks/new');
    };

    const hideConfirmModal = () => {
        setShowConfirmation(false);
    };

    const onConfirmDelete = (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        setShowConfirmation(true);
    };

    const onDelete = async () => {
        if (selectedPlaybook) {
            await deletePlaybook(selectedPlaybook);
            setPlaybooks(await clientFetchPlaybooks(currentTeam.id));
            hideConfirmModal();
            setShowBanner(true);

            window.setTimeout(() => {
                setShowBanner(false);
                setSelectedPlaybook(null);
            }, DeleteBannerTimeout);
        }
    };

    const deleteSuccessfulBanner = showBanner && (
        <div className='banner'>
            <div className='banner__text'>
                <i className='icon icon-check mr-1'/>
                {`The playbook ${selectedPlaybook?.title} was successfully deleted.`}
            </div>
        </div>
    );

    let body;
    if (!playbooks) {
        body = (
            <Spinner/>
        );
    } else if (playbooks.length === 0) {
        body = (
            <div className='text-center pt-8'>
                {'There are no playbooks defined yet.'}
            </div>
        );
    } else {
        body = playbooks.map((p) => (
            <div
                className='row playbook-item'
                key={p.id}
                onClick={() => editPlaybook(p)}
            >
                <a className='col-sm-10 title'>
                    <TextWithTooltip
                        id={p.title}
                        text={p.title}
                    />
                </a>
                <div className='col-sm-2'>
                    <a>
                        {'Edit'}
                    </a>
                    {' - '}
                    <a
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfirmDelete(p);
                        }}
                    >
                        {'Delete'}
                    </a>
                </div>
            </div>
        ));
    }

    return (
        <div className='Playbook'>
            { deleteSuccessfulBanner }
            {
                (playbooks?.length === 0) &&
                <>
                    <NoContentPage onNewPlaybook={newPlaybook}/>
                    <NoContentPlaybookSvg/>
                </>
            }
            {
                (playbooks && playbooks.length !== 0) &&
                <>
                    <div className='Backstage__header'>
                        <div
                            data-testid='titlePlaybook'
                            className='title'
                        >
                            {'Playbooks'}
                            <div className='light'>
                                {'(' + currentTeam.display_name + ')'}
                            </div>
                        </div>
                        <div className='header-button-div'>
                            <button
                                className='btn btn-primary'
                                onClick={() => newPlaybook()}
                            >
                                <i className='icon-plus mr-2'/>
                                {'New Playbook'}
                            </button>
                        </div>
                    </div>
                    <div className='playbook-list'>
                        <BackstageListHeader>
                            <div className='row'>
                                <div className='col-sm-10'> {'Name'} </div>
                                <div className='col-sm-2'> {'Actions'}</div>
                            </div>
                        </BackstageListHeader>
                        {body}
                    </div>
                    <ConfirmModal
                        show={showConfirmation}
                        title={'Confirm Playbook Deletion'}
                        message={`Are you sure you want to delete the playbook "${selectedPlaybook?.title}"?`}
                        confirmButtonText={'Delete Playbook'}
                        onConfirm={onDelete}
                        onCancel={hideConfirmModal}
                    />
                </>
            }
        </div>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const Title = styled.h2`
    padding-top: 110px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 28px;
    color: var(--center-channel-color);
    text-align: center;
`;

const Description = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--sys-center-channel-color-rgb), 0.72);
    text-align: center;
    max-width: 800px;
`;

const Button = styled.button`
    display: inline-flex;
    background: var(--button-bg);
    color: var(--button-color);
    border-radius: 4px;
    border: 0px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 18px;
    align-items: center;
    padding: 14px 24px;
`;

const NoContentPage = (props: {onNewPlaybook: () => void}) => {
    return (
        <Container>
            <Title className='title'>{'What are Playbooks?'}</Title>
            <Description className='description'>{'A playbook is a workflow template. It is created ahead of time during planning and defines the stages and steps a workflow will have, along with who can start a workflow with the playbook.'}</Description>
            <Button
                className='btn btn-primary mt-6'
                onClick={() => props.onNewPlaybook()}
            >
                <i className='icon-plus mr-2'/>
                {'New Playbook'}
            </Button>
        </Container>
    );
};

export default PlaybookList;
