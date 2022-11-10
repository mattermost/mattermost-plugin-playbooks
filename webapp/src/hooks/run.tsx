// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {useUpdateEffect} from 'react-use';

import {
    isFavoriteItem,
} from 'src/client';
import {useUpdateRun} from 'src/graphql/hooks';
import {CategoryItemType} from 'src/types/category';
import BecomeParticipantsModal from 'src/components/backstage/playbook_runs/playbook_run/become_participant_modal';
import {PlaybookRun} from 'src/types/playbook_run';

export const useFavoriteRun = (teamID: string, runID: string): [boolean, () => void] => {
    const [isFavoriteRun, setIsFavoriteRun] = useState(false);
    const updateRun = useUpdateRun(runID);

    useEffect(() => {
        isFavoriteItem(teamID, runID, CategoryItemType.RunItemType)
            .then(setIsFavoriteRun)
            .catch(() => setIsFavoriteRun(false));
    }, [teamID, runID]);

    const toggleFavorite = () => {
        if (isFavoriteRun) {
            updateRun({isFavorite: false});
            setIsFavoriteRun(false);
            return;
        }
        updateRun({isFavorite: true});
        setIsFavoriteRun(true);
    };
    return [isFavoriteRun, toggleFavorite];
};

export const useParticipateInRun = (playbookRun: PlaybookRun | undefined, trigger: 'channel_rhs'|'run_details') => {
    const [showParticipateConfirm, setShowParticipateConfirm] = useState(false);

    const ParticipateConfirmModal = (
        <BecomeParticipantsModal
            playbookRun={playbookRun}
            show={showParticipateConfirm}
            hideModal={() => setShowParticipateConfirm(false)}
            trigger={trigger}
        />
    );
    return {
        ParticipateConfirmModal,
        showParticipateConfirm: () => {
            setShowParticipateConfirm(true);
        },
    };
};

export const useRunFollowers = (metadataFollowers: string[]) => {
    const currentUserId = useSelector(getCurrentUserId);
    const [followers, setFollowers] = useState(metadataFollowers);
    const [isFollowing, setIsFollowing] = useState(followers.includes(currentUserId));

    useUpdateEffect(() => {
        setFollowers(metadataFollowers);
    }, [currentUserId, JSON.stringify(metadataFollowers)]);

    useUpdateEffect(() => {
        setIsFollowing(followers.includes(currentUserId));
    }, [currentUserId, JSON.stringify(followers)]);

    return {isFollowing, followers, setFollowers};
};
