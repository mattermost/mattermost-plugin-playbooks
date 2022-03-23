import {
    haveIChannelPermission,
    haveITeamPermission,
    haveISystemPermission,
    getRoles,
} from 'mattermost-redux/selectors/entities/roles';
import {loadRolesIfNeeded} from 'mattermost-webapp/packages/mattermost-redux/src/actions/roles';
import {getCurrentUserId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';
import {GlobalState} from 'mattermost-webapp/types/store';
import {useDispatch, useSelector} from 'react-redux';

import {makeGeneralPermissionSpecific, PlaybookPermissionGeneral} from 'src/types/permissions';

import {Playbook, PlaybookMember} from 'src/types/playbook';

import {usePlaybook} from './crud';

export const useHasSystemPermission = (permission: string) => {
    return useSelector((state: GlobalState) => haveISystemPermission(state, {permission}));
};

export const useHasTeamPermission = (teamID: string, permission: string) => {
    return useSelector((state: GlobalState) => haveITeamPermission(state, teamID, permission));
};

export const useHasChannelPermission = (teamID: string, channelID: string, permission: string) => {
    return useSelector((state: GlobalState) => haveIChannelPermission(state, teamID, channelID, permission));
};

export const useHasPlaybookPermissionById = (permission: PlaybookPermissionGeneral, playbookId: string) => {
    const playbook = usePlaybook(playbookId);
    return useHasPlaybookPermission(permission, playbook);
};

export const useHasPlaybookPermission = (permission: PlaybookPermissionGeneral, playbook: Maybe<Playbook>) => {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const roles = useSelector(getRoles);
    const specificPermission = makeGeneralPermissionSpecific(permission, playbook?.public || false);
    const hasTeamPermision = useHasTeamPermission(playbook?.team_id || '', specificPermission);

    if (hasTeamPermision) {
        return true;
    }

    if (!playbook) {
        return false;
    }

    const member = playbook?.members.find((val: PlaybookMember) => val.user_id === currentUserId);

    let userRoles: string[] = [];
    if (member) {
        userRoles = member.scheme_roles || [];
    } else if (playbook.public) {
        userRoles = [playbook.default_playbook_member_role];
    }

    if (!userRoles) {
        return false;
    }

    dispatch(loadRolesIfNeeded(userRoles));

    for (const userRole of userRoles) {
        const role = roles[userRole];
        if (role?.permissions.includes(specificPermission)) {
            return true;
        }
    }

    return false;
};
